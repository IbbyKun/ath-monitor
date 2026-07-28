import { createDlpStore } from "@/hooks/useDlpStore";
import { fetchLogs, fetchExport, exportCsv, exportPdf } from "./service";

export const useSecondScreenStore = createDlpStore({
    name: "Second Screen Activity",
    fetchLogs,
    fetchExport,
    exportCsv,
    exportPdf,
});
