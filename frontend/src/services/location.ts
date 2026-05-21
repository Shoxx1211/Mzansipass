// src/services/location.ts
// Pulse Transit - Premium Location Service
// Features: Smart filtering, battery optimization, offline queue, geofencing

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
  source: 'gps' | 'cache' | 'network';
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

// ======================================================
// CONFIGURATION
// ======================================================

const CONFIG = {
  // Distance filtering
  MIN_DISTANCE_KM: 0.005, // 5 meters (reduced from 2m for better filtering)
  MAX_DISTANCE_JUMP_KM: 0.5, // 500m max jump between readings
  
  // Accuracy thresholds
  MAX_ACCURACY_METERS: 100, // Stricter for better quality
  EXCELLENT_ACCURACY: 15,
  GOOD_ACCURACY: 30,
  FAIR_ACCURACY: 60,
  
  // Speed thresholds (km/h)
  WALKING_MIN_SPEED: 1,
  WALKING_MAX_SPEED: 8,
  RUNNING_MIN_SPEED: 8,
  RUNNING_MAX_SPEED: 15,
  CYCLING_MIN_SPEED: 15,
  CYCLING_MAX_SPEED: 30,
  VEHICLE_SPEED_THRESHOLD: 10,
  MAX_PLAUSIBLE_SPEED: 180,
  
  // Smoothing
  SMOOTHING_WINDOW: 5,
  SPEED_SMOOTHING_WINDOW: 3,
  
  // Stale detection
  STALE_LOCATION_MS: 10000, // 10 seconds
  MAX_CACHE_AGE_MS: 30000, // 30 seconds
  
  // Battery optimization
  BATTERY_SAVER_INTERVAL_MS: 10000,
  NORMAL_INTERVAL_MS: 3000,
  
  // Queue
  MAX_QUEUE_SIZE: 100,
  OFFLINE_STORAGE_KEY: 'pulse_location_queue'
};

// ======================================================
// INTERNAL STATE
// ======================================================

let history: Location[] = [];
let speedHistory: number[] = [];
let lastKnownLocation: Location | null = null;
let lastUpdateTime = 0;
let isBatteryOptimized = false;
let locationQueue: LocationQueueItem[] = [];
let isOnline = navigator.onLine;

// ======================================================
// NETWORK STATUS HANDLING
// ======================================================

window.addEventListener('online', () => {
  isOnline = true;
  flushLocationQueue();
});

window.addEventListener('offline', () => {
  isOnline = false;
  console.log('📡 App offline, queueing locations');
});

// ======================================================
// QUEUE MANAGEMENT
// ======================================================

const loadQueue = () => {
  try {
    const saved = localStorage.getItem(CONFIG.OFFLINE_STORAGE_KEY);
    if (saved) {
      locationQueue = JSON.parse(saved);
      console.log(`📦 Loaded ${locationQueue.length} queued locations`);
    }
  } catch (error) {
    console.error('Failed to load location queue:', error);
  }
};

const saveQueue = () => {
  try {
    localStorage.setItem(CONFIG.OFFLINE_STORAGE_KEY, JSON.stringify(locationQueue));
  } catch (error) {
    console.error('Failed to save location queue:', error);
  }
};

const addToQueue = (location: Location, meta: MovementMeta) => {
  locationQueue.push({ location, meta, timestamp: Date.now() });
  if (locationQueue.length > CONFIG.MAX_QUEUE_SIZE) {
    locationQueue.shift();
  }
  saveQueue();
};

const flushLocationQueue = async () => {
  if (locationQueue.length === 0) return;
  
  console.log(`📤 Flushing ${locationQueue.length} queued locations`);
  
  // Here you would send to your backend
  // await api.batchSendLocations(locationQueue);
  
  locationQueue = [];
  saveQueue();
};

// ======================================================
// PUBLIC API - GET CURRENT LOCATION
// ======================================================

export const getCurrentLocation = (options?: LocationOptions): Promise<Location> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }

    const opts = {
      enableHighAccuracy: options?.enableHighAccuracy ?? !isBatteryOptimized,
      timeout: options?.timeout ?? 15000,
      maximumAge: options?.maximumAge ?? 0
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = formatLocation(position);
        updateState(loc);
        
        // Also update lastKnownLocation for caching
        lastKnownLocation = loc;
        lastUpdateTime = Date.now();
        
        resolve(loc);
      },
      (error) => {
        // Fallback to cached location
        if (lastKnownLocation && Date.now() - lastUpdateTime < CONFIG.MAX_CACHE_AGE_MS) {
          console.warn("⚠️ Using cached location");
          resolve(lastKnownLocation);
          return;
        }
        reject(new Error(parseError(error)));
      },
      opts
    );
  });
};

// ======================================================
// PUBLIC API - WATCH LOCATION (ENHANCED)
// ======================================================

