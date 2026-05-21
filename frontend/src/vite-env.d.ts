/// <reference types="vite/client" />

// ======================================================
// 🌍 ENVIRONMENT VARIABLES (STRICT + ENHANCED)
// ======================================================

interface ImportMetaEnv {
  // ======================================================
  // CORE APP CONFIG
  // ======================================================
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_APP_ENV: "development" | "staging" | "production";
  
  // ======================================================
  // API CONFIGURATION
  // ======================================================
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_TIMEOUT?: string;
  readonly VITE_API_RETRY_COUNT?: string;
  
  // ======================================================
  // AI & MAPS INTEGRATIONS
  // ======================================================
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_MAPS_API_KEY?: string;
  readonly VITE_MAPS_API_KEY_ANDROID?: string;
  readonly VITE_MAPS_API_KEY_IOS?: string;
  
  // ======================================================
  // PAYMENT INTEGRATIONS
  // ======================================================
  readonly VITE_PAYSTACK_PUBLIC_KEY?: string;
  readonly VITE_STRIPE_PUBLIC_KEY?: string;
  
  // ======================================================
  // ANALYTICS & MONITORING
  // ======================================================
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_MIXPANEL_TOKEN?: string;
  
  // ======================================================
  // FEATURE FLAGS
  // ======================================================
  readonly VITE_ENABLE_GEMINI: string;
  readonly VITE_ENABLE_OFFLINE_MODE: string;
  readonly VITE_ENABLE_BACKGROUND_TRACKING: string;
  readonly VITE_ENABLE_PUSH_NOTIFICATIONS: string;
  readonly VITE_ENABLE_ANALYTICS: string;
  
  // ======================================================
  // APP MODE
  // ======================================================
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
  readonly BASE_URL: string;
}

// ======================================================
// IMPORT META INTERFACE
// ======================================================

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// ======================================================
// 📡 PWA REGISTER MODULE (ADVANCED)
// ======================================================

declare module "virtual:pwa-register" {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisteredSW?: (
      swUrl: string,
      registration?: ServiceWorkerRegistration
    ) => void;
    onRegisterError?: (error: any) => void;
    onRegistered?: (registration?: ServiceWorkerRegistration) => void;
  }

  export function registerSW(
    options?: RegisterSWOptions
  ): (reloadPage?: boolean) => void;
}

// ======================================================
// 📡 VIRTUAL PWA REGISTER (REACT VARIANT)
// ======================================================

declare module "virtual:pwa-register/react" {
  export interface UseRegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration?: ServiceWorkerRegistration) => void;
    onRegisterError?: (error: any) => void;
  }

  export function useRegisterSW(options?: UseRegisterSWOptions): {
    needRefresh: [boolean, (v: boolean) => void];
    offlineReady: [boolean, (v: boolean) => void];
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  };
}

// ======================================================
// 🔥 SERVICE WORKER GLOBAL TYPES
// ======================================================

interface Navigator {
  readonly serviceWorker: ServiceWorkerContainer;
  // Battery status API
  getBattery?: () => Promise<BatteryManager>;
  // Network information
  connection?: NetworkInformation;
  // Clipboard API
  clipboard?: Clipboard;
  // Permissions API
  permissions?: Permissions;
  // Vibrate API
  vibrate?: (pattern: number | number[]) => boolean;
}

// ======================================================
// 🔋 BATTERY STATUS API
// ======================================================

interface BatteryManager extends EventTarget {
  readonly charging: boolean;
  readonly chargingTime: number;
  readonly dischargingTime: number;
  readonly level: number;
  onchargingchange: ((this: BatteryManager, ev: Event) => any) | null;
  onchargingtimechange: ((this: BatteryManager, ev: Event) => any) | null;
  ondischargingtimechange: ((this: BatteryManager, ev: Event) => any) | null;
  onlevelchange: ((this: BatteryManager, ev: Event) => any) | null;
}

// ======================================================
// 📡 NETWORK INFORMATION API
// ======================================================

interface NetworkInformation extends EventTarget {
  readonly type: "bluetooth" | "cellular" | "ethernet" | "none" | "wifi" | "wimax" | "other" | "unknown";
  readonly effectiveType: "slow-2g" | "2g" | "3g" | "4g";
  readonly downlink: number;
  readonly downlinkMax: number;
  readonly rtt: number;
  readonly saveData: boolean;
  onchange: ((this: NetworkInformation, ev: Event) => any) | null;
}

