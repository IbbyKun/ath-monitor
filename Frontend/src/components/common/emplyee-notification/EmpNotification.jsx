import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import moment from "moment-timezone"
import { Search, Info, BellRing } from "lucide-react"
import { Input } from "@/components/ui/input"
import CustomSelect from "@/components/common/elements/CustomSelect"
import DateRangeCalendar from "@/components/common/elements/DateRangeCalendar"
import ShowEntries from "@/components/common/elements/ShowEntries"
import PaginationComponent from "@/components/common/Pagination"
import {
  getLocations,
  getDepartments,
  getEmployeeList,
  getAlertList,
} from "@/page/protected/admin/alerts/service"

/**
 * Employee Notifications — the message-centric view of what employees were
 * notified about. Reads the same backing store as the notification bell
 * (`/alerts-and-notifications/alerts/find-by` via the shared alerts service),
 * but leads with who was notified and what the message said, rather than the
 * risk/policy audit angle the Alert Notification page takes.
 */
const EmpNotification = () => {
  const { t } = useTranslation()
  const today = moment().format("YYYY-MM-DD")

  const [locations, setLocations] = useState([{ value: "all", label: "All Locations" }])
  const [departments, setDepartments] = useState([{ value: "all", label: "All Departments" }])
  const [employees, setEmployees] = useState([{ value: "all", label: "All Employees" }])

  const [location, setLocation] = useState("all")
  const [department, setDepartment] = useState("all")
  const [employee, setEmployee] = useState("all")
  const [startDate, setStartDate] = useState(moment().subtract(6, "days").format("YYYY-MM-DD"))
  const [endDate, setEndDate] = useState(today)

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [rows, setRows] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tableLoading, setTableLoading] = useState(false)
  const [error, setError] = useState(null)

  const debounceTimer = useRef(null)

  // Debounce the search box so we aren't firing a request per keystroke.
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(debounceTimer.current)
  }, [searchInput])

  // Filter dropdowns, loaded once.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [locs, deps, emps] = await Promise.all([
        getLocations(),
        getDepartments(),
        getEmployeeList(),
      ])
      if (cancelled) return
      setLocations(locs)
      setDepartments(deps)
      setEmployees(emps)
    })()
    return () => { cancelled = true }
  }, [])

  const fetchNotifications = useCallback(async () => {
    setTableLoading(true)
    setError(null)
    try {
      const result = await getAlertList({
        locationId: location,
        departmentId: department,
        employeeId: employee,
        startDate,
        endDate,
        skip: (page - 1) * pageSize,
        limit: pageSize,
        search,
      })
      setRows(result.rows)
      setTotalCount(result.totalCount)
    } catch {
      setError(t("notification.loadFailed"))
      setRows([])
      setTotalCount(0)
    } finally {
      setTableLoading(false)
      setLoading(false)
    }
  }, [location, department, employee, startDate, endDate, page, pageSize, search, t])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  const handleLocationChange = useCallback(async (v) => {
    setLocation(v)
    setDepartment("all")
    setEmployee("all")
    setPage(1)
    const [deps, emps] = await Promise.all([getDepartments(v), getEmployeeList({ locationId: v })])
    setDepartments(deps)
    setEmployees(emps)
  }, [])

  const handleDepartmentChange = useCallback(async (v) => {
    setDepartment(v)
    setEmployee("all")
    setPage(1)
    setEmployees(await getEmployeeList({ locationId: location, departmentId: v }))
  }, [location])

  const handleDateRangeChange = useCallback((start, end) => {
    setStartDate(start)
    setEndDate(end)
    setPage(1)
  }, [])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  // How many distinct people appear in the current page of notifications —
  // the "who" summary that distinguishes this view from the risk audit log.
  const distinctEmployees = useMemo(
    () => new Set(rows.map((r) => r.employee).filter((e) => e && e !== "-")).size,
    [rows],
  )

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-9 w-full">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
        <div className="border-l-2 border-blue-500 pl-4">
          <h2 className="text-gray-800" style={{ fontSize: "21px", lineHeight: "18px" }}>
            <span className="font-semibold">{t("notification.notifications")}</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1 max-w-sm leading-tight">
            {t("notification.description")}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
              {t("notification.inRange")}
            </p>
            <p className="text-lg font-bold text-[#2B3674] tabular-nums">
              {totalCount}{" "}
              <span className="text-xs font-medium text-slate-400">
                / {distinctEmployees} {t("notification.people")}
              </span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
            <BellRing className="w-6 h-6 text-amber-500" />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 mb-9">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{t("location")}</label>
          <CustomSelect
            placeholder={t("notification.selectLocation")}
            items={locations}
            selected={location}
            onChange={handleLocationChange}
            width="full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{t("department")}</label>
          <CustomSelect
            placeholder={t("notification.selectDepartment")}
            items={departments}
            selected={department}
            onChange={handleDepartmentChange}
            width="full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">{t("employee")}</label>
          <CustomSelect
            placeholder={t("notification.selectEmployee")}
            items={employees}
            selected={employee}
            onChange={(v) => { setEmployee(v); setPage(1) }}
            width="full"
          />
        </div>
        <div>
          <label className="flex items-center gap-1 text-sm font-medium text-slate-700 mb-1.5">
            {t("notification.dateRange")} <Info className="w-3.5 h-3.5 text-blue-500" />
          </label>
          <DateRangeCalendar startDate={startDate} endDate={endDate} onChange={handleDateRangeChange} />
        </div>
      </div>

      {/* Show entries + Search */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
        <ShowEntries
          value={pageSize}
          onChange={(v) => { setPageSize(parseInt(v, 10) || 10); setPage(1) }}
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

      {/* Table */}
      <div className="rounded-2xl border border-slate-100 overflow-x-auto bg-slate-50">
        <table className="min-w-[880px] w-full">
          <thead>
            <tr className="bg-[#CADDFF]">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">{t("notification.dateTime")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">{t("notification.employeeName")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">{t("notification.computer")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">{t("notification.message")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">{t("notification.triggeredBy")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">{t("notification.severity")}</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {tableLoading ? (
              <tr>
                <td colSpan={6} className="text-center text-sm text-gray-400 py-10">{t("loadingText")}</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-sm text-gray-400 py-10">{t("notification.noData")}</td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={`${row.id}-${idx}`}
                  className="border-b border-slate-100 last:border-b-0 text-xs text-slate-600"
                >
                  <td className="px-4 py-4 whitespace-nowrap">{row.dateTime}</td>
                  <td className="px-4 py-4 font-medium text-slate-700 whitespace-nowrap">{row.employee}</td>
                  <td className="px-4 py-4 whitespace-nowrap">{row.employeeCode}</td>
                  <td className="px-4 py-4 max-w-[320px]">
                    <span className="line-clamp-2">{row.message || row.ruleName}</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">{row.behaviorRule}</td>
                  <td className="px-4 py-4 whitespace-nowrap" style={{ borderLeft: `4px solid ${row.riskColor}` }}>
                    {row.riskLevel}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 py-3.5 pt-10">
        <p className="text-[13px] text-gray-500 font-medium">
          {t("notification.showing")}{" "}
          <span className="font-bold text-gray-700">
            {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}
          </span>{" "}
          {t("notification.to")}{" "}
          <span className="font-bold text-gray-700">{Math.min(page * pageSize, totalCount)}</span>{" "}
          {t("notification.of")}{" "}
          <span className="font-bold text-blue-600">{totalCount}</span> {t("notification.entries")}
        </p>
        <PaginationComponent currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  )
}

export default EmpNotification
