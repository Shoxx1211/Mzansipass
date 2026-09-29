// src/components/TripCard.tsx
// Pulse Transit - Premium Trip Card Component
// Features: Multiple variants, swipe gestures, haptic feedback, analytics tracking, share integration

import React, { useState, useRef, memo } from 'react';
import type { TripData, TransitNetwork } from '../types';

// ======================================================
// TYPES
// ======================================================
interface TripCardProps {
  trip: TripData;
  onPress?: (trip: TripData) => void;
  onDelete?: (tripId: string) => void;
  onShare?: (trip: TripData) => void;
  onAnalyze?: (trip: TripData) => void;
  variant?: 'compact' | 'detailed' | 'minimal' | 'premium';
  showActions?: boolean;
  animate?: boolean;
  enableSwipe?: boolean;
  index?: number;
}

interface NetworkIcon {
  icon: string;
  iconActive: string;
  color: string;
  bgColor: string;
  gradient: string;
  description: string;
}

interface SwipeState {
  startX: number;
  currentX: number;
  isSwiping: boolean;
  direction: 'left' | 'right' | null;
}

// ======================================================
// CONSTANTS
// ======================================================
const NETWORK_CONFIG: Record<TransitNetwork, NetworkIcon> = {
  Taxi: {
    icon: '🚖',
    iconActive: '🚖',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    gradient: 'from-yellow-500/20 to-orange-500/20',
    description: 'Minibus taxi - Most flexible'
  },
  Gautrain: {
    icon: '🚆',
    iconActive: '🚆',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    gradient: 'from-blue-500/20 to-cyan-500/20',
    description: 'Premium express rail'
  },
  'Rea Vaya': {
    icon: '🚌',
    iconActive: '🚌',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    gradient: 'from-red-500/20 to-orange-500/20',
    description: 'Joburg BRT system'
  },
  'A Re Yeng': {
    icon: '🚍',
    iconActive: '🚍',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    gradient: 'from-green-500/20 to-emerald-500/20',
    description: 'Pretoria BRT'
  },
  'Tshwane Bus Service': {
    icon: '🚌',
    iconActive: '🚌',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    gradient: 'from-purple-500/20 to-pink-500/20',
    description: 'Tshwane municipal bus'
  },
  Metrorail: {
    icon: '🚂',
    iconActive: '🚂',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    gradient: 'from-orange-500/20 to-red-500/20',
    description: 'PRASA commuter rail'
  },
  Putco: {
    icon: '🚌',
    iconActive: '🚍',
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/20',
    gradient: 'from-sky-500/20 to-blue-500/20',
    description: 'PUTCO commuter bus'
  }
};

