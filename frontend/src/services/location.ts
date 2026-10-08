// src/services/location.ts
// Pulse Transit - Location Service
//
// Features:
// - Browser location permission handling
// - Detects permission denied / GPS unavailable / timeout
// - High-accuracy trip tracking
// - Smart GPS filtering
// - Speed and movement detection
// - Battery optimisation
// - Offline location queue
// - Location caching
// - Distance calculations

import { Capacitor } from "@capacitor/core";

import { BackgroundTracker, BackgroundTrackerError } from "./backgroundTracker";
import type { Location } from "../types";

// ======================================================
// TYPES
// ======================================================

export interface MovementMeta {
  speed: number;
  isMoving: boolean;
  isWalking: boolean;
  confidence: number;
  isStale: boolean;
  isAccurate: boolean;
  source: "gps" | "cache" | "network";
}

export interface LocationQueueItem {
  location: Location;
  meta: MovementMeta;
  timestamp: number;
}

export interface LocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  batteryOptimized?: boolean;
}

export type LocationErrorCode =
  | "PERMISSION_DENIED"
  | "POSITION_UNAVAILABLE"
  | "TIMEOUT"
  | "NOT_SUPPORTED"
  | "UNKNOWN";

export class LocationServiceError extends Error {
  code: LocationErrorCode;

  constructor(code: LocationErrorCode, message: string) {
    super(message);

    this.name = "LocationServiceError";
    this.code = code;

    // Required for some older JS targets when extending Error.
    Object.setPrototypeOf(this, LocationServiceError.prototype);
  }
}

// ======================================================
// CONFIGURATION
// ======================================================

const CONFIG = {
  // Ignore GPS drift smaller than 5 metres.
  MIN_DISTANCE_KM: 0.005,

  // Accuracy thresholds.
  MAX_ACCURACY_METERS: 100,
  EXCELLENT_ACCURACY: 15,
  GOOD_ACCURACY: 30,
  FAIR_ACCURACY: 60,

  // Speed thresholds in km/h.
  WALKING_MIN_SPEED: 1,
  WALKING_MAX_SPEED: 8,

  RUNNING_MIN_SPEED: 8,
  RUNNING_MAX_SPEED: 15,

  CYCLING_MIN_SPEED: 15,
  CYCLING_MAX_SPEED: 30,

  VEHICLE_SPEED_THRESHOLD: 10,

  // Anything above this is considered an implausible GPS result.
  MAX_PLAUSIBLE_SPEED: 180,

  // Smoothing.
  SMOOTHING_WINDOW: 5,
  SPEED_SMOOTHING_WINDOW: 3,

  // Stale location detection.
  STALE_LOCATION_MS: 10000,

  // Last-known-location cache.
  MAX_CACHE_AGE_MS: 30000,

  // Battery settings.
  BATTERY_SAVER_INTERVAL_MS: 10000,
  NORMAL_INTERVAL_MS: 3000,

  // Offline queue.
  MAX_QUEUE_SIZE: 100,
  OFFLINE_STORAGE_KEY: "pulse_location_queue",
} as const;

// ======================================================
// INTERNAL STATE
// ======================================================

let history: Location[] = [];

let speedHistory: number[] = [];

let lastKnownLocation: Location | null = null;

let lastUpdateTime = 0;

let isBatteryOptimized = false;

let locationQueue: LocationQueueItem[] = [];

let isOnline =
  typeof navigator !== "undefined"
    ? navigator.onLine
    : true;

// ======================================================
// NETWORK STATUS HANDLING
// ======================================================

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    isOnline = true;

    void flushLocationQueue();
  });

  window.addEventListener("offline", () => {
    isOnline = false;

    console.log(
      "📡 Pulse is offline. Location readings will be queued."
    );
  });
}

// ======================================================
// LOCATION SUPPORT
// ======================================================

export const isLocationSupported = (): boolean => {
  if (Capacitor.isNativePlatform()) {
    return true;
  }

  return (
    typeof navigator !== "undefined" &&
    "geolocation" in navigator
  );
};

// ======================================================
// LOCATION PERMISSION STATUS
// ======================================================

/**
 * Returns:
 *
 * "granted"    - permission already allowed
 * "prompt"     - browser will ask the user
 * "denied"     - permission blocked
 * "unsupported" - Permissions API unavailable
 *
 * IMPORTANT:
 * A granted browser permission does NOT necessarily mean
 * the phone's system Location/GPS switch is turned on.
 *
 * getCurrentLocation() is still required to obtain an
 * actual position.
 */
