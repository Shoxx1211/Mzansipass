// src/services/routeEngine.ts
// Pulse Transit - Premium Route Engine
// Features: Route matching, distance estimation, caching, multi-modal routing

import { ROUTE_REGISTRY } from "../constants";
import type { TransitNetwork, Location } from "../types";

// ======================================================
// TYPES
// ======================================================

export type Route = {
  id: string;
  name: string;
  network: TransitNetwork;
  coordinates?: Location[];
  distance?: number;
  estimatedDuration?: number;
  operatingHours?: { start: string; end: string };
  frequency?: number; // minutes between vehicles
};

export type RouteMatchResult = {
  route: Route | null;
  distance: number;
  confidence: number;
  isOnRoute: boolean;
  nearestPoint?: Location;
  bearing?: number;
};

export type RouteEstimateResult = {
  distance: number;     // km
  duration: number;     // minutes
  method: "api" | "route" | "straight" | "cached";
  confidence: number;
  routeIds?: string[];
};

export type RouteSegment = {
  start: Location;
  end: Location;
  distance: number;
  duration: number;
  mode: "walk" | "transit";
  route?: Route;
};

export type MultiModalRoute = {
  segments: RouteSegment[];
  totalDistance: number;
  totalDuration: number;
  transfers: number;
  estimatedFare: number;
};

// ======================================================
// CONSTANTS
// ======================================================

const CONFIG = {
  MAX_MATCH_DISTANCE_KM: 0.3,
  STRONG_MATCH_DISTANCE_KM: 0.1,
  CACHE_DURATION_MS: 5 * 60 * 1000, // 5 minutes
  MAX_CACHE_SIZE: 100,
  WALKING_SPEED_KMH: 5,
  SAMPLE_STEP: 25, // Sample every Nth point for performance
  BEARING_THRESHOLD: 30 // degrees
};

// ======================================================
// CACHE MANAGEMENT
// ======================================================

interface CacheEntry {
  key: string;
  result: RouteEstimateResult;
  timestamp: number;
}

class RouteCache {
  private cache: Map<string, CacheEntry> = new Map();

  getKey(start: Location, end: Location): string {
    return `${start.lat.toFixed(4)},${start.lng.toFixed(4)}|${end.lat.toFixed(4)},${end.lng.toFixed(4)}`;
  }

  get(start: Location, end: Location): RouteEstimateResult | null {
    const key = this.getKey(start, end);
    const entry = this.cache.get(key);
    
    if (entry && Date.now() - entry.timestamp < CONFIG.CACHE_DURATION_MS) {
      console.log("📦 Using cached route estimate");
      return entry.result;
    }
    
    if (entry) this.cache.delete(key);
    return null;
  }

  set(start: Location, end: Location, result: RouteEstimateResult): void {
    const key = this.getKey(start, end);
    
    if (this.cache.size >= CONFIG.MAX_CACHE_SIZE) {
      const oldest = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) this.cache.delete(oldest[0]);
    }
    
    this.cache.set(key, {
      key,
      result: { ...result, method: "cached" },
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
    console.log("🗑️ Route cache cleared");
  }
}

const routeCache = new RouteCache();

// ======================================================
// HELPER FUNCTIONS
// ======================================================

const calculateBearing = (from: Location, to: Location): number => {
  const dLng = (to.lng - from.lng) * (Math.PI / 180);
  const lat1 = from.lat * (Math.PI / 180);
  const lat2 = to.lat * (Math.PI / 180);
  
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  
  let bearing = Math.atan2(y, x) * (180 / Math.PI);
  bearing = (bearing + 360) % 360;
  return bearing;
};


// ======================================================
// MAIN ENGINE
// ======================================================

export class RouteEngine {

  // ======================================================
  // ROUTE MATCHING (ENHANCED)
  // ======================================================
  
