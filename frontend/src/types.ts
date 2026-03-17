// Trip State
export const TripState = {
  IDLE: "IDLE",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED"
} as const;

export type TripState = typeof TripState[keyof typeof TripState];


// Transit Networks (must match constants.ts exactly)
export const TransitNetwork = {
  Gautrain: "Gautrain",
  ReaVaya: "Rea Vaya",
  AReYeng: "A Re Yeng",
  TshwaneBusService: "Tshwane Bus Service",
  Metrorail: "Metrorail"
} as const;

export type TransitNetwork =
  typeof TransitNetwork[keyof typeof TransitNetwork];


// Route types used in ROUTE_REGISTRY
export type RouteType =
  | "Rail"
  | "Trunk"
  | "Feeder"
  | "Complementary";


// Network severity
export type Severity =
  | "Operational"
  | "Moderate"
  | "Severe";


// Pulse report types
export const ReportType = {
  Smooth: "Smooth",
  Delayed: "Delayed",
  Overcrowded: "Overcrowded",
  Breakdown: "Breakdown",
  SafetyIssue: "Safety Issue"
} as const;

export type ReportType =
  typeof ReportType[keyof typeof ReportType];


// Transit route structure (must match constants.ts)
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
}


// Trip data
export interface TripData {
  id: string;
  network: TransitNetwork;
  startTime: number;
  endTime?: number;
  distance: number;
  fare: number;
  startLocation?: {
    lat: number;
    lng: number;
  };
  endLocation?: {
    lat: number;
    lng: number;
  };
  aiFeedback?: string;
  isAnalyzing?: boolean;
}


// User profile
export interface UserProfile {
  email: string;
  name?: string;
}


// Privacy settings
export interface PrivacySettings {
  shareLocation: boolean;
  shareTrips: boolean;
}


// Travel statistics
export interface TravelStats {
  totalTrips: number;
  totalDistance: number;
  totalSpend: number;
}

export interface Location {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: number;
}

// Issue reports for commuter pulse
export interface IssueReport {
  id: string;
  network: TransitNetwork;
  routeCode?: string;
  type: ReportType;
  description?: string;
  timestamp: number;
  location?: {
    lat: number;
    lng: number;
  };
}