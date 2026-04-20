// services/tripEngine.ts

import { FareEngine } from "./fareService";
import { RouteEngine } from "./routeEngine";
import { TransportEngine } from "./transportEngine";
import { getCurrentLocation, calculateDistance } from "./location";
import type { Location } from "../types";

// ---------------- CONFIG ----------------
const CONFIG = {
  VEHICLE_SPEED_THRESHOLD: 10,
  STOP_SPEED_THRESHOLD: 4,
  STOP_TIME_MS: 60000, // 60s buffer before ending trip
};

// ---------------- STATE ----------------
interface TripState {
  active: boolean;
  transport?: string;
  startLocation?: Location;
  lastLocation?: Location;
  startTime?: number;
  lastMoveTime?: number;
  distance: number; // 🔥 accumulated trip distance
}

export class TripEngine {
  private static trip: TripState = {
    active: false,
    distance: 0,
  };

  // ===============================
  // 🚀 MAIN LOOP (call every 3–5s)
  // ===============================
  static async tick() {
    const location = await getCurrentLocation();

    // 🔥 SINGLE detection call (CRITICAL FIX)
    const detection = TransportEngine.updateLocation(
      location.lat,
      location.lng
    );

    const { speed, mode, confidence } = detection;

    const isVehicular =
      mode !== "Walking" &&
      confidence > 0.7 &&
      speed > CONFIG.VEHICLE_SPEED_THRESHOLD;

    // ===============================
    // 🚨 START TRIP DETECTION
    // ===============================
    if (isVehicular && !this.trip.active) {
      return {
        prompt: true,
        detectedMode: mode,
        confidence,
        speed,
      };
    }

    // ===============================
    // 🔄 ACTIVE TRIP TRACKING
    // ===============================
    if (this.trip.active) {
      this.updateDistance(location);

      const now = Date.now();

      // 🚗 Movement tracking
      if (speed > CONFIG.STOP_SPEED_THRESHOLD) {
        this.trip.lastMoveTime = now;
      }

      // ⛔ Stop detection with buffer
      const stoppedTooLong =
        this.trip.lastMoveTime &&
        now - this.trip.lastMoveTime > CONFIG.STOP_TIME_MS;

      if (stoppedTooLong) {
        return await this.endTrip(location);
      }

      this.trip.lastLocation = location;
    }

    return null;
  }

  // ===============================
  // 🔥 START TRIP
  // ===============================
  static startTrip(transport: string, location: Location) {
    TransportEngine.reset();

    const now = Date.now();

    this.trip = {
      active: true,
      transport,
      startLocation: location,
      lastLocation: location,
      startTime: now,
      lastMoveTime: now,
      distance: 0,
    };

    console.log("✅ Trip started:", transport);
  }

  // ===============================
  // 📏 DISTANCE ACCUMULATION (CRITICAL)
  // ===============================
  private static updateDistance(current: Location) {
    const last = this.trip.lastLocation;

    if (!last) return;

    const delta = calculateDistance(last, current);

    // 🚫 Ignore GPS noise
    if (delta < 0.01) return;

    this.trip.distance += delta;
  }

  // ===============================
  // 🏁 END TRIP
  // ===============================
  static async endTrip(endLocation: Location) {
    if (!this.trip.active || !this.trip.startLocation) return null;

    const finalDetection = TransportEngine.updateLocation(
      endLocation.lat,
      endLocation.lng
    );

    const routeMatch = finalDetection.matchedRoute;

    // 🔥 Use REAL trip distance (not route distance)
    const distance = this.trip.distance;

    const routeResult = RouteEngine.findClosestRoute(endLocation);

    const fare = await FareEngine.computeFinalFare({
      network: this.trip.transport as any,
      distance,
      matchedRoute: routeMatch,
    });

    const tripSummary = {
      fare,
      distance,
      network: this.trip.transport,
      route: routeResult.route?.name || "Unknown",
      duration: Date.now() - (this.trip.startTime || Date.now()),
    };

    console.log("💰 Trip Completed:", tripSummary);

    this.trip = {
      active: false,
      distance: 0,
    };

    return tripSummary;
  }

  // ===============================
  // RESET SYSTEM
  // ===============================
  static reset() {
    this.trip = {
      active: false,
      distance: 0,
    };

    TransportEngine.reset();
  }
}