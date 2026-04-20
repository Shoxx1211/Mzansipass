// vite-env.d.ts

/// <reference types="vite/client" />

// ===============================
// 🔥 PWA REGISTER MODULE (FULL TYPES)
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
  }

  export function registerSW(
    options?: RegisterSWOptions
  ): (reloadPage?: boolean) => void;
}