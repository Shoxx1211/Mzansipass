// src/main.tsx

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ===============================
// 🧠 ENV DETECTION
// ===============================
const isDev = import.meta.env.DEV;

// ===============================
// 🚨 GLOBAL ERROR HANDLER (CRITICAL)
// ===============================
window.addEventListener("error", (event) => {
  console.error("🔥 Global Error:", event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("🔥 Unhandled Promise Rejection:", event.reason);
});

// ===============================
// 📡 PWA SERVICE WORKER (SAFE)
// ===============================
if ("serviceWorker" in navigator) {
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,

        onNeedRefresh() {
          console.log("🔄 New version available");

          // 🔥 DO NOT auto-refresh in production (bad UX)
          if (isDev) {
            console.log("⚡ Dev mode → auto updating");
            updateSW(true);
          } else {
            console.log("📢 Waiting for user-triggered refresh");
            // 👉 Later: show toast/UI prompt
          }
        },

        onOfflineReady() {
          console.log("✅ App ready for offline use");
        },

        onRegisteredSW(swUrl, registration) {
          console.log("📡 SW Registered:", swUrl);
        },

        onRegisterError(error) {
          console.error("❌ SW Registration failed:", error);
        }
      });
    })
    .catch((err) => {
      console.error("❌ PWA init failed:", err);
    });
}

// ===============================
// 🧩 ROOT ELEMENT CHECK
// ===============================
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("❌ Root element not found");
}

// ===============================
// ⚛️ RENDER APP
// ===============================
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);