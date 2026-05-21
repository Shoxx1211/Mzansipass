// src/components/TripTracker.tsx
// Pulse Transit - Premium Live Trip Tracker Component
// Features: Real-time metrics, ETA predictions, speed quality analysis, network visualization

import React, { useState, useEffect, useMemo, memo } from "react";
import {
  Timer,
  Route,
  Zap,
  Activity,
  MapPinned,
  Wifi,
  Signal,
  Gauge,
  Battery,
  Compass,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Clock} from "lucide-react";

import type { TransitNetwork } from "../types";
import { NETWORK_UI } from "../constants";

// ======================================================
// TYPES
// ======================================================
interface TripTrackerProps {
  network: TransitNetwork | null;
  destination: string;
  distance: number;
  duration: number;
  speed: number;
  maxSpeed?: number;
  startTime?: number;
  expectedDistance?: number;
  routeQuality?: number;
  signalStrength?: 'excellent' | 'good' | 'fair' | 'poor';
  batteryLevel?: number;
  isBackgroundTracking?: boolean;
  onEtaUpdate?: (eta: number) => void;
}

interface SpeedQuality {
  label: string;
  color: string;
  icon: React.ReactNode;
  description: string;
  minSpeed: number;
  maxSpeed: number;
}

interface EtaPrediction {
  minutes: number;
  confidence: 'high' | 'medium' | 'low';
  arrivalTime: Date;
}

// ======================================================
// CONSTANTS
// ======================================================
const SPEED_QUALITIES: SpeedQuality[] = [
  { 
    label: "Express", 
    color: "text-red-400", 
    icon: <Zap size={14} />,
    description: "High-speed travel",
    minSpeed: 70,
    maxSpeed: Infinity
  },
  { 
    label: "Fast", 
    color: "text-emerald-400", 
    icon: <TrendingUp size={14} />,
    description: "Good pace",
    minSpeed: 40,
    maxSpeed: 70
  },
  { 
    label: "Smooth", 
    color: "text-cyan-400", 
    icon: <Activity size={14} />,
    description: "Steady movement",
    minSpeed: 20,
    maxSpeed: 40
  },
  { 
    label: "Moderate", 
    color: "text-yellow-400", 
    icon: <Clock size={14} />,
    description: "Normal traffic pace",
    minSpeed: 10,
    maxSpeed: 20
  },
  { 
    label: "Slow", 
    color: "text-white/40", 
    icon: <AlertTriangle size={14} />,
    description: "Heavy traffic or stops",
    minSpeed: 0,
    maxSpeed: 10
  }
];

const SIGNAL_CONFIG = {
  excellent: { icon: <Signal size={16} className="text-emerald-400" />, label: "Excellent", bars: 4 },
  good: { icon: <Signal size={16} className="text-cyan-400" />, label: "Good", bars: 3 },
  fair: { icon: <Signal size={16} className="text-yellow-400" />, label: "Fair", bars: 2 },
  poor: { icon: <Signal size={16} className="text-red-400" />, label: "Poor", bars: 1 }
};

// ======================================================
// CUSTOM HOOKS
// ======================================================
const useEtaPrediction = (
  distance: number, 
  speed: number, 
  expectedDistance?: number
): EtaPrediction | null => {
  return useMemo(() => {
    if (!speed || speed <= 1 || distance === 0) return null;
    
    const remainingDistance = Math.max(0, (expectedDistance || distance * 1.2) - distance);
    const hoursRemaining = remainingDistance / speed;
    const minutesRemaining = Math.round(hoursRemaining * 60);
    
    if (minutesRemaining === 0 || minutesRemaining > 180) return null;
    
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (speed > 30 && remainingDistance < 5) confidence = 'high';
    if (speed < 10) confidence = 'low';
    
    const arrivalTime = new Date(Date.now() + minutesRemaining * 60000);
    
    return {
      minutes: minutesRemaining,
      confidence,
      arrivalTime
    };
  }, [distance, speed, expectedDistance]);
};

