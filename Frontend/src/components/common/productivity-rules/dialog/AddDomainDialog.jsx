import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { useProductivityRulesStore } from "@/page/protected/admin/productivity-rules/productivityRulesStore";

const AddDomainDialog = () => {
    const { t } = useTranslation();
    const {
        addDomainDialogOpen,
        closeAddDomainDialog,
        addDomain,
        departments,
        updating,
    } = useProductivityRulesStore();

    const [domain, setDomain] = useState("");
    // 2 = website, 1 = desktop application. Adding applications by hand
    // matters because a ranking only affects time recorded *after* it is set:
    // wait for Excel to show up on its own and that first day is Neutral for
    // good.
    const [type, setType] = useState(2);
    const [mode, setMode] = useState("neutral"); // productive | neutral | unproductive | custom
    const [deptStatuses, setDeptStatuses] = useState({});
    const [error, setError] = useState("");

    const resetForm = () => {
        setDomain("");
        setType(2);
        setMode("neutral");
        setDeptStatuses({});
        setError("");
    };

    const handleClose = () => {
        resetForm();
        closeAddDomainDialog();
    };

    const handleSubmit = async () => {
        if (!domain.trim()) {
            setError(t("prodRules.domainUrlRequired"));
            return;
        }

        let departmentRules = [];
        if (mode === "custom") {
            departmentRules = departments.map((dept) => ({
                department_id: dept.id,
                status: parseInt(deptStatuses[dept.id] || "0", 10),
            }));
        } else {
            const statusVal = mode === "productive" ? 1 : mode === "unproductive" ? 2 : 0;
            departmentRules = [{ department_id: 0, status: statusVal }];
        }

        const result = await addDomain({ domain: domain.trim(), type, departmentRules });
        if (result.success) {
            resetForm();
        } else {
            setError(result.message || "Failed to add domain");
        }
    };

    const setDeptStatus = (deptId, status) => {
        setDeptStatuses((prev) => ({ ...prev, [deptId]: status }));
    };

    const radioOptions = [
        { value: "productive", label: "Productive", color: "text-emerald-600" },
        { value: "neutral", label: "Neutral", color: "text-amber-600" },
        { value: "unproductive", label: "Unproductive", color: "text-red-500" },
        { value: "custom", label: "Customize By Dept", color: "text-blue-600" },
    ];

    return (
        <Dialog open={addDomainDialogOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <Globe className="w-5 h-5 text-blue-500" />
                        <DialogTitle>{t("prodRules.addNewDomain")}</DialogTitle>
                    </div>
                    <DialogDescription>{t("prodRules.addNewDomainDesc")}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-2 block">
                            What are you adding?
                        </label>
                        <div className="flex gap-3">
                            {[
                                { val: 2, label: "Website", hint: "e.g. netflix.com" },
                                { val: 1, label: "Application", hint: "e.g. Microsoft Excel" },
                            ].map((opt) => (
                                <label
                                    key={opt.val}
                                    className={`flex-1 flex items-start gap-2 cursor-pointer rounded-lg border p-3 transition-colors ${
                                        type === opt.val
                                            ? "border-blue-500 bg-blue-50"
                                            : "border-slate-200 hover:border-slate-300"
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="activityType"
                                        checked={type === opt.val}
                                        onChange={() => { setType(opt.val); setError(""); }}
                                        className="mt-0.5 accent-blue-500"
                                    />
                                    <span>
                                        <span className="block text-sm font-medium text-slate-700">{opt.label}</span>
                                        <span className="block text-xs text-slate-400">{opt.hint}</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">
                            {type === 1 ? "Application name" : "Domain URL"}
                        </label>
                        <Input
                            placeholder={type === 1 ? "Microsoft Excel" : "https://example.com"}
                            value={domain}
                            onChange={(e) => { setDomain(e.target.value); setError(""); }}
                            className="rounded-lg"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            {type === 1
                                ? "Use the name as it appears in the app's title bar. A “.exe” suffix is fine — it is ignored."
                                : "The domain is enough; “https://”, “www.” and anything after the path are stripped."}
                        </p>
                        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-2 block">
                            Productivity Ranking
                        </label>
                        <div className="flex flex-wrap gap-3">
                            {radioOptions.map((opt) => (
                                <label
                                    key={opt.value}
                                    className={`flex items-center gap-1.5 cursor-pointer text-sm ${opt.color}`}
                                >
                                    <input
                                        type="radio"
                                        name="domainRanking"
                                        checked={mode === opt.value}
                                        onChange={() => setMode(opt.value)}
                                        className="accent-current"
                                    />
                                    {opt.label}
                                </label>
                            ))}
                        </div>
                    </div>

                    {mode === "custom" && departments.length > 0 && (
                        <div className="border rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-blue-50">
                                        <th className="px-4 py-2 text-left font-semibold text-slate-700">{t("department")}</th>
                                        <th className="px-4 py-2 text-left font-semibold text-slate-700">{t("prodRules.productivityRanking")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {departments.map((dept) => (
                                        <tr key={dept.id} className="border-t border-slate-100">
                                            <td className="px-4 py-2 text-slate-700">{dept.name}</td>
                                            <td className="px-4 py-2">
                                                <div className="flex gap-4">
                                                    {[
                                                        { val: "1", label: "Productive", cls: "text-emerald-600" },
                                                        { val: "0", label: "Neutral", cls: "text-amber-600" },
                                                        { val: "2", label: "Unproductive", cls: "text-red-500" },
                                                    ].map((r) => (
                                                        <label key={r.val} className={`flex items-center gap-1 cursor-pointer text-xs ${r.cls}`}>
                                                            <input
                                                                type="radio"
                                                                name={`dept-${dept.id}`}
                                                                checked={(deptStatuses[dept.id] || "0") === r.val}
                                                                onChange={() => setDeptStatus(dept.id, r.val)}
                                                                className="accent-current"
                                                            />
                                                            {r.label}
                                                        </label>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} className="rounded-xl">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={updating}
                        className="rounded-xl bg-blue-500 hover:bg-blue-600"
                    >
                        {updating && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AddDomainDialog;
