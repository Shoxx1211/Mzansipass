// src/types.ts

// ======================================================
// 🧠 CORE ENUM-LIKE CONSTANTS
// ======================================================

// ======================================================
// 🚦 TRIP STATE
// ======================================================
export const TripState = {
  IDLE: "IDLE",
  PLANNING: "PLANNING",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  VERIFIED: "VERIFIED"
} as const;

export type TripState =
  typeof TripState[keyof typeof TripState];

// ======================================================
// 🧭 NAVIGATION
// ======================================================
export const TabType = {
  home: "home",
  pulse: "pulse",
  stats: "stats",
  settings: "settings"
} as const;

export type TabType =
  typeof TabType[keyof typeof TabType];

// ======================================================
// 🚇 TRANSIT NETWORKS
// ======================================================
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

// ======================================================
// 🛣️ ROUTE TYPES
// ======================================================
export type RouteType =
  | "Rail"
  | "Trunk"
  | "Feeder"
  | "Complementary"
  | "TaxiRoute";

// ======================================================
// 🚨 STATUS SEVERITY
// ======================================================
export type Severity =
  | "Operational"
  | "Moderate"
  | "Severe";

// ======================================================
// 📡 REPORT TYPES
// ======================================================
export const ReportType = {
  Smooth: "Smooth",
  Delayed: "Delayed",
  Overcrowded: "Overcrowded",
  Breakdown: "Breakdown",
  SafetyIssue: "Safety Issue"
} as const;

export type ReportType =
  typeof ReportType[keyof typeof ReportType];

// ======================================================
// 📍 LOCATION
// ======================================================
export interface Location {
  lat: number;
  lng: number;

  accuracy?: number;

  timestamp?: number;

  speed?: number;

  heading?: number;
}

// ======================================================
// 🚏 TRANSPORT STOP
// ======================================================
export interface TransportStop {
  id: string;

  name: string;

  network: TransitNetwork;

  type:
    | "Station"
    | "TaxiRank"
    | "BusStop"
    | "FeederStop"
    | "Corridor";

  location: Location;

  routes?: string[];

  walkingDistance?: number;

  active?: boolean;

  reliabilityScore?: number;

  safetyScore?: number;

  popularityScore?: number;

  operatingHours?: string;
}

// ======================================================
// 🛣️ TRANSPORT CORRIDOR
// ======================================================
export interface TransportCorridor {
  id: string;

  name: string;

  network: TransitNetwork;

  coordinates: Location[];

  direction?: string;

  confidenceScore?: number;

  activeHours?: number[];
}

// ======================================================
// 🗺️ TRANSIT ROUTE
// ======================================================
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

// ======================================================
// 🧠 AI ROUTE
// ======================================================
export interface IntelligentRoute
  extends TransitRoute {

  coordinates?: {
    lat: number;
    lng: number;
  }[];

  avgSpeed?: number;

  reliabilityScore?: number;

  peakHours?: number[];

  demandScore?: number;

  congestionLevel?: number;

  lastVerified?: number;
}

// ======================================================
// 🚶 MOVEMENT DETECTION
// ======================================================
export interface DetectionResult {
  mode:
    | TransitNetwork
    | "Walking"
    | "Unknown";

  confidence: number;

  speed: number;

  matchedRoute?: string;

  stopFrequency?: number;

  accelerationPattern?: number;
}

// ======================================================
// 🎯 PLANNED TRIP
// ======================================================
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

// ======================================================
// 🚕 TRIP DATA
// ======================================================
export interface TripData {
  id: string;

  network: TransitNetwork;

  // --------------------------------------------------
  // TIMING
  // --------------------------------------------------
  startTime: number;

  endTime?: number;

  duration?: number;

  // --------------------------------------------------
  // DISTANCE
  // --------------------------------------------------
  distance: number;

  // --------------------------------------------------
  // FARES
  // --------------------------------------------------
  estimatedFare?: number;

  actualFare?: number;

  fare: number;

  fareAccuracy?: number;

  // --------------------------------------------------
  // LOCATION
  // --------------------------------------------------
  startLocation?: Location;

  endLocation?: Location;

  lastTrackedLocation?: Location;

  destination?: string;

  matchedRoute?: string;

  // --------------------------------------------------
  // MOVEMENT
  // --------------------------------------------------
  avgSpeed?: number;

  maxSpeed?: number;

  stopsDetected?: number;

  // --------------------------------------------------
  // AI
  // --------------------------------------------------
  aiTransportGuess?: TransitNetwork;

