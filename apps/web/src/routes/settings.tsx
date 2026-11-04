import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { useSaveSettings, useSettings } from "../api/purchasing";
import { AppShell } from "../components/AppShell";

const inputClass =
  "w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none";

const SettingsPage = () => {
  const { data: settings, isLoading, error } = useSettings();
  const saveSettings = useSaveSettings();
  const [location, setLocation] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [proximityKm, setProximityKm] = useState("10");
  const [currency, setCurrency] = useState("EUR");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocation(settings.location);
      setLatitude(settings.latitude?.toString() ?? "");
      setLongitude(settings.longitude?.toString() ?? "");
      setProximityKm(settings.proximity_km.toString());
      setCurrency(settings.currency);
    }
  }, [settings]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    saveSettings.mutate(
      {
        location,
        latitude: latitude === "" ? null : Number(latitude),
        longitude: longitude === "" ? null : Number(longitude),
        proximity_km: Number(proximityKm) || 10,
        currency,
      },
      { onSuccess: () => setSaved(true) }
    );
  };

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-gray-600">
        Price research looks for stores near this location, within the given distance.
      </p>

      {isLoading && <p className="mt-6 text-gray-500">Loading…</p>}
      {error && <p className="mt-6 text-red-600">{error.message}</p>}

      <form onSubmit={submit} className="mt-6 flex max-w-lg flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Location</span>
          <input
            className={inputClass}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. 10115 Berlin, Germany"
          />
        </label>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="font-medium">Latitude (optional)</span>
            <input className={inputClass} value={latitude} onChange={(e) => setLatitude(e.target.value)} inputMode="decimal" placeholder="52.52" />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="font-medium">Longitude (optional)</span>
            <input className={inputClass} value={longitude} onChange={(e) => setLongitude(e.target.value)} inputMode="decimal" placeholder="13.405" />
          </label>
        </div>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="font-medium">Search radius (km)</span>
            <input
              className={inputClass}
              value={proximityKm}
              onChange={(e) => setProximityKm(e.target.value)}
              inputMode="decimal"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Currency</span>
            <input className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={8} />
          </label>
        </div>
        {saveSettings.error && <p className="text-sm text-red-600">{saveSettings.error.message}</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saveSettings.isPending}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {saveSettings.isPending ? "Saving…" : "Save settings"}
          </button>
          {saved && <span className="text-sm text-green-700">Saved.</span>}
        </div>
      </form>
    </AppShell>
  );
};

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});
