import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { useSaveSettings, useSettings } from "../api/purchasing";
import { AppShell } from "../components/AppShell";
import { Button, errorBoxClass, inputClass } from "../components/ui";

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
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-gray-600">
        Price research looks for stores near this location, within the given distance.
      </p>

      {isLoading && <p className="mt-6 text-gray-500">Loading…</p>}
      {error && (
        <div role="alert" className={`mt-6 ${errorBoxClass}`}>
          {error.message}
        </div>
      )}

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
            <input
              className={inputClass}
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              inputMode="decimal"
              placeholder="52.52"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="font-medium">Longitude (optional)</span>
            <input
              className={inputClass}
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              inputMode="decimal"
              placeholder="13.405"
            />
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
        {saveSettings.error && (
          <div role="alert" className={errorBoxClass}>
            {saveSettings.error.message}
          </div>
        )}
        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" variant="primary" className="px-4 py-2" disabled={saveSettings.isPending}>
            {saveSettings.isPending ? "Saving…" : "Save settings"}
          </Button>
          {saved && <span className="text-sm font-medium text-green-700">✓ Saved</span>}
        </div>
      </form>
    </AppShell>
  );
};

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});