  static findClosestRoute(userLoc: Location): RouteMatchResult {
    let bestMatch: Route | null = null;
    let bestDistance = Infinity;
    let nearestPoint: Location | undefined;
    let bestBearing: number | undefined;

    for (const route of ROUTE_REGISTRY as Route[]) {
      if (!route.coordinates || route.coordinates.length === 0) continue;

      const result = this.findMinDistanceToRouteWithPoint(userLoc, route.coordinates);
      
      if (result.distance < bestDistance) {
        bestDistance = result.distance;
        bestMatch = route;
        nearestPoint = result.nearestPoint;
        bestBearing = result.bearing;
      }
    }

    if (!bestMatch || bestDistance > CONFIG.MAX_MATCH_DISTANCE_KM) {
      return {
        route: null,
        distance: bestDistance,
        confidence: 0,
        isOnRoute: false
      };
    }

    const confidence = this.calculateConfidence(bestDistance);
    const bearing = bestBearing ? calculateBearing(userLoc, nearestPoint!) : undefined;

    return {
      route: bestMatch,
      distance: bestDistance,
      confidence,
      isOnRoute: confidence > 0.6,
      nearestPoint,
      bearing
    };
  }

  /**
   * Find multiple routes near a location (for recommendations)
   */
  static findNearbyRoutes(
    userLoc: Location,
    radiusKm: number = CONFIG.MAX_MATCH_DISTANCE_KM
  ): RouteMatchResult[] {
    const matches: RouteMatchResult[] = [];

    for (const route of ROUTE_REGISTRY as Route[]) {
      if (!route.coordinates || route.coordinates.length === 0) continue;

      const result = this.findMinDistanceToRouteWithPoint(userLoc, route.coordinates);
      
      if (result.distance <= radiusKm) {
        matches.push({
          route,
          distance: result.distance,
          confidence: this.calculateConfidence(result.distance),
          isOnRoute: result.distance <= CONFIG.STRONG_MATCH_DISTANCE_KM,
          nearestPoint: result.nearestPoint
        });
      }
    }

    return matches.sort((a, b) => a.distance - b.distance);
  }

  // ======================================================
  // ROUTE DISTANCE ESTIMATION (ENHANCED)
  // ======================================================
  
  static async estimateRouteDistance(
    start: Location,
    end: Location,
    useCache: boolean = true
  ): Promise<RouteEstimateResult> {
    // Check cache first
    if (useCache) {
      const cached = routeCache.get(start, end);
      if (cached) return cached;
    }

    // 1️⃣ Try API (future)
    const apiResult = await this.tryApiDistance(start, end);
    if (apiResult) {
      const result: RouteEstimateResult = {
        distance: apiResult.distance,
        duration: apiResult.duration,
        method: "api",
        confidence: 0.95,
        routeIds: apiResult.routeIds
      };
      routeCache.set(start, end, result);
      return result;
    }

    // 2️⃣ Try route-based estimation
    const routeResult = this.estimateUsingRoute(start, end);
    if (routeResult) {
      const result: RouteEstimateResult = {
        distance: routeResult.distance,
        duration: Math.round(routeResult.distance / CONFIG.WALKING_SPEED_KMH * 60),
        method: "route",
        confidence: 0.85,
        routeIds: routeResult.routeIds
      };
      routeCache.set(start, end, result);
      return result;
    }

    // 3️⃣ Final fallback (straight line)
    const straightDistance = this.distance(start, end);
    const result: RouteEstimateResult = {
      distance: straightDistance,
      duration: Math.round(straightDistance / CONFIG.WALKING_SPEED_KMH * 60),
      method: "straight",
      confidence: 0.5
    };
    
    routeCache.set(start, end, result);
    return result;
  }

