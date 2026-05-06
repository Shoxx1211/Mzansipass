// src/services/location.ts

import type { Location } from "../types";

// ===============================
// CONFIG
// ===============================
const CONFIG = {
  // 🔥 MUCH MORE SENSITIVE
  MIN_DISTANCE_KM: 0.002, // 2 meters

  // 🔥 LESS STRICT
  MAX_ACCURACY_METERS: 120,

  // WALKING
  WALKING_MIN_SPEED: 1,
  WALKING_MAX_SPEED: 8,

  // VEHICLE
  VEHICLE_SPEED_THRESHOLD: 10,

  // SMOOTHING
  SMOOTHING_WINDOW: 5,

  // STALE GPS
  STALE_LOCATION_MS: 15000
};

// ===============================
// INTERNAL STATE
// ===============================
let history: Location[] = [];

let lastKnownLocation: Location | null =
  null;

let lastUpdateTime = 0;

// ===============================
// TYPES
// ===============================
export type MovementMeta = {
  speed: number;
  isMoving: boolean;
  isWalking: boolean;
  confidence: number;
  isStale: boolean;
};

// ===============================
// GET CURRENT LOCATION
// ===============================
export const getCurrentLocation =
  (): Promise<Location> => {

    return new Promise(
      (resolve, reject) => {

        if (!navigator.geolocation) {

          reject(
            new Error(
              "Geolocation not supported"
            )
          );

          return;
        }

        navigator.geolocation.getCurrentPosition(

          (position) => {

            const loc =
              formatLocation(position);

            updateState(loc);

            resolve(loc);

          },

          (error) => {

            if (lastKnownLocation) {

              console.warn(
                "⚠️ Using cached location"
              );

              resolve(
                lastKnownLocation
              );

              return;
            }

            reject(
              new Error(
                parseError(error)
              )
            );

          },

          {
            enableHighAccuracy: true,

            timeout: 15000,

            maximumAge: 0
          }

        );

      }
    );

  };

// ===============================
// WATCH LOCATION
// ===============================
export const watchLocation = (
  onUpdate: (
    loc: Location,
    meta: MovementMeta
  ) => void,

  onError?: (err: any) => void
): number => {

  if (!navigator.geolocation) {

    throw new Error(
      "Geolocation not supported"
    );

  }

  return navigator.geolocation.watchPosition(

    (position) => {

      const loc =
        formatLocation(position);

      // ==========================================
      // 🔥 ALLOW MORE GPS DATA THROUGH
      // ==========================================
      if (!isAccurate(loc)) {

        console.log(
          "⚠️ Low accuracy:",
          loc.accuracy
        );

      }

      const previous =
        history[
          history.length - 1
        ];

      // ==========================================
      // 📏 DISTANCE
      // ==========================================
      let distance = 0;

      if (previous) {

        distance =
          calculateDistance(
            previous,
            loc
          );

      }

      // ==========================================
      // 🚫 IGNORE TINY GPS NOISE
      // ==========================================
      if (
        previous &&
        distance <
          CONFIG.MIN_DISTANCE_KM
      ) {

        return;

      }

      // ==========================================
      // 💾 SAVE LOCATION
      // ==========================================
      updateState(loc);

      // ==========================================
      // ⚡ SPEED
      // ==========================================
      let speed = 0;

      // 🔥 Prefer native GPS speed
      if (
        position.coords.speed !==
          null &&
        position.coords.speed !==
          undefined &&
        position.coords.speed > 0
      ) {

        speed =
          position.coords.speed *
          3.6;

      } else {

        // 🔥 FALLBACK
        speed =
          getSmoothedSpeed();

      }

      // ==========================================
      // ⏱ STALE CHECK
      // ==========================================
      const now = Date.now();

      const isStale =
        now - lastUpdateTime >
        CONFIG.STALE_LOCATION_MS;

      // ==========================================
      // 📡 META
      // ==========================================
      const meta: MovementMeta = {

        speed,

        isMoving: speed > 1,

        isWalking:
          speed >=
            CONFIG.WALKING_MIN_SPEED &&
          speed <=
            CONFIG.WALKING_MAX_SPEED,

        confidence:
          calculateConfidence(loc),

        isStale

      };

      // ==========================================
      // 🚀 BROADCAST
      // ==========================================
      onUpdate(loc, meta);

      console.log(
        "📍 GPS UPDATE",
        {
          lat: loc.lat,
          lng: loc.lng,
          distance:
            distance.toFixed(3) +
            " km",
          speed:
            speed.toFixed(1) +
            " km/h",
          accuracy:
            loc.accuracy
        }
      );

    },

    (error) => {

      console.error(
        "❌ GPS ERROR:",
        error
      );

      if (onError) {

        onError(
          parseError(error)
        );

      }

    },

    {
      enableHighAccuracy: true,

      timeout: 15000,

      maximumAge: 0
    }

  );

};

