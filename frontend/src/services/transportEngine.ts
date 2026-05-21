// src/services/transportEngine.ts
// Pulse Transit - Premium Transport Detection Engine
// Features: ML-ready detection, real-time adaptation, confidence scoring, multi-modal detection

import type { TransitNetwork } from "../types";
import { ROUTE_REGISTRY } from "../constants";

// ======================================================
// TYPES
// ======================================================

type Location = {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
  speed?: number;
};

type DetectionCore = {
  mode: TransitNetwork | "Walking" | "Running" | "Cycling" | "Unknown";
  confidence: number;
};

export type DetectionResult = DetectionCore & {
  speed: number;
  matchedRoute?: string;
  isVehicular: boolean;
  movementState: "moving" | "idle";
  acceleration?: number;
  movementPattern?: "steady" | "stop-start" | "erratic" | "smooth";
};

export type TransportProfile = {
  primaryMode: TransitNetwork | "Walking" | "Unknown";
  secondaryModes: Array<{ mode: string; frequency: number }>;
  averageSpeed: number;
  typicalStopsPerKm: number;
  preferredTimes: number[];
};

// ======================================================
// CONSTANTS
// ======================================================

const CONFIG = {
  MAX_HISTORY: 20,
  SPEED_SMOOTHING_WINDOW: 5,
  CONFIDENCE_DECAY_RATE: 0.05,
  MIN_CONFIDENCE: 0.5,
  
  // Speed thresholds (km/h)
  WALKING_MAX: 6,
  RUNNING_MAX: 12,
  CYCLING_MAX: 30,
  TAXI_MIN: 15,
  TAXI_MAX: 80,
  BUS_MIN: 20,
  BUS_MAX: 60,
  TRAIN_MIN: 50,
  TRAIN_MAX: 120,
  GAUTRAIN_MIN: 70,
  
  // Stop detection
  STOP_SPEED_THRESHOLD: 3,
  STOP_DURATION_MS: 10000,
  
  // Jitter filter
  MIN_MOVEMENT_KM: 0.005,
  
  // GPS dropout
  GPS_DROPOUT_MS: 15000,
  
  // Pattern detection
  ACCELERATION_THRESHOLD: 5,
  SMOOTH_MOVEMENT_THRESHOLD: 0.3
};

// ======================================================
// DETECTION PATTERNS
// ======================================================

interface TransportPattern {
  name: string;
  speedRange: [number, number];
  stopRateRange: [number, number];
  accelerationPattern: "smooth" | "stop-start" | "erratic";
  typicalStopDistance: number;
  confidenceWeight: number;
}

const TRANSPORT_PATTERNS: Record<string, TransportPattern> = {
  Walking: {
    name: "Walking",
    speedRange: [0, CONFIG.WALKING_MAX],
    stopRateRange: [0.4, 1],
    accelerationPattern: "erratic",
    typicalStopDistance: 0.05,
    confidenceWeight: 0.95
  },
  Running: {
    name: "Running",
    speedRange: [CONFIG.WALKING_MAX, CONFIG.RUNNING_MAX],
    stopRateRange: [0.2, 0.6],
    accelerationPattern: "erratic",
    typicalStopDistance: 0.1,
    confidenceWeight: 0.85
  },
  Cycling: {
    name: "Cycling",
    speedRange: [CONFIG.RUNNING_MAX, CONFIG.CYCLING_MAX],
    stopRateRange: [0.1, 0.4],
    accelerationPattern: "smooth",
    typicalStopDistance: 0.3,
    confidenceWeight: 0.85
  },
  Taxi: {
    name: "Taxi",
    speedRange: [CONFIG.TAXI_MIN, CONFIG.TAXI_MAX],
    stopRateRange: [0.15, 0.45],
    accelerationPattern: "stop-start",
    typicalStopDistance: 0.5,
    confidenceWeight: 0.8
  },
  "Rea Vaya": {
    name: "Rea Vaya",
    speedRange: [CONFIG.BUS_MIN, CONFIG.BUS_MAX],
    stopRateRange: [0.2, 0.5],
    accelerationPattern: "stop-start",
    typicalStopDistance: 0.8,
    confidenceWeight: 0.85
  },
  "A Re Yeng": {
    name: "A Re Yeng",
    speedRange: [CONFIG.BUS_MIN, CONFIG.BUS_MAX],
    stopRateRange: [0.2, 0.5],
    accelerationPattern: "stop-start",
    typicalStopDistance: 0.8,
    confidenceWeight: 0.85
  },
  Metrorail: {
    name: "Metrorail",
    speedRange: [CONFIG.TRAIN_MIN, CONFIG.TRAIN_MAX],
    stopRateRange: [0.1, 0.3],
    accelerationPattern: "smooth",
    typicalStopDistance: 2,
    confidenceWeight: 0.85
  },
  Gautrain: {
    name: "Gautrain",
    speedRange: [CONFIG.GAUTRAIN_MIN, CONFIG.TRAIN_MAX],
    stopRateRange: [0.05, 0.15],
    accelerationPattern: "smooth",
    typicalStopDistance: 5,
    confidenceWeight: 0.9
  }
};

