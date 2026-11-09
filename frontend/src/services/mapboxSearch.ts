// One adapter for Mapbox's current address/place and landmark endpoints.
export interface MapboxPlace {
  id: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
  category?: string;
  source: "mapbox";
}

interface SearchOptions {
  token: string;
  proximity?: { lat: number; lng: number } | null;
  signal?: AbortSignal;
}

interface Feature {
  geometry?: { coordinates?: number[] };
  properties?: {
    mapbox_id?: string;
    name?: string;
    name_preferred?: string;
    full_address?: string;
    place_formatted?: string;
    feature_type?: string;
    coordinates?: { latitude?: number; longitude?: number };
  };
}

export type TownshipBlock = { township: "Soshanguve" | "Mabopane"; block: string };

/** Recognise named township blocks without treating a similarly named street as the block. */
export const townshipBlockQuery = (query: string): TownshipBlock | null => {
  const township = /\bsoshanguve\b/i.test(query) ? "Soshanguve"
    : /\bmabopane\b/i.test(query) ? "Mabopane" : null;
  if (!township) return null;
  const match = query.match(/\b(?:block|blk)\s+([a-z]{1,3})\b/i)
    ?? query.match(new RegExp(`\\b${township}\\s+([a-z]{1,3})\\b`, "i"));
  const block = match?.[1]?.toUpperCase();
  return block && !["THE", "EXT", "CBD", "ST", "RD"].includes(block)
    ? { township, block } : null;
};

export const matchesTownshipBlock = (
  place: { name: string; label: string }, requested: TownshipBlock,
): boolean => {
  const words = `${place.name} ${place.label}`.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  const town = requested.township.toLowerCase();
  const block = requested.block.toLowerCase();
  // Both "Mabopane Block U" and a geocoder's "Mabopane U" area alias count.
  // "Block Street, Mabopane" and a generic "Mabopane" pin do not.
  return new RegExp(`\\b${town}\\b`).test(words) &&
    (new RegExp(`\\b(?:block|blk)\\s+${block}\\b`).test(words) ||
      new RegExp(`\\b${town}\\s+${block}\\b(?!\\s+(?:street|road|avenue))`).test(words));
};

// Keep the existing Soshanguve API for callers and historical tests.
export const soshanguveBlock = (query: string): string | null => {
  const requested = townshipBlockQuery(query);
  return requested?.township === "Soshanguve" ? requested.block : null;
};

export const matchesBlock = (place: { name: string; label: string }, block: string): boolean =>
  matchesTownshipBlock(place, { township: "Soshanguve", block });

export const decodeMapboxFeatures = (features: Feature[]): MapboxPlace[] =>
  features.flatMap((feature) => {
    const p = feature.properties;
    const lng = p?.coordinates?.longitude ?? feature.geometry?.coordinates?.[0];
    const lat = p?.coordinates?.latitude ?? feature.geometry?.coordinates?.[1];
    if (!p?.mapbox_id || typeof lng !== "number" || typeof lat !== "number" ||
        !Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) return [];
    const name = p.name_preferred ?? p.name;
    if (!name) return [];
    const label = p.full_address ?? [name, p.place_formatted].filter(Boolean).join(", ");
    return [{ id: p.mapbox_id, name: p.feature_type === "address" ? label : name,
      label, lat, lng, category: p.feature_type, source: "mapbox" as const }];
  });

const request = async (endpoint: string, query: string, options: SearchOptions, geocoding: boolean): Promise<MapboxPlace[]> => {
  const params = new URLSearchParams({ q: query, access_token: options.token,
    country: "za", language: "en", limit: "10" });
  if (geocoding) {
    params.set("autocomplete", "true");
    params.set("types", "address,street,place,locality,neighborhood,district");
  } else {
    params.set("types", "poi");
  }
  const proximity = options.proximity;
  if (proximity && Number.isFinite(proximity.lat) && Number.isFinite(proximity.lng) &&
      Math.abs(proximity.lat) <= 90 && Math.abs(proximity.lng) <= 180) {
    params.set("proximity", `${proximity.lng},${proximity.lat}`);
  }
  const response = await fetch(`${endpoint}?${params}`, { signal: options.signal });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("Mapbox access denied. Check the public token and its allowed website URLs.");
    if (response.status === 429) throw new Error("Place search is busy. Please try again shortly.");
    throw new Error(`Place search failed (${response.status}). Please try again.`);
  }
  const data = await response.json() as { features?: Feature[] };
  return decodeMapboxFeatures(Array.isArray(data.features) ? data.features : []);
};

export const searchMapboxPlaces = async (input: string, options: SearchOptions): Promise<MapboxPlace[]> => {
  const query = input.trim().replace(/\s+/g, " ");
  if (query.length < 2 || !options.token.trim()) return [];
  if (query.length > 256 || query.split(/\s+/).length > 20 || query.includes(";")) {
    throw new Error("Use a shorter place name or street address.");
  }
  const townshipBlock = townshipBlockQuery(query);
  const queries = townshipBlock ? [
    `${townshipBlock.township} Block ${townshipBlock.block}, Tshwane, Gauteng, South Africa`,
    `${townshipBlock.township} ${townshipBlock.block}, Gauteng, South Africa`,
    `Block ${townshipBlock.block}, ${townshipBlock.township}, Gauteng, South Africa`,
  ] : [query];
  let places: MapboxPlace[] = [];
  for (const spelling of queries) {
    places = await request("https://api.mapbox.com/search/geocode/v6/forward", spelling, options, true);
    if (townshipBlock) places = places.filter((place) => matchesTownshipBlock(place, townshipBlock));
    if (places.length) break;
  }
  // POIs no longer come from the Geocoding API. Ask Search Box only when
  // addresses/areas found nothing, or when the user explicitly names a landmark.
  const landmark = /\b(station|hospital|clinic|mall|university|school|taxi\s+rank|airport|church)\b/i.test(query);
  if (!townshipBlock && query.length >= 3 && (!places.length || landmark)) {
    try {
      const pois = await request("https://api.mapbox.com/search/searchbox/v1/forward", query, options, false);
      places = [...pois, ...places];
    } catch (error) {
      if (options.signal?.aborted || !places.length) throw error;
      // An unavailable POI endpoint must not discard usable geocoding results.
    }
  }
  const seen = new Set<string>();
  return places.filter((place) => {
    if (seen.has(place.id)) return false;
    seen.add(place.id);
    return true;
  }).slice(0, 10);
};
