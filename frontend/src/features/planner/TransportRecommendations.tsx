// src/features/planner/TransportRecommendations.tsx
// Pulse Transit - Evidence-aware transport recommendation cards
// Premium planner UI | Truthful public-transport intelligence

import React, {
  memo,
  useMemo,
  useState,
} from "react";

import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Filter,
  Footprints,
  MapPin,
  Navigation,
  TrendingUp,
  Wallet,
} from "lucide-react";

import type {
  TransportRecommendation as RecommendationType,
} from "../../types";

// ======================================================
// TYPES
// ======================================================

interface TransportRecommendationProps {
  recommendations: RecommendationType[];
  selected: RecommendationType | null;
  onSelect: (
    recommendation: RecommendationType,
  ) => void;
  onCompare?: (
    recommendations: RecommendationType[],
  ) => void;
  showFilters?: boolean;
  showComparison?: boolean;
  isLoading?: boolean;
  className?: string;
}

type SortOption =
  | "recommended"
  | "fastest"
  | "cheapest"
  | "leastWalking";

type FilterOption =
  | "all"
  | "taxi"
  | "train"
  | "bus";

// ======================================================
// OPTIONS
// ======================================================

const SORT_OPTIONS: Array<{
  value: SortOption;
  label: string;
}> = [
  {
    value: "recommended",
    label: "Recommended",
  },
  {
    value: "fastest",
    label: "Shortest verified time",
  },
  {
    value: "cheapest",
    label: "Lowest verified fare",
  },
  {
    value: "leastWalking",
    label: "Least walking",
  },
];

const FILTER_OPTIONS: Array<{
  value: FilterOption;
  label: string;
}> = [
  {
    value: "all",
    label: "All",
  },
  {
    value: "taxi",
    label: "Taxi",
  },
  {
    value: "train",
    label: "Train",
  },
  {
    value: "bus",
    label: "Bus",
  },
];

const MODE_MARKS: Record<
  string,
  string
> = {
  Taxi: "TX",
  Gautrain: "GT",
  Metrorail: "MR",
  "Rea Vaya": "RV",
  "A Re Yeng": "AR",
  "Tshwane Bus Service": "TB",
};

// ======================================================
// FORMATTERS
// ======================================================

const getModeLabel = (
  mode: string,
): string =>
  mode === "Taxi"
    ? "Minibus Taxi"
    : mode;

const formatMoney = (
  value: number,
): string => {
  if (!Number.isFinite(value)) {
    return "Not verified";
  }

  return Number.isInteger(value)
    ? `R${value.toFixed(0)}`
    : `R${value.toFixed(2)}`;
};

const formatWalking = (
  distanceKm: number,
): string => {
  if (
    !Number.isFinite(distanceKm) ||
    distanceKm < 0
  ) {
    return "Not verified";
  }

  if (distanceKm < 1) {
    return `${Math.round(
      distanceKm * 1000,
    )} m`;
  }

  return `${distanceKm.toFixed(
    1,
  )} km`;
};

const formatDistance = (
  distanceKm?: number,
): string => {
  if (
    distanceKm === undefined ||
    !Number.isFinite(distanceKm) ||
    distanceKm <= 0
  ) {
    return "Not verified";
  }

  return `${distanceKm.toFixed(
    1,
  )} km`;
};

const formatTime = (
  minutes: number | null,
): string => {
  if (
    minutes === null ||
    !Number.isFinite(minutes) ||
    minutes <= 0
  ) {
    return "Not verified";
  }

  if (minutes < 60) {
    return `${Math.round(
      minutes,
    )} min`;
  }

  const hours =
    Math.floor(minutes / 60);

  const remainder =
    Math.round(minutes % 60);

  return remainder > 0
    ? `${hours}h ${remainder}m`
    : `${hours}h`;
};

const formatFare = (
  recommendation: RecommendationType,
): string => {
  if (
    recommendation.estimatedFare !== null &&
    Number.isFinite(
      recommendation.estimatedFare,
    )
  ) {
    return formatMoney(
      recommendation.estimatedFare,
    );
  }

  const range =
    recommendation.publishedFareRange;

  if (range) {
    return `${formatMoney(
      range.minimum,
    )} - ${formatMoney(
      range.maximum,
    )}`;
  }

  return "Not verified";
};

