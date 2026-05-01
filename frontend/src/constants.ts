// src/constants.ts

import type { TransitNetwork, TransitRoute, RouteType } from "./types";

// ===============================
// 🌍 NETWORKS (SOURCE OF TRUTH)
// ===============================
export const TRANSIT_NETWORKS: readonly TransitNetwork[] = [
  "Gautrain",
  "Rea Vaya",
  "A Re Yeng",
  "Tshwane Bus Service",
  "Metrorail",
  "Taxi"
] as const;

// ===============================
// 📍 GEO TYPES
// ===============================
export type GeoPoint = {
  lat: number;
  lng: number;
};

// ===============================
// 🧠 EXTENDED ROUTE TYPE
// ===============================
export type IntelligentRoute = TransitRoute & {
  coordinates?: GeoPoint[];

  avgSpeed?: number;
  reliabilityScore?: number;
  peakHours?: number[];

  demandScore?: number;
  fareOverride?: number;
  lastVerified?: number;

  crowdLevel?: "Low" | "Medium" | "High";

  // 🔥 NEW: SEARCH + UX
  keywords?: string[];
};

// ===============================
// 🚖 ROUTE TYPE SHORTCUT
// ===============================
const TAXI_TYPE: RouteType = "Complementary";

// ===============================
// 🧠 HELPER
// ===============================
const NOW = () => Date.now();

// ===============================
// 🗺️ ROUTE REGISTRY (PULSE CORE)
// ===============================
export const ROUTE_REGISTRY: IntelligentRoute[] = [

  // ===============================
  // 🚆 GAUTRAIN
  // ===============================
  {
    id: "gt-ns",
    network: "Gautrain",
    code: "NS",
    name: "Hatfield ↔ Park Station",
    type: "Rail",
    status: "Operational",
    severity: "Operational",
    lastUpdated: NOW(),

    startTerminal: "Hatfield",
    endTerminal: "Park Station",

    coordinates: [
      { lat: -25.7479, lng: 28.2293 },
      { lat: -26.2041, lng: 28.0473 }
    ],

    avgSpeed: 80,
    reliabilityScore: 0.96,
    demandScore: 0.9,
    peakHours: [6, 7, 8, 16, 17, 18],
    crowdLevel: "High",

    keywords: ["hatfield", "park", "gautrain", "pta", "jhb"]
  },

  {
    id: "ary-cbd-hatfield",
    network: "A Re Yeng",
    code: "L1",
    name: "Pretoria CBD ↔ Hatfield",
    type: "Trunk",
    status: "Operational",
    severity: "Operational",
    lastUpdated: NOW(),

    startTerminal: "CBD",
    endTerminal: "Hatfield",

    coordinates: [
      { lat: -25.746, lng: 28.188 },
      { lat: -25.7479, lng: 28.2293 }
    ],

    avgSpeed: 34,
    reliabilityScore: 0.86,
    demandScore: 0.8,
    peakHours: [6, 7, 8, 16, 17],
    crowdLevel: "High",

    keywords: ["pretoria", "hatfield", "areyeng", "bus"]
  },

  // ===============================
  // 🚌 REA VAYA
  // ===============================
  {
    id: "rv-t1",
    network: "Rea Vaya",
    code: "T1",
    name: "Thokoza Park ↔ Ellis Park",
    type: "Trunk",
    status: "Delayed",
    severity: "Moderate",
    lastUpdated: NOW(),

    startTerminal: "Thokoza Park",
    endTerminal: "Ellis Park",

    coordinates: [
      { lat: -26.267, lng: 27.858 },
      { lat: -26.204, lng: 28.047 }
    ],

    avgSpeed: 32,
    reliabilityScore: 0.72,
    demandScore: 0.85,
    peakHours: [6, 7, 8, 15, 16, 17],
    crowdLevel: "High",

    keywords: ["soweto", "ellis park", "rea vaya"]
  },

  // ===============================
  // 🚆 METRORAIL
  // ===============================
  {
    id: "mr-soweto",
    network: "Metrorail",
    code: "SOW",
    name: "Naledi ↔ Park Station",
    type: "Rail",
    status: "Disrupted",
    severity: "Severe",
    lastUpdated: NOW(),

    startTerminal: "Naledi",
    endTerminal: "Park Station",

    coordinates: [
      { lat: -26.267, lng: 27.858 },
      { lat: -26.204, lng: 28.047 }
    ],

    avgSpeed: 45,
    reliabilityScore: 0.45,
    demandScore: 0.7,
    crowdLevel: "High",

    keywords: ["soweto", "train", "metro"]
  },

  // ===============================
  // 🚖 TAXI (🔥 CORE TO YOUR PRODUCT)
  // ===============================
  {
    id: "tx-pta-mamelodi",
    network: "Taxi",
    code: "MM",
    name: "Pretoria CBD ↔ Mamelodi",
    type: TAXI_TYPE,
    status: "Operational",
    severity: "Operational",
    lastUpdated: NOW(),

    startTerminal: "CBD",
    endTerminal: "Mamelodi",

    coordinates: [
      { lat: -25.746, lng: 28.188 },
      { lat: -25.725, lng: 28.350 }
    ],

    avgSpeed: 45,
    reliabilityScore: 0.85,
    demandScore: 0.95,
    crowdLevel: "High",

    keywords: ["pta", "mamelodi", "taxi"]
  },

  {
    id: "tx-cbd-soweto",
    network: "Taxi",
    code: "SW",
    name: "CBD ↔ Soweto",
    type: TAXI_TYPE,
    status: "Operational",
    severity: "Moderate",
    lastUpdated: NOW(),

    startTerminal: "CBD",
    endTerminal: "Soweto",

    coordinates: [
      { lat: -26.204, lng: 28.047 },
      { lat: -26.267, lng: 27.858 }
    ],

    avgSpeed: 42,
    reliabilityScore: 0.8,
    demandScore: 0.88,
    crowdLevel: "High",

    keywords: ["jhb", "soweto", "taxi"]
  }
];

