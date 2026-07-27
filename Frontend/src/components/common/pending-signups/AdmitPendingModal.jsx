import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Swal from "sweetalert2";
import { X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogClose, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchDepartmentsByLocation } from "@/page/protected/admin/employee-details/service";
import { admitPendingSignups } from "@/page/protected/admin/pending-signups/service";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Admits multiple pending signups at once with ONE shared department/location/role —
// per-person overrides can still be made afterward via the normal Edit Employee flow.
export default function AdmitPendingModal({
  open,
  onOpenChange,
  userIds = [],
  locations = [],
  roles = [],
  onSuccess,
}) {
  const { t } = useTranslation();
  const [locationId, setLocationId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState([]);
  const [roleId, setRoleId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!locationId) { setDepartments([]); return; }
    let cancelled = false;
    fetchDepartmentsByLocation(locationId).then((deps) => {
      if (!cancelled) setDepartments(deps);
    });
    return () => { cancelled = true; };
  }, [locationId]);

  const handleClose = (v) => {
    if (!v) {
      setLocationId(""); setDepartmentId(""); setDepartments([]); setRoleId(""); setSubmitting(false);
    }
    onOpenChange(v);
  };

  const handleSubmit = async () => {
    if (!locationId || !departmentId || !roleId || userIds.length === 0 || submitting) return;
    setSubmitting(true);
    const res = await admitPendingSignups({ userIds, departmentId, locationId, roleId });
    setSubmitting(false);

    if (res?.code === 200) {
      const admitted = res.data?.admitted ?? [];
      const failed = res.data?.failed ?? [];
      onSuccess?.();
      handleClose(false);

      const lines = [`<div>${esc(t("pending_admitted_count", { count: admitted.length }))}</div>`];
      if (failed.length > 0) {
        lines.push(`<div style="color:#d97706;margin-top:6px">${esc(t("pending_failed_count", { count: failed.length }))}</div>`);
        failed.forEach((f) => {
          lines.push(`<div style="font-size:12px;color:#92400e">${esc(f.email || f.user_id)} — ${esc(f.reason)}</div>`);
        });
      }
      const hasIssues = failed.length > 0;
      Swal.fire({
        icon: hasIssues ? "warning" : "success",
        title: hasIssues ? t("warning") : t("success"),
        html: `<div style="font-size:14px;line-height:1.6;text-align:left">${lines.join("")}</div>`,
        confirmButtonColor: hasIssues ? "#f59e0b" : "#3b82f6",
        ...(hasIssues ? {} : { timer: 2500, showConfirmButton: false }),
      });
    } else {
      Swal.fire({
        icon: "error",
        title: t("error"),
        text: res?.message || t("pending_admit_failed"),
        confirmButtonColor: "#ef4444",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px] rounded-3xl p-0 border-0 shadow-2xl overflow-hidden gap-0 [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">{t("pending_admit_selected")}</DialogTitle>
        <DialogDescription className="sr-only">Assign department, location and role to admit the selected signups</DialogDescription>
        <div className="relative px-7 py-5 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%)" }}>
          <h2 className="text-white text-xl font-bold tracking-tight">{t("pending_admit_selected")}</h2>
          <DialogClose className="text-white hover:text-white/80 transition-colors rounded-sm focus:outline-none">
            <X className="h-5 w-5" />
          </DialogClose>
        </div>

        <div className="px-7 pt-8 pb-4 space-y-4">
          <p className="text-[13px] text-gray-500">
            {t("pending_admit_count_description", { count: userIds.length })}
          </p>

          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-gray-700">{t("location")}</label>
            <Select value={locationId} onValueChange={(v) => { setLocationId(v); setDepartmentId(""); }}>
              <SelectTrigger className="h-11 w-full rounded-xl text-[14px]"><SelectValue placeholder={t("location")} /></SelectTrigger>
              <SelectContent className="rounded-xl">
                {locations.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-gray-700">{t("department")}</label>
            <Select value={departmentId} onValueChange={setDepartmentId} disabled={!locationId}>
              <SelectTrigger className="h-11 w-full rounded-xl text-[14px]"><SelectValue placeholder={t("department")} /></SelectTrigger>
              <SelectContent className="rounded-xl">
                {departments.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-gray-700">{t("emp_role")}</label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger className="h-11 w-full rounded-xl text-[14px]"><SelectValue placeholder={t("emp_role")} /></SelectTrigger>
              <SelectContent className="rounded-xl">
                {roles.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border-t border-gray-200 mx-7" />

        <div className="px-7 py-5 flex items-center justify-end gap-3">
          <DialogClose asChild>
            <Button className="h-11 px-8 rounded-full bg-gray-400 hover:bg-gray-500 text-white text-[15px] font-semibold">{t("cancel")}</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={!locationId || !departmentId || !roleId || submitting}
            className="h-11 px-8 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-[15px] font-semibold gap-2">
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {t("pending_admit")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