  /**
   * Get multi-modal route with transfers
   */
  static async getMultiModalRoute(
    start: Location,
    end: Location
  ): Promise<MultiModalRoute | null> {
    const segments: RouteSegment[] = [];
    let currentPoint = start;
    let totalDistance = 0;
    let totalDuration = 0;
    let transfers = 0;

    // Find route from start
    const startRoute = this.findClosestRoute(start);
    const endRoute = this.findClosestRoute(end);

    // Walking to first route
    if (startRoute.route && startRoute.distance > 0.05) {
      const walkingTime = Math.round((startRoute.distance / CONFIG.WALKING_SPEED_KMH) * 60);
      segments.push({
        start: currentPoint,
        end: startRoute.nearestPoint!,
        distance: startRoute.distance,
        duration: walkingTime,
        mode: "walk"
      });
      totalDistance += startRoute.distance;
      totalDuration += walkingTime;
      currentPoint = startRoute.nearestPoint!;
    }

    // Transit segment
    if (startRoute.route && endRoute.route && startRoute.route.id === endRoute.route.id) {
      // Same route - calculate distance along route
      const routeDistance = this.estimateUsingRoute(currentPoint, end);
      if (routeDistance) {
        const transitTime = Math.round(routeDistance.distance / 30 * 60); // Assume 30 km/h avg
        segments.push({
          start: currentPoint,
          end: end,
          distance: routeDistance.distance,
          duration: transitTime,
          mode: "transit",
          route: startRoute.route
        });
        totalDistance += routeDistance.distance;
        totalDuration += transitTime;
      }
    } else if (startRoute.route && endRoute.route) {
      // Different routes - need transfer
      transfers = 1;
      
      // First transit segment
      const firstTransitDistance = this.estimateUsingRoute(currentPoint, endRoute.nearestPoint!);
      if (firstTransitDistance) {
        const firstTransitTime = Math.round(firstTransitDistance.distance / 30 * 60);
        segments.push({
          start: currentPoint,
          end: endRoute.nearestPoint!,
          distance: firstTransitDistance.distance,
          duration: firstTransitTime,
          mode: "transit",
          route: startRoute.route
        });
        totalDistance += firstTransitDistance.distance;
        totalDuration += firstTransitTime;
        currentPoint = endRoute.nearestPoint!;
      }
      
      // Walking transfer
      const transferDistance = this.distance(currentPoint, endRoute.nearestPoint!);
      if (transferDistance > 0) {
        const transferTime = Math.round((transferDistance / CONFIG.WALKING_SPEED_KMH) * 60);
        segments.push({
          start: currentPoint,
          end: endRoute.nearestPoint!,
          distance: transferDistance,
          duration: transferTime,
          mode: "walk"
        });
        totalDistance += transferDistance;
        totalDuration += transferTime;
        currentPoint = endRoute.nearestPoint!;
      }
      
      // Second transit segment
      const secondTransitDistance = this.estimateUsingRoute(currentPoint, end);
      if (secondTransitDistance) {
        const secondTransitTime = Math.round(secondTransitDistance.distance / 30 * 60);
        segments.push({
          start: currentPoint,
          end: end,
          distance: secondTransitDistance.distance,
          duration: secondTransitTime,
          mode: "transit",
          route: endRoute.route
        });
        totalDistance += secondTransitDistance.distance;
        totalDuration += secondTransitTime;
      }
    }

    // Final walking if needed
    const finalDistance = this.distance(currentPoint, end);
    if (finalDistance > 0.05) {
      const finalTime = Math.round((finalDistance / CONFIG.WALKING_SPEED_KMH) * 60);
      segments.push({
        start: currentPoint,
        end: end,
        distance: finalDistance,
        duration: finalTime,
        mode: "walk"
      });
      totalDistance += finalDistance;
      totalDuration += finalTime;
    }

    if (segments.length === 0) return null;

    // Estimate fare (simplified)
    const estimatedFare = Math.round(totalDistance * 3.5);

    return {
      segments,
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalDuration,
      transfers,
      estimatedFare
    };
  }

  // ======================================================
  // PRIVATE METHODS
  // ======================================================

  private static findMinDistanceToRouteWithPoint(
    user: Location,
    coordinates: Location[]
  ): { distance: number; nearestPoint: Location; bearing?: number } {
    let minDist = Infinity;
    let nearestPoint = coordinates[0];
    
    const STEP = Math.ceil(coordinates.length / CONFIG.SAMPLE_STEP);

    for (let i = 0; i < coordinates.length; i += STEP) {
      const point = coordinates[i];
      const dist = this.distance(user, point);
      if (dist < minDist) {
        minDist = dist;
        nearestPoint = point;
      }
    }

    return { distance: minDist, nearestPoint };
  }

