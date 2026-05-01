// ===============================
// 🧠 CORE ENUM-LIKE CONSTANTS
// ===============================

// ---------------- TRIP STATE ----------------
export const TripState = {
  IDLE: "IDLE",
  PLANNING: "PLANNING",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  VERIFIED: "VERIFIED"
} as const;

export type TripState =
  typeof TripState[keyof typeof TripState];


// ---------------- NAVIGATION ----------------
export const TabType = {
  home: "home",
  pulse: "pulse",
  stats: "stats",
  settings: "settings"
} as const;

export type TabType =
  typeof TabType[keyof typeof TabType];


// ---------------- TRANSIT NETWORKS ----------------
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
// 🚦 ROUTE SYSTEM
// ===============================
export type RouteType =
  | "Rail"
  | "Trunk"
  | "Feeder"
  | "Complementary"
  | "TaxiRoute";


// ===============================
// 🚨 SYSTEM HEALTH / STATUS
// ===============================
export type Severity =
  | "Operational"
  | "Moderate"
  | "Severe";


// ===============================
// 📡 CROWD REPORT TYPES (PULSE)
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
// 📍 LOCATION (SENSOR LAYER)
// ===============================
export interface Location {
  lat: number;
  lng: number;

  accuracy?: number;

  timestamp?: number;

  // 🔥 MOVEMENT INTELLIGENCE
  speed?: number;
  heading?: number;
}


// ===============================
// 🗺️ TRANSIT ROUTE (BASE MODEL)
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

  isDynamic?: boolean;
}


// ===============================
// 🧠 INTELLIGENT ROUTE (AI LAYER)
// ===============================
export interface IntelligentRoute extends TransitRoute {
  coordinates?: {
    lat: number;
    lng: number;
  }[];

  avgSpeed?: number;

  reliabilityScore?: number;

  peakHours?: number[];

  // 🔥 AI EXTENSIONS
  demandScore?: number;
  congestionLevel?: number;
  lastVerified?: number;
}


// ===============================
// 🚶‍♂️ TRANSPORT DETECTION ENGINE
// ===============================
export interface DetectionResult {
  mode: TransitNetwork | "Walking" | "Unknown";

  confidence: number;

  speed: number;

  matchedRoute?: string;

  stopFrequency?: number;
  accelerationPattern?: number;
}


// ===============================
// 🎯 PLANNED TRIP
// ===============================
export interface PlannedTrip {
  id: string;

  startLocation?: Location;

  destination: string;

  network: TransitNetwork;

  estimatedDistance?: number;

  estimatedDuration?: number;

  estimatedFare: number;

  createdAt: number;
}


// ===============================
// 🚕 TRIP DATA (CORE DOMAIN)
// ===============================
export interface TripData {
  id: string;

  network: TransitNetwork;

  // ---------------- TIMING ----------------
  startTime: number;

  endTime?: number;

  duration?: number;

  // ---------------- DISTANCE ----------------
  distance: number;

  // ---------------- FARE SYSTEM ----------------
  estimatedFare?: number;

  actualFare?: number;

  fare: number;

  fareAccuracy?: number;

  // ---------------- LOCATIONS ----------------
  startLocation?: Location;

  endLocation?: Location;

  // 🔥 PREMIUM ELITE BACKGROUND TRACKING
  lastTrackedLocation?: Location;

  destination?: string;

  matchedRoute?: string;

  // ---------------- MOVEMENT ----------------
  avgSpeed?: number;

  maxSpeed?: number;

  stopsDetected?: number;

  // ---------------- AI LAYER ----------------
  aiTransportGuess?: TransitNetwork;

  aiConfidence?: number;

  aiInsights?: string;

  // ---------------- BEHAVIOUR ----------------
  isRecurring?: boolean;

  tripPatternId?: string;

  // ---------------- UX ----------------
  isVerified?: boolean;

  needsVerification?: boolean;
}


// ===============================
// 📊 TRIP SUMMARY
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
// 👤 USER PROFILE
// ===============================
export interface UserProfile {
  email: string;

  name?: string;

  // 🔥 COMMUTER INTELLIGENCE
  homeArea?: string;

  workArea?: string;

  primaryTransport?: TransitNetwork;

  commuteStartTime?: string;

  commuteEndTime?: string;

  workDays?: number[];

  monthlyTransportBudget?: number;

  prefersCheapest?: boolean;

  prefersFastest?: boolean;
}


// ===============================
// 🔐 PRIVACY SETTINGS
// ===============================
export interface PrivacySettings {
  shareLocation: boolean;

  shareTrips: boolean;

  shareAnalytics?: boolean;

  acceptedTerms?: boolean;
}


// ===============================
// 📈 TRAVEL STATS
// ===============================
export interface TravelStats {
  totalTrips: number;

  totalDistance: number;

  totalSpend: number;

  avgCostPerKm?: number;

  avgTripDuration?: number;

  mostUsedNetwork?: TransitNetwork;

  // 🔥 INSIGHTS
  mostCommonRoute?: string;

  monthlySpend?: number;

  fareAccuracyAvg?: number;
}


// ===============================
// 📡 PULSE REPORT
// ===============================
export interface IssueReport {
  id: string;

  network: TransitNetwork;

  routeId?: string;

  routeCode?: string;

  type: ReportType;

  description?: string;

  timestamp: number;

  location?: Location;

  confidence?: number;

  // 🔥 SOCIAL SIGNALS
  upvotes?: number;

  downvotes?: number;
}


// ===============================
// 🧠 MOVEMENT META
// ===============================
export interface MovementMeta {
  speed: number;

  isMoving: boolean;

  isWalking: boolean;

  confidence: number;

  likelyTransport?: TransitNetwork | "Walking";
}