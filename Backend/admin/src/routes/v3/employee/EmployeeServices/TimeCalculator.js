const Moment = require('moment-timezone');
const MomentRange = require('moment-range');
const _ = require('lodash');

const DayCounter = require('./AttDayCounter');
const moment = MomentRange.extendMoment(Moment);
const UserActivityDataModel = require('../../../../models/user_activity_data.schema');

class AttendanceCalculator {
    constructor({ employee, attendanceData, shift, range, orgTimezone }) {
        this.latePeriod = shift && shift.late_period && moment.duration(shift.late_period).asMinutes() ? moment.duration(shift.late_period).asMinutes() : 10;
        this.earlyLogoutPeriod = shift && shift.early_login_logout_time && moment.duration(shift.early_login_logout_time).asMinutes() ? moment.duration(shift.early_login_logout_time).asMinutes() : 10;
        this.minWorkingHoursForHalfday = shift && shift.half_day_hours ? moment.duration(shift.half_day_hours).asMinutes() : 0;
        this.overtime_period = shift && shift.overtime_period && moment.duration(shift.overtime_period).asMinutes() ? moment.duration(shift.overtime_period).asMinutes() : 60;
        this.productivity_halfday = shift && shift.productivity_halfday && moment.duration(shift.productivity_halfday).asSeconds() ? moment.duration(shift.productivity_halfday).asSeconds() : 0;
        this.productivity_present = shift && shift.productivity_present && moment.duration(shift.productivity_present).asSeconds() ? moment.duration(shift.productivity_present).asSeconds() : 0;
        this.orgTimezone = orgTimezone;
        this.counter = new DayCounter();
        this.attendanceData = attendanceData;
        this.range = range;
        this.shift = shift;
        const { id, emp_code, first_name, last_name, timezone, departament, location, oID:orgId } = employee;
        const full_name = `${first_name} ${last_name}`;

        this.employee = {
            id,
            emp_code,
            first_name,
            last_name,
            full_name,
            departament,
            location,
            timezone,
            orgId
        };
    }

    static parseMonthRange(date) {
        const startMonth = moment.utc(date, 'YYYYMM').startOf('month');
        const endMonth = startMonth.clone().endOf('month');

        return moment.range(startMonth, endMonth);
    }

   async  calculate() {
        if (!this.shift) {
            this.attendance = 'Don`t have shift for this employee';
            return this.getSheet();
        }
        const { timezone: shiftTimezone, data: shiftTimeStr, name } = this.shift;

        // The shift's timezone comes from its location (see
        // Employee.model.js getOrganizationShifts, which joins
        // organization_locations for it) and must win. A shift start of
        // "09:00" is 09:00 *where that team sits*, so a Karachi shift and a
        // London shift both reading 09:00 are different instants.
        //
        // This used to destructure the value and then immediately overwrite it
        // with the organisation-wide timezone, so every location was judged
        // against head office's clock — a team five hours away was marked late
        // every single morning. Locations are the timezone grouping; honour them.
        this.timezone = shiftTimezone || this.orgTimezone || this.employee.timezone;
        this.employee.shift = name;
        const shiftWeekData = JSON.parse(shiftTimeStr);
        this.attendance = {};
        const attData = this.attendanceData;
        let empCheckin, empCheckout;

        for (const day of this.range.by('days')) {
            const dayOfMonth = day.date();
            const dayOfWeek = day.format('ddd').toLowerCase();
            const { status, time } = shiftWeekData[dayOfWeek];
            let workedSeconds = null;

            if (attData) {
                attData.map(d => {
                    if (String(new Date(d.date)) === String(new Date(day))) {
                        empCheckin = d.start;
                        empCheckout = d.end;
                        // Sum of the day's clock sessions — see
                        // Employee.model.js getAttendanceSheet. Null on rows
                        // predating that change, which fall back to the span.
                        workedSeconds = d.worked_seconds == null ? null : Number(d.worked_seconds);
                    }
                });
            }
            this.attendance[dayOfMonth] = {
                dayOfWeek,
                isWorkDay: status,
                log: {},
            };

            if (!status) {
                this.attendance[dayOfMonth].log.marker = 'D';
                this.counter.plus('D');
                if (empCheckin && empCheckout) {
                    this.attendance[dayOfMonth].log = this.parseOffDayLog(empCheckin, empCheckout);
                    empCheckin='';empCheckout='';
                    continue;
                }
                else continue;
            }

            this.attendance[dayOfMonth].shiftTime = time;

            if (!empCheckin && !empCheckout) {
                if (moment(day).isAfter(moment(), 'day')) {
                    this.attendance[dayOfMonth].log.marker = '-';
                    continue;
                } else if((moment(day).isBefore(moment(), 'day'))) {
                    this.attendance[dayOfMonth].log.marker = 'A';
                    this.counter.plus('A');
                    continue;
                }
            }          

            this.attendance[dayOfMonth].log =  await this.parseOneDayLog(empCheckin, empCheckout, time, day, workedSeconds);
            this.next();
            empCheckin='';empCheckout='';
        }

        return this.getSheet();
    }

