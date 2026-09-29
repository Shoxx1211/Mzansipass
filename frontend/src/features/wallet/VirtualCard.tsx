// src/components/VirtualCard.tsx
// Pulse Transit - Premium Interactive Journey Card
// Features: 3D tilt effect, real-time metrics, animated transitions, compact mode

import React, { useEffect, useMemo, useRef, useState, memo } from "react";
import { TripState } from "../../types";
import type { TransitNetwork } from "../../types";

// ======================================================
// TYPES
// ======================================================

interface VirtualCardProps {
  state: TripState;
  network: TransitNetwork | null;
  distance: number;
  duration: number;
  destination?: string;
  estimatedFare?: number;
  lastTrip?: {
    distance: number;
    network: string;
    fare: number;
    date?: number;
  };
  variant?: 'full' | 'compact' | 'minimal';
  showTilt?: boolean;
  className?: string;
}

// ======================================================
// NETWORK THEMES
// ======================================================

const NETWORK_THEME: Record<TransitNetwork, { gradient: string; accent: string; icon: string }> = {
  Taxi: {
    gradient: "from-amber-500/30 to-orange-500/10",
    accent: "text-amber-400",
    icon: "🚖"
  },
  Gautrain: {
    gradient: "from-blue-500/30 to-cyan-500/10",
    accent: "text-blue-400",
    icon: "🚆"
  },
  "Rea Vaya": {
    gradient: "from-emerald-500/30 to-green-500/10",
    accent: "text-emerald-400",
    icon: "🚌"
  },
  "A Re Yeng": {
    gradient: "from-purple-500/30 to-fuchsia-500/10",
    accent: "text-purple-400",
    icon: "🚍"
  },
  "Tshwane Bus Service": {
    gradient: "from-sky-500/30 to-indigo-500/10",
    accent: "text-sky-400",
    icon: "🚌"
  },
  Metrorail: {
    gradient: "from-zinc-500/30 to-zinc-800/10",
    accent: "text-zinc-400",
    icon: "🚂"
  }
} as const;

const DEFAULT_THEME = {
  gradient: "from-cyan-500/20 to-emerald-500/10",
  accent: "text-cyan-400",
  icon: "🚀"
};

// ======================================================
// CUSTOM HOOK: TILT EFFECT
// ======================================================

const useTiltEffect = (enabled: boolean = true) => {
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  const updateRotation = (x: number, y: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setRotation({ x, y }));
  };

  const handleMove = (clientX: number, clientY: number, rect: DOMRect) => {
    if (!enabled) return;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    updateRotation((centerY - y) / 25, (x - centerX) / 25);
  };

  const resetTilt = () => {
    if (!enabled) return;
    updateRotation(0, 0);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { rotation, handleMove, resetTilt };
};

// ======================================================
// SUB-COMPONENTS
// ======================================================