// ===============================
// CLEAR WATCH
// ===============================
export const clearLocationWatch = (
  watchId: number
) => {

  navigator.geolocation.clearWatch(
    watchId
  );

};

// ===============================
// DISTANCE
// ===============================
export const calculateDistance = (
  loc1: Location,
  loc2: Location
): number => {

  const R = 6371;

  const dLat = deg2rad(
    loc2.lat - loc1.lat
  );

  const dLon = deg2rad(
    loc2.lng - loc1.lng
  );

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.cos(
      deg2rad(loc1.lat)
    ) *
      Math.cos(
        deg2rad(loc2.lat)
      ) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;

};

// ===============================
// SPEED
// ===============================
export const calculateSpeed = (
  loc1: Location,
  loc2: Location
): number => {

  if (
    !loc1.timestamp ||
    !loc2.timestamp
  ) {
    return 0;
  }

  const distance =
    calculateDistance(
      loc1,
      loc2
    );

  const hours =
    (loc2.timestamp -
      loc1.timestamp) /
    3600000;

  if (hours <= 0) {
    return 0;
  }

  const speed =
    distance / hours;

  // 🚫 INVALID SPEED
  if (
    !Number.isFinite(speed) ||
    speed < 0 ||
    speed > 200
  ) {
    return 0;
  }

  return speed;

};

// ===============================
// SMOOTHED SPEED
// ===============================
const getSmoothedSpeed =
  (): number => {

    if (history.length < 2) {
      return 0;
    }

    let total = 0;

    let count = 0;

    for (
      let i = 1;
      i < history.length;
      i++
    ) {

      const speed =
        calculateSpeed(
          history[i - 1],
          history[i]
        );

      if (
        speed > 0 &&
        speed < 200
      ) {

        total += speed;

        count++;

      }

    }

    if (count === 0) {
      return 0;
    }

    return total / count;

  };

// ===============================
// STATE
// ===============================
const updateState = (
  loc: Location
) => {

  history.push(loc);

  if (
    history.length >
    CONFIG.SMOOTHING_WINDOW
  ) {

    history.shift();

  }

  lastKnownLocation = loc;

  lastUpdateTime = Date.now();

};

// ===============================
// ACCURACY
// ===============================
const isAccurate = (
  loc: Location
): boolean => {

  return (
    (loc.accuracy ?? 999) <=
    CONFIG.MAX_ACCURACY_METERS
  );

};

// ===============================
// CONFIDENCE
// ===============================
const calculateConfidence = (
  loc: Location
): number => {

  const accuracy =
    loc.accuracy ?? 100;

  if (accuracy <= 10) {
    return 0.95;
  }

  if (accuracy <= 25) {
    return 0.85;
  }

  if (accuracy <= 50) {
    return 0.75;
  }

  if (accuracy <= 100) {
    return 0.6;
  }

  return 0.4;

};

// ===============================
// FORMAT LOCATION
// ===============================
const formatLocation = (
  position: GeolocationPosition
): Location => ({

  lat:
    position.coords.latitude,

  lng:
    position.coords.longitude,

  accuracy:
    position.coords.accuracy ??
    100,

  speed:
    position.coords.speed !==
      null &&
    position.coords.speed !==
      undefined
      ? position.coords.speed *
        3.6
      : 0,

  timestamp:
    position.timestamp

});

// ===============================
// PARSE ERROR
// ===============================
const parseError = (
  error: GeolocationPositionError
): string => {

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
const deg2rad = (
  deg: number
): number => {

  return (
    deg *
    (Math.PI / 180)
  );

};