// ======================================================
// SUB-COMPONENTS
// ======================================================
const GaugeMeter: React.FC<{ value: number; max: number; label: string; color: string }> = ({ 
  value, max, label, color 
}) => {
  const percentage = (value / max) * 100;
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-white/40">
        <span>{label}</span>
        <span>{value.toFixed(0)}/{max}</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | null;
  color?: string;
}> = ({ icon, label, value, unit, trend, color = "text-white" }) => (
  <div className="glass rounded-2xl p-4 border border-white/10 hover:border-white/20 transition-all group">
    <div className="flex items-center gap-2 mb-3">
      <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <p className="text-[10px] text-white/40 uppercase tracking-wider">{label}</p>
    </div>
    <div className="flex items-baseline gap-1">
      <p className={`text-3xl font-black ${color}`}>{value}</p>
      {unit && <span className="text-xs text-white/40">{unit}</span>}
      {trend && (
        <span className={`text-xs ml-2 ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
          {trend === 'up' ? '↑' : '↓'}
        </span>
      )}
    </div>
  </div>
);

const SignalBars: React.FC<{ strength: number }> = ({ strength }) => (
  <div className="flex items-end gap-0.5 h-4">
    {[1, 2, 3, 4].map((bar) => (
      <div
        key={bar}
        className="w-1 bg-current rounded-full transition-all"
        style={{ 
          height: `${bar * 3}px`,
          opacity: bar <= strength ? 1 : 0.3,
          backgroundColor: bar <= strength ? 'currentColor' : 'rgba(255,255,255,0.3)'
        }}
      />
    ))}
  </div>
);

// ======================================================
// MAIN COMPONENT
// ======================================================
export const TripTracker = memo<TripTrackerProps>(({
  network,
  destination,
  distance,
  duration,
  speed,
  maxSpeed = 0,
  startTime,
  expectedDistance,
  routeQuality = 85,
  signalStrength = 'good',
  batteryLevel = 85,
  isBackgroundTracking = false,
  onEtaUpdate
}) => {
  const [isAnimating] = useState(true);
  const etaPrediction = useEtaPrediction(distance, speed, expectedDistance);
  
  // Update ETA when prediction changes
  useEffect(() => {
    if (etaPrediction && onEtaUpdate) {
      onEtaUpdate(etaPrediction.minutes);
    }
  }, [etaPrediction, onEtaUpdate]);
  
  // Format duration helper
  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds === 0) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };
  
  // Get speed quality
  const speedQuality = useMemo(() => {
    return SPEED_QUALITIES.find(q => speed >= q.minSpeed && speed < q.maxSpeed) || SPEED_QUALITIES[4];
  }, [speed]);
  
  // Get network UI config
  const networkUI = network ? NETWORK_UI[network] : null;
  
  // Get signal config
  const signalConfig = SIGNAL_CONFIG[signalStrength];
  
  // Calculate progress percentage (assuming average trip is 15km)
  const progressPercentage = Math.min(100, (distance / (expectedDistance || 15)) * 100);
  
  // Calculate average speed from duration and distance
  const avgSpeed = duration > 0 ? (distance / (duration / 3600)) : 0;
  
  // Determine if trip is efficient
  const isEfficient = avgSpeed > 25 && routeQuality > 70;
  
  return (
    <div className="space-y-4 animate-fadeIn">
      {/* ====================================================== */}
      {/* MAIN TRACKER CARD */}
      {/* ====================================================== */}
      <div className={`
        relative overflow-hidden rounded-3xl border-2
        bg-gradient-to-br ${networkUI?.color || 'from-zinc-900 to-black'}
        border-white/20 shadow-2xl
        transition-all duration-300
      `}>
        {/* Live Background Animation */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent animate-pulse" />
        
        {/* Backdrop Blur */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        
        {/* Content */}
        <div className="relative z-10 p-5 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-mono">
                  LIVE TRACKING
                </p>
              </div>
              
              <div className="flex items-center gap-3 mt-3">
                <div className={`
                  relative w-16 h-16 rounded-2xl 
                  bg-white/10 border-2 border-white/20
                  flex items-center justify-center text-3xl
                  transition-all duration-300
                `}>
                  {networkUI?.icon || "🚌"}
                  {isAnimating && (
                    <div className="absolute -inset-1 rounded-2xl bg-cyan-500/20 animate-ping" />
                  )}
                </div>
                
                <div>
                  <h2 className="text-2xl font-black text-white">
                    {network || "Transit"}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={speedQuality.color}>
                      {speedQuality.icon}
                    </span>
                    <p className={`text-sm font-semibold ${speedQuality.color}`}>
                      {speedQuality.label}
                    </p>
                    <p className="text-[10px] text-white/30">
                      {speedQuality.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Live Badge */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                  LIVE
                </span>
              </div>
              {isBackgroundTracking && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/10">
                  <span className="text-[8px] text-white/40">📱 BG</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] text-white/40">
              <span>Journey Progress</span>
              <span>{progressPercentage.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
          
          {/* Destination */}
          <div className="bg-black/30 rounded-2xl p-4 border border-white/10">
            <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2 flex items-center gap-2">
              <MapPinned size={12} />
              DESTINATION
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <MapPinned size={18} className="text-cyan-400" />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold text-white">
                  {destination || "Tracking route..."}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-16 h-1 bg-white/20 rounded-full overflow-hidden">
                    <div className="w-full h-full bg-cyan-400/50 rounded-full animate-pulse" />
                  </div>
                  <p className="text-[10px] text-white/30">GPS locked</p>
                </div>
              </div>
              {etaPrediction && (
                <div className="text-right">
                  <p className="text-[10px] text-white/40">ETA</p>
                  <p className="text-lg font-black text-white">{etaPrediction.minutes}m</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2">
            <MetricCard
              icon={<Route size={16} className="text-cyan-400" />}
              label="Distance"
              value={distance.toFixed(1)}
              unit="km"
              trend={distance > 0 ? 'up' : null}
            />
            <MetricCard
              icon={<Timer size={16} className="text-orange-400" />}
              label="Duration"
              value={formatDuration(duration)}
            />
            <MetricCard
              icon={<Gauge size={16} className="text-yellow-400" />}
              label="Speed"
              value={speed.toFixed(1)}
              unit="km/h"
              color={speedQuality.color}
            />
          </div>
        </div>
      </div>
      
      {/* ====================================================== */}
      {/* LIVE STATUS PANEL */}
      {/* ====================================================== */}
      <div className="glass rounded-2xl p-4 border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Activity size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-white">Real-time Telemetry</p>
              <p className="text-[10px] text-white/40">Live GPS & motion analysis</p>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
            ACTIVE
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Signal size={14} className="text-white/40" />
            <span className="text-xs text-white/70">Signal:</span>
            <div className="flex items-center gap-1 text-emerald-400">
              <SignalBars strength={signalConfig.bars} />
              <span className="text-[10px] ml-1">{signalConfig.label}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Wifi size={14} className="text-white/40" />
            <span className="text-xs text-white/70">Tracking:</span>
            <span className="text-xs text-cyan-400">Continuous</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Battery size={14} className="text-white/40" />
            <span className="text-xs text-white/70">Battery:</span>
            <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-yellow-400 to-green-400 rounded-full"
                style={{ width: `${batteryLevel}%` }}
              />
            </div>
            <span className="text-[10px] text-white/40">{batteryLevel}%</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Compass size={14} className="text-white/40" />
            <span className="text-xs text-white/70">Route:</span>
            <span className="text-xs text-white/60">Optimized</span>
          </div>
        </div>
      </div>
      
      {/* ====================================================== */}
      {/* PERFORMANCE METRICS */}
      {/* ====================================================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/40 uppercase tracking-wider">Journey Analytics</p>
          {isEfficient && (
            <div className="flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-400" />
              <span className="text-[10px] text-emerald-400">Efficient Route</span>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="glass rounded-xl p-3">
            <p className="text-[9px] text-white/40">MAX SPEED</p>
            <p className="text-xl font-black text-white mt-1">{maxSpeed.toFixed(1)} <span className="text-xs text-white/40">km/h</span></p>
          </div>
          <div className="glass rounded-xl p-3">
            <p className="text-[9px] text-white/40">AVG SPEED</p>
            <p className="text-xl font-black text-white mt-1">{avgSpeed.toFixed(1)} <span className="text-xs text-white/40">km/h</span></p>
          </div>
        </div>
        
        <GaugeMeter value={routeQuality} max={100} label="Route Quality" color="bg-gradient-to-r from-cyan-400 to-emerald-400" />
        
        {startTime && (
          <div className="flex items-center justify-between text-[10px] text-white/30 pt-2">
            <span>Started: {new Date(startTime).toLocaleTimeString()}</span>
            {etaPrediction && (
              <span>Est. arrival: {etaPrediction.arrivalTime.toLocaleTimeString()}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

TripTracker.displayName = "TripTracker";

// ======================================================
// EXPORT
// ======================================================
export type { TripTrackerProps, SpeedQuality, EtaPrediction };

// ======================================================
// CSS ANIMATIONS (Add to global CSS)
// ======================================================
// @keyframes fadeIn {
//   from { opacity: 0; transform: translateY(10px); }
//   to { opacity: 1; transform: translateY(0); }
// }
// 
// @keyframes ping {
//   75%, 100% {
//     transform: scale(1.5);
//     opacity: 0;
//   }
// }
// 
// .animate-fadeIn {
//   animation: fadeIn 0.3s ease-out forwards;
// }
// 
// .animate-ping {
//   animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
// }