// ======================================================
// 📋 CLIPBOARD API
// ======================================================

interface Clipboard extends EventTarget {
  read(): Promise<ClipboardItems>;
  readText(): Promise<string>;
  write(data: ClipboardItem[]): Promise<void>;
  writeText(data: string): Promise<void>;
}

type ClipboardItems = ClipboardItem[];
type ClipboardItem = any;

// ======================================================
// 🔐 PERMISSIONS API
// ======================================================

interface Permissions {
  query(permissionDesc: PermissionDescriptor): Promise<PermissionStatus>;
}

interface PermissionStatus extends EventTarget {
  readonly state: "granted" | "denied" | "prompt";
  onchange: ((this: PermissionStatus, ev: Event) => any) | null;
}

type PermissionDescriptor = {
  name: "geolocation" | "notifications" | "push" | "midi" | "camera" | "microphone" | "speaker" | "device-info" | "background-sync" | "bluetooth" | "persistent-storage" | "ambient-light-sensor" | "accelerometer" | "gyroscope" | "magnetometer";
};

// ======================================================
// 📱 SCREEN ORIENTATION API
// ======================================================

interface ScreenOrientation extends EventTarget {
  readonly type: "portrait-primary" | "portrait-secondary" | "landscape-primary" | "landscape-secondary";
  readonly angle: number;
  lock(orientation: OrientationLockType): Promise<void>;
  unlock(): void;
}

type OrientationLockType = "any" | "natural" | "landscape" | "portrait" | "portrait-primary" | "portrait-secondary" | "landscape-primary" | "landscape-secondary";

// ======================================================
// 💾 STORAGE MANAGER API
// ======================================================

interface StorageManager {
  estimate(): Promise<{ usage: number; quota: number }>;
  persist(): Promise<boolean>;
  persisted(): Promise<boolean>;
}

// ======================================================
// 📱 CONTACT PICKER API
// ======================================================

interface ContactInfo {
  name?: string[];
  tel?: string[];
  email?: string[];
  address?: any[];
}

interface ContactsManager {
  select(properties: string[], options?: { multiple?: boolean }): Promise<ContactInfo[]>;
  getProperties(): Promise<string[]>;
}

interface Navigator {
  contacts?: ContactsManager;
}

// ======================================================
// 🗺️ GEOLOCATION (Enhanced)
// ======================================================

interface GeolocationPosition {
  coords: GeolocationCoordinates;
  timestamp: number;
}

interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
}

// ======================================================
// 🧠 CUSTOM WINDOW PROPERTIES
// ======================================================

interface Window {
  // Development tools flag
  __PULSE_DEVTOOLS__?: boolean;
  
  // Performance monitoring
  __PULSE_PERFORMANCE__?: {
    startTime: number;
    marks: Record<string, number>;
    measures: Record<string, number>;
  };
  
  // Debug mode flag
  __PULSE_DEBUG__?: boolean;
  
  // Capacitor (if using Capacitor)
  Capacitor?: any;
  
  // Google Analytics
  gtag?: (...args: any[]) => void;
  
  // Sentry
  Sentry?: any;
  
  // Intercom
  Intercom?: (...args: any[]) => void;
}

// ======================================================
// 🚀 PERFORMANCE API EXTENSIONS
// ======================================================

interface Performance {
  memory?: {
    jsHeapSizeLimit: number;
    totalJSHeapSize: number;
    usedJSHeapSize: number;
  };
}

// ======================================================
// 📱 DEVICE MEMORY API
// ======================================================

interface Navigator {
  deviceMemory?: number;
}

// ======================================================
// 🎨 CSS PROPERTIES (Custom)
// ======================================================

declare module "csstype" {
  interface Properties {
    "--safe-area-inset-top"?: string;
    "--safe-area-inset-bottom"?: string;
    "--safe-area-inset-left"?: string;
    "--safe-area-inset-right"?: string;
  }
}

// ======================================================
// 📦 ASSET IMPORTS (For TypeScript)
// ======================================================

declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.jpg" {
  const content: string;
  export default content;
}

declare module "*.json" {
  const value: any;
  export default value;
}

// ======================================================
// 🧠 UTILITY TYPES
// ======================================================

type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

type Nullable<T> = T | null;

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

type AsyncReturnType<T extends (...args: any) => any> = T extends (...args: any) => Promise<infer R> ? R : any;

// ======================================================
// 🚀 EXPORT NOTHING (Ambient Module)
// ======================================================

export {};