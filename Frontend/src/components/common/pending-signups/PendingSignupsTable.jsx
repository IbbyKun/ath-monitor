import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserCheck, Search, Loader2, UserPlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import PaginationComponent from "@/components/common/Pagination";
import AdmitPendingModal from "./AdmitPendingModal";
import employee from "@/assets/employe.png";
import "@/components/common/employee-details/emp.css";

export default function PendingSignupsTable({
  signups = [],
  loading = false,
  onRefresh,
  locations = [],
  roles = [],
}) {
  const { t } = useTranslation();
  const [selectedRows, setSelectedRows] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [admitOpen, setAdmitOpen] = useState(false);
  const perPage = 10;

  const { filtered, paginated, totalPages } = useMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    const list = !q
      ? signups
      : signups.filter((s) => {
          const name = `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase();
          return name.includes(q) || (s.email || "").toLowerCase().includes(q);
        });
    const total = Math.max(1, Math.ceil(list.length / perPage));
    return {
      filtered: list,
      paginated: list.slice((currentPage - 1) * perPage, currentPage * perPage),
      totalPages: total,
    };
  }, [signups, searchQuery, currentPage]);

  const toggleRow = (id) =>
    setSelectedRows((prev) => prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]);

  const toggleAll = () =>
    setSelectedRows((prev) => prev.length === paginated.length ? [] : paginated.map((s) => s.id));

  return (
    <div className="space-y-4">
      <div className="emp-card p-4 sm:p-5">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <img src={employee} alt="pending signups" className="w-50 h-50" />
            <div className="border-l-[3px] border-blue-500 pl-3 min-w-0">
              <h1 className="text-gray-800" style={{ fontSize: "21px", lineHeight: "18px" }}>
                <span className="font-semibold">{t("pending_signups_title")}</span>
              </h1>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                {t("pending_signups_desc")}
              </p>
            </div>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedRows.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <span className="text-[13px] font-semibold text-emerald-700 mr-1">
              {selectedRows.length} {t("selected")}:
            </span>
            <Button onClick={() => setAdmitOpen(true)} size="sm"
              className="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] gap-1.5">
              <UserCheck size={12} /> {t("pending_admit_selected")}
            </Button>
            <button onClick={() => setSelectedRows([])}
              className="ml-auto text-[12px] text-emerald-600 hover:underline">{t("emp_clear")}</button>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-gray-100 mt-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input placeholder={t("search")} value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-9 h-9 text-[13px] w-44 sm:w-64 rounded-xl border-gray-200 focus:border-blue-300" />
          </div>
        </div>

        {/* Table */}
        <div className="tbl-scroll w-full p-3">
          <Table className="min-w-[600px] bg-gray-100 rounded-4xl">
            <TableHeader>
              <TableRow className="border-b-2 border-blue-100">
                <TableHead className="emp-th w-10 pl-4">
                  <Checkbox checked={selectedRows.length === paginated.length && paginated.length > 0}
                    onCheckedChange={toggleAll} className="border-blue-300" />
                </TableHead>
                <TableHead className="emp-th pl-3 py-3">{t("emp_full_name")}</TableHead>
                <TableHead className="emp-th">{t("emp_email_id")}</TableHead>
                <TableHead className="emp-th">{t("pending_signed_up_at")}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-gray-400">
                    <Loader2 size={20} className="animate-spin inline mr-2" />{t("emp_loading_employees")}
                  </TableCell>
                </TableRow>
              )}
              {!loading && paginated.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-gray-400">
                    <UserPlus2 size={22} className="inline mr-2 text-gray-300" />
                    {t("pending_none_found")}
                  </TableCell>
                </TableRow>
              )}
              {!loading && paginated.map((s) => (
                <TableRow key={s.id}
                  className={`tr-hover border-b border-gray-50 transition-colors ${selectedRows.includes(s.id) ? "bg-blue-50/60" : ""}`}>
                  <TableCell className="pl-4 py-2.5">
                    <Checkbox checked={selectedRows.includes(s.id)}
                      onCheckedChange={() => toggleRow(s.id)} className="border-blue-300" />
                  </TableCell>
                  <TableCell className="pl-3 py-2.5 text-[13px] font-medium text-gray-700 whitespace-nowrap">
                    {s.first_name} {s.last_name}
                  </TableCell>
                  <TableCell className="text-[13px] text-gray-500 py-2.5 whitespace-nowrap">{s.email}</TableCell>
                  <TableCell className="text-[13px] text-gray-400 py-2.5 whitespace-nowrap">
                    {s.created_at ? new Date(s.created_at).toLocaleString() : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 border-t border-gray-100 bg-gray-50/50">
          <p className="text-[13px] text-gray-500 font-medium">
            {t("emp_showing")}{" "}
            <span className="font-bold text-gray-700">{filtered.length === 0 ? 0 : (currentPage - 1) * perPage + 1}</span>{" "}
            {t("to")}{" "}
            <span className="font-bold text-gray-700">{Math.min(currentPage * perPage, filtered.length)}</span>{" "}
            {t("of")} <span className="font-bold text-blue-600">{filtered.length}</span> {t("entries")}
          </p>
          <PaginationComponent currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      </div>

      <AdmitPendingModal
        open={admitOpen}
        onOpenChange={setAdmitOpen}
        userIds={selectedRows}
        locations={locations}
        roles={roles}
        onSuccess={() => { setSelectedRows([]); onRefresh?.(); }}
      />
    </div>
  );
}
