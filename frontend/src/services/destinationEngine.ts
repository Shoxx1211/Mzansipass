// src/services/destinationEngine.ts
// Pulse Transit - Premium Destination Engine
// Features: Geocoding, place autocomplete, distance matrix, route matching

import { ROUTE_REGISTRY } from "../constants";
import type { Location } from "../types";

// ======================================================
// TYPES
// ======================================================

export interface PlanInput {
  origin: Location;
  destination: string;
  preferences?: {
    avoidTolls?: boolean;
    preferHighways?: boolean;
    maxWalkingDistance?: number;
  };
}

export interface PlanResult {
  distance: number;
  duration?: number; // Estimated travel time in minutes
  matchedRoute?: string;
  confidence: number;
  alternatives?: PlaceAlternative[];
  boundingBox?: {
    northeast: Location;
    southwest: Location;
  };
}

export interface PlaceAlternative {
  name: string;
  location: Location;
  distance: number;
  confidence: number;
}

export interface GeocodeResult {
  formattedAddress: string;
  location: Location;
  confidence: number;
  placeId?: string;
}

// ======================================================
// CONSTANTS
// ======================================================

const EARTH_RADIUS_KM = 6371;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;
const MAX_ALTERNATIVES = 3;

// Enhanced destination database with metadata
const DESTINATIONS: Record<string, {
  location: Location;
  aliases: string[];
  category: 'cbd' | 'station' | 'mall' | 'airport' | 'township' | 'suburb';
  popularity: number; // 0-100
  boundingBox?: { northeast: Location; southwest: Location };
}> = {
  "braamfontein": {
    // Central Braamfontein, Johannesburg. Used only as a resilient fallback
    // when the live geocoder is unavailable.
    location: { lat: -26.1911, lng: 28.0378 },
    aliases: [
      "braam",
      "braamfontein johannesburg",
      "braamfontein joburg"
    ],
    category: "suburb",
    popularity: 94
  },
  "sandton": {
    location: { lat: -26.1076, lng: 28.0567 },
    aliases: ["sandton city", "sandton cbd", "sandton central"],
    category: "cbd",
    popularity: 95,
    boundingBox: {
      northeast: { lat: -26.1000, lng: 28.0650 },
      southwest: { lat: -26.1150, lng: 28.0480 }
    }
  },
  "hatfield": {
    location: { lat: -25.7479, lng: 28.2293 },
    aliases: ["hatfield pretoria", "hatfield square"],
    category: "suburb",
    popularity: 85
  },
  "park station": {
    location: { lat: -26.2041, lng: 28.0473 },
    aliases: ["joburg park", "park station johannesburg", "joburg station"],
    category: "station",
    popularity: 90
  },
  "soweto": {
    location: { lat: -26.2678, lng: 27.8585 },
    aliases: ["soweto township", "orlando", "diepkloof"],
    category: "township",
    popularity: 88
  },
  "randburg": {
    location: { lat: -26.0930, lng: 27.9980 },
    aliases: ["randburg cbd", "randburg central"],
    category: "suburb",
    popularity: 75
  },
  "mamelodi": {
    location: { lat: -25.7250, lng: 28.3500 },
    aliases: ["mamelodi pretoria"],
    category: "township",
    popularity: 70
  },
  "pretoria": {
    location: { lat: -25.7479, lng: 28.2293 },
    aliases: ["pretoria cbd", "pretoria central", "tshwane"],
    category: "cbd",
    popularity: 92
  },
  "midrand": {
    location: { lat: -25.9994, lng: 28.1269 },
    aliases: ["midrand cbd", "midrand central"],
    category: "cbd",
    popularity: 85
  },
  "or tambo": {
    location: { lat: -26.1337, lng: 28.2420 },
    aliases: ["or tambo airport", "joburg airport", "johannesburg airport"],
    category: "airport",
    popularity: 98
  },
  "rosebank": {
    location: { lat: -26.1464, lng: 28.0428 },
    aliases: ["rosebank joburg", "rosebank cbd"],
    category: "cbd",
    popularity: 88
  },
  "fourways": {
    location: { lat: -26.0200, lng: 28.0100 },
    aliases: ["fourways mall", "fourways joburg"],
    category: "suburb",
    popularity: 82
  },
  "centurion": {
    location: { lat: -25.8580, lng: 28.1900 },
    aliases: ["centurion cbd", "centurion mall"],
    category: "cbd",
    popularity: 80
  }
};

// Average speeds by transport mode (km/h)
const AVERAGE_SPEEDS = {
  Taxi: 35,
  Gautrain: 70,
  Bus: 25,
  Walking: 5,
  Default: 30
};

