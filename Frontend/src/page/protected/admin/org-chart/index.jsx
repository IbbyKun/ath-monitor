import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Network } from "lucide-react";
import OrgChart from "@/components/common/org-chart/OrgChart";
import { fetchOrgChart, buildOrgChartTree } from "./service";
import "@/components/common/employee-details/emp.css";

const OrgChartPage = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchOrgChart());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const treeData = rows.length > 0 ? buildOrgChartTree(rows, t("org_chart_title")) : null;

  return (
    <div className="bg-slate-200 w-full p-5 min-h-screen">
      <div className="emp-card p-4 sm:p-5">
        <div className="flex items-center gap-3 mb-3">
          <Network size={22} className="text-blue-500" />
          <div className="border-l-[3px] border-blue-500 pl-3">
            <h1 className="text-gray-800" style={{ fontSize: "21px", lineHeight: "18px" }}>
              <span className="font-semibold">{t("org_chart_title")}</span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              {t("org_chart_desc")}
            </p>
          </div>
        </div>

        {loading && (
          <div className="py-20 text-center text-sm text-gray-400">
            <Loader2 size={20} className="animate-spin inline mr-2" />{t("emp_loading_employees")}
          </div>
        )}
        {!loading && rows.length === 0 && (
          <div className="py-20 text-center text-sm text-gray-400">{t("org_chart_none")}</div>
        )}
        {!loading && treeData && <OrgChart treeData={treeData} />}
      </div>
    </div>
  );
};

export default OrgChartPage;