// ======================================================
// MAIN ENGINE
// ======================================================

export class TransportEngine {
  private static history: Location[] = [];
  private static speedHistory: number[] = [];
  
  // Stability layer
  private static lastMode: DetectionCore = {
    mode: "Unknown",
    confidence: 0
  };
  private static lastUpdateTime = 0;
  private static consecutiveSameMode = 0;

  // ======================================================
  // MAIN ENTRY POINT
  // ======================================================
  
  static updateLocation(lat: number, lng: number, accuracy?: number, rawSpeed?: number): DetectionResult {
    const now = Date.now();

    const newPoint: Location = { 
      lat, 
      lng, 
      timestamp: now,
      accuracy,
      speed: rawSpeed
    };

    // Handle GPS dropout
    if (this.lastUpdateTime && now - this.lastUpdateTime > CONFIG.GPS_DROPOUT_MS) {
      console.warn("⚠️ GPS signal resumed after dropout");
      this.resetHistory();
    }

    this.lastUpdateTime = now;

    // Jitter filter - ignore tiny movements
    if (this.history.length > 0) {
      const last = this.history[this.history.length - 1];
      const jitterDistance = this.distance(last, newPoint);

      if (jitterDistance < CONFIG.MIN_MOVEMENT_KM) {
        return this.buildIdleResult();
      }
    }

    this.history.push(newPoint);
    if (this.history.length > CONFIG.MAX_HISTORY) {
      this.history.shift();
    }

    // Calculate metrics
    const speed = this.calculateSmoothedSpeed();
    const stopRate = this.calculateStopRate();
    const acceleration = this.calculateAcceleration();
    const movementPattern = this.detectMovementPattern(speed, stopRate, acceleration);
    const routeMatch = this.matchRoute();
    
    // Detect mode based on patterns
    const rawDetection = this.detectModeWithPatterns(speed, stopRate, acceleration, movementPattern, routeMatch);
    
    // Stabilize detection (reduce jumping)
    const detection = this.stabilizeDetection(rawDetection);
    
    // Update mode history
    if (detection.mode === this.lastMode.mode) {
      this.consecutiveSameMode++;
    } else {
      this.consecutiveSameMode = 0;
    }
    
    this.lastMode = detection;

    const movementState = speed > CONFIG.STOP_SPEED_THRESHOLD ? "moving" : "idle";

    return {
      ...detection,
      speed: Math.round(speed * 10) / 10,
      matchedRoute: routeMatch?.name,
      isVehicular: speed > CONFIG.TAXI_MIN,
      movementState,
      acceleration: Math.round(acceleration * 10) / 10,
      movementPattern
    };
  }

  // ======================================================
  // PATTERN-BASED DETECTION (ENHANCED)
  // ======================================================
  
