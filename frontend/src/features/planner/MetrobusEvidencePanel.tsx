import { useState } from "react";
import { METROBUS_PILOT_POLICY } from "../../config/metrobusPilotPolicy";
import type { MetrobusEvidenceResult } from "../../services/metrobusEvidenceEngine";

interface Props {
  result: MetrobusEvidenceResult | null;
  destinationLabel: string;
}

const formatDistance = (value: number) =>
  value < 1000 ? `${Math.round(value)} m` : `${(value / 1000).toFixed(1)} km`;

/** Internal pilot. App.tsx already renders this panel behind import.meta.env.DEV. */
export const MetrobusEvidencePanel = ({ result, destinationLabel }: Props) => {
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);
  if (!result || !METROBUS_PILOT_POLICY.enabled) return null;

  const visibleMatches = result.matches.slice(0, METROBUS_PILOT_POLICY.maxVisibleCandidates);
  return (
    <section aria-label="Metrobus provisional pilot results" className="mb-5 overflow-hidden rounded-3xl border border-sky-300/15 bg-slate-950/50 shadow-xl backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-sky-400/[0.09] via-indigo-400/[0.06] to-transparent p-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-sky-300">Metrobus · internal pilot</p>
          <h3 className="mt-1 text-lg font-bold text-white">Possible routes to {destinationLabel}</h3>
          <p className="mt-1 max-w-xl text-xs leading-5 text-slate-300">Pulse uses your GPS location and selected destination. City-mapped routes are provisionally treated as available for this test.</p>
        </div>
        <span className="rounded-full border border-amber-300/25 bg-amber-300/[0.09] px-3 py-1 text-[11px] font-semibold text-amber-100">Pilot · service unconfirmed</span>
      </div>

      {visibleMatches.length > 0 ? (
        <div className="space-y-3 p-4 sm:p-5">
          <p className="text-xs leading-5 text-slate-300">{visibleMatches.length} mapped route {visibleMatches.length === 1 ? "shape passes" : "shapes pass"} within {result.thresholdMetres} m of both locations. Ordered by geographic proximity, not journey quality.</p>
          {visibleMatches.map((match) => {
            const key = `${match.routeCode}-${match.gisObjectId}`;
            const expanded = expandedRoute === key;
            return (
              <article key={key} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-white">Metrobus Route {match.routeCode}</span>
                      <span className="rounded-full bg-sky-300/10 px-2 py-0.5 text-[10px] font-medium text-sky-200">Provisional</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{match.description || [match.originLabel, match.destinationLabel].filter(Boolean).join(" → ") || "City GIS route geometry"}</p>
                  </div>
                  <button type="button" onClick={() => setExpandedRoute(expanded ? null : key)} aria-expanded={expanded} className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-white/[0.07]">
                    {expanded ? "Hide details" : "Inspect route"}
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">From your GPS</div>
                    <div className="mt-1 text-sm font-semibold text-white">{formatDistance(match.originDistanceMetres)} away</div>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">Near destination</div>
                    <div className="mt-1 text-sm font-semibold text-white">{formatDistance(match.destinationDistanceMetres)} away</div>
                  </div>
                </div>
                {expanded && (
                  <div className="mt-3 rounded-xl border border-sky-300/10 bg-sky-200/[0.035] p-3 text-xs leading-5 text-slate-300">
                    <p>City GIS OBJECTID: {match.gisObjectId}. Internal GIS ROUTE_ID: {match.rawRouteIdField ?? "not supplied"}.</p>
                    <p>Indexed inventory overlap: {match.indexedExcerptOverlap ? "yes, code-level only" : "not present in the incomplete excerpt"}.</p>
                    <p className="mt-2 text-amber-100">A nearby shape is not a confirmed boarding stop, service direction or active departure. Check operating information before travelling.</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="p-5">
          <p className="text-sm font-semibold text-white">No common Metrobus GIS shape within {result.thresholdMetres} m</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">This only describes our current map screening; it does not prove Metrobus cannot serve your journey.</p>
        </div>
      )}
      <div className="border-t border-amber-300/10 bg-amber-300/[0.045] px-5 py-3 text-[11px] leading-5 text-amber-100/85">
        Internal pilot assumption only. Service operation, boarding stops, direction, transfers, fare and ETA remain unverified. No trip starts or passenger directions are enabled. City GIS reuse permission remains under review.
      </div>
    </section>
  );
};
