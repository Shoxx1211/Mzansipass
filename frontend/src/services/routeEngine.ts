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
  distance: number;
  confidence: number;
  isOnRoute: boolean;
};

export type RouteEstimateResult = {
  distance: number;     // km
  method: "api" | "route" | "straight"; // 🔥 transparency
};

// ---------------- ENGINE ----------------
export class RouteEngine {

  private static MAX_MATCH_DISTANCE_KM = 0.3;
  private static STRONG_MATCH_DISTANCE_KM = 0.1;

  // ===============================
  // 🔍 ROUTE MATCHING (UNCHANGED CORE)
  // ===============================
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

  // ===============================
  // 🔥 ROUTE DISTANCE ESTIMATION (CRITICAL FEATURE)
  // ===============================
  static async estimateRouteDistance(
    start: Location,
    end: Location
  ): Promise<number> {

    // 1️⃣ Try API (future)
    const apiDistance = await this.tryApiDistance(start, end);
    if (apiDistance) {
      return apiDistance;
    }

    // 2️⃣ Try route-based estimation
    const routeDistance = this.estimateUsingRoute(start, end);
    if (routeDistance) {
      return routeDistance;
    }

    // 3️⃣ Final fallback (straight line)
    return this.distance(start, end);
  }

  // ===============================
  // 🌐 API DISTANCE (FUTURE READY)
  // ===============================
  private static async tryApiDistance(
    start: Location,
    end: Location
  ): Promise<number | null> {
    try {
      // 🔥 Placeholder — you plug backend later
      const res = await fetch(
        `/api/route?start=${start.lat},${start.lng}&end=${end.lat},${end.lng}`
      );

      if (!res.ok) return null;

      const data = await res.json();

      if (data?.distance) {
        console.log("🌐 API route distance:", data.distance);
        return data.distance;
      }

      return null;
    } catch {
      return null;
    }
  }

  // ===============================
  // 🛣️ ROUTE-BASED ESTIMATION
  // ===============================
  private static estimateUsingRoute(
    start: Location,
    end: Location
  ): number | null {

    const startMatch = this.findClosestRoute(start);
    const endMatch = this.findClosestRoute(end);

    // Must be on same route
    if (
      !startMatch.route ||
      !endMatch.route ||
      startMatch.route.name !== endMatch.route.name
    ) {
      return null;
    }

    const coords = startMatch.route.coordinates;
    if (!coords || coords.length < 2) return null;

    // 🔥 Find closest indices
    let startIdx = 0;
    let endIdx = 0;

    let minStartDist = Infinity;
    let minEndDist = Infinity;

    coords.forEach((point, i) => {
      const dStart = this.distance(start, point);
      const dEnd = this.distance(end, point);

      if (dStart < minStartDist) {
        minStartDist = dStart;
        startIdx = i;
      }

      if (dEnd < minEndDist) {
        minEndDist = dEnd;
        endIdx = i;
      }
    });

    // 🔥 Sum route segment distance
    let distance = 0;

    const step = startIdx < endIdx ? 1 : -1;

    for (let i = startIdx; i !== endIdx; i += step) {
      const a = coords[i];
      const b = coords[i + step];

      if (!b) break;

      distance += this.distance(a, b);
    }

    console.log("🛣️ Route-based distance:", distance);

    return distance > 0 ? distance : null;
  }

  // ===============================
  // 📍 MIN DISTANCE TO ROUTE
  // ===============================
  private static findMinDistanceToRoute(
    user: Location,
    coordinates: Location[]
  ): number {
    let minDist = Infinity;

    const STEP = Math.ceil(coordinates.length / 25);

    for (let i = 0; i < coordinates.length; i += STEP) {
      const dist = this.distance(user, coordinates[i]);
      if (dist < minDist) minDist = dist;
    }

    return minDist;
  }

  // ===============================
  // 🎯 CONFIDENCE
  // ===============================
  private static calculateConfidence(distance: number): number {
    if (distance <= this.STRONG_MATCH_DISTANCE_KM) return 0.95;

    if (distance <= this.MAX_MATCH_DISTANCE_KM) {
      return (
        1 -
        (distance - this.STRONG_MATCH_DISTANCE_KM) /
          (this.MAX_MATCH_DISTANCE_KM - this.STRONG_MATCH_DISTANCE_KM)
      );
    }

    return 0;
  }

  // ===============================
  // 📏 HAVERSINE
  // ===============================
  private static distance(a: Location, b: Location): number {
    const R = 6371;

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