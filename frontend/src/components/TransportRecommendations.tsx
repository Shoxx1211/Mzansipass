// src/components/TransportRecommendation.tsx

import {
  Clock3,
  Footprints,
  ShieldCheck,
  Wallet,
  Train,
  Bus,
  CarTaxiFront,
  Sparkles,
  CheckCircle2
} from "lucide-react";

import {
  type TransportRecommendation as RecommendationType
} from "../types";

// ======================================================
// PROPS
// ======================================================

interface TransportRecommendationProps {

  recommendations: RecommendationType[];

  selected: RecommendationType | null;

  onSelect: (
    recommendation: RecommendationType
  ) => void;

}

// ======================================================
// ICONS
// ======================================================

const getTransportIcon = (
  mode: string
) => {

  switch (mode) {

    case "Taxi":
      return (
        <CarTaxiFront
          size={20}
        />
      );

    case "Gautrain":
    case "Metrorail":
      return (
        <Train
          size={20}
        />
      );

    default:
      return (
        <Bus
          size={20}
        />
      );

  }

};

// ======================================================
// BADGE COLORS
// ======================================================

const getBadgeColor = (
  badge: string
) => {

  switch (badge) {

    case "FASTEST":
      return "text-cyan-400";

    case "CHEAPEST":
      return "text-yellow-400";

    case "BEST_OVERALL":
      return "text-emerald-400";

    case "SAFEST":
      return "text-violet-400";

    case "LEAST_WALKING":
      return "text-pink-400";

    case "RELIABLE":
      return "text-orange-400";

    default:
      return "text-white";

  }

};

// ======================================================
// BADGE LABEL
// ======================================================

const formatBadge = (
  badge: string
) => {

  return badge
    .replaceAll("_", " ")
    .toUpperCase();

};

// ======================================================
// COMPONENT
// ======================================================

export const TransportRecommendation = ({
  recommendations,
  selected,
  onSelect
}: TransportRecommendationProps) => {

  // ======================================================
  // EMPTY
  // ======================================================

  if (!recommendations.length) {
    return null;
  }

  // ======================================================
  // UI
  // ======================================================

  return (

    <div className="space-y-4">

      {/* HEADER */}
      <div className="glass rounded-3xl p-5">

        <div className="flex items-center gap-3">

          <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 flex items-center justify-center">

            <Sparkles
              size={20}
              className="text-cyan-400"
            />

          </div>

          <div>

            <p className="text-xs text-white/40">
              AI JOURNEY ENGINE
            </p>

            <h2 className="text-xl font-black mt-1">
              Recommended Routes
            </h2>

          </div>

        </div>

      </div>

      {/* RECOMMENDATIONS */}
      {recommendations.map((
        recommendation
      ) => {

        const isSelected =
          selected?.id ===
          recommendation.id;

        return (

          <button
            key={
              recommendation.id
            }
            onClick={() =>
              onSelect(
                recommendation
              )
            }
            className={`
              w-full
              text-left
              glass
              rounded-3xl
              p-5
              transition-all
              border
              ${
                isSelected
                  ? "border-cyan-400/50 scale-[1.01]"
                  : "border-white/5 hover:border-white/10"
              }
            `}
          >

            {/* TOP */}
            <div className="flex items-start justify-between">

              <div className="flex items-center gap-4">

                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">

                  {getTransportIcon(
                    recommendation.mode
                  )}

                </div>

                <div>

                  <div className="flex items-center gap-2 flex-wrap">

                    <p className="font-bold text-lg">
                      {
                        recommendation.mode
                      }
                    </p>

                    <span
                      className={`
                        text-[10px]
                        font-bold
                        tracking-wide
                        ${getBadgeColor(
                          recommendation.badge
                        )}
                      `}
                    >
                      {formatBadge(
                        recommendation.badge
                      )}
                    </span>

                  </div>

                  <p className="text-sm text-white/50 mt-1">
                    {
                      recommendation.routeName
                    }
                  </p>

                  {recommendation.subtitle && (

                    <p className="text-xs text-white/40 mt-1">
                      {
                        recommendation.subtitle
                      }
                    </p>

                  )}

                </div>

              </div>

              {/* SELECTED */}
              {isSelected && (

                <CheckCircle2
                  size={22}
                  className="text-cyan-400"
                />

              )}

            </div>

            {/* REASON */}
            <div className="mt-4 bg-white/5 rounded-2xl p-4">

              <p className="text-xs text-white/40 mb-1">
                WHY THIS ROUTE
              </p>

              <p className="text-sm leading-relaxed">
                {
                  recommendation.reason
                }
              </p>

            </div>

            {/* METRICS */}
            <div className="grid grid-cols-4 gap-3 mt-5">

              {/* TIME */}
              <div className="bg-white/5 rounded-2xl p-3">

                <div className="flex items-center gap-1 text-[10px] text-white/40">

                  <Clock3 size={11} />

                  TIME

                </div>

                <p className="mt-2 font-bold text-sm">
                  {
                    recommendation.estimatedTime
                  }
                  m
                </p>

              </div>

              {/* COST */}
              <div className="bg-white/5 rounded-2xl p-3">

                <div className="flex items-center gap-1 text-[10px] text-white/40">

                  <Wallet size={11} />

                  COST

                </div>

                <p className="mt-2 font-bold text-sm">
                  R
                  {recommendation.estimatedFare.toFixed(
                    0
                  )}
                </p>

              </div>

              {/* WALK */}
              <div className="bg-white/5 rounded-2xl p-3">

                <div className="flex items-center gap-1 text-[10px] text-white/40">

                  <Footprints size={11} />

                  WALK

                </div>

                <p className="mt-2 font-bold text-sm">
                  {
                    recommendation.walkingDistance
                  }
                  m
                </p>

              </div>

              {/* SAFETY */}
              <div className="bg-white/5 rounded-2xl p-3">

                <div className="flex items-center gap-1 text-[10px] text-white/40">

                  <ShieldCheck size={11} />

                  SAFE

                </div>

                <p className="mt-2 font-bold text-sm">
                  {Math.round(
                    recommendation.reliabilityScore || 85
                  )}
                  %
                </p>

              </div>

            </div>

          </button>

        );

      })}

    </div>

  );

};