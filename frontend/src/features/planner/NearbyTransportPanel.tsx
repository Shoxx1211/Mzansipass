import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, MapPin } from "lucide-react";
import type { Location } from "../../types";
import { getNearbyModeHints, mappedStopWalkingUrl } from "../../services/nearbyNetwork";

interface Props {
  origin: Location | null;
  title?: string;
  initiallyOpen?: boolean;
}

/** Discover mapped nearby transit before choosing a destination. This does
 * not promise that a service connects to the commuter's destination. */
export function NearbyTransportPanel({
  origin,
  title = "Public transport near your starting point",
  initiallyOpen = true,
}: Props) {
  const [open, setOpen] = useState(initiallyOpen);
  const hints = useMemo(() => getNearbyModeHints(origin), [origin]);

  if (!origin || hints.length === 0) return null;

  return <section aria-label="Nearby public transport" className="rounded-[22px] border border-white/10 bg-[#111f2d]">
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
      className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-sm font-semibold text-white/85">
      <span className="flex items-center gap-2"><MapPin size={16} aria-hidden="true" className="text-cyan-200" />{title}</span>
      {open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
    </button>
    {open && <div className="space-y-3 border-t border-white/10 px-4 py-4">
      {hints.map(hint => <div key={hint.id} className="space-y-1 rounded-xl bg-white/[0.035] p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-white">{hint.name}</span>
          {hint.kilometres !== undefined && <span className="whitespace-nowrap text-xs text-cyan-200">
            {hint.kilometres.toFixed(1)} km away*
          </span>}
        </div>
        {hint.stopName && <p className="text-xs font-semibold text-emerald-200">{hint.stopName}</p>}
        <p className="text-xs leading-5 text-white/60">{hint.detail}</p>
        {hint.dataType === "mapped-stop" && hint.stopName && hint.point && mappedStopWalkingUrl(hint.point) && (
          <a href={mappedStopWalkingUrl(hint.point)!} target="_blank" rel="noopener noreferrer"
            className="inline-block py-1 text-xs font-semibold text-emerald-200 underline underline-offset-4">
            Walking directions to mapped stop ↗
          </a>
        )}
        <a href={hint.sourceUrl} target="_blank" rel="noopener noreferrer"
          className="inline-block py-1 text-xs text-cyan-200 underline underline-offset-4">
          {hint.sourceLabel ?? "Operator information"} ↗
        </a>
        {hint.attribution && <p className="text-[10px] text-white/45">{hint.attribution}</p>}
      </div>)}
      <p className="text-[11px] leading-5 text-white/45">
        *Straight-line distance to a mapped point, not the walking route.
        Nearby means mapped infrastructure in the area, not that a service
        is currently running or serves your destination. A mapped taxi
        facility is not a verified taxi route or transfer point.
        The minibus rank directory is still being checked: no listing does
        not mean that taxis are unavailable in your area.
        Walking directions open Google Maps on your phone and do not confirm
        boarding access, route direction, or current service.
      </p>
    </div>}
  </section>;
}
