// services/routeEngine.ts

import { ROUTE_REGISTRY } from "../constants";
import type { TransitNetwork } from "../types";

// ---------------- TYPES ----------------
type Location = {
  lat: number;
  lng: number;
};

type Route = {
  name: string;
  network: TransitNetwork;
  coordinates?: Location[];
};

export type RouteMatchResult = {
  route: Route | null;
  distance: number;        // km
  confidence: number;      // 0 → 1
  isOnRoute: boolean;      // 🔥 KEY SIGNAL
};

// ---------------- ENGINE ----------------
export class RouteEngine {

  // 🔥 Tunable thresholds (VERY IMPORTANT)
  private static MAX_MATCH_DISTANCE_KM = 0.3;   // 300m
  private static STRONG_MATCH_DISTANCE_KM = 0.1; // 100m

  // ---------------- MAIN ----------------
  static findClosestRoute(userLoc: Location): RouteMatchResult {
    let bestMatch: Route | null = null;
    let bestDistance = Infinity;

    for (const route of ROUTE_REGISTRY as Route[]) {
      if (!route.coordinates || route.coordinates.length === 0) continue;

      const dist = this.findMinDistanceToRoute(userLoc, route.coordinates);

      if (dist < bestDistance) {
        bestDistance = dist;
        bestMatch = route;
      }
    }

    // 🚫 No route nearby
    if (!bestMatch || bestDistance > this.MAX_MATCH_DISTANCE_KM) {
      return {
        route: null,
        distance: bestDistance,
        confidence: 0,
        isOnRoute: false
      };
    }

    const confidence = this.calculateConfidence(bestDistance);

    return {
      route: bestMatch,
      distance: bestDistance,
      confidence,
      isOnRoute: confidence > 0.6
    };
  }

  // ---------------- CORE DISTANCE ----------------
  private static findMinDistanceToRoute(
    user: Location,
    coordinates: Location[]
  ): number {
    let minDist = Infinity;

    // 🔥 Optimization: skip points (reduce CPU)
    const STEP = Math.ceil(coordinates.length / 25); // max 25 checks

    for (let i = 0; i < coordinates.length; i += STEP) {
      const dist = this.distance(user, coordinates[i]);
      if (dist < minDist) minDist = dist;
    }

    return minDist;
  }

  // ---------------- CONFIDENCE ----------------
  private static calculateConfidence(distance: number): number {
    if (distance <= this.STRONG_MATCH_DISTANCE_KM) return 0.95;

    if (distance <= this.MAX_MATCH_DISTANCE_KM) {
      // Linear decay
      return (
        1 -
        (distance - this.STRONG_MATCH_DISTANCE_KM) /
          (this.MAX_MATCH_DISTANCE_KM - this.STRONG_MATCH_DISTANCE_KM)
      );
    }

    return 0;
  }

  // ---------------- DISTANCE (HAVERSINE) ----------------
  private static distance(a: Location, b: Location): number {
    const R = 6371; // km

    const dLat = (b.lat - a.lat) * (Math.PI / 180);
    const dLon = (b.lng - a.lng) * (Math.PI / 180);

    const lat1 = a.lat * (Math.PI / 180);
    const lat2 = b.lat * (Math.PI / 180);

    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.sin(dLon / 2) ** 2 *
        Math.cos(lat1) *
        Math.cos(lat2);

    const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));

    return R * y;
  }
}