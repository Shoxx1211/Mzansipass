// src/constants.ts

import type {
  TransitNetwork,
  TransitRoute,
  RouteType
} from "./types";

// ======================================================
// 🌍 NETWORKS
// ======================================================
export const TRANSIT_NETWORKS: readonly TransitNetwork[] = [
  "Gautrain",
  "Rea Vaya",
  "A Re Yeng",
  "Tshwane Bus Service",
  "Metrorail",
  "Taxi"
] as const;

// ======================================================
// 🎨 NETWORK UI CONFIG
// ======================================================
export const NETWORK_UI = {
  Gautrain: {
    color: "from-emerald-500 to-emerald-700",
    glow: "shadow-emerald-500/20",
    icon: "🚆",
    short: "GT"
  },

  "Rea Vaya": {
    color: "from-blue-500 to-cyan-600",
    glow: "shadow-blue-500/20",
    icon: "🚌",
    short: "RV"
  },

  "A Re Yeng": {
    color: "from-purple-500 to-fuchsia-600",
    glow: "shadow-purple-500/20",
    icon: "🚍",
    short: "AR"
  },

  "Tshwane Bus Service": {
    color: "from-amber-500 to-orange-600",
    glow: "shadow-amber-500/20",
    icon: "🚐",
    short: "TB"
  },

  Metrorail: {
    color: "from-red-500 to-rose-700",
    glow: "shadow-red-500/20",
    icon: "🚉",
    short: "MR"
  },

  Taxi: {
    color: "from-zinc-700 to-zinc-900",
    glow: "shadow-white/10",
    icon: "🚖",
    short: "TX"
  }
} as const;

// ======================================================
// 📍 GEO TYPES
// ======================================================
export type GeoPoint = {
  lat: number;
  lng: number;
};

// ======================================================
// 🧠 EXTENDED ROUTE TYPE
// ======================================================
export type IntelligentRoute =
  TransitRoute & {

    coordinates?: GeoPoint[];

    avgSpeed?: number;

    reliabilityScore?: number;

    peakHours?: number[];

    demandScore?: number;

    fareOverride?: number;

    lastVerified?: number;

    crowdLevel?:
      | "Low"
      | "Medium"
      | "High";

    keywords?: string[];

    // 🔥 NEW UX
    badge?: string;

    livePassengers?: number;

    estimatedDelay?: number;
  };

// ======================================================
// 🚖 ROUTE TYPE SHORTCUT
// ======================================================
const TAXI_TYPE: RouteType =
  "Complementary";

// ======================================================
// 🧠 HELPER
// ======================================================
const NOW = () => Date.now();