export const watchLocation = (
  onUpdate: (loc: Location, meta: MovementMeta) => void,
  onError?: (err: any) => void,
  options?: LocationOptions
): number => {
  if (!navigator.geolocation) {
    throw new Error("Geolocation not supported");
  }

  const opts = {
    enableHighAccuracy: options?.enableHighAccuracy ?? !isBatteryOptimized,
    timeout: options?.timeout ?? 15000,
    maximumAge: options?.maximumAge ?? 0
  };

  return navigator.geolocation.watchPosition(
    (position) => {
      const loc = formatLocation(position);
      const isAccurateFlag = isAccurate(loc);
      
      // Check for large GPS jumps
      const previous = history[history.length - 1];
      let distance = 0;
      let shouldSkip = false;
      
      if (previous) {
        distance = calculateDistance(previous, loc);
        
        // Filter out impossible jumps
        if (distance > CONFIG.MAX_DISTANCE_JUMP_KM && !isBatteryOptimized) {
          console.log(`⚠️ Skipping GPS jump: ${distance.toFixed(2)}km`);
          shouldSkip = true;
        }
        
        // Filter tiny movements (GPS drift)
        if (distance < CONFIG.MIN_DISTANCE_KM) {
          shouldSkip = true;
        }
      }
      
      if (shouldSkip) return;
      
      // Update state
      updateState(loc);
      lastKnownLocation = loc;
      lastUpdateTime = Date.now();
      
      // Calculate speed (prefer GPS speed, fallback to calculated)
      let speed = 0;
      if (position.coords.speed !== null && position.coords.speed !== undefined && position.coords.speed > 0) {
        speed = position.coords.speed * 3.6;
      } else {
        speed = getSmoothedSpeed();
      }
      
      // Validate speed
      if (speed < 0 || speed > CONFIG.MAX_PLAUSIBLE_SPEED) {
        speed = getSmoothedSpeed();
      }
      
      // Update speed history
      speedHistory.push(speed);
      if (speedHistory.length > CONFIG.SPEED_SMOOTHING_WINDOW) {
        speedHistory.shift();
      }
      
      // Check for stale location
      const isStale = (Date.now() - lastUpdateTime) > CONFIG.STALE_LOCATION_MS;
      
      // Determine movement mode
      const isMoving = speed > CONFIG.WALKING_MIN_SPEED;
      const isWalking = speed >= CONFIG.WALKING_MIN_SPEED && speed <= CONFIG.WALKING_MAX_SPEED;
      const isRunning = speed >= CONFIG.RUNNING_MIN_SPEED && speed <= CONFIG.RUNNING_MAX_SPEED;
      const isCycling = speed >= CONFIG.CYCLING_MIN_SPEED && speed <= CONFIG.CYCLING_MAX_SPEED;
      const isDriving = speed > CONFIG.VEHICLE_SPEED_THRESHOLD;
      
      const meta: MovementMeta = {
        speed: Math.round(speed * 10) / 10,
        isMoving,
        isWalking,
        confidence: calculateConfidence(loc),
        isStale,
        isAccurate: isAccurateFlag,
        source: position.coords.speed ? 'gps' : 'network'
      };
      
      // Queue if offline
      if (!isOnline) {
        addToQueue(loc, meta);
      }
      
      // Broadcast update
      onUpdate(loc, meta);
      
      // Detailed logging (only in debug mode)
      if (import.meta.env.DEV){
        console.log("📍 GPS UPDATE", {
          lat: loc.lat.toFixed(6),
          lng: loc.lng.toFixed(6),
          distance: distance.toFixed(3) + " km",
          speed: speed.toFixed(1) + " km/h",
          accuracy: loc.accuracy,
          mode: isWalking ? "🚶" : isRunning ? "🏃" : isCycling ? "🚴" : isDriving ? "🚗" : "📍",
          confidence: meta.confidence
        });
      }
    },
    (error) => {
      console.error("❌ GPS ERROR:", error);
      if (onError) {
        onError(parseError(error));
      }
    },
    opts
  );
};

// ======================================================
// PUBLIC API - CLEAR WATCH
// ======================================================

export const clearLocationWatch = (watchId: number) => {
  navigator.geolocation.clearWatch(watchId);
};

// ======================================================
// PUBLIC API - BATTERY OPTIMIZATION
// ======================================================

export const setBatteryOptimized = (enabled: boolean) => {
  isBatteryOptimized = enabled;
  console.log(`🔋 Battery optimization: ${enabled ? 'ON' : 'OFF'}`);
};

export const isBatteryOptimizedMode = () => isBatteryOptimized;

// ======================================================
// PUBLIC API - GET LAST KNOWN LOCATION
// ======================================================

export const getLastKnownLocation = (): Location | null => {
  if (lastKnownLocation && Date.now() - lastUpdateTime < CONFIG.MAX_CACHE_AGE_MS) {
    return lastKnownLocation;
  }
  return null;
};

// ======================================================
// PUBLIC API - GET LOCATION HISTORY
// ======================================================

