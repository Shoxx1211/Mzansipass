// src/services/tripEngine.ts
// Pulse Transit - Premium Trip Engine
// Features: Auto-recovery, trip analytics, smart prompting, offline support

import { FareEngine } from "./fareService";
import { RouteEngine } from "./routeEngine";
import { TransportEngine } from "./transportEngine";
import { HabitEngine } from "./habitEngine";
import {
  getCurrentLocation,
  calculateDistance,
  getLastKnownLocation,
  isLocationStale
} from "./location";

import type { Location, TransitNetwork } from "../types";

// ======================================================
// TYPES
// ======================================================

export interface TripState {
  active: boolean;
  transport?: string;
  startLocation?: Location;
  endLocation?: Location;
  destination?: Location;
  lastLocation?: Location;
  startTime?: number;
  lastMoveTime?: number;
  lastUpdateTime?: number;
  distance: number;
  path: Location[];
  paused?: boolean;
  pauseReason?: string;
}

export interface TripPrompt {
  prompt: true;
  detectedMode: string;
  confidence: number;
  speed: number;
  suggestedTransport?: string;
}

export interface TripSummary {
  fare: number;
  fareConfidence: number;
  fareSource: "distance" | "learned" | "cached";
  distance: number;
  network: string;
  route: string;
  duration: number;
  durationMinutes: number;
  averageSpeed: number;
  startLocation: Location;
  endLocation: Location;
  path: Location[];
  carbonSaved?: number;
  caloriesBurned?: number;
  efficiency?: number;
}

export interface TripEstimate {
  distance: number;
  fare: number;
  confidence: number;
  duration?: number;
  carbonSaved?: number;
}

// ======================================================
// CONSTANTS
// ======================================================

const CONFIG = {
  VEHICLE_SPEED_THRESHOLD: 10,
  STOP_SPEED_THRESHOLD: 4,
  STOP_TIME_MS: 60000, // 1 minute
  PAUSE_TIME_MS: 300000, // 5 minutes
  MIN_TRACK_POINTS: 5,
  AUTO_END_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
  SAVE_INTERVAL_MS: 10000, // Save every 10 seconds
  MIN_DISTANCE_FOR_TRIP_KM: 0.2,
  RECOVERY_CHECK_INTERVAL_MS: 5000
};

const STORAGE_KEY = "pulse_active_trip_v2";

// ======================================================
// STATE MANAGEMENT WITH PERSISTENCE
// ======================================================

class TripStateManager {
  private static trip: TripState = {
    active: false,
    distance: 0,
    path: []
  };
  private static saveInterval: NodeJS.Timeout | null = null;

  static get(): TripState {
    return { ...this.trip };
  }

  static set(newState: Partial<TripState>): void {
    this.trip = { ...this.trip, ...newState };
    this.persist();
  }

  static reset(): void {
    this.trip = {
      active: false,
      distance: 0,
      path: []
    };
    this.persist();
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
  }

  static start(): void {
    if (this.saveInterval) clearInterval(this.saveInterval);
    this.saveInterval = setInterval(() => this.persist(), CONFIG.SAVE_INTERVAL_MS);
  }

  private static persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...this.trip,
        lastUpdateTime: Date.now()
      }));
    } catch (error) {
      console.error("Failed to persist trip state:", error);
    }
  }

  static restore(): boolean {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.active && parsed.startTime) {
          // Check if trip is not too old
          const age = Date.now() - (parsed.lastUpdateTime || parsed.startTime);
          if (age < CONFIG.AUTO_END_TIMEOUT_MS) {
            this.trip = parsed;
            this.start();
            console.log("♻️ Restored active trip", { age: Math.round(age / 1000) + "s" });
            return true;
          }
        }
      }
    } catch (error) {
      console.error("Failed to restore trip state:", error);
    }
    return false;
  }

  static isActive(): boolean {
    return this.trip.active && !this.trip.paused;
  }

  static isPaused(): boolean {
    return this.trip.active && !!this.trip.paused;
  }
}

// ======================================================
// MAIN ENGINE
// ======================================================

export class TripEngine {
  
