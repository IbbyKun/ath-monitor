const Moment = require('moment-timezone');
const MomentRange = require('moment-range');
const _ = require('lodash');

const DayCounter = require('./AttDayCounter');
const moment = MomentRange.extendMoment(Moment);
const EmpProductivityModel = require('../../../../models/employee_productivity.schema');

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

            if (attData) {
                attData.map(d => {
                    if (String(new Date(d.date)) === String(new Date(day))) {
                        empCheckin = d.start;
                        empCheckout = d.end;
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

            this.attendance[dayOfMonth].log =  await this.parseOneDayLog(empCheckin, empCheckout, time, day);
            this.next();
            empCheckin='';empCheckout='';
        }

        return this.getSheet();
    }

    async parseOneDayLog(empStart, empEnd, shiftData, day) {
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
            const { empWorkTime, shiftWorkTime } = this.getWorkTimeDiff(allTimes);
            const productivity = await fetchProductivity(this.employee.id, this.employee.orgId, day);

            const marker = this.classifyDay({ productivity, empWorkTime, shiftWorkTime });
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
     * Decide whether a worked day counts as full, half or absent.
     *
     * One number drives it: the productive time a working day is expected to
     * contain, set per shift as "Full-Day Productive Time". Everything else is
     * derived from that ratio, so there is nothing to keep in step:
     *
     *     ratio = target / actual productive time
     *
     *       ratio <  1.2  ->  P   full day
     *       ratio <  2    ->  H   half day
     *       otherwise     ->  A   absent
     *
     * With an 8-hour target that puts the full-day floor at 6h40m and the
     * half-day floor at 4h. The 1.2 band exists so somebody who works a normal
     * day but loses twenty minutes to a meeting that isn't on their screen is
     * not docked half a day for it.
     *
     * Note this judges **productive** time, not time at the desk — being
     * clocked in for nine hours with two hours of productive work is a half
     * day, which is the point of measuring it this way.
     *
     * If no target is configured the rule cannot apply, and falling through to
     * "absent" would mark an entire organisation absent the moment they
     * enabled shifts. So we keep the old hours-at-desk comparison for that
     * case; configuring a target is what switches the productive-time rule on.
     */
    classifyDay({ productivity, empWorkTime, shiftWorkTime }) {
        const target = this.productivity_present;

        if (!target) {
            const halfDayFloor = this.minWorkingHoursForHalfday || shiftWorkTime / 2;
            if (empWorkTime <= halfDayFloor) return 'A';
            if (empWorkTime < shiftWorkTime - this.earlyLogoutPeriod) return 'H';
            return 'P';
        }

        if (!productivity || productivity <= 0) return 'A';

        const ratio = target / productivity;
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
AttendanceCalculator.FULL_DAY_RATIO = 1.2;   // within ~83% of target -> full day
AttendanceCalculator.HALF_DAY_RATIO = 2;     // at least half the target -> half day

module.exports = AttendanceCalculator;

async function fetchProductivity(empId, orgId, date) {
    try {
        const formattedDate = new Date(date).toISOString().split('T')[0];

        let query = [{ $match: { organization_id: orgId, employee_id: empId, date: formattedDate } }];
        let result = await EmpProductivityModel.aggregate(query);

        return result.length > 0 ? result[0].productive_duration : 0;
    } catch (err) {
        throw err;  
    }
}