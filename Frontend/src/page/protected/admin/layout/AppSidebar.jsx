import { useState } from "react";
import { useTranslation } from "react-i18next";
import empLogo from "@/assets/emp.png";
import favLogo from "@/assets/fav.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarHeader,
  useSidebar,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  Clock,
  History,
  Monitor,
  HandCoins,
  Briefcase,
  BarChart3,
  ShieldAlert,
  Settings2,
  Zap,
  Smartphone,
  Code2,
  ReceiptText,
  Key,
  Store,
  ToggleRight,
} from "lucide-react";
import AppMenuItems from "./AppMenuItems";
import useAdminSession from "@/sessions/adminSession";
import { getSessionCookie } from "@/lib/sessionCookie";

// Mirrors the backend gate: super admin OR a user in the env-configured
// operator org can see and use the addon-features console.
const hasAddonFeaturesAccess = (session) => {
  if (!session) return false;
  if (session.is_admin === true) return true;
  const raw = import.meta.env.VITE_ADDON_SUPERADMIN_ORG_ID;
  if (raw === undefined || raw === null || raw === "") return false;
  const operatorOrgId = Number(raw);
  if (!Number.isFinite(operatorOrgId)) return false;
  return Number(session.organization_id) === operatorOrgId;
};

const getMenuItems = (t, { showAddonFeatures = false } = {}) => [
  { title: t("dashboard"), url: "/admin/dashboard", icon: LayoutDashboard },
  {
    title: t("employees"),
    icon: Users,
    children: [
      { title: t("sidebar_employees_details"), url: "/admin/employee-details" },
      { title: t("sidebar_pending_signups"), url: "/admin/pending-signups" },
      { title: t("sidebar_org_chart"), url: "/admin/org-chart" },
      { title: t("sidebar_employee_comparison"), url: "/admin/comparison" },
      { title: t("sidebar_employee_attendance"), url: "/admin/attendance" },
      { title: t("sidebar_employee_insights"), url: "/admin/insights" },
      { title: t("sidebar_real_time_track"), url: "/admin/realtime" },
      { title: t("sidebar_employee_notifications"), url: "/admin/notification" },
      { title: t("sidebar_track_user_settings"), url: "/admin/track-user-settings" },
    ],
  },
  { title: t("timesheets"), url: "/admin/timesheets", icon: Clock },
  { title: t("sidebar_timeline"), url: "/admin/timeline", icon: History },
  { title: t("sidebar_live_monitoring"), url: "/admin/livemonitoring", icon: Monitor },
  { title: t("sidebar_time_claim"), url: "/admin/timeclaim", icon: HandCoins },
  {
    title: t("reports"),
    icon: BarChart3,
    children: [
      { title: t("sidebar_reports_download"), url: "/admin/reports/download" },
      { title: t("sidebar_productivity_report"), url: "/admin/reports/productivity" },
      { title: t("sidebar_auto_email_report"), url: "/admin/reports/autoemail" },
      { title: t("sidebar_web_app_usage"), url: "/admin/reports/webappusage" },
    ],
  },
  {
    title: t("sidebar_dlp"),
    icon: ShieldAlert,
    children: [
      { title: t("sidebar_usb_detection"), url: "/admin/dlp/usb" },
      { title: t("sidebar_system_logs"), url: "/admin/dlp/systemlogs" },
      { title: t("sidebar_screenshot_logs"), url: "/admin/dlp/screenshotlogs" },
      { title: t("sidebar_email_activity_logs"), url: "/admin/dlp/emailactivitylogs" },
    ],
  },
  {
    title: t("settings"),
    icon: Settings2,
    children: [
      { title: t("sidebar_manage_location_dept"), url: "/admin/settings/location" },
      { title: t("sidebar_storage_types"), url: "/admin/settings/storage" },
      { title: t("sidebar_productivity_rules"), url: "/admin/settings/productivity" },
      { title: t("sidebar_roles_permissions"), url: "/admin/settings/roles" },
      { title: t("sidebar_shift_management"), url: "/admin/settings/shift" },
      { title: t("sidebar_monitoring_control"), url: "/admin/settings/monitoring" },
      { title: t("localization"), url: "/admin/settings/localization" },
    ],
  },
  {
    title: t("behaviour"),
    icon: Zap,
    children: [
      { title: t("alerts"), url: "/admin/behaviour/alerts" },
      { title: t("sidebar_alert_policies"), url: "/admin/behaviour/alertpolicies" },
      { title: t("sidebar_alert_notification"), url: "/admin/behaviour/alertnotification" },
    ],
  },
  {
    title: t("sidebar_field_workforce"),
    icon: Smartphone,
    children: [
      { title: t("sidebar_task_clients"), url: "/admin/mobiletask/clientuser" },
      { title: t("sidebar_task_details"), url: "/admin/mobiletask/task" },
      // GPS location tracking intentionally disabled — not in use for now.
      // { title: t("sidebar_task_geolocation"), url: "/admin/mobiletask/geolocation" },
    ],
  },
];

export function AppSidebar() {
  const { t } = useTranslation();
  const { open } = useSidebar();
  const [openKey, setOpenKey] = useState(null);
  const { admin } = useAdminSession();
  // Cookie fallback for the first paint before the store hydrates.
  const session = admin || getSessionCookie();
  const showAddonFeatures = hasAddonFeaturesAccess(session);
  const menuItems = getMenuItems(t, { showAddonFeatures });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="bg-white border-b border-slate-200/60 p-0">
        <div
          className={`flex items-center justify-between transition-all duration-200 ease-in-out ${
            !open ? "px-2 py-4 justify-center" : "p-2"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center font-bold">
              <img
                src={open ? empLogo : favLogo}
                className={open ? "w-40" : "w-8 h-8 object-contain"}
                alt="Logo"
              />
            </div>
          </div>

          {open && (
            <SidebarTrigger className="h-8 w-8 cursor-pointer rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600" />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-white">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="flex flex-col gap-1 group-data-[collapsible=icon]:px-0 px-3 ">
              {menuItems.map((item) => (
                <AppMenuItems
                  key={item.title}
                  item={item}
                  openKey={openKey}
                  setOpenKey={setOpenKey}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/*
        The sidebar footer previously held a "Download Agent" button and a
        licence-usage card. Both are gone: the agent is distributed as a direct
        installer link rather than through the in-app overlay, and licence
        counts came from the reseller API, which this deployment does not use.
      */}
    </Sidebar>
  );
}