const getFareHeading = (
  recommendation: RecommendationType,
): string => {
  if (
    recommendation.estimatedFare !== null
  ) {
    return "Est. fare";
  }

  if (
    recommendation.publishedFareRange
  ) {
    return "Published range";
  }

  return "Fare";
};

const getTimeHeading = (
  recommendation: RecommendationType,
): string =>
  recommendation.estimatedTime !== null
    ? "Est. time"
    : "Travel time";

const getFareSupportingText = (
  recommendation: RecommendationType,
): string | null => {
  if (
    recommendation.fareStatus ===
      "unverified" &&
    recommendation.publishedFareRange
  ) {
    const period =
      recommendation
        .publishedFareRange.period;

    if (period === "peak") {
      return "Published peak range across fare bands. Your exact journey fare is not verified.";
    }

    if (period === "offPeak") {
      return "Published off-peak range across fare bands. Your exact journey fare is not verified.";
    }

    return "Published fare range. Your exact journey fare is not verified.";
  }

  if (
    recommendation.fareStatus ===
    "unverified"
  ) {
    return "Exact journey fare is not verified.";
  }

  return null;
};

const getTimeSupportingText = (
  recommendation: RecommendationType,
): string | null => {
  if (
    recommendation.timeStatus ===
    "unverified"
  ) {
    return "No verified operator journey time is available yet.";
  }

  return null;
};

// ======================================================
// BADGES
// ======================================================

const getBadgeColor = (
  badge: string,
): string => {
  switch (badge) {
    case "DIRECT":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-300";

    case "TRANSFER":
      return "border-violet-400/20 bg-violet-500/10 text-violet-300";

    case "PUBLISHED_CONNECTION":
      return "border-cyan-400/20 bg-cyan-500/10 text-cyan-300";

    case "LOW_WALK":
      return "border-cyan-400/20 bg-cyan-500/10 text-cyan-300";

    case "LOW_FARE":
      return "border-amber-400/20 bg-amber-500/10 text-amber-300";

    case "QUICK_ESTIMATE":
      return "border-violet-400/20 bg-violet-500/10 text-violet-300";

    case "OFFICIAL_SERVICE":
    case "OFFICIAL_GIS":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-300";

    case "MULTIMODAL":
      return "border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-300";

    case "ACCESS_REQUIRED":
      return "border-amber-400/20 bg-amber-500/10 text-amber-200";

    case "ROAD_ROUTE":
    case "FARE_VERIFY":
      return "border-orange-400/20 bg-orange-500/10 text-orange-200";

    case "CONFIGURED_DATA":
      return "border-white/10 bg-white/5 text-white/45";

    default:
      return "border-white/10 bg-white/5 text-white/50";
  }
};

const formatBadge = (
  badge: string,
): string => {
  const labels: Record<
    string,
    string
  > = {
    DIRECT:
      "Direct route",
    TRANSFER:
      "Transfer",
    PUBLISHED_CONNECTION:
      "Published connection",
    LOW_WALK:
      "Low walk",
    LOW_FARE:
      "Lower fare",
    QUICK_ESTIMATE:
      "Quicker estimate",
    OFFICIAL_SERVICE:
      "Official service",
    OFFICIAL_GIS:
      "Official route",
    MULTIMODAL:
      "Multi-modal",
    ACCESS_REQUIRED:
      "Access leg",
    ROAD_ROUTE:
      "Road route",
    FARE_VERIFY:
      "Fare to confirm",
    CONFIGURED_DATA:
      "Configured data",
  };

  return (
    labels[badge] ??
    badge
      .replaceAll("_", " ")
      .toLowerCase()
  );
};

// ======================================================
// EVIDENCE HELPERS
// ======================================================

