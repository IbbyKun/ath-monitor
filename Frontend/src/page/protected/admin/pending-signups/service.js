import apiService from "@/services/api.service";

/**
 * List self-serve signups awaiting admission into this org (or any org —
 * the pending pool is global by design, see Backend/admin auth.service.js
 * `signup()`). Optional `email` does a partial match.
 */
export const fetchPendingSignups = async (email = "") => {
  try {
    const { data } = await apiService.apiInstance.get("/user/pending-signups", {
      params: { email, limit: 200, skip: 0 },
    });
    return Array.isArray(data?.data) ? data.data : [];
  } catch (error) {
    console.error("Pending Signups: fetchPendingSignups error", error);
    return [];
  }
};

/**
 * Bulk-admit selected pending signups into this org, assigning a single
 * department/location/role to the whole batch. Returns per-id results —
 * this is NOT all-or-nothing, so callers must show partial failures.
 */
export const admitPendingSignups = async ({ userIds, departmentId, locationId, roleId, shiftId }) => {
  try {
    const { data } = await apiService.apiInstance.post("/user/admit-pending-signups", {
      user_ids: userIds,
      department_id: departmentId,
      location_id: locationId,
      role_id: roleId,
      shift_id: shiftId || 0,
    });
    return data ?? null;
  } catch (error) {
    console.error("Pending Signups: admitPendingSignups error", error);
    return error?.response?.data ?? { code: 500, message: error?.message || "Admit failed." };
  }
};
