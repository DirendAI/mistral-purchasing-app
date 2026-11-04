import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  useDeleteSchedule,
  useProductSchedule,
  usePutSchedule,
  type ProductOut,
} from "../api/purchasing";

const inputClass =
  "w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none";

type Mode = "cron" | "interval";

export const ScheduleDialog = ({ product, onClose }: { product: ProductOut; onClose: () => void }) => {
  const { data: schedule } = useProductSchedule(product.id);
  const putSchedule = usePutSchedule(product.id);
  const deleteSchedule = useDeleteSchedule(product.id);
  const [mode, setMode] = useState<Mode>("cron");
  const [cron, setCron] = useState("0 9 * * *");
  const [intervalMinutes, setIntervalMinutes] = useState("360");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (schedule) {
      setMode(schedule.cron_expressions?.length ? "cron" : "interval");
      setCron(schedule.cron_expressions?.join("\n") || "0 9 * * *");
      setIntervalMinutes(String((schedule.interval_seconds ?? 21600) / 60));
      setEnabled(schedule.enabled);
    }
  }, [schedule]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cronExpressions = mode === "cron" ? cron.split("\n").map((l) => l.trim()).filter(Boolean) : null;
    const intervalSeconds = mode === "interval" ? Math.max(1, Number(intervalMinutes) || 60) * 60 : null;
    putSchedule.mutate(
      { cron_expressions: cronExpressions, interval_seconds: intervalSeconds, enabled },
      { onSuccess: onClose }
    );
  };

  const error = putSchedule.error ?? deleteSchedule.error;

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="flex w-full max-w-md flex-col gap-3 rounded-lg bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold">Research schedule — {product.name}</h2>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === "cron"} onChange={() => setMode("cron")} />
            Cron (UTC), one per line
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === "interval"} onChange={() => setMode("interval")} />
            Every N minutes
          </label>
        </div>
        {mode === "cron" ? (
          <textarea
            className={inputClass}
            rows={3}
            value={cron}
            onChange={(e) => setCron(e.target.value)}
            placeholder={"0 9 * * *"}
          />
        ) : (
          <input
            className={inputClass}
            value={intervalMinutes}
            onChange={(e) => setIntervalMinutes(e.target.value)}
            inputMode="numeric"
          />
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled (paused when off)
        </label>
        {error && <p className="text-sm text-red-600">{error.message}</p>}
        <div className="flex justify-between">
          <button
            type="button"
            disabled={deleteSchedule.isPending || !schedule}
            onClick={() => deleteSchedule.mutate(undefined, { onSuccess: onClose })}
            className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
          >
            Remove schedule
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded border border-gray-300 px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={putSchedule.isPending}
              className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
