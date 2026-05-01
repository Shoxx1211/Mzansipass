// services/destinationEngine.ts

import { ROUTE_REGISTRY } from "../constants";
import type { Location } from "../types";

// ===============================
// TYPES
// ===============================
interface PlanInput {
  origin: Location;
  destination: string;
}

interface PlanResult {
  distance: number;
  matchedRoute?: string;
  confidence: number;
}

// ===============================
// MOCK DESTINATION DATABASE
// (🔥 Replace with Google Places later)
// ===============================
const DESTINATIONS: Record<string, Location> = {
  "sandton": { lat: -26.1076, lng: 28.0567 },
  "hatfield": { lat: -25.7479, lng: 28.2293 },
  "park station": { lat: -26.2041, lng: 28.0473 },
  "soweto": { lat: -26.267, lng: 27.858 },
  "randburg": { lat: -26.093, lng: 27.998 },
  "mamelodi": { lat: -25.725, lng: 28.350 }
};

// ===============================
// DISTANCE FUNCTION
// ===============================
const calcDistance = (a: Location, b: Location) => {
  const R = 6371;

  const dLat = (b.lat - a.lat) * (Math.PI / 180);
  const dLon = (b.lng - a.lng) * (Math.PI / 180);

  const lat1 = a.lat * (Math.PI / 180);
  const lat2 = b.lat * (Math.PI / 180);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return R * (2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
};

// ===============================
// ENGINE
// ===============================
export class DestinationEngine {

  // 🔥 MAIN METHOD (THIS FIXES YOUR ERROR)
  static async plan(input: PlanInput): Promise<PlanResult> {
    const { origin, destination } = input;

    await new Promise((r) => setTimeout(r, 100)); // simulate latency

    const key = destination.toLowerCase().trim();

    const destLocation = DESTINATIONS[key];

    // ===============================
    // IF WE KNOW THE PLACE
    // ===============================
    if (destLocation) {
      const distance = calcDistance(origin, destLocation);

      const matchedRoute = this.matchRoute(origin, destLocation);

      return {
        distance,
        matchedRoute,
        confidence: 0.9
      };
    }

    // ===============================
    // UNKNOWN DESTINATION (fallback)
    // ===============================
    return {
      distance: Math.random() * 10 + 3,
      matchedRoute: undefined,
      confidence: 0.3
    };
  }

  // ===============================
  // ROUTE MATCHING
  // ===============================
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

      const distToStart = calcDistance(origin, start);
      const distToEnd = calcDistance(destination, end);

      const score = distToStart + distToEnd;

      if (score < bestScore) {
        bestScore = score;
        bestMatch = route.id;
      }
    }

    return bestMatch;
  }
}