  // ======================================================
  // INITIALIZATION
  // ======================================================
  
  static initialize(): void {
    TripStateManager.restore();
    console.log("🚀 TripEngine initialized");
  }

  // ======================================================
  // MAIN LOOP (ENHANCED)
  // ======================================================
  
  static async tick(): Promise<TripPrompt | null> {
    let location: Location;

    try {
      // Try to get fresh location
      location = await getCurrentLocation();
    } catch {
      // Fallback to last known location
      const lastKnown = getLastKnownLocation();
      if (lastKnown && !isLocationStale()) {
        location = lastKnown;
      } else {
        return null;
      }
    }

    const detection = TransportEngine.updateLocation(
      location.lat,
      location.lng,
      location.accuracy,
      location.speed
    );

    const { speed, mode, confidence, isVehicular } = detection;
    const now = Date.now();

    // ======================================================
    // AUTO PROMPT (Start detection)
    // ======================================================
    const isMovingVehicular = isVehicular && confidence > 0.7 && speed > CONFIG.VEHICLE_SPEED_THRESHOLD;
    
    if (isMovingVehicular && !TripStateManager.isActive() && !TripStateManager.isPaused()) {
      return {
        prompt: true,
        detectedMode: mode,
        confidence,
        speed,
        suggestedTransport: mode !== "Unknown" ? mode : "Taxi"
      };
    }

    // ======================================================
    // ACTIVE TRACKING
    // ======================================================
    if (TripStateManager.isActive()) {
      this.updateDistance(location);
      TripStateManager.set({ lastLocation: location, lastUpdateTime: now });

      // Update last move time
      if (speed > CONFIG.STOP_SPEED_THRESHOLD) {
        TripStateManager.set({ lastMoveTime: now });
      }

      // Check for auto-pause (stopped too long)
      const trip = TripStateManager.get();
      const stoppedTooLong = trip.lastMoveTime && (now - trip.lastMoveTime) > CONFIG.STOP_TIME_MS;
      
      if (stoppedTooLong && !trip.paused) {
        TripStateManager.set({ 
          paused: true, 
          pauseReason: "Stopped for extended period" 
        });
        console.log("⏸️ Trip auto-paused due to inactivity");
      }

      // Check for auto-resume
      const wasPaused = trip.paused;
      if (wasPaused && speed > CONFIG.VEHICLE_SPEED_THRESHOLD) {
        TripStateManager.set({ 
          paused: false, 
          pauseReason: undefined 
        });
        console.log("▶️ Trip auto-resumed");
      }

     // Auto-end if too long without movement
const lastActivity = trip.lastMoveTime || trip.startTime || now;
const inactiveTooLong = (now - lastActivity) > CONFIG.AUTO_END_TIMEOUT_MS;
if (inactiveTooLong) {
  console.log("⏹️ Auto-ending trip due to prolonged inactivity");
  await this.endTrip(location);  // Just end the trip, don't return
  return null;  // Return null, not TripSummary
}

      // Add to path (sampled, not every point)
      const lastPoint = trip.path[trip.path.length - 1];
      const shouldAddPoint = !lastPoint || 
        calculateDistance(lastPoint, location) > 0.02; // ~20 meters
      
      if (shouldAddPoint) {
        const newPath = [...trip.path, location];
        if (newPath.length > 1000) newPath.shift(); // Limit path size
        TripStateManager.set({ path: newPath });
      }
    }

    return null;
  }

  // ======================================================
  // START TRIP (ENHANCED)
  // ======================================================
  
  static startTrip(
    transport: string,
    location: Location,
    destination?: Location,
    destinationName?: string
  ): void {
    TransportEngine.reset();
    
    const now = Date.now();

    TripStateManager.set({
      active: true,
      transport,
      startLocation: location,
      lastLocation: location,
      startTime: now,
      lastMoveTime: now,
      lastUpdateTime: now,
      distance: 0,
      path: [location],
      destination,
      paused: false,
      pauseReason: undefined
    });
    
    TripStateManager.start();

    console.log("✅ Trip started:", transport, destinationName ? `to ${destinationName}` : "");
  }

