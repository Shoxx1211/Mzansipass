// src/components/DestinationSearch.tsx
import { useState } from "react";

interface DestinationSearchProps {
  destination: string;
  setDestination: (value: string) => void;
  onSearch: () => void;
  loading?: boolean;
  enableVoiceSearch?: boolean;
  showRecentSearches?: boolean;
  showFavorites?: boolean;
  userHome?: string;
  userWork?: string;
}

export const DestinationSearch = ({
  destination,
  setDestination,
  onSearch,
  loading = false,
  userHome,
  userWork
}: DestinationSearchProps) => {
  const [suggestions] = useState(["Sandton", "Pretoria", "Braamfontein", "OR Tambo", "Midrand"]);

  const filteredSuggestions = destination.length > 1 
    ? suggestions.filter(s => s.toLowerCase().includes(destination.toLowerCase()))
    : [];

  return (
    <div className="glass rounded-3xl p-5 md:p-6 space-y-5 relative w-full max-w-2xl mx-auto pb-2">
      {/* Search Input */}
      <div className="space-y-2 relative">
        <div className="absolute left-4 top-[18px] text-white/40 z-10">
  🔍
</div>
        <input
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          placeholder="e.g., Sandton, Pretoria..."
          className="
  input-primary text-lg pl-12
"
        //autoFocus if tapping still fails, if not then this was the problem
          autoComplete="off"
  autoCorrect="off"
  spellCheck={false}
          enterKeyHint="search"
        />
        
        {/* Suggestions */}
        {filteredSuggestions.length > 0 && (
          <div className="space-y-2 animate-fadeIn">
            {filteredSuggestions.map(s => (
              <button
                key={s}
                onClick={() => {
                  setDestination(s);
                  onSearch();
                }}
                className="
  w-full p-3 text-left
  rounded-xl
  glass hover:scale-[1.01]
  hover:bg-white/10
  text-white
  transition
"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions - Home/Work shortcuts */}
      {(userHome || userWork) && (
        <div className="flex gap-2">
          {userHome && (
            <button
              onClick={() => {
                setDestination(userHome);
                onSearch();
              }}
              className="
  flex-1
  py-3
  rounded-2xl
  glass
  text-sm
  font-semibold
  hover:scale-[1.02]
  active:scale-[0.98]
  transition
"
            >
              🏠 Home
            </button>
          )}
          {userWork && (
            <button
              onClick={() => {
                setDestination(userWork);
                onSearch();
              }}
              className="
  flex-1
  py-3
  rounded-2xl
  glass
  text-sm
  font-semibold
  hover:scale-[1.02]
  active:scale-[0.98]
  transition
"
            >
              💼 Work
            </button>
          )}
        </div>
      )}

      {/* Continue Button */}
    <button
  type="button"
  onClick={onSearch}
  disabled={!destination.trim() || loading}
  className="
    relative 
    w-full h-14
    rounded-xl
    bg-gradient-to-r
    from-cyan-500
    to-emerald-500
    text-white
    font-bold
    text-lg
    active:scale-95
    transition
    disabled:opacity-50
    pointer-events-auto
  "
>
  {loading ? "Loading..." : "Continue →"}
</button>
    </div>
  );
}