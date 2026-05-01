// services/location.ts

import type { Location } from "../types";

// ===============================
// CONFIG (TUNED FOR REAL WORLD)
// ===============================
const CONFIG = {
  MIN_DISTANCE_KM: 0.01,
  MAX_ACCURACY_METERS: 50,
  VEHICLE_SPEED_THRESHOLD: 10,
  WALKING_MAX_SPEED: 6,
  SMOOTHING_WINDOW: 5,
  STALE_LOCATION_MS: 15000 // 🔥 detect GPS freeze
};

// ===============================
// INTERNAL STATE
// ===============================
let history: Location[] = [];
let lastKnownLocation: Location | null = null;
let lastUpdateTime = 0;

// ===============================
// GET CURRENT LOCATION (RESILIENT)
// ===============================
export const getCurrentLocation = (): Promise<Location> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error("Geolocation not supported"));
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = formatLocation(position);

        if (!isAccurate(loc)) {
          // 🔥 fallback to last known location
          if (lastKnownLocation) {
            console.warn("⚠️ Using last known location");
            return resolve(lastKnownLocation);
          }

          return reject(new Error("Low GPS accuracy"));
        }

        updateState(loc);
        resolve(loc);
      },
      (error) => {
        // 🔥 fallback if GPS fails
        if (lastKnownLocation) {
          console.warn("⚠️ GPS failed, using cached location");
          return resolve(lastKnownLocation);
        }

        reject(new Error(parseError(error)));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 3000
      }
    );
  });
};

// ===============================
// WATCH LOCATION (PRODUCTION READY)
// ===============================
export const watchLocation = (
  onUpdate: (loc: Location, meta: MovementMeta) => void,
  onError?: (err: any) => void
): number => {
  if (!navigator.geolocation) {
    throw new Error("Geolocation not supported");
  }

  return navigator.geolocation.watchPosition(
    (position) => {
      const loc = formatLocation(position);

      // 🚫 Accuracy filter
      if (!isAccurate(loc)) return;

      const last = history[history.length - 1];

      // 🚫 Ignore noise
      if (last && !isValidMovement(last, loc)) return;

      updateState(loc);

      const speed = getSmoothedSpeed();

      const now = Date.now();

      // 🔥 Detect GPS freeze
      const isStale = now - lastUpdateTime > CONFIG.STALE_LOCATION_MS;

      const meta: MovementMeta = {
        speed,
        isMoving: speed > CONFIG.VEHICLE_SPEED_THRESHOLD,
        isWalking:
          speed >= 2 && speed <= CONFIG.WALKING_MAX_SPEED,
        confidence: calculateConfidence(loc),
        isStale
      };

      onUpdate(loc, meta);
    },
    (error) => {
      if (onError) onError(parseError(error));
    },
    {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 15000
    }
  );
};

// ===============================
// STOP WATCHING
// ===============================
export const clearLocationWatch = (watchId: number) => {
  navigator.geolocation.clearWatch(watchId);
  resetLocationState();
};

// ===============================
// MOVEMENT META
// ===============================
export type MovementMeta = {
  speed: number;
  isMoving: boolean;
  isWalking: boolean;
  confidence: number;
  isStale: boolean; // 🔥 NEW
};

// ===============================
// DISTANCE
// ===============================
export const calculateDistance = (
  loc1: Location,
  loc2: Location
): number => {
  const R = 6371;

  const dLat = deg2rad(loc2.lat - loc1.lat);
  const dLon = deg2rad(loc2.lng - loc1.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(loc1.lat)) *
      Math.cos(deg2rad(loc2.lat)) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ===============================
// SPEED
// ===============================
export const calculateSpeed = (
  loc1: Location,
  loc2: Location
): number => {
  if (!loc1.timestamp || !loc2.timestamp) return 0;

  const distance = calculateDistance(loc1, loc2);
  const time = (loc2.timestamp - loc1.timestamp) / 3600000;

  if (time <= 0) return 0;

  return distance / time;
};

// ===============================
// 🔥 SMOOTHED SPEED
// ===============================
const getSmoothedSpeed = (): number => {
  if (history.length < 2) return 0;

  let total = 0;
  let count = 0;

  for (let i = 1; i < history.length; i++) {
    const speed = calculateSpeed(history[i - 1], history[i]);

    if (speed > 0 && speed < 180) {
      total += speed;
      count++;
    }
  }

  return count === 0 ? 0 : total / count;
};

// ===============================
// 🔥 STATE MANAGEMENT
// ===============================
const updateState = (loc: Location) => {
  history.push(loc);

  if (history.length > CONFIG.SMOOTHING_WINDOW) {
    history.shift();
  }

  lastKnownLocation = loc;
  lastUpdateTime = Date.now();
};

const resetLocationState = () => {
  history = [];
  lastKnownLocation = null;
  lastUpdateTime = 0;
};

// ===============================
// GPS QUALITY
// ===============================
const isAccurate = (loc: Location): boolean => {
  const accuracy = loc.accuracy ?? 999;
  return accuracy <= CONFIG.MAX_ACCURACY_METERS;
};

// ===============================
// MOVEMENT FILTER
// ===============================
export const isValidMovement = (
  loc1: Location,
  loc2: Location
): boolean => {
  const distance = calculateDistance(loc1, loc2);
  return distance >= CONFIG.MIN_DISTANCE_KM;
};

// ===============================
// CONFIDENCE
// ===============================
const calculateConfidence = (loc: Location): number => {
  const accuracy = loc.accuracy ?? 100;

  if (accuracy <= 10) return 0.95;
  if (accuracy <= 25) return 0.8;
  if (accuracy <= 50) return 0.6;
  return 0.3;
};

// ===============================
// FORMAT LOCATION
// ===============================
const formatLocation = (
  position: GeolocationPosition
): Location => ({
  lat: position.coords.latitude,
  lng: position.coords.longitude,
  accuracy: position.coords.accuracy ?? 100,
  timestamp: position.timestamp
});

// ===============================
// ERROR HANDLING
// ===============================
const parseError = (error: GeolocationPositionError): string => {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission denied";
    case error.POSITION_UNAVAILABLE:
      return "Location unavailable";
    case error.TIMEOUT:
      return "Location timeout";
    default:
      return "Unknown location error";
  }
};

// ===============================
// HELPERS
// ===============================
const deg2rad = (deg: number): number =>
  deg * (Math.PI / 180);