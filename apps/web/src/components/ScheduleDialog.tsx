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

type Mode = "hourly" | "daily" | "weekly" | "interval" | "cron";

const DAYS: { label: string; cron: number }[] = [
  { label: "Monday", cron: 1 },
  { label: "Tuesday", cron: 2 },
  { label: "Wednesday", cron: 3 },
  { label: "Thursday", cron: 4 },
  { label: "Friday", cron: 5 },
  { label: "Saturday", cron: 6 },
  { label: "Sunday", cron: 0 },
];

/** Best-effort preset recognition for an existing schedule, so reopening the dialog shows what is set. */
const inferMode = (schedule: { cron_expressions?: string[] | null; interval_seconds?: number | null } | null): {
  mode: Mode;
  cron: string;
  intervalMinutes: string;
  hour: string;
  minute: string;
  day: number;
} => {
  if (!schedule) {
    return { mode: "daily", cron: "0 9 * * *", intervalMinutes: "60", hour: "9", minute: "0", day: 1 };
  }
  if (schedule.interval_seconds) {
    return {
      mode: schedule.interval_seconds === 3600 ? "hourly" : "interval",
      cron: "0 9 * * *",
      intervalMinutes: String(Math.round(schedule.interval_seconds / 60)),
      hour: "9",
      minute: "0",
      day: 1,
    };
  }
  const expression = schedule.cron_expressions?.[0] ?? "0 9 * * *";
  const parts = expression.split(/\s+/);
  if (parts.length === 5) {
    const [minute, hour, dom, month, dow] = parts;
    if (dom === "*" && month === "*" && dow === "*") {
      return { mode: "daily", cron: expression, intervalMinutes: "60", hour: hour ?? "9", minute: minute ?? "0", day: 1 };
    }
    if (dom === "*" && month === "*" && dow !== "*" && /^\d$/.test(dow)) {
      return {
        mode: "weekly",
        cron: expression,
        intervalMinutes: "60",
        hour: hour ?? "9",
        minute: minute ?? "0",
        day: Number(dow),
      };
    }
  }
  return { mode: "cron", cron: schedule.cron_expressions?.join("\n") || expression, intervalMinutes: "60", hour: "9", minute: "0", day: 1 };
};

export const ScheduleDialog = ({ product, onClose }: { product: ProductOut; onClose: () => void }) => {
  const { data: schedule } = useProductSchedule(product.id);
  const putSchedule = usePutSchedule(product.id);
  const deleteSchedule = useDeleteSchedule(product.id);
  const [mode, setMode] = useState<Mode>("daily");
  const [cron, setCron] = useState("0 9 * * *");
  const [intervalMinutes, setIntervalMinutes] = useState("60");
  const [hour, setHour] = useState("9");
  const [minute, setMinute] = useState("0");
  const [day, setDay] = useState(1);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (schedule) {
      const inferred = inferMode(schedule);
      setMode(inferred.mode);
      setCron(inferred.cron);
      setIntervalMinutes(inferred.intervalMinutes);
      setHour(inferred.hour);
      setMinute(inferred.minute);
      setDay(inferred.day);
      setEnabled(schedule.enabled);
    }
  }, [schedule]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    let cronExpressions: string[] | null = null;
    let intervalSeconds: number | null = null;
    if (mode === "hourly") {
      intervalSeconds = 3600;
    } else if (mode === "interval") {
      intervalSeconds = Math.max(1, Number(intervalMinutes) || 60) * 60;
    } else if (mode === "daily") {
      cronExpressions = [`${Number(minute) || 0} ${Number(hour) || 0} * * *`];
    } else if (mode === "weekly") {
      cronExpressions = [`${Number(minute) || 0} ${Number(hour) || 0} * * ${day}`];
    } else {
      cronExpressions = cron.split("\n").map((line) => line.trim()).filter(Boolean);
    }
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

        <div className="grid grid-cols-2 gap-2 text-sm">
          {(
            [
              ["hourly", "Hourly"],
              ["daily", "Daily"],
              ["weekly", "Weekly"],
              ["interval", "Every N minutes"],
              ["cron", "Custom cron (UTC)"],
            ] as [Mode, string][]
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 ${
                mode === value ? "border-black bg-gray-50 font-medium" : "border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="mode"
                checked={mode === value}
                onChange={() => setMode(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>

        {mode === "daily" && (
          <div className="flex items-end gap-2 text-sm">
            <span className="pb-2 text-gray-600">at</span>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Hour (UTC)</span>
              <input className={inputClass} value={hour} onChange={(e) => setHour(e.target.value)} inputMode="numeric" />
            </label>
            <span className="pb-2 text-gray-600">:</span>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Minute</span>
              <input className={inputClass} value={minute} onChange={(e) => setMinute(e.target.value)} inputMode="numeric" />
            </label>
          </div>
        )}
        {mode === "weekly" && (
          <div className="flex flex-wrap items-end gap-2 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Day</span>
              <select className={inputClass} value={day} onChange={(e) => setDay(Number(e.target.value))}>
                {DAYS.map((d) => (
                  <option key={d.cron} value={d.cron}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <span className="pb-2 text-gray-600">at</span>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Hour (UTC)</span>
              <input className={inputClass} value={hour} onChange={(e) => setHour(e.target.value)} inputMode="numeric" />
            </label>
            <span className="pb-2 text-gray-600">:</span>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Minute</span>
              <input className={inputClass} value={minute} onChange={(e) => setMinute(e.target.value)} inputMode="numeric" />
            </label>
          </div>
        )}
        {mode === "interval" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-gray-500">Every N minutes (minimum 60)</span>
            <input
              className={inputClass}
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(e.target.value)}
              inputMode="numeric"
            />
          </label>
        )}
        {mode === "cron" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-gray-500">5-field cron, UTC, one per line (e.g. 0 9 * * *)</span>
            <textarea
              className={inputClass}
              rows={3}
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              placeholder={"0 9 * * *"}
            />
          </label>
        )}
        {mode === "hourly" && <p className="text-xs text-gray-500">Runs every hour (3600 s interval).</p>}

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
