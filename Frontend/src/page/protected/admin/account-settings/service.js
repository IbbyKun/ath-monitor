import apiService from "@/services/api.service";

/**
 * Account Settings reads/writes the same organization record the Localization
 * page uses (`/organization/organization-details` + `/organization/update-org-details`),
 * plus the two-factor endpoints that had no UI behind them until now.
 */

export const WEEKDAYS = [
  { value: "sunday", label: "Sunday" },
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
];

export const getAccountSettings = async () => {
  try {
    const { data } = await apiService.apiInstance.get("/organization/organization-details");
    if (data?.code === 200) {
      return {
        success: true,
        data: {
          timezone: data.data?.timezone || "",
          language: data.data?.language || "en",
          weekdayStart: data.data?.weekday_start || "monday",
          currentUserCount: data.data?.current_user_count ?? 0,
          totalAllowedUserCount: data.data?.total_allowed_user_count ?? 0,
          logo: data.data?.logo || null,
        },
      };
    }
    return { success: false, message: data?.message || "Failed to load account settings" };
  } catch (error) {
    console.error("Account Settings: fetch error", error);
    return { success: false, message: "Failed to load account settings" };
  }
};

export const saveAccountSettings = async ({ timezone, language, weekdayStart }) => {
  try {
    const { data } = await apiService.apiInstance.put("/organization/update-org-details", {
      timezone,
      language,
      weekday_start: weekdayStart,
    });
    if (data?.code === 200) {
      return { success: true, message: "Account settings saved" };
    }
    return { success: false, message: data?.message || "Failed to save account settings" };
  } catch (error) {
    console.error("Account Settings: save error", error);
    return { success: false, message: error.response?.data?.message || "Failed to save account settings" };
  }
};

/**
 * Note: the backend's get-2fa-status hands back the raw row array
 * (organization.model.js `get2FAStatus`), so normalize both shapes here
 * rather than assuming one.
 */
export const getTwoFactorStatus = async () => {
  try {
    const { data } = await apiService.apiInstance.get("/organization/get-2fa-status");
    if (data?.code === 200) {
      const row = Array.isArray(data.data) ? data.data[0] : data.data;
      return {
        success: true,
        enabled: Number(row?.is2FAEnable) === 1,
        type: row?.mfa_config?.type || "email",
      };
    }
    return { success: false, message: data?.message || "Failed to load two-factor status" };
  } catch (error) {
    console.error("Account Settings: 2FA fetch error", error);
    return { success: false, message: "Failed to load two-factor status" };
  }
};

export const setTwoFactorStatus = async (enabled) => {
  try {
    const { data } = await apiService.apiInstance.post("/organization/update-2fa-status", {
      status: enabled ? 1 : 0,
      type: "email",
    });
    if (data?.code === 200) {
      return {
        success: true,
        message: enabled
          ? "Two-factor authentication enabled — admins will get a code by email at sign-in."
          : "Two-factor authentication disabled.",
      };
    }
    return { success: false, message: data?.message || "Failed to update two-factor authentication" };
  } catch (error) {
    console.error("Account Settings: 2FA save error", error);
    return { success: false, message: error.response?.data?.message || "Failed to update two-factor authentication" };
  }
};
