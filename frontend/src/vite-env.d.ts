/// <reference types="vite/client" />

// ===============================
// 🌍 ENVIRONMENT VARIABLES (STRICT)
// ===============================
interface ImportMetaEnv {
  readonly VITE_APP_NAME: string;
  readonly VITE_API_BASE_URL?: string;

  // 🔥 future integrations
  readonly VITE_PAYSTACK_PUBLIC_KEY?: string;
  readonly VITE_MAPS_API_KEY?: string;

  // modes
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}


// ===============================
// 📡 PWA REGISTER MODULE (ADVANCED)
// ===============================
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

    // 🔥 advanced lifecycle hooks
    onRegistered?: (registration?: ServiceWorkerRegistration) => void;
  }

  export function registerSW(
    options?: RegisterSWOptions
  ): (reloadPage?: boolean) => void;
}


// ===============================
// 📡 VIRTUAL PWA REGISTER (INLINE VARIANT)
// ===============================
declare module "virtual:pwa-register/react" {
  export function useRegisterSW(options?: {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
  }): {
    needRefresh: [boolean, (v: boolean) => void];
    offlineReady: [boolean, (v: boolean) => void];
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  };
}


// ===============================
// 🔥 SERVICE WORKER GLOBAL TYPES
// ===============================
interface Navigator {
  serviceWorker: ServiceWorkerContainer;
}

interface ServiceWorkerContainer {
  register(
    scriptURL: string,
    options?: RegistrationOptions
  ): Promise<ServiceWorkerRegistration>;
}


// ===============================
// 🧠 FUTURE EXTENSIBILITY (SAFE)
// ===============================

// Allows custom global flags later (analytics, experiments, etc.)
interface Window {
  __MZANSI_DEVTOOLS__?: boolean;
}