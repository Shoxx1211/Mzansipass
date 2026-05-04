// src/services/backgroundTracker.ts

import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";

// ======================================================
// 📍 LOCATION MODEL
// ======================================================
export interface TrackerLocation {
  lat: number;
  lng: number;

  accuracy: number;

  // 🔥 km/h
  speed: number;

  heading: number;

  altitude: number;

  timestamp: number;
}

// ======================================================
// 🚗 ACTIVE SESSION
// ======================================================
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

// ======================================================
// 💾 STORAGE
// ======================================================
const STORAGE = {
  activeTrip: "pulse_active_trip",
  lastLocation: "pulse_last_location",
  trackingState: "pulse_tracking_state",
};

// ======================================================
// 🧠 TRACKER ENGINE
// ======================================================
class BackgroundTrackerService {

  // ======================================================
  // INTERNALS
  // ======================================================
  private watchId: string | null = null;

  private subscribers: ((
    location: TrackerLocation,
    trip: ActiveTripSession
  ) => void)[] = [];

  private tripSubscribers: ((
    trip: ActiveTripSession
  ) => void)[] = [];

  private isTracking = false;

  private currentTrip:
    ActiveTripSession | null = null;

  private heartbeatInterval:
    number | null = null;

  // ======================================================
  // 🚀 START
  // ======================================================
  async start() {

    // 🚫 PREVENT DOUBLE START
    if (this.isTracking) {
      console.log(
        "⚠️ Tracker already running"
      );
      return;
    }

    try {

      console.log(
        "🚀 Starting premium tracker..."
      );

      // ======================================================
      // 🔐 PERMISSIONS
      // ======================================================
      const permissions =
        await Geolocation.requestPermissions();

      if (
        permissions.location !== "granted" &&
        permissions.coarseLocation !== "granted"
      ) {
        throw new Error(
          "Location permission denied"
        );
      }

      // ======================================================
      // 🚗 ALWAYS START CLEAN SESSION
      // ======================================================
      this.initializeNewTrip();

      // ======================================================
      // 📡 GPS WATCH
      // ======================================================
      this.watchId =
        await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,

            timeout: 15000,

            maximumAge: 0,

            minimumUpdateInterval: 3000,
          },

          (position, err) => {

            if (err) {
              console.error(
                "❌ GPS ERROR:",
                err
              );
              return;
            }

            if (
              !position ||
              !this.currentTrip
            ) {
              return;
            }

            // ======================================================
            // 🚫 INVALID GPS
            // ======================================================
            if (
              !position.coords.latitude ||
              !position.coords.longitude
            ) {
              return;
            }

            // ======================================================
            // 🚀 SPEED FIX ENGINE
            // ======================================================

            // Native speed from GPS is VERY unreliable.
            // We compute our own speed from distance/time.

            const payload: TrackerLocation = {
              lat: position.coords.latitude,

              lng: position.coords.longitude,

              accuracy:
                position.coords.accuracy || 0,

              speed: 0,

              heading:
                position.coords.heading || 0,

              altitude:
                position.coords.altitude || 0,

              timestamp: position.timestamp,
            };

            this.processLocation(payload);
          }
        );

      // ======================================================
      // ⏱️ HEARTBEAT
      // ======================================================
      this.startHeartbeat();

      this.isTracking = true;

      localStorage.setItem(
        STORAGE.trackingState,
        "true"
      );

