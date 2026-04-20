// ===============================
// TRIP STATE (STRICT + SAFE)
// ===============================
export const TripState = {
  IDLE: "IDLE",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED"
} as const;

export type TripState =
  typeof TripState[keyof typeof TripState];

// ===============================
// APP NAVIGATION TABS (🔥 REQUIRED)
// ===============================
export const TabType = {
  home: 'home',
  pulse: 'pulse',
  stats: 'stats',
  settings: 'settings'
} as const;

export type TabType =
  typeof TabType[keyof typeof TabType];
  
// ===============================
// TRANSIT NETWORKS (SINGLE SOURCE OF TRUTH)
// ⚠️ MUST MATCH constants.ts EXACTLY
// ===============================
export const TransitNetwork = {
  Taxi: "Taxi",
  Gautrain: "Gautrain",
  ReaVaya: "Rea Vaya",
  AReYeng: "A Re Yeng",
  TshwaneBusService: "Tshwane Bus Service",
  Metrorail: "Metrorail"
} as const;

export type TransitNetwork =
  typeof TransitNetwork[keyof typeof TransitNetwork];


// ===============================
// ROUTE TYPES
// ===============================
export type RouteType =
  | "Rail"
  | "Trunk"
  | "Feeder"
  | "Complementary"
  | "TaxiRoute";


// ===============================
// SEVERITY (SYSTEM HEALTH)
// ===============================
export type Severity =
  | "Operational"
  | "Moderate"
  | "Severe";


// ===============================
// PULSE REPORT TYPES
// ===============================
export const ReportType = {
  Smooth: "Smooth",
  Delayed: "Delayed",
  Overcrowded: "Overcrowded",
  Breakdown: "Breakdown",
  SafetyIssue: "Safety Issue"
} as const;

export type ReportType =
  typeof ReportType[keyof typeof ReportType];


// ===============================
// LOCATION (CORE SENSOR DATA)
// ===============================
export interface Location {
  lat: number;
  lng: number;

  accuracy?: number;     // meters
  timestamp?: number;    // ms

  // 🔥 derived / optional
  speed?: number;        // km/h
}


// ===============================
// TRANSIT ROUTE (BASE MODEL)
// ===============================
export interface TransitRoute {
  id: string;
  network: TransitNetwork;

  code: string;
  name: string;

  type: RouteType;

  status: string;
  severity: Severity;

  lastUpdated: number;

  startTerminal: string;
  endTerminal: string;

  estResolution?: string;

  // 🔥 dynamic systems (taxis, future routing)
  isDynamic?: boolean;
}


// ===============================
// EXTENDED ROUTE (INTELLIGENCE LAYER)
// ===============================
export interface IntelligentRoute extends TransitRoute {
  coordinates?: {
    lat: number;
    lng: number;
  }[];

  avgSpeed?: number;           // km/h
  reliabilityScore?: number;   // 0–1
  peakHours?: number[];        // 0–23
}


// ===============================
// TRANSPORT DETECTION RESULT
// ===============================
export interface DetectionResult {
  mode: TransitNetwork | "Walking" | "Unknown";
  confidence: number;

  speed: number;

  matchedRoute?: string;
}


// ===============================
// TRIP DATA (CORE DOMAIN OBJECT)
// ===============================
export interface TripData {
  id: string;

  network: TransitNetwork;

  startTime: number;
  endTime?: number;

  distance: number;     // km
  duration?: number;    // seconds

  fare: number;

  startLocation?: Location;
  endLocation?: Location;

  matchedRoute?: string;

  // 🔥 movement intelligence
  avgSpeed?: number;
  maxSpeed?: number;

  // 🔥 AI layer
  aiFeedback?: string;
  aiTransportGuess?: TransitNetwork;

  // 🔥 confidence scoring
  confidenceScore?: number;

  // 🔥 UI helpers
  isAnalyzing?: boolean;
}


// ===============================
// TRIP SUMMARY (ENGINE OUTPUT)
// ===============================
export interface TripSummary {
  fare: number;
  distance: number;
  duration: number;

  network: TransitNetwork | string;
  route: string;

  confidence?: number;
}


// ===============================
// USER PROFILE
// ===============================
export interface UserProfile {
  email: string;
  name?: string;
}


// ===============================
// PRIVACY SETTINGS
// ===============================
export interface PrivacySettings {
  shareLocation: boolean;
  shareTrips: boolean;
}


// ===============================
// TRAVEL STATS
// ===============================
export interface TravelStats {
  totalTrips: number;
  totalDistance: number;
  totalSpend: number;

  avgCostPerKm?: number;
  avgTripDuration?: number;
}


// ===============================
// PULSE REPORT (CROWD INTELLIGENCE)
// ===============================
export interface IssueReport {
  id: string;

  network: TransitNetwork;
  routeCode?: string;

  type: ReportType;
  description?: string;

  timestamp: number;

  location?: Location;

  confidence?: number;
}


// ===============================
// MOVEMENT META (LOCATION ENGINE)
// ===============================
export interface MovementMeta {
  speed: number;
  isMoving: boolean;
  isWalking: boolean;
  confidence: number;
}