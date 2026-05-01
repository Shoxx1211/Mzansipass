// src/main.tsx

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import React from "react";

// ===============================
// 🧠 ENV
// ===============================
const isDev = import.meta.env.DEV;

// ===============================
// 🧱 ERROR BOUNDARY
// ===============================
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, info: any) {
    console.error("🔥 React Crash:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white px-6">
          <div className="glass p-8 rounded-3xl text-center space-y-4 max-w-sm">
            <h1 className="text-xl font-black">Something broke</h1>
            <p className="text-white/50 text-sm">
              The app encountered an unexpected error.
            </p>
            <button
              onClick={this.handleReload}
              className="btn-primary w-full h-12"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ===============================
// 🚨 GLOBAL ERROR HANDLING
// ===============================
window.addEventListener("error", (event) => {
  console.error("🔥 Global Error:", event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("🔥 Unhandled Promise:", event.reason);
});

// ===============================
// 📊 PERFORMANCE LOGGING
// ===============================
if (!isDev && "performance" in window) {
  window.addEventListener("load", () => {
    setTimeout(() => {
      const perf = performance.getEntriesByType("navigation")[0] as any;

      if (perf) {
        console.log(
          "⚡ Load Time:",
          Math.round(perf.loadEventEnd - perf.startTime),
          "ms"
        );
      }
    }, 0);
  });
}

// ===============================
// 📡 SERVICE WORKER (REAL PWA)
// ===============================
if ("serviceWorker" in navigator && !isDev) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("✅ SW registered:", registration.scope);

        // 🔄 Detect updates
        registration.onupdatefound = () => {
          const newWorker = registration.installing;

          if (!newWorker) return;

          newWorker.onstatechange = () => {
            if (newWorker.state === "installed") {
              if (navigator.serviceWorker.controller) {
                console.log("🔄 New version available");

                showUpdateBanner(() => {
                  newWorker.postMessage({ type: "SKIP_WAITING" });
                  window.location.reload();
                });
              } else {
                console.log("✅ App ready for offline use");
              }
            }
          };
        };
      })
      .catch((error) => {
        console.error("❌ SW registration failed:", error);
      });
  });
}

// ===============================
// 🔔 UPDATE UI
// ===============================
function showUpdateBanner(onUpdate: () => void) {
  const banner = document.createElement("div");
  banner.className = "install-banner";

  banner.innerHTML = `
    <span style="font-size:12px;">New version available</span>
    <button class="install-btn">Update</button>
  `;

  banner.querySelector("button")?.addEventListener("click", () => {
    banner.remove();
    onUpdate();
  });

  document.body.appendChild(banner);
}

// ===============================
// 🧩 ROOT CHECK
// ===============================
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("❌ Root element not found");
}

// ===============================
// ⚛️ RENDER
// ===============================
createRoot(rootElement).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>
);