  private static detectModeWithPatterns(
    speed: number,
    stopRate: number,
    _acceleration: number,
    movementPattern: string,
    routeMatch: { name: string; network: TransitNetwork } | null
  ): DetectionCore {
    let bestMatch: DetectionCore = { mode: "Unknown", confidence: 0.3 };
    
    // Use predefined patterns for detection
    for (const [mode, pattern] of Object.entries(TRANSPORT_PATTERNS)) {
      if (speed >= pattern.speedRange[0] && speed <= pattern.speedRange[1]) {
        let confidence = pattern.confidenceWeight;
        
        // Adjust confidence based on stop rate
        const stopRateMatch = stopRate >= pattern.stopRateRange[0] && 
                             stopRate <= pattern.stopRateRange[1];
        if (stopRateMatch) confidence += 0.1;
        else confidence -= 0.15;
        
        // Adjust based on movement pattern
        if (movementPattern === pattern.accelerationPattern) confidence += 0.05;
        else if (pattern.accelerationPattern === "smooth" && movementPattern === "steady") confidence += 0.03;
        
        // Route match boost
        if (routeMatch && mode === routeMatch.network) confidence += 0.1;
        
        // Speed consistency boost
        if (this.isSpeedConsistent(speed)) confidence += 0.05;
        
        if (confidence > bestMatch.confidence) {
          bestMatch = { 
            mode: mode as any, 
            confidence: Math.min(0.98, confidence) 
          };
        }
      }
    }
    
    // Special handling for unknown but moving
    if (bestMatch.mode === "Unknown" && speed > CONFIG.WALKING_MAX) {
      if (speed > CONFIG.TRAIN_MIN) {
        return { mode: "Metrorail", confidence: 0.6 };
      }
      if (speed > CONFIG.TAXI_MIN) {
        return { mode: "Taxi", confidence: 0.65 };
      }
      return { mode: "Walking", confidence: 0.55 };
    }
    
    return bestMatch;
  }

  // ======================================================
  // STABILITY LAYER (ENHANCED)
  // ======================================================
  
  private static stabilizeDetection(newDetection: DetectionCore): DetectionCore {
    // High confidence detection - accept immediately
    if (newDetection.confidence > 0.85) {
      return newDetection;
    }
    
    // Low confidence and previous was high - keep previous
    if (newDetection.confidence < 0.6 && this.lastMode.confidence > 0.75) {
      return this.lastMode;
    }
    
    // Medium confidence - blend with previous
    if (newDetection.confidence < 0.7 && this.lastMode.confidence > 0.6) {
      const blendedConfidence = (newDetection.confidence + this.lastMode.confidence) / 2;
      return {
        mode: this.lastMode.confidence > newDetection.confidence ? this.lastMode.mode : newDetection.mode,
        confidence: blendedConfidence
      };
    }
    
    // Apply confidence decay if mode hasn't changed recently
    if (this.consecutiveSameMode > 5 && newDetection.mode === this.lastMode.mode) {
      const decayed = Math.max(CONFIG.MIN_CONFIDENCE, newDetection.confidence - CONFIG.CONFIDENCE_DECAY_RATE);
      return { ...newDetection, confidence: decayed };
    }
    
    return newDetection;
  }

  // ======================================================
  // METRICS CALCULATION
  // ======================================================
  
