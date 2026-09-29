// src/hooks/useLocation.ts
// Pulse Transit - production GPS hook
//
// Behaviour:
// - Acquire ONE accurate position when the planner opens.
// - Do NOT start continuous GPS tracking on app startup.
// - Continuous tracking starts only when explicitly requested.
// - Cached coordinates are fallback context only, never a fresh GPS fix.
// - Speed is km/h and distance is kilometres across Pulse.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  calculateDistance,
  clearLocationWatch,
  getCurrentLocation,
  getLocationPermissionState,
  watchLocation,
  type LocationErrorCode,
  type MovementMeta,
} from "../services/location";

import type { Location } from "../types";

export type PulseLocationStatus =
  | "idle"
  | "requesting"
  | "ready"
  | "tracking"
  | "denied"
  | "unavailable"
  | "timeout"
  | "unsupported"
  | "error";

export interface LocationState {
  currentLocation: Location | null;
  previousLocation: Location | null;
  lastKnownLocation: Location | null;
  isReady: boolean;
  isLocating: boolean;
  isTracking: boolean;
  isBackgroundTracking: boolean;
  permissionStatus: PermissionState | "unsupported" | "unknown";
  status: PulseLocationStatus;
  accuracy: number;
  speed: number;
  heading: number;
  altitude: number | null;
  error: string | null;
  errorCode: LocationErrorCode | null;
  lastUpdate: number | null;
  batteryOptimized: boolean;
}

export interface LocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  distanceFilter?: number;
  debug?: boolean;
  batteryOptimized?: boolean;
  backgroundTracking?: boolean;
  geofenceRadius?: number;
  cacheLastLocation?: boolean;
  autoStart?: boolean;
  autoLocate?: boolean;
}

export interface Geofence {
  id: string;
  center: Location;
  radius: number; // metres
  onEnter?: () => void;
  onExit?: () => void;
  onDwell?: () => void;
  isInside: boolean;
}

const DEFAULT_OPTIONS: Required<LocationOptions> = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 5000,
  distanceFilter: 5,
  debug: false,
  batteryOptimized: false,
  backgroundTracking: false,
  geofenceRadius: 100,
  cacheLastLocation: true,
  autoStart: false,
  autoLocate: true,
};

const ACCURACY_THRESHOLDS = {
  excellent: 10,
  good: 30,
  fair: 100,
} as const;

const STORAGE_KEY = "pulse_last_location_v2";
const MAX_CACHED_LOCATION_AGE = 24 * 60 * 60 * 1000;
const MAX_PLAUSIBLE_SPEED_KMH = 220;

const inferErrorCode = (error: unknown): LocationErrorCode => {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (
      code === "PERMISSION_DENIED" ||
      code === "POSITION_UNAVAILABLE" ||
      code === "TIMEOUT" ||
      code === "NOT_SUPPORTED" ||
      code === "UNKNOWN"
    ) {
      return code;
    }
  }
  return "UNKNOWN";
};

const statusFromErrorCode = (code: LocationErrorCode): PulseLocationStatus => {
  switch (code) {
    case "PERMISSION_DENIED":
      return "denied";
    case "POSITION_UNAVAILABLE":
      return "unavailable";
    case "TIMEOUT":
      return "timeout";
    case "NOT_SUPPORTED":
      return "unsupported";
    default:
      return "error";
  }
};

const errorMessage = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;
  return "Pulse could not determine your location.";
};

