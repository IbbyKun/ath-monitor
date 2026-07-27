import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2, UserRound, Building2, ShieldCheck, BadgeCheck, Users, Check, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import CustomSelect from "@/components/common/elements/CustomSelect";
import UniPass from "@/components/common/UniPass";
import useAdminSession from "@/sessions/adminSession";
import {
  getTimezoneSelectItems,
  getLanguageSelectItems,
} from "@/page/protected/admin/localization/service";
import {
  WEEKDAYS,
  getAccountSettings,
  saveAccountSettings,
  getTwoFactorStatus,
  setTwoFactorStatus,
} from "@/page/protected/admin/account-settings/service";

// ─── Small building blocks ──────────────────────────────────────────────────

const SectionCard = ({ icon: Icon, title, description, children }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-7">
    <div className="flex items-start gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-[#0066FF]" />
      </div>
      <div className="border-l-2 border-blue-500 pl-3">
        <h2 className="text-gray-800 font-semibold" style={{ fontSize: "17px", lineHeight: "20px" }}>
          {title}
        </h2>
        <p className="text-xs text-gray-400 mt-0.5 leading-tight max-w-md">{description}</p>
      </div>
    </div>
    {children}
  </div>
);

const ReadOnlyField = ({ label, value }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
    <div className="h-10 flex items-center px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600">
      {value || "-"}
    </div>
  </div>
);

// ─── Main Component ─────────────────────────────────────────────────────────

