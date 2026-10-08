// src/types.ts
// Pulse Transit - Enterprise Type Definitions
// Version: 3.1.0 | Shared application types

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
  VERIFIED: "VERIFIED",
  PAUSED: "PAUSED"
} as const;

export type TripState = typeof TripState[keyof typeof TripState];

// ======================================================
// 🧭 NAVIGATION
// ======================================================
export const TabType = {
  home: "home",
  navigate: "navigate",
  pulse: "pulse",
  stats: "stats",
  settings: "settings"
} as const;

export type TabType = typeof TabType[keyof typeof TabType];

// ======================================================
// 🚇 TRANSIT NETWORKS
// ======================================================
export const TransitNetwork = {
  Taxi: "Taxi",
  Gautrain: "Gautrain",
  ReaVaya: "Rea Vaya",
  AReYeng: "A Re Yeng",
  TshwaneBusService: "Tshwane Bus Service",
  Metrorail: "Metrorail",
  Putco: "Putco"
} as const;

export type TransitNetwork = typeof TransitNetwork[keyof typeof TransitNetwork];

// Helper type guard for TransitNetwork
export const isTransitNetwork = (value: string): value is TransitNetwork => {
  return Object.values(TransitNetwork).includes(value as any);
};

// Network display names mapping
export const NetworkDisplayNames: Record<TransitNetwork, string> = {
  Taxi: "Minibus Taxi",
  Gautrain: "Gautrain Express",
  "Rea Vaya": "Rea Vaya BRT",
  "A Re Yeng": "A Re Yeng BRT",
  "Tshwane Bus Service": "Tshwane Bus Service",
  Metrorail: "PRASA Metrorail",
  Putco: "PUTCO"
};

// Network string values (for easy iteration when needed)
export const NETWORK_VALUES = Object.values(TransitNetwork) as readonly string[];

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
  | "Severe"
  | "Planned";

// ======================================================
// 📡 REPORT TYPES
// ======================================================
export const ReportType = {
  Smooth: "Smooth",
  Delayed: "Delayed",
  Overcrowded: "Overcrowded",
  Breakdown: "Breakdown",
  SafetyIssue: "Safety Issue",
  Accident: "Accident",
  RoadClosure: "Road Closure"
} as const;

export type ReportType = typeof ReportType[keyof typeof ReportType];

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
  altitude?: number;
  isBackground?: boolean;
}

// ======================================================
// 🚏 TRANSPORT STOP
// ======================================================
export interface TransportStop {
  id: string;
  name: string;
  network: TransitNetwork;
  type: "Station" | "TaxiRank" | "BusStop" | "FeederStop" | "Corridor";
  location: Location;
  routes?: string[];
  walkingDistance?: number;
  active?: boolean;
  reliabilityScore?: number;
  safetyScore?: number;
  popularityScore?: number;
  operatingHours?: string;
  amenities?: string[];
  wheelchairAccessible?: boolean;
  securityRating?: number;
  connectedNetworks?: TransitNetwork[];
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
  length?: number;
  estimatedTravelTime?: number;
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
  frequency?: number;
  firstDeparture?: string;
  lastDeparture?: string;
}

// ======================================================
// 🧠 AI ROUTE (Enhanced)
// ======================================================
export interface IntelligentRoute extends TransitRoute {
  coordinates?: { lat: number; lng: number }[];
  avgSpeed?: number;
  reliabilityScore?: number;
  peakHours?: number[];
  demandScore?: number;
  congestionLevel?: number;
  lastVerified?: number;
  crowdLevel?: "Low" | "Medium" | "High";
  livePassengers?: number;
  estimatedDelay?: number;
  badge?: string;
  keywords?: string[];
  fareOverride?: number;
}

// ======================================================
// 🚶 MOVEMENT DETECTION
// ======================================================
export interface DetectionResult {
  mode: TransitNetwork | "Walking" | "Running" | "Cycling" | "Unknown";
  confidence: number;
  speed: number;
  matchedRoute?: string;
  stopFrequency?: number;
  accelerationPattern?: number;
  isVehicular?: boolean;
  movementState?: "moving" | "idle";
  acceleration?: number;
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
  scheduledFor?: number;
  reminderSent?: boolean;
}