const Metric: React.FC<{
  label: string;
  value: string;
  icon?: React.ReactNode;
  highlight?: boolean;
  trend?: 'up' | 'down' | null;
}> = ({ label, value, icon, highlight, trend }) => (
  <div className="rounded-xl bg-white/5 border border-white/10 p-3 group hover:bg-white/10 transition-all">
    <div className="flex items-center gap-1.5 mb-1">
      {icon && <span className="text-white/40">{icon}</span>}
      <p className="text-[9px] uppercase tracking-wider text-white/40">{label}</p>
      {trend && (
        <span className={`text-[9px] ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
          {trend === 'up' ? '↑' : '↓'}
        </span>
      )}
    </div>
    <p className={`text-base font-bold ${highlight ? 'text-emerald-400' : 'text-white'}`}>
      {value}
    </p>
  </div>
);

const SpeedIndicator: React.FC<{ speed: number }> = ({ speed }) => {
  const getSpeedStatus = () => {
    if (speed >= 70) return { label: "Fast", color: "text-red-400", icon: "⚡" };
    if (speed >= 40) return { label: "Cruising", color: "text-emerald-400", icon: "🚀" };
    if (speed >= 20) return { label: "Moderate", color: "text-cyan-400", icon: "🚗" };
    if (speed > 0) return { label: "Slow", color: "text-yellow-400", icon: "🐢" };
    return { label: "Stopped", color: "text-white/40", icon: "⏸️" };
  };

  const status = getSpeedStatus();

  return (
    <div className="flex items-center gap-1.5">
      <span className={status.color}>{status.icon}</span>
      <span className={`text-xs font-semibold ${status.color}`}>{status.label}</span>
    </div>
  );
};

// ======================================================
// MAIN COMPONENT
// ======================================================

export const VirtualCard = memo<VirtualCardProps>(({
  state,
  network,
  distance = 0,
  duration = 0,
  destination,
  estimatedFare,
  lastTrip,
  variant = 'compact',
  showTilt = true,
  className = ""
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const { rotation, handleMove, resetTilt } = useTiltEffect(showTilt && variant !== 'minimal');

  // ======================================================
  // DERIVED VALUES
  // ======================================================
  const theme = network && NETWORK_THEME[network] ? NETWORK_THEME[network] : DEFAULT_THEME;
  
  const speed = useMemo(() => {
    if (!distance || !duration || duration < 10) return 0;
    const calculated = distance / (duration / 3600);
    if (!Number.isFinite(calculated) || calculated < 0 || calculated > 180) return 0;
    return calculated;
  }, [distance, duration]);

  const formatTime = (seconds: number): string => {
    if (!seconds) return "0m";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const statusText = state === TripState.ACTIVE ? "Journey Active" : state === TripState.PLANNING ? "Ready To Travel" : "Ready";
  const isActive = state === TripState.ACTIVE;

  // ======================================================
  // EVENT HANDLERS WITH REF
  // ======================================================
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cardRef.current) {
      handleMove(e.clientX, e.clientY, cardRef.current.getBoundingClientRect());
    }
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (touch && cardRef.current) {
      handleMove(touch.clientX, touch.clientY, cardRef.current.getBoundingClientRect());
    }
  };

  // ======================================================
  // MINIMAL VARIANT
  // ======================================================
  if (variant === 'minimal') {
    return (
      <div className={`glass rounded-xl p-3 border border-white/10 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{theme.icon}</span>
            <div>
              <p className="text-sm font-semibold text-white">{network || "Ready"}</p>
              <p className="text-[10px] text-white/40">{statusText}</p>
            </div>
          </div>
          {isActive && (
            <div className="text-right">
              <p className="text-lg font-black text-white">{distance.toFixed(1)}<span className="text-xs">km</span></p>
              <p className="text-[10px] text-white/40">{formatTime(duration)}</p>
            </div>
          )}
          {!isActive && estimatedFare && (
            <div className="text-right">
              <p className="text-lg font-black text-emerald-400">R{estimatedFare.toFixed(2)}</p>
              <p className="text-[10px] text-white/40">est. fare</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ======================================================
  // COMPACT VARIANT (Default - Non-intrusive)
  // ======================================================
  return (
    <div
      ref={cardRef}
      className={`relative w-full ${className}`}
      style={{ perspective: showTilt ? "1200px" : "none" }}
      onMouseMove={onMouseMove}
      onTouchMove={onTouchMove}
      onMouseLeave={resetTilt}
      onTouchEnd={resetTilt}
    >
      {/* Glow Effect */}
      <div className={`absolute inset-0 rounded-2xl blur-xl opacity-30 bg-gradient-to-br ${theme.gradient}`} />
      
      {/* Main Card */}
      <div
        className={`
          relative overflow-hidden rounded-2xl
          border border-white/10
          transition-all duration-200
          will-change-transform
          bg-black/40 backdrop-blur-sm
        `}
        style={{
          transform: showTilt ? `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` : "none"
        }}
      >
        {/* Gradient Background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-30`} />
        
        {/* Content */}
        <div className="relative z-10 p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{theme.icon}</span>
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider">Current Journey</p>
                <h3 className="text-lg font-bold text-white">{network || "Select Transport"}</h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isActive && <SpeedIndicator speed={speed} />}
              <div className="px-2 py-0.5 rounded-full bg-white/10 text-[9px] text-white/60">
                {statusText}
              </div>
            </div>
          </div>

          {/* Destination */}
          {destination && (
            <div className="mb-3 flex items-center gap-2 text-sm bg-white/5 rounded-xl p-2">
              <span className="text-cyan-400">📍</span>
              <span className="text-white/80 text-sm truncate flex-1">{destination}</span>
              {isActive && (
                <span className="text-[10px] text-white/40">ETA: ~{Math.round(distance / Math.max(speed, 1) * 60)}m</span>
              )}
            </div>
          )}

          {/* Metrics Grid */}
          <div className="grid grid-cols-4 gap-2">
            <Metric 
              label="Distance" 
              value={`${distance.toFixed(1)} km`}
              icon="📏"
            />
            <Metric 
              label="Duration" 
              value={formatTime(duration)}
              icon="⏱️"
            />
            <Metric 
              label="Speed" 
              value={`${speed.toFixed(0)} km/h`}
              icon="⚡"
              trend={speed > 0 ? 'up' : null}
            />
            <Metric 
              label="Fare" 
              value={estimatedFare ? `R${estimatedFare.toFixed(2)}` : "--"}
              icon="💰"
              highlight={!!estimatedFare}
            />
          </div>

          {/* Footer */}
          {lastTrip && !isActive && (
            <div className="mt-3 pt-2 border-t border-white/10 flex justify-between text-[10px] text-white/30">
              <span>Last trip: {lastTrip.network}</span>
              <span>R{lastTrip.fare.toFixed(2)} • {lastTrip.distance.toFixed(1)} km</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

VirtualCard.displayName = "VirtualCard";

export type { VirtualCardProps };