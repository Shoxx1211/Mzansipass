// services/transportEngine.ts

import type { TransitNetwork } from "../types";
import { ROUTE_REGISTRY } from "../constants";

// ---------------- TYPES ----------------
type Location = {
  lat: number;
  lng: number;
  timestamp: number;
};

type DetectionCore = {
  mode: TransitNetwork | "Walking" | "Unknown";
  confidence: number;
};

export type DetectionResult = DetectionCore & {
  speed: number;
  matchedRoute?: string;
};

// ---------------- ENGINE ----------------
export class TransportEngine {
  private static history: Location[] = [];
  private static MAX_HISTORY = 8;

  // ---------------- MAIN ENTRY ----------------
  static updateLocation(lat: number, lng: number): DetectionResult {
    const now = Date.now();

    this.history.push({ lat, lng, timestamp: now });

    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    }

    const speed = this.calculateSmoothedSpeed();
    const stopRate = this.calculateStopRate();
    const routeMatch = this.matchRoute();

    const detection = this.detectMode(speed, stopRate, routeMatch);

    return {
      ...detection,
      speed,
      matchedRoute: routeMatch?.name
    };
  }

  // ---------------- DISTANCE ----------------
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

  // ---------------- SPEED ----------------
  private static calculateSmoothedSpeed(): number {
    if (this.history.length < 2) return 0;

    let totalDistance = 0;
    let totalTime = 0;

    for (let i = 1; i < this.history.length; i++) {
      const a = this.history[i - 1];
      const b = this.history[i];

      const d = this.distance(a, b);
      const t = (b.timestamp - a.timestamp) / 3600000;

      if (t > 0) {
        totalDistance += d;
        totalTime += t;
      }
    }

    if (totalTime === 0) return 0;

    return totalDistance / totalTime;
  }

  private static instantSpeed(a: Location, b: Location): number {
    const d = this.distance(a, b);
    const t = (b.timestamp - a.timestamp) / 3600000;

    return t === 0 ? 0 : d / t;
  }

  // ---------------- STOP RATE ----------------
  private static calculateStopRate(): number {
    if (this.history.length < 3) return 0;

    let stops = 0;

    for (let i = 1; i < this.history.length; i++) {
      const speed = this.instantSpeed(
        this.history[i - 1],
        this.history[i]
      );

      if (speed < 3) stops++;
    }

    return stops / this.history.length;
  }

  // ---------------- ROUTE MATCHING (IMPROVED SAFE VERSION) ----------------
  private static matchRoute() {
    if (this.history.length < 2) return null;

    const start = this.history[0];
    const end = this.history[this.history.length - 1];

    const totalMovement =
      Math.abs(end.lat - start.lat) +
      Math.abs(end.lng - start.lng);

    // 🚫 If barely moved → no route
    if (totalMovement < 0.001) return null;

    // ✅ TEMP: Return ANY known route (placeholder until GPS mapping)
    return ROUTE_REGISTRY[0] || null;
  }

  // ---------------- DETECTION ----------------
  private static detectMode(
    speed: number,
    stopRate: number,
    routeMatch: any
  ): DetectionCore {

    // 🚶 WALKING
    if (speed < 5) {
      return { mode: "Walking", confidence: 0.95 };
    }

    // 🚆 GAUTRAIN (very fast, smooth)
    if (speed > 70 && stopRate < 0.2) {
      return { mode: "Gautrain", confidence: 0.92 };
    }

    // 🚆 METRORAIL (moderate speed + stops)
    if (speed >= 30 && speed <= 90 && stopRate > 0.25) {
      return { mode: "Metrorail", confidence: 0.75 };
    }

    // 🚌 BRT SYSTEMS
    if (speed >= 15 && speed <= 50 && stopRate > 0.35) {
      return {
        mode: routeMatch?.network || "Rea Vaya",
        confidence: 0.85
      };
    }

    // 🚖 TAXI (fallback vehicle logic)
    if (speed >= 20 && speed <= 100) {
      return { mode: "Taxi", confidence: 0.7 };
    }

    return { mode: "Unknown", confidence: 0.4 };
  }

  // ---------------- RESET ----------------
  static reset() {
    this.history = [];
  }
}