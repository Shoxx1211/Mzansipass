// src/hooks/useLocation.ts
// Pulse Transit - Premium GPS Location Hook (React Web Version)
// Features: Battery optimization, background tracking, geofencing, last known location

import { useState, useEffect, useRef, useCallback } from 'react';
import { watchLocation, clearLocationWatch, calculateDistance } from '../services/location';
import type { Location } from '../types';

// ======================================================
// TYPES
// ======================================================

interface LocationState {
  currentLocation: Location | null;
  previousLocation: Location | null;
  lastKnownLocation: Location | null;
  isReady: boolean;
  isTracking: boolean;
  isBackgroundTracking: boolean;
  accuracy: number;
  speed: number;
  heading: number;
  altitude: number | null;
  error: string | null;
  lastUpdate: number | null;
  batteryOptimized: boolean;
}

interface LocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  distanceFilter?: number;
  debug?: boolean;
  batteryOptimized?: boolean;
  backgroundTracking?: boolean;
  geofenceRadius?: number;
  cacheLastLocation?: boolean;
}

interface Geofence {
  id: string;
  center: Location;
  radius: number;
  onEnter?: () => void;
  onExit?: () => void;
  onDwell?: () => void;
  isInside: boolean;
}

// ======================================================
// CONSTANTS
// ======================================================

const DEFAULT_OPTIONS: Required<Omit<LocationOptions, 'geofenceRadius'>> & { geofenceRadius: number } = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
  distanceFilter: 10,
  debug: false,
  batteryOptimized: false,
  backgroundTracking: false,
  geofenceRadius: 100,
  cacheLastLocation: true
};

const ACCURACY_THRESHOLDS = {
  excellent: 10,
  good: 30,
  fair: 100,
  poor: 500
} as const;

const BATTERY_OPTIMIZATION = {
  highAccuracy: { interval: 1000, distanceFilter: 5 },
  balanced: { interval: 3000, distanceFilter: 15 },
  powerSaver: { interval: 10000, distanceFilter: 50 }
} as const;

const STORAGE_KEY = 'pulse_last_location';

// ======================================================
// MAIN HOOK
// ======================================================

