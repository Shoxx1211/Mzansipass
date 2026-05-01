// src/services/backgroundTracker.ts

import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";

// ===============================
// 📍 LOCATION MODEL
// ===============================
export interface TrackerLocation {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number;
  heading: number;
  altitude: number;
  timestamp: number;
}

// ===============================
// 🚗 TRIP SESSION
// ===============================
export interface ActiveTripSession {
  active: boolean;

  startedAt: number;

  lastUpdate: number;

  totalDistance: number;

  currentSpeed: number;

  averageSpeed: number;

  maxSpeed: number;

  duration: number;

  points: TrackerLocation[];
}

// ===============================
// 💾 STORAGE KEYS
// ===============================
const STORAGE = {
  activeTrip: "pulse_active_trip",
  lastLocation: "pulse_last_location",
  trackingState: "pulse_tracking_state",
};

// ===============================
// 🧠 TRACKER ENGINE
// ===============================
class BackgroundTrackerService {
  // ===============================
  // INTERNALS
  // ===============================
  private watchId: string | null = null;

  private subscribers: ((
    location: TrackerLocation,
    trip: ActiveTripSession
  ) => void)[] = [];

  private tripSubscribers: ((
    trip: ActiveTripSession
  ) => void)[] = [];

  private isTracking = false;

  private currentTrip: ActiveTripSession | null = null;

  private heartbeatInterval: number | null = null;