const getEvidenceHeading = (
  recommendation: RecommendationType,
): string => {
  switch (
    recommendation.evidenceStatus
  ) {
    case "same-canonical-route":
      return "Canonical route match";

    case "published-shared-stop-connectivity":
      return "Published transfer evidence";

    case "published-service-membership":
      return "Official service match";

    case "official-gis-route":
      return "Official route geometry";

    case "multi-operator-published-connection":
      return "Multi-modal connection evidence";

    case "multi-operator-official-gis-connection":
      return "Official network connection evidence";

    case "road-baseline":
      return "Road connection available";

    case "configured":
    default:
      return "Configured route evidence";
  }
};

const getEvidenceDescription = (
  recommendation: RecommendationType,
): string => {
  switch (
    recommendation.evidenceStatus
  ) {
    case "same-canonical-route":
      return "Pulse matched your origin and destination to the same canonical operator route geometry. This does not confirm a timetable, exact fare or live vehicle.";

    case "published-shared-stop-connectivity":
      return "Pulse found a path using canonical route geometry and published shared-stop connectivity. Exact transfer timing, walking path and timetable compatibility remain unverified.";

    case "published-service-membership":
      return "Pulse matched both ends of the journey to stations on the same official Gautrain service. Live timetable compatibility and total door-to-door time are not yet confirmed.";

    case "official-gis-route":
      return "Pulse matched both ends of the journey to the same official municipal route geometry. Direction, today's timetable and exact fare may still need confirmation.";

    case "multi-operator-published-connection":
      return "Pulse found a plausible connection between official operator networks using published service membership and route geometry. Transfer timing, exact interchange walking and the combined fare remain unverified.";

    case "multi-operator-official-gis-connection":
      return "Pulse connected an access leg to an official municipal bus route using City GIS route and terminal evidence. The exact transfer timing, roadside stop sequence and combined fare remain unverified.";

    case "road-baseline":
      return "Pulse confirmed a road connection to the destination. The exact minibus-taxi rank, stopping pattern, vehicle changes and fare still need local confirmation.";

    case "configured":
    default:
      return "This recommendation is based on Pulse's configured transport evidence. It is not a live operator confirmation.";
  }
};

const isTransferRecommendation = (
  recommendation: RecommendationType,
): boolean =>
  recommendation.direct === false ||
  (
    recommendation.routeCodes?.length ??
    0
  ) > 1;

// ======================================================
// ROUTE EVIDENCE VISUAL
// ======================================================

