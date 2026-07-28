import React, { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next";
import { Info, Save, X, Clock, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { getLocations } from "@/services/dlp.service"
import { useShiftManagementStore } from "@/page/protected/admin/shift-management/shiftManagementStore"
import { validateShiftForm } from "@/page/protected/admin/shift-management/service"

// ─── Constants ──────────────────────────────────────────────────────────────

const DAYS = [
    { key: "mon", label: "Monday" },
    { key: "tue", label: "Tuesday" },
    { key: "wed", label: "Wednesday" },
    { key: "thu", label: "Thursday" },
    { key: "fri", label: "Friday" },
    { key: "sat", label: "Saturday" },
    { key: "sun", label: "Sunday" },
]

const COLORS = [
    { value: 1, label: "Green", class: "bg-emerald-500" },
    { value: 2, label: "Yellow", class: "bg-yellow-400" },
    { value: 3, label: "Red", class: "bg-red-500" },
    { value: 4, label: "Blue", class: "bg-blue-600" },
    { value: 5, label: "Black", class: "bg-gray-800" },
    { value: 6, label: "Light Blue", class: "bg-sky-400" },
]

const DEFAULT_DAYS_STATE = () =>
    Object.fromEntries(
        DAYS.map((d) => [d.key, { status: false, start: "", end: "" }])
    )

// ─── Component ──────────────────────────────────────────────────────────────

const CreateShift = ({ mode = "create" }) => {
  const { t } = useTranslation();

    const {
        createDialogOpen,
        closeCreateDialog,
        editDialogOpen,
        editShiftData,
        closeEditDialog,
        saveShift,
        saveEditShift,
        saving,
    } = useShiftManagementStore()

    const isEdit = mode === "edit"
    const open = isEdit ? editDialogOpen : createDialogOpen
    const onClose = isEdit ? closeEditDialog : closeCreateDialog

    // ── Form State ──────────────────────────────────────────────────────────
    const [shiftName, setShiftName] = useState("")
    const [selectedColor, setSelectedColor] = useState(1)
    const [dayConfig, setDayConfig] = useState(DEFAULT_DAYS_STATE)
    // A shift's location is what gives it a timezone: attendance is judged
    // against the location's clock, so "09:00" means 09:00 where that team
    // actually sits. Without one the shift silently falls back to the
    // organisation's timezone, which marks a team in another country late
    // every morning.
    const [locationId, setLocationId] = useState("")
    const [locationOptions, setLocationOptions] = useState([])
    const [lateLogin, setLateLogin] = useState("0")
    const [earlyLogout, setEarlyLogout] = useState("0")
    const [halfDayHour, setHalfDayHour] = useState("00")
    const [halfDayMin, setHalfDayMin] = useState("00")
    const [overtimeHour, setOvertimeHour] = useState("00")
    const [overtimeMin, setOvertimeMin] = useState("00")
    const [halfDayProdHrs, setHalfDayProdHrs] = useState("00")
    const [halfDayProdMin, setHalfDayProdMin] = useState("00")
    const [fullDayProdHrs, setFullDayProdHrs] = useState("00")
    const [fullDayProdMin, setFullDayProdMin] = useState("00")
    const [note, setNote] = useState("")
    const [formError, setFormError] = useState("")

    // ── Populate form for edit mode ─────────────────────────────────────────
    useEffect(() => {
        if (isEdit && editShiftData && open) {
            setShiftName(editShiftData.name || "")
            setSelectedColor(editShiftData.color_code || 1)
            setNote(editShiftData.notes || "")
            setLocationId(editShiftData.location_id ? String(editShiftData.location_id) : "")
            setLateLogin(String(editShiftData.late_period ?? 0))
            setEarlyLogout(String(editShiftData.early_login_logout_time ?? 0))

            // Parse HH:MM fields
            const parseHM = (val) => {
                if (!val) return ["00", "00"]
                const parts = String(val).split(":")
                return [parts[0] || "00", parts[1] || "00"]
            }

            const [hdH, hdM] = parseHM(editShiftData.half_day_hours)
            setHalfDayHour(hdH)
            setHalfDayMin(hdM)

            const [otH, otM] = parseHM(editShiftData.overtime_period)
            setOvertimeHour(otH)
            setOvertimeMin(otM)

            const [hpH, hpM] = parseHM(editShiftData.productivity_halfday)
            setHalfDayProdHrs(hpH)
            setHalfDayProdMin(hpM)

            const [fpH, fpM] = parseHM(editShiftData.productivity_present)
            setFullDayProdHrs(fpH)
            setFullDayProdMin(fpM)

            // Populate day config from API data
            const newDayConfig = DEFAULT_DAYS_STATE()
            if (editShiftData.data && typeof editShiftData.data === "object") {
                Object.entries(editShiftData.data).forEach(([day, val]) => {
                    if (newDayConfig[day]) {
                        newDayConfig[day] = {
                            status: val.status !== false,
                            start: val.time?.start || "",
                            end: val.time?.end || "",
                        }
                    }
                })
            }
            setDayConfig(newDayConfig)
        } else if (!isEdit && open) {
            resetForm()
        }
    }, [isEdit, editShiftData, open])

    // Locations double as timezone groups, so the picker needs the live list.
    useEffect(() => {
        if (!open) return
        let cancelled = false
        getLocations().then((items) => {
            if (cancelled) return
            // getLocations() prepends an "All Locations" filter entry that makes
            // no sense here — a shift belongs to one location or none.
            setLocationOptions(items.filter((i) => i.value !== "all"))
        })
        return () => { cancelled = true }
    }, [open])

    const resetForm = () => {
        setShiftName("")
        setSelectedColor(1)
        setDayConfig(DEFAULT_DAYS_STATE())
        setLateLogin("0")
        setEarlyLogout("0")
        setHalfDayHour("00")
        setHalfDayMin("00")
        setOvertimeHour("00")
        setOvertimeMin("00")
        setLocationId("")
        setHalfDayProdHrs("00")
        setHalfDayProdMin("00")
        setFullDayProdHrs("00")
        setFullDayProdMin("00")
        setNote("")
        setFormError("")
    }

    // ── Day helpers ─────────────────────────────────────────────────────────

    const toggleDay = (key) => {
        setDayConfig((prev) => ({
            ...prev,
            [key]: { ...prev[key], status: !prev[key].status },
        }))
    }

    const updateDayTime = (key, field, value) => {
        setDayConfig((prev) => ({
            ...prev,
            [key]: { ...prev[key], [field]: value },
        }))
    }

    const applyToAll = () => {
        const checkedDays = DAYS.filter((d) => dayConfig[d.key]?.status)
        if (checkedDays.length === 0) {
            setFormError("Please select at least one day before applying to all")
            return
        }
        const firstChecked = checkedDays[0]
        const refTime = dayConfig[firstChecked.key]
        if (!refTime.start || !refTime.end) {
            setFormError("Please set start and end time for the selected day before applying to all")
            return
        }
        setFormError("")
        setDayConfig((prev) => {
            const updated = { ...prev }
            DAYS.forEach((d) => {
                updated[d.key] = {
                    status: true,
                    start: refTime.start,
                    end: refTime.end,
                }
            })
            return updated
        })
    }

    // ── Submit ──────────────────────────────────────────────────────────────

    const buildFormData = () => ({
        name: shiftName,
        color_code: selectedColor,
        notes: note,
        location_id: locationId ? parseInt(locationId, 10) : undefined,
        late_period: parseInt(lateLogin, 10) || 0,
        early_login_logout_time: parseInt(earlyLogout, 10) || 0,
        half_day_hours: `${halfDayHour || "00"}:${halfDayMin || "00"}`,
        overtime_period: `${overtimeHour || "00"}:${overtimeMin || "00"}`,
        productivity_halfday: `${halfDayProdHrs || "00"}:${halfDayProdMin || "00"}`,
        productivity_present: `${fullDayProdHrs || "00"}:${fullDayProdMin || "00"}`,
        days: dayConfig,
    })

    const handleSave = async () => {
        setFormError("")
        const formData = buildFormData()
        const validationError = validateShiftForm(formData)
        if (validationError) {
            setFormError(validationError)
            return
        }

        if (isEdit && editShiftData) {
            await saveEditShift(editShiftData.id, formData)
        } else {
            await saveShift(formData)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(val) => { if (!val) onClose() }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-0 gap-0 border-0">
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-5 rounded-t-2xl">
                    <DialogHeader className="flex-row items-center gap-3 space-y-0">
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                            <Clock className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black text-white">
                                {isEdit ? t("shift.shiftStructureUpdate") : t("shift.createNewShift")}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-violet-200 mt-0.5">
                                {isEdit
                                    ? t("shift.updateShiftSettings")
                                    : t("shift.configureShift")}
                            </DialogDescription>
                        </div>
                    </DialogHeader>
                </div>

                <div className="px-6 py-6 space-y-7">
                    {/* Form Error */}
                    {formError && (
                        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                            {formError}
                        </div>
                    )}

                    {/* Shift Name */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-2 sm:min-w-[140px]">
                            <span className="w-1 h-5 rounded-full bg-blue-500" />
                            <span className="text-sm font-semibold text-slate-700">
                                Shift Name
                            </span>
                        </div>
                        <Input
                            value={shiftName}
                            onChange={(e) => setShiftName(e.target.value)}
                            placeholder={t("shift.nameOfShift")}
                            className="h-10 rounded-lg border-slate-200 text-sm"
                        />
                    </div>

                    {/* Location — this is what gives the shift its timezone */}
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                        <div className="flex items-center gap-2 sm:min-w-[140px] sm:pt-2">
                            <span className="w-1 h-5 rounded-full bg-teal-500" />
                            <span className="text-sm font-semibold text-slate-700">
                                Location
                            </span>
                        </div>
                        <div className="flex-1">
                            <select
                                value={locationId}
                                onChange={(e) => setLocationId(e.target.value)}
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                            >
                                <option value="">
                                    Organisation default timezone
                                </option>
                                {locationOptions.map((loc) => (
                                    <option key={loc.value} value={loc.value}>
                                        {loc.label}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-400 mt-1">
                                Start and end times are read in this location&rsquo;s timezone, so
                                09:00 means 09:00 where that team sits. Set each location&rsquo;s
                                timezone under Manage Location &amp; Department; several shifts can
                                share one location.
                            </p>
                        </div>
                    </div>

                    {/* Select Color */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-2 sm:min-w-[140px]">
                            <span className="w-1 h-5 rounded-full bg-violet-500" />
                            <span className="text-sm font-semibold text-slate-700">
                                Select Color
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {COLORS.map((color) => (
                                <button
                                    key={color.value}
                                    type="button"
                                    onClick={() => setSelectedColor(color.value)}
                                    title={color.label}
                                    className={`w-7 h-7 rounded-full ${color.class} transition-all ${
                                        selectedColor === color.value
                                            ? "ring-2 ring-offset-2 ring-blue-500 scale-110"
                                            : "hover:scale-105"
                                    }`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Shift Time */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex items-start gap-2 sm:min-w-[140px] pt-2">
                            <span className="w-1 h-5 rounded-full bg-blue-500" />
                            <span className="text-sm font-semibold text-slate-700">
                                Shift Time
                            </span>
                        </div>
                        <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2.5">
                            {DAYS.map((day, idx) => (
                                <div
                                    key={day.key}
                                    className="grid grid-cols-[auto_1fr_1fr] items-center gap-3"
                                >
                                    {/* Day checkbox + name */}
                                    <div className="flex items-center gap-2 min-w-[110px]">
                                        <Checkbox
                                            checked={dayConfig[day.key]?.status || false}
                                            onCheckedChange={() => toggleDay(day.key)}
                                            className="border-slate-300 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                                        />
                                        <span className="text-xs font-medium text-slate-700">
                                            {day.label}
                                        </span>
                                    </div>

                                    {/* Start time */}
                                    <Input
                                        type="time"
                                        value={dayConfig[day.key]?.start || ""}
                                        onChange={(e) => updateDayTime(day.key, "start", e.target.value)}
                                        className="h-8 rounded-lg border-slate-200 text-xs text-center"
                                    />

                                    {/* End time */}
                                    <Input
                                        type="time"
                                        value={dayConfig[day.key]?.end || ""}
                                        onChange={(e) => updateDayTime(day.key, "end", e.target.value)}
                                        className="h-8 rounded-lg border-slate-200 text-xs text-center"
                                    />
                                </div>
                            ))}
                            <div className="pt-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="rounded-lg text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
                                    onClick={applyToAll}
                                >
                                    Apply to All
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Shift Settings */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex items-start gap-2 sm:min-w-[140px] pt-1">
                            <span className="w-1 h-5 rounded-full bg-blue-500" />
                            <span className="text-sm font-semibold text-slate-700">
                                Shift Settings
                            </span>
                        </div>
                        <div className="flex-1 space-y-4">
                            {/* Row 1: Late Login, Early Logout, Over Time */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                                        Late Login
                                        <Info className="w-3 h-3 text-blue-500" title="Grace period in minutes for late login" />
                                    </label>
                                    <Input
                                        type="number"
                                        value={lateLogin}
                                        onChange={(e) => setLateLogin(e.target.value)}
                                        min="0"
                                        max="60"
                                        step="5"
                                        className="h-9 rounded-lg border-slate-200 text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                                        Early Logout
                                        <Info className="w-3 h-3 text-blue-500" title="Grace period in minutes for early logout" />
                                    </label>
                                    <Input
                                        type="number"
                                        value={earlyLogout}
                                        onChange={(e) => setEarlyLogout(e.target.value)}
                                        min="0"
                                        max="60"
                                        step="5"
                                        className="h-9 rounded-lg border-slate-200 text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                                        Over Time
                                        <Info className="w-3 h-3 text-blue-500" title="Overtime threshold in HH:MM" />
                                    </label>
                                    <div className="flex items-center gap-1">
                                        <Input
                                            type="text"
                                            value={overtimeHour}
                                            onChange={(e) => setOvertimeHour(e.target.value.replace(/\D/g, "").slice(0, 2))}
                                            placeholder="HH"
                                            maxLength={2}
                                            className="h-9 rounded-lg border-slate-200 text-xs text-center w-12"
                                        />
                                        <span className="text-slate-400">:</span>
                                        <Input
                                            type="text"
                                            value={overtimeMin}
                                            onChange={(e) => setOvertimeMin(e.target.value.replace(/\D/g, "").slice(0, 2))}
                                            placeholder="MM"
                                            maxLength={2}
                                            className="h-9 rounded-lg border-slate-200 text-xs text-center w-12"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: the one number that drives full/half/absent */}
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                                        Required Productive Time per working day
                                        <Info className="w-3 h-3 text-blue-500" title="Half day and absent are derived from this" />
                                    </label>
                                    <div className="flex items-center gap-1">
                                        <Input
                                            type="text"
                                            value={fullDayProdHrs}
                                            onChange={(e) => setFullDayProdHrs(e.target.value.replace(/\D/g, "").slice(0, 2))}
                                            placeholder="HH"
                                            maxLength={2}
                                            className="h-9 rounded-lg border-slate-200 text-xs text-center w-14"
                                        />
                                        <span className="text-slate-400">:</span>
                                        <Input
                                            type="text"
                                            value={fullDayProdMin}
                                            onChange={(e) => setFullDayProdMin(e.target.value.replace(/\D/g, "").slice(0, 2))}
                                            placeholder="MM"
                                            maxLength={2}
                                            className="h-9 rounded-lg border-slate-200 text-xs text-center w-14"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Everything else follows from this. A day counts as
                                        <strong> full</strong> once productive time reaches about 83% of
                                        it, <strong> half</strong> down to 50%, and
                                        <strong> absent</strong> below that. Leave at 00:00 to judge on
                                        hours at the desk instead.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Any Note */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex items-start gap-2 sm:min-w-[140px] pt-1">
                            <span className="w-1 h-5 rounded-full bg-blue-500" />
                            <span className="text-sm font-semibold text-slate-700">
                                Any Note
                            </span>
                        </div>
                        <div className="flex-1">
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder={t("shift.addNoteForShift")}
                                rows={4}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            />
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            size="lg"
                            className="rounded-xl bg-violet-500 hover:bg-violet-600 px-5 text-xs font-semibold shadow-sm"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            {saving ? t("common.saving") : t("save")}
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className="rounded-xl border-violet-300 text-violet-600 hover:bg-violet-50 px-5 text-xs font-semibold"
                            onClick={onClose}
                            disabled={saving}
                        >
                            <X className="w-4 h-4" />
                            Cancel
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default CreateShift