export interface TrackedJourneyLeg {
  id: string;
  label: string;
  mode: JourneyLeg["mode"];
  operator?: TransitNetwork;
  from?: string;
  to?: string;
  /** Advisory planning distance; not a confirmed taxi/rail route distance. */
  plannedDistanceKm?: number | null;
  distanceSource?: "road" | "straight" | "unknown";
  startDistanceKm: number;
  endDistanceKm?: number;
  startedAt: number;
  endedAt?: number;
  estimatedFare?: number | null;
  actualFare?: number | null;
  fareEstimateSource?: "learned" | "configured" | "published" | "unknown";
}

// ======================================================
// 🚕 TRIP DATA
// ======================================================
export interface TripData {
  id: string;
  network: TransitNetwork;
  startTime: number;
  endTime?: number;
  duration?: number;
  distance: number;
  estimatedFare?: number;
  actualFare?: number;
  fare: number;
  /** Recorded modal legs for the full door-to-door journey. */
  legs?: TrackedJourneyLeg[];
  fareAccuracy?: number;
  startLocation?: Location;
  endLocation?: Location;
  lastTrackedLocation?: Location;
  destination?: string;
  matchedRoute?: string;
  avgSpeed?: number;
  maxSpeed?: number;
  stopsDetected?: number;
  aiTransportGuess?: TransitNetwork;
  aiConfidence?: number;
  aiInsights?: string;
  isRecurring?: boolean;
  tripPatternId?: string;
  isVerified?: boolean;
  needsVerification?: boolean;
  carbonSaved?: number;
  caloriesBurned?: number;
  efficiency?: number;
  weather?: string;
  dayOfWeek?: number;
}

// ======================================================
// 📊 TRIP SUMMARY
// ======================================================
export interface TripSummary {
  fare: number;
  distance: number;
  duration: number;
  network: TransitNetwork | string;
  route: string;
  confidence?: number;
  carbonSaved?: number;
  caloriesBurned?: number;
  efficiency?: number;
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
  | "BEST_OVERALL"
  | "ECO_FRIENDLY";

// ======================================================
// 🚇 TRANSPORT RECOMMENDATION
// ======================================================
export interface JourneyLeg {
  id: string;
  mode: "walk" | "taxi" | "bus" | "rail";
  label: string;
  operator?: TransitNetwork;
  from?: string;
  to?: string;
  distanceKm?: number | null;
  fromLocation?: Location;
  toLocation?: Location;
  distanceSource?: "road" | "straight" | "unknown";
  fare?: number | null;
  fareStatus?: "verified" | "estimated" | "unverified";
  evidence?: "published" | "official-gis" | "road-access" | "estimated";
}

export interface TransportRecommendation {
  id: string;
  mode: TransitNetwork;

    /**
   * Indicates how defensible the fare information is.
   */
  fareStatus?:
    | "verified"
    | "configured"
    | "learned"
    | "estimated"
    | "unverified";

  /**
   * Whether Pulse currently allows this recommendation
   * to be selected for an actual tracked trip.
   */
  selectable?: boolean;

  /** Internal ranking score. It is not a safety or reliability percentage. */
  score: number;

  /** Estimated fare in ZAR from configured or learned fare data. */
  estimatedFare: number | null;

  /** Estimated end-to-end journey time in minutes. */
  estimatedTime: number | null;

  /** Legacy-compatible alias for estimatedTime. */
  estimatedTravelTime: number | null;

  /** Total access + egress walking distance in kilometres. */
  walkingDistance: number;

  /** Approximate distance travelled on the recommended network in kilometres. */
  serviceDistanceKm?: number;

  nearestStop?: string;
  destinationStop?: string;
  routeName?: string;
  subtitle?: string;

  reason: string;
  badges: string[];
  color: string;

  /** Confidence in route fit based on the configured network dataset. */
  confidence: number;
  dataQuality?: "verified" | "configured" | "limited" | "learned";
  direct?: boolean;

  alternativeStops?: string[];
  peakSurcharge?: number;

  /* Legacy optional fields retained so older components keep compiling. */
  reliabilityScore?: number;
  affordabilityScore?: number;
  speedScore?: number;

