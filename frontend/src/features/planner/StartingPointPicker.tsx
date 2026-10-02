// A confirmed manual origin for devices without a sufficiently accurate GPS fix.
// Place candidates are returned by Mapbox; no approximate place-name guesses.
import { useEffect, useState, type FormEvent } from "react";
import { MapPin, Search, X } from "lucide-react";
import type { Location } from "../../types";

interface GeocodingPlace {
  id: string;
  place_name?: string;
  center?: [number, number];
}

const coordinatePair = (text: string): Location | null => {
  const match = text.trim().match(/^(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, accuracy: 0, timestamp: Date.now() };
};

export function StartingPointPicker({
  onChoose, onCancel, onRetryGps,
}: {
  onChoose: (point: Location, name: string) => void;
  onCancel: () => void;
  onRetryGps: () => void;
}) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<GeocodingPlace[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const token = import.meta.env["VITE_MAPBOX_TOKEN"]?.trim() ?? "";

  useEffect(() => {
    if (query.trim().length < 3 || coordinatePair(query) || !token) {
      setMatches([]);
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    const delay = window.setTimeout(async () => {
      setBusy(true);
      const cutoff = window.setTimeout(() => controller.abort(), 7000);
      try {
        const params = new URLSearchParams({
          access_token: token, country: "za", autocomplete: "true",
          limit: "6", language: "en",
          types: "address,poi,place,locality,neighborhood,district",
        });
        const response = await fetch(
          "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
          encodeURIComponent(query.trim()) + ".json?" + params.toString(),
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search unavailable");
        const payload = (await response.json()) as { features?: GeocodingPlace[] };
        setMatches((payload.features ?? []).filter(place =>
          place.center && Number.isFinite(place.center[0]) && Number.isFinite(place.center[1])));
        setMessage("");
      } catch (error) {
        if (!controller.signal.aborted) setMessage("Couldn't search places. Try again or use GPS.");
      } finally {
        window.clearTimeout(cutoff);
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(delay);
      controller.abort();
    };
  }, [query, token]);

  const chooseCoordinates = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const point = coordinatePair(query);
    if (!point) {
      setMessage("Choose a place from the list so Pulse knows exactly where to start.");
      return;
    }
    onChoose(point, "Pinned location");
  };

  return <div className="rounded-[22px] border border-cyan-400/20 bg-[#111f2d] p-4 sm:p-5">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-base font-bold text-white">Choose starting point</h3>
      <button type="button" onClick={onCancel} aria-label="Close starting point search"
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white"><X size={17}/></button>
    </div>
    <form onSubmit={chooseCoordinates} className="relative">
      <label htmlFor="pulse-origin-input" className="sr-only">Starting point</label>
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3">
        <Search size={17} className="shrink-0 text-cyan-200"/>
        <input id="pulse-origin-input" value={query} onChange={e => { setQuery(e.target.value); setMessage(""); }}
          placeholder="Street, area or landmark" autoComplete="off"
          className="h-12 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"/>
        {busy && <span aria-label="Searching" className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300"/>}
      </div>
      {matches.length > 0 && <div role="listbox" aria-label="Starting place matches"
        className="mt-2 max-h-56 overflow-y-auto rounded-xl bg-[#172b39] p-1">
        {matches.map(place => <button type="button" role="option" aria-selected={false}
          key={place.id} className="flex min-h-11 w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/85 hover:bg-white/10"
          onClick={() => {
            if (!place.center) return;
            onChoose({ lat: place.center[1], lng: place.center[0], accuracy: 0, timestamp: Date.now() },
              place.place_name ?? "Selected starting point");
          }}>
          <MapPin size={16} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden="true"/>
          <span>{place.place_name}</span>
        </button>)}
      </div>}
      {!token && <p className="mt-2 text-xs text-amber-100/70">
        Place search needs a Mapbox token. You can use GPS or paste latitude, longitude.
      </p>}
      {message && <p role="status" className="mt-2 text-xs text-amber-100">{message}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onRetryGps}
          className="min-h-11 flex-1 rounded-xl border border-white/15 bg-white/10 text-sm font-semibold text-white">
          Try my location
        </button>
        {coordinatePair(query) && <button type="submit"
          className="min-h-11 flex-1 rounded-xl bg-emerald-300 text-sm font-bold text-slate-950">
          Use pin
        </button>}
      </div>
    </form>
  </div>;
}