export const formatDuration = (seconds?: number): string => {
  if (!seconds || seconds === 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

export const formatDate = (timestamp?: number): string => {
  if (!timestamp) return 'Unknown date';
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  if (compareDate.getTime() === today.getTime()) {
    return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (compareDate.getTime() === yesterday.getTime()) {
    return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// ======================================================
// SUB-COMPONENTS
// ======================================================
const MetricBadge: React.FC<{ icon: string; value: string | number; label?: string; trend?: 'up' | 'down' | null }> = ({ 
  icon, value, label, trend 
}) => (
  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-all group">
    <span className="text-sm group-hover:scale-110 transition-transform">{icon}</span>
    <span className="text-xs font-semibold text-white">{value}</span>
    {label && <span className="text-[10px] text-white/40">{label}</span>}
    {trend && (
      <span className={`text-[10px] ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
        {trend === 'up' ? '↑' : '↓'}
      </span>
    )}
  </div>
);

const FareAccuracyIndicator: React.FC<{ accuracy?: number }> = ({ accuracy }) => {
  if (!accuracy) return null;
  
  const getColor = () => {
    if (accuracy >= 95) return 'text-green-400 bg-green-500/20';
    if (accuracy >= 80) return 'text-yellow-400 bg-yellow-500/20';
    return 'text-red-400 bg-red-500/20';
  };
  
  const getLabel = () => {
    if (accuracy >= 95) return 'Excellent';
    if (accuracy >= 80) return 'Good';
    return 'Needs Review';
  };
  
  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${getColor()}`}>
      <span className="text-[10px]">
        {accuracy >= 95 ? '✓' : accuracy >= 80 ? '≈' : '!'}
      </span>
      <span className="text-[10px] font-medium">{getLabel()}</span>
      <span className="text-[9px] opacity-75">{accuracy.toFixed(0)}%</span>
    </div>
  );
};

const EfficiencyBar: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-[10px] text-white/40">
      <span>{label}</span>
      <span>{value}%</span>
    </div>
    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div 
        className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full transition-all duration-500"
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
);

// ======================================================
// MAIN COMPONENT
// ======================================================
export const TripCard = memo<TripCardProps>(({ 
  trip, 
  onPress, 
  onDelete, 
  onShare,
  onAnalyze,
  variant = 'detailed',
  showActions = true,
  animate = true,
  enableSwipe = false,
  index = 0
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isHaptic] = useState(false);
  const [swipeState, setSwipeState] = useState<SwipeState>({
    startX: 0,
    currentX: 0,
    isSwiping: false,
    direction: null
  });
  
  const cardRef = useRef<HTMLDivElement>(null);
  const longPressTimeout = useRef<NodeJS.Timeout>();
  
  const networkConfig = NETWORK_CONFIG[trip.network] || NETWORK_CONFIG.Taxi;
  const efficiencyScore = Math.min(100, Math.max(0, Math.round(
    ((trip.fareAccuracy || 80) * 0.4) + 
    ((trip.avgSpeed || 30) / 100 * 30) + 
    (trip.distance > 0 ? 20 : 10)
  )));
  
  // ======================================================
  // HAPTIC FEEDBACK
  // ======================================================
  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!isHaptic) return;
    if ('vibrate' in navigator) {
      const patterns = { light: 5, medium: 10, heavy: 20 };
      navigator.vibrate(patterns[type]);
    }
  };
  
  // ======================================================
  // HANDLERS
  // ======================================================
  const handlePress = () => {
    triggerHaptic('light');
    if (variant === 'compact') {
      setIsExpanded(!isExpanded);
    } else if (onPress) {
      onPress(trip);
    }
  };
  
  const handleLongPress = () => {
    if (onAnalyze) {
      triggerHaptic('medium');
      onAnalyze(trip);
    }
  };
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!enableSwipe) return;
    longPressTimeout.current = setTimeout(() => handleLongPress(), 500);
    setSwipeState(prev => ({
      ...prev,
      startX: e.touches[0].clientX,
      isSwiping: true
    }));
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!enableSwipe || !swipeState.isSwiping) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - swipeState.startX;
    
    if (Math.abs(diff) > 30) {
      if (longPressTimeout.current) {
        clearTimeout(longPressTimeout.current);
      }
      setSwipeState(prev => ({
        ...prev,
        currentX,
        direction: diff > 0 ? 'right' : 'left'
      }));
      
      if (cardRef.current) {
        cardRef.current.style.transform = `translateX(${diff * 0.3}px)`;
      }
    }
  };
  
  const handleTouchEnd = () => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
    }
    
    if (cardRef.current) {
      cardRef.current.style.transform = '';
    }
    
    if (swipeState.direction === 'left' && onDelete) {
      triggerHaptic('medium');
      handleDelete();
    } else if (swipeState.direction === 'right' && onShare) {
      triggerHaptic('medium');
      handleShare();
    }
    
    setSwipeState({
      startX: 0,
      currentX: 0,
      isSwiping: false,
      direction: null
    });
  };
  
  const handleDelete = async () => {
    if (onDelete && confirm('Delete this trip from your history?')) {
      setIsDeleting(true);
      triggerHaptic('heavy');
      await onDelete(trip.id);
      setIsDeleting(false);
    }
  };
  
  const handleShare = async () => {
    triggerHaptic('light');
    if (onShare) {
      onShare(trip);
    } else {
      const shareText = `🚆 Pulse Transit Trip\n\n` +
        `Network: ${trip.network}\n` +
        `💰 Fare: ${formatCurrency(trip.fare)}\n` +
        `📏 Distance: ${trip.distance.toFixed(1)} km\n` +
        `⏱ Duration: ${formatDuration(trip.duration)}\n` +
        `⚡ Avg Speed: ${(trip.avgSpeed || 0).toFixed(1)} km/h\n\n` +
        `Track your journeys with Pulse Transit!`;
      
      if (navigator.share) {
        await navigator.share({ title: 'Pulse Trip', text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        alert('Trip details copied to clipboard!');
      }
    }
  };
  
  // ======================================================
  // PREMIUM VARIANT
  // ======================================================
  if (variant === 'premium') {
    return (
      <div 
        ref={cardRef}
        className={`
          relative overflow-hidden rounded-2xl border-2
          transition-all duration-300 animate-slideIn
          ${isDeleting ? 'opacity-50 scale-95' : 'opacity-100'}
          ${animate ? 'hover:scale-[1.02]' : ''}
          bg-gradient-to-br ${networkConfig.gradient}
          border-white/20
        `}
        style={{ animationDelay: `${index * 100}ms` }}
        onClick={handlePress}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent" />
        
        <div className="relative p-5 space-y-4">
          {/* Header with Stats */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-full blur-md bg-cyan-500/30" />
                <div className={`relative w-14 h-14 rounded-full ${networkConfig.bgColor} flex items-center justify-center`}>
                  <span className="text-2xl">{networkConfig.icon}</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`font-black text-xl ${networkConfig.color}`}>
                    {trip.network}
                  </p>
                  {trip.isVerified && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                      Verified
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/50 mt-0.5">{networkConfig.description}</p>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-2xl font-black text-white">
                {formatCurrency(trip.fare)}
              </p>
              <FareAccuracyIndicator accuracy={trip.fareAccuracy} />
            </div>
          </div>
          
          {/* Destination & Route */}
          {trip.destination && (
            <div className="flex items-center gap-2 text-sm bg-black/30 rounded-xl p-3">
              <span className="text-lg">📍</span>
              <div className="flex-1">
                <p className="text-white/60 text-[10px]">Destination</p>
                <p className="text-white font-medium">{trip.destination}</p>
              </div>
              {trip.endTime && (
                <div className="text-right">
                  <p className="text-white/60 text-[10px]">Arrived</p>
                  <p className="text-white text-xs">{new Date(trip.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              )}
            </div>
          )}
          
          {/* Efficiency Score */}
          <div className="bg-black/30 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-white/40">Trip Efficiency Score</p>
              <p className="text-lg font-bold text-white">{efficiencyScore}%</p>
            </div>
            <EfficiencyBar value={efficiencyScore} label="Overall" />
          </div>
          
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-2">
            <MetricBadge icon="📏" value={`${trip.distance.toFixed(1)}`} label="km" />
            <MetricBadge icon="⏱" value={formatDuration(trip.duration)} />
            <MetricBadge icon="⚡" value={`${(trip.avgSpeed || 0).toFixed(1)}`} label="km/h" />
            {trip.stopsDetected && trip.stopsDetected > 0 && (
              <MetricBadge icon="🛑" value={trip.stopsDetected} label="stops" />
            )}
          </div>
          
          {/* Action Buttons */}
          {showActions && (
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleShare}
                className="flex-1 py-2 rounded-xl bg-white/10 text-xs text-white/70 hover:bg-white/20 transition-all active:scale-95"
              >
                Share
              </button>
              {onAnalyze && (
                <button
                  onClick={() => onAnalyze(trip)}
                  className="flex-1 py-2 rounded-xl bg-cyan-500/20 text-xs text-cyan-400 hover:bg-cyan-500/30 transition-all active:scale-95"
                >
                  Analyze
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-2 rounded-xl bg-red-500/10 text-xs text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50 active:scale-95"
              >
                {isDeleting ? '...' : 'Delete'}
              </button>
            </div>
          )}
          
          {/* Swipe Hint */}
          {enableSwipe && (
            <div className="flex justify-center gap-4 pt-1">
              <span className="text-[10px] text-white/20">← Delete</span>
              <span className="text-[10px] text-white/20">Share →</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // ======================================================
  // MINIMAL VARIANT
  // ======================================================
  if (variant === 'minimal') {
    return (
      <div 
        className={`
          flex items-center justify-between p-3 rounded-xl 
          bg-white/5 border border-white/10
          transition-all duration-200
          ${animate ? 'hover:scale-[1.02] active:scale-98' : ''}
          ${isDeleting ? 'opacity-50' : 'opacity-100'}
        `}
        onClick={handlePress}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${networkConfig.bgColor} flex items-center justify-center`}>
            <span className="text-xl">{networkConfig.icon}</span>
          </div>
          <div>
            <p className="font-semibold text-white text-sm">{trip.network}</p>
            <p className="text-xs text-white/40">{formatDate(trip.startTime)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-white">{formatCurrency(trip.fare)}</p>
          <p className="text-xs text-white/40">{trip.distance.toFixed(1)} km</p>
        </div>
      </div>
    );
  }
  
  // ======================================================
  // COMPACT/DETAILED VARIANT
  // ======================================================
  return (
    <div 
      ref={cardRef}
      className={`
        relative overflow-hidden rounded-2xl border transition-all duration-300
        ${isDeleting ? 'opacity-50 scale-95' : 'opacity-100'}
        ${animate ? 'hover:scale-[1.02] active:scale-98' : ''}
        ${isExpanded ? 'bg-white/10 border-cyan-400/30' : 'bg-white/5 border-white/10'}
      `}
      onClick={handlePress}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Background Gradient */}
      <div className={`
        absolute inset-0 bg-gradient-to-r ${networkConfig.gradient} 
        opacity-0 transition-opacity duration-300 
        ${isExpanded ? 'opacity-100' : ''}
      `} />
      
      <div className="relative p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full ${networkConfig.bgColor} flex items-center justify-center`}>
              <span className="text-2xl">{networkConfig.icon}</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`font-bold text-lg ${networkConfig.color}`}>
                  {trip.network}
                </p>
                {trip.isVerified && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                    ✓ Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-white/40">
                {formatDate(trip.startTime)}
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-xl font-black text-white">
              {formatCurrency(trip.fare)}
            </p>
            <FareAccuracyIndicator accuracy={trip.fareAccuracy} />
          </div>
        </div>
        
        {/* Destination */}
        {trip.destination && (
          <div className="flex items-center gap-2 text-sm text-white/70 bg-black/30 rounded-xl p-2">
            <span>📍</span>
            <span className="truncate flex-1">{trip.destination}</span>
            {trip.endTime && (
              <span className="text-[10px] text-white/40">
                {new Date(trip.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}
        
        {/* Metrics Grid */}
        <div className="flex flex-wrap gap-2">
          <MetricBadge icon="📏" value={`${trip.distance.toFixed(1)}`} label="km" />
          <MetricBadge icon="⏱" value={formatDuration(trip.duration)} />
          <MetricBadge icon="⚡" value={`${(trip.avgSpeed || 0).toFixed(1)}`} label="km/h" />
          {trip.stopsDetected && trip.stopsDetected > 0 && (
            <MetricBadge icon="🛑" value={trip.stopsDetected} label="stops" />
          )}
        </div>
        
        {/* Expanded Details */}
        {isExpanded && variant === 'compact' && (
          <div className="pt-3 mt-2 border-t border-white/10 space-y-3 animate-fadeIn">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[10px] text-white/40">Start Time</p>
                <p className="text-white/80 text-xs">{new Date(trip.startTime).toLocaleString()}</p>
              </div>
              {trip.endTime && (
                <div>
                  <p className="text-[10px] text-white/40">End Time</p>
                  <p className="text-white/80 text-xs">{new Date(trip.endTime).toLocaleTimeString()}</p>
                </div>
              )}
              {trip.maxSpeed && trip.maxSpeed > 0 && (
                <div>
                  <p className="text-[10px] text-white/40">Max Speed</p>
                  <p className="text-white/80 text-xs">{trip.maxSpeed.toFixed(1)} km/h</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-white/40">Efficiency</p>
                <p className={`font-semibold text-xs ${efficiencyScore >= 80 ? 'text-green-400' : efficiencyScore >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {efficiencyScore}%
                </p>
              </div>
            </div>
            
            {trip.aiInsights && (
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs">🤖</span>
                  <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">AI Insight</p>
                </div>
                <p className="text-xs text-white/80 leading-relaxed">{trip.aiInsights}</p>
              </div>
            )}
          </div>
        )}
        
        {/* Action Buttons */}
        {showActions && (
          <div className="flex items-center justify-end gap-2 pt-2">
            {onShare && (
              <button
                onClick={handleShare}
                className="px-3 py-1.5 rounded-xl bg-white/10 text-xs text-white/70 hover:bg-white/20 transition-all active:scale-95"
              >
                Share
              </button>
            )}
            {onAnalyze && (
              <button
                onClick={() => onAnalyze(trip)}
                className="px-3 py-1.5 rounded-xl bg-cyan-500/10 text-xs text-cyan-400 hover:bg-cyan-500/20 transition-all active:scale-95"
              >
                Analyze
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-xl bg-red-500/10 text-xs text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50 active:scale-95"
              >
                {isDeleting ? '...' : 'Delete'}
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Swipe Hint Overlay */}
      {enableSwipe && !isExpanded && (
        <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-red-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      )}
    </div>
  );
});

TripCard.displayName = 'TripCard';

// ======================================================
// EXPORT UTILITIES
// ======================================================
export { formatCurrency, NETWORK_CONFIG };
export type { TripCardProps };

// ======================================================
// CSS ANIMATIONS (Add to global CSS)
// ======================================================
// @keyframes slideIn {
//   from {
//     opacity: 0;
//     transform: translateY(20px);
//   }
//   to {
//     opacity: 1;
//     transform: translateY(0);
//   }
// }
// 
// @keyframes fadeIn {
//   from { opacity: 0; transform: translateY(-10px); }
//   to { opacity: 1; transform: translateY(0); }
// }
// 
// .animate-slideIn {
//   animation: slideIn 0.3s ease-out forwards;
// }
// 
// .animate-fadeIn {
//   animation: fadeIn 0.2s ease-out forwards;
// }
// 
// .active\:scale-95:active {
//   transform: scale(0.95);
// }