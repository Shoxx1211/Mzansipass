// services/location.ts

import type { Location } from "../types";

// ===============================
// CONFIG (TUNABLE FOR PRODUCTION)
// ===============================
const CONFIG = {
  MIN_DISTANCE_KM: 0.01,        // 10m → ignore GPS jitter
  MAX_ACCURACY_METERS: 50,      // discard bad GPS
  VEHICLE_SPEED_THRESHOLD: 10,  // km/h
  WALKING_MAX_SPEED: 6,
  SMOOTHING_WINDOW: 5           // rolling average size
};

// ===============================
// INTERNAL STATE (SMOOTHING)
// ===============================
let history: Location[] = [];

// ===============================
// GET CURRENT LOCATION (ROBUST + SAFE)
// ===============================
export const getCurrentLocation = (): Promise<Location> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error("Geolocation not supported"));
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = formatLocation(position);

        // 🚫 Reject bad GPS
        if (!isAccurate(loc)) {
          return reject(new Error("Low GPS accuracy"));
        }

        resolve(loc);
      },
      (error) => {
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
// WATCH LOCATION (SMART STREAM)
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

      // 🚫 Reject bad GPS
      if (!isAccurate(loc)) return;

      // 🚫 Reject noise
      const last = history[history.length - 1];
      if (last && !isValidMovement(last, loc)) return;

      // ✅ Add to history
      history.push(loc);
      if (history.length > CONFIG.SMOOTHING_WINDOW) {
        history.shift();
      }

      // 🔥 Smoothed speed
      const speed = getSmoothedSpeed();

      const meta: MovementMeta = {
        speed,
        isMoving: speed > CONFIG.VEHICLE_SPEED_THRESHOLD,
        isWalking:
          speed >= 2 && speed <= CONFIG.WALKING_MAX_SPEED,
        confidence: calculateConfidence(loc)
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
  history = []; // 🔥 reset smoothing
};

// ===============================
// MOVEMENT META TYPE
// ===============================
export type MovementMeta = {
  speed: number;
  isMoving: boolean;
  isWalking: boolean;
  confidence: number;
};

// ===============================
// DISTANCE (HAVERSINE)
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
// SPEED (PAIR)
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
// 🔥 SMOOTHED SPEED (CRITICAL)
// ===============================
const getSmoothedSpeed = (): number => {
  if (history.length < 2) return 0;

  let total = 0;
  let count = 0;

  for (let i = 1; i < history.length; i++) {
    const speed = calculateSpeed(history[i - 1], history[i]);

    // 🚫 filter insane GPS spikes
    if (speed > 0 && speed < 180) {
      total += speed;
      count++;
    }
  }

  return count === 0 ? 0 : total / count;
};

// ===============================
// GPS QUALITY CHECK (FIXED ✅)
// ===============================
const isAccurate = (loc: Location): boolean => {
  const accuracy = loc.accuracy ?? 999; // 🔥 fallback if undefined
  return accuracy <= CONFIG.MAX_ACCURACY_METERS;
};

// ===============================
// FILTER GPS NOISE
// ===============================
export const isValidMovement = (
  loc1: Location,
  loc2: Location
): boolean => {
  const distance = calculateDistance(loc1, loc2);
  return distance >= CONFIG.MIN_DISTANCE_KM;
};

// ===============================
// CONFIDENCE SCORE (FIXED ✅)
// ===============================
const calculateConfidence = (loc: Location): number => {
  const accuracy = loc.accuracy ?? 100; // 🔥 safe fallback

  if (accuracy <= 10) return 0.95;
  if (accuracy <= 25) return 0.8;
  if (accuracy <= 50) return 0.6;
  return 0.3;
};

// ===============================
// FORMAT LOCATION (NORMALIZED ✅)
// ===============================
const formatLocation = (
  position: GeolocationPosition
): Location => ({
  lat: position.coords.latitude,
  lng: position.coords.longitude,
  accuracy: position.coords.accuracy ?? 100, // 🔥 ALWAYS DEFINED
  timestamp: position.timestamp
});

// ===============================
// ERROR PARSER
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