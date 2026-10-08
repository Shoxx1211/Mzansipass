// src/services/backgroundTracker.ts
// Pulse Transit - Resilient Trip Tracking Service
//
// Design goals:
// - Ask for location only when the user starts/resumes a trip
// - Work on Capacitor native builds and the web/PWA
// - Preserve an active trip when the watcher is restarted
// - Avoid counting GPS drift and implausible jumps as distance
// - Recover cleanly after long foreground/background gaps
// - Keep offline points until a real sync handler confirms upload
// - Minimise unnecessary localStorage writes
// - Never silently claim that Base64 obfuscation is secure encryption

import { App } from "@capacitor/app";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import type {
  BackgroundGeolocationPlugin,
  Location as BackgroundGeolocationPosition,
} from "@capacitor-community/background-geolocation";

const BackgroundGeolocation =
  registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

type CapacitorPosition = Awaited<
  ReturnType<typeof Geolocation.getCurrentPosition>
>;

// ======================================================
// TYPES
// ======================================================

export interface TrackerLocation {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number;
  heading: number;
  altitude: number;
  timestamp: number;
  isBackground?: boolean;
  batteryImpact?: number;

  /**
   * Raw device-reported speed in km/h when available.
   * `speed` is the final validated speed used by Pulse.
   */
  reportedSpeed?: number;
}

export interface ActiveTripSession {
  active: boolean;
  startedAt: number;
  lastUpdate: number;
  totalDistance: number; // metres
  currentSpeed: number; // km/h
  averageSpeed: number; // km/h
  maxSpeed: number; // km/h
  duration: number; // milliseconds
  points: TrackerLocation[];
  batteryHistory?: number[];
  backgroundDuration?: number; // milliseconds
  foregroundDuration?: number; // milliseconds
  startedBatteryLevel?: number;
  endingBatteryLevel?: number;
}

export interface TrackingConfig {
  highAccuracy: boolean;
  updateInterval: number;
  distanceFilter: number;
  batteryOptimized: boolean;
  backgroundEnabled: boolean;
  maxPoints: number;

  /**
   * Backwards-compatible legacy setting.
   * This only obfuscates persisted JSON with Base64.
   * It is NOT cryptographic encryption.
   */
  enableEncryption: boolean;
}

export type TrackerErrorCode =
  | "PERMISSION_DENIED"
  | "POSITION_UNAVAILABLE"
  | "TIMEOUT"
  | "NOT_SUPPORTED"
  | "WATCH_FAILED"
  | "UNKNOWN";

export class BackgroundTrackerError extends Error {
  readonly code: TrackerErrorCode;
  override readonly cause?: unknown;

  constructor(
    code: TrackerErrorCode,
    message: string,
    cause?: unknown
  ) {
    super(message);

    this.name = "BackgroundTrackerError";
    this.code = code;
    this.cause = cause;

    Object.setPrototypeOf(
      this,
      BackgroundTrackerError.prototype
    );
  }
}

export type OfflineSyncHandler = (
  points: readonly TrackerLocation[]
) => Promise<void>;

type LocationSubscriber = (
  location: TrackerLocation,
  trip: ActiveTripSession
) => void;

type TripSubscriber = (trip: ActiveTripSession) => void;

// ======================================================
// CONSTANTS
// ======================================================

const STORAGE = {
  activeTrip: "pulse_active_trip_v2",
  lastLocation: "pulse_last_location_v2",
  trackingState: "pulse_tracking_state_v2",
  trackingConfig: "pulse_tracking_config",
  offlineQueue: "pulse_offline_queue",
} as const;

const DEFAULT_CONFIG: TrackingConfig = {
  highAccuracy: true,
  updateInterval: 3000,
  distanceFilter: 5,
  batteryOptimized: false,
  backgroundEnabled: true,
  maxPoints: 1000,
  enableEncryption: false,
};

const BATTERY_OPTIMIZED_CONFIG: TrackingConfig = {
  highAccuracy: false,
  updateInterval: 10000,
  distanceFilter: 20,
  batteryOptimized: true,
  backgroundEnabled: true,
  maxPoints: 500,
  enableEncryption: false,
};

const GPS_FILTERS = {
  minDistanceMeters: 5,
  maxPlausibleSpeedKmh: 180,
  maxAccuracyMeters: 150,
  reanchorGapSeconds: 180,
  staleWatcherMs: 30000,
} as const;

const BATTERY = {
  lowThreshold: 15,
  recoveredThreshold: 30,
  pollIntervalMs: 60000,
} as const;

const STORAGE_LIMITS = {
  maxOfflinePoints: 2000,
  maxBatterySamples: 200,
} as const;

const HEARTBEAT_INTERVAL_MS = 1000;
const HEARTBEAT_PERSIST_INTERVAL_MS = 5000;
const INITIAL_LOCATION_TIMEOUT_MS = 15000;

// ======================================================
// SAFE STORAGE HELPERS
// ======================================================

const storageAvailable = (): boolean => {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
};

const safeGetItem = (key: string): string | null => {
  if (!storageAvailable()) return null;

  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`Storage read failed for ${key}:`, error);
    return null;
  }
};

const safeSetItem = (key: string, value: string): void => {
  if (!storageAvailable()) return;

  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Storage write failed for ${key}:`, error);
  }
};

const safeRemoveItem = (key: string): void => {
  if (!storageAvailable()) return;

  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Storage remove failed for ${key}:`, error);
  }
};

// ======================================================
// LEGACY STORAGE OBFUSCATION
// ======================================================

/**
 * Base64 is NOT encryption. This helper exists only to remain compatible
 * with the existing `enableEncryption` configuration option.
 */
const encodeStoragePayload = (data: unknown): string => {
  const json = JSON.stringify(data);

  try {
    return `b64:${btoa(encodeURIComponent(json))}`;
  } catch (error) {
    console.warn("Storage obfuscation failed; using JSON instead:", error);
    return json;
  }
};

