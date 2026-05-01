// services/tripEngine.ts

import { FareEngine } from "./fareService";
import { RouteEngine } from "./routeEngine";
import { TransportEngine } from "./transportEngine";
import { HabitEngine } from "./habitEngine";
import {
  getCurrentLocation,
  calculateDistance
} from "./location";

import type { Location } from "../types";

// ---------------- CONFIG ----------------
const CONFIG = {
  VEHICLE_SPEED_THRESHOLD: 10,
  STOP_SPEED_THRESHOLD: 4,
  STOP_TIME_MS: 60000,
  MIN_TRACK_POINTS: 5
};

// ---------------- STATE ----------------
interface TripState {
  active: boolean;

  transport?: string;

  startLocation?: Location;
  endLocation?: Location;
  destination?: Location;

  lastLocation?: Location;

  startTime?: number;
  lastMoveTime?: number;

  distance: number;
  path: Location[];
}

export class TripEngine {
  private static trip: TripState = {
    active: false,
    distance: 0,
    path: []
  };

  // ===============================
  // 🚀 MAIN LOOP
  // ===============================
  static async tick() {
    let location: Location;

    try {
      location = await getCurrentLocation();
    } catch {
      return null; // 🔥 fail silently (critical UX)
    }

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
    // 🚨 AUTO PROMPT
    // ===============================
    if (isVehicular && !this.trip.active) {
      return {
        prompt: true,
        detectedMode: mode,
        confidence,
        speed
      };
    }

    // ===============================
    // 🔄 ACTIVE TRACKING
    // ===============================
    if (this.trip.active) {
      this.updateDistance(location);
      this.trip.path.push(location);

      const now = Date.now();

      if (speed > CONFIG.STOP_SPEED_THRESHOLD) {
        this.trip.lastMoveTime = now;
      }

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
  static startTrip(
    transport: string,
    location: Location,
    destination?: Location
  ) {
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
      path: [location],
      destination
    };

    console.log("✅ Trip started:", transport);
  }

  // ===============================
  // 📏 DISTANCE TRACKING
  // ===============================
  private static updateDistance(current: Location) {
    const last = this.trip.lastLocation;
    if (!last) return;

    const delta = calculateDistance(last, current);

    if (delta < 0.01) return; // filter noise

    this.trip.distance += delta;
  }

  // ===============================
  // 🧠 DISTANCE RESOLUTION
  // ===============================
  private static async resolveFinalDistance(
    endLocation: Location
  ): Promise<number> {
    const points = this.trip.path.length;

    // ✅ GOOD GPS TRACKING
    if (points >= CONFIG.MIN_TRACK_POINTS) {
      return this.trip.distance;
    }

    // ⚠️ FALLBACK → ROUTE ENGINE
    if (this.trip.startLocation) {
      try {
        const routeEstimate =
          await RouteEngine.estimateRouteDistance(
            this.trip.startLocation,
            endLocation
          );

        return routeEstimate;
      } catch {
        return calculateDistance(
          this.trip.startLocation,
          endLocation
        );
      }
    }

    return this.trip.distance;
  }

  // ===============================
  // 🏁 END TRIP
  // ===============================
  static async endTrip(endLocation: Location) {
    if (!this.trip.active || !this.trip.startLocation) return null;

    this.trip.endLocation = endLocation;

    const finalDetection = TransportEngine.updateLocation(
      endLocation.lat,
      endLocation.lng
    );

    const routeMatch = finalDetection.matchedRoute;

    const distance = await this.resolveFinalDistance(endLocation);

    const routeResult =
      RouteEngine.findClosestRoute(endLocation);

    // 🔥 UPDATED FARE HANDLING
    const fareResult = await FareEngine.computeFinalFare({
      network: this.trip.transport as any,
      distance,
      matchedRoute: routeMatch
    });

    const duration =
      Date.now() - (this.trip.startTime || Date.now());

    // ===============================
    // 🧠 HABIT LEARNING (CRITICAL)
    // ===============================
    try {
      HabitEngine.learn(
        this.trip.transport as any,
        this.trip.startLocation,
        endLocation
      );
    } catch (err) {
      console.warn("Habit learning failed:", err);
    }

    const tripSummary = {
      fare: fareResult.fare,
      fareConfidence: fareResult.confidence,
      fareSource: fareResult.source,

      distance,
      network: this.trip.transport,

      route: routeResult.route?.name || "Unknown",

      duration,

      startLocation: this.trip.startLocation,
      endLocation,

      path: this.trip.path
    };

    console.log("💰 Trip Completed:", tripSummary);

    // 🔥 RESET CLEANLY
    this.trip = {
      active: false,
      distance: 0,
      path: []
    };

    return tripSummary;
  }

  // ===============================
  // 📊 PRE-TRIP ESTIMATION
  // ===============================
  static async estimateTrip(
    start: Location,
    end: Location,
    transport: string
  ) {
    try {
      const distance =
        await RouteEngine.estimateRouteDistance(
          start,
          end
        );

      const fareResult =
        await FareEngine.computeFinalFare({
          network: transport as any,
          distance
        });

      return {
        distance,
        fare: fareResult.fare,
        confidence: fareResult.confidence
      };
    } catch (err) {
      console.error("❌ Estimation failed", err);
      return null;
    }
  }

  // ===============================
  // 🔮 HABIT PREDICTION (NEW)
  // ===============================
  static async getPrediction(currentLocation: Location) {
    try {
      return HabitEngine.predict(currentLocation);
    } catch {
      return { network: null, confidence: 0 };
    }
  }

  // ===============================
  // RESET
  // ===============================
  static reset() {
    this.trip = {
      active: false,
      distance: 0,
      path: []
    };

    TransportEngine.reset();
  }
}