export const getLocationPermissionState =
  async (): Promise<
    PermissionState | "unsupported"
  > => {
    // The native background-geolocation plugin owns Android permission prompts.
    // Browser Permissions API state is not authoritative inside a Capacitor app.
    if (Capacitor.isNativePlatform()) {
      return "unsupported";
    }

    if (typeof navigator === "undefined") {
      return "unsupported";
    }

    if (!navigator.permissions?.query) {
      return "unsupported";
    }

    try {
      const permission =
        await navigator.permissions.query({
          name: "geolocation" as PermissionName,
        });

      return permission.state;
    } catch (error) {
      console.warn(
        "Could not read geolocation permission state:",
        error
      );

      return "unsupported";
    }
  };

// ======================================================
// GET CURRENT LOCATION
// ======================================================

/**
 * Requests one real location reading.
 *
 * Calling this function can trigger the browser's:
 *
 * "Allow Pulse to use your location?"
 *
 * permission popup.
 *
 * We deliberately DO NOT automatically return an old cached
 * location when GPS/location fails. This allows the UI to tell
 * the commuter that Location/GPS needs to be turned on.
 */
export const getCurrentLocation = (
  options?: LocationOptions
): Promise<Location> => {
  if (Capacitor.isNativePlatform()) {
    return (async () => {
      try {
        const native = await BackgroundTracker.getDevicePosition();
        const location: Location = {
          lat: native.lat,
          lng: native.lng,
          accuracy: native.accuracy,
          speed: native.speed,
          heading: native.heading,
          altitude: native.altitude,
          timestamp: native.timestamp || Date.now(),
        };

        updateState(location);
        lastKnownLocation = location;
        lastUpdateTime = Date.now();

        return location;
      } catch (error) {
        if (error instanceof BackgroundTrackerError) {
          const code: LocationErrorCode =
            error.code === "PERMISSION_DENIED"
              ? "PERMISSION_DENIED"
              : error.code === "TIMEOUT"
                ? "TIMEOUT"
                : error.code === "NOT_SUPPORTED"
                  ? "NOT_SUPPORTED"
                  : error.code === "POSITION_UNAVAILABLE"
                    ? "POSITION_UNAVAILABLE"
                    : "UNKNOWN";

          throw new LocationServiceError(code, error.message);
        }

        throw new LocationServiceError(
          "UNKNOWN",
          "Pulse could not determine your location. Please try again.",
        );
      }
    })();
  }

  return new Promise((resolve, reject) => {
    if (!isLocationSupported()) {
      reject(
        new LocationServiceError(
          "NOT_SUPPORTED",
          "Location is not supported on this device or browser."
        )
      );

      return;
    }

    const positionOptions: PositionOptions = {
      enableHighAccuracy:
        options?.enableHighAccuracy ??
        !isBatteryOptimized,

      timeout: options?.timeout ?? 12000,

      maximumAge: options?.maximumAge ?? 0,
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location =
          formatLocation(position);

        updateState(location);

        lastKnownLocation = location;
        lastUpdateTime = Date.now();

        if (import.meta.env.DEV) {
          console.log(
            "📍 Current location acquired",
            {
              lat: location.lat.toFixed(6),
              lng: location.lng.toFixed(6),
              accuracy:
                Math.round(
                  location.accuracy ?? 0
                ) + "m",
            }
          );
        }

        resolve(location);
      },

      (error) => {
        const locationError =
          createLocationError(error);

        console.error(
          "❌ Could not obtain location:",
          locationError.code,
          locationError.message
        );

        reject(locationError);
      },

      positionOptions
    );
  });
};

// ======================================================
// WATCH LOCATION
// ======================================================

/**
 * Starts continuous GPS tracking.
 *
 * This should normally be called AFTER the user starts a trip,
 * not automatically when the entire Pulse app opens.
 */
