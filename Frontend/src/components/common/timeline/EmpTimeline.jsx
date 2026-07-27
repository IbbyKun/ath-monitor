import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import moment from "moment-timezone";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  FileText,
  FileSpreadsheet,
  Info,
  CircleUser,
} from "lucide-react";
import EmpTimelineLogo from "@/assets/timeline/timeline.svg";
import { Input } from "@/components/ui/input";
import CustomSelect from "@/components/common/elements/CustomSelect";
import DateRangeCalendar from "@/components/common/elements/DateRangeCalendar";
import ShowEntries from "@/components/common/elements/ShowEntries";
import {
  getLocations,
  getDepartments,
  getShifts,
  getEmployeeList,
  getTimesheetData,
  getTimesheetExportData,
  exportTimesheetCsv,
  exportTimesheetPdf,
} from "@/page/protected/admin/timesheets/service";

const avatarColors = [
  "from-orange-400 to-orange-500",
  "from-blue-400 to-blue-500",
  "from-red-400 to-red-500",
  "from-purple-400 to-purple-500",
  "from-teal-400 to-teal-500",
  "from-indigo-400 to-indigo-500",
  "from-pink-400 to-pink-500",
  "from-emerald-400 to-emerald-500",
  "from-amber-400 to-amber-500",
  "from-cyan-400 to-cyan-500",
];

/**
 * Timeline — clock-in/clock-out and hours worked per employee over a date
 * range. Backed by the same `/timesheet/timesheet` endpoint (via the shared
 * timesheets service) that powers the Timesheets report, so the numbers here
 * always agree with that page.
 */
