// Pulse's commuter-first comparison screen. Route evidence comes from the existing
// discovery engines; this screen never manufactures a transport service or a fare.
import { useMemo, useState } from "react";
import { ArrowRight, BusFront, ChevronDown, ChevronUp, Footprints, MapPin, TrainFront, TramFront } from "lucide-react";
import type { TransportRecommendation as Recommendation } from "../../types";

type FareDisplay = { value: string; note: string };
const money = (value: number): string =>
  "R" + (Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2));

const isValidFare = (fare: number | null | undefined): fare is number =>
  typeof fare === "number" && Number.isFinite(fare) && fare >= 0;

/** Don't display a train-leg fare as the full price of an unfinished commute. */
export function getCommuterFare(rec: Recommendation): FareDisplay {
  const legs = rec.journeyLegs ?? [];
  const hasUnpricedLeg = legs.some(leg =>
    leg.mode !== "walk" && (!isValidFare(leg.fare) || leg.fareStatus === "unverified"));
  const accessUnresolved = rec.badges?.includes("ACCESS_REQUIRED") ?? false;
  const partial = hasUnpricedLeg || accessUnresolved;
  if (rec.fareStatus !== "unverified" && isValidFare(rec.estimatedFare)) {
    if (!hasUnpricedLeg) {
      return {
        value: money(rec.estimatedFare),
        note: accessUnresolved
          ? "Rail/bus leg only · getting there costs extra"
          : rec.fareStatus === "verified"
            ? "Published fare · check before travel"
            : "Estimated fare · check before travel",
      };
    }
  }

  // Provisional guides must never be presented as a confirmed trip price.
  if (rec.fareEstimateRange &&
      isValidFare(rec.fareEstimateRange.minimum) &&
      isValidFare(rec.fareEstimateRange.maximum) &&
      !partial) {
    return {
      value: money(rec.fareEstimateRange.minimum) + "–" + money(rec.fareEstimateRange.maximum),
      note: "Taxi guide only · ask at the rank",
    };
  }
  if (rec.publishedFareRange &&
      isValidFare(rec.publishedFareRange.minimum) &&
      isValidFare(rec.publishedFareRange.maximum) &&
      !hasUnpricedLeg) {
    return {
      value: money(rec.publishedFareRange.minimum) + "–" + money(rec.publishedFareRange.maximum),
      note: "Published fare bands · not your total",
    };
  }
  return {
    value: "Fare to confirm",
    note: partial ? "Some connections have no confirmed price" : "Ask before boarding",
  };
}

export function getBoardingHint(rec: Recommendation): string {
  if (rec.evidenceStatus === "published-service-area" || !rec.nearestStop?.trim()) {
    return "Boarding point to confirm";
  }
  return "Board near " + rec.nearestStop;
}

const humanMode = (mode: string): string =>
  mode === "Taxi" ? "Minibus taxi" :
  mode === "Metrorail" ? "Metrorail" :
  mode === "Putco" ? "PUTCO bus" : mode;

const modeType = (mode: string): "rail" | "taxi" | "bus" =>
  mode === "Gautrain" || mode === "Metrorail" ? "rail" :
  mode === "Taxi" ? "taxi" : "bus";

interface Props {
  destination: string;
  recommendations: Recommendation[];
  isLoading: boolean;
  onSelect: (recommendation: Recommendation) => void;
}

