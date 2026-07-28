import React from 'react'
import EmpSystemLogs from '@/components/common/system-logs/EmpSystemLogs'
import { useSecondScreenStore } from './secondScreenStore'

// Applications seen on a monitor the employee was not working in.
//
// Time is always credited to the focused window, so a film playing on a second
// screen never appears in the timesheet. This report is the counterweight:
// same table, different log type, no duration column — because the duration
// here is an estimate stated in the details, not tracked time.
const SecondScreenActivity = () => (
  <div className="bg-slate-200 w-full min-h-screen p-5">
    <EmpSystemLogs
      useStore={useSecondScreenStore}
      heading="Second Screen"
      headingAccent="Activity"
      description="Applications visible on a monitor the employee was not working in. Reported as evidence — this time is still credited to the focused application."
    />
  </div>
)

export default SecondScreenActivity
