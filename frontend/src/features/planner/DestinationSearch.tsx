// src/components/DestinationSearch.tsx
// Pulse Transit - production destination search
//
// Features:
// - Real South African place autocomplete through Mapbox when configured
// - Commuter-focused fallback destinations for development/offline use
// - Recent destinations and favourites
// - Home / Work shortcuts
// - Keyboard navigation
// - Voice search where supported
// - Resolved destination coordinates stored for the route engine
//
// Add this to frontend/.env for real place autocomplete:
// VITE_MAPBOX_TOKEN=your_public_mapbox_token

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

interface Location {
  lat: number;
  lng: number;
}

export interface DestinationPlace {
  id: string;
  name: string;
  label: string;
  lat?: number;
  lng?: number;
  category?: string;
  source:
    | "mapbox"
    | "pulse"
    | "recent"
    | "favorite"
    | "home"
    | "work"
    | "manual";
}

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

  // Optional now; pass location.location later for proximity-ranked suggestions.
  currentLocation?: Location | null;

  // Optional now; App.tsx can use this later to receive destination coordinates directly.
  onDestinationResolved?: (place: DestinationPlace) => void;
}

interface MapboxFeature {
  id: string;
  text?: string;
  place_name?: string;
  center?: [number, number];
  place_type?: string[];
  properties?: {
    category?: string;
  };
}

interface MapboxResponse {
  features?: MapboxFeature[];
}

interface StoredDestination {
  id: string;
  name: string;
  label: string;
  lat?: number;
  lng?: number;
  category?: string;
  timestamp: number;
}

interface SpeechRecognitionEventLike {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const RECENT_KEY = "pulse_recent_destinations_v1";
const FAVORITES_KEY = "pulse_favorite_destinations_v1";
const SELECTED_DESTINATION_KEY = "pulse_selected_destination_v1";
const MAX_RECENTS = 6;

/*
 * Fallback labels only. Real coordinates come from the configured geocoder.
 * This prevents Pulse from pretending approximate hard-coded coordinates are
 * precise enough for fare and route calculations.
 */
const PULSE_DESTINATIONS: DestinationPlace[] = [
  { id: "braamfontein", name: "Braamfontein", label: "Braamfontein, Johannesburg, Gauteng", category: "Commuter hub", source: "pulse" },
  { id: "park-station", name: "Park Station", label: "Park Station, Johannesburg, Gauteng", category: "Rail & bus station", source: "pulse" },
  { id: "johannesburg-cbd", name: "Johannesburg CBD", label: "Johannesburg CBD, Gauteng", category: "City centre", source: "pulse" },
  { id: "sandton", name: "Sandton", label: "Sandton, Johannesburg, Gauteng", category: "Business district", source: "pulse" },
  { id: "sandton-gautrain", name: "Sandton Gautrain Station", label: "Sandton Gautrain Station, Sandton, Gauteng", category: "Gautrain station", source: "pulse" },
  { id: "rosebank", name: "Rosebank", label: "Rosebank, Johannesburg, Gauteng", category: "Business & retail district", source: "pulse" },
  { id: "rosebank-gautrain", name: "Rosebank Gautrain Station", label: "Rosebank Gautrain Station, Johannesburg, Gauteng", category: "Gautrain station", source: "pulse" },
  { id: "midrand", name: "Midrand", label: "Midrand, Gauteng", category: "Commuter hub", source: "pulse" },
  { id: "midrand-gautrain", name: "Midrand Gautrain Station", label: "Midrand Gautrain Station, Gauteng", category: "Gautrain station", source: "pulse" },
  { id: "pretoria", name: "Pretoria", label: "Pretoria, Gauteng", category: "City", source: "pulse" },
  { id: "pretoria-station", name: "Pretoria Station", label: "Pretoria Station, Pretoria, Gauteng", category: "Rail station", source: "pulse" },
  { id: "hatfield", name: "Hatfield", label: "Hatfield, Pretoria, Gauteng", category: "Student & commuter hub", source: "pulse" },
  { id: "hatfield-gautrain", name: "Hatfield Gautrain Station", label: "Hatfield Gautrain Station, Pretoria, Gauteng", category: "Gautrain station", source: "pulse" },
  { id: "centurion", name: "Centurion", label: "Centurion, Gauteng", category: "Commuter hub", source: "pulse" },
  { id: "or-tambo", name: "OR Tambo International Airport", label: "OR Tambo International Airport, Gauteng", category: "Airport & Gautrain", source: "pulse" },
  { id: "soweto", name: "Soweto", label: "Soweto, Johannesburg, Gauteng", category: "Major commuter area", source: "pulse" },
  { id: "bara", name: "Chris Hani Baragwanath Hospital", label: "Chris Hani Baragwanath Academic Hospital, Soweto, Gauteng", category: "Hospital", source: "pulse" },
  { id: "uj-apk", name: "University of Johannesburg APK", label: "University of Johannesburg Auckland Park Kingsway Campus", category: "University", source: "pulse" },
  { id: "wits", name: "University of the Witwatersrand", label: "Wits University, Braamfontein, Johannesburg", category: "University", source: "pulse" },
  { id: "cape-town-cbd", name: "Cape Town CBD", label: "Cape Town, Western Cape", category: "City centre", source: "pulse" },
  { id: "cape-town-station", name: "Cape Town Station", label: "Cape Town Station, Cape Town, Western Cape", category: "Rail & bus station", source: "pulse" },
  { id: "durban-cbd", name: "Durban CBD", label: "Durban, KwaZulu-Natal", category: "City centre", source: "pulse" },
  { id: "durban-station", name: "Durban Station", label: "Durban Station, Durban, KwaZulu-Natal", category: "Rail station", source: "pulse" },
  { id: "bloemfontein-cbd", name: "Bloemfontein CBD", label: "Bloemfontein, Free State", category: "City centre", source: "pulse" },
  { id: "gqeberha-cbd", name: "Gqeberha CBD", label: "Gqeberha, Eastern Cape", category: "City centre", source: "pulse" },
  { id: "mbombela-cbd", name: "Mbombela CBD", label: "Mbombela, Mpumalanga", category: "City centre", source: "pulse" },
  { id: "polokwane-cbd", name: "Polokwane CBD", label: "Polokwane, Limpopo", category: "City centre", source: "pulse" },
  { id: "kimberley-cbd", name: "Kimberley CBD", label: "Kimberley, Northern Cape", category: "City centre", source: "pulse" },
  { id: "mahikeng-cbd", name: "Mahikeng CBD", label: "Mahikeng, North West", category: "City centre", source: "pulse" },
];

const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const readStored = (key: string): StoredDestination[] => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeStored = (key: string, value: StoredDestination[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage failure must never block trip planning.
  }
};

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </svg>
);

const PinIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
    <circle cx="12" cy="10" r="2" />
  </svg>
);

const HomeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m3 10 9-7 9 7" />
    <path d="M5 9v12h14V9" />
    <path d="M9 21v-6h6v6" />
  </svg>
);

const WorkIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M3 12h18" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const MicrophoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0" />
    <path d="M12 19v3" />
  </svg>
);

const StarIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
  </svg>
);

const Spinner = () => (
  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
);

export const DestinationSearch = ({
  destination,
  setDestination,
  onSearch,
  loading = false,
  enableVoiceSearch = true,
  showRecentSearches = true,
  showFavorites = true,
  userHome,
  userWork,
  currentLocation,
  onDestinationResolved,
}: DestinationSearchProps) => {
  const [remoteSuggestions, setRemoteSuggestions] = useState<DestinationPlace[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<StoredDestination[]>([]);
  const [favoritePlaces, setFavoritePlaces] = useState<StoredDestination[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<DestinationPlace | null>(null);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const requestIdRef = useRef(0);

  const mapboxToken = import.meta.env["VITE_MAPBOX_TOKEN"]?.trim() ?? "";

  useEffect(() => {
    setRecentPlaces(readStored(RECENT_KEY));
    setFavoritePlaces(readStored(FAVORITES_KEY));
  }, []);

  const localSuggestions = useMemo(() => {
    const query = normalize(destination);
    if (query.length < 2) return [];

    return PULSE_DESTINATIONS.filter((place) =>
      normalize(place.name).includes(query) ||
      normalize(place.label).includes(query) ||
      normalize(place.category ?? "").includes(query),
    ).slice(0, 6);
  }, [destination]);

  useEffect(() => {
    const query = destination.trim();
    setSearchError(null);
    setActiveIndex(-1);

    if (query.length < 2 || !mapboxToken) {
      setRemoteSuggestions([]);
      setIsSearchingPlaces(false);
      return;
    }

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;

    const timer = window.setTimeout(async () => {
      setIsSearchingPlaces(true);

      try {
        const params = new URLSearchParams({
          access_token: mapboxToken,
          country: "za",
          autocomplete: "true",
          limit: "6",
          language: "en",
          types: "poi,address,place,locality,neighborhood,district",
        });

        if (currentLocation) {
          params.set("proximity", `${currentLocation.lng},${currentLocation.lat}`);
        }

        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params.toString()}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error(`Place search failed (${response.status})`);
        }

        const data = (await response.json()) as MapboxResponse;
        if (requestId !== requestIdRef.current) return;

        const places = (data.features ?? [])
          .map((feature): DestinationPlace | null => {
            if (!feature.center || feature.center.length < 2) return null;

            return {
              id: feature.id,
              name: feature.text ?? feature.place_name ?? query,
              label: feature.place_name ?? feature.text ?? query,
              lng: feature.center[0],
              lat: feature.center[1],
              category: feature.properties?.category ?? feature.place_type?.[0],
              source: "mapbox",
            };
          })
          .filter((place): place is DestinationPlace => place !== null);

        setRemoteSuggestions(places);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;

        console.error("Destination autocomplete failed:", error);
        setRemoteSuggestions([]);
        setSearchError(
          "Live place search is temporarily unavailable. You can still type a destination and continue.",
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setIsSearchingPlaces(false);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [currentLocation, destination, mapboxToken]);

  const suggestions = useMemo(() => {
    const query = normalize(destination);
    if (query.length < 2) return [];

    const recentMatches: DestinationPlace[] = showRecentSearches
      ? recentPlaces
          .filter(
            (place) =>
              normalize(place.name).includes(query) ||
              normalize(place.label).includes(query),
          )
          .map((place) => ({ ...place, source: "recent" as const }))
      : [];

    const favoriteMatches: DestinationPlace[] = showFavorites
      ? favoritePlaces
          .filter(
            (place) =>
              normalize(place.name).includes(query) ||
              normalize(place.label).includes(query),
          )
          .map((place) => ({ ...place, source: "favorite" as const }))
      : [];

    const seen = new Set<string>();

    return [
      ...favoriteMatches,
      ...localSuggestions,
      ...remoteSuggestions,
      ...recentMatches,
    ]
      .filter((place) => {
        const key = normalize(`${place.name}|${place.label}`);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 8);
  }, [
    destination,
    favoritePlaces,
    localSuggestions,
    recentPlaces,
    remoteSuggestions,
    showFavorites,
    showRecentSearches,
  ]);

  const persistResolvedPlace = useCallback(
    (place: DestinationPlace) => {
      setSelectedPlace(place);

      try {
        sessionStorage.setItem(
          SELECTED_DESTINATION_KEY,
          JSON.stringify({ ...place, timestamp: Date.now() }),
        );
      } catch {
        // Non-fatal.
      }

      onDestinationResolved?.(place);

      const nextRecent: StoredDestination[] = [
        {
          id: place.id,
          name: place.name,
          label: place.label,
          lat: place.lat,
          lng: place.lng,
          category: place.category,
          timestamp: Date.now(),
        },
        ...recentPlaces.filter(
          (item) =>
            item.id !== place.id && normalize(item.label) !== normalize(place.label),
        ),
      ].slice(0, MAX_RECENTS);

      setRecentPlaces(nextRecent);
      writeStored(RECENT_KEY, nextRecent);
    },
    [onDestinationResolved, recentPlaces],
  );

  const continueToRoute = useCallback(() => {
    // Let React commit setDestination() before App.tsx reads the parent value.
    window.setTimeout(() => onSearch(), 0);
  }, [onSearch]);

  const selectPlace = useCallback(
    (place: DestinationPlace, continueImmediately = true) => {
      setDestination(place.name);
      persistResolvedPlace(place);
      setIsOpen(false);
      setActiveIndex(-1);
      setSearchError(null);

      if (continueImmediately) continueToRoute();
    },
    [continueToRoute, persistResolvedPlace, setDestination],
  );

  const submitSearch = useCallback(() => {
    const query = destination.trim();
    if (!query || loading) return;

    const exact = suggestions.find(
      (place) =>
        normalize(place.name) === normalize(query) ||
        normalize(place.label) === normalize(query),
    );

    if (exact) {
      selectPlace(exact, true);
      return;
    }

    // Never reuse coordinates from a previous destination for free text.
    setSelectedPlace(null);
    try {
      sessionStorage.removeItem(SELECTED_DESTINATION_KEY);
    } catch {
      // Non-fatal.
    }

    setIsOpen(false);
    onSearch();
  }, [destination, loading, onSearch, selectPlace, suggestions]);

  const isFavorite = useCallback(
    (place: DestinationPlace) =>
      favoritePlaces.some(
        (item) =>
          item.id === place.id || normalize(item.label) === normalize(place.label),
      ),
    [favoritePlaces],
  );

  const toggleFavorite = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, place: DestinationPlace) => {
      event.preventDefault();
      event.stopPropagation();

      const exists = isFavorite(place);
      const next = exists
        ? favoritePlaces.filter(
            (item) =>
              item.id !== place.id && normalize(item.label) !== normalize(place.label),
          )
        : [
            {
              id: place.id,
              name: place.name,
              label: place.label,
              lat: place.lat,
              lng: place.lng,
              category: place.category,
              timestamp: Date.now(),
            },
            ...favoritePlaces,
          ].slice(0, 12);

      setFavoritePlaces(next);
      writeStored(FAVORITES_KEY, next);
    },
    [favoritePlaces, isFavorite],
  );

  const chooseShortcut = useCallback(
    (value: string, source: "home" | "work") => {
      const place: DestinationPlace = {
        id: `pulse-${source}`,
        name: value,
        label: value,
        source,
      };

      setDestination(value);
      persistResolvedPlace(place);
      continueToRoute();
    },
    [continueToRoute, persistResolvedPlace, setDestination],
  );

  const startVoiceSearch = useCallback(() => {
    if (!enableVoiceSearch || typeof window === "undefined") return;

    const browserWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    const Recognition =
      browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setSearchError("Voice search is not supported by this browser.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-ZA";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (!transcript) return;
      setDestination(transcript.trim());
      setSelectedPlace(null);
      setIsOpen(true);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    };

    recognition.onerror = () => {
      setSearchError(
        "Pulse could not hear that clearly. Please try again or type your destination.",
      );
    };

    recognition.onend = () => setIsVoiceListening(false);

    setIsVoiceListening(true);
    setSearchError(null);
    recognition.start();
  }, [enableVoiceSearch, setDestination]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown" && suggestions.length > 0) {
        event.preventDefault();
        setIsOpen(true);
        setActiveIndex((previous) =>
          Math.min(previous + 1, suggestions.length - 1),
        );
        return;
      }

      if (event.key === "ArrowUp" && suggestions.length > 0) {
        event.preventDefault();
        setActiveIndex((previous) => Math.max(previous - 1, 0));
        return;
      }

      if (event.key === "Escape") {
        setIsOpen(false);
        setActiveIndex(-1);
        return;
      }

      if (event.key === "Enter" && !loading) {
        event.preventDefault();
        if (isOpen && activeIndex >= 0 && suggestions[activeIndex]) {
          selectPlace(suggestions[activeIndex]);
        } else {
          submitSearch();
        }
      }
    },
    [activeIndex, isOpen, loading, selectPlace, submitSearch, suggestions],
  );

  const showSuggestions = isOpen && destination.trim().length >= 2;
  const showNoMatches =
    showSuggestions && !isSearchingPlaces && suggestions.length === 0;

  return (
    <div className="premium-glass compact-card relative w-full overflow-visible p-3 sm:p-4">
      <div className="space-y-3">
        <div className="relative">
          <div className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-white/40">
            <SearchIcon />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={destination}
            onChange={(event) => {
              setDestination(event.target.value);
              setSelectedPlace(null);
              setSearchError(null);
              setIsOpen(true);
            }}
            onFocus={() => {
              if (destination.trim().length >= 2) setIsOpen(true);
            }}
            onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
            onKeyDown={handleKeyDown}
            placeholder="Where do you want to go?"
            className="premium-glass-soft h-[60px] w-full rounded-[20px] pl-12 pr-20 text-base font-semibold text-white outline-none transition placeholder:text-white/30 focus:border-cyan-300/30 focus:ring-4 focus:ring-cyan-400/[0.05] sm:h-[62px] sm:text-lg"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            aria-controls="pulse-destination-suggestions"
            aria-activedescendant={
              activeIndex >= 0 ? `pulse-destination-${activeIndex}` : undefined
            }
          />

          <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1">
            {isSearchingPlaces && (
              <div className="flex h-9 w-9 items-center justify-center text-white/50" title="Searching places">
                <Spinner />
              </div>
            )}

            {enableVoiceSearch && (
              <button
                type="button"
                onClick={startVoiceSearch}
                disabled={isVoiceListening}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white/50 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
                aria-label={isVoiceListening ? "Listening" : "Search destination by voice"}
                title={isVoiceListening ? "Listening..." : "Voice search"}
              >
                {isVoiceListening ? <Spinner /> : <MicrophoneIcon />}
              </button>
            )}
          </div>

          {showSuggestions && (
            <div
              id="pulse-destination-suggestions"
              role="listbox"
              className="absolute left-0 right-0 top-[calc(100%+10px)] z-40 max-h-[380px] overflow-y-auto rounded-[22px] border border-white/[0.08] bg-[#07101d]/95 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
            >
              {suggestions.map((place, index) => {
                const favorite = isFavorite(place);

                return (
                  <div
                    key={`${place.source}-${place.id}-${index}`}
                    id={`pulse-destination-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`flex items-start gap-2 rounded-xl transition ${
                      index === activeIndex
                        ? "bg-white/[0.09]"
                        : "hover:bg-white/[0.06]"
                    }`}
                  >
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectPlace(place)}
                      className="flex min-w-0 flex-1 items-start gap-3 px-3 py-3 text-left"
                    >
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
                        <PinIcon />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white/90">
                          {place.name}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-white/45">
                          {place.label}
                        </p>
                        {place.category && (
                          <p className="mt-1 text-[10px] uppercase tracking-wide text-cyan-300/60">
                            {place.category}
                          </p>
                        )}
                      </div>
                    </button>

                    {showFavorites && (
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={(event) => toggleFavorite(event, place)}
                        className={`mr-2 mt-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                          favorite
                            ? "text-amber-300"
                            : "text-white/25 hover:bg-white/[0.06] hover:text-white/60"
                        }`}
                        aria-label={
                          favorite
                            ? `Remove ${place.name} from favourites`
                            : `Add ${place.name} to favourites`
                        }
                      >
                        <StarIcon filled={favorite} />
                      </button>
                    )}
                  </div>
                );
              })}

              {showNoMatches && (
                <div className="px-4 py-5 text-center">
                  <p className="text-sm font-medium text-white/60">
                    No autocomplete matches yet
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/35">
                    You can still use the destination you typed and Pulse will
                    try to plan the route.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {!mapboxToken && (
          <p className="text-xs leading-5 text-white/35">
            Live address search is not configured yet. Pulse is using its
            built-in South African commuter destination index.
          </p>
        )}

        {searchError && (
          <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.06] px-3 py-2">
            <p className="text-xs leading-5 text-amber-100/70">{searchError}</p>
          </div>
        )}

        {(userHome || userWork) && (
          <div className="grid grid-cols-2 gap-3">
            {userHome && (
              <button
                type="button"
                onClick={() => chooseShortcut(userHome, "home")}
                className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/[0.045] px-3 text-sm font-semibold text-white/65 transition hover:bg-white/[0.075] hover:text-white active:scale-[0.98]"
              >
                <HomeIcon />
                <span>Home</span>
              </button>
            )}

            {userWork && (
              <button
                type="button"
                onClick={() => chooseShortcut(userWork, "work")}
                className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white/[0.045] px-3 text-sm font-semibold text-white/65 transition hover:bg-white/[0.075] hover:text-white active:scale-[0.98]"
              >
                <WorkIcon />
                <span>Work</span>
              </button>
            )}
          </div>
        )}

        {selectedPlace?.lat !== undefined && selectedPlace.lng !== undefined && (
          <div className="flex items-center gap-2 px-1 text-[11px] font-semibold text-emerald-300/70">
            <PinIcon />
            <span>Destination located</span>
          </div>
        )}

        <button
          type="button"
          onClick={submitSearch}
          disabled={!destination.trim() || loading}
          className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[20px] bg-gradient-to-r from-cyan-400 via-cyan-400 to-emerald-400 px-5 text-sm font-black text-[#031019] shadow-[0_14px_35px_rgba(34,211,238,0.16)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>{loading ? "Finding journeys..." : "Find journeys"}</span>
          {!loading && <ArrowRightIcon />}
        </button>
      </div>
    </div>
  );
};