  // ======================================================
  // PAUSE/RESUME TRIP
  // ======================================================
  
  static pauseTrip(reason?: string): void {
    if (TripStateManager.isActive() && !TripStateManager.isPaused()) {
      TripStateManager.set({ 
        paused: true, 
        pauseReason: reason || "Manually paused" 
      });
      console.log("⏸️ Trip paused:", reason);
    }
  }

  static resumeTrip(): void {
    if (TripStateManager.isPaused()) {
      TripStateManager.set({ 
        paused: false, 
        pauseReason: undefined,
        lastMoveTime: Date.now()
      });
      console.log("▶️ Trip resumed");
    }
  }

  // ======================================================
  // UPDATE TRIP (manual update)
  // ======================================================
  
  static updateTrip(transport?: string, destination?: Location): void {
    if (transport) {
      TripStateManager.set({ transport });
    }
    if (destination) {
      TripStateManager.set({ destination });
    }
    console.log("📝 Trip updated");
  }

  // ======================================================
  // DISTANCE TRACKING (ENHANCED)
  // ======================================================
  
  private static updateDistance(current: Location): void {
    const trip = TripStateManager.get();
    const last = trip.lastLocation;
    if (!last) return;

    const delta = calculateDistance(last, current);

    // Filter noise
    if (delta < 0.01) return;
    // Filter unrealistic jumps
    if (delta > 0.5) return;

    const newDistance = trip.distance + delta;
    TripStateManager.set({ distance: newDistance });
  }

  // ======================================================
  // RESOLVE FINAL DISTANCE (ENHANCED)
  // ======================================================
  
  private static async resolveFinalDistance(endLocation: Location): Promise<number> {
    const trip = TripStateManager.get();
    const points = trip.path.length;

    // Good GPS tracking
    if (points >= CONFIG.MIN_TRACK_POINTS && trip.distance > 0) {
      return trip.distance;
    }

    // Fallback to route engine
    if (trip.startLocation) {
      try {
        const routeResult = await RouteEngine.estimateRouteDistance(
          trip.startLocation,
          endLocation
        );
        return routeResult.distance;
      } catch {
        return calculateDistance(trip.startLocation, endLocation);
      }
    }

    return trip.distance;
  }

  // ======================================================
  // END TRIP (ENHANCED)
  // ======================================================
  
  static async endTrip(endLocation: Location): Promise<TripSummary | null> {
    const trip = TripStateManager.get();
    
    if (!trip.active || !trip.startLocation || !trip.transport) {
      console.warn("Cannot end trip: No active trip");
      return null;
    }

    // Calculate final metrics
    const distance = await this.resolveFinalDistance(endLocation);
    const duration = Date.now() - (trip.startTime || Date.now());
    const durationMinutes = Math.round(duration / 1000 / 60);
    const averageSpeed = durationMinutes > 0 ? distance / (durationMinutes / 60) : 0;

    // Get final transport detection

    // Calculate fare
    const fareResult = await FareEngine.computeFinalFare({
      network: trip.transport as TransitNetwork,
      distance
    });

    // Find route match
    const routeResult = RouteEngine.findClosestRoute(endLocation);

    // Learn habit
    try {
      HabitEngine.learn(
        trip.transport as TransitNetwork,
        trip.startLocation,
        endLocation,
        fareResult.fare,
        durationMinutes
      );
    } catch (err) {
      console.warn("Habit learning failed:", err);
    }

    // Calculate additional metrics
    const carbonSaved = distance * 0.12; // Approximate CO2 saved vs car
    const caloriesBurned = distance * 50; // Approximate calories burned
    const efficiency = Math.min(100, Math.round((averageSpeed / 40) * 100));

    const tripSummary: TripSummary = {
      fare: fareResult.fare,
      fareConfidence: fareResult.confidence,
      fareSource: fareResult.source,
      distance: Math.round(distance * 100) / 100,
      network: trip.transport,
      route: routeResult.route?.name || "Unknown",
      duration,
      durationMinutes,
      averageSpeed: Math.round(averageSpeed * 10) / 10,
      startLocation: trip.startLocation,
      endLocation,
      path: trip.path,
      carbonSaved: Math.round(carbonSaved * 100) / 100,
      caloriesBurned: Math.round(caloriesBurned),
      efficiency
    };

    console.log("💰 Trip Completed:", {
      network: tripSummary.network,
      distance: tripSummary.distance + "km",
      duration: tripSummary.durationMinutes + "min",
      fare: "R" + tripSummary.fare,
      efficiency: tripSummary.efficiency + "%"
    });

    // Reset state
    TripStateManager.reset();
    TransportEngine.reset();

    return tripSummary;
  }

