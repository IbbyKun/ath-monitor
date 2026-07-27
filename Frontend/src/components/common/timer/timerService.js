import apiService from "@/services/api.service";

/**
 * Manual clock-in/clock-out, backed by store-logs-api's already-existing
 * (previously frontend-less) timesheet module. One call submits a COMPLETE
 * start/end pair — there's no separate "open a session" call, so we only
 * hit the API on Stop, once both timestamps are known.
 *
 * type: 1 = Clock, 2 = Break. mode: 1 = Auto (agent), 2 = Manual (this button).
 */
export const recordClock = async ({ startDate, endDate, type = 1, mode = 2 }) => {
  try {
    const { data } = await apiService.storeLogsInstance.post("/timesheet/record-clock-in", {
      data: [{ type, mode, startDate, endDate }],
    });
    return data ?? null;
  } catch (error) {
    console.error("Timer: recordClock error", error);
    return { statusCode: 500, message: error?.response?.data?.message || error?.message || "Failed to record time." };
  }
};