export default function EmpTimeline() {
  const { t } = useTranslation();

  const [locations, setLocations] = useState([{ value: "all", label: "All Locations" }]);
  const [departments, setDepartments] = useState([{ value: "all", label: "All Departments" }]);
  const [employees, setEmployees] = useState([{ value: "all", label: "All Employees" }]);
  const [shifts, setShifts] = useState([{ value: "all", label: "All Shifts" }]);

  const [location, setLocation] = useState("all");
  const [department, setDepartment] = useState("all");
  const [employee, setEmployee] = useState("all");
  const [shift, setShift] = useState("all");
  const [startDate, setStartDate] = useState(moment().subtract(6, "days").format("YYYY-MM-DD"));
  const [endDate, setEndDate] = useState(moment().format("YYYY-MM-DD"));

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);

  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const debounceTimer = useRef(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setSearch(searchInput);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(debounceTimer.current);
  }, [searchInput]);

  // Filter dropdowns, loaded once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [locs, deps, emps, shs] = await Promise.all([
        getLocations(),
        getDepartments(),
        getEmployeeList(),
        getShifts(),
      ]);
      if (cancelled) return;
      setLocations(locs);
      setDepartments(deps);
      setEmployees(emps);
      setShifts(shs);
    })();
    return () => { cancelled = true; };
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTimesheetData({
        startDate,
        endDate,
        locationId: location,
        departmentId: department,
        employeeId: employee,
        shiftId: shift,
        skip: (currentPage - 1) * entriesPerPage,
        limit: entriesPerPage,
        name: search,
      });
      setRows(result.rows);
      setTotalCount(result.totalCount);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, location, department, employee, shift, currentPage, entriesPerPage, search]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handleLocationChange = useCallback(async (v) => {
    setLocation(v);
    setDepartment("all");
    setEmployee("all");
    setCurrentPage(1);
    const [deps, emps] = await Promise.all([getDepartments(v), getEmployeeList({ locationId: v })]);
    setDepartments(deps);
    setEmployees(emps);
  }, []);

  const handleDepartmentChange = useCallback(async (v) => {
    setDepartment(v);
    setEmployee("all");
    setCurrentPage(1);
    setEmployees(await getEmployeeList({ locationId: location, departmentId: v }));
  }, [location]);

  // Columns the Timeline table actually shows — the exporters take an explicit
  // key list (see EXPORT_COLUMN_MAP in the timesheets service).
  const TIMELINE_EXPORT_KEYS = [
    "name", "email", "empCode", "department",
    "clockIn", "clockOut", "officeHours", "activeHours", "productive",
  ];

  const runExport = async (exporter) => {
    setExporting(true);
    try {
      const filters = {
        startDate,
        endDate,
        location,
        department,
        employee,
        shift,
      };
      const allRows = await getTimesheetExportData({
        startDate,
        endDate,
        locationId: location,
        departmentId: department,
        employeeId: employee,
        shiftId: shift,
      });
      await exporter(allRows, TIMELINE_EXPORT_KEYS, filters);
    } catch (err) {
      console.error("Timeline export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = () => runExport(exportTimesheetCsv);
  const handleExportPdf = () => runExport(exportTimesheetPdf);

  const totalPages = Math.max(1, Math.ceil(totalCount / entriesPerPage));

  const getPageNumbers = () => {
    const pages = [];
    const start = Math.max(1, Math.min(currentPage - 1, totalPages - 2));
    for (let i = start; i <= Math.min(totalPages, start + 2); i++) pages.push(i);
    return pages;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-9 w-full">
      <div>
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-3 border-l-2 border-blue-500 pl-4">
            <div className="relative">
              <div className="flex items-center gap-2">
                <h1 className="text-gray-800" style={{ fontSize: "21px", lineHeight: "18px" }}>
                  <span className="font-semibold">{t("timeline.title")}</span>
                </h1>
                <div className="flex items-end gap-1 mr-2">
                  <img alt="timeline" className="min-h-12" src={EmpTimelineLogo} />
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-1 leading-tight max-w-[240px]">
                {t("timeline.description")}
              </p>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              disabled={exporting || totalCount === 0}
              className="flex cursor-pointer items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all active:scale-95 bg-[#2598EB] hover:bg-[#2598EB] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={handleExportPdf}
              disabled={exporting || totalCount === 0}
              className="flex cursor-pointer items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all active:scale-95 bg-[#8D85FF] hover:bg-[#8D85FF]/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>

        {/* ── Filters Row ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 ml-0.5">{t("location")}</label>
            <CustomSelect
              placeholder={t("timeline.selectLocation")}
              items={locations}
              selected={location}
              onChange={handleLocationChange}
              width="full"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 ml-0.5">{t("department")}</label>
            <CustomSelect
              placeholder={t("timeline.selectDepartment")}
              items={departments}
              selected={department}
              onChange={handleDepartmentChange}
              width="full"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 ml-0.5">{t("employee")}</label>
            <CustomSelect
              placeholder={t("timeline.selectEmployee")}
              items={employees}
              selected={employee}
              onChange={(v) => { setEmployee(v); setCurrentPage(1); }}
              width="full"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 ml-0.5">{t("shift")}</label>
            <CustomSelect
              placeholder={t("timeline.selectShift")}
              items={shifts}
              selected={shift}
              onChange={(v) => { setShift(v); setCurrentPage(1); }}
              width="full"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 ml-0.5">
              {t("timeline.selectDateRanges")} : <Info className="w-3 h-3 inline text-blue-500" />
            </label>
            <DateRangeCalendar
              startDate={startDate}
              endDate={endDate}
              onChange={(s, e) => { setStartDate(s); setEndDate(e); setCurrentPage(1); }}
            />
          </div>
        </div>

        {/* ── Show Entries + Search ──────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-7 gap-3">
          <ShowEntries
            value={entriesPerPage}
            onChange={(v) => { setEntriesPerPage(Number(v) || 10); setCurrentPage(1); }}
          />
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={t("search")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 h-10 rounded-full bg-slate-50 border-slate-200 text-xs"
            />
          </div>
        </div>

        {/* ── Table ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-gradient-to-r from-[#5C6BC0] via-[#5C6BC0] to-[#2598EB] rounded-xl">
                  <th className="text-left px-4 py-3 font-semibold text-white text-xs whitespace-nowrap first:rounded-l-xl">{t("fullName")}</th>
                  <th className="text-left px-4 py-3 font-semibold text-white text-xs whitespace-nowrap">{t("emailid")}</th>
                  <th className="text-left px-4 py-3 font-semibold text-white text-xs whitespace-nowrap">{t("empCode")}</th>
                  <th className="text-left px-4 py-3 font-semibold text-white text-xs whitespace-nowrap">{t("department")}</th>
                  <th className="text-center px-4 py-3 font-semibold text-xs whitespace-nowrap">
                    <span className="inline-block px-4 py-1 rounded-full text-white text-xs font-semibold bg-[#4CAF50]">
                      {t("timeline.clockIn")}
                    </span>
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-xs whitespace-nowrap">
                    <span className="inline-block px-4 py-1 rounded-full text-white text-xs font-semibold bg-[#EF5350]">
                      {t("timeline.clockOut")}
                    </span>
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-white text-xs whitespace-nowrap">{t("officeHours")}</th>
                  <th className="text-center px-4 py-3 font-semibold text-white text-xs whitespace-nowrap">{t("activeHours")}</th>
                  <th className="text-center px-4 py-3 font-semibold text-xs whitespace-nowrap last:rounded-r-xl bg-[#2598EB]">
                    <span className="text-white font-bold">{t("productive")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-xs text-gray-400">
                      {t("loadingText")}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-xs text-gray-400">
                      {t("timeline.noData")}
                    </td>
                  </tr>
                ) : (
                  rows.map((emp, idx) => {
                    const avatarColor = avatarColors[idx % avatarColors.length];
                    return (
                      <tr
                        key={`${emp.id}-${idx}`}
                        className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors"
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarColor} flex items-center justify-center shrink-0`}>
                              <CircleUser className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-gray-700 text-xs font-medium">{emp.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-gray-500 text-xs whitespace-nowrap">{emp.email}</td>
                        <td className="px-4 py-3.5 text-gray-600 text-xs font-medium whitespace-nowrap">{emp.empCode}</td>
                        <td className="px-4 py-3.5 text-gray-500 text-xs whitespace-nowrap">{emp.department}</td>
                        <td className="px-4 py-3.5 text-gray-500 text-xs text-center whitespace-nowrap">{emp.clockIn}</td>
                        <td className="px-4 py-3.5 text-gray-500 text-xs text-center whitespace-nowrap">{emp.clockOut}</td>
                        <td className="px-4 py-3.5 text-gray-500 text-xs text-center whitespace-nowrap tabular-nums">{emp.officeTime}</td>
                        <td className="px-4 py-3.5 text-gray-500 text-xs text-center whitespace-nowrap tabular-nums">{emp.activeTime}</td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap bg-[#EBF3FE]">
                          <span className="text-[#4CAF50] text-xs font-semibold tabular-nums">{emp.productiveTime}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom accent line */}
          <div className="h-1 w-full bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
        </div>

        {/* ── Pagination ────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between mt-5 gap-3">
          <p className="text-xs text-gray-500">
            {t("timeclaim.showing")}{" "}
            {totalCount === 0 ? 0 : (currentPage - 1) * entriesPerPage + 1} {t("to")}{" "}
            {Math.min(currentPage * entriesPerPage, totalCount)} {t("of")} {totalCount}
          </p>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {getPageNumbers().map((num) => (
              <button
                key={num}
                onClick={() => setCurrentPage(num)}
                className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-semibold transition-all ${
                  currentPage === num
                    ? "bg-[#5C6BC0] text-white shadow-md shadow-indigo-200"
                    : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {num}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