export const useLocation = (options: LocationOptions = {}) => {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  // State
  const [state, setState] = useState<LocationState>({
    currentLocation: null,
    previousLocation: null,
    lastKnownLocation: null,
    isReady: false,
    isTracking: false,
    isBackgroundTracking: false,
    accuracy: 0,
    speed: 0,
    heading: 0,
    altitude: null,
    error: null,
    lastUpdate: null,
    batteryOptimized: mergedOptions.batteryOptimized
  });

  // Geofences
  const [geofences, setGeofences] = useState<Geofence[]>([]);

  // Refs
  const watchIdRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const lastLogTimeRef = useRef<number>(0);
  const backgroundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const geofenceCheckRef = useRef<NodeJS.Timeout | null>(null);

  // ======================================================
  // PRIVATE HELPERS
  // ======================================================

  const log = useCallback((message: string, data?: any) => {
    if (!mergedOptions.debug) return;
    const now = Date.now();
    if (now - lastLogTimeRef.current > 1000) {
      console.log(`[useLocation] ${message}`, data || '');
      lastLogTimeRef.current = now;
    }
  }, [mergedOptions.debug]);

  const getAccuracyRating = useCallback((accuracy: number): 'excellent' | 'good' | 'fair' | 'poor' => {
    if (accuracy <= ACCURACY_THRESHOLDS.excellent) return 'excellent';
    if (accuracy <= ACCURACY_THRESHOLDS.good) return 'good';
    if (accuracy <= ACCURACY_THRESHOLDS.fair) return 'fair';
    return 'poor';
  }, []);

  const formatLocationForStorage = useCallback((location: Location): Location => {
    return {
      lat: Number(location.lat.toFixed(6)),
      lng: Number(location.lng.toFixed(6)),
      accuracy: location.accuracy ? Number(location.accuracy.toFixed(1)) : undefined,
      speed: location.speed ? Number(location.speed.toFixed(1)) : undefined,
      heading: location.heading ? Number(location.heading.toFixed(1)) : undefined,
      timestamp: location.timestamp || Date.now()
    };
  }, []);

  // Cache last location
  const cacheLocation = useCallback((location: Location) => {
    if (!mergedOptions.cacheLastLocation) return;
    
    try {
      const cached = {
        ...location,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
      log('Cached last location');
    } catch (error) {
      console.error('Failed to cache location:', error);
    }
  }, [mergedOptions.cacheLastLocation, log]);

  // Load cached location on init
  const loadCachedLocation = useCallback((): Location | null => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const location = JSON.parse(cached);
        if (Date.now() - (location.timestamp || 0) < 86400000) {
          log('Loaded cached location');
          return location;
        }
      }
    } catch (error) {
      console.error('Failed to load cached location:', error);
    }
    return null;
  }, [log]);

  // ======================================================
  // GEOFENCING
  // ======================================================

  const checkGeofences = useCallback((location: Location) => {
    geofences.forEach(geofence => {
      const distance = calculateDistance(location, geofence.center);
      const wasInside = geofence.isInside;
      const isInside = distance <= geofence.radius;

      if (isInside && !wasInside) {
        log(`Entered geofence: ${geofence.id}`);
        geofence.onEnter?.();
        setGeofences(prev =>
          prev.map(g =>
            g.id === geofence.id ? { ...g, isInside: true } : g
          )
        );
      } else if (!isInside && wasInside) {
        log(`Exited geofence: ${geofence.id}`);
        geofence.onExit?.();
        setGeofences(prev =>
          prev.map(g =>
            g.id === geofence.id ? { ...g, isInside: false } : g
          )
        );
      } else if (isInside && wasInside && geofence.onDwell) {
        geofence.onDwell();
      }
    });
  }, [geofences, log]);

  const addGeofence = useCallback((geofence: Omit<Geofence, 'isInside'>) => {
    const newGeofence: Geofence = {
      ...geofence,
      isInside: false
    };
    
    if (state.currentLocation) {
      const distance = calculateDistance(state.currentLocation, geofence.center);
      newGeofence.isInside = distance <= geofence.radius;
    }
    
    setGeofences(prev => [...prev, newGeofence]);
    log(`Added geofence: ${geofence.id}`);
    
    return () => {
      setGeofences(prev => prev.filter(g => g.id !== geofence.id));
    };
  }, [state.currentLocation, log]);

  const removeGeofence = useCallback((id: string) => {
    setGeofences(prev => prev.filter(g => g.id !== id));
    log(`Removed geofence: ${id}`);
  }, [log]);

  const clearAllGeofences = useCallback(() => {
    setGeofences([]);
    log('Cleared all geofences');
  }, [log]);

  // ======================================================
  // LOCATION UPDATE HANDLER
  // ======================================================

  const handleLocationUpdate = useCallback((location: Location, meta?: any) => {
    if (!isMountedRef.current) return;

    setState(prev => {
      const distance = prev.currentLocation 
        ? calculateDistance(prev.currentLocation, location)
        : 0;

      if (prev.currentLocation && prev.lastUpdate) {
        const timeDiff = (location.timestamp || Date.now()) - prev.lastUpdate;
        const speedMps = distance / (timeDiff / 1000);
        
        if (speedMps > 55.5 && !meta?.isVehicleMode) {
          log(`⚠️ Rejected GPS jump: ${(speedMps * 3.6).toFixed(1)} km/h`);
          return prev;
        }
      }

      const formattedLocation = formatLocationForStorage(location);
      cacheLocation(formattedLocation);
      checkGeofences(formattedLocation);

      const newState: LocationState = {
        currentLocation: formattedLocation,
        previousLocation: prev.currentLocation,
        lastKnownLocation: formattedLocation,
        isReady: true,
        isTracking: true,
        isBackgroundTracking: prev.isBackgroundTracking,
        accuracy: location.accuracy || 0,
        speed: meta?.speed || location.speed || 0,
        heading: meta?.heading || location.heading || 0,
        altitude: null,
        error: null,
        lastUpdate: location.timestamp || Date.now(),
        batteryOptimized: prev.batteryOptimized
      };

      if (distance > mergedOptions.distanceFilter) {
        log(`📍 Moved ${distance.toFixed(1)}m`, {
          accuracy: getAccuracyRating(newState.accuracy),
          speed: newState.speed.toFixed(1)
        });
      }

      return newState;
    });
  }, [formatLocationForStorage, getAccuracyRating, log, mergedOptions.distanceFilter, cacheLocation, checkGeofences]);

  // ======================================================
  // ERROR HANDLER
  // ======================================================

  const handleLocationError = useCallback((error: string) => {
    if (!isMountedRef.current) return;
    log(`❌ Location error: ${error}`);
    
    setState(prev => ({
      ...prev,
      error,
      isTracking: false,
      isReady: false
    }));
  }, [log]);

  // ======================================================
  // START/STOP TRACKING
  // ======================================================

  const startTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      log('Already tracking, stopping existing watch');
      clearLocationWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    const trackingOptions = mergedOptions.batteryOptimized
      ? {
          enableHighAccuracy: false,
          timeout: BATTERY_OPTIMIZATION.powerSaver.interval,
          maximumAge: BATTERY_OPTIMIZATION.powerSaver.distanceFilter
        }
      : {
          enableHighAccuracy: mergedOptions.enableHighAccuracy,
          timeout: mergedOptions.timeout,
          maximumAge: mergedOptions.maximumAge
        };

    log('Starting location tracking', { options: trackingOptions });

    const watchId = watchLocation(
      handleLocationUpdate,
      handleLocationError,
      trackingOptions
    );

    watchIdRef.current = watchId;
    setState(prev => ({ ...prev, isTracking: true, error: null }));
    
    return watchId;
  }, [handleLocationUpdate, handleLocationError, log, mergedOptions]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      log('Stopping location tracking');
      clearLocationWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    if (backgroundTimerRef.current) {
      clearInterval(backgroundTimerRef.current);
      backgroundTimerRef.current = null;
    }
    
    if (geofenceCheckRef.current) {
      clearInterval(geofenceCheckRef.current);
      geofenceCheckRef.current = null;
    }
    
    setState(prev => ({ ...prev, isTracking: false, isBackgroundTracking: false }));
  }, [log]);

  const restartTracking = useCallback(() => {
    stopTracking();
    setTimeout(() => startTracking(), 100);
  }, [stopTracking, startTracking]);

  const setBatteryOptimized = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, batteryOptimized: enabled }));
    restartTracking();
    log(`Battery optimization: ${enabled ? 'ON' : 'OFF'}`);
  }, [restartTracking, log]);

  // ======================================================
  // GET CURRENT LOCATION
  // ======================================================

  const getCurrentPosition = useCallback((): Promise<Location> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: Location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed || undefined,
            heading: position.coords.heading || undefined,
            timestamp: position.timestamp
          };
          resolve(location);
        },
        (error) => {
          reject(new Error(error.message));
        },
        {
          enableHighAccuracy: !state.batteryOptimized,
          timeout: mergedOptions.timeout,
          maximumAge: mergedOptions.maximumAge
        }
      );
    });
  }, [mergedOptions.timeout, mergedOptions.maximumAge, state.batteryOptimized]);

  // ======================================================
  // BACKGROUND TRACKING
  // ======================================================

  const startBackgroundTracking = useCallback(() => {
    if (!mergedOptions.backgroundTracking) return;
    
    setState(prev => ({ ...prev, isBackgroundTracking: true }));
    
    backgroundTimerRef.current = setInterval(() => {
      if (isMountedRef.current && !state.isTracking) {
        getCurrentPosition()
          .then(location => handleLocationUpdate(location, { isBackground: true }))
          .catch(error => log('Background tracking error:', error));
      }
    }, 30000);
    
    log('Started background tracking');
  }, [mergedOptions.backgroundTracking, state.isTracking, handleLocationUpdate, log, getCurrentPosition]);

  const stopBackgroundTracking = useCallback(() => {
    if (backgroundTimerRef.current) {
      clearInterval(backgroundTimerRef.current);
      backgroundTimerRef.current = null;
    }
    setState(prev => ({ ...prev, isBackgroundTracking: false }));
    log('Stopped background tracking');
  }, [log]);

  // ======================================================
  // UTILITIES
  // ======================================================

  const getDistanceTo = useCallback((target: Location): number | null => {
    if (!state.currentLocation) return null;
    return calculateDistance(state.currentLocation, target);
  }, [state.currentLocation]);

  const isWithinRadius = useCallback((center: Location, radiusMeters: number): boolean => {
    const distance = getDistanceTo(center);
    return distance !== null && distance <= radiusMeters;
  }, [getDistanceTo]);

  const getAccuracyStatus = useCallback((): 'excellent' | 'good' | 'fair' | 'poor' | null => {
    if (!state.accuracy) return null;
    return getAccuracyRating(state.accuracy);
  }, [state.accuracy, getAccuracyRating]);

  const isHighAccuracy = useCallback((): boolean => {
    return state.accuracy <= ACCURACY_THRESHOLDS.good;
  }, [state.accuracy]);

  // ======================================================
  // EFFECTS
  // ======================================================

  useEffect(() => {
    const cached = loadCachedLocation();
    if (cached) {
      setState(prev => ({
        ...prev,
        lastKnownLocation: cached,
        currentLocation: cached
      }));
    }
  }, [loadCachedLocation]);

  useEffect(() => {
    isMountedRef.current = true;
    startTracking();
    startBackgroundTracking();

    return () => {
      isMountedRef.current = false;
      stopTracking();
      stopBackgroundTracking();
    };
  }, [startTracking, stopTracking, startBackgroundTracking, stopBackgroundTracking]);

 // Auto-restart on error recovery