export const watchLocation = (
  onUpdate: (
    location: Location,
    meta: MovementMeta
  ) => void,

  /**
   * First argument remains a STRING for backwards compatibility
   * with the existing Pulse hook/UI.
   *
   * A second optional argument supplies the error code.
   */
  onError?: (
    message: string,
    code?: LocationErrorCode
  ) => void,

  options?: LocationOptions
): number => {
  if (!isLocationSupported()) {
    throw new LocationServiceError(
      "NOT_SUPPORTED",
      "Location is not supported on this device or browser."
    );
  }

  const positionOptions: PositionOptions = {
    enableHighAccuracy:
      options?.enableHighAccuracy ??
      !isBatteryOptimized,

    timeout: options?.timeout ?? 15000,

    maximumAge: options?.maximumAge ?? 0,
  };

  return navigator.geolocation.watchPosition(
    (position) => {
      const location =
        formatLocation(position);

      const previous =
        history[history.length - 1];

      let distance = 0;
      let shouldSkip = false;

      // ==================================================
      // DISTANCE / GPS JUMP VALIDATION
      // ==================================================

      if (previous) {
        distance = calculateDistance(
          previous,
          location
        );

        /*
         * Instead of blindly rejecting every reading that
         * moved more than 500m, calculate the implied speed.
         *
         * This prevents real vehicle journeys from being
         * discarded simply because the browser delivered
         * the next GPS reading late.
         */
        if (
          previous.timestamp &&
          location.timestamp
        ) {
          const elapsedHours =
            (location.timestamp -
              previous.timestamp) /
            3600000;

          if (elapsedHours > 0) {
            const impliedSpeed =
              distance / elapsedHours;

            if (
              distance > 0.05 &&
              impliedSpeed >
                CONFIG.MAX_PLAUSIBLE_SPEED
            ) {
              console.warn(
                "⚠️ Ignoring implausible GPS jump",
                {
                  distanceKm:
                    distance.toFixed(3),

                  impliedSpeedKmh:
                    impliedSpeed.toFixed(1),
                }
              );

              shouldSkip = true;
            }
          }
        }

        /*
         * Filter normal stationary GPS drift.
         *
         * We keep lastKnownLocation updated below, but we
         * don't add movements smaller than 5m to trip history.
         */
        if (
          distance < CONFIG.MIN_DISTANCE_KM
        ) {
          shouldSkip = true;
        }
      }

      // ==================================================
      // STALE READING DETECTION
      // ==================================================

      /*
       * Use the timestamp of the GPS reading itself.
       *
       * The old implementation updated lastUpdateTime before
       * checking staleness, making isStale almost always false.
       */
      const locationAge =
        Math.max(
          0,
          Date.now() - position.timestamp
        );

      const isStale =
        locationAge >
        CONFIG.STALE_LOCATION_MS;

      // ==================================================
      // ALWAYS REMEMBER THE LATEST REAL POSITION
      // ==================================================

      lastKnownLocation = location;
      lastUpdateTime = Date.now();

      /*
       * Skip GPS drift / impossible jumps from the trip
       * calculation.
       */
      if (shouldSkip) {
        return;
      }

      // ==================================================
      // ACCEPT LOCATION
      // ==================================================

      updateState(location);

      // ==================================================
      // SPEED
      // ==================================================

      let speed = 0;

      /*
       * navigator.geolocation reports speed in m/s.
       * Pulse uses km/h.
       */
      if (
        position.coords.speed !== null &&
        position.coords.speed !== undefined &&
        position.coords.speed >= 0
      ) {
        speed =
          position.coords.speed * 3.6;
      } else {
        speed = getSmoothedSpeed();
      }

      // Reject impossible speed values.
      if (
        !Number.isFinite(speed) ||
        speed < 0 ||
        speed >
          CONFIG.MAX_PLAUSIBLE_SPEED
      ) {
        speed = getSmoothedSpeed();
      }

      // ==================================================
      // SPEED HISTORY
      // ==================================================

      speedHistory.push(speed);

      if (
        speedHistory.length >
        CONFIG.SPEED_SMOOTHING_WINDOW
      ) {
        speedHistory.shift();
      }

      // ==================================================
      // MOVEMENT CLASSIFICATION
      // ==================================================

      const isMoving =
        speed >
        CONFIG.WALKING_MIN_SPEED;

      const isWalking =
        speed >=
          CONFIG.WALKING_MIN_SPEED &&
        speed <=
          CONFIG.WALKING_MAX_SPEED;

      const isRunning =
        speed >=
          CONFIG.RUNNING_MIN_SPEED &&
        speed <=
          CONFIG.RUNNING_MAX_SPEED;

      const isCycling =
        speed >=
          CONFIG.CYCLING_MIN_SPEED &&
        speed <=
          CONFIG.CYCLING_MAX_SPEED;

      const isDriving =
        speed >
        CONFIG.VEHICLE_SPEED_THRESHOLD;

      // ==================================================
      // META DATA
      // ==================================================

      const meta: MovementMeta = {
        speed:
          Math.round(speed * 10) / 10,

        isMoving,

        isWalking,

        confidence:
          calculateConfidence(location),

        isStale,

        isAccurate:
          isAccurate(location),

        /*
         * Browsers don't provide a completely reliable way
         * to identify GPS vs network location.
         *
         * A direct speed measurement usually indicates a
         * proper device positioning source.
         */
        source:
          position.coords.speed !== null
            ? "gps"
            : "network",
      };

      // ==================================================
      // OFFLINE QUEUE
      // ==================================================

      if (!isOnline) {
        addToQueue(location, meta);
      }

      // ==================================================
      // SEND LOCATION TO TRIP ENGINE / HOOK
      // ==================================================

      onUpdate(location, meta);

      // ==================================================
      // DEVELOPMENT LOGGING
      // ==================================================

      if (import.meta.env.DEV) {
        console.log("📍 GPS UPDATE", {
          lat: location.lat.toFixed(6),

          lng: location.lng.toFixed(6),

          distance:
            distance.toFixed(3) +
            " km",

          speed:
            speed.toFixed(1) +
            " km/h",

          accuracy:
            Math.round(
              location.accuracy ?? 0
            ) + "m",

          locationAge:
            Math.round(locationAge / 1000) +
            "s",

          mode: isWalking
            ? "🚶 walking"
            : isRunning
              ? "🏃 running"
              : isCycling
                ? "🚴 cycling"
                : isDriving
                  ? "🚗 vehicle"
                  : "📍 stationary",

          confidence:
            meta.confidence,

          stale:
            meta.isStale,
        });
      }
    },

    // ==================================================
    // WATCH ERROR
    // ==================================================

    (error) => {
      const locationError =
        createLocationError(error);

      console.error(
        "❌ GPS WATCH ERROR:",
        locationError.code,
        locationError.message
      );

      /*
       * Keep first argument as a string so existing Pulse
       * components using setError(error) don't break.
       */
      onError?.(
        locationError.message,
        locationError.code
      );
    },

    positionOptions
  );
};

