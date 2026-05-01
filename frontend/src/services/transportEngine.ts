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
  isVehicular: boolean;
  movementState: "moving" | "idle"; // 🔥 NEW (important for TripEngine)
};

// ---------------- ENGINE ----------------
export class TransportEngine {
  private static history: Location[] = [];
  private static MAX_HISTORY = 12;

  // 🔥 Stability layer
  private static lastMode: DetectionCore = {
    mode: "Unknown",
    confidence: 0
  };

  private static lastUpdateTime = 0;

  // ---------------- MAIN ENTRY ----------------
  static updateLocation(lat: number, lng: number): DetectionResult {
    const now = Date.now();

    const newPoint: Location = { lat, lng, timestamp: now };

    // 🔥 HANDLE GPS DROPOUT (no updates for a while)
    if (this.lastUpdateTime && now - this.lastUpdateTime > 15000) {
      console.warn("⚠️ GPS signal weak / resumed");
      this.resetHistory();
    }

    this.lastUpdateTime = now;

    // ---------------- JITTER FILTER ----------------
    if (this.history.length > 0) {
      const last = this.history[this.history.length - 1];
      const jitterDistance = this.distance(last, newPoint);

      if (jitterDistance < 0.01) {
        return this.buildIdleResult();
      }
    }

    this.history.push(newPoint);

    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    }

    const speed = this.calculateSmoothedSpeed();
    const stopRate = this.calculateStopRate();
    const routeMatch = this.matchRoute();

    const rawDetection = this.detectMode(speed, stopRate, routeMatch);

    // 🔥 STABILIZE MODE (reduce jumping)
    const detection = this.stabilizeDetection(rawDetection);

    const movementState = speed > 5 ? "moving" : "idle";

    return {
      ...detection,
      speed,
      matchedRoute: routeMatch?.name,
      isVehicular: speed > 12,
      movementState
    };
  }

  // ---------------- STABILITY LAYER ----------------
  private static stabilizeDetection(newDetection: DetectionCore): DetectionCore {
    // If confidence low → keep previous
    if (newDetection.confidence < 0.6 && this.lastMode.confidence > 0.7) {
      return this.lastMode;
    }

    // Smooth transition
    const blendedConfidence =
      (newDetection.confidence + this.lastMode.confidence) / 2;

    const result = {
      mode: newDetection.mode,
      confidence: blendedConfidence
    };

    this.lastMode = result;

    return result;
  }

  // ---------------- IDLE RESULT ----------------
  private static buildIdleResult(): DetectionResult {
    return {
      mode: "Walking",
      confidence: 0.6,
      speed: 0,
      isVehicular: false,
      movementState: "idle"
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

  // ---------------- ROUTE MATCHING ----------------
  private static matchRoute(): { name: string; network: TransitNetwork } | null {
    if (this.history.length < 2) return null;

    const start = this.history[0];
    const end = this.history[this.history.length - 1];

    const movement =
      Math.abs(end.lat - start.lat) +
      Math.abs(end.lng - start.lng);

    if (movement < 0.002) return null;

    return ROUTE_REGISTRY.length > 0 ? ROUTE_REGISTRY[0] : null;
  }

  // ---------------- DETECTION ----------------
  private static detectMode(
    speed: number,
    stopRate: number,
    routeMatch: { name: string; network: TransitNetwork } | null
  ): DetectionCore {

    if (speed < 5) {
      return { mode: "Walking", confidence: 0.95 };
    }

    if (speed > 70 && stopRate < 0.2) {
      return { mode: "Gautrain", confidence: 0.92 };
    }

    if (speed >= 30 && speed <= 90 && stopRate > 0.25) {
      return { mode: "Metrorail", confidence: 0.8 };
    }

    if (speed >= 15 && speed <= 50 && stopRate > 0.3) {
      return {
        mode: routeMatch?.network || "Rea Vaya",
        confidence: 0.88
      };
    }

    if (speed >= 20 && speed <= 120) {
      return { mode: "Taxi", confidence: 0.75 };
    }

    return { mode: "Unknown", confidence: 0.5 };
  }

  // ---------------- RESET ----------------
  static reset() {
    this.history = [];
    this.lastMode = { mode: "Unknown", confidence: 0 };
  }

  private static resetHistory() {
    this.history = [];
  }
}