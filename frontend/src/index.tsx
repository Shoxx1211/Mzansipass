// src/index.tsx
// Pulse Transit - Application Entry Point
// Version: 3.0.0

import React from "react";
import ReactDOM from "react-dom/client";

import "./index.css";
import App from "./app/App";

// ======================================================
// PERFORMANCE MONITORING
// ======================================================

type WebVitalMetric = {
  name: string;
  value: number;
};

const reportWebVitals = (
  metric: WebVitalMetric,
): void => {
  if (import.meta.env.PROD) {
    // Replace this with a real analytics provider when one is connected.
    console.debug(
      "[Web Vitals]",
      metric.name,
      metric.value,
    );
  }
};

// ======================================================
// ERROR BOUNDARY
// ======================================================

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(
    props: ErrorBoundaryProps,
  ) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(
    error: Error,
  ): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  override componentDidCatch(
    error: Error,
    errorInfo: React.ErrorInfo,
  ): void {
    console.error(
      "Application Error:",
      error,
      errorInfo,
    );

    if (import.meta.env.PROD) {
      // Connect a production error-reporting service here later.
    }
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-black p-4">
          <div className="glass max-w-md space-y-4 rounded-3xl p-8 text-center">
            <div
              className="text-5xl"
              aria-hidden="true"
            >
              ⚠️
            </div>

            <h1 className="text-2xl font-bold text-white">
              Something went wrong
            </h1>

            <p className="text-sm text-white/60">
              {this.state.error?.message ??
                "An unexpected error occurred."}
            </p>

            <button
              type="button"
              onClick={() =>
                window.location.reload()
              }
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-6 py-3 font-bold text-white"
            >
              Reload Pulse
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ======================================================
// APPLICATION INITIALIZATION
// ======================================================

if (import.meta.env.DEV) {
  performance.mark(
    "pulse-app-start",
  );
}

const rootElement =
  document.getElementById("root");

if (!rootElement) {
  throw new Error(
    "Pulse could not find the root application element.",
  );
}

const root =
  ReactDOM.createRoot(
    rootElement,
  );

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

// ======================================================
// DEVELOPMENT PERFORMANCE MARKING
// ======================================================

if (import.meta.env.DEV) {
  performance.mark(
    "pulse-app-mounted",
  );

  performance.measure(
    "pulse-app-startup",
    "pulse-app-start",
    "pulse-app-mounted",
  );

  const startupMeasurement =
    performance
      .getEntriesByType(
        "measure",
      )
      .find(
        (entry) =>
          entry.name ===
          "pulse-app-startup",
      );

  if (startupMeasurement) {
    console.debug(
      `Pulse startup: ${startupMeasurement.duration.toFixed(
        2,
      )} ms`,
    );
  }
}

// Service-worker registration is intentionally NOT done here.
// vite-plugin-pwa owns registration in production.

export {
  reportWebVitals,
};