  routeCodes?: string[];
  transferStops?: string[];
  journeyLegs?: JourneyLeg[];
  /** Broad illustrative price guidance, not a published fare. */
  fareEstimateRange?: {
    minimum: number;
    maximum: number;
    basis:
      | "provisional-taxi"
      | "observed"
      | "operator-estimate"
      | "published-range";
  };
  publishedFareRange?: {
    currency: string;
    minimum: number;
    maximum: number;
    period: "peak" | "offPeak";
  };
  timeStatus?: "verified" | "estimated" | "unverified";
  evidenceStatus?:
    | "same-canonical-route"
    | "published-shared-stop-connectivity"
    | "published-service-membership"
    | "official-gis-route"
    | "multi-operator-published-connection"
    | "multi-operator-official-gis-connection"
    | "published-service-area"
    | "road-baseline"
    | "insufficient-evidence"
    | "configured";
};

// ======================================================
// 📍 DESTINATION SUGGESTION
// ======================================================
export interface DestinationSuggestion {
  id: string;
  title: string;
  subtitle?: string;
  latitude?: number;
  longitude?: number;
  category?: "Area" | "Mall" | "Station" | "Landmark" | "Street" | "TaxiRank" | "Airport" | "Hospital";
  popularity?: number;
  icon?: string;
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
  avatar?: string;
  joinDate?: number;
  lastActive?: number;
  totalTrips?: number;
  totalSpend?: number;
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
  prefersEcoFriendly?: boolean;
  maxWalkingDistance?: number;
  wheelchairUser?: boolean;
}

// ======================================================
// 🔐 PRIVACY
// ======================================================
export interface PrivacySettings {
  shareLocation: boolean;
  shareTrips: boolean;
  shareAnalytics?: boolean;
  acceptedTerms?: boolean;
  acceptedTermsVersion?: string;
  dataRetentionDays?: number;
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
  totalCarbonSaved?: number;
  totalCaloriesBurned?: number;
  averageEfficiency?: number;
  bestDayOfWeek?: string;
  bestTimeOfDay?: string;
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
  resolved?: boolean;
  resolvedAt?: number;
  severity?: "low" | "medium" | "high";
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
  lastVehicle?: number;
  nextVehicle?: number;
  crowdLevel?: "low" | "medium" | "high" | "severe";
}

// ======================================================
// 🧠 MOVEMENT META
// ======================================================
export interface MovementMeta {
  speed: number;
  isMoving: boolean;
  isWalking: boolean;
  confidence: number;
  likelyTransport?: TransitNetwork | "Walking" | "Running" | "Cycling";
  isStale?: boolean;
  source?: "gps" | "network" | "cache";
  accuracy?: number;
}

// ======================================================
// 🧠 HABIT PREDICTION
// ======================================================
export interface HabitPrediction {
  network: TransitNetwork | null;
  startCluster?: string;
  endCluster?: string;
  confidence: number;
  alternativeNetworks?: Array<{ network: TransitNetwork; confidence: number }>;
  estimatedDeparture?: string;
  estimatedArrival?: string;
}

// ======================================================
// 🧠 FARE ESTIMATE RESULT
// ======================================================
export interface FareEstimateResult {
  fare: number;
  originalFare?: number;
  confidence: number;
  source: "configured" | "learned" | "cached";
  breakdown?: {
    baseFare: number;
    distanceCharge: number;
    peakSurcharge: number;
    nightSurcharge: number;
    weekendDiscount: number;
    total: number;
  };
  surgeMultiplier?: number;
}

// ======================================================
// 🧠 ROUTE ESTIMATE RESULT
// ======================================================
export interface RouteEstimateResult {
  distance: number;
  duration: number;
  method: "api" | "route" | "straight" | "cached";
  confidence: number;
  routeIds?: string[];
}

// ======================================================
// 🧠 GEMINI CHAT MESSAGE
// ======================================================
export interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: number;
  isTyping?: boolean;
}

// ======================================================
// 🧠 OFFLINE TRIP
// ======================================================
export interface OfflineTrip {
  trip: Partial<TripData>;
  timestamp: number;
  synced: boolean;
}