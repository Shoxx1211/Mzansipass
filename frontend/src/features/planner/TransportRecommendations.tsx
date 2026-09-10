// src/components/TransportRecommendation.tsx
// Pulse Transit - Premium Transport Recommendation Component
// Features: Smart sorting, filtering, animations, accessibility, detailed metrics

import React, { useState, useMemo, memo } from "react";
import {
  Clock3,
  Footprints,
  ShieldCheck,
  Wallet,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Filter,
  TrendingUp,
  Award,
  Navigation
} from "lucide-react";

import {
  type TransportRecommendation as RecommendationType
} from "../../types";

// ======================================================
// TYPES
// ======================================================

interface TransportRecommendationProps {
  recommendations: RecommendationType[];
  selected: RecommendationType | null;
  onSelect: (recommendation: RecommendationType) => void;
  onCompare?: (recommendations: RecommendationType[]) => void;
  showFilters?: boolean;
  showComparison?: boolean;
  isLoading?: boolean;
  className?: string;
}

type SortOption = "best" | "fastest" | "cheapest" | "safest" | "leastWalking";
type FilterOption = "all" | "taxi" | "train" | "bus";

// ======================================================
// CONSTANTS
// ======================================================

const SORT_OPTIONS: { value: SortOption; label: string; icon: React.ReactNode }[] = [
  { value: "best", label: "Best Overall", icon: <Award size={14} /> },
  { value: "fastest", label: "Fastest", icon: <Clock3 size={14} /> },
  { value: "cheapest", label: "Cheapest", icon: <Wallet size={14} /> },
  { value: "safest", label: "Safest", icon: <ShieldCheck size={14} /> },
  { value: "leastWalking", label: "Least Walk", icon: <Footprints size={14} /> }
];

const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
  { value: "all", label: "All" },
  { value: "taxi", label: "Taxi" },
  { value: "train", label: "Train" },
  { value: "bus", label: "Bus" }
];

// ======================================================
// HELPER FUNCTIONS
// ======================================================


const getBadgeColor = (badge: string): string => {
  switch (badge) {
    case "FASTEST":
      return "text-cyan-400 bg-cyan-500/10";
    case "CHEAPEST":
      return "text-yellow-400 bg-yellow-500/10";
    case "BEST_OVERALL":
      return "text-emerald-400 bg-emerald-500/10";
    case "SAFEST":
      return "text-violet-400 bg-violet-500/10";
    case "LEAST_WALKING":
      return "text-pink-400 bg-pink-500/10";
    case "RELIABLE":
      return "text-orange-400 bg-orange-500/10";
    default:
      return "text-white/50 bg-white/5";
  }
};

const formatBadge = (badge: string): string => {
  return badge.replaceAll("_", " ").toUpperCase();
};

const getModeIcon = (mode: string): string => {
  switch (mode) {
    case "Taxi": return "🚖";
    case "Gautrain": return "🚅";
    case "Metrorail": return "🚂";
    case "Rea Vaya": return "🚌";
    case "A Re Yeng": return "🚍";
    default: return "🚌";
  }
};

// ======================================================
// SUB-COMPONENTS
// ======================================================