const decodeStoragePayload = <T>(raw: string): T | null => {
  try {
    if (raw.startsWith("b64:")) {
      const decoded = decodeURIComponent(atob(raw.slice(4)));
      return JSON.parse(decoded) as T;
    }

    // Normal JSON from the default production-safe path.
    if (raw.trim().startsWith("{") || raw.trim().startsWith("[")) {
      return JSON.parse(raw) as T;
    }

    // Migration support for the old Base64-without-prefix format.
    const legacyDecoded = decodeURIComponent(atob(raw));
    return JSON.parse(legacyDecoded) as T;
  } catch {
    return null;
  }
};

// ======================================================
// GENERAL HELPERS
// ======================================================

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const finiteOr = (value: number | null | undefined, fallback: number): number => {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};

const now = (): number => Date.now();

const haversineDistanceMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const earthRadiusMeters = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) *
      Math.cos(φ2) *
      Math.sin(Δλ / 2) *
      Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
};

const isValidCoordinate = (latitude: number, longitude: number): boolean => {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
};

const normalizeConfig = (value: Partial<TrackingConfig>): TrackingConfig => {
  return {
    highAccuracy: value.highAccuracy ?? DEFAULT_CONFIG.highAccuracy,
    updateInterval: clamp(
      finiteOr(value.updateInterval, DEFAULT_CONFIG.updateInterval),
      1000,
      60000
    ),
    distanceFilter: clamp(
      finiteOr(value.distanceFilter, DEFAULT_CONFIG.distanceFilter),
      1,
      500
    ),
    batteryOptimized: value.batteryOptimized ?? DEFAULT_CONFIG.batteryOptimized,
    backgroundEnabled: value.backgroundEnabled ?? DEFAULT_CONFIG.backgroundEnabled,
    maxPoints: Math.round(
      clamp(finiteOr(value.maxPoints, DEFAULT_CONFIG.maxPoints), 50, 10000)
    ),
    enableEncryption: value.enableEncryption ?? DEFAULT_CONFIG.enableEncryption,
  };
};

const mapTrackerError = (error: unknown): BackgroundTrackerError => {
  if (error instanceof BackgroundTrackerError) return error;

  const source = error as {
    code?: string | number;
    message?: string;
  };

  const message = String(source?.message ?? error ?? "Unknown location error").toLowerCase();
  const code = String(source?.code ?? "").toLowerCase();

  if (
    code === "1" ||
    code === "not_authorized" ||
    code.includes("permission") ||
    message.includes("permission") ||
    message.includes("denied")
  ) {
    return new BackgroundTrackerError(
      "PERMISSION_DENIED",
      "Pulse needs location permission to track your trip. Please allow location access and try again.",
      error
    );
  }

  if (
    code === "2" ||
    message.includes("unavailable") ||
    message.includes("location services") ||
    message.includes("gps")
  ) {
    return new BackgroundTrackerError(
      "POSITION_UNAVAILABLE",
      "Your location is unavailable. Please make sure Location/GPS is turned on and try again.",
      error
    );
  }

  if (code === "3" || message.includes("timeout") || message.includes("timed out")) {
    return new BackgroundTrackerError(
      "TIMEOUT",
      "Pulse could not get your location in time. Make sure Location/GPS is turned on and try again.",
      error
    );
  }

  return new BackgroundTrackerError(
    "UNKNOWN",
    "Pulse could not determine your location. Please try again.",
    error
  );
};

// ======================================================
// MAIN SERVICE
// ======================================================

class BackgroundTrackerService {
  private watchId: string | null = null;
  private watchKind: "native-background" | "capacitor" | null = null;
  private subscribers = new Set<LocationSubscriber>();
  private tripSubscribers = new Set<TripSubscriber>();

  private isTracking = false;
  private currentTrip: ActiveTripSession | null = null;
  private lastRawLocation: TrackerLocation | null = null;

  private heartbeatInterval: number | null = null;
  private batteryInterval: number | null = null;

  private config: TrackingConfig = { ...DEFAULT_CONFIG };
  private offlineQueue: TrackerLocation[] = [];
  private offlineSyncHandler: OfflineSyncHandler | null = null;

  private lastBatteryLevel = 100;
  private runtimeBatterySaver = false;

  private isInBackground = false;
  private appStateChangedAt = now();

  private startPromise: Promise<void> | null = null;
  private restartPromise: Promise<void> | null = null;

  private lastHeartbeatPersistAt = 0;

  constructor() {
    this.loadConfig();
    this.loadOfflineQueue();
    this.setupAppStateListeners();
    this.setupNetworkListeners();
  }

  // ====================================================
  // CONFIGURATION
  // ====================================================

