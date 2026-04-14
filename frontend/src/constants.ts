import type { TransitNetwork, TransitRoute, RouteType } from './types';

// ===============================
// NETWORKS (SOURCE OF TRUTH)
// ===============================
export const TRANSIT_NETWORKS: TransitNetwork[] = [
  'Gautrain',
  'Rea Vaya',
  'A Re Yeng',
  'Tshwane Bus Service',
  'Metrorail',
  'Taxi'
];

// ===============================
// ROUTE TYPES
// ===============================
const TAXI_TYPE: RouteType = 'Complementary';

// ===============================
// GEO TYPES (NEW 🔥)
// ===============================
export type GeoPoint = {
  lat: number;
  lng: number;
};

// ===============================
// EXTENDED ROUTE TYPE (ELITE)
// ===============================
export type IntelligentRoute = TransitRoute & {
  coordinates?: GeoPoint[];   // 🔥 corridor path
  avgSpeed?: number;          // km/h (AI inference)
  reliabilityScore?: number;  // 0–1 (crowd + AI)
  peakHours?: number[];       // hours (0–23)
};

// ===============================
// ROUTE REGISTRY (AI READY)
// ===============================
export const ROUTE_REGISTRY: IntelligentRoute[] = [

  // 🚆 GAUTRAIN
  {
    id: 'gt-ns',
    network: 'Gautrain',
    code: 'NS',
    name: 'North-South Rail',
    type: 'Rail',
    status: 'Operational',
    severity: 'Operational',
    lastUpdated: Date.now(),
    startTerminal: 'Hatfield',
    endTerminal: 'Park Station',

    coordinates: [
      { lat: -25.7479, lng: 28.2293 }, // Hatfield
      { lat: -26.2041, lng: 28.0473 }  // Park Station
    ],
    avgSpeed: 80,
    reliabilityScore: 0.95,
    peakHours: [6,7,8,16,17,18]
  },
  {
    id: 'gt-h3',
    network: 'Gautrain',
    code: 'H3',
    name: 'Arcadia Feeder',
    type: 'Feeder',
    status: 'Operational',
    severity: 'Operational',
    lastUpdated: Date.now(),
    startTerminal: 'Hatfield Station',
    endTerminal: 'Arcadia',

    coordinates: [
      { lat: -25.7479, lng: 28.2293 },
      { lat: -25.7390, lng: 28.2100 }
    ],
    avgSpeed: 40,
    reliabilityScore: 0.9
  },

  // 🚌 REA VAYA
  {
    id: 'rv-t1',
    network: 'Rea Vaya',
    code: 'T1',
    name: 'Soweto Trunk',
    type: 'Trunk',
    status: 'Delayed',
    severity: 'Moderate',
    lastUpdated: Date.now(),
    estResolution: '15m',
    startTerminal: 'Thokoza Park',
    endTerminal: 'Ellis Park',

    coordinates: [
      { lat: -26.267, lng: 27.858 },
      { lat: -26.204, lng: 28.047 }
    ],
    avgSpeed: 35,
    reliabilityScore: 0.75,
    peakHours: [6,7,8,15,16,17]
  },
  {
    id: 'rv-c1',
    network: 'Rea Vaya',
    code: 'C1',
    name: 'Dobsonville Complementary',
    type: 'Complementary',
    status: 'Operational',
    severity: 'Operational',
    lastUpdated: Date.now(),
    startTerminal: 'Dobsonville',
    endTerminal: 'CBD',

    coordinates: [
      { lat: -26.260, lng: 27.850 },
      { lat: -26.204, lng: 28.047 }
    ],
    avgSpeed: 30,
    reliabilityScore: 0.8
  },

  // 🚌 A RE YENG
  {
    id: 'ary-t1',
    network: 'A Re Yeng',
    code: 'L1',
    name: 'Pretoria Trunk',
    type: 'Trunk',
    status: 'Operational',
    severity: 'Operational',
    lastUpdated: Date.now(),
    startTerminal: 'CBD',
    endTerminal: 'Hatfield',

    coordinates: [
      { lat: -25.746, lng: 28.188 },
      { lat: -25.7479, lng: 28.2293 }
    ],
    avgSpeed: 35,
    reliabilityScore: 0.85
  },
  {
    id: 'ary-f1',
    network: 'A Re Yeng',
    code: 'F1',
    name: 'Hatfield Loop',
    type: 'Feeder',
    status: 'Operational',
    severity: 'Operational',
    lastUpdated: Date.now(),
    startTerminal: 'Hatfield',
    endTerminal: 'Hatfield',

    coordinates: [
      { lat: -25.7479, lng: 28.2293 }
    ],
    avgSpeed: 25,
    reliabilityScore: 0.9
  },

  // 🚆 METRORAIL
  {
    id: 'mr-soweto',
    network: 'Metrorail',
    code: 'SOW',
    name: 'Soweto Line',
    type: 'Rail',
    status: 'Disrupted',
    severity: 'Severe',
    lastUpdated: Date.now(),
    startTerminal: 'Naledi',
    endTerminal: 'Park Station',

    coordinates: [
      { lat: -26.267, lng: 27.858 },
      { lat: -26.204, lng: 28.047 }
    ],
    avgSpeed: 50,
    reliabilityScore: 0.5
  },

  // 🚖 TAXI CORRIDORS (🔥 CORE DIFFERENTIATOR)
  {
    id: 'tx-cbd-randburg',
    network: 'Taxi',
    code: 'RB',
    name: 'CBD ↔ Randburg',
    type: TAXI_TYPE,
    status: 'Operational',
    severity: 'Operational',
    lastUpdated: Date.now(),
    startTerminal: 'Bree Rank',
    endTerminal: 'Randburg Rank',

    coordinates: [
      { lat: -26.204, lng: 28.047 },
      { lat: -26.093, lng: 27.998 }
    ],
    avgSpeed: 45,
    reliabilityScore: 0.85,
    peakHours: [6,7,8,16,17,18]
  },
  {
    id: 'tx-cbd-soweto',
    network: 'Taxi',
    code: 'SW',
    name: 'CBD ↔ Soweto',
    type: TAXI_TYPE,
    status: 'Operational',
    severity: 'Moderate',
    lastUpdated: Date.now(),
    startTerminal: 'Bree Rank',
    endTerminal: 'Soweto',

    coordinates: [
      { lat: -26.204, lng: 28.047 },
      { lat: -26.267, lng: 27.858 }
    ],
    avgSpeed: 40,
    reliabilityScore: 0.8
  },
  {
    id: 'tx-pta-mamelodi',
    network: 'Taxi',
    code: 'MM',
    name: 'Pretoria CBD ↔ Mamelodi',
    type: TAXI_TYPE,
    status: 'Operational',
    severity: 'Operational',
    lastUpdated: Date.now(),
    startTerminal: 'Pretoria Rank',
    endTerminal: 'Mamelodi',

    coordinates: [
      { lat: -25.746, lng: 28.188 },
      { lat: -25.725, lng: 28.350 }
    ],
    avgSpeed: 45,
    reliabilityScore: 0.85
  }
];

// ===============================
// NETWORK RATES
// ===============================
export const NETWORK_RATES: Record<TransitNetwork, number> = {
  Gautrain: 4.5,
  'Rea Vaya': 2.1,
  'A Re Yeng': 2.2,
  'Tshwane Bus Service': 1.8,
  Metrorail: 1.2,
  Taxi: 2.5
};

// ===============================
// TAXI INTELLIGENCE CONFIG
// ===============================
export const TAXI_CONFIG = {
  baseFare: 12,
  perKm: 2.5,
  peakMultiplier: 1.2,
  offPeakMultiplier: 1.0
};

// ===============================
// AI THRESHOLDS (🔥 NEW)
// ===============================
export const DETECTION_CONFIG = {
  WALKING_MAX_SPEED: 6,
  TAXI_MIN_SPEED: 20,
  BUS_RANGE: [15, 40],
  TRAIN_MIN_SPEED: 50,
  ROUTE_MATCH_RADIUS_KM: 0.5
};