// ======================================================
// HELPER FUNCTIONS
// ======================================================

/**
 * Calculate distance between two coordinates using Haversine formula
 */
const calculateDistance = (a: Location, b: Location): number => {
  const dLat = (b.lat - a.lat) * (Math.PI / 180);
  const dLon = (b.lng - a.lng) * (Math.PI / 180);
  const lat1 = a.lat * (Math.PI / 180);
  const lat2 = b.lat * (Math.PI / 180);

  const x = Math.sin(dLat / 2) ** 2 +
           Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return EARTH_RADIUS_KM * (2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
};

/**
 * Calculate estimated travel time based on distance and transport mode
 */
const calculateTravelTime = (distanceKm: number, mode: keyof typeof AVERAGE_SPEEDS = 'Default'): number => {
  const speed = AVERAGE_SPEEDS[mode] || AVERAGE_SPEEDS.Default;
  return Math.round((distanceKm / speed) * 60); // minutes
};

/**
 * Normalize destination string (remove special chars, extra spaces)
 */
const normalizeDestination = (input: string): string => {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Find best matching destination with fuzzy matching
 */
const findBestMatch = (query: string): { key: string; data: typeof DESTINATIONS[string]; score: number } | null => {
  const normalized = normalizeDestination(query);
  let bestMatch: { key: string; data: typeof DESTINATIONS[string]; score: number } | null = null;
  
  for (const [key, data] of Object.entries(DESTINATIONS)) {
    // Exact match on key
    if (normalized === key) {
      return { key, data, score: 1.0 };
    }
    
    // Check aliases
    for (const alias of data.aliases) {
      if (normalized === alias) {
        return { key, data, score: 0.95 };
      }
    }
    
    // Partial match (contains)
    if (key.includes(normalized) || normalized.includes(key)) {
      const score = 0.7;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { key, data, score };
      }
    }
    
    // Check aliases partial match
    for (const alias of data.aliases) {
      if (alias.includes(normalized) || normalized.includes(alias)) {
        const score = 0.65;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { key, data, score };
        }
      }
    }
  }
  
  return bestMatch;
};

/**
 * Get alternative destination suggestions
 */
const getAlternatives = (query: string, origin: Location, limit: number = MAX_ALTERNATIVES): PlaceAlternative[] => {
  const normalized = normalizeDestination(query);
  const alternatives: PlaceAlternative[] = [];
  
  for (const [key, data] of Object.entries(DESTINATIONS)) {
    // Skip exact matches
    if (normalized === key) continue;
    
    // Check if related
    const isRelated = data.aliases.some(alias => 
      alias.includes(normalized) || normalized.includes(alias)
    );
    
    if (isRelated) {
      const distance = calculateDistance(origin, data.location);
      alternatives.push({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        location: data.location,
        distance,
        confidence: 0.6
      });
    }
  }
  
  // Sort by distance and take top N
  return alternatives
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
};

/**
 * Get place category emoji/icon
 */
export const getPlaceIcon = (category: string): string => {
  switch (category) {
    case 'cbd': return '🏙️';
    case 'station': return '🚉';
    case 'mall': return '🛍️';
    case 'airport': return '✈️';
    case 'township': return '🏘️';
    case 'suburb': return '🏡';
    default: return '📍';
  }
};

/**
 * Get popular destinations list
 */
export const getPopularDestinations = (limit: number = 10): Array<{ name: string; category: string; popularity: number }> => {
  return Object.entries(DESTINATIONS)
    .map(([name, data]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      category: data.category,
      popularity: data.popularity
    }))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit);
};

/**
 * Search destinations by query (for autocomplete)
 */
export const searchDestinations = (query: string, limit: number = 5): Array<{ name: string; category: string; location: Location }> => {
  const normalized = normalizeDestination(query);
  if (normalized.length < 2) return [];
  
  const results: Array<{ name: string; category: string; location: Location; score: number }> = [];
  
  for (const [name, data] of Object.entries(DESTINATIONS)) {
    let score = 0;
    
    if (name.includes(normalized)) {
      score = 0.8;
    } else if (normalized.includes(name) && name.length > 3) {
      score = 0.6;
    }
    
    for (const alias of data.aliases) {
      if (alias.includes(normalized)) {
        score = Math.max(score, 0.7);
      }
    }
    
    if (score > 0) {
      results.push({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        category: data.category,
        location: data.location,
        score
      });
    }
  }
  
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ name, category, location }) => ({ name, category, location }));
};

// ======================================================
// MAIN ENGINE CLASS
// ======================================================

export class DestinationEngine {
  
