// src/features/trip/TripTracker.tsx
// Pulse Transit - Premium Live Trip Tracker
// Focus: truthful live metrics, mobile-first spacing, resilient GPS UX

import { memo, useEffect, useMemo, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gauge,
  MapPinned,
  Route,
  Signal,
  Timer,
  Wifi,
  Zap,
} from "lucide-react";

import type { TransitNetwork } from "../../types";
import { NETWORK_UI } from "../../constants";

// ======================================================
// TYPES
// ======================================================

interface TripTrackerProps {
  network: TransitNetwork | null;
  destination: string;

  /** Actual GPS distance travelled so far, in kilometres. */
  distance: number;

  /** Elapsed trip time, in seconds. */
  duration: number;

  /** Current validated GPS speed, in km/h. */
  speed: number;

  /** Average speed for the trip so far, in km/h. */
  avgSpeed?: number;

  /** Maximum validated speed for the trip so far, in km/h. */
  maxSpeed?: number;

  startTime?: number;

  /**
   * Only pass this when the planned distance is trustworthy.
   * App.tsx currently limits this to Mapbox road-routing results.
   */
  expectedDistance?: number;

  /**
   * Planned journey duration in seconds. Used only as a stable countdown
   * estimate; it is deliberately not recalculated from noisy instant speed.
   */
  expectedDurationSeconds?: number;

  /** Optional measured values. Nothing fake is displayed when absent. */
  routeQuality?: number;
  signalStrength?: "excellent" | "good" | "fair" | "poor";
  batteryLevel?: number;
  isBackgroundTracking?: boolean;

  gpsStatus?: "active" | "stale";

  onEtaUpdate?: (etaMinutes: number) => void;
  onEndTrip: () => void | Promise<void>;
}

interface SpeedQuality {
  label: string;
  description: string;
  color: string;
  icon: ReactNode;
  minSpeed: number;
  maxSpeed: number;
}

interface EtaPrediction {
  minutes: number;
  arrivalTime: Date;
}

// ======================================================
// CONSTANTS
// ======================================================

const SPEED_QUALITIES: SpeedQuality[] = [
  {
    label: "Express",
    description: "High-speed travel",
    color: "text-rose-300",
    icon: <Zap size={14} />,
    minSpeed: 70,
    maxSpeed: Number.POSITIVE_INFINITY,
  },
  {
    label: "Fast",
    description: "Moving well",
    color: "text-emerald-300",
    icon: <Activity size={14} />,
    minSpeed: 40,
    maxSpeed: 70,
  },
  {
    label: "Smooth",
    description: "Steady movement",
    color: "text-cyan-300",
    icon: <Activity size={14} />,
    minSpeed: 20,
    maxSpeed: 40,
  },
  {
    label: "Moderate",
    description: "Urban traffic pace",
    color: "text-amber-300",
    icon: <Clock size={14} />,
    minSpeed: 8,
    maxSpeed: 20,
  },
  {
    label: "Slow",
    description: "Stopped or moving slowly",
    color: "text-white/50",
    icon: <AlertTriangle size={14} />,
    minSpeed: 0,
    maxSpeed: 8,
  },
];

const SIGNAL_CONFIG = {
  excellent: { label: "Excellent", bars: 4, className: "text-emerald-300" },
  good: { label: "Good", bars: 3, className: "text-cyan-300" },
  fair: { label: "Fair", bars: 2, className: "text-amber-300" },
  poor: { label: "Poor", bars: 1, className: "text-rose-300" },
} as const;

