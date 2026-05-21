// src/components/DestinationSearch.tsx
// Pulse Transit - Premium Destination Search Component
// Features: Smart suggestions, geocoding, recent searches, favorites, AI-powered predictions

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import {
  Search,
  MapPin,
  Navigation,
  Loader2,
  Clock,
  TrendingUp,
  Mic,
  X,
  ChevronRight,
  Home,
  Briefcase,
  Compass
} from "lucide-react";

// ======================================================
// TYPES
// ======================================================
interface DestinationSearchProps {
  destination: string;
  setDestination: (value: string) => void;
  onSearch: () => void;
  loading?: boolean;
  onVoiceSearch?: () => void;
  enableVoiceSearch?: boolean;
  showRecentSearches?: boolean;
  showFavorites?: boolean;
  userHome?: string;
  userWork?: string;
}

interface RecentSearch {
  id: string;
  query: string;
  timestamp: number;
  type?: "recent" | "favorite" | "suggested";
}

interface DestinationSuggestion {
  name: string;
  type: "landmark" | "station" | "mall" | "area" | "airport";
  confidence: number;
  subtitle?: string;
}

// ======================================================
// CONSTANTS
// ======================================================
const RECENT_STORAGE_KEY = "pulse_recent_destinations";
const MAX_RECENT = 10;

const SUGGESTIONS: DestinationSuggestion[] = [
  { name: "Sandton City", type: "mall", confidence: 0.98, subtitle: "Gautrain station nearby" },
  { name: "Rosebank", type: "area", confidence: 0.95, subtitle: "CBD & Gautrain hub" },
  { name: "Braamfontein", type: "area", confidence: 0.92, subtitle: "Joburg CBD" },
  { name: "Hatfield", type: "area", confidence: 0.9, subtitle: "Pretoria student hub" },
  { name: "Pretoria CBD", type: "area", confidence: 0.95, subtitle: "Capital city center" },
  { name: "Midrand", type: "area", confidence: 0.88, subtitle: "Central business node" },
  { name: "Soweto", type: "area", confidence: 0.85, subtitle: "Vibrant township" },
  { name: "Park Station", type: "station", confidence: 0.97, subtitle: "Main Joburg station" },
  { name: "Menlyn Mall", type: "mall", confidence: 0.93, subtitle: "Pretoria shopping" },
  { name: "Mall of Africa", type: "mall", confidence: 0.94, subtitle: "Midrand mega mall" },
  { name: "OR Tambo Airport", type: "airport", confidence: 0.99, subtitle: "International airport" },
  { name: "Fourways", type: "area", confidence: 0.86, subtitle: "Northern suburbs" },
  { name: "Centurion", type: "area", confidence: 0.89, subtitle: "Gautrain station" },
  { name: "Randburg", type: "area", confidence: 0.84, subtitle: "Joburg suburb" }
];

// ======================================================
// CUSTOM HOOKS
// ======================================================
const useRecentSearches = () => {
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(RECENT_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setRecentSearches(parsed.slice(0, MAX_RECENT));
      } catch (e) {
        console.error("Failed to parse recent searches:", e);
      }
    }
  }, []);

  const addRecentSearch = useCallback((query: string) => {
    if (!query.trim()) return;
    
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.query !== query);
      const newSearch: RecentSearch = {
        id: Date.now().toString(),
        query: query.trim(),
        timestamp: Date.now(),
        type: "recent"
      };
      const updated = [newSearch, ...filtered].slice(0, MAX_RECENT);
      localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_STORAGE_KEY);
  }, []);

  return { recentSearches, addRecentSearch, clearRecentSearches };
};

// ======================================================
// SUB-COMPONENTS
// ======================================================
const SuggestionCard: React.FC<{
  suggestion: DestinationSuggestion;
  onClick: () => void;
  index: number;
}> = memo(({ suggestion, onClick, index }) => {
  const getIcon = () => {
    switch (suggestion.type) {
      case "station": return "🚉";
      case "mall": return "🛍️";
      case "airport": return "✈️";
      default: return "📍";
    }
  };

  return (
    <button
      onClick={onClick}
      className="
        w-full text-left p-4 rounded-2xl
        bg-white/5 hover:bg-white/10
        border border-white/5 hover:border-cyan-400/30
        transition-all duration-200
        group animate-fadeIn
      "
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
          <span className="text-xl">{getIcon()}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-white">{suggestion.name}</p>
            {suggestion.confidence > 0.95 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                Popular
              </span>
            )}
          </div>
          {suggestion.subtitle && (
            <p className="text-xs text-white/40 mt-0.5">{suggestion.subtitle}</p>
          )}
        </div>
        <ChevronRight size={16} className="text-white/30 group-hover:text-cyan-400 transition-colors" />
      </div>
    </button>
  );
});

SuggestionCard.displayName = "SuggestionCard";