useEffect(() => {
  // Early return if no error or already tracking
  if (!state.error || state.isTracking) {
    return;
  }
  
  const timer = setTimeout(() => {
    if (isMountedRef.current && state.error) {
      log('Attempting to restart tracking after error');
      restartTracking();
    }
  }, 5000);
  
  return () => clearTimeout(timer);
}, [state.error, state.isTracking, restartTracking, log]);

  // App state change handler (React Web version - using Page Visibility API)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        log('App moved to background');
        if (mergedOptions.batteryOptimized) {
          stopTracking();
        }
      } else {
        log('App moved to foreground');
        if (!state.isTracking) {
          startTracking();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [mergedOptions.batteryOptimized, state.isTracking, startTracking, stopTracking, log]);

  // ======================================================
  // RETURN API
  // ======================================================

  return {
    location: state.currentLocation,
    previousLocation: state.previousLocation,
    lastKnownLocation: state.lastKnownLocation,
    isReady: state.isReady,
    isTracking: state.isTracking,
    isBackgroundTracking: state.isBackgroundTracking,
    error: state.error,
    
    accuracy: state.accuracy,
    accuracyStatus: getAccuracyStatus(),
    isHighAccuracy: isHighAccuracy(),
    speed: state.speed,
    heading: state.heading,
    lastUpdate: state.lastUpdate,
    batteryOptimized: state.batteryOptimized,
    
    getDistanceTo,
    isWithinRadius,
    calculateDistance,
    
    startTracking,
    stopTracking,
    restartTracking,
    getCurrentPosition,
    setBatteryOptimized,
    startBackgroundTracking,
    stopBackgroundTracking,
    
    addGeofence,
    removeGeofence,
    clearAllGeofences,
    geofences,
    
    getCoordinates: () => state.currentLocation 
      ? { lat: state.currentLocation.lat, lng: state.currentLocation.lng }
      : null,
    
    hasValidLocation: () => state.isReady && state.currentLocation !== null,
    
    isMoving: () => state.speed > 1.5,
    isWalking: () => state.speed > 0.5 && state.speed < 5,
    isDriving: () => state.speed > 5,
    
    getLocationAge: () => state.lastUpdate ? Date.now() - state.lastUpdate : null,
    isLocationStale: () => {
      const age = state.lastUpdate ? Date.now() - state.lastUpdate : Infinity;
      return age > 60000;
    }
  };
};

export type { LocationOptions, LocationState, Geofence };