export const useLocation = (options: LocationOptions = {}) => {
  const mergedOptions = useMemo<Required<LocationOptions>>(
    () => ({ ...DEFAULT_OPTIONS, ...options }),
    [
      options.enableHighAccuracy,
      options.timeout,
      options.maximumAge,
      options.distanceFilter,
      options.debug,
      options.batteryOptimized,
      options.backgroundTracking,
      options.geofenceRadius,
      options.cacheLastLocation,
      options.autoStart,
      options.autoLocate,
    ],
  );

  const [state, setState] = useState<LocationState>({
    currentLocation: null,
    previousLocation: null,
    lastKnownLocation: null,
    isReady: false,
    isLocating: false,
    isTracking: false,
    isBackgroundTracking: false,
    permissionStatus: "unknown",
    status: "idle",
    accuracy: 0,
    speed: 0,
    heading: 0,
    altitude: null,
    error: null,
    errorCode: null,
    lastUpdate: null,
    batteryOptimized: mergedOptions.batteryOptimized,
  });

  const [geofences, setGeofences] = useState<Geofence[]>([]);

  const watchIdRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const initialLocateAttemptedRef = useRef(false);
  const locatingPromiseRef = useRef<Promise<Location> | null>(null);
  const backgroundTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const log = useCallback(
    (message: string, data?: unknown) => {
      if (mergedOptions.debug) {
        console.log(`[Pulse Location] ${message}`, data ?? "");
      }
    },
    [mergedOptions.debug],
  );

  const formatLocation = useCallback(
    (location: Location): Location => ({
      lat: Number(location.lat.toFixed(6)),
      lng: Number(location.lng.toFixed(6)),
      accuracy:
        location.accuracy !== undefined
          ? Number(location.accuracy.toFixed(1))
          : undefined,
      speed:
        location.speed !== undefined
          ? Number(location.speed.toFixed(1))
          : undefined,
      heading:
        location.heading !== undefined
          ? Number(location.heading.toFixed(1))
          : undefined,
      altitude:
        location.altitude !== undefined
          ? Number(location.altitude.toFixed(1))
          : undefined,
      timestamp: location.timestamp || Date.now(),
    }),
    [],
  );

  const cacheLocation = useCallback(
    (location: Location) => {
      if (!mergedOptions.cacheLastLocation) return;
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...location, timestamp: Date.now() }),
        );
      } catch (error) {
        log("Unable to cache location", error);
      }
    },
    [log, mergedOptions.cacheLastLocation],
  );

  const loadCachedLocation = useCallback((): Location | null => {
    if (!mergedOptions.cacheLastLocation) return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw) as Location;
      const age = Date.now() - (cached.timestamp || 0);
      if (age <= MAX_CACHED_LOCATION_AGE) return cached;
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      log("Unable to load cached location", error);
    }
    return null;
  }, [log, mergedOptions.cacheLastLocation]);

  const checkGeofences = useCallback((location: Location) => {
    setGeofences((previous) =>
      previous.map((geofence) => {
        const distanceMeters = calculateDistance(location, geofence.center) * 1000;
        const wasInside = geofence.isInside;
        const isInside = distanceMeters <= geofence.radius;

        if (isInside && !wasInside) geofence.onEnter?.();
        else if (!isInside && wasInside) geofence.onExit?.();
        else if (isInside && wasInside) geofence.onDwell?.();

        return { ...geofence, isInside };
      }),
    );
  }, []);

  const applyLocation = useCallback(
    (
      location: Location,
      config?: { tracking?: boolean; meta?: MovementMeta },
    ) => {
      if (!isMountedRef.current) return;

      const formatted = formatLocation(location);

      setState((previous) => {
        const previousLocation = previous.currentLocation;

        if (previousLocation && previous.lastUpdate && formatted.timestamp) {
          const elapsedMs = formatted.timestamp - previous.lastUpdate;
          if (elapsedMs > 0) {
            const distanceKm = calculateDistance(previousLocation, formatted);
            const impliedSpeedKmh = distanceKm / (elapsedMs / 3_600_000);

            if (
              Number.isFinite(impliedSpeedKmh) &&
              impliedSpeedKmh > MAX_PLAUSIBLE_SPEED_KMH
            ) {
              log("Rejected implausible GPS jump", {
                impliedSpeedKmh,
                distanceKm,
              });
              return previous;
            }
          }
        }

        cacheLocation(formatted);
        checkGeofences(formatted);

        const isTracking = config?.tracking ?? previous.isTracking;

        return {
          ...previous,
          currentLocation: formatted,
          previousLocation,
          lastKnownLocation: formatted,
          isReady: true,
          isLocating: false,
          isTracking,
          permissionStatus: "granted",
          status: isTracking ? "tracking" : "ready",
          accuracy: formatted.accuracy ?? 0,
          speed: config?.meta?.speed ?? formatted.speed ?? 0,
          heading: formatted.heading ?? 0,
          altitude: formatted.altitude ?? null,
          error: null,
          errorCode: null,
          lastUpdate: formatted.timestamp ?? Date.now(),
        };
      });
    },
    [cacheLocation, checkGeofences, formatLocation, log],
  );

  const handleLocationError = useCallback(
    (error: unknown, explicitCode?: LocationErrorCode) => {
      if (!isMountedRef.current) return;

      const code = explicitCode ?? inferErrorCode(error);
      const message = errorMessage(error);

      log("Location error", { code, message });

      setState((previous) => ({
        ...previous,
        isLocating: false,
        isTracking: watchIdRef.current !== null,
        status: statusFromErrorCode(code),
        permissionStatus:
          code === "PERMISSION_DENIED" ? "denied" : previous.permissionStatus,
        error: message,
        errorCode: code,
        isReady: previous.currentLocation !== null,
      }));
    },
    [log],
  );

  const requestCurrentLocation = useCallback(async (): Promise<Location> => {
    if (locatingPromiseRef.current) return locatingPromiseRef.current;

    const promise = (async () => {
      setState((previous) => ({
        ...previous,
        isLocating: true,
        status: "requesting",
        error: null,
        errorCode: null,
      }));

      try {
        const permission = await getLocationPermissionState();
        if (isMountedRef.current) {
          setState((previous) => ({ ...previous, permissionStatus: permission }));
        }

        const location = await getCurrentLocation({
          enableHighAccuracy: true,
          timeout: Math.max(mergedOptions.timeout, 15000),
          maximumAge: 0,
        });

        applyLocation(location, { tracking: false });
        return location;
      } catch (error) {
        handleLocationError(error);
        throw error;
      }
    })();

    locatingPromiseRef.current = promise;

    try {
      return await promise;
    } finally {
      if (locatingPromiseRef.current === promise) {
        locatingPromiseRef.current = null;
      }
    }
  }, [applyLocation, handleLocationError, mergedOptions.timeout]);

  const getCurrentPosition = requestCurrentLocation;

  const startTracking = useCallback(() => {
    if (!isMountedRef.current) return null;
    if (watchIdRef.current !== null) return watchIdRef.current;

    try {
      const watchId = watchLocation(
        (location, meta) => {
          applyLocation(location, { tracking: true, meta });
        },
        (message, code) => {
          handleLocationError(message, code);
        },
        {
          enableHighAccuracy: mergedOptions.batteryOptimized
            ? false
            : mergedOptions.enableHighAccuracy,
          timeout: Math.max(mergedOptions.timeout, 10000),
          maximumAge: mergedOptions.maximumAge,
        },
      );

      watchIdRef.current = watchId;
      setState((previous) => ({
        ...previous,
        isTracking: true,
        status: previous.currentLocation ? "tracking" : "requesting",
        error: null,
        errorCode: null,
      }));

      return watchId;
    } catch (error) {
      handleLocationError(error);
      return null;
    }
  }, [
    applyLocation,
    handleLocationError,
    mergedOptions.batteryOptimized,
    mergedOptions.enableHighAccuracy,
    mergedOptions.maximumAge,
    mergedOptions.timeout,
  ]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      try {
        clearLocationWatch(watchIdRef.current);
      } catch (error) {
        log("Unable to clear location watch", error);
      }
      watchIdRef.current = null;
    }

    setState((previous) => ({
      ...previous,
      isTracking: false,
      status: previous.currentLocation ? "ready" : "idle",
    }));
  }, [log]);

  const restartTracking = useCallback(() => {
    stopTracking();
    return startTracking();
  }, [startTracking, stopTracking]);

  const setBatteryOptimized = useCallback((enabled: boolean) => {
    setState((previous) => ({ ...previous, batteryOptimized: enabled }));
  }, []);

  const startBackgroundTracking = useCallback(() => {
    if (!mergedOptions.backgroundTracking || backgroundTimerRef.current !== null) {
      return;
    }

    setState((previous) => ({ ...previous, isBackgroundTracking: true }));

    backgroundTimerRef.current = setInterval(() => {
      if (!isMountedRef.current || watchIdRef.current !== null) return;
      void requestCurrentLocation().catch(() => undefined);
    }, 30000);
  }, [mergedOptions.backgroundTracking, requestCurrentLocation]);

  const stopBackgroundTracking = useCallback(() => {
    if (backgroundTimerRef.current !== null) {
      clearInterval(backgroundTimerRef.current);
      backgroundTimerRef.current = null;
    }

    setState((previous) => ({ ...previous, isBackgroundTracking: false }));
  }, []);

  const getDistanceTo = useCallback(
    (target: Location): number | null => {
      if (!state.currentLocation) return null;
      return calculateDistance(state.currentLocation, target);
    },
    [state.currentLocation],
  );

  const isWithinRadius = useCallback(
    (center: Location, radiusMeters: number): boolean => {
      const distanceKm = getDistanceTo(center);
      return distanceKm !== null && distanceKm * 1000 <= radiusMeters;
    },
    [getDistanceTo],
  );

  const getAccuracyStatus = useCallback(() => {
    if (!state.accuracy) return null;
    if (state.accuracy <= ACCURACY_THRESHOLDS.excellent) return "excellent" as const;
    if (state.accuracy <= ACCURACY_THRESHOLDS.good) return "good" as const;
    if (state.accuracy <= ACCURACY_THRESHOLDS.fair) return "fair" as const;
    return "poor" as const;
  }, [state.accuracy]);

  useEffect(() => {
    const cached = loadCachedLocation();
    if (!cached) return;
    setState((previous) => ({ ...previous, lastKnownLocation: cached }));
  }, [loadCachedLocation]);

  useEffect(() => {
    if (!mergedOptions.autoLocate || initialLocateAttemptedRef.current) return;
    initialLocateAttemptedRef.current = true;
    void requestCurrentLocation().catch(() => undefined);
  }, [mergedOptions.autoLocate, requestCurrentLocation]);

  useEffect(() => {
    if (!mergedOptions.autoStart) return;
    startTracking();
    return () => stopTracking();
  }, [mergedOptions.autoStart, startTracking, stopTracking]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (watchIdRef.current !== null) {
        try {
          clearLocationWatch(watchIdRef.current);
        } catch {
          // Cleanup must never crash unmount.
        }
        watchIdRef.current = null;
      }

      if (backgroundTimerRef.current !== null) {
        clearInterval(backgroundTimerRef.current);
        backgroundTimerRef.current = null;
      }
    };
  }, []);

  return {
    location: state.currentLocation,
    previousLocation: state.previousLocation,
    lastKnownLocation: state.lastKnownLocation,
    isReady: state.isReady,
    isLocating: state.isLocating,
    isTracking: state.isTracking,
    isBackgroundTracking: state.isBackgroundTracking,
    permissionStatus: state.permissionStatus,
    status: state.status,
    error: state.error,
    errorCode: state.errorCode,
    accuracy: state.accuracy,
    accuracyStatus: getAccuracyStatus(),
    isHighAccuracy:
      state.accuracy > 0 && state.accuracy <= ACCURACY_THRESHOLDS.good,
    speed: state.speed,
    heading: state.heading,
    altitude: state.altitude,
    lastUpdate: state.lastUpdate,
    batteryOptimized: state.batteryOptimized,

    requestCurrentLocation,
    retryLocation: requestCurrentLocation,
    getCurrentPosition,

    startTracking,
    stopTracking,
    restartTracking,

    setBatteryOptimized,
    startBackgroundTracking,
    stopBackgroundTracking,

    getDistanceTo,
    isWithinRadius,
    calculateDistance,

    addGeofence: (geofence: Omit<Geofence, "isInside">) => {
      const current = state.currentLocation;
      const isInside = current
        ? calculateDistance(current, geofence.center) * 1000 <= geofence.radius
        : false;

      setGeofences((previous) => [...previous, { ...geofence, isInside }]);

      return () => {
        setGeofences((previous) =>
          previous.filter((item) => item.id !== geofence.id),
        );
      };
    },
    removeGeofence: (id: string) => {
      setGeofences((previous) => previous.filter((item) => item.id !== id));
    },
    clearAllGeofences: () => setGeofences([]),
    geofences,

    getCoordinates: () =>
      state.currentLocation
        ? { lat: state.currentLocation.lat, lng: state.currentLocation.lng }
        : null,

    hasValidLocation: () => state.isReady && state.currentLocation !== null,
    isMoving: () => state.speed >= 1,
    isWalking: () => state.speed >= 1 && state.speed <= 8,
    isDriving: () => state.speed > 15,

    getLocationAge: () =>
      state.lastUpdate ? Date.now() - state.lastUpdate : null,

    isLocationStale: () =>
      state.lastUpdate ? Date.now() - state.lastUpdate > 60000 : true,
  };
};