// ======================================================
// CLEAR LOCATION WATCH
// ======================================================

export const clearLocationWatch = (
  watchId: number
): void => {
  if (!isLocationSupported()) {
    return;
  }

  navigator.geolocation.clearWatch(
    watchId
  );

  if (import.meta.env.DEV) {
    console.log(
      "🛑 GPS location watcher stopped"
    );
  }
};

// ======================================================
// BATTERY OPTIMIZATION
// ======================================================

export const setBatteryOptimized = (
  enabled: boolean
): void => {
  isBatteryOptimized = enabled;

  console.log(
    `🔋 Battery optimisation: ${
      enabled ? "ON" : "OFF"
    }`
  );
};

export const isBatteryOptimizedMode =
  (): boolean => {
    return isBatteryOptimized;
  };

// ======================================================
// GET LAST KNOWN LOCATION
// ======================================================

/**
 * This is useful for displaying the most recent position in
 * the UI, but SHOULD NOT be used to silently bypass a failed
 * Start Trip location request.
 */
export const getLastKnownLocation =
  (): Location | null => {
    if (!lastKnownLocation) {
      return null;
    }

    const age =
      Date.now() - lastUpdateTime;

    if (
      age <= CONFIG.MAX_CACHE_AGE_MS
    ) {
      return lastKnownLocation;
    }

    return null;
  };

// ======================================================
// LOCATION HISTORY
// ======================================================

export const getLocationHistory = (
  limit?: number
): Location[] => {
  if (
    limit !== undefined &&
    limit > 0
  ) {
    return history.slice(-limit);
  }

  return [...history];
};

export const clearLocationHistory =
  (): void => {
    history = [];

    speedHistory = [];

    console.log(
      "🗑️ Location history cleared"
    );
  };

// ======================================================
// DISTANCE CALCULATION
// ======================================================

/**
 * Calculates distance between two coordinates using the
 * Haversine formula.
 *
 * Returns kilometres.
 */