  /**
   * Plan a route from origin to destination
   */
  static async plan(input: PlanInput): Promise<PlanResult> {
    const { origin, destination } = input;
    
    // Simulate network latency (remove in production)
    await new Promise((r) => setTimeout(r, 50));
    
    const normalized = normalizeDestination(destination);
    const bestMatch = findBestMatch(normalized);
    
    // If we know the place
    if (bestMatch && bestMatch.score >= DEFAULT_CONFIDENCE_THRESHOLD) {
      const destLocation = bestMatch.data.location;
      const distance = calculateDistance(origin, destLocation);
      const duration = calculateTravelTime(distance);
      const matchedRoute = this.matchRoute(origin, destLocation);
      const alternatives = getAlternatives(normalized, origin);
      
      return {
        distance: Number(distance.toFixed(2)),
        duration,
        matchedRoute,
        confidence: bestMatch.score,
        alternatives: alternatives.length > 0 ? alternatives : undefined,
        boundingBox: bestMatch.data.boundingBox
      };
    }
    
    // Fuzzy match with lower confidence
    if (bestMatch) {
      const destLocation = bestMatch.data.location;
      const distance = calculateDistance(origin, destLocation);
      const duration = calculateTravelTime(distance);
      
      return {
        distance: Number(distance.toFixed(2)),
        duration,
        confidence: bestMatch.score,
        alternatives: getAlternatives(normalized, origin)
      };
    }
    
    // Unknown destination - return fallback with suggestions
    const suggestions = searchDestinations(normalized, 3);
    
    return {
      distance: 0,
      duration: 0,
      confidence: 0.2,
      alternatives: suggestions.map(s => ({
        name: s.name,
        location: s.location,
        distance: calculateDistance(origin, s.location),
        confidence: 0.5
      }))
    };
  }
  
  /**
   * Batch plan multiple destinations
   */
  static async batchPlan(inputs: PlanInput[]): Promise<PlanResult[]> {
    return Promise.all(inputs.map(input => this.plan(input)));
  }
  
  /**
   * Get distance matrix between origins and destinations
   */
  static async getDistanceMatrix(
    origins: Location[],
    destinations: Location[]
  ): Promise<number[][]> {
    const matrix: number[][] = [];
    
    for (const origin of origins) {
      const row: number[] = [];
      for (const dest of destinations) {
        row.push(calculateDistance(origin, dest));
      }
      matrix.push(row);
    }
    
    return matrix;
  }
  
  /**
   * Match route based on origin and destination
   */
  private static matchRoute(
    origin: Location,
    destination: Location
  ): string | undefined {
    let bestMatch: string | undefined;
    let bestScore = Infinity;
    
    for (const route of ROUTE_REGISTRY) {
      if (!route.coordinates || route.coordinates.length < 2) continue;
      
      const start = route.coordinates[0];
      const end = route.coordinates[route.coordinates.length - 1];
      
      const distToStart = calculateDistance(origin, start);
      const distToEnd = calculateDistance(destination, end);
      
      const score = distToStart + distToEnd;
      
      if (score < bestScore) {
        bestScore = score;
        bestMatch = route.id;
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Validate if a destination exists
   */
  static async isValidDestination(destination: string): Promise<boolean> {
    const normalized = normalizeDestination(destination);
    const bestMatch = findBestMatch(normalized);
    return bestMatch !== null && bestMatch.score >= DEFAULT_CONFIDENCE_THRESHOLD;
  }
  
  /**
   * Get coordinates for a destination
   */
  static async geocode(destination: string): Promise<GeocodeResult | null> {
    const normalized = normalizeDestination(destination);
    const bestMatch = findBestMatch(normalized);
    
    if (bestMatch && bestMatch.score >= DEFAULT_CONFIDENCE_THRESHOLD) {
      return {
        formattedAddress: bestMatch.key.charAt(0).toUpperCase() + bestMatch.key.slice(1),
        location: bestMatch.data.location,
        confidence: bestMatch.score,
        placeId: bestMatch.key
      };
    }
    
    return null;
  }
  
  /**
   * Reverse geocode - get place name from coordinates
   */
  static async reverseGeocode(location: Location): Promise<string | null> {
    let bestMatch: { name: string; distance: number } | null = null;
    
    for (const [name, data] of Object.entries(DESTINATIONS)) {
      const distance = calculateDistance(location, data.location);
      if (distance < 5 && (!bestMatch || distance < bestMatch.distance)) {
        bestMatch = { name: name.charAt(0).toUpperCase() + name.slice(1), distance };
      }
    }
    
    return bestMatch?.name || null;
  }
}

// ======================================================
// EXPORT UTILITIES
// ======================================================

export { calculateDistance, calculateTravelTime, normalizeDestination, findBestMatch };