  private static calculateSmoothedSpeed(): number {
    if (this.history.length < 2) return 0;
    
    const speeds: number[] = [];
    
    for (let i = 1; i < this.history.length; i++) {
      const speed = this.instantSpeed(this.history[i - 1], this.history[i]);
      if (speed > 0 && speed < 200) {
        speeds.push(speed);
      }
    }
    
    if (speeds.length === 0) return 0;
    
    // Update speed history
    this.speedHistory.push(speeds[speeds.length - 1]);
    if (this.speedHistory.length > CONFIG.SPEED_SMOOTHING_WINDOW) {
      this.speedHistory.shift();
    }
    
    // Return median for stability
    const sorted = [...this.speedHistory].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  private static instantSpeed(a: Location, b: Location): number {
    const d = this.distance(a, b);
    const t = (b.timestamp - a.timestamp) / 3600000;
    return t === 0 ? 0 : d / t;
  }

  private static calculateStopRate(): number {
    if (this.history.length < 3) return 0;
    
    let stops = 0;
    let wasStopped = false;
    
    for (let i = 1; i < this.history.length; i++) {
      const speed = this.instantSpeed(this.history[i - 1], this.history[i]);
      const isStopped = speed < CONFIG.STOP_SPEED_THRESHOLD;
      
      if (isStopped && !wasStopped) {
        stops++;
        wasStopped = true;
      } else if (!isStopped) {
        wasStopped = false;
      }
    }
    
    return stops / this.history.length;
  }

  private static calculateAcceleration(): number {
    if (this.speedHistory.length < 2) return 0;
    
    const lastSpeed = this.speedHistory[this.speedHistory.length - 1];
    const prevSpeed = this.speedHistory[this.speedHistory.length - 2];
    const timeDiff = 1;
    
    return (lastSpeed - prevSpeed) / timeDiff;
  }

  private static detectMovementPattern(
    speed: number,
    stopRate: number,
    acceleration: number
  ): "steady" | "stop-start" | "erratic" | "smooth" {
    if (stopRate > 0.4) return "stop-start";
    if (Math.abs(acceleration) > CONFIG.ACCELERATION_THRESHOLD) return "erratic";
    if (stopRate < 0.1 && speed > 30) return "smooth";
    return "steady";
  }

  private static isSpeedConsistent(_speed: number): boolean {
    if (this.speedHistory.length < 3) return true;
    
    const recent = this.speedHistory.slice(-3);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / recent.length;
    
    return variance < 50;
  }

  // ======================================================
  // ROUTE MATCHING
  // ======================================================
  
  private static matchRoute(): { name: string; network: TransitNetwork } | null {
    if (this.history.length < 2) return null;
    
    const start = this.history[0];
    const end = this.history[this.history.length - 1];
    
    const movement = Math.abs(end.lat - start.lat) + Math.abs(end.lng - start.lng);
    if (movement < 0.002) return null;
    
    // Find best matching route based on proximity
    let bestMatch = null;
    let bestScore = 0;
    
    for (const route of ROUTE_REGISTRY) {
      if (route.coordinates && route.coordinates.length > 0) {
        // Simple proximity check
        const startDist = this.distanceToRoute(start, route.coordinates);
        const endDist = this.distanceToRoute(end, route.coordinates);
        const score = (1 / (startDist + 0.1)) + (1 / (endDist + 0.1));
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = route;
        }
      }
    }
    
    return bestMatch ? { name: bestMatch.name, network: bestMatch.network } : null;
  }

  private static distanceToRoute(point: Location, routeCoords: { lat: number; lng: number; }[]): number {
    let minDist = Infinity;
    for (const coord of routeCoords) {
      const dist = this.distanceBetweenPoints(point.lat, point.lng, coord.lat, coord.lng);
      if (dist < minDist) minDist = dist;
    }
    return minDist;
  }

  private static distanceBetweenPoints(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lng2 - lng1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // ======================================================
  // UTILITY METHODS
  // ======================================================
  
  private static buildIdleResult(): DetectionResult {
    return {
      mode: "Walking",
      confidence: 0.6,
      speed: 0,
      isVehicular: false,
      movementState: "idle",
      movementPattern: "steady"
    };
  }

  private static distance(a: Location, b: Location): number {
    return this.distanceBetweenPoints(a.lat, a.lng, b.lat, b.lng);
  }

  // ======================================================
  // PUBLIC API
  // ======================================================
  
  static reset(): void {
    this.history = [];
    this.speedHistory = [];
    this.lastMode = { mode: "Unknown", confidence: 0 };
    this.consecutiveSameMode = 0;
    console.log("🔄 Transport engine reset");
  }

  private static resetHistory(): void {
    this.history = [];
    this.speedHistory = [];
  }

  static getTransportProfile(): TransportProfile {
    return {
      primaryMode: "Unknown",
      secondaryModes: [],
      averageSpeed: 0,
      typicalStopsPerKm: 0,
      preferredTimes: []
    };
  }

  static getDetectionStats(): {
    historySize: number;
    currentMode: string;
    currentConfidence: number;
    consecutiveModeCount: number;
  } {
    return {
      historySize: this.history.length,
      currentMode: this.lastMode.mode,
      currentConfidence: this.lastMode.confidence,
      consecutiveModeCount: this.consecutiveSameMode
    };
  }
}

// ======================================================
// EXPORT TYPES
// ======================================================

export type { TransportPattern };
export { TRANSPORT_PATTERNS };