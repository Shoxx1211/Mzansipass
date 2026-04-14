// ===============================
// TRIP STATE
// ===============================
export const TripState = {
  IDLE: "IDLE",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED"
} as const;

export type TripState =
  typeof TripState[keyof typeof TripState];


// ===============================
// TRANSIT NETWORKS
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
// SEVERITY
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

  accuracy?: number;
  timestamp?: number;

  // 🔥 CRITICAL FOR TRANSPORT ENGINE
  speed?: number; // km/h
}


// ===============================
// TRANSIT ROUTE
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

  // 🔥 TAXI + FUTURE DYNAMIC ROUTES
  isDynamic?: boolean;
}


// ===============================
// TRANSPORT DETECTION RESULT
// ===============================
export interface DetectionResult {
  mode: TransitNetwork | "Walking" | "Unknown";
  confidence: number;

  speed: number;

  // 🔥 KEY FOR FARE ENGINE
  matchedRoute?: string;
}


// ===============================
// TRIP DATA (CORE ENGINE)
// ===============================
export interface TripData {
  id: string;

  network: TransitNetwork;

  startTime: number;
  endTime?: number;

  distance: number; // km
  duration?: number; // seconds

  fare: number;

  startLocation?: Location;
  endLocation?: Location;

  // 🔥 ROUTE INTELLIGENCE
  matchedRoute?: string;

  // 🔥 SPEED INTELLIGENCE
  avgSpeed?: number;
  maxSpeed?: number;

  // 🔥 AI LAYER
  aiFeedback?: string;
  aiTransportGuess?: TransitNetwork;

  // 🔥 CONFIDENCE ENGINE
  confidenceScore?: number;

  // 🔥 UI / STATE
  isAnalyzing?: boolean;
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
// PULSE REPORT (CROWD DATA)
// ===============================
export interface IssueReport {
  id: string;

  network: TransitNetwork;
  routeCode?: string;

  type: ReportType;
  description?: string;

  timestamp: number;

  location?: Location;

  // 🔥 TRUST / CROWD RELIABILITY
  confidence?: number;
}