// ===============================
// 💰 NETWORK BASE RATES
// ===============================
export const NETWORK_RATES: Record<TransitNetwork, number> = {
  Gautrain: 4.5,
  "Rea Vaya": 2.1,
  "A Re Yeng": 2.2,
  "Tshwane Bus Service": 1.8,
  Metrorail: 1.2,
  Taxi: 2.5
};

// ===============================
// 🚖 TAXI MODEL (REALISTIC)
// ===============================
export const TAXI_CONFIG = {
  BASE_FARE: 12,
  PER_KM: 2.4,
  PEAK_MULTIPLIER: 1.25,
  NIGHT_MULTIPLIER: 1.15,
  MIN_FARE: 10
} as const;

// ===============================
// 🧠 DETECTION CONFIG
// ===============================
export const DETECTION_CONFIG = {
  WALKING_MAX_SPEED: 6,
  VEHICLE_MIN_SPEED: 10,

  TAXI_MIN_SPEED: 20,
  BUS_MIN_SPEED: 15,
  BUS_MAX_SPEED: 55,

  TRAIN_MIN_SPEED: 60,

  ROUTE_MATCH_RADIUS_KM: 0.35,
  STRONG_ROUTE_MATCH_KM: 0.12,

  STOP_SPEED_THRESHOLD: 4
} as const;

// ===============================
// 📡 PULSE CONFIG (NEW 🔥)
// ===============================
export const PULSE_CONFIG = {
  REPORT_TTL: 1000 * 60 * 60, // 1 hour
  MAX_REPORTS_PER_ROUTE: 50,

  WEIGHT_RECENCY: 0.6,
  WEIGHT_VOLUME: 0.4
};

// ===============================
// 🤖 AI CONFIG (FUTURE READY)
// ===============================
export const AI_CONFIG = {
  ROUTE_CONFIDENCE_THRESHOLD: 0.65,
  HABIT_CONFIDENCE_THRESHOLD: 0.6,
  MAX_PREDICTIONS: 3
};