export function SimpleTransportOptions({
  destination, recommendations, isLoading, onSelect,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const ordered = useMemo(
    () => [...recommendations].sort((a, b) => {
      // A verified startable journey is more useful than an area-only hint.
      const actionable = Number(b.selectable !== false) - Number(a.selectable !== false);
      return actionable || b.score - a.score;
    }),
    [recommendations],
  );
  const displayed = showAll ? ordered : ordered.slice(0, 5);

  if (isLoading) {
    return <div role="status" className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center text-sm text-white/70">
      Finding transport connections…
    </div>;
  }

  if (!ordered.length) {
    return <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <h3 className="text-lg font-bold text-white">No confirmed options yet</h3>
      <p className="mt-2 text-sm text-white/55">Try another nearby starting point or destination. We won't guess a route or price.</p>
    </div>;
  }

  return <section aria-label="Transport options" className="space-y-3">
    <p className="px-1 text-sm text-white/60">
      Connections towards <span className="font-semibold text-white">{destination}</span>
    </p>
    {displayed.map(rec => {
      const fare = getCommuterFare(rec);
      const active = expandedId === rec.id;
      const canStart = rec.selectable !== false;
      const type = modeType(rec.mode);
      const Icon = type === "rail" ? TrainFront : type === "taxi" ? TramFront : BusFront;
      const legs = rec.journeyLegs ?? [];
      return <article key={rec.id} className="overflow-hidden rounded-[22px] border border-white/10 bg-[#111f2d] shadow-lg shadow-black/10">
        <div className="flex items-start gap-3 p-4 sm:p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
            <Icon size={24} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-white sm:text-lg">{humanMode(rec.mode)}</h3>
              <span className="text-lg font-black text-emerald-300">{fare.value}</span>
            </div>
            <p className="mt-1 text-xs text-white/50">{fare.note}</p>
            <p className="mt-3 flex items-start gap-2 text-sm text-white/80">
              <MapPin size={15} className="mt-0.5 shrink-0 text-cyan-300" aria-hidden="true"/>
              <span>{getBoardingHint(rec)}</span>
            </p>
            {rec.routeName && <p className="mt-1 pl-[23px] text-xs text-white/55">{rec.routeName}</p>}
            {rec.direct === false && <p className="mt-2 text-xs font-semibold text-cyan-200">Includes a change of transport</p>}
            {rec.walkingDistance > 0 && Number.isFinite(rec.walkingDistance) &&
              <p className="mt-1 flex items-center gap-1 text-xs text-white/50">
                <Footprints size={14} aria-hidden="true"/> About {rec.walkingDistance.toFixed(1)} km total walking/access estimate
              </p>}
          </div>
        </div>
        <div className="flex gap-2 px-4 pb-4 sm:px-5">
          {canStart &&
            <button type="button" onClick={() => onSelect(rec)}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#66e7d2] px-3 text-sm font-bold text-[#071a20] hover:bg-[#8cf3e2]">
              Choose <ArrowRight size={17} aria-hidden="true"/>
            </button>}
          <button type="button"
            aria-expanded={active}
            aria-label={(active ? "Hide" : "View") + " journey information for " + humanMode(rec.mode)}
            onClick={() => setExpandedId(active ? null : rec.id)}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 text-sm font-semibold text-white">
            {canStart ? "See steps" : "See connection"}
            {active ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </button>
        </div>
        {active && <div className="space-y-3 border-t border-white/10 bg-black/10 p-4 sm:p-5">
          {legs.length > 0 ? legs.map((leg, index) =>
            <div key={leg.id} className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-bold text-cyan-200">{index + 1}</span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">{leg.label}</p>
                <p className="mt-0.5 text-xs text-white/55">{leg.from ?? "Starting point"} → {leg.to ?? "Destination"}</p>
                <p className="mt-1 text-xs text-emerald-200/80">
                  {leg.mode === "walk" ? "Walk" :
                    isValidFare(leg.fare) && leg.fareStatus !== "unverified" ?
                      (leg.fareStatus === "verified" ? "" : "About ") + money(leg.fare) :
                      "Fare to confirm"}
                </p>
              </div>
            </div>
          ) : <p className="text-sm text-white/70">Exact boarding and transfer steps have not been confirmed.</p>}
          <p className="text-xs leading-relaxed text-white/60">{rec.reason}</p>
          {!canStart && <p className="rounded-xl bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
            Connection information only. Pulse cannot start this journey until the missing details are checked.
          </p>}
        </div>}
      </article>;
    })}
    {ordered.length > 5 && <button type="button" onClick={() => setShowAll(v => !v)}
      className="min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] text-sm font-semibold text-cyan-100">
      {showAll ? "Show fewer options" : "See all " + ordered.length + " options"}
    </button>}
    <p className="px-1 pt-1 text-xs leading-5 text-white/40">
      Options are based on mapped routes and operator information, not live vehicle availability. Check stops, schedules and fares before you travel.
    </p>
  </section>;
}
