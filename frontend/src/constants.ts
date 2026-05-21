// src/constants.ts
// Pulse Transit - Premium Constants Configuration
// Version: 3.0.0 | Enterprise Release

import type {
  TransitNetwork,
  RouteType,
  IntelligentRoute
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

// Network display names
export const NETWORK_DISPLAY_NAMES: Record<TransitNetwork, string> = {
  Gautrain: "Gautrain Express",
  "Rea Vaya": "Rea Vaya BRT",
  "A Re Yeng": "A Re Yeng BRT",
  "Tshwane Bus Service": "Tshwane Bus Service",
  Metrorail: "Metrorail",
  Taxi: "Minibus Taxi"
} as const;

// Network descriptions for AI
export const NETWORK_DESCRIPTIONS: Record<TransitNetwork, string> = {
  Gautrain: "Premium express rail connecting major hubs. Fastest but most expensive.",
  "Rea Vaya": "Johannesburg's Bus Rapid Transit system. Reliable and affordable.",
  "A Re Yeng": "Pretoria's BRT system. Modern buses with dedicated lanes.",
  "Tshwane Bus Service": "Municipal bus service covering Pretoria region.",
  Metrorail: "Commuter rail service. Most affordable but less reliable.",
  Taxi: "Minibus taxi network. Most flexible, cash-based."
} as const;

// ======================================================
// 🎨 NETWORK UI CONFIG (ENHANCED)
// ======================================================

export const NETWORK_UI = {
  Gautrain: {
    color: "from-emerald-500 to-emerald-700",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    textColor: "text-emerald-400",
    glow: "shadow-emerald-500/20",
    icon: "🚆",
    iconActive: "🚄",
    short: "GT",
    fullName: "Gautrain Express"
  },
  "Rea Vaya": {
    color: "from-blue-500 to-cyan-600",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    textColor: "text-blue-400",
    glow: "shadow-blue-500/20",
    icon: "🚌",
    iconActive: "🚍",
    short: "RV",
    fullName: "Rea Vaya BRT"
  },
  "A Re Yeng": {
    color: "from-purple-500 to-fuchsia-600",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    textColor: "text-purple-400",
    glow: "shadow-purple-500/20",
    icon: "🚍",
    iconActive: "🚌",
    short: "AR",
    fullName: "A Re Yeng BRT"
  },
  "Tshwane Bus Service": {
    color: "from-amber-500 to-orange-600",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    textColor: "text-amber-400",
    glow: "shadow-amber-500/20",
    icon: "🚐",
    iconActive: "🚎",
    short: "TB",
    fullName: "Tshwane Bus Service"
  },
  Metrorail: {
    color: "from-red-500 to-rose-700",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    textColor: "text-red-400",
    glow: "shadow-red-500/20",
    icon: "🚉",
    iconActive: "🚂",
    short: "MR",
    fullName: "Metrorail"
  },
  Taxi: {
    color: "from-zinc-700 to-zinc-900",
    bgColor: "bg-zinc-500/10",
    borderColor: "border-zinc-500/30",
    textColor: "text-zinc-400",
    glow: "shadow-white/10",
    icon: "🚖",
    iconActive: "🚕",
    short: "TX",
    fullName: "Minibus Taxi"
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
// 🚖 ROUTE TYPE SHORTCUT
// ======================================================

const TAXI_TYPE: RouteType = "Complementary";
const BUS_TYPE: RouteType = "Trunk";
const RAIL_TYPE: RouteType = "Rail";

// ======================================================
// 🧠 HELPER
// ======================================================

const NOW = () => Date.now();

// ======================================================
// 🗺️ ROUTE REGISTRY (ENHANCED)
// ======================================================

export const ROUTE_REGISTRY: IntelligentRoute[] = [
  // ======================================================
  // 🚆 GAUTRAIN ROUTES
  // ======================================================
  {
    id: "gt-hatfield-park",
    network: "Gautrain",
    code: "GT-NS",
    name: "Hatfield ↔ Park Station",
    type: RAIL_TYPE,
    status: "Operational",
    severity: "Operational",
    lastUpdated: NOW(),
    startTerminal: "Hatfield",
    endTerminal: "Park Station",
    coordinates: [
      { lat: -25.7479, lng: 28.2293 },
      { lat: -26.2041, lng: 28.0473 }
    ],
    avgSpeed: 82,
    reliabilityScore: 0.96,
    demandScore: 0.93,
    peakHours: [6, 7, 8, 16, 17, 18],
    crowdLevel: "High",
    badge: "Fastest Route",
    livePassengers: 1240,
    estimatedDelay: 2,
    keywords: ["hatfield", "park", "pretoria", "johannesburg", "gautrain"],
    fareOverride: 85
  },
  {
    id: "gt-sandton-or-tambo",
    network: "Gautrain",
    code: "GT-AP",
    name: "Sandton ↔ OR Tambo Airport",
    type: RAIL_TYPE,
    status: "Operational",
    severity: "Operational",
    lastUpdated: NOW(),
    startTerminal: "Sandton",
    endTerminal: "OR Tambo Airport",
    coordinates: [
      { lat: -26.1076, lng: 28.0567 },
      { lat: -26.1337, lng: 28.2420 }
    ],
    avgSpeed: 75,
    reliabilityScore: 0.94,
    demandScore: 0.91,
    peakHours: [5, 6, 7, 8, 17, 18, 19],
    crowdLevel: "High",
    badge: "Airport Express",
    livePassengers: 890,
    estimatedDelay: 1,
    keywords: ["sandton", "or tambo", "airport", "gautrain"],
    fareOverride: 120
  },
  {
    id: "gt-pretoria-sandton",
    network: "Gautrain",
    code: "GT-PS",
    name: "Pretoria ↔ Sandton",
    type: RAIL_TYPE,
    status: "Operational",
    severity: "Operational",
    lastUpdated: NOW(),
    startTerminal: "Pretoria",
    endTerminal: "Sandton",
    coordinates: [
      { lat: -25.7479, lng: 28.1881 },
      { lat: -26.1076, lng: 28.0567 }
    ],
    avgSpeed: 78,
    reliabilityScore: 0.95,
    demandScore: 0.92,
    peakHours: [6, 7, 8, 16, 17, 18],
    crowdLevel: "High",
    badge: "Popular Commute",
    livePassengers: 1560,
    estimatedDelay: 3,
    keywords: ["pretoria", "sandton", "gautrain"],
    fareOverride: 95
  },

  // ======================================================
  // 🚌 REA VAYA ROUTES
  // ======================================================
  {
    id: "rv-t1",
    network: "Rea Vaya",
    code: "T1",
    name: "Thokoza Park ↔ Ellis Park",
    type: BUS_TYPE,
    status: "Operational",
    severity: "Operational",
    lastUpdated: NOW(),
    startTerminal: "Thokoza Park",
    endTerminal: "Ellis Park",
    coordinates: [
      { lat: -26.2678, lng: 27.8585 },
      { lat: -26.2049, lng: 28.0588 }
    ],
    avgSpeed: 34,
    reliabilityScore: 0.81,
    demandScore: 0.89,
    peakHours: [6, 7, 8, 15, 16, 17],
    crowdLevel: "High",
    badge: "Most Popular",
    livePassengers: 840,
    estimatedDelay: 5,
    keywords: ["soweto", "ellis park", "rea vaya", "brt"]
  },
  {
    id: "rv-parktown",
    network: "Rea Vaya",
    code: "T2",
    name: "Parktown ↔ Thokoza Park",
    type: BUS_TYPE,
    status: "Operational",
    severity: "Operational",
    lastUpdated: NOW(),
    startTerminal: "Parktown",
    endTerminal: "Thokoza Park",
    coordinates: [
      { lat: -26.1829, lng: 28.0405 },
      { lat: -26.2678, lng: 27.8585 }
    ],
    avgSpeed: 36,
    reliabilityScore: 0.83,
    demandScore: 0.85,
    peakHours: [6, 7, 8, 16, 17],
    crowdLevel: "Medium",
    badge: "University Route",
    livePassengers: 720,
    estimatedDelay: 4,
    keywords: ["parktown", "soweto", "wits", "rea vaya"]
  },

  // ======================================================
  // 🚍 A RE YENG ROUTES
  // ======================================================
  {
    id: "ary-hatfield",
    network: "A Re Yeng",
    code: "L1",
    name: "Pretoria CBD ↔ Hatfield",
    type: BUS_TYPE,
    status: "Operational",
    severity: "Operational",
    lastUpdated: NOW(),
    startTerminal: "Pretoria CBD",
    endTerminal: "Hatfield",
    coordinates: [
      { lat: -25.7461, lng: 28.1881 },
      { lat: -25.7484, lng: 28.2316 }
    ],
    avgSpeed: 31,
    reliabilityScore: 0.84,
    demandScore: 0.78,
    peakHours: [6, 7, 8, 16, 17],
    crowdLevel: "Medium",
    badge: "Reliable",
    livePassengers: 620,
    estimatedDelay: 3,
    keywords: ["pretoria", "hatfield", "a re yeng", "bus"]
  },

  // ======================================================
  // 🚉 METRORAIL ROUTES
  // ======================================================
  {
    id: "mr-soweto",
    network: "Metrorail",
    code: "MR-SW",
    name: "Naledi ↔ Park Station",
    type: RAIL_TYPE,
    status: "Delayed",
    severity: "Moderate",
    lastUpdated: NOW(),
    startTerminal: "Naledi",
    endTerminal: "Park Station",
    coordinates: [
      { lat: -26.2678, lng: 27.8585 },
      { lat: -26.2041, lng: 28.0473 }
    ],
    avgSpeed: 42,
    reliabilityScore: 0.58,
    demandScore: 0.74,
    crowdLevel: "High",
    badge: "Budget Route",
    livePassengers: 1640,
    estimatedDelay: 11,
    keywords: ["metro", "soweto", "train", "park station"]
  },
  {
    id: "mr-pretoria",
    network: "Metrorail",
    code: "MR-PTA",
    name: "Pretoria ↔ Johannesburg",
    type: RAIL_TYPE,
    status: "Operational",
    severity: "Operational",
    lastUpdated: NOW(),
    startTerminal: "Pretoria",
    endTerminal: "Johannesburg",
    coordinates: [
      { lat: -25.7479, lng: 28.1881 },
      { lat: -26.2041, lng: 28.0473 }
    ],
    avgSpeed: 50,
    reliabilityScore: 0.65,
    demandScore: 0.72,
    peakHours: [6, 7, 8, 16, 17],
    crowdLevel: "High",
    badge: "Budget Intercity",
    livePassengers: 1850,
    estimatedDelay: 8,
    keywords: ["pretoria", "johannesburg", "metro", "train"]
  },

  // ======================================================
  // 🚖 TAXI ROUTES
  // ======================================================
  {
    id: "tx-cbd-soweto",
    network: "Taxi",
    code: "TX-SW",
    name: "Johannesburg CBD ↔ Soweto",
    type: TAXI_TYPE,
    status: "Operational",
    severity: "Operational",
    lastUpdated: NOW(),
    startTerminal: "Johannesburg CBD",
    endTerminal: "Soweto",
    coordinates: [
      { lat: -26.2041, lng: 28.0473 },
      { lat: -26.2678, lng: 27.8585 }
    ],
    avgSpeed: 45,
    reliabilityScore: 0.8,
    demandScore: 0.96,
    crowdLevel: "High",
    badge: "Most Flexible",
    livePassengers: 410,
    estimatedDelay: 1,
    keywords: ["taxi", "jhb", "soweto", "rank"]
  },
  {
    id: "tx-pta-mamelodi",
    network: "Taxi",
    code: "TX-MM",
    name: "Pretoria CBD ↔ Mamelodi",
    type: TAXI_TYPE,
    status: "Operational",
    severity: "Operational",
    lastUpdated: NOW(),
    startTerminal: "Pretoria CBD",
    endTerminal: "Mamelodi",
    coordinates: [
      { lat: -25.7461, lng: 28.1881 },
      { lat: -25.725, lng: 28.350 }
    ],
    avgSpeed: 47,
    reliabilityScore: 0.86,
    demandScore: 0.9,
    crowdLevel: "High",
    badge: "Always Available",
    livePassengers: 540,
    estimatedDelay: 2,
    keywords: ["pretoria", "mamelodi", "taxi"]
  },
  {
    id: "tx-midrand-sandton",
    network: "Taxi",
    code: "TX-MS",
    name: "Midrand ↔ Sandton",
    type: TAXI_TYPE,
    status: "Operational",
    severity: "Operational",
    lastUpdated: NOW(),
    startTerminal: "Midrand",
    endTerminal: "Sandton",
    coordinates: [
      { lat: -25.9994, lng: 28.1269 },
      { lat: -26.1076, lng: 28.0567 }
    ],
    avgSpeed: 50,
    reliabilityScore: 0.88,
    demandScore: 0.92,
    peakHours: [6, 7, 8, 16, 17, 18],
    crowdLevel: "High",
    badge: "Business Route",
    livePassengers: 680,
    estimatedDelay: 3,
    keywords: ["midrand", "sandton", "taxi"]
  }
];

// ======================================================
// 💰 BASE NETWORK RATES (PER KM)
// ======================================================

export const NETWORK_RATES: Record<TransitNetwork, number> = {
  Gautrain: 4.5,
  "Rea Vaya": 2.1,
  "A Re Yeng": 2.2,
  "Tshwane Bus Service": 1.8,
  Metrorail: 1.2,
  Taxi: 2.5
} as const;

// Network base fares (minimum)
export const NETWORK_BASE_FARES: Record<TransitNetwork, number> = {
  Gautrain: 35,
  "Rea Vaya": 11,
  "A Re Yeng": 10,
  "Tshwane Bus Service": 10,
  Metrorail: 10,
  Taxi: 12
} as const;

// ======================================================
// 🚖 TAXI CONFIG (ENHANCED)
// ======================================================

export const TAXI_CONFIG = {
  BASE_FARE: 12,
  PER_KM: 2.4,
  PEAK_MULTIPLIER: 1.25,
  NIGHT_MULTIPLIER: 1.15,
  MIN_FARE: 10,
  MAX_FARE: 150,
  EXTRA_PASSENGER_FEE: 5,
  LUGGAGE_FEE: 10
} as const;

// ======================================================
// 📡 LIVE STATUS CONFIG (ENHANCED)
// ======================================================

export const LIVE_STATUS = {
  OPERATIONAL: {
    label: "Operational",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    icon: "✅"
  },
  DELAYED: {
    label: "Delayed",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    icon: "⚠️"
  },
  DISRUPTED: {
    label: "Disrupted",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    icon: "❌"
  },
  PLANNED: {
    label: "Planned Maintenance",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    icon: "🔧"
  }
} as const;

// ======================================================
// 🧠 DETECTION CONFIG (ENHANCED)
// ======================================================

export const DETECTION_CONFIG = {
  // Speed thresholds (km/h)
  WALKING_MAX_SPEED: 6,
  RUNNING_MAX_SPEED: 12,
  CYCLING_MAX_SPEED: 30,
  VEHICLE_MIN_SPEED: 10,
  TAXI_MIN_SPEED: 20,
  TAXI_MAX_SPEED: 80,
  BUS_MIN_SPEED: 15,
  BUS_MAX_SPEED: 55,
  TRAIN_MIN_SPEED: 60,
  TRAIN_MAX_SPEED: 120,
  GAUTRAIN_MIN_SPEED: 70,
  
  // Route matching
  ROUTE_MATCH_RADIUS_KM: 0.35,
  STRONG_ROUTE_MATCH_KM: 0.12,
  
  // Stop detection
  STOP_SPEED_THRESHOLD: 4,
  STOP_DURATION_MS: 10000,
  
  // GPS filtering
  MIN_MOVEMENT_KM: 0.005,
  MAX_GPS_JUMP_KM: 0.5,
  GPS_DROPOUT_MS: 15000,
  
  // Confidence
  HIGH_CONFIDENCE: 0.8,
  MEDIUM_CONFIDENCE: 0.6,
  LOW_CONFIDENCE: 0.4
} as const;

// ======================================================
// 📡 PULSE CONFIG
// ======================================================

export const PULSE_CONFIG = {
  REPORT_TTL: 1000 * 60 * 60, // 1 hour
  MAX_REPORTS_PER_ROUTE: 50,
  WEIGHT_RECENCY: 0.6,
  WEIGHT_VOLUME: 0.4,
  AUTO_REFRESH_INTERVAL: 30000, // 30 seconds
  MAX_CACHE_SIZE: 100
} as const;

// ======================================================
// 🤖 AI CONFIG (ENHANCED)
// ======================================================

export const AI_CONFIG = {
  ROUTE_CONFIDENCE_THRESHOLD: 0.65,
  HABIT_CONFIDENCE_THRESHOLD: 0.6,
  MAX_PREDICTIONS: 3,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  ENABLE_GEMINI: true,
  ENABLE_LOCAL_FALLBACK: true
} as const;

// ======================================================
// ✨ QUICK DESTINATIONS (ENHANCED)
// ======================================================

export const QUICK_DESTINATIONS = [
  "Sandton",
  "Hatfield",
  "Park Station",
  "Rosebank",
  "Soweto",
  "Braamfontein",
  "Pretoria CBD",
  "Randburg",
  "Midrand",
  "OR Tambo Airport",
  "Centurion",
  "Fourways"
] as const;

// Destination categories
export const DESTINATION_CATEGORIES = {
  CBD: ["Sandton", "Pretoria CBD", "Braamfontein", "Rosebank", "Midrand"],
  Stations: ["Park Station", "Hatfield", "Centurion"],
  Airports: ["OR Tambo Airport"],
  Townships: ["Soweto", "Mamelodi"],
  Suburbs: ["Randburg", "Fourways"]
} as const;

// ======================================================
// 🌍 NETWORK ZONES (ENHANCED)
// ======================================================

export const NETWORK_ZONES = {
  Gautrain: ["Pretoria", "Johannesburg", "Centurion", "Sandton", "Midrand", "Hatfield", "Rosebank"],
  "A Re Yeng": ["Pretoria", "Tshwane", "Hatfield"],
  "Tshwane Bus Service": ["Pretoria", "Tshwane", "Centurion"],
  "Rea Vaya": ["Johannesburg", "Soweto", "Parktown", "Braamfontein"],
  Metrorail: ["Pretoria", "Johannesburg", "Soweto", "Mamelodi"],
  Taxi: ["Everywhere"]
} as const;

// ======================================================
// 🔔 NOTIFICATION TYPES
// ======================================================

export const NOTIFICATION_TYPES = {
  TRIP_STARTED: "trip_started",
  TRIP_ENDED: "trip_ended",
  TRIP_REMINDER: "trip_reminder",
  FARE_UPDATE: "fare_update",
  DELAY_ALERT: "delay_alert",
  HABIT_SUGGESTION: "habit_suggestion"
} as const;

// ======================================================
// 📊 ANALYTICS EVENTS
// ======================================================

export const ANALYTICS_EVENTS = {
  APP_OPEN: "app_open",
  TRIP_PLANNED: "trip_planned",
  TRIP_STARTED: "trip_started",
  TRIP_COMPLETED: "trip_completed",
  FARE_ESTIMATED: "fare_estimated",
  AI_QUERY: "ai_query",
  HABIT_LEARNED: "habit_learned"
} as const;

// ======================================================
// 🎨 UI CONSTANTS
// ======================================================

export const UI_CONSTANTS = {
  ANIMATION_DURATION: 300,
  DEBOUNCE_DELAY: 500,
  TOAST_DURATION: 3000,
  LOADING_TIMEOUT: 10000,
  MAX_RECENT_SEARCHES: 10,
  MAX_FAVORITES: 20
} as const;