  // ======================================================
  // CANCEL TRIP
  // ======================================================
  
  static cancelTrip(): void {
    if (TripStateManager.isActive()) {
      TripStateManager.reset();
      TransportEngine.reset();
      console.log("❌ Trip cancelled");
    }
  }

  // ======================================================
  // PRE-TRIP ESTIMATION (ENHANCED)
  // ======================================================
  
  static async estimateTrip(
    start: Location,
    end: Location,
    transport: string
  ): Promise<TripEstimate | null> {
    try {
      const routeResult = await RouteEngine.estimateRouteDistance(start, end);
      
      const fareResult = await FareEngine.computeFinalFare({
        network: transport as TransitNetwork,
        distance: routeResult.distance
      });

      const duration = routeResult.duration;
      const carbonSaved = routeResult.distance * 0.12;

      return {
        distance: Math.round(routeResult.distance * 100) / 100,
        fare: Math.round(fareResult.fare * 100) / 100,
        confidence: fareResult.confidence,
        duration,
        carbonSaved: Math.round(carbonSaved * 100) / 100
      };
    } catch (err) {
      console.error("❌ Estimation failed", err);
      return null;
    }
  }

  // ======================================================
  // GET TRIP STATUS
  // ======================================================
  
  static getTripStatus(): {
    active: boolean;
    paused: boolean;
    transport?: string;
    duration?: number;
    distance?: number;
    destination?: Location;
  } {
    const trip = TripStateManager.get();
    const now = Date.now();
    
    return {
      active: trip.active,
      paused: !!trip.paused,
      transport: trip.transport,
      duration: trip.startTime ? now - trip.startTime : undefined,
      distance: trip.distance,
      destination: trip.destination
    };
  }

  // ======================================================
  // HABIT PREDICTION
  // ======================================================
  
  static async getPrediction(currentLocation: Location) {
    try {
      return HabitEngine.predict(currentLocation);
    } catch {
      return { network: null, confidence: 0 };
    }
  }

  // ======================================================
  // RESET
  // ======================================================
  
  static reset(): void {
    TripStateManager.reset();
    TransportEngine.reset();
    console.log("🔄 TripEngine reset");
  }

  // ======================================================
  // UTILITY
  // ======================================================
  
  static isTripValid(): boolean {
    const trip = TripStateManager.get();
    if (!trip.active) return false;
    if (!trip.startLocation) return false;
    if (trip.distance < CONFIG.MIN_DISTANCE_FOR_TRIP_KM && 
        (!trip.startTime || Date.now() - trip.startTime < 60000)) {
      return false;
    }
    return true;
  }
}

// ======================================================
// AUTO-RECOVERY CHECK
// ======================================================

let recoveryInterval: NodeJS.Timeout | null = null;

export const startRecoveryCheck = (): void => {
  if (recoveryInterval) clearInterval(recoveryInterval);
  
  recoveryInterval = setInterval(() => {
    const status = TripEngine.getTripStatus();
    if (status.active && !status.paused) {
      const lastLocation = getLastKnownLocation();
      if (lastLocation && !isLocationStale()) {
        // Attempt to continue tracking
        TripEngine.tick().catch(console.error);
      }
    }
  }, CONFIG.RECOVERY_CHECK_INTERVAL_MS);
};

export const stopRecoveryCheck = (): void => {
  if (recoveryInterval) {
    clearInterval(recoveryInterval);
    recoveryInterval = null;
  }
};

// ======================================================
// INITIALIZE
// ======================================================

TripEngine.initialize();