const RecommendationCard: React.FC<{
  recommendation: RecommendationType;
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}> = memo(({ recommendation, isSelected, onSelect, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <button
      onClick={onSelect}
      className={`
        w-full text-left
        glass rounded-2xl p-5
        transition-all duration-300
        border-2
        animate-fadeIn
        ${isSelected 
          ? "border-cyan-400/50 bg-cyan-500/5 scale-[1.01]" 
          : "border-white/10 hover:border-white/20 hover:scale-[1.01]"
        }
      `}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {/* Icon with glow */}
          <div className={`
            relative w-14 h-14 rounded-2xl 
            flex items-center justify-center
            transition-all duration-300
            ${isSelected ? 'bg-cyan-500/20' : 'bg-white/10'}
          `}>
            <div className={`
              absolute inset-0 rounded-2xl blur-xl
              ${isSelected ? 'bg-cyan-500/30' : 'bg-transparent'}
            `} />
            <span className="text-2xl">{getModeIcon(recommendation.mode)}</span>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-lg text-white">
                {recommendation.mode}
              </p>
 {recommendation.badges.map((badge) => (
  <span
    key={badge}
    className={`
      text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full
      ${getBadgeColor(badge)}
    `}
  >
    {formatBadge(badge)}
  </span>
))}
            </div>
            
            <p className="text-sm text-white/50 mt-0.5">
              {recommendation.routeName}
            </p>
            
            {recommendation.subtitle && (
              <p className="text-xs text-white/40 mt-0.5 flex items-center gap-1">
                <Navigation size={10} />
                {recommendation.subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSelected && (
            <CheckCircle2 size={22} className="text-cyan-400 animate-scaleIn" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-1 rounded-lg hover:bg-white/10 transition-all"
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* AI Reason */}
      <div className="mt-4 bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 rounded-xl p-4 border border-white/5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} className="text-cyan-400" />
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
            AI INSIGHT
          </p>
        </div>
        <p className="text-sm leading-relaxed text-white/80">
          {recommendation.reason}
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-3 mt-5">
        <div className="bg-white/5 rounded-xl p-3 text-center hover:bg-white/10 transition-all">
          <div className="flex items-center justify-center gap-1 text-[10px] text-white/40 mb-1">
            <Clock3 size={11} />
            <span>TIME</span>
          </div>
          <p className="font-bold text-base text-white">
            {recommendation.estimatedTime}
            <span className="text-xs text-white/40">m</span>
          </p>
        </div>

        <div className="bg-white/5 rounded-xl p-3 text-center hover:bg-white/10 transition-all">
          <div className="flex items-center justify-center gap-1 text-[10px] text-white/40 mb-1">
            <Wallet size={11} />
            <span>COST</span>
          </div>
          <p className="font-bold text-base text-white">
            R{recommendation.estimatedFare.toFixed(0)}
          </p>
        </div>

        <div className="bg-white/5 rounded-xl p-3 text-center hover:bg-white/10 transition-all">
          <div className="flex items-center justify-center gap-1 text-[10px] text-white/40 mb-1">
            <Footprints size={11} />
            <span>WALK</span>
          </div>
          <p className="font-bold text-base text-white">
            {recommendation.walkingDistance}
            <span className="text-xs text-white/40">m</span>
          </p>
        </div>

        <div className="bg-white/5 rounded-xl p-3 text-center hover:bg-white/10 transition-all">
          <div className="flex items-center justify-center gap-1 text-[10px] text-white/40 mb-1">
            <ShieldCheck size={11} />
            <span>SAFETY</span>
          </div>
          <p className="font-bold text-base text-white">
            {Math.round(recommendation.reliabilityScore || 85)}
            <span className="text-xs text-white/40">%</span>
          </p>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-white/10 space-y-3 animate-fadeIn">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] text-white/40">Affordability Score</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full"
                    style={{ width: `${(recommendation.affordabilityScore || 80)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold">{recommendation.affordabilityScore || 80}%</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-white/40">Speed Score</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full"
                    style={{ width: `${(recommendation.speedScore || 75)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold">{recommendation.speedScore || 75}%</span>
              </div>
            </div>
          </div>

          {recommendation.confidence && (
            <div className="flex items-center gap-2 text-[10px] text-white/40">
              <Sparkles size={10} />
              <span>AI Confidence: {(recommendation.confidence * 100).toFixed(0)}%</span>
            </div>
          )}
        </div>
      )}
    </button>
  );
});

RecommendationCard.displayName = "RecommendationCard";

// ======================================================
// MAIN COMPONENT
// ======================================================

export const TransportRecommendation = memo<TransportRecommendationProps>(({
  recommendations,
  selected,
  onSelect,
  onCompare,
  showFilters = true,
  showComparison = true,
  isLoading = false,
  className = ""
}) => {
  const [sortBy, setSortBy] = useState<SortOption>("best");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Filter and sort recommendations
  const processedRecommendations = useMemo(() => {
    let filtered = [...recommendations];

    // Apply filters
    if (filterBy !== "all") {
      filtered = filtered.filter(rec => {
        if (filterBy === "taxi") return rec.mode === "Taxi";
        if (filterBy === "train") return rec.mode === "Gautrain" || rec.mode === "Metrorail";
        if (filterBy === "bus") return rec.mode === "Rea Vaya" || rec.mode === "A Re Yeng";
        return true;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "fastest":
          return a.estimatedTime - b.estimatedTime;
        case "cheapest":
          return a.estimatedFare - b.estimatedFare;
        case "safest":
          return (b.reliabilityScore || 0) - (a.reliabilityScore || 0);
        case "leastWalking":
          return a.walkingDistance - b.walkingDistance;
        case "best":
        default:
          return (b.score || 0) - (a.score || 0);
      }
    });

    return filtered;
  }, [recommendations, sortBy, filterBy]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="glass rounded-2xl p-8 text-center">
          <div className="animate-pulse space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-cyan-500/20" />
            <div className="h-4 bg-white/10 rounded w-3/4 mx-auto" />
            <div className="h-3 bg-white/5 rounded w-1/2 mx-auto" />
          </div>
          <p className="text-white/50 text-sm mt-4">Analyzing best routes...</p>
        </div>
      </div>
    );
  }

  if (!recommendations.length) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-white/10 flex items-center justify-center mb-4">
          <Navigation size={32} className="text-white/30" />
        </div>
        <p className="text-white/50">No recommendations found</p>
        <p className="text-xs text-white/30 mt-2">Try a different destination</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 flex items-center justify-center">
            <Sparkles size={18} className="text-cyan-400" />
          </div>
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">
              AI JOURNEY ENGINE
            </p>
            <h2 className="text-lg font-bold text-white">
              Recommended Routes
            </h2>
          </div>
        </div>

        {showFilters && (
          <div className="flex items-center gap-2">
            {/* Sort Button */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowSortMenu(!showSortMenu);
                  setShowFilterMenu(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-white/10 text-xs text-white/70 flex items-center gap-1"
              >
                <TrendingUp size={12} />
                Sort
                <ChevronDown size={10} />
              </button>
              
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-2 w-40 glass rounded-xl p-2 z-10 animate-fadeIn">
                  {SORT_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSortBy(option.value);
                        setShowSortMenu(false);
                      }}
                      className={`
                        w-full text-left px-3 py-2 rounded-lg text-xs
                        transition-all flex items-center gap-2
                        ${sortBy === option.value ? 'bg-cyan-500/20 text-cyan-400' : 'text-white/70 hover:bg-white/10'}
                      `}
                    >
                      {option.icon}
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter Button */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowFilterMenu(!showFilterMenu);
                  setShowSortMenu(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-white/10 text-xs text-white/70 flex items-center gap-1"
              >
                <Filter size={12} />
                Filter
                <ChevronDown size={10} />
              </button>
              
              {showFilterMenu && (
                <div className="absolute right-0 top-full mt-2 w-32 glass rounded-xl p-2 z-10 animate-fadeIn">
                  {FILTER_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setFilterBy(option.value);
                        setShowFilterMenu(false);
                      }}
                      className={`
                        w-full text-left px-3 py-2 rounded-lg text-xs
                        transition-all
                        ${filterBy === option.value ? 'bg-cyan-500/20 text-cyan-400' : 'text-white/70 hover:bg-white/10'}
                      `}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] text-white/40">
          {processedRecommendations.length} route{processedRecommendations.length !== 1 ? 's' : ''} found
        </p>
        {showComparison && processedRecommendations.length > 1 && onCompare && (
          <button
            onClick={() => onCompare(processedRecommendations)}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Compare All
          </button>
        )}
      </div>

      {/* Recommendations List */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {processedRecommendations.map((recommendation, idx) => (
          <RecommendationCard
            key={recommendation.id}
            recommendation={recommendation}
            isSelected={selected?.id === recommendation.id}
            onSelect={() => onSelect(recommendation)}
            index={idx}
          />
        ))}
      </div>

      {/* AI Disclaimer */}
      <p className="text-[10px] text-white/20 text-center px-4">
        Recommendations based on real-time data and AI analysis
      </p>
    </div>
  );
});

TransportRecommendation.displayName = "TransportRecommendation";

// ======================================================
// EXPORT TYPES
// ======================================================
export type { SortOption, FilterOption };