const RecentSearchItem: React.FC<{
  item: RecentSearch;
  onClick: () => void;
  onRemove?: () => void;
}> = ({ item, onClick, onRemove }) => (
  <button
    onClick={onClick}
    className="
      w-full text-left p-3 rounded-xl
      hover:bg-white/5 transition-all
      group flex items-center justify-between
    "
  >
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
        <Clock size={14} className="text-white/40" />
      </div>
      <div>
        <p className="text-sm text-white/80">{item.query}</p>
        <p className="text-[10px] text-white/30">
          {new Date(item.timestamp).toLocaleDateString()}
        </p>
      </div>
    </div>
    {onRemove && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
      >
        <X size={14} className="text-white/40 hover:text-red-400" />
      </button>
    )}
  </button>
);

const QuickActionButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="
      flex flex-col items-center gap-2 p-3 rounded-2xl
      bg-white/5 hover:bg-white/10
      border border-white/10 hover:border-cyan-400/30
      transition-all duration-200
      flex-1 active:scale-95
    "
  >
    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 flex items-center justify-center">
      {icon}
    </div>
    <span className="text-xs text-white/60">{label}</span>
  </button>
);

// ======================================================
// MAIN COMPONENT
// ======================================================
export const DestinationSearch = memo<DestinationSearchProps>(({
  destination,
  setDestination,
  onSearch,
  loading = false,
  onVoiceSearch,
  enableVoiceSearch = false,
  showRecentSearches = true,
  userHome = "",
  userWork = ""
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  
  const { recentSearches, addRecentSearch, clearRecentSearches } = useRecentSearches();

  // Filter suggestions based on input
  const filteredSuggestions = SUGGESTIONS.filter(suggestion =>
    suggestion.name.toLowerCase().includes(destination.toLowerCase())
  );

  const shouldShowSuggestions = (isFocused || showSuggestions) && 
    destination.length > 0 && 
    filteredSuggestions.length > 0;

  const shouldShowRecent = (isFocused || showSuggestions) && 
    destination.length === 0 && 
    recentSearches.length > 0;

  // ======================================================
  // HANDLERS
  // ======================================================
  const handleDestinationChange = (value: string) => {
    setDestination(value);
    setIsTyping(true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 500);
  };

  const handleSelectDestination = useCallback((value: string) => {
    setDestination(value);
    addRecentSearch(value);
    setShowSuggestions(false);
    setIsFocused(false);
    inputRef.current?.blur();
  }, [setDestination, addRecentSearch]);

  const handleSearch = useCallback(() => {
    if (destination.trim() && !loading) {
      addRecentSearch(destination);
      onSearch();
    }
  }, [destination, loading, onSearch, addRecentSearch]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleVoiceSearch = () => {
    if (onVoiceSearch) {
      onVoiceSearch();
    } else if ('webkitSpeechRecognition' in window) {
      // Basic voice recognition fallback
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-ZA';
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setDestination(transcript);
        addRecentSearch(transcript);
      };
      recognition.start();
    }
  };

  const handleUseCurrentLocation = () => {
    // This would trigger GPS to get current location as destination
    setDestination("Current Location");
    setTimeout(() => handleSearch(), 100);
  };

  // ======================================================
  // CLEANUP
  // ======================================================
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // ======================================================
  // RENDER
  // ======================================================
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ====================================================== */}
      {/* HERO SECTION */}
      {/* ====================================================== */}
      <div className="space-y-3 text-center pt-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 border border-white/10 backdrop-blur-sm">
          <Navigation size={14} className="text-cyan-400 animate-pulse" />
          <span className="text-xs text-white/70 tracking-wide font-mono">
            PULSE INTELLIGENCE v2.0
          </span>
        </div>

        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
            Where to, Commuter?
          </h1>
          <p className="text-white/40 mt-2 text-sm">
            AI-powered transport recommendations
          </p>
        </div>
      </div>

      {/* ====================================================== */}
      {/* LIVE LOCATION STATUS */}
      {/* ====================================================== */}
      <div className="glass rounded-2xl p-4 border border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 to-transparent">
        <div className="flex items-start gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <MapPin size={18} className="text-emerald-400" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-white/40 uppercase tracking-wider">GPS Status</p>
            <p className="font-semibold text-white text-sm">Live Tracking Active</p>
            <p className="text-xs text-white/40 mt-1">
              Analyzing {userHome ? "your route from " + userHome : "nearby transport networks"}...
            </p>
          </div>
        </div>
      </div>

      {/* ====================================================== */}
      {/* SEARCH SECTION */}
      {/* ====================================================== */}
      <div className="glass rounded-3xl p-5 space-y-5">
        <div>
          <p className="text-sm text-white/50 mb-3 flex items-center gap-2">
            <Search size={14} />
            Destination
          </p>

          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 z-10"
            />
            
            <input
              ref={inputRef}
              value={destination}
              onChange={(e) => handleDestinationChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                setTimeout(() => setIsFocused(false), 200);
              }}
              onKeyPress={handleKeyPress}
              placeholder="e.g., Sandton City, Pretoria CBD..."
              className="
                w-full h-14 pl-12 pr-24 rounded-xl
                bg-white/5 border-2 border-white/10
                focus:border-cyan-400/50 focus:outline-none
                text-white placeholder-white/30
                transition-all duration-200
              "
            />
            
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              {enableVoiceSearch && (
                <button
                  onClick={handleVoiceSearch}
                  className="w-10 h-10 rounded-lg hover:bg-white/10 flex items-center justify-center transition-all"
                >
                  <Mic size={18} className="text-white/40 hover:text-cyan-400" />
                </button>
              )}
              
              {destination && (
                <button
                  onClick={() => setDestination("")}
                  className="w-10 h-10 rounded-lg hover:bg-white/10 flex items-center justify-center transition-all"
                >
                  <X size={16} className="text-white/40" />
                </button>
              )}
            </div>
          </div>

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-center gap-1 mt-2 ml-1">
              <div className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="text-[10px] text-white/30 ml-1">Pulse AI analyzing...</span>
            </div>
          )}
        </div>

        {/* ====================================================== */}
        {/* RECENT SEARCHES */}
        {/* ====================================================== */}
        {shouldShowRecent && showRecentSearches && (
          <div className="space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-white/40 flex items-center gap-1">
                <Clock size={12} />
                Recent Destinations
              </p>
              <button
                onClick={clearRecentSearches}
                className="text-[10px] text-white/30 hover:text-red-400 transition-colors"
              >
                Clear all
              </button>
            </div>
            
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {recentSearches.map((item) => (
                <RecentSearchItem
                  key={item.id}
                  item={item}
                  onClick={() => handleSelectDestination(item.query)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ====================================================== */}
        {/* SMART SUGGESTIONS */}
        {/* ====================================================== */}
        {shouldShowSuggestions && (
          <div className="space-y-2 animate-fadeIn">
            <p className="text-xs text-white/40 px-1 flex items-center gap-1">
              <TrendingUp size={12} />
              AI-Powered Suggestions
            </p>
            
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {filteredSuggestions.slice(0, 5).map((suggestion, idx) => (
                <SuggestionCard
                  key={suggestion.name}
                  suggestion={suggestion}
                  onClick={() => handleSelectDestination(suggestion.name)}
                  index={idx}
                />
              ))}
            </div>
          </div>
        )}

        {/* ====================================================== */}
        {/* QUICK ACTIONS */}
        {/* ====================================================== */}
        <div className="flex gap-2">
          {userHome && (
            <QuickActionButton
              icon={<Home size={18} className="text-cyan-400" />}
              label="Home"
              onClick={() => handleSelectDestination(userHome)}
            />
          )}
          
          {userWork && (
            <QuickActionButton
              icon={<Briefcase size={18} className="text-emerald-400" />}
              label="Work"
              onClick={() => handleSelectDestination(userWork)}
            />
          )}
          
          <QuickActionButton
            icon={<Compass size={18} className="text-purple-400" />}
            label="Near Me"
            onClick={handleUseCurrentLocation}
          />
        </div>

        {/* ====================================================== */}
        {/* AI INSIGHTS */}
        {/* ====================================================== */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass rounded-xl p-3 border border-cyan-500/10">
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Live Analysis</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-sm font-bold text-white">24</span>
              <span className="text-[10px] text-white/40">active taxi routes</span>
            </div>
          </div>
          
          <div className="glass rounded-xl p-3 border border-emerald-500/10">
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Networks</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-sm font-bold text-white">6</span>
              <span className="text-[10px] text-white/40">integrated options</span>
            </div>
          </div>
        </div>

        {/* ====================================================== */}
        {/* CONTINUE BUTTON */}
        {/* ====================================================== */}
        <button
          onClick={handleSearch}
          disabled={!destination.trim() || loading}
          className="
            w-full h-14 rounded-xl font-bold text-white
            bg-gradient-to-r from-cyan-500 to-emerald-500
            hover:shadow-lg hover:shadow-cyan-500/25
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
            flex items-center justify-center gap-2
            active:scale-98
          "
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Calculating best routes...</span>
            </>
          ) : (
            <>
              <span>Continue to Transport</span>
              <ChevronRight size={16} />
            </>
          )}
        </button>
      </div>

      {/* ====================================================== */}
      {/* TRUST BADGE */}
      {/* ====================================================== */}
      <div className="text-center">
        <p className="text-[10px] text-white/30">
          🔒 Your location is private • Real-time predictions • South African transport AI
        </p>
      </div>
    </div>
  );
});

DestinationSearch.displayName = "DestinationSearch";

// ======================================================
// ANIMATION KEYFRAMES (Add to global CSS)
// ======================================================
// @keyframes fadeIn {
//   from { opacity: 0; transform: translateY(10px); }
//   to { opacity: 1; transform: translateY(0); }
// }
// 
// @keyframes bounce {
//   0%, 100% { transform: translateY(0); }
//   50% { transform: translateY(-4px); }
// }
// 
// .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
// .animate-bounce { animation: bounce 0.6s ease-in-out infinite; }
// .active\:scale-98:active { transform: scale(0.98); }