export const calculateDistance = (
  loc1: Location,
  loc2: Location
): number => {
  const EARTH_RADIUS_KM = 6371;

  const dLat = deg2rad(
    loc2.lat - loc1.lat
  );

  const dLon = deg2rad(
    loc2.lng - loc1.lng
  );

  const lat1 =
    deg2rad(loc1.lat);

  const lat2 =
    deg2rad(loc2.lat);

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return EARTH_RADIUS_KM * c;
};

// ======================================================
// SPEED CALCULATION
// ======================================================

/**
 * Calculates speed between two locations in km/h.
 */
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
    calculateDistance(loc1, loc2);

  const elapsedMilliseconds =
    loc2.timestamp -
    loc1.timestamp;

  if (
    elapsedMilliseconds <= 0
  ) {
    return 0;
  }

  const hours =
    elapsedMilliseconds /
    3600000;

  const speed =
    distance / hours;

  if (
    !Number.isFinite(speed) ||
    speed < 0 ||
    speed >
      CONFIG.MAX_PLAUSIBLE_SPEED
  ) {
    return 0;
  }

  return speed;
};

// ======================================================
// LOCATION AGE / STALE STATUS
// ======================================================

export const isLocationStale =
  (): boolean => {
    if (!lastUpdateTime) {
      return true;
    }

    return (
      Date.now() -
        lastUpdateTime >
      CONFIG.STALE_LOCATION_MS
    );
  };

export const getLocationAge =
  (): number | null => {
    if (!lastUpdateTime) {
      return null;
    }

    return (
      Date.now() -
      lastUpdateTime
    );
  };

// ======================================================
// MOVEMENT MODE
// ======================================================

export const getMovementMode = (
  speed: number
): string => {
  if (
    speed <
    CONFIG.WALKING_MIN_SPEED
  ) {
    return "stationary";
  }

  if (
    speed <=
    CONFIG.WALKING_MAX_SPEED
  ) {
    return "walking";
  }

  if (
    speed <=
    CONFIG.RUNNING_MAX_SPEED
  ) {
    return "running";
  }

  if (
    speed <=
    CONFIG.CYCLING_MAX_SPEED
  ) {
    return "cycling";
  }

  return "driving";
};

// ======================================================
// OFFLINE QUEUE
// ======================================================

const loadQueue = (): void => {
  if (
    typeof localStorage ===
    "undefined"
  ) {
    return;
  }

  try {
    const saved =
      localStorage.getItem(
        CONFIG.OFFLINE_STORAGE_KEY
      );

    if (!saved) {
      return;
    }

    const parsed =
      JSON.parse(saved);

    if (Array.isArray(parsed)) {
      locationQueue = parsed;

      console.log(
        `📦 Loaded ${locationQueue.length} queued location readings`
      );
    }
  } catch (error) {
    console.error(
      "Failed to load location queue:",
      error
    );

    locationQueue = [];
  }
};

const saveQueue = (): void => {
  if (
    typeof localStorage ===
    "undefined"
  ) {
    return;
  }

  try {
    localStorage.setItem(
      CONFIG.OFFLINE_STORAGE_KEY,

      JSON.stringify(
        locationQueue
      )
    );
  } catch (error) {
    console.error(
      "Failed to save location queue:",
      error
    );
  }
};

const addToQueue = (
  location: Location,
  meta: MovementMeta
): void => {
  locationQueue.push({
    location,
    meta,
    timestamp: Date.now(),
  });

  if (
    locationQueue.length >
    CONFIG.MAX_QUEUE_SIZE
  ) {
    locationQueue.shift();
  }

  saveQueue();
};

/**
 * This currently clears the local queue.
 *
 * Replace the marked section later with the backend API call
 * when Pulse location synchronisation is connected.
 */
const flushLocationQueue =
  async (): Promise<void> => {
    if (
      locationQueue.length === 0
    ) {
      return;
    }

    if (!isOnline) {
      return;
    }

    console.log(
      `📤 ${locationQueue.length} queued location readings ready to sync`
    );

    try {
      /*
       * FUTURE BACKEND:
       *
       * await api.batchSendLocations(locationQueue);
       */

      locationQueue = [];

      saveQueue();
    } catch (error) {
      console.error(
        "Could not flush location queue:",
        error
      );
    }
  };

// ======================================================
// PRIVATE - SMOOTH SPEED
// ======================================================

