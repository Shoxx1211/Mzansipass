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

const SearchIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </svg>
);

const HomeIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m3 10 9-7 9 7" />
    <path d="M5 9v12h14V9" />
    <path d="M9 21v-6h6v6" />
  </svg>
);

const WorkIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M3 12h18" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

export const DestinationSearch = ({
  destination,
  setDestination,
  onSearch,
  loading = false,
  userHome,
  userWork,
}: DestinationSearchProps) => {
  const [suggestions] = useState([
    "Sandton",
    "Pretoria",
    "Braamfontein",
    "OR Tambo",
    "Midrand",
  ]);

  const filteredSuggestions =
    destination.length > 1
      ? suggestions.filter((suggestion) =>
          suggestion
            .toLowerCase()
            .includes(destination.toLowerCase())
        )
      : [];

  return (
    <div
      className="
        glass
        w-full
        rounded-2xl
        p-4
        sm:rounded-3xl
        sm:p-5
        md:p-6
      "
    >
      <div className="space-y-4">
        {/* SEARCH INPUT */}

        <div className="relative">
          <div
            className="
              pointer-events-none
              absolute
              left-4
              top-1/2
              z-10
              -translate-y-1/2
              text-white/40
            "
          >
            <SearchIcon />
          </div>

          <input
            type="text"
            value={destination}
            onChange={(event) =>
              setDestination(event.target.value)
            }
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                destination.trim() &&
                !loading
              ) {
                onSearch();
              }
            }}
            placeholder="Where do you want to go?"
            className="
              input-primary
              pl-12
              pr-4
              text-base
              sm:text-lg
            "
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
          />

          {/* SUGGESTIONS */}

          {filteredSuggestions.length > 0 && (
            <div
              className="
                absolute
                left-0
                right-0
                top-[calc(100%+8px)]
                z-30
                space-y-1
                rounded-2xl
                border
                border-white/10
                bg-[#0b1220]/95
                p-2
                shadow-2xl
                backdrop-blur-xl
              "
            >
              {filteredSuggestions.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  onClick={() => {
                    setDestination(suggestion);
                    onSearch();
                  }}
                  className="
                    flex
                    w-full
                    items-center
                    rounded-xl
                    px-4
                    py-3
                    text-left
                    text-sm
                    text-white/80
                    transition
                    hover:bg-white/[0.06]
                    hover:text-white
                  "
                >
                  <SearchIcon />
                  <span className="ml-3">
                    {suggestion}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* HOME / WORK */}

        {(userHome || userWork) && (
          <div className="grid grid-cols-2 gap-3">
            {userHome && (
              <button
                type="button"
                onClick={() => {
                  setDestination(userHome);
                  onSearch();
                }}
                className="
                  flex
                  min-h-12
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  border
                  border-white/10
                  bg-white/[0.04]
                  px-3
                  text-sm
                  font-semibold
                  text-white/75
                  transition
                  hover:bg-white/[0.08]
                  hover:text-white
                  active:scale-[0.98]
                "
              >
                <HomeIcon />
                <span>Home</span>
              </button>
            )}

            {userWork && (
              <button
                type="button"
                onClick={() => {
                  setDestination(userWork);
                  onSearch();
                }}
                className="
                  flex
                  min-h-12
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  border
                  border-white/10
                  bg-white/[0.04]
                  px-3
                  text-sm
                  font-semibold
                  text-white/75
                  transition
                  hover:bg-white/[0.08]
                  hover:text-white
                  active:scale-[0.98]
                "
              >
                <WorkIcon />
                <span>Work</span>
              </button>
            )}
          </div>
        )}

        {/* CONTINUE */}

        <button
          type="button"
          onClick={onSearch}
          disabled={!destination.trim() || loading}
          className="
            btn-primary
            flex
            w-full
            items-center
            justify-center
            gap-2
          "
        >
          <span>
            {loading ? "Finding routes..." : "Find my route"}
          </span>

          {!loading && <ArrowRightIcon />}
        </button>
      </div>
    </div>
  );
};