export const getLocationHistory = (limit?: number): Location[] => {
  if (limit && limit > 0) {
    return history.slice(-limit);
  }
  return [...history];
};

export const clearLocationHistory = () => {
  history = [];
  speedHistory = [];
  console.log("🗑️ Location history cleared");
};

// ======================================================
// PUBLIC API - DISTANCE CALCULATION
// ======================================================

export const calculateDistance = (loc1: Location, loc2: Location): number => {
  const R = 6371; // Earth's radius in km
  const dLat = deg2rad(loc2.lat - loc1.lat);
  const dLon = deg2rad(loc2.lng - loc1.lng);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(loc1.lat)) * Math.cos(deg2rad(loc2.lat)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ======================================================
// PUBLIC API - SPEED CALCULATION
// ======================================================

export const calculateSpeed = (loc1: Location, loc2: Location): number => {
  if (!loc1.timestamp || !loc2.timestamp) return 0;
  
  const distance = calculateDistance(loc1, loc2);
  const hours = (loc2.timestamp - loc1.timestamp) / 3600000;
  
  if (hours <= 0) return 0;
  
  const speed = distance / hours;
  
  if (!Number.isFinite(speed) || speed < 0 || speed > CONFIG.MAX_PLAUSIBLE_SPEED) {
    return 0;
  }
  
  return speed;
};

// ======================================================
// PUBLIC API - UTILITIES
// ======================================================

export const isLocationStale = (): boolean => {
  return (Date.now() - lastUpdateTime) > CONFIG.STALE_LOCATION_MS;
};

export const getLocationAge = (): number | null => {
  if (!lastUpdateTime) return null;
  return Date.now() - lastUpdateTime;
};

export const getMovementMode = (speed: number): string => {
  if (speed < CONFIG.WALKING_MIN_SPEED) return "stationary";
  if (speed <= CONFIG.WALKING_MAX_SPEED) return "walking";
  if (speed <= CONFIG.RUNNING_MAX_SPEED) return "running";
  if (speed <= CONFIG.CYCLING_MAX_SPEED) return "cycling";
  return "driving";
};

// ======================================================
// PRIVATE HELPERS
// ======================================================

const getSmoothedSpeed = (): number => {
  if (history.length < 2) return 0;
  
  const recentSpeeds: number[] = [];
  const startIdx = Math.max(0, history.length - CONFIG.SMOOTHING_WINDOW);
  
  for (let i = startIdx + 1; i < history.length; i++) {
    const speed = calculateSpeed(history[i - 1], history[i]);
    if (speed > 0 && speed < CONFIG.MAX_PLAUSIBLE_SPEED) {
      recentSpeeds.push(speed);
    }
  }
  
  if (recentSpeeds.length === 0) return 0;
  
  // Median smoothing (more robust than average)
  recentSpeeds.sort((a, b) => a - b);
  const mid = Math.floor(recentSpeeds.length / 2);
  return recentSpeeds.length % 2 === 0 
    ? (recentSpeeds[mid - 1] + recentSpeeds[mid]) / 2
    : recentSpeeds[mid];
};

const updateState = (loc: Location) => {
  history.push(loc);
  if (history.length > CONFIG.SMOOTHING_WINDOW) {
    history.shift();
  }
};

const isAccurate = (loc: Location): boolean => {
  const accuracy = loc.accuracy ?? 999;
  return accuracy <= CONFIG.MAX_ACCURACY_METERS;
};

const calculateConfidence = (loc: Location): number => {
  const accuracy = loc.accuracy ?? 100;
  
  if (accuracy <= CONFIG.EXCELLENT_ACCURACY) return 0.98;
  if (accuracy <= CONFIG.GOOD_ACCURACY) return 0.9;
  if (accuracy <= CONFIG.FAIR_ACCURACY) return 0.75;
  if (accuracy <= CONFIG.MAX_ACCURACY_METERS) return 0.6;
  return 0.4;
};

const formatLocation = (position: GeolocationPosition): Location => ({
  lat: position.coords.latitude,
  lng: position.coords.longitude,
  accuracy: position.coords.accuracy ?? 100,
  speed: position.coords.speed !== null && position.coords.speed !== undefined 
    ? position.coords.speed * 3.6 
    : 0,
  heading: position.coords.heading ?? undefined,
  altitude: position.coords.altitude ?? undefined,
  timestamp: position.timestamp
});

const parseError = (error: GeolocationPositionError): string => {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission denied. Please enable in settings.";
    case error.POSITION_UNAVAILABLE:
      return "Location unavailable. Check GPS signal.";
    case error.TIMEOUT:
      return "Location request timed out. Please try again.";
    default:
      return "Unknown location error";
  }
};

const deg2rad = (deg: number): number => deg * (Math.PI / 180);

// ======================================================
// INITIALIZATION
// ======================================================

loadQueue();
flushLocationQueue(); // Initial flush if online

console.log("📍 Location service initialized");