// ======================================================
// HELPERS
// ======================================================

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const formatDuration = (seconds: number): string => {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

const formatStartTime = (startTime: number): string =>
  new Date(startTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const usePlannedEta = (
  duration: number,
  expectedDurationSeconds?: number,
): EtaPrediction | null => {
  return useMemo(() => {
    if (
      expectedDurationSeconds === undefined ||
      !Number.isFinite(expectedDurationSeconds) ||
      expectedDurationSeconds <= 0
    ) {
      return null;
    }

    const remainingSeconds = expectedDurationSeconds - Math.max(0, duration);

    // Once the original estimate has elapsed, do not manufacture a new ETA.
    if (remainingSeconds <= 0) {
      return null;
    }

    const minutes = Math.max(1, Math.ceil(remainingSeconds / 60));

    return {
      minutes,
      arrivalTime: new Date(Date.now() + remainingSeconds * 1000),
    };
  }, [duration, expectedDurationSeconds]);
};

// ======================================================
// SUB-COMPONENTS
// ======================================================

const SignalBars = ({ strength }: { strength: number }) => (
  <div className="flex h-4 items-end gap-0.5" aria-hidden="true">
    {[1, 2, 3, 4].map((bar) => (
      <span
        key={bar}
        className="w-1 rounded-full bg-current transition-opacity"
        style={{
          height: `${bar * 3}px`,
          opacity: bar <= strength ? 1 : 0.2,
        }}
      />
    ))}
  </div>
);

const SmallMetricCard = ({
  icon,
  label,
  value,
  unit,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
}) => (
  <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl">
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.07]">
        {icon}
      </span>
      <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
        {label}
      </span>
    </div>

    <div className="mt-3 min-w-0">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        <span className="max-w-full break-words text-[clamp(1.45rem,7vw,2rem)] font-black leading-none tracking-tight text-white">
          {value}
        </span>
        {unit && (
          <span className="shrink-0 text-[11px] font-semibold text-white/35">
            {unit}
          </span>
        )}
      </div>
    </div>
  </div>
);

const OptionalGauge = ({
  value,
  label,
}: {
  value: number;
  label: string;
}) => {
  const safeValue = clamp(value, 0, 100);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-white/45">{label}</span>
        <span className="font-bold text-white/75">{Math.round(safeValue)}%</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
};

// ======================================================
// MAIN COMPONENT
// ======================================================

export const TripTracker = memo<TripTrackerProps>(
  ({
    network,
    destination,
    distance,
    duration,
    speed,
    avgSpeed,
    maxSpeed = 0,
    startTime,
    expectedDistance,
    expectedDurationSeconds,
    routeQuality,
    signalStrength,
    batteryLevel,
    isBackgroundTracking = false,
    gpsStatus = "active",
    onEtaUpdate,
    onEndTrip,
  }) => {
    const networkUI = network ? NETWORK_UI[network] : null;
    const speedQuality = useMemo(
      () =>
        SPEED_QUALITIES.find(
          (quality) =>
            speed >= quality.minSpeed && speed < quality.maxSpeed,
        ) ?? SPEED_QUALITIES[SPEED_QUALITIES.length - 1],
      [speed],
    );

    const calculatedAverageSpeed =
      duration > 0 ? distance / (duration / 3600) : 0;

    const displayAverageSpeed =
      avgSpeed !== undefined && Number.isFinite(avgSpeed)
        ? Math.max(0, avgSpeed)
        : Math.max(0, calculatedAverageSpeed);

    const hasTrustedDistancePlan =
      expectedDistance !== undefined &&
      Number.isFinite(expectedDistance) &&
      expectedDistance > 0;

    // While the trip is active, Pulse must never claim the trip is complete.
    // 100% belongs to the completed-trip screen, not live tracking.
    const progressPercentage = hasTrustedDistancePlan
      ? clamp((distance / expectedDistance!) * 100, 0, 99)
      : null;

    const remainingDistance = hasTrustedDistancePlan
      ? Math.max(0, expectedDistance! - distance)
      : null;

    const etaPrediction = usePlannedEta(
      duration,
      expectedDurationSeconds,
    );

    const signalConfig = signalStrength
      ? SIGNAL_CONFIG[signalStrength]
      : null;

    useEffect(() => {
      if (etaPrediction && onEtaUpdate) {
        onEtaUpdate(etaPrediction.minutes);
      }
    }, [etaPrediction, onEtaUpdate]);

    const gpsHealthy = gpsStatus === "active";

    return (
      <section className="space-y-4" aria-label="Live trip tracker">
        <div
          className={`relative overflow-hidden rounded-[1.75rem] border border-white/15 bg-gradient-to-br ${
            networkUI?.color || "from-slate-900 via-zinc-950 to-black"
          } shadow-2xl`}
        >
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/[0.06] to-transparent" />

          <div className="relative z-10 space-y-5 p-4 sm:p-6">
            {/* Header */}
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.08]">
                  <Route size={22} className="text-cyan-200" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        gpsHealthy
                          ? "animate-pulse bg-emerald-400"
                          : "bg-amber-400"
                      }`}
                    />
                    <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                      {gpsHealthy ? "Live journey" : "GPS reconnecting"}
                    </p>
                  </div>

                  <h2 className="mt-1 truncate text-xl font-black tracking-tight text-white sm:text-2xl">
                    {network || "Transit"}
                  </h2>
                </div>
              </div>

              <div
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${
                  gpsHealthy
                    ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
                    : "border-amber-300/20 bg-amber-300/10 text-amber-100"
                }`}
              >
                {gpsHealthy ? "GPS live" : "Signal lost"}
              </div>
            </div>

            {/* Current speed hero */}
            <div className="rounded-3xl border border-white/10 bg-black/25 p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-white/45">
                    <Gauge size={16} />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">
                      Current GPS speed
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-end gap-x-2 gap-y-1">
                    <span
                      className={`text-[clamp(3rem,16vw,5rem)] font-black leading-[0.9] tracking-[-0.06em] ${speedQuality.color}`}
                    >
                      {Math.max(0, speed).toFixed(0)}
                    </span>
                    <span className="pb-1 text-sm font-bold text-white/45 sm:pb-2 sm:text-base">
                      km/h
                    </span>
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-white/[0.055] px-3 py-2.5">
                  <span className={speedQuality.color}>{speedQuality.icon}</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold ${speedQuality.color}`}>
                      {speedQuality.label}
                    </p>
                    <p className="truncate text-[10px] text-white/35">
                      {speedQuality.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Distance + duration */}
            <div className="grid grid-cols-2 gap-3">
              <SmallMetricCard
                icon={<Route size={16} className="text-cyan-300" />}
                label="Distance"
                value={Math.max(0, distance).toFixed(1)}
                unit="km"
              />

              <SmallMetricCard
                icon={<Timer size={16} className="text-orange-300" />}
                label="Elapsed"
                value={formatDuration(duration)}
              />
            </div>

            {/* Progress - only when we have a trusted planned distance */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              {progressPercentage !== null ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                        Estimated trip progress
                      </p>
                      <p className="mt-1 text-xs text-white/35">
                        Based on the planned road distance
                      </p>
                    </div>

                    <span className="shrink-0 text-lg font-black text-white">
                      {Math.round(progressPercentage)}%
                    </span>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-700"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>

                  {remainingDistance !== null && (
                    <p className="mt-2 text-[10px] text-white/35">
                      Approximately {remainingDistance.toFixed(1)} km of the planned distance remains.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                        Journey in progress
                      </p>
                      <p className="mt-1 text-xs leading-5 text-white/35">
                        Pulse is tracking your real movement. Route percentage will appear once a trusted route baseline is available.
                      </p>
                    </div>
                    <Activity size={18} className="shrink-0 text-cyan-300" />
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-cyan-400/50 to-emerald-400/70" />
                  </div>
                </>
              )}
            </div>

            {/* Destination */}
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10">
                  <MapPinned size={18} className="text-cyan-300" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                    Destination
                  </p>
                  <p className="mt-1 break-words text-base font-bold leading-5 text-white">
                    {destination || "Destination not set"}
                  </p>
                </div>

                {etaPrediction && (
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] uppercase tracking-wider text-white/35">
                      Est. remaining
                    </p>
                    <p className="mt-1 text-lg font-black text-white">
                      {etaPrediction.minutes}m
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Live status */}
        <div className="glass rounded-3xl border border-white/10 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  gpsHealthy ? "bg-emerald-400/10" : "bg-amber-400/10"
                }`}
              >
                {gpsHealthy ? (
                  <Activity size={19} className="text-emerald-300" />
                ) : (
                  <AlertTriangle size={19} className="text-amber-300" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-bold text-white">
                  Real-time telemetry
                </p>
                <p className="text-[10px] text-white/35">
                  Live GPS movement data
                </p>
              </div>
            </div>

            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                gpsHealthy
                  ? "bg-emerald-400/10 text-emerald-300"
                  : "bg-amber-400/10 text-amber-200"
              }`}
            >
              {gpsHealthy ? "Active" : "Reconnecting"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="min-w-0 rounded-2xl bg-white/[0.035] p-3">
              <Wifi size={14} className="text-cyan-300" />
              <p className="mt-2 text-[9px] uppercase tracking-wider text-white/35">
                Tracking
              </p>
              <p className="mt-1 truncate text-xs font-bold text-white/75">
                Continuous
              </p>
            </div>

            <div className="min-w-0 rounded-2xl bg-white/[0.035] p-3">
              <Gauge size={14} className="text-amber-300" />
              <p className="mt-2 text-[9px] uppercase tracking-wider text-white/35">
                Avg speed
              </p>
              <p className="mt-1 truncate text-xs font-bold text-white/75">
                {displayAverageSpeed.toFixed(1)} km/h
              </p>
            </div>

            <div className="min-w-0 rounded-2xl bg-white/[0.035] p-3">
              <Zap size={14} className="text-rose-300" />
              <p className="mt-2 text-[9px] uppercase tracking-wider text-white/35">
                Max speed
              </p>
              <p className="mt-1 truncate text-xs font-bold text-white/75">
                {Math.max(0, maxSpeed).toFixed(1)} km/h
              </p>
            </div>

            <div className="min-w-0 rounded-2xl bg-white/[0.035] p-3">
              <Signal size={14} className={gpsHealthy ? "text-emerald-300" : "text-amber-300"} />
              <p className="mt-2 text-[9px] uppercase tracking-wider text-white/35">
                GPS
              </p>
              <p className="mt-1 truncate text-xs font-bold text-white/75">
                {gpsHealthy ? "Live" : "Signal lost"}
              </p>
            </div>
          </div>

          {signalConfig && (
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/[0.025] px-3 py-2.5">
              <span className="text-xs text-white/40">Measured signal quality</span>
              <div className={`flex items-center gap-2 ${signalConfig.className}`}>
                <SignalBars strength={signalConfig.bars} />
                <span className="text-xs font-bold">{signalConfig.label}</span>
              </div>
            </div>
          )}

          {batteryLevel !== undefined && Number.isFinite(batteryLevel) && (
            <OptionalGauge value={batteryLevel} label="Battery" />
          )}

          {routeQuality !== undefined && Number.isFinite(routeQuality) && (
            <div className="mt-3">
              <OptionalGauge value={routeQuality} label="Route quality" />
            </div>
          )}

          {isBackgroundTracking && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-[10px] text-white/40">
              <CheckCircle2 size={13} className="text-emerald-300" />
              Background tracking is enabled for this trip.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void onEndTrip()}
          className="min-h-14 w-full rounded-2xl border border-rose-300/15 bg-gradient-to-r from-rose-500 to-orange-500 px-5 py-3.5 text-base font-black text-white shadow-lg shadow-rose-950/20 transition active:scale-[0.985]"
        >
          End trip
        </button>

        <div className="flex flex-col gap-2 px-1 text-[10px] text-white/30 sm:flex-row sm:items-center sm:justify-between">
          {startTime ? (
            <span>Started {formatStartTime(startTime)}</span>
          ) : (
            <span>Trip start time unavailable</span>
          )}

          {etaPrediction ? (
            <span>
              Planned arrival around {etaPrediction.arrivalTime.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ) : expectedDurationSeconds && duration >= expectedDurationSeconds ? (
            <span>Original time estimate passed — continuing live tracking</span>
          ) : (
            <span>Live distance and speed are GPS-derived</span>
          )}
        </div>
      </section>
    );
  },
);

TripTracker.displayName = "TripTracker";

export type { TripTrackerProps, SpeedQuality, EtaPrediction };