  aiConfidence?: number;

  aiInsights?: string;

  // --------------------------------------------------
  // BEHAVIOUR
  // --------------------------------------------------
  isRecurring?: boolean;

  tripPatternId?: string;

  // --------------------------------------------------
  // UX
  // --------------------------------------------------
  isVerified?: boolean;

  needsVerification?: boolean;
}

// ======================================================
// 📊 TRIP SUMMARY
// ======================================================
export interface TripSummary {
  fare: number;

  distance: number;

  duration: number;

  network:
    | TransitNetwork
    | string;

  route: string;

  confidence?: number;
}

// ======================================================
// 🧠 RECOMMENDATION BADGES
// ======================================================
export type RecommendationBadge =
  | "FASTEST"
  | "CHEAPEST"
  | "CLOSEST"
  | "RELIABLE"
  | "LEAST_WALKING"
  | "SAFEST"
  | "BEST_OVERALL";

// ======================================================
// 🚇 TRANSPORT RECOMMENDATION
// ======================================================
export interface TransportRecommendation {
  id: string;

  // --------------------------------------------------
  // CORE
  // --------------------------------------------------
  network: TransitNetwork;

  mode: TransitNetwork;

  routeName: string;

  routeType?: RouteType;

  stop?: TransportStop;

  // --------------------------------------------------
  // LOCATION
  // --------------------------------------------------
  pickupLocation?: Location;

  dropoffLocation?: Location;

  walkingDistance: number;

  // --------------------------------------------------
  // ESTIMATES
  // --------------------------------------------------
  estimatedFare: number;

  estimatedTime: number;

  estimatedDistance?: number;

  waitingTime?: number;

  // --------------------------------------------------
  // SCORING
  // --------------------------------------------------
  score: number;

  reliabilityScore?: number;

  safetyScore?: number;

  affordabilityScore?: number;

  speedScore?: number;

  walkingScore?: number;

  // --------------------------------------------------
  // UX
  // --------------------------------------------------
  badge: RecommendationBadge;

  reason: string;

  subtitle?: string;

  icon: string;

  color: string;

  // --------------------------------------------------
  // AI
  // --------------------------------------------------
  aiConfidence?: number;

  aiInsights?: string;

  recommended?: boolean;
}

// ======================================================
// 📍 DESTINATION SUGGESTION
// ======================================================
export interface DestinationSuggestion {
  id: string;

  title: string;

  subtitle?: string;

  latitude?: number;

  longitude?: number;

  category?:
    | "Area"
    | "Mall"
    | "Station"
    | "Landmark"
    | "Street"
    | "TaxiRank";
}

// ======================================================
// 👤 USER PROFILE
// ======================================================
export interface UserProfile {
  email: string;

  name?: string;

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

// ======================================================
// 🧠 COMMUTER PREFERENCES
// ======================================================
export interface CommuterPreferences {
  prefersCheapest?: boolean;

  prefersFastest?: boolean;

  prefersSafest?: boolean;

  prefersLeastWalking?: boolean;

  prefersReliable?: boolean;
}

// ======================================================
// 🔐 PRIVACY
// ======================================================
export interface PrivacySettings {
  shareLocation: boolean;

  shareTrips: boolean;

  shareAnalytics?: boolean;

  acceptedTerms?: boolean;
}

// ======================================================
// 📈 TRAVEL STATS
// ======================================================
export interface TravelStats {
  totalTrips: number;

  totalDistance: number;

  totalSpend: number;

  avgCostPerKm?: number;

  avgTripDuration?: number;

  mostUsedNetwork?: TransitNetwork;

  mostCommonRoute?: string;

  monthlySpend?: number;

  fareAccuracyAvg?: number;
}

// ======================================================
// 📡 ISSUE REPORT
// ======================================================
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

  upvotes?: number;

  downvotes?: number;
}

// ======================================================
// 🚦 LIVE TRANSPORT STATUS
// ======================================================
export interface LiveTransportStatus {
  network: TransitNetwork;

  operational: boolean;

  congestionLevel?: number;

  reliability?: number;

  averageDelay?: number;

  incidents?: number;

  updatedAt?: number;
}

// ======================================================
// 🧠 MOVEMENT META
// ======================================================
export interface MovementMeta {
  speed: number;

  isMoving: boolean;

  isWalking: boolean;

  confidence: number;

  likelyTransport?:
    | TransitNetwork
    | "Walking";
}