  private loadConfig(): void {
    const saved = safeGetItem(STORAGE.trackingConfig);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as Partial<TrackingConfig>;
      this.config = normalizeConfig(parsed);
    } catch (error) {
      console.warn("Failed to load tracking config. Using defaults:", error);
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  setConfig(config: Partial<TrackingConfig>): void {
    this.config = normalizeConfig({ ...this.config, ...config });
    safeSetItem(STORAGE.trackingConfig, JSON.stringify(this.config));

    if (this.isTracking) {
      void this.restartWatcher().catch((error) => {
        console.error("Could not apply updated tracking configuration:", error);
      });
    }
  }

  setBatteryOptimized(enabled: boolean): void {
    this.setConfig({ batteryOptimized: enabled });
  }

  getConfig(): TrackingConfig {
    return { ...this.config };
  }

  // ====================================================
  // PLATFORM / CAPABILITY
  // ====================================================

  get native(): boolean {
    return Capacitor.isNativePlatform();
  }

  get tracking(): boolean {
    return this.isTracking;
  }

  /**
   * Native Pulse builds use @capacitor-community/background-geolocation
   * for active journeys. Android keeps a foreground location service alive
   * while the screen is locked or the commuter uses another app.
   *
   * Browser/PWA builds still fall back to the normal Capacitor/web watcher,
   * because browsers cannot guarantee GPS callbacks after suspension.
   */
  get guaranteedBackgroundTracking(): boolean {
    return Capacitor.isNativePlatform() && this.config.backgroundEnabled;
  }

  // ====================================================
  // APP STATE
  // ====================================================

  private setupAppStateListeners(): void {
    if (!Capacitor.isNativePlatform()) return;

    void App.addListener("appStateChange", ({ isActive }) => {
      const timestamp = now();
      this.commitAppStateDuration(timestamp);

      this.isInBackground = !isActive;
      this.appStateChangedAt = timestamp;

      if (isActive) {
        console.log("📱 Pulse returned to foreground");

        if (
          this.isTracking &&
          this.currentTrip?.active &&
          timestamp - this.currentTrip.lastUpdate > GPS_FILTERS.staleWatcherMs
        ) {
          void this.restartWatcher().catch((error) => {
            console.error("Could not refresh stale location watcher:", error);
          });
        }
      } else {
        console.log("📱 Pulse moved to background");
      }
    });
  }

  private commitAppStateDuration(timestamp = now()): void {
    if (!this.currentTrip?.active) {
      this.appStateChangedAt = timestamp;
      return;
    }

    const elapsed = Math.max(0, timestamp - this.appStateChangedAt);

    if (this.isInBackground) {
      this.currentTrip.backgroundDuration =
        (this.currentTrip.backgroundDuration ?? 0) + elapsed;
    } else {
      this.currentTrip.foregroundDuration =
        (this.currentTrip.foregroundDuration ?? 0) + elapsed;
    }

    this.appStateChangedAt = timestamp;
  }

  private getLiveStateDurations(): {
    backgroundDuration: number;
    foregroundDuration: number;
  } {
    const background = this.currentTrip?.backgroundDuration ?? 0;
    const foreground = this.currentTrip?.foregroundDuration ?? 0;

    if (!this.currentTrip?.active) {
      return {
        backgroundDuration: background,
        foregroundDuration: foreground,
      };
    }

    const elapsed = Math.max(0, now() - this.appStateChangedAt);

    return this.isInBackground
      ? {
          backgroundDuration: background + elapsed,
          foregroundDuration: foreground,
        }
      : {
          backgroundDuration: background,
          foregroundDuration: foreground + elapsed,
        };
  }

  // ====================================================
  // NETWORK / OFFLINE QUEUE
  // ====================================================

  private setupNetworkListeners(): void {
    if (typeof window === "undefined") return;

    window.addEventListener("online", () => {
      void this.flushOfflineQueue();
    });
  }

  setOfflineSyncHandler(handler: OfflineSyncHandler | null): void {
    this.offlineSyncHandler = handler;

    if (handler && typeof navigator !== "undefined" && navigator.onLine) {
      void this.flushOfflineQueue();
    }
  }

  private loadOfflineQueue(): void {
    const saved = safeGetItem(STORAGE.offlineQueue);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as TrackerLocation[];
      this.offlineQueue = Array.isArray(parsed) ? parsed.slice(-STORAGE_LIMITS.maxOfflinePoints) : [];
    } catch (error) {
      console.warn("Failed to load offline location queue:", error);
      this.offlineQueue = [];
    }
  }

  private saveOfflineQueue(): void {
    safeSetItem(STORAGE.offlineQueue, JSON.stringify(this.offlineQueue));
  }

  private queueOfflineLocation(location: TrackerLocation): void {
    this.offlineQueue.push(location);

    if (this.offlineQueue.length > STORAGE_LIMITS.maxOfflinePoints) {
      this.offlineQueue.splice(
        0,
        this.offlineQueue.length - STORAGE_LIMITS.maxOfflinePoints
      );
    }

    this.saveOfflineQueue();
  }

  private async flushOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    // Do NOT delete unsynced points until a real backend handler confirms success.
    if (!this.offlineSyncHandler) {
      console.log(
        `📡 ${this.offlineQueue.length} offline location points are waiting for a sync handler.`
      );
      return;
    }

    const snapshot = [...this.offlineQueue];

