import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Swal from "sweetalert2";
import { Play, Square, Loader2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recordClock } from "./timerService";

const STORAGE_KEY = "emp_timer_started_at";

const formatElapsed = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

// Manual clock-in/out for admitted employees — see components/common/timer/timerService.js.
// `startedAt` persists to localStorage so a page refresh doesn't lose a running timer.
export default function StartTimerCard() {
  const { t } = useTranslation();
  const [startedAt, setStartedAt] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Number(stored) : null;
  });
  const [now, setNow] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!startedAt) return;
    intervalRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(intervalRef.current);
  }, [startedAt]);

  const handleStart = () => {
    const start = Date.now();
    localStorage.setItem(STORAGE_KEY, String(start));
    setStartedAt(start);
    setNow(start);
  };

  const handleStop = async () => {
    if (!startedAt || submitting) return;
    setSubmitting(true);
    const endedAt = Date.now();
    const res = await recordClock({
      startDate: new Date(startedAt).toISOString(),
      endDate: new Date(endedAt).toISOString(),
    });
    setSubmitting(false);

    if (res?.statusCode === 200 && !res?.error) {
      localStorage.removeItem(STORAGE_KEY);
      setStartedAt(null);
      Swal.fire({
        icon: "success",
        title: t("success"),
        text: t("timer_recorded_success", { duration: formatElapsed(endedAt - startedAt) }),
        timer: 2500,
        showConfirmButton: false,
      });
    } else {
      Swal.fire({
        icon: "error",
        title: t("error"),
        text: res?.message || t("timer_record_failed"),
        confirmButtonColor: "#ef4444",
      });
    }
  };

  return (
    <div className="flex items-center gap-4 bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
      <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
        <Timer size={18} className="text-violet-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-gray-700">{t("timer_title")}</p>
        <p className="text-[20px] font-bold tabular-nums text-gray-800">
          {startedAt ? formatElapsed(now - startedAt) : "00:00:00"}
        </p>
      </div>
      {!startedAt ? (
        <Button onClick={handleStart}
          className="h-10 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[13px] font-semibold gap-2">
          <Play size={14} /> {t("timer_start")}
        </Button>
      ) : (
        <Button onClick={handleStop} disabled={submitting}
          className="h-10 px-5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[13px] font-semibold gap-2">
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
          {t("timer_stop")}
        </Button>
      )}
    </div>
  );
}