const RouteEvidence: React.FC<{
  recommendation: RecommendationType;
}> = ({ recommendation }) => {
  const routeCodes =
    recommendation.routeCodes ?? [];

  const transferStops =
    recommendation.transferStops ?? [];

  if (!routeCodes.length) {
    return null;
  }

  const isTransfer =
    isTransferRecommendation(
      recommendation,
    );

  return (
    <div className="mt-4 rounded-2xl bg-white/[0.035] p-3.5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
          Journey
        </p>

        <span className="rounded-full bg-white/[0.055] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-white/45">
          {isTransfer
            ? `${Math.max(1, routeCodes.length - 1)} change${routeCodes.length > 2 ? "s" : ""}`
            : "Direct"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {routeCodes.map(
          (routeCode, index) => {
            const isLast =
              index ===
              routeCodes.length - 1;

            const transferStop =
              transferStops[index];

            return (
              <React.Fragment
                key={`${routeCode}-${index}`}
              >
                <div className="flex min-h-10 items-center rounded-xl bg-white/[0.065] px-3 text-xs font-black text-white/85">
                  {routeCode}
                </div>

                {!isLast && (
                  <>
                    <ArrowRight
                      size={14}
                      className="shrink-0 text-cyan-300/55"
                    />

                    {transferStop && (
                      <>
                        <div className="flex min-h-10 items-center gap-2 rounded-xl bg-violet-500/[0.07] px-3">
                          <MapPin
                            size={12}
                            className="shrink-0 text-violet-300/80"
                          />
                          <span className="max-w-[190px] truncate text-[11px] font-semibold text-white/55">
                            {transferStop}
                          </span>
                        </div>

                        <ArrowRight
                          size={14}
                          className="shrink-0 text-cyan-300/55"
                        />
                      </>
                    )}
                  </>
                )}
              </React.Fragment>
            );
          },
        )}
      </div>
    </div>
  );
};

// ======================================================
// METRIC TILE
// ======================================================

const MetricTile: React.FC<{
  icon: React.ReactNode;
  heading: string;
  value: string;
  valueClassName?: string;
  supportingText?: string | null;
}> = ({
  icon,
  heading,
  value,
  valueClassName = "text-white",
  supportingText,
}) => (
  <div className="min-w-0">
    <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">
      {icon}
      {heading}
    </div>

    <p className={`mt-1.5 break-words text-base font-black sm:text-lg ${valueClassName}`}>
      {value}
    </p>

    {supportingText && (
      <p className="mt-1 text-[9px] leading-relaxed text-white/25">
        {supportingText}
      </p>
    )}
  </div>
);

// ======================================================
// RECOMMENDATION CARD
// ======================================================

const RecommendationCard: React.FC<{
  recommendation: RecommendationType;
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}> = memo(
  ({
    recommendation,
    isSelected,
    onSelect,
    index,
  }) => {
    const [
      isExpanded,
      setIsExpanded,
    ] = useState(false);

    const modeLabel =
      getModeLabel(
        recommendation.mode,
      );

    const modeMark =
      MODE_MARKS[
        recommendation.mode
      ] ?? "PT";

    const isEvidenceOnly =
      recommendation.selectable ===
      false;

    const displayBadges =
      (recommendation.badges ?? []).filter(
        (badge) =>
          ![
            "OFFICIAL_SERVICE",
            "OFFICIAL_GIS",
            "PUBLISHED_CONNECTION",
            "CONFIGURED_DATA",
            "ROAD_ROUTE",
          ].includes(badge),
      );

    const fareSupportingText =
      getFareSupportingText(
        recommendation,
      );

    const timeSupportingText =
      getTimeSupportingText(
        recommendation,
      );

    return (
      <article
        className={`
          relative overflow-hidden rounded-[28px] border
          bg-[#0a1020]/80 backdrop-blur-xl
          transition-all duration-300
          ${
            isSelected
              ? "border-cyan-300/35 shadow-[0_18px_55px_rgba(6,182,212,0.10)]"
              : "border-white/[0.075] shadow-[0_16px_50px_rgba(0,0,0,0.18)] hover:border-white/15"
          }
        `}
        style={{
          animationDelay:
            `${index * 70}ms`,
        }}
      >
        <div className="p-5 sm:p-6">
          {/* HEADER */}
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`
                flex h-12 w-12 shrink-0
                items-center justify-center
                rounded-2xl border
                text-sm font-black tracking-wide
                ${
                  isSelected
                    ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-200"
                    : "border-white/10 bg-white/[0.07] text-white/75"
                }
              `}
              aria-hidden="true"
            >
              {modeMark}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="break-words text-lg font-black text-white">
                  {modeLabel}
                </h3>

                {isSelected && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-300">
                    <CheckCircle2
                      size={11}
                    />
                    Selected
                  </span>
                )}

                {isEvidenceOnly && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-300">
                    Evidence only
                  </span>
                )}
              </div>

              {recommendation.routeName && (
                <p className="mt-1 break-words text-sm font-semibold leading-relaxed text-white/65">
                  {
                    recommendation.routeName
                  }
                </p>
              )}

              {recommendation.subtitle && (
                <p className="mt-1 text-xs text-white/35">
                  {
                    recommendation.subtitle
                  }
                </p>
              )}
            </div>
          </div>

          {/* BADGES */}
          {!!displayBadges.length && (
            <div className="mt-4 flex flex-wrap gap-2">
              {displayBadges.map(
                (badge) => (
                  <span
                    key={badge}
                    className={`
                      rounded-full border
                      px-2.5 py-1
                      text-[10px] font-bold tracking-wide
                      ${getBadgeColor(
                        badge,
                      )}
                    `}
                  >
                    {formatBadge(
                      badge,
                    )}
                  </span>
                ),
              )}
            </div>
          )}

          {/* ROUTE CHAIN */}
          <RouteEvidence
            recommendation={
              recommendation
            }
          />

          {/* METRICS */}
          <div className="mt-5 grid grid-cols-3 gap-4 border-y border-white/[0.055] py-4">
            <MetricTile
              icon={
                <Clock3
                  size={12}
                />
              }
              heading={getTimeHeading(
                recommendation,
              )}
              value={formatTime(
                recommendation.estimatedTime,
              )}
              supportingText={
                timeSupportingText
              }
            />

            <MetricTile
              icon={
                <Wallet
                  size={12}
                />
              }
              heading={getFareHeading(
                recommendation,
              )}
              value={formatFare(
                recommendation,
              )}
              valueClassName={
                recommendation
                  .estimatedFare !==
                  null
                  ? "text-emerald-300"
                  : recommendation
                        .publishedFareRange
                    ? "text-cyan-200"
                    : "text-white"
              }
              supportingText={
                fareSupportingText
              }
            />

            <MetricTile
              icon={
                <Footprints
                  size={12}
                />
              }
              heading={
                recommendation.badges.includes(
                  "ACCESS_REQUIRED",
                )
                  ? "Access leg"
                  : "Access walk"
              }
              value={formatWalking(
                recommendation.walkingDistance,
              )}
            />

          </div>

          {/* EXPANDED DETAILS */}
          {isExpanded && (
            <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.05] bg-white/[0.04] p-3">
                  <p className="text-[10px] uppercase tracking-wide text-white/30">
                    Board near
                  </p>

                  <p className="mt-1 text-sm font-semibold text-white/80">
                    {recommendation.nearestStop ??
                      "Exact boarding stop not verified"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/[0.05] bg-white/[0.04] p-3">
                  <p className="text-[10px] uppercase tracking-wide text-white/30">
                    Exit near
                  </p>

                  <p className="mt-1 text-sm font-semibold text-white/80">
                    {recommendation.destinationStop ??
                      "Exact exit stop not verified"}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-white/[0.035] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
                  Why this journey
                </p>
                <p className="mt-2 text-xs leading-relaxed text-white/50">
                  {recommendation.reason}
                </p>
              </div>

              <div className="rounded-2xl border border-cyan-400/10 bg-cyan-500/[0.045] p-4">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2
                    size={16}
                    className="mt-0.5 shrink-0 text-cyan-300"
                  />

                  <div>
                    <p className="text-xs font-bold text-white/80">
                      {getEvidenceHeading(
                        recommendation,
                      )}
                    </p>

                    <p className="mt-1.5 text-xs leading-relaxed text-white/40">
                      {getEvidenceDescription(
                        recommendation,
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {isEvidenceOnly && (
                <div className="rounded-2xl border border-amber-400/10 bg-amber-500/[0.04] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300/75">
                    Before trip start
                  </p>

                  <p className="mt-2 text-xs leading-relaxed text-white/45">
                    Pulse will not start
                    this option as a
                    tracked journey until
                    the required passenger
                    fare and journey-time
                    evidence is available.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ACTIONS */}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (!isEvidenceOnly) {
                  onSelect();
                }
              }}
              disabled={
                isEvidenceOnly
              }
              className={`
                min-h-11 flex-1
                rounded-2xl px-4
                text-sm font-black
                transition
                ${
                  isEvidenceOnly
                    ? "cursor-not-allowed border border-white/[0.07] bg-white/[0.04] text-white/35"
                    : isSelected
                      ? "bg-cyan-500/20 text-cyan-200"
                      : "bg-gradient-to-r from-cyan-400 via-cyan-400 to-emerald-400 text-[#031019] shadow-[0_10px_30px_rgba(34,211,238,0.14)] hover:brightness-110"
                }
              `}
            >
              {isEvidenceOnly
                ? "Route evidence only"
                : isSelected
                  ? "Selected"
                  : "Choose journey"}
            </button>

            <button
              type="button"
              onClick={() =>
                setIsExpanded(
                  (value) =>
                    !value,
                )
              }
              className="flex min-h-11 min-w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/65 transition hover:bg-white/10"
              aria-expanded={
                isExpanded
              }
              aria-label={
                isExpanded
                  ? "Hide route evidence"
                  : "Show route evidence"
              }
            >
              {isExpanded ? (
                <ChevronUp
                  size={18}
                />
              ) : (
                <ChevronDown
                  size={18}
                />
              )}
            </button>
          </div>
        </div>
      </article>
    );
  },
);

RecommendationCard.displayName =
  "RecommendationCard";

// ======================================================
// MAIN RECOMMENDATION LIST
// ======================================================

export const TransportRecommendation =
  memo<TransportRecommendationProps>(
    ({
      recommendations,
      selected,
      onSelect,
      onCompare,
      showFilters = true,
      showComparison = true,
      isLoading = false,
      className = "",
    }) => {
      const [
        sortBy,
        setSortBy,
      ] =
        useState<SortOption>(
          "recommended",
        );

      const [
        filterBy,
        setFilterBy,
      ] =
        useState<FilterOption>(
          "all",
        );

      const [
        showSortMenu,
        setShowSortMenu,
      ] = useState(false);

      const [
        showFilterMenu,
        setShowFilterMenu,
      ] = useState(false);

      const processedRecommendations =
        useMemo(() => {
          let filtered = [
            ...recommendations,
          ];

          if (
            filterBy !== "all"
          ) {
            filtered =
              filtered.filter(
                (
                  recommendation,
                ) => {
                  if (
                    filterBy ===
                    "taxi"
                  ) {
                    return (
                      recommendation.mode ===
                      "Taxi"
                    );
                  }

                  if (
                    filterBy ===
                    "train"
                  ) {
                    return (
                      recommendation.mode ===
                        "Gautrain" ||
                      recommendation.mode ===
                        "Metrorail"
                    );
                  }

                  if (
                    filterBy ===
                    "bus"
                  ) {
                    return (
                      recommendation.mode ===
                        "Rea Vaya" ||
                      recommendation.mode ===
                        "A Re Yeng" ||
                      recommendation.mode ===
                        "Tshwane Bus Service"
                    );
                  }

                  return true;
                },
              );
          }

          filtered.sort(
            (a, b) => {
              switch (
                sortBy
              ) {
                case "fastest": {
                  const aTime =
                    a.estimatedTime ??
                    Number.POSITIVE_INFINITY;

                  const bTime =
                    b.estimatedTime ??
                    Number.POSITIVE_INFINITY;

                  return (
                    aTime -
                    bTime
                  );
                }

                case "cheapest": {
                  const aFare =
                    a.estimatedFare ??
                    Number.POSITIVE_INFINITY;

                  const bFare =
                    b.estimatedFare ??
                    Number.POSITIVE_INFINITY;

                  return (
                    aFare -
                    bFare
                  );
                }

                case "leastWalking":
                  return (
                    a.walkingDistance -
                    b.walkingDistance
                  );

                case "recommended":
                default:
                  return (
                    b.score -
                    a.score
                  );
              }
            },
          );

          return filtered;
        }, [
          filterBy,
          recommendations,
          sortBy,
        ]);

      // ==================================================
      // LOADING
      // ==================================================

      if (isLoading) {
        return (
          <div
            className={`space-y-4 ${className}`}
          >
            <div className="glass rounded-3xl p-8 text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-cyan-400" />

              <p className="mt-4 text-sm font-semibold text-white/70">
                Building your journeys...
              </p>

              <p className="mt-1 text-xs text-white/35">
                Checking taxi, rail and bus connections for this trip.
              </p>
            </div>
          </div>
        );
      }

      // ==================================================
      // EMPTY STATE
      // ==================================================

      if (
        !recommendations.length
      ) {
        return (
          <div
            className={`glass rounded-3xl p-6 text-center sm:p-8 ${className}`}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06]">
              <Navigation
                size={26}
                className="text-white/35"
              />
            </div>

            <h3 className="mt-4 text-lg font-black text-white">
              No journey found yet
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/45">
              Pulse found the destination, but we do not yet have enough route data to build a useful public-transport journey for both ends.
            </p>
          </div>
        );
      }

      // ==================================================
      // RESULTS
      // ==================================================

      return (
        <div
          className={`space-y-4 ${className}`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500/20 to-emerald-500/20">
                <Navigation
                  size={18}
                  className="text-cyan-300"
                />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                  Journey options
                </p>

                <h2 className="truncate text-lg font-black text-white">
                  Best ways to get there
                </h2>
              </div>
            </div>

            {showFilters && (
              <div className="flex flex-wrap gap-2">
                {/* SORT */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSortMenu(
                        (value) =>
                          !value,
                      );

                      setShowFilterMenu(
                        false,
                      );
                    }}
                    className="flex min-h-9 items-center gap-1.5 rounded-xl bg-white/[0.045] px-3 text-xs font-semibold text-white/55 transition hover:bg-white/[0.075] hover:text-white/75"
                  >
                    <TrendingUp
                      size={13}
                    />
                    Sort
                    <ChevronDown
                      size={12}
                    />
                  </button>

                  {showSortMenu && (
                    <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-2xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl backdrop-blur-xl">
                      {SORT_OPTIONS.map(
                        (
                          option,
                        ) => (
                          <button
                            key={
                              option.value
                            }
                            type="button"
                            onClick={() => {
                              setSortBy(
                                option.value,
                              );

                              setShowSortMenu(
                                false,
                              );
                            }}
                            className={`
                              w-full rounded-xl
                              px-3 py-2
                              text-left text-xs
                              transition
                              ${
                                sortBy ===
                                option.value
                                  ? "bg-cyan-500/15 text-cyan-300"
                                  : "text-white/65 hover:bg-white/[0.06]"
                              }
                            `}
                          >
                            {
                              option.label
                            }
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </div>

                {/* FILTER */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFilterMenu(
                        (value) =>
                          !value,
                      );

                      setShowSortMenu(
                        false,
                      );
                    }}
                    className="flex min-h-9 items-center gap-1.5 rounded-xl bg-white/[0.045] px-3 text-xs font-semibold text-white/55 transition hover:bg-white/[0.075] hover:text-white/75"
                  >
                    <Filter
                      size={13}
                    />
                    Filter
                    <ChevronDown
                      size={12}
                    />
                  </button>

                  {showFilterMenu && (
                    <div className="absolute right-0 top-full z-20 mt-2 w-36 rounded-2xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl backdrop-blur-xl">
                      {FILTER_OPTIONS.map(
                        (
                          option,
                        ) => (
                          <button
                            key={
                              option.value
                            }
                            type="button"
                            onClick={() => {
                              setFilterBy(
                                option.value,
                              );

                              setShowFilterMenu(
                                false,
                              );
                            }}
                            className={`
                              w-full rounded-xl
                              px-3 py-2
                              text-left text-xs
                              transition
                              ${
                                filterBy ===
                                option.value
                                  ? "bg-cyan-500/15 text-cyan-300"
                                  : "text-white/65 hover:bg-white/[0.06]"
                              }
                            `}
                          >
                            {
                              option.label
                            }
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-1 text-[10px] text-white/35">
            <span>
              {
                processedRecommendations.length
              }{" "}
              journey option
              {processedRecommendations.length ===
              1
                ? ""
                : "s"}
            </span>

            {showComparison &&
              processedRecommendations.length >
                1 &&
              onCompare && (
                <button
                  type="button"
                  onClick={() =>
                    onCompare(
                      processedRecommendations,
                    )
                  }
                  className="font-semibold text-cyan-300 transition hover:text-cyan-200"
                >
                  Compare
                </button>
              )}
          </div>

          <div className="space-y-3">
            {processedRecommendations.map(
              (
                recommendation,
                index,
              ) => (
                <RecommendationCard
                  key={
                    recommendation.id
                  }
                  recommendation={
                    recommendation
                  }
                  isSelected={
                    selected?.id ===
                    recommendation.id
                  }
                  onSelect={() =>
                    onSelect(
                      recommendation,
                    )
                  }
                  index={index}
                />
              ),
            )}
          </div>

          <p className="px-4 text-center text-[10px] leading-relaxed text-white/25">
            Pulse separates
            road-driving context from
            public-transport evidence.
            Exact fares, journey times
            and transfer instructions
            are only presented when the
            available evidence supports
            them.
          </p>
        </div>
      );
    },
  );

TransportRecommendation.displayName =
  "TransportRecommendation";

export type {
  FilterOption,
  SortOption,
};