const EmpAccountSettings = () => {
  const { t } = useTranslation();
  const { admin } = useAdminSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling2fa, setToggling2fa] = useState(false);
  const [banner, setBanner] = useState(null); // { type: 'success'|'error', text }
  const [openUniPass, setOpenUniPass] = useState(false);

  const [timezone, setTimezone] = useState("");
  const [language, setLanguage] = useState("en");
  const [weekdayStart, setWeekdayStart] = useState("monday");
  const [seats, setSeats] = useState({ used: 0, total: 0 });
  const [twoFactor, setTwoFactor] = useState(false);

  const timezoneItems = getTimezoneSelectItems();
  const languageItems = getLanguageSelectItems();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [settings, tfa] = await Promise.all([getAccountSettings(), getTwoFactorStatus()]);
      if (cancelled) return;
      if (settings.success) {
        setTimezone(settings.data.timezone);
        setLanguage(settings.data.language);
        setWeekdayStart(settings.data.weekdayStart);
        setSeats({ used: settings.data.currentUserCount, total: settings.data.totalAllowedUserCount });
      } else {
        setBanner({ type: "error", text: settings.message });
      }
      if (tfa.success) setTwoFactor(tfa.enabled);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-dismiss the banner so it doesn't linger over the form.
  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(timer);
  }, [banner]);

  const handleSave = async () => {
    setSaving(true);
    const res = await saveAccountSettings({ timezone, language, weekdayStart });
    setSaving(false);
    setBanner({ type: res.success ? "success" : "error", text: res.message });
  };

  const handleToggle2fa = async () => {
    const next = !twoFactor;
    setToggling2fa(true);
    const res = await setTwoFactorStatus(next);
    setToggling2fa(false);
    if (res.success) setTwoFactor(next);
    setBanner({ type: res.success ? "success" : "error", text: res.message });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  const fullName = admin?.full_name || admin?.user_name || "-";
  const seatsLeft = Math.max(0, seats.total - seats.used);

  return (
    <div className="space-y-5">
      {banner && (
        <div
          className={`px-4 py-3 rounded-xl text-sm flex items-center justify-between ${
            banner.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-red-50 border border-red-200 text-red-600"
          }`}
        >
          <span>{banner.text}</span>
          <button onClick={() => setBanner(null)} aria-label={t("close")}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Profile ─────────────────────────────────────────────────── */}
      <SectionCard
        icon={UserRound}
        title={t("account_profile_title")}
        description={t("account_profile_desc")}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <ReadOnlyField label={t("account_full_name")} value={fullName} />
          <ReadOnlyField label={t("auth_email_address")} value={admin?.email} />
          <ReadOnlyField label={t("emp_role")} value={admin?.role || "Admin"} />
        </div>
        <p className="text-xs text-gray-400 mt-4">{t("account_profile_note")}</p>
      </SectionCard>

      {/* ── Company preferences ─────────────────────────────────────── */}
      <SectionCard
        icon={Building2}
        title={t("account_company_title")}
        description={t("account_company_desc")}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t("timezone")}</label>
            <CustomSelect
              placeholder={t("account_select_timezone")}
              items={timezoneItems}
              selected={timezone}
              onChange={setTimezone}
              width="full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t("language")}</label>
            <CustomSelect
              placeholder={t("account_select_language")}
              items={languageItems}
              selected={language}
              onChange={setLanguage}
              width="full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{t("account_week_starts")}</label>
            <CustomSelect
              placeholder={t("account_week_starts")}
              items={WEEKDAYS}
              selected={weekdayStart}
              onChange={setWeekdayStart}
              width="full"
            />
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-10 px-7 rounded-xl bg-[#0066FF] hover:bg-blue-700 text-white text-sm font-semibold gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {t("account_save_changes")}
          </Button>
        </div>
      </SectionCard>

      {/* ── Security ────────────────────────────────────────────────── */}
      <SectionCard
        icon={ShieldCheck}
        title={t("account_security_title")}
        description={t("account_security_desc")}
      >
        <div className="divide-y divide-slate-100">
          <div className="flex items-center justify-between gap-4 py-4 first:pt-0">
            <div>
              <p className="text-sm font-semibold text-slate-700">{t("account_2fa_title")}</p>
              <p className="text-xs text-gray-400 mt-0.5 max-w-md leading-relaxed">
                {t("account_2fa_desc")}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  twoFactor
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    : "bg-slate-100 text-slate-500 border border-slate-200"
                }`}
              >
                {twoFactor ? t("account_on") : t("account_off")}
              </span>
              <Button
                onClick={handleToggle2fa}
                disabled={toggling2fa}
                variant={twoFactor ? "outline" : "default"}
                className={`h-9 px-5 rounded-xl text-sm font-semibold gap-2 ${
                  twoFactor ? "border-slate-200 text-slate-600" : "bg-[#0066FF] hover:bg-blue-700 text-white"
                }`}
              >
                {toggling2fa && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {twoFactor ? t("account_disable") : t("account_enable")}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 py-4 last:pb-0">
            <div>
              <p className="text-sm font-semibold text-slate-700">{t("topbar_uninstall_password")}</p>
              <p className="text-xs text-gray-400 mt-0.5 max-w-md leading-relaxed">
                {t("account_unipass_desc")}
              </p>
            </div>
            <Button
              onClick={() => setOpenUniPass(true)}
              variant="outline"
              className="h-9 px-5 rounded-xl border-slate-200 text-slate-600 text-sm font-semibold shrink-0"
            >
              {t("account_manage")}
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* ── Licence ─────────────────────────────────────────────────── */}
      <SectionCard
        icon={BadgeCheck}
        title={t("account_license_title")}
        description={t("account_license_desc")}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: t("account_seats_used"), value: seats.used, tone: "text-[#2B3674]" },
            { label: t("account_seats_left"), value: seatsLeft, tone: "text-emerald-600" },
            { label: t("account_seats_total"), value: seats.total, tone: "text-[#2B3674]" },
          ].map(({ label, value, tone }) => (
            <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 px-5 py-4">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Users className="w-3.5 h-3.5" />
                <span className="text-[11px] uppercase tracking-wide font-semibold">{label}</span>
              </div>
              <p className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <UniPass isOpen={openUniPass} onClose={() => setOpenUniPass(false)} />
    </div>
  );
};

export default EmpAccountSettings;