    try {
      await this.offlineSyncHandler(snapshot);
      this.offlineQueue.splice(0, snapshot.length);
      this.saveOfflineQueue();
      console.log(`✅ Synced ${snapshot.length} queued location points`);
    } catch (error) {
      console.warn("Offline location sync failed. Queue retained:", error);
    }
  }

  // ====================================================
  // PERMISSIONS / INITIAL FIX
  // ====================================================

  private async ensureLocationPermission(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      // On web/PWA, getCurrentPosition/watchPosition triggers the browser prompt.
      return;
    }

    try {
      let permissions = await Geolocation.checkPermissions();

      if (
        permissions.location !== "granted" &&
        permissions.coarseLocation !== "granted"
      ) {
        permissions = await Geolocation.requestPermissions();
      }

      if (
        permissions.location !== "granted" &&
        permissions.coarseLocation !== "granted"
      ) {
        throw new BackgroundTrackerError(
          "PERMISSION_DENIED",
          "Pulse needs location permission to track your trip. Please allow location access and try again."
        );
      }
    } catch (error) {
      throw mapTrackerError(error);
    }
  }

  private getActiveConfig(): TrackingConfig {
    if (this.config.batteryOptimized || this.runtimeBatterySaver) {
      return {
        ...BATTERY_OPTIMIZED_CONFIG,
        backgroundEnabled: this.config.backgroundEnabled,
        maxPoints: this.config.maxPoints,
        enableEncryption: this.config.enableEncryption,
      };
    }

    return { ...this.config };
  }

  private async getInitialPosition(): Promise<TrackerLocation> {
    const activeConfig = this.getActiveConfig();

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: activeConfig.highAccuracy,
        timeout: INITIAL_LOCATION_TIMEOUT_MS,
        maximumAge: 0,
      });

      return this.formatPosition(position);
    } catch (error) {
      throw mapTrackerError(error);
    }
  }

  // ====================================================
  // START / RESUME / STOP
  // ====================================================

  async start(): Promise<void> {
    if (this.isTracking) {
      console.log("⚠️ Pulse tracker is already running");
      return;
    }

    if (this.startPromise) return this.startPromise;

    this.startPromise = this.startInternal().finally(() => {
      this.startPromise = null;
    });

    return this.startPromise;
  }

  /**
   * Start a trip immediately from a recent planner location.
   *
   * Browser/PWA devices can take a long time to produce a second
   * high-accuracy getCurrentPosition() reading even when Pulse already has a
   * usable fix. The continuous watcher will refine the seed as better GPS
   * readings arrive.
   */
  async startWithSeed(
    seed: TrackerLocation
  ): Promise<void> {
    if (this.isTracking) {
      console.log("⚠️ Pulse tracker is already running");
      return;
    }

    if (this.startPromise) return this.startPromise;

    this.startPromise = this
      .startWithSeedInternal(seed)
      .finally(() => {
        this.startPromise = null;
      });

    return this.startPromise;
  }

  private async startWithSeedInternal(
    seed: TrackerLocation
  ): Promise<void> {
    if (this.currentTrip?.active) {
      await this.resumeInternal();
      return;
    }

    const seedAgeMs =
      Math.max(
        0,
        now() - seed.timestamp
      );

    const seedIsUsable =
      isValidCoordinate(
        seed.lat,
        seed.lng
      ) &&
      Number.isFinite(
        seed.accuracy
      ) &&
      seed.accuracy >= 0 &&
      seed.accuracy <= 1500 &&
      seedAgeMs <= 2 * 60 * 1000;

    if (!seedIsUsable) {
      await this.startInternal();
      return;
    }

    console.log(
      "🚀 Starting Pulse trip tracker from planner location..."
    );

    await this.ensureLocationPermission();

    const initialLocation: TrackerLocation = {
      ...seed,
      speed: 0,
      reportedSpeed:
        seed.reportedSpeed,
      heading:
        finiteOr(seed.heading, 0),
      altitude:
        finiteOr(seed.altitude, 0),
      timestamp:
        seed.timestamp || now(),
      isBackground:
        this.isInBackground,
      batteryImpact:
        this.lastBatteryLevel,
    };

    this.initializeNewTrip(
      initialLocation
    );
    this.lastRawLocation =
      initialLocation;

    try {
      await this.startWatching();
      this.isTracking = true;
      safeSetItem(
        STORAGE.trackingState,
        "true"
      );
      this.startHeartbeat();
      this.startBatteryMonitoring();
      this.notifyLocation(
        initialLocation
      );

      console.log(
        "✅ Pulse trip tracker active from planner seed"
      );
    } catch (error) {
      this.isTracking = false;
      safeRemoveItem(
        STORAGE.trackingState
      );

      if (this.currentTrip) {
        this.currentTrip.active =
          false;
        this.persistTrip();
      }

      throw mapTrackerError(error);
    }
  }

  private async startInternal(): Promise<void> {
    // If an active trip was restored, resume it instead of silently replacing it.
    if (this.currentTrip?.active) {
      await this.resumeInternal();
      return;
    }

    console.log("🚀 Starting Pulse trip tracker...");

    await this.ensureLocationPermission();
    const initialLocation = await this.getInitialPosition();

    this.initializeNewTrip(initialLocation);
    this.lastRawLocation = initialLocation;

    try {
      await this.startWatching();
      this.isTracking = true;
      safeSetItem(STORAGE.trackingState, "true");
      this.startHeartbeat();
      this.startBatteryMonitoring();
      this.notifyLocation(initialLocation);

      console.log("✅ Pulse trip tracker active");
    } catch (error) {
      // Roll back a trip that never successfully started.
      this.isTracking = false;
      safeRemoveItem(STORAGE.trackingState);

      if (this.currentTrip) {
        this.currentTrip.active = false;
        this.persistTrip();
      }

      throw mapTrackerError(error);
    }
  }

  /**
   * Explicitly starts a fresh trip, discarding any restored-but-not-running trip.
   */
  async startNewTrip(): Promise<void> {
    if (this.isTracking) {
      await this.stop();
    }

    this.currentTrip = null;
    this.lastRawLocation = null;
    safeRemoveItem(STORAGE.activeTrip);
    await this.start();
  }

  async resume(): Promise<void> {
    if (this.isTracking) return;

    if (!this.currentTrip?.active) {
      await this.start();
      return;
    }

    if (this.startPromise) return this.startPromise;

    this.startPromise = this.resumeInternal().finally(() => {
      this.startPromise = null;
    });

    return this.startPromise;
  }

  private async resumeInternal(): Promise<void> {
    if (!this.currentTrip?.active) {
      throw new BackgroundTrackerError(
        "UNKNOWN",
        "There is no active Pulse trip to resume."
      );
    }

    console.log("♻️ Resuming Pulse trip...");

    await this.ensureLocationPermission();
    const currentLocation = await this.getInitialPosition();

    // Re-anchor after an app restart. Do not count the gap as travelled distance.
    this.lastRawLocation = currentLocation;
    this.currentTrip.lastUpdate = now();
    this.currentTrip.currentSpeed = 0;
    this.persistTrip();

    await this.startWatching();
    this.isTracking = true;
    safeSetItem(STORAGE.trackingState, "true");
    this.startHeartbeat();
    this.startBatteryMonitoring();
    this.notifyLocation(currentLocation);

    console.log("✅ Pulse trip resumed");
  }

  async stop(): Promise<void> {
    console.log("🛑 Stopping Pulse trip tracker...");

    this.commitAppStateDuration();

    await this.clearWatcher();
    this.stopHeartbeat();
    this.stopBatteryMonitoring();

    this.isTracking = false;
    safeRemoveItem(STORAGE.trackingState);

    if (this.currentTrip) {
      this.currentTrip.active = false;
      this.currentTrip.currentSpeed = 0;
      this.currentTrip.duration = Math.max(0, now() - this.currentTrip.startedAt);
      this.currentTrip.lastUpdate = now();
      this.currentTrip.endingBatteryLevel = this.lastBatteryLevel;
      this.persistTrip();
      this.notifyTrip();
    }

    this.lastRawLocation = null;

    console.log("✅ Pulse trip tracker stopped");
  }

  /**
   * Restarts only the location watcher. The current trip, distance and start
   * time are preserved. This fixes the old stop()+start() behaviour that
   * unintentionally created a new trip during configuration/app-state changes.
   */
  async restart(): Promise<void> {
    if (!this.currentTrip?.active) {
      await this.start();
      return;
    }

    await this.restartWatcher();
  }

  private async restartWatcher(): Promise<void> {
    if (!this.currentTrip?.active) return;

    if (this.restartPromise) return this.restartPromise;

    this.restartPromise = (async () => {
      await this.clearWatcher();
      await this.startWatching();
      console.log("🔄 Pulse location watcher restarted without resetting the trip");
    })().finally(() => {
      this.restartPromise = null;
    });

    return this.restartPromise;
  }

  // ====================================================
  // WATCHER
  // ====================================================

  private async startWatching(): Promise<void> {
    const activeConfig = this.getActiveConfig();

    try {
      if (Capacitor.isNativePlatform() && activeConfig.backgroundEnabled) {
        const id = await BackgroundGeolocation.addWatcher(
          {
            backgroundTitle: "Pulse journey in progress",
            backgroundMessage:
              "Pulse is tracking your journey in the background. End the journey in Pulse to stop tracking.",
            requestPermissions: true,
            stale: false,
            distanceFilter: Math.max(
              GPS_FILTERS.minDistanceMeters,
              Math.round(activeConfig.distanceFilter)
            ),
          },
          (position, error) => {
            if (error) {
              const mapped = mapTrackerError(error);
              console.error(
                "❌ Pulse background GPS error:",
                mapped.code,
                mapped.message
              );
              return;
            }

            if (!position || !this.currentTrip?.active) return;

            try {
              const location = this.formatBackgroundPosition(position);
              this.processLocation(location);
            } catch (processingError) {
              console.warn(
                "Ignored invalid background GPS reading:",
                processingError
              );
            }
          }
        );

        this.watchId = id;
        this.watchKind = "native-background";
        return;
      }

      const id = await Geolocation.watchPosition(
        {
          enableHighAccuracy: activeConfig.highAccuracy,
          timeout: 15000,
          maximumAge: 0,
          minimumUpdateInterval: activeConfig.updateInterval,
        },
        (position, error) => {
          if (error) {
            const mapped = mapTrackerError(error);
            console.error("❌ Pulse GPS watch error:", mapped.code, mapped.message);
            return;
          }

          if (!position || !this.currentTrip?.active) return;

          try {
            const location = this.formatPosition(position);
            this.processLocation(location);
          } catch (processingError) {
            console.warn("Ignored invalid GPS reading:", processingError);
          }
        }
      );

      this.watchId = id;
      this.watchKind = "capacitor";
    } catch (error) {
      this.watchId = null;
      this.watchKind = null;

      throw new BackgroundTrackerError(
        "WATCH_FAILED",
        "Pulse could not start continuous location tracking.",
        error
      );
    }
  }

  private async clearWatcher(): Promise<void> {
    const id = this.watchId;
    const kind = this.watchKind;
    this.watchId = null;
    this.watchKind = null;

    if (!id) return;

    try {
      if (kind === "native-background") {
        await BackgroundGeolocation.removeWatcher({ id });
      } else {
        await Geolocation.clearWatch({ id });
      }
    } catch (error) {
      console.warn("Could not clear location watcher cleanly:", error);
    }
  }

  // ====================================================
  // POSITION FORMATTING
  // ====================================================

  private formatBackgroundPosition(
    position: BackgroundGeolocationPosition
  ): TrackerLocation {
    const latitude = position.latitude;
    const longitude = position.longitude;

    if (!isValidCoordinate(latitude, longitude)) {
      throw new BackgroundTrackerError(
        "POSITION_UNAVAILABLE",
        "Pulse received an invalid background location reading."
      );
    }

    const reportedSpeed =
      position.speed !== null &&
      position.speed !== undefined &&
      Number.isFinite(position.speed)
        ? Math.max(0, position.speed * 3.6)
        : undefined;

    return {
      lat: latitude,
      lng: longitude,
      accuracy: Math.max(0, finiteOr(position.accuracy, 999)),
      speed: reportedSpeed ?? 0,
      reportedSpeed,
      heading: finiteOr(position.bearing, 0),
      altitude: finiteOr(position.altitude, 0),
      timestamp: finiteOr(position.time, now()),
      isBackground: this.isInBackground,
      batteryImpact: this.lastBatteryLevel,
    };
  }

  private formatPosition(position: CapacitorPosition): TrackerLocation {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;

    if (!isValidCoordinate(latitude, longitude)) {
      throw new BackgroundTrackerError(
        "POSITION_UNAVAILABLE",
        "Pulse received an invalid location reading."
      );
    }

    const reportedSpeed =
      position.coords.speed !== null &&
      position.coords.speed !== undefined &&
      Number.isFinite(position.coords.speed)
        ? Math.max(0, position.coords.speed * 3.6)
        : undefined;

    return {
      lat: latitude,
      lng: longitude,
      accuracy: Math.max(0, finiteOr(position.coords.accuracy, 999)),
      speed: reportedSpeed ?? 0,
      reportedSpeed,
      heading: finiteOr(position.coords.heading, 0),
      altitude: finiteOr(position.coords.altitude, 0),
      timestamp: finiteOr(position.timestamp, now()),
      isBackground: this.isInBackground,
      batteryImpact: this.lastBatteryLevel,
    };
  }

  // ====================================================
  // LOCATION PROCESSING
  // ====================================================

  private processLocation(location: TrackerLocation): void {
    if (!this.currentTrip?.active) return;

    const previous = this.lastRawLocation;

    if (!previous) {
      this.lastRawLocation = location;
      this.acceptAnchorPoint(location, true);
      return;
    }

    // A planner seed may be intentionally approximate (for example a browser
    // location around +/-500 m). When the watcher produces a materially better
    // point, re-anchor without counting the correction as travelled distance.
    if (
      previous.accuracy >
        GPS_FILTERS.maxAccuracyMeters &&
      location.accuracy <
        previous.accuracy
    ) {
      this.lastRawLocation = location;
      this.acceptAnchorPoint(location, true);
      return;
    }

    const timeSeconds = (location.timestamp - previous.timestamp) / 1000;

    if (!Number.isFinite(timeSeconds) || timeSeconds <= 0) {
      return;
    }

    // After a long suspension/gap, re-anchor without inventing distance.
    if (timeSeconds > GPS_FILTERS.reanchorGapSeconds) {
      console.log(`📍 Re-anchoring after ${Math.round(timeSeconds)}s location gap`);
      this.lastRawLocation = location;
      this.acceptAnchorPoint(location, true);
      return;
    }

    const distanceMeters = haversineDistanceMeters(
      previous.lat,
      previous.lng,
      location.lat,
      location.lng
    );

    if (!Number.isFinite(distanceMeters)) return;

    const configuredMinDistance = Math.max(
      GPS_FILTERS.minDistanceMeters,
      this.getActiveConfig().distanceFilter
    );

    const calculatedSpeedKmh = (distanceMeters / timeSeconds) * 3.6;

    // Adaptive drift protection: poor-accuracy points need stronger evidence of
    // real movement before Pulse adds them to distance.
    const accuracyRadius = Math.max(previous.accuracy, location.accuracy);
    const adaptiveDriftThreshold = Math.min(
      Math.max(configuredMinDistance, accuracyRadius * 0.35),
      50
    );

    if (distanceMeters < adaptiveDriftThreshold) {
      this.lastRawLocation = location;
      this.acceptStationaryUpdate(location);
      return;
    }

    // Reject impossible jumps by speed rather than a fixed 500m cutoff. A real
    // bus/train can legitimately move more than 500m between delayed readings.
    if (
      !Number.isFinite(calculatedSpeedKmh) ||
      calculatedSpeedKmh > GPS_FILTERS.maxPlausibleSpeedKmh
    ) {
      console.warn("⚠️ Ignoring implausible GPS jump", {
        distanceMeters: Math.round(distanceMeters),
        timeSeconds: Math.round(timeSeconds),
        impliedSpeedKmh: calculatedSpeedKmh.toFixed(1),
      });
      return;
    }

    // Very poor accuracy can create fake movement. If the point is poor and the
    // movement is not much larger than its own uncertainty, do not count it.
    if (
      location.accuracy > GPS_FILTERS.maxAccuracyMeters &&
      distanceMeters < location.accuracy
    ) {
      this.acceptStationaryUpdate(location);
      return;
    }

    const reportedSpeed = location.reportedSpeed;
    const validatedReportedSpeed =
      reportedSpeed !== undefined &&
      Number.isFinite(reportedSpeed) &&
      reportedSpeed >= 0 &&
      reportedSpeed <= GPS_FILTERS.maxPlausibleSpeedKmh
        ? reportedSpeed
        : null;

    // Device GPS speed is generally useful when available. Fall back to the
    // distance/time calculation when it is unavailable.
    const finalSpeedKmh = validatedReportedSpeed ?? calculatedSpeedKmh;

    this.lastRawLocation = location;
    this.currentTrip.totalDistance += distanceMeters;
    this.currentTrip.currentSpeed = finalSpeedKmh;
    this.currentTrip.maxSpeed = Math.max(
      this.currentTrip.maxSpeed,
      finalSpeedKmh
    );
    this.currentTrip.lastUpdate = now();
    this.currentTrip.duration = Math.max(
      0,
      this.currentTrip.lastUpdate - this.currentTrip.startedAt
    );

    const durationHours = this.currentTrip.duration / 3600000;
    this.currentTrip.averageSpeed =
      durationHours > 0
        ? this.currentTrip.totalDistance / 1000 / durationHours
        : 0;

    const processedPoint: TrackerLocation = {
      ...location,
      speed: finalSpeedKmh,
    };

    this.pushTripPoint(processedPoint);
    this.recordBatterySample(location.batteryImpact);
    this.persistTrip();
    safeSetItem(STORAGE.lastLocation, JSON.stringify(processedPoint));

    this.notifyLocation(processedPoint);
    this.notifyTrip();
    this.handleConnectivity(processedPoint);

    if (import.meta.env.DEV) {
      console.log("📍 PULSE TRACK", {
        distance: `${(this.currentTrip.totalDistance / 1000).toFixed(2)} km`,
        speed: `${finalSpeedKmh.toFixed(1)} km/h`,
        accuracy: `${Math.round(location.accuracy)} m`,
        battery: `${Math.round(this.lastBatteryLevel)}%`,
      });
    }
  }

  private acceptAnchorPoint(location: TrackerLocation, notify: boolean): void {
    if (!this.currentTrip) return;

    const point: TrackerLocation = {
      ...location,
      speed: 0,
    };

    this.currentTrip.currentSpeed = 0;
    this.currentTrip.lastUpdate = now();
    this.currentTrip.duration = Math.max(
      0,
      this.currentTrip.lastUpdate - this.currentTrip.startedAt
    );

    this.pushTripPoint(point);
    this.recordBatterySample(location.batteryImpact);
    this.persistTrip();
    safeSetItem(STORAGE.lastLocation, JSON.stringify(point));

    if (notify) {
      this.notifyLocation(point);
      this.notifyTrip();
    }

    this.handleConnectivity(point);
  }

  private acceptStationaryUpdate(location: TrackerLocation): void {
    if (!this.currentTrip) return;

    const point: TrackerLocation = {
      ...location,
      speed: 0,
    };

    this.currentTrip.currentSpeed = 0;
    this.currentTrip.lastUpdate = now();
    this.currentTrip.duration = Math.max(
      0,
      this.currentTrip.lastUpdate - this.currentTrip.startedAt
    );

    safeSetItem(STORAGE.lastLocation, JSON.stringify(point));
    this.notifyLocation(point);
    this.notifyTrip();
    this.handleConnectivity(point);
  }

  private pushTripPoint(point: TrackerLocation): void {
    if (!this.currentTrip) return;

    this.currentTrip.points.push(point);

    const maxPoints = this.getActiveConfig().maxPoints;
    if (this.currentTrip.points.length > maxPoints) {
      this.currentTrip.points.splice(
        0,
        this.currentTrip.points.length - maxPoints
      );
    }
  }

  private handleConnectivity(location: TrackerLocation): void {
    if (typeof navigator === "undefined") return;

    if (!navigator.onLine) {
      this.queueOfflineLocation(location);
      return;
    }

    if (this.offlineQueue.length > 0) {
      void this.flushOfflineQueue();
    }
  }

  // ====================================================
  // BATTERY
  // ====================================================

  private startBatteryMonitoring(): void {
    this.stopBatteryMonitoring();

    void this.sampleBattery();

    if (typeof window === "undefined") return;

    this.batteryInterval = window.setInterval(() => {
      void this.sampleBattery();
    }, BATTERY.pollIntervalMs);
  }

  private async sampleBattery(): Promise<void> {
    if (typeof navigator === "undefined") return;

    const batteryNavigator = navigator as Navigator & {
      getBattery?: () => Promise<{ level: number }>;
    };

    if (!batteryNavigator.getBattery) return;

    try {
      const battery = await batteryNavigator.getBattery();
      this.lastBatteryLevel = clamp(battery.level * 100, 0, 100);

      if (
        this.lastBatteryLevel < BATTERY.lowThreshold &&
        !this.config.batteryOptimized &&
        !this.runtimeBatterySaver
      ) {
        this.runtimeBatterySaver = true;
        console.log("🔋 Low battery: Pulse temporarily enabled battery-saving GPS mode");

        if (this.isTracking) {
          void this.restartWatcher();
        }
      } else if (
        this.lastBatteryLevel > BATTERY.recoveredThreshold &&
        this.runtimeBatterySaver
      ) {
        this.runtimeBatterySaver = false;
        console.log("🔋 Battery recovered: Pulse restored normal GPS mode");

        if (this.isTracking) {
          void this.restartWatcher();
        }
      }
    } catch {
      // Battery API is optional. Tracking must continue without it.
    }
  }

  private stopBatteryMonitoring(): void {
    if (this.batteryInterval !== null) {
      clearInterval(this.batteryInterval);
      this.batteryInterval = null;
    }
  }

  private recordBatterySample(level: number | undefined): void {
    if (!this.currentTrip || level === undefined || !Number.isFinite(level)) return;

    this.currentTrip.batteryHistory ??= [];
    this.currentTrip.batteryHistory.push(clamp(level, 0, 100));

    if (this.currentTrip.batteryHistory.length > STORAGE_LIMITS.maxBatterySamples) {
      this.currentTrip.batteryHistory.splice(
        0,
        this.currentTrip.batteryHistory.length - STORAGE_LIMITS.maxBatterySamples
      );
    }
  }

  getBatteryStats(): {
    current: number;
    average: number | null;
    used: number | null;
  } {
    const history = this.currentTrip?.batteryHistory ?? [];
    const average =
      history.length > 0
        ? history.reduce((sum, value) => sum + value, 0) / history.length
        : null;

    const start = this.currentTrip?.startedBatteryLevel;
    const used =
      start !== undefined ? Math.max(0, start - this.lastBatteryLevel) : null;

    return {
      current: this.lastBatteryLevel,
      average,
      used,
    };
  }

  // ====================================================
  // HEARTBEAT
  // ====================================================

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastHeartbeatPersistAt = now();

    if (typeof window === "undefined") return;

    this.heartbeatInterval = window.setInterval(() => {
      if (!this.currentTrip?.active) return;

      const timestamp = now();
      this.currentTrip.duration = Math.max(
        0,
        timestamp - this.currentTrip.startedAt
      );

      this.notifyTrip();

      if (timestamp - this.lastHeartbeatPersistAt >= HEARTBEAT_PERSIST_INTERVAL_MS) {
        this.persistTrip();
        this.lastHeartbeatPersistAt = timestamp;
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ====================================================
  // TRIP CREATION / PERSISTENCE / RESTORE
  // ====================================================

  private initializeNewTrip(initialLocation: TrackerLocation): void {
    safeRemoveItem(STORAGE.activeTrip);

    const startedAt = now();

    this.currentTrip = {
      active: true,
      startedAt,
      lastUpdate: startedAt,
      totalDistance: 0,
      currentSpeed: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      duration: 0,
      points: [],
      batteryHistory: [],
      backgroundDuration: 0,
      foregroundDuration: 0,
      startedBatteryLevel: this.lastBatteryLevel,
    };

    this.isInBackground = false;
    this.appStateChangedAt = startedAt;

    this.acceptAnchorPoint(initialLocation, false);
    console.log("🚗 Fresh Pulse trip session created");
  }

  private persistTrip(): void {
    if (!this.currentTrip) return;

    const payload = this.config.enableEncryption
      ? encodeStoragePayload(this.currentTrip)
      : JSON.stringify(this.currentTrip);

    safeSetItem(STORAGE.activeTrip, payload);
  }

  restoreTrip(): ActiveTripSession | null {
    const raw = safeGetItem(STORAGE.activeTrip);
    if (!raw) return null;

    const parsed = decodeStoragePayload<ActiveTripSession>(raw);

    if (!parsed || typeof parsed !== "object" || !parsed.active) {
      return null;
    }

    const restored: ActiveTripSession = {
      active: true,
      startedAt: finiteOr(parsed.startedAt, now()),
      lastUpdate: finiteOr(parsed.lastUpdate, now()),
      totalDistance: Math.max(0, finiteOr(parsed.totalDistance, 0)),
      currentSpeed: Math.max(0, finiteOr(parsed.currentSpeed, 0)),
      averageSpeed: Math.max(0, finiteOr(parsed.averageSpeed, 0)),
      maxSpeed: Math.max(0, finiteOr(parsed.maxSpeed, 0)),
      duration: Math.max(0, finiteOr(parsed.duration, 0)),
      points: Array.isArray(parsed.points) ? parsed.points : [],
      batteryHistory: Array.isArray(parsed.batteryHistory)
        ? parsed.batteryHistory.slice(-STORAGE_LIMITS.maxBatterySamples)
        : [],
      backgroundDuration: Math.max(0, finiteOr(parsed.backgroundDuration, 0)),
      foregroundDuration: Math.max(0, finiteOr(parsed.foregroundDuration, 0)),
      startedBatteryLevel:
        typeof parsed.startedBatteryLevel === "number"
          ? parsed.startedBatteryLevel
          : undefined,
      endingBatteryLevel:
        typeof parsed.endingBatteryLevel === "number"
          ? parsed.endingBatteryLevel
          : undefined,
    };

    this.currentTrip = restored;
    this.lastRawLocation =
      restored.points.length > 0
        ? restored.points[restored.points.length - 1]
        : null;

    // Critical: restoring state must NOT request location permission or pretend
    // that a GPS watcher is already active. The UI can offer "Resume Trip" and
    // call resume()/start().
    this.isTracking = false;
    safeRemoveItem(STORAGE.trackingState);

    this.appStateChangedAt = now();
    this.isInBackground = false;

    console.log("♻️ Active Pulse trip restored. Waiting for user to resume tracking.");
    return this.snapshotTrip(restored);
  }

  clearStoredTrip(): void {
    if (this.isTracking) {
      throw new Error("Stop the active trip before clearing stored trip data.");
    }

    this.currentTrip = null;
    this.lastRawLocation = null;
    safeRemoveItem(STORAGE.activeTrip);
    safeRemoveItem(STORAGE.lastLocation);
    safeRemoveItem(STORAGE.trackingState);
  }

  // ====================================================
  // SUBSCRIPTIONS
  // ====================================================

  subscribe(callback: LocationSubscriber): () => void {
    this.subscribers.add(callback);

    return () => {
      this.subscribers.delete(callback);
    };
  }

  subscribeToTrip(callback: TripSubscriber): () => void {
    this.tripSubscribers.add(callback);

    return () => {
      this.tripSubscribers.delete(callback);
    };
  }

  private notifyLocation(location: TrackerLocation): void {
    if (!this.currentTrip) return;

    const tripSnapshot = this.snapshotTrip(this.currentTrip);

    for (const callback of this.subscribers) {
      try {
        callback({ ...location }, tripSnapshot);
      } catch (error) {
        console.error("Location subscriber failed:", error);
      }
    }
  }

  private notifyTrip(): void {
    if (!this.currentTrip) return;

    const snapshot = this.snapshotTrip(this.currentTrip);

    for (const callback of this.tripSubscribers) {
      try {
        callback(snapshot);
      } catch (error) {
        console.error("Trip subscriber failed:", error);
      }
    }
  }

  private snapshotTrip(trip: ActiveTripSession): ActiveTripSession {
    return {
      ...trip,
      points: [...trip.points],
      batteryHistory: trip.batteryHistory ? [...trip.batteryHistory] : [],
    };
  }

  // ====================================================
  // GETTERS / STATS
  // ====================================================

  getLastKnownLocation(): TrackerLocation | null {
    const raw = safeGetItem(STORAGE.lastLocation);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as TrackerLocation;

      if (!isValidCoordinate(parsed.lat, parsed.lng)) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  getTrip(): ActiveTripSession | null {
    return this.currentTrip ? this.snapshotTrip(this.currentTrip) : null;
  }

  getTripStats(): {
    distance: number;
    duration: number;
    avgSpeed: number;
    maxSpeed: number;
    pointsCount: number;
    batteryEfficiency: number | null;
    batteryUsed: number | null;
    backgroundTime: number;
    foregroundTime: number;
  } | null {
    if (!this.currentTrip) return null;

    const durations = this.getLiveStateDurations();
    const batteryStats = this.getBatteryStats();

    return {
      distance: this.currentTrip.totalDistance / 1000,
      duration: this.currentTrip.duration / 1000,
      avgSpeed: this.currentTrip.averageSpeed,
      maxSpeed: this.currentTrip.maxSpeed,
      pointsCount: this.currentTrip.points.length,
      batteryEfficiency:
        batteryStats.used === null ? null : clamp(100 - batteryStats.used, 0, 100),
      batteryUsed: batteryStats.used,
      backgroundTime: durations.backgroundDuration / 1000,
      foregroundTime: durations.foregroundDuration / 1000,
    };
  }
}

// ======================================================
// SINGLETON EXPORT
// ======================================================

export const BackgroundTracker = new BackgroundTrackerService();