    async parseOneDayLog(empStart, empEnd, shiftData, day, workedSeconds = null) {
        const log = {
            time: {},
            marker: 'P',
        };
        try {
            let {empStart:empCheckin, empEnd:empCheckout} = this.empTimeToUtc(empStart,empEnd,this.timezone)
            let { shiftStart, shiftEnd } = this.shiftTimeToUTC(shiftData, day);
            log.time =this.getTimeFromTimestamp(empCheckin,empCheckout);   
            const allTimes = { shiftStart, shiftEnd, empCheckin, empCheckout };
            //Not sending data till shift end for the current date
            if(moment().tz(this.timezone) < shiftEnd ) {
               log.marker = '-';
               delete log.time;
               return log;
            }
            //if current day user has not logged in 
            if((!empStart && !empEnd)){
                log.marker = 'A';
                this.counter.plus('A');
                delete log.time;
                return log;
            }
            const { empWorkTime: spanMinutes, shiftWorkTime } = this.getWorkTimeDiff(allTimes);

            // Time actually on the clock, in minutes:
            //   accumulated sessions  -  idle the agent already discounted
            //
            // The agent applies the idle rule itself (a continuous run past
            // the org's idle threshold is dropped, shorter pauses are not) and
            // reports the total as breakInSeconds. Nothing consumed it until
            // now — attendance read the wall-clock span, so both the lunch
            // break and long idle stretches were paid.
            let empWorkTime = spanMinutes;
            if (workedSeconds != null) {
                const breakSeconds = await fetchBreakSeconds(this.employee.id, this.employee.orgId, day);
                empWorkTime = Math.max(0, Math.round((workedSeconds - breakSeconds) / 60));
            }

            const marker = this.classifyDay({ empWorkTime, shiftWorkTime });
            log.marker = marker;
            this.counter.plus(marker);

            if (marker === 'A') {
                return log;
            }

            const isLate = this.isLate(empCheckin, shiftStart);
            const isOvertime = this.isOvertime(empWorkTime, shiftWorkTime);
            const isEarlyLogout = this.isEarlyLogout(empCheckout, shiftEnd);

            if (isLate > 0) {
                log.late = 'L';
                this.counter.plus('L');
                log.lateTime = isLate + this.latePeriod;
            }

            if (isOvertime > 0) {
                log.overtime = 'O';
                this.counter.plus('O');
                log.overTime_duration = isOvertime + this.overtime_period ;
            }

            if (isEarlyLogout > 0) {
                log.earlyLogout = 'EL';
                this.counter.plus('EL');
                log.earlyLogout_duration = isEarlyLogout + this.earlyLogoutPeriod;
            }
            // The day's marker was counted once by classifyDay above. A second
            // `counter.plus('P')` used to live here, so every full day was
            // tallied twice in the monthly totals.

            return log;
        } catch (error) {
            log.marker = '-';
            log.message = 'Invalid shift data for this day';

            return log;
        }
    }
    parseOffDayLog(empStart,empEnd){
        const log = {
            marker: 'D',
        };
        let {empStart:empCheckin, empEnd:empCheckout} = this.empTimeToUtc(empStart,empEnd,this.timezone)
            const overtime = empCheckout.diff(empCheckin, 'minutes');
            if(overtime >= this.overtime_period){
                log.time = this.getTimeFromTimestamp(empCheckin,empCheckout);
                log.overtime = 'O';
                log.overTime_duration = overtime;
                this.counter.plus('O');
                return log;
        }
        return log;
    }
    /**
     * Full day, half day or absent — decided purely by time on the clock.
     *
     * The admin sets one number: the shift's hours per day, from its start and
     * end times. Everything derives from the ratio of that to time actually
     * worked:
     *
     *     ratio = required / worked
     *
     *       ratio <  1.2  ->  P   full day
     *       ratio <  2    ->  H   half day
     *       otherwise     ->  A   absent
     *
     * On an 8-hour shift that is a full day from 6h40m and a half day from 4h.
     * The tolerance band exists so somebody a few minutes short is not docked
     * half a day for it.
     *
     * Note what this does *not* consider: productivity. Whether the time was
     * spent in a productive application is a separate question, answered by
     * the productivity report as productive ÷ total. Attendance is about
     * whether someone worked their hours; conflating the two meant an employee
     * could put in a full day and still be marked absent because their tools
     * had not been classified yet.
     *
     * `worked` is accumulated session time minus the idle the agent already
     * discounted — not the wall-clock span of the day. See parseOneDayLog.
     */
    classifyDay({ empWorkTime, shiftWorkTime }) {
        if (!shiftWorkTime || shiftWorkTime <= 0) return 'A';
        if (!empWorkTime || empWorkTime <= 0) return 'A';

        const ratio = shiftWorkTime / empWorkTime;
        if (ratio < AttendanceCalculator.FULL_DAY_RATIO) return 'P';
        if (ratio < AttendanceCalculator.HALF_DAY_RATIO) return 'H';
        return 'A';
    }