  private static async tryApiDistance(
    _start: Location,
    _end: Location
  ): Promise<{ distance: number; duration: number; routeIds?: string[] } | null> {
    try {
      // Placeholder for future API integration
      // const res = await fetch(`/api/route?start=${start.lat},${start.lng}&end=${end.lat},${end.lng}`);
      // if (!res.ok) return null;
      // const data = await res.json();
      // return { distance: data.distance, duration: data.duration, routeIds: data.routeIds };
      
      return null; // Not implemented yet
    } catch {
      return null;
    }
  }

  private static estimateUsingRoute(
    start: Location,
    end: Location
  ): { distance: number; routeIds?: string[] } | null {
    const startMatch = this.findClosestRoute(start);
    const endMatch = this.findClosestRoute(end);

    if (!startMatch.route || !endMatch.route) return null;

    // Same route
    if (startMatch.route.name === endMatch.route.name) {
      const distance = this.calculateDistanceAlongRoute(
        startMatch.route,
        startMatch.nearestPoint!,
        endMatch.nearestPoint!
      );
      
      if (distance > 0) {
        return { distance, routeIds: [startMatch.route.id] };
      }
    }
    
    // Different routes - could calculate via transfer
    return null;
  }

  private static calculateDistanceAlongRoute(
    route: Route,
    startPoint: Location,
    endPoint: Location
  ): number {
    const coords = route.coordinates;
    if (!coords || coords.length < 2) return 0;

    // Find indices of nearest points
    let startIdx = 0;
    let endIdx = 0;
    let minStartDist = Infinity;
    let minEndDist = Infinity;

    coords.forEach((point, i) => {
      const dStart = this.distance(startPoint, point);
      const dEnd = this.distance(endPoint, point);

      if (dStart < minStartDist) {
        minStartDist = dStart;
        startIdx = i;
      }
      if (dEnd < minEndDist) {
        minEndDist = dEnd;
        endIdx = i;
      }
    });

    // Calculate distance along route
    let distance = 0;
    const step = startIdx < endIdx ? 1 : -1;

    for (let i = startIdx; i !== endIdx; i += step) {
      const a = coords[i];
      const b = coords[i + step];
      if (!b) break;
      distance += this.distance(a, b);
    }

    // Add distances from points to route
    distance += minStartDist + minEndDist;

    return distance;
  }

  private static calculateConfidence(distance: number): number {
    if (distance <= CONFIG.STRONG_MATCH_DISTANCE_KM) return 0.95;
    if (distance <= CONFIG.MAX_MATCH_DISTANCE_KM) {
      return 1 - (distance - CONFIG.STRONG_MATCH_DISTANCE_KM) /
        (CONFIG.MAX_MATCH_DISTANCE_KM - CONFIG.STRONG_MATCH_DISTANCE_KM);
    }
    return 0;
  }

  // ======================================================
  // UTILITY METHODS
  // ======================================================

  static distance(a: Location, b: Location): number {
    const R = 6371;
    const dLat = (b.lat - a.lat) * (Math.PI / 180);
    const dLon = (b.lng - a.lng) * (Math.PI / 180);
    const lat1 = a.lat * (Math.PI / 180);
    const lat2 = b.lat * (Math.PI / 180);
    const x = Math.sin(dLat / 2) ** 2 +
              Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return R * y;
  }

  static clearCache(): void {
    routeCache.clear();
  }

  static getRouteStats(): { totalRoutes: number; cachedRoutes: number } {
    return {
      totalRoutes: (ROUTE_REGISTRY as Route[]).length,
      cachedRoutes: (routeCache as any).cache.size
    };
  }
}

// ======================================================
// EXPORT TYPES
// ======================================================

export type { RouteCache };