      console.log(
        "✅ Premium tracker active"
      );

    } catch (error) {

      console.error(
        "❌ Tracker failed:",
        error
      );

    }
  }

  // ======================================================
  // 🛑 STOP
  // ======================================================
  async stop() {

    try {

      console.log(
        "🛑 Stopping tracker..."
      );

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

      console.log(
        "✅ Tracker stopped"
      );

    } catch (error) {

      console.error(
        "❌ Stop failed:",
        error
      );

    }
  }

  // ======================================================
  // 🧠 PROCESS LOCATION
  // ======================================================
  private processLocation(
    location: TrackerLocation
  ) {

    if (!this.currentTrip) return;

    const previous =
      this.currentTrip.points[
        this.currentTrip.points.length - 1
      ];

    // ======================================================
    // 📍 FIRST LOCATION
    // ======================================================
    if (!previous) {

      this.currentTrip.points.push({
        ...location,
        speed: 0
      });

      this.persistTrip();

      return;
    }

    // ======================================================
    // ⏱️ TIME DELTA
    // ======================================================
    const timeSeconds =
      (location.timestamp -
        previous.timestamp) / 1000;

    // 🚫 INVALID TIME
    if (
      timeSeconds <= 0 ||
      timeSeconds > 120
    ) {
      return;
    }

    // ======================================================
    // 📏 DISTANCE
    // ======================================================
    const distanceMeters =
      this.calculateDistance(
        previous.lat,
        previous.lng,
        location.lat,
        location.lng
      );

    // ======================================================
    // 🚫 GPS DRIFT FILTER
    // ======================================================

    // Ignore tiny jumps
    if (distanceMeters < 5) {
      return;
    }

    // Ignore impossible jumps
    if (distanceMeters > 500) {
      return;
    }

    // ======================================================
    // 🚀 TRUE SPEED ENGINE
    // ======================================================
    const calculatedSpeed =
      (distanceMeters / timeSeconds) * 3.6;

    // 🚫 IMPOSSIBLE SPEEDS
    if (
      calculatedSpeed > 180 ||
      !Number.isFinite(calculatedSpeed)
    ) {
      return;
    }

    // ======================================================
    // 📏 ACCUMULATE DISTANCE
    // ======================================================
    this.currentTrip.totalDistance +=
      distanceMeters;

    // ======================================================
    // 🚀 SPEED STATE
    // ======================================================
    this.currentTrip.currentSpeed =
      calculatedSpeed;

    if (
      calculatedSpeed >
      this.currentTrip.maxSpeed
    ) {
      this.currentTrip.maxSpeed =
        calculatedSpeed;
    }

    // ======================================================
    // 📍 STORE POINT
    // ======================================================
    const processedPoint = {
      ...location,
      speed: calculatedSpeed
    };

    this.currentTrip.points.push(
      processedPoint
    );

    // Prevent memory explosion
    if (
      this.currentTrip.points.length > 500
    ) {
      this.currentTrip.points.shift();
    }

    // ======================================================
    // ⏱️ DURATION
    // ======================================================
    this.currentTrip.duration =
      Date.now() -
      this.currentTrip.startedAt;

    this.currentTrip.lastUpdate =
      Date.now();

    // ======================================================
    // 📊 AVERAGE SPEED
    // ======================================================
    const hours =
      this.currentTrip.duration /
      1000 /
      60 /
      60;

    if (hours > 0) {

      this.currentTrip.averageSpeed =
        (
          this.currentTrip.totalDistance /
          1000
        ) / hours;

    }

    // ======================================================
    // 💾 SAVE
    // ======================================================
    this.persistTrip();

    localStorage.setItem(
      STORAGE.lastLocation,
      JSON.stringify(processedPoint)
    );

    // ======================================================
    // 📡 BROADCAST
    // ======================================================
    this.subscribers.forEach((cb) =>
      cb(processedPoint, this.currentTrip!)
    );

    this.tripSubscribers.forEach((cb) =>
      cb(this.currentTrip!)
    );

    console.log("📍 TRACK:", {
      distance:
        (
          this.currentTrip.totalDistance /
          1000
        ).toFixed(2) + " km",

      speed:
        calculatedSpeed.toFixed(1) +
        " km/h"
    });
  }

  // ======================================================
  // ⏱️ HEARTBEAT
  // ======================================================
  private startHeartbeat() {

    this.stopHeartbeat();

    this.heartbeatInterval =
      window.setInterval(() => {

        if (!this.currentTrip) return;

        this.currentTrip.duration =
          Date.now() -
          this.currentTrip.startedAt;

        this.persistTrip();

        this.tripSubscribers.forEach(
          (cb) => cb(this.currentTrip!)
        );

      }, 1000);
  }

  private stopHeartbeat() {

    if (this.heartbeatInterval) {

      clearInterval(
        this.heartbeatInterval
      );

      this.heartbeatInterval = null;
    }
  }

  // ======================================================
  // 🚗 NEW SESSION
  // ======================================================
  private initializeNewTrip() {

    // 🔥 HARD RESET
    localStorage.removeItem(
      STORAGE.activeTrip
    );

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

    console.log(
      "🚗 Fresh trip session started"
    );
  }

  // ======================================================
  // 💾 SAVE
  // ======================================================
  private persistTrip() {

    if (!this.currentTrip) return;

    localStorage.setItem(
      STORAGE.activeTrip,
      JSON.stringify(this.currentTrip)
    );
  }

  // ======================================================
  // 📏 DISTANCE ENGINE
  // ======================================================
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) {

    const R = 6371e3;

    const φ1 =
      (lat1 * Math.PI) / 180;

    const φ2 =
      (lat2 * Math.PI) / 180;

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

  // ======================================================
  // 📡 LOCATION SUBSCRIBE
  // ======================================================
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

  // ======================================================
  // 🚗 TRIP SUBSCRIBE
  // ======================================================
  subscribeToTrip(
    callback: (
      trip: ActiveTripSession
    ) => void
  ) {

    this.tripSubscribers.push(
      callback
    );

    return () => {

      this.tripSubscribers =
        this.tripSubscribers.filter(
          (cb) => cb !== callback
        );

    };
  }

  // ======================================================
  // 📍 LAST LOCATION
  // ======================================================
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

  // ======================================================
  // 🚗 GET TRIP
  // ======================================================
  getTrip() {
    return this.currentTrip;
  }

  // ======================================================
  // 🔋 STATUS
  // ======================================================
  get tracking() {
    return this.isTracking;
  }

  get native() {
    return Capacitor.isNativePlatform();
  }
}

// ======================================================
// 🌍 SINGLETON
// ======================================================
export const BackgroundTracker =
  new BackgroundTrackerService();