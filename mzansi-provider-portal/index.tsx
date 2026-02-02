import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { DataProvider } from "./context/DataContext";

/**
 * index.tsx
 * ------------------------------------------------------
 * Application bootstrap entry point.
 *
 * Responsibilities:
 * - Mount React to the DOM
 * - Register global providers (DataContext, etc.)
 * - Nothing else
 *
 * ❌ No routing logic
 * ❌ No auth logic
 * ❌ No UI decisions
 *
 * This file should almost never change.
 */

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container missing in index.html");
}

const root = ReactDOM.createRoot(container);

root.render(
  <React.StrictMode>
    <DataProvider>
      <App />
    </DataProvider>
  </React.StrictMode>
);