  // ===============================
  // 🚀 START TRACKING
  // ===============================
  async start() {
    if (this.isTracking) {
      console.log("⚠️ Tracker already active");
      return;
    }

    try {
      console.log("🚀 Initializing premium tracker...");

      // ===============================
      // 🔐 REQUEST PERMISSIONS
      // ===============================
      const permissions = await Geolocation.requestPermissions();

      if (
        permissions.location !== "granted" &&
        permissions.coarseLocation !== "granted"
      ) {
        throw new Error("Location permission denied");
      }

      // ===============================
      // 🧠 RESTORE EXISTING SESSION
      // ===============================
      const restored = this.restoreTrip();

      if (restored) {
        console.log("♻️ Restored previous trip session");
      } else {
        this.initializeNewTrip();
      }

      // ===============================
      // 📡 START GPS WATCHER
      // ===============================
      this.watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,

          timeout: 15000,

          maximumAge: 0,

          minimumUpdateInterval: 3000,
        },

        async (position, err) => {
          if (err) {
            console.error("❌ GPS ERROR:", err);
            return;
          }

          if (!position || !this.currentTrip) return;

          const payload: TrackerLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,

            accuracy: position.coords.accuracy || 0,

            speed: Math.max(
              0,
              (position.coords.speed || 0) * 3.6
            ), // m/s → km/h

            heading: position.coords.heading || 0,

            altitude: position.coords.altitude || 0,

            timestamp: position.timestamp,
          };

          this.processLocation(payload);
        }
      );

      // ===============================
      // ⏱️ HEARTBEAT ENGINE
      // Keeps duration alive
      // ===============================
      this.startHeartbeat();

      this.isTracking = true;

      localStorage.setItem(
        STORAGE.trackingState,
        "true"
      );

      console.log("✅ Premium background tracking active");

    } catch (error) {
      console.error("❌ Tracker failed:", error);
    }
  }

  // ===============================
  // 🛑 STOP TRACKING
  // ===============================
  async stop() {
    try {
      console.log("🛑 Stopping tracker...");

      if (this.watchId) {
        await Geolocation.clearWatch({
          id: this.watchId,
        });
      }

      this.stopHeartbeat();

      this.watchId = null;

      this.isTracking = false;

      localStorage.removeItem(
        STORAGE.trackingState
      );

      console.log("✅ Tracking stopped");

    } catch (error) {
      console.error("❌ Stop tracking failed:", error);
    }
  }

  // ===============================
  // 🧠 PROCESS LOCATION
  // ===============================
  private processLocation(location: TrackerLocation) {
    if (!this.currentTrip) return;

    const previous =
      this.currentTrip.points[
        this.currentTrip.points.length - 1
      ];

    // ===============================
    // 📏 DISTANCE CALCULATION
    // ===============================
    if (previous) {
      const distance = this.calculateDistance(
        previous.lat,
        previous.lng,
        location.lat,
        location.lng
      );

      // Ignore GPS drift
      if (distance > 3) {
        this.currentTrip.totalDistance += distance;
      }
    }

    // ===============================
    // 🚀 SPEED ENGINE
    // ===============================
    this.currentTrip.currentSpeed =
      location.speed;

    if (
      location.speed >
      this.currentTrip.maxSpeed
    ) {
      this.currentTrip.maxSpeed =
        location.speed;
    }

    // ===============================
    // 📍 STORE POINT
    // ===============================
    this.currentTrip.points.push(location);

    // Prevent memory explosion
    if (this.currentTrip.points.length > 500) {
      this.currentTrip.points.shift();
    }

    // ===============================
    // ⏱️ DURATION
    // ===============================
    this.currentTrip.duration =
      Date.now() -
      this.currentTrip.startedAt;

    this.currentTrip.lastUpdate =
      Date.now();

    // ===============================
    // 📊 AVERAGE SPEED
    // ===============================
    const hours =
      this.currentTrip.duration /
      1000 /
      60 /
      60;

    if (hours > 0) {
      this.currentTrip.averageSpeed =
        (this.currentTrip.totalDistance / 1000) /
        hours;
    }

    // ===============================
    // 💾 SAVE
    // ===============================
    this.persistTrip();

    localStorage.setItem(
      STORAGE.lastLocation,
      JSON.stringify(location)
    );

    // ===============================
    // 📡 BROADCAST
    // ===============================
    this.subscribers.forEach((cb) =>
      cb(location, this.currentTrip!)
    );

    this.tripSubscribers.forEach((cb) =>
      cb(this.currentTrip!)
    );

    console.log("📍 TRACK:", {
      lat: location.lat,
      lng: location.lng,
      speed: location.speed.toFixed(1),
      distance:
        (
          this.currentTrip.totalDistance / 1000
        ).toFixed(2) + " km",
    });
  }

  // ===============================
  // ⏱️ HEARTBEAT
  // ===============================
  private startHeartbeat() {
    this.stopHeartbeat();

    this.heartbeatInterval =
      window.setInterval(() => {
        if (!this.currentTrip) return;

        this.currentTrip.duration =
          Date.now() -
          this.currentTrip.startedAt;

        this.persistTrip();

        this.tripSubscribers.forEach((cb) =>
          cb(this.currentTrip!)
        );

      }, 1000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ===============================
  // 🚗 NEW SESSION
  // ===============================
  private initializeNewTrip() {
    this.currentTrip = {
      active: true,

      startedAt: Date.now(),

      lastUpdate: Date.now(),

      totalDistance: 0,

      currentSpeed: 0,

      averageSpeed: 0,

      maxSpeed: 0,

      duration: 0,

      points: [],
    };

    this.persistTrip();

    console.log("🚗 New trip initialized");
  }

  // ===============================
  // ♻️ RESTORE SESSION
  // ===============================
  private restoreTrip(): boolean {
    try {
      const raw =
        localStorage.getItem(
          STORAGE.activeTrip
        );

      if (!raw) return false;

      const parsed =
        JSON.parse(raw) as ActiveTripSession;

      if (!parsed.active) return false;

      this.currentTrip = parsed;

      return true;

    } catch {
      return false;
    }
  }

  // ===============================
  // 💾 SAVE TRIP
  // ===============================
  private persistTrip() {
    if (!this.currentTrip) return;

    localStorage.setItem(
      STORAGE.activeTrip,
      JSON.stringify(this.currentTrip)
    );
  }

  // ===============================
  // 📏 DISTANCE ENGINE
  // ===============================
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) {
    const R = 6371e3;

    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;

    const Δφ =
      ((lat2 - lat1) * Math.PI) / 180;

    const Δλ =
      ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) *
        Math.sin(Δφ / 2) +
      Math.cos(φ1) *
        Math.cos(φ2) *
        Math.sin(Δλ / 2) *
        Math.sin(Δλ / 2);

    const c =
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      );

    return R * c;
  }

  // ===============================
  // 📡 LOCATION SUBSCRIBE
  // ===============================
  subscribe(
    callback: (
      location: TrackerLocation,
      trip: ActiveTripSession
    ) => void
  ) {
    this.subscribers.push(callback);

    return () => {
      this.subscribers =
        this.subscribers.filter(
          (cb) => cb !== callback
        );
    };
  }

  // ===============================
  // 🚗 TRIP SUBSCRIBE
  // ===============================
  subscribeToTrip(
    callback: (
      trip: ActiveTripSession
    ) => void
  ) {
    this.tripSubscribers.push(callback);

    return () => {
      this.tripSubscribers =
        this.tripSubscribers.filter(
          (cb) => cb !== callback
        );
    };
  }

  // ===============================
  // 📍 LAST LOCATION
  // ===============================
  getLastKnownLocation():
    | TrackerLocation
    | null {
    try {
      const raw =
        localStorage.getItem(
          STORAGE.lastLocation
        );

      if (!raw) return null;

      return JSON.parse(raw);

    } catch {
      return null;
    }
  }

  // ===============================
  // 🚗 CURRENT TRIP
  // ===============================
  getTrip() {
    return this.currentTrip;
  }

  // ===============================
  // 🔋 STATUS
  // ===============================
  get tracking() {
    return this.isTracking;
  }

  get native() {
    return Capacitor.isNativePlatform();
  }
}

// ===============================
// 🌍 SINGLETON EXPORT
// ===============================
export const BackgroundTracker =
  new BackgroundTrackerService();