const getSmoothedSpeed =
  (): number => {
    if (history.length < 2) {
      return 0;
    }

    const recentSpeeds: number[] =
      [];

    const startIndex =
      Math.max(
        0,

        history.length -
          CONFIG.SMOOTHING_WINDOW
      );

    for (
      let index =
        startIndex + 1;

      index < history.length;

      index++
    ) {
      const calculated =
        calculateSpeed(
          history[index - 1],
          history[index]
        );

      if (
        calculated > 0 &&
        calculated <
          CONFIG.MAX_PLAUSIBLE_SPEED
      ) {
        recentSpeeds.push(
          calculated
        );
      }
    }

    if (
      recentSpeeds.length === 0
    ) {
      return 0;
    }

    /*
     * Median is less affected by one bad GPS reading than
     * a simple average.
     */
    recentSpeeds.sort(
      (a, b) => a - b
    );

    const middle =
      Math.floor(
        recentSpeeds.length / 2
      );

    if (
      recentSpeeds.length % 2 ===
      0
    ) {
      return (
        (recentSpeeds[
          middle - 1
        ] +
          recentSpeeds[
            middle
          ]) /
        2
      );
    }

    return recentSpeeds[middle];
  };

// ======================================================
// PRIVATE - UPDATE LOCATION HISTORY
// ======================================================

const updateState = (
  location: Location
): void => {
  history.push(location);

  if (
    history.length >
    CONFIG.SMOOTHING_WINDOW
  ) {
    history.shift();
  }
};

// ======================================================
// PRIVATE - ACCURACY
// ======================================================

const isAccurate = (
  location: Location
): boolean => {
  const accuracy =
    location.accuracy ?? 999;

  return (
    accuracy <=
    CONFIG.MAX_ACCURACY_METERS
  );
};

// ======================================================
// PRIVATE - CONFIDENCE
// ======================================================

const calculateConfidence = (
  location: Location
): number => {
  const accuracy =
    location.accuracy ?? 100;

  if (
    accuracy <=
    CONFIG.EXCELLENT_ACCURACY
  ) {
    return 0.98;
  }

  if (
    accuracy <=
    CONFIG.GOOD_ACCURACY
  ) {
    return 0.9;
  }

  if (
    accuracy <=
    CONFIG.FAIR_ACCURACY
  ) {
    return 0.75;
  }

  if (
    accuracy <=
    CONFIG.MAX_ACCURACY_METERS
  ) {
    return 0.6;
  }

  return 0.4;
};

// ======================================================
// PRIVATE - FORMAT GEOLOCATION POSITION
// ======================================================

const formatLocation = (
  position: GeolocationPosition
): Location => {
  return {
    lat:
      position.coords.latitude,

    lng:
      position.coords.longitude,

    accuracy:
      position.coords.accuracy ??
      100,

    /*
     * Browser speed is metres/second.
     * Pulse stores/displays km/h.
     */
    speed:
      position.coords.speed !==
        null &&
      position.coords.speed !==
        undefined
        ? position.coords.speed *
          3.6
        : 0,

    heading:
      position.coords.heading ??
      undefined,

    altitude:
      position.coords.altitude ??
      undefined,

    timestamp:
      position.timestamp,
  };
};

// ======================================================
// PRIVATE - LOCATION ERRORS
// ======================================================

const createLocationError = (
  error: GeolocationPositionError
): LocationServiceError => {
  switch (error.code) {
    case 1:
      return new LocationServiceError(
        "PERMISSION_DENIED",

        "Pulse needs location permission to track your trip. Please allow location access and try again."
      );

    case 2:
      return new LocationServiceError(
        "POSITION_UNAVAILABLE",

        "Your location is unavailable. Please make sure Location/GPS is turned on and try again."
      );

    case 3:
      return new LocationServiceError(
        "TIMEOUT",

        "Pulse could not get your location in time. Make sure Location/GPS is turned on, move to an area with a clear signal, and try again."
      );

    default:
      return new LocationServiceError(
        "UNKNOWN",

        "Pulse could not determine your location. Please try again."
      );
  }
};

// ======================================================
// PRIVATE - DEGREES TO RADIANS
// ======================================================

const deg2rad = (
  degrees: number
): number => {
  return (
    degrees *
    (Math.PI / 180)
  );
};

// ======================================================
// INITIALIZATION
// ======================================================

loadQueue();

if (isOnline) {
  void flushLocationQueue();
}

console.log(
  "📍 Pulse location service initialized"
);