// ======================================================
// 🗺️ ROUTE REGISTRY
// ======================================================
export const ROUTE_REGISTRY:
  IntelligentRoute[] = [

  // ======================================================
  // 🚆 GAUTRAIN
  // ======================================================
  {
    id: "gt-hatfield-park",

    network: "Gautrain",

    code: "GT-NS",

    name:
      "Hatfield ↔ Park Station",

    type: "Rail",

    status: "Operational",

    severity: "Operational",

    lastUpdated: NOW(),

    startTerminal: "Hatfield",

    endTerminal: "Park Station",

    coordinates: [
      {
        lat: -25.7479,
        lng: 28.2293
      },
      {
        lat: -26.2041,
        lng: 28.0473
      }
    ],

    avgSpeed: 82,

    reliabilityScore: 0.96,

    demandScore: 0.93,

    peakHours: [
      6,
      7,
      8,
      16,
      17,
      18
    ],

    crowdLevel: "High",

    badge: "Fastest Route",

    livePassengers: 1240,

    estimatedDelay: 2,

    keywords: [
      "hatfield",
      "park",
      "pretoria",
      "johannesburg",
      "gautrain"
    ]
  },

  // ======================================================
  // 🚌 REA VAYA
  // ======================================================
  {
    id: "rv-t1",

    network: "Rea Vaya",

    code: "T1",

    name:
      "Thokoza Park ↔ Ellis Park",

    type: "Trunk",

    status: "Operational",

    severity: "Operational",

    lastUpdated: NOW(),

    startTerminal:
      "Thokoza Park",

    endTerminal:
      "Ellis Park",

    coordinates: [
      {
        lat: -26.267,
        lng: 27.858
      },
      {
        lat: -26.204,
        lng: 28.047
      }
    ],

    avgSpeed: 34,

    reliabilityScore: 0.81,

    demandScore: 0.89,

    peakHours: [
      6,
      7,
      8,
      15,
      16,
      17
    ],

    crowdLevel: "High",

    badge: "Most Popular",

    livePassengers: 840,

    estimatedDelay: 5,

    keywords: [
      "soweto",
      "ellis park",
      "rea vaya",
      "brt"
    ]
  },

  // ======================================================
  // 🚍 A RE YENG
  // ======================================================
  {
    id: "ary-hatfield",

    network: "A Re Yeng",

    code: "L1",

    name:
      "Pretoria CBD ↔ Hatfield",

    type: "Trunk",

    status: "Operational",

    severity: "Operational",

    lastUpdated: NOW(),

    startTerminal:
      "Pretoria CBD",

    endTerminal:
      "Hatfield",

    coordinates: [
      {
        lat: -25.746,
        lng: 28.188
      },
      {
        lat: -25.7479,
        lng: 28.2293
      }
    ],

    avgSpeed: 31,

    reliabilityScore: 0.84,

    demandScore: 0.78,

    peakHours: [
      6,
      7,
      8,
      16,
      17
    ],

    crowdLevel: "Medium",

    badge: "Reliable",

    livePassengers: 620,

    estimatedDelay: 3,

    keywords: [
      "pretoria",
      "hatfield",
      "a re yeng",
      "bus"
    ]
  },

  // ======================================================
  // 🚉 METRORAIL
  // ======================================================
  {
    id: "mr-soweto",

    network: "Metrorail",

    code: "MR-SW",

    name:
      "Naledi ↔ Park Station",

    type: "Rail",

    status: "Delayed",

    severity: "Moderate",

    lastUpdated: NOW(),

    startTerminal: "Naledi",

    endTerminal:
      "Park Station",

    coordinates: [
      {
        lat: -26.267,
        lng: 27.858
      },
      {
        lat: -26.204,
        lng: 28.047
      }
    ],

    avgSpeed: 42,

    reliabilityScore: 0.58,

    demandScore: 0.74,

    crowdLevel: "High",

    badge: "Budget Route",

    livePassengers: 1640,

    estimatedDelay: 11,

    keywords: [
      "metro",
      "soweto",
      "train",
      "park station"
    ]
  },

  // ======================================================
  // 🚖 TAXI
  // ======================================================
  {
    id: "tx-cbd-soweto",

    network: "Taxi",

    code: "TX-SW",

    name:
      "Johannesburg CBD ↔ Soweto",

    type: TAXI_TYPE,

    status: "Operational",

    severity: "Operational",

    lastUpdated: NOW(),

    startTerminal:
      "Johannesburg CBD",

    endTerminal: "Soweto",

    coordinates: [
      {
        lat: -26.204,
        lng: 28.047
      },
      {
        lat: -26.267,
        lng: 27.858
      }
    ],

    avgSpeed: 45,

    reliabilityScore: 0.8,

    demandScore: 0.96,

    crowdLevel: "High",

    badge: "Most Flexible",

    livePassengers: 410,

    estimatedDelay: 1,

    keywords: [
      "taxi",
      "jhb",
      "soweto",
      "rank"
    ]
  },

  {
    id: "tx-pta-mamelodi",

    network: "Taxi",

    code: "TX-MM",

    name:
      "Pretoria CBD ↔ Mamelodi",

    type: TAXI_TYPE,

    status: "Operational",

    severity: "Operational",

    lastUpdated: NOW(),

    startTerminal:
      "Pretoria CBD",

    endTerminal:
      "Mamelodi",

    coordinates: [
      {
        lat: -25.746,
        lng: 28.188
      },
      {
        lat: -25.725,
        lng: 28.350
      }
    ],

    avgSpeed: 47,

    reliabilityScore: 0.86,

    demandScore: 0.9,

    crowdLevel: "High",

    badge: "Always Available",

    livePassengers: 540,

    estimatedDelay: 2,

    keywords: [
      "pretoria",
      "mamelodi",
      "taxi"
    ]
  }
];

// ======================================================
// 💰 BASE NETWORK RATES
// ======================================================
export const NETWORK_RATES:
Record<TransitNetwork, number> = {

  Gautrain: 4.5,

  "Rea Vaya": 2.1,

  "A Re Yeng": 2.2,

  "Tshwane Bus Service": 1.8,

  Metrorail: 1.2,

  Taxi: 2.5
};

// ======================================================
// 🚖 TAXI CONFIG
// ======================================================
export const TAXI_CONFIG = {

  BASE_FARE: 12,

  PER_KM: 2.4,

  PEAK_MULTIPLIER: 1.25,

  NIGHT_MULTIPLIER: 1.15,

  MIN_FARE: 10

} as const;

// ======================================================
// 📡 LIVE STATUS CONFIG
// ======================================================
export const LIVE_STATUS = {

  OPERATIONAL: {
    label: "Operational",
    color: "text-emerald-400"
  },

  DELAYED: {
    label: "Delayed",
    color: "text-amber-400"
  },

  DISRUPTED: {
    label: "Disrupted",
    color: "text-red-400"
  }

} as const;

// ======================================================
// 🧠 DETECTION CONFIG
// ======================================================
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

// ======================================================
// 📡 PULSE CONFIG
// ======================================================
export const PULSE_CONFIG = {

  REPORT_TTL:
    1000 * 60 * 60,

  MAX_REPORTS_PER_ROUTE: 50,

  WEIGHT_RECENCY: 0.6,

  WEIGHT_VOLUME: 0.4

} as const;

// ======================================================
// 🤖 AI CONFIG
// ======================================================
export const AI_CONFIG = {

  ROUTE_CONFIDENCE_THRESHOLD: 0.65,

  HABIT_CONFIDENCE_THRESHOLD: 0.6,

  MAX_PREDICTIONS: 3

} as const;

// ======================================================
// ✨ QUICK DESTINATIONS
// ======================================================
export const QUICK_DESTINATIONS = [

  "Sandton",

  "Hatfield",

  "Park Station",

  "Rosebank",

  "Soweto",

  "Braamfontein",

  "Pretoria CBD",

  "Randburg"

] as const;