    isOvertime(empWorkTime, shiftWorkTime) {
        const overtime = empWorkTime - shiftWorkTime;
        return overtime - this.overtime_period;
    }

    isLate(empStart, shiftStart) {
        const loginTimeDifference = empStart.diff(shiftStart, 'minutes');
        const lateTime = loginTimeDifference - this.latePeriod;
        return lateTime;
    }

    isEarlyLogout(empEnd, shiftEnd) {
        const logoutTimeDifference = shiftEnd.diff(empEnd, 'minutes');
        return logoutTimeDifference - this.earlyLogoutPeriod;
    }

    parseShiftMinHour(time) {
        try {
            const [hour, minutes] = time.split(':');

            return {
                hour: parseInt(hour, 10),
                minutes: parseInt(minutes, 10),
            };
        } catch (error) {
            throw new Error('Invalid shift Data');
        }
    }

    getWorkTimeDiff({ shiftStart, shiftEnd, empCheckin, empCheckout }) {
        const shiftWorkTime = shiftEnd.diff(shiftStart, 'minutes');

        const empWorkTime = empCheckout.diff(empCheckin, 'minutes');

        return { empWorkTime, shiftWorkTime };
    }

    userTimeToMoment(time) {
        return {
            empStart: moment(time.start),
            empEnd: moment(time.end),
        };
    }

    isShiftEndInNextDay(start, end) {
        const startInMin = start.hour * 60 + start.minutes;
        const endInMin = end.hour * 60 + end.minutes;

        return startInMin > endInMin;
    }
    
    getTimeFromTimestamp(start,end) {
        start =start.format('HH:mm');
        end = end.format('HH:mm');
        return {start,end}
    }
      
    shiftTimeToUTC({ start, end }, day) {
        if (!start || !end) {
            throw new Error('Invalid shift Data');
        }
        const parsedStart = this.parseShiftMinHour(start);
        const parsedEnd = this.parseShiftMinHour(end);

        const startDateWithTz = moment.tz(day, this.timezone);
        const endDateWithTz = startDateWithTz.clone();
        if (this.isShiftEndInNextDay(parsedStart, parsedEnd)) {
            endDateWithTz.add(1, 'day');
        }
        
        let shiftStart= moment(startDateWithTz).set(parsedStart);
        let shiftEnd= moment(endDateWithTz).set(parsedEnd);

        if(shiftStart.isBefore(day)){
        shiftStart =shiftStart.add(1,'day');
        shiftEnd =shiftEnd.add(1,'day');
        }
        return{
            shiftStart,shiftEnd
        }
   }

    empTimeToUtc(empStart,empEnd){
    empStart =moment.tz(empStart, this.timezone);
    empEnd =moment.tz(empEnd, this.timezone);
    return {empStart,empEnd};
    }
   
    next() {
        this.cycleIndex += 1;
    }

    index() {
        return this.cycleIndex;
    }

    getSheet() {
        return { ...this.employee, ...this.counter.values, date: this.attendance };
    }
}

/**
 * Day-classification bands, as `target / actual productive time`.
 *
 * Named rather than inlined because they are a policy decision, not an
 * implementation detail — if the business changes its mind about how much
 * slack a full day gets, this is the one place to change.
 */
AttendanceCalculator.FULL_DAY_RATIO = 1.2;   // within ~83% of the required hours -> full day
AttendanceCalculator.HALF_DAY_RATIO = 2;     // at least half the required hours -> half day

module.exports = AttendanceCalculator;

/**
 * Idle the agent has already discounted for this day, in seconds.
 *
 * The agent owns the idle rule — a continuous run past the organisation's
 * threshold is dropped in full, anything shorter is left alone — and reports
 * the running total as `breakInSeconds` on each activity batch. Recomputing it
 * here from raw per-second data would risk the two disagreeing, so we just add
 * up what the agent decided.
 *
 * `date` on these documents is DD-MM-YYYY, written by store-logs-api from the
 * batch's dataId.
 */
async function fetchBreakSeconds(empId, orgId, day) {
    try {
        const formattedDate = moment(day).format('DD-MM-YYYY');
        const result = await UserActivityDataModel.aggregate([
            { $match: { userId: empId, adminId: orgId, date: formattedDate } },
            { $group: { _id: null, total: { $sum: '$breakInSeconds' } } },
        ]);
        return result.length > 0 ? result[0].total : 0;
    } catch (err) {
        // Attendance must not fail because the activity store is unreachable;
        // no deduction is a better answer than no report.
        return 0;
    }
}

// fetchProductivity() lived here and pulled productive_duration to gate the
// day's marker. Attendance no longer looks at productivity at all — whether
// the hours were spent productively is a separate question, answered by the
// productivity report. Removed rather than left dangling so nobody wires it
// back in by accident.