// src/data/transportZones.ts
// Pulse Transit - Configured Transport Network Seed Data
//
// IMPORTANT: this file is development/planning data, not a live operator feed.
// Route recommendations must treat these stops and fare tables as configured
// seed data until each network dataset is independently verified.

import type { TransitNetwork } from "../types";

// ======================================================
// TYPES
// ======================================================

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface OperatingHours {
  weekday: { start: string; end: string };
  saturday: { start: string; end: string };
  sunday: { start: string; end: string };
  publicHoliday: { start: string; end: string };
}

export interface FareZone {
  id: string;
  name: string;
  fromDistance: number;
  toDistance: number;
  peakFare: number;
  offPeakFare: number;
}

export interface TransportStop {
  id: string;
  name: string;
  location: Coordinate;
  type: "station" | "stop" | "rank" | "corridor" | "transfer";
  amenities?: string[];
  wheelchairAccessible?: boolean;
  securityRating?: number; // 1-5
  connectedNetworks?: string[]; // For transfer points
}

export interface TransportNetworkZone {
  id: string;
  name: string;
  canonicalNetwork: TransitNetwork;
  city: string;
  enabled: boolean;
  dataStatus: "seed" | "verified";
  coverageRadiusKm: number;
  maxDirectAccessKm: number;
  maxDirectEgressKm: number;
  center: Coordinate;
  stops: TransportStop[];
  fareZones?: FareZone[];
  operatingHours?: OperatingHours;
  realTimeApi?: string;
  averageFrequency?: {
    peak: number; // minutes
    offPeak: number; // minutes
  };
  strengths: {
    cheapest: boolean;
    fastest: boolean;
    safest: boolean;
    reliable: boolean;
    leastWalking: boolean;
  };
  alerts?: {
    type: "delay" | "disruption" | "maintenance" | "normal";
    message: string;
    timestamp: number;
  }[];
}

// ======================================================
// OPERATING HOURS
// ======================================================

const DEFAULT_OPERATING_HOURS: OperatingHours = {
  weekday: { start: "05:00", end: "20:00" },
  saturday: { start: "06:00", end: "19:00" },
  sunday: { start: "07:00", end: "18:00" },
  publicHoliday: { start: "07:00", end: "18:00" }
};

const GAUTRAIN_HOURS: OperatingHours = {
  weekday: { start: "05:30", end: "20:30" },
  saturday: { start: "06:00", end: "20:30" },
  sunday: { start: "06:00", end: "20:30" },
  publicHoliday: { start: "06:00", end: "20:30" }
};

// ======================================================
// FARE ZONES
// ======================================================

export const GAUTRAIN_FARE_ZONES: FareZone[] = [
  { id: "zone1", name: "Zone 1", fromDistance: 0, toDistance: 10, peakFare: 35, offPeakFare: 25 },
  { id: "zone2", name: "Zone 2", fromDistance: 10, toDistance: 20, peakFare: 55, offPeakFare: 40 },
  { id: "zone3", name: "Zone 3", fromDistance: 20, toDistance: 35, peakFare: 85, offPeakFare: 65 },
  { id: "zone4", name: "Zone 4", fromDistance: 35, toDistance: 50, peakFare: 120, offPeakFare: 90 },
  { id: "zone5", name: "Zone 5", fromDistance: 50, toDistance: 80, peakFare: 175, offPeakFare: 130 }
];

export const TAXI_FARE_ZONES: FareZone[] = [
  { id: "short", name: "Short Trip", fromDistance: 0, toDistance: 10, peakFare: 15, offPeakFare: 12 },
  { id: "medium", name: "Medium Trip", fromDistance: 10, toDistance: 25, peakFare: 30, offPeakFare: 25 },
  { id: "long", name: "Long Trip", fromDistance: 25, toDistance: 50, peakFare: 50, offPeakFare: 40 },
  { id: "extended", name: "Extended Trip", fromDistance: 50, toDistance: 100, peakFare: 80, offPeakFare: 65 }
];

// ======================================================
// JOHANNESBURG - REA VAYA
// ======================================================

export const REA_VAYA_ZONE: TransportNetworkZone = {
  id: "rea-vaya",
  name: "Rea Vaya",
  canonicalNetwork: "Rea Vaya",
  city: "Johannesburg",
  enabled: true,
  dataStatus: "seed",
  coverageRadiusKm: 35,
  maxDirectAccessKm: 1.5,
  maxDirectEgressKm: 1.5,
  center: { lat: -26.2041, lng: 28.0473 },
  
  operatingHours: DEFAULT_OPERATING_HOURS,
  averageFrequency: { peak: 10, offPeak: 20 },
  
  fareZones: [
    { id: "rv_zone1", name: "Local", fromDistance: 0, toDistance: 15, peakFare: 12, offPeakFare: 9 },
    { id: "rv_zone2", name: "Regional", fromDistance: 15, toDistance: 35, peakFare: 22, offPeakFare: 17 }
  ],

  stops: [
    {
      id: "rv_thokoza_park",
      name: "Thokoza Park Station",
      type: "station",
      location: { lat: -26.2346, lng: 27.9068 },
      amenities: ["shelter", "lighting", "seating"],
      wheelchairAccessible: true,
      securityRating: 4
    },
    {
      id: "rv_parktown",
      name: "Parktown Station",
      type: "station",
      location: { lat: -26.1829, lng: 28.0405 },
      amenities: ["shelter", "lighting", "seating", "ticket-office"],
      wheelchairAccessible: true,
      securityRating: 4,
      connectedNetworks: ["taxi", "metrorail"]
    },
    {
      id: "rv_ellis_park",
      name: "Ellis Park Station",
      type: "station",
      location: { lat: -26.2049, lng: 28.0588 },
      amenities: ["shelter", "lighting"],
      wheelchairAccessible: true,
      securityRating: 3
    },
    {
      id: "rv_braamfontein",
      name: "Braamfontein Stop",
      type: "stop",
      location: { lat: -26.1921, lng: 28.0379 },
      amenities: ["shelter"],
      wheelchairAccessible: true,
      securityRating: 3,
      connectedNetworks: ["taxi", "gautrain"]
    },
    {
      id: "rv_uj_soweto",
      name: "UJ Soweto Stop",
      type: "stop",
      location: { lat: -26.2601, lng: 27.8542 },
      amenities: ["shelter"],
      wheelchairAccessible: false,
      securityRating: 3
    },
    {
      id: "rv_empire_corridor",
      name: "Empire Road Corridor",
      type: "corridor",
      location: { lat: -26.1818, lng: 28.0245 },
      amenities: ["lighting"],
      wheelchairAccessible: true,
      securityRating: 3
    }
  ],

  strengths: {
    cheapest: true,
    fastest: true,
    safest: true,
    reliable: true,
    leastWalking: false
  }
};

// ======================================================
// GAUTRAIN
// ======================================================

export const GAUTRAIN_ZONE: TransportNetworkZone = {
  id: "gautrain",
  name: "Gautrain",
  canonicalNetwork: "Gautrain",
  city: "Gauteng",
  enabled: true,
  dataStatus: "seed",
  coverageRadiusKm: 80,
  maxDirectAccessKm: 3,
  maxDirectEgressKm: 3,
  center: { lat: -26.1367, lng: 28.2411 },
  
  operatingHours: GAUTRAIN_HOURS,
  averageFrequency: { peak: 10, offPeak: 20 },
  fareZones: GAUTRAIN_FARE_ZONES,

  stops: [
    {
      id: "gt_park",
      name: "Park Station",
      type: "station",
      location: { lat: -26.2048, lng: 28.0436 },
      amenities: ["parking", "ticket-office", "restrooms", "shops", "elevators"],
      wheelchairAccessible: true,
      securityRating: 5,
      connectedNetworks: ["taxi", "metrorail", "rea-vaya"]
    },
    {
      id: "gt_sandton",
      name: "Sandton Station",
      type: "station",
      location: { lat: -26.1076, lng: 28.0567 },
      amenities: ["parking", "ticket-office", "restrooms", "shops", "elevators", "food-court"],
      wheelchairAccessible: true,
      securityRating: 5,
      connectedNetworks: ["taxi", "bus"]
    },
    {
      id: "gt_midrand",
      name: "Midrand Station",
      type: "station",
      location: { lat: -25.9994, lng: 28.1269 },
      amenities: ["parking", "ticket-office", "restrooms", "elevators"],
      wheelchairAccessible: true,
      securityRating: 4,
      connectedNetworks: ["taxi"]
    },
    {
      id: "gt_pretoria",
      name: "Pretoria Station",
      type: "station",
      location: { lat: -25.7479, lng: 28.1881 },
      amenities: ["parking", "ticket-office", "restrooms", "shops", "elevators"],
      wheelchairAccessible: true,
      securityRating: 4,
      connectedNetworks: ["taxi", "metrorail", "a-re-yeng"]
    },
    {
      id: "gt_or_tambo",
      name: "OR Tambo Station",
      type: "station",
      location: { lat: -26.1337, lng: 28.2420 },
      amenities: ["parking", "ticket-office", "restrooms", "shops", "elevators", "airport-link"],
      wheelchairAccessible: true,
      securityRating: 5,
      connectedNetworks: ["taxi", "bus"]
    },
    {
      id: "gt_rosebank",
      name: "Rosebank Station",
      type: "station",
      location: { lat: -26.1464, lng: 28.0428 },
      amenities: ["ticket-office", "restrooms", "shops", "elevators"],
      wheelchairAccessible: true,
      securityRating: 5,
      connectedNetworks: ["taxi", "bus"]
    }
  ],

  strengths: {
    cheapest: false,
    fastest: true,
    safest: true,
    reliable: true,
    leastWalking: true
  }
};

// ======================================================
// PRETORIA - A RE YENG
// ======================================================

export const A_RE_YENG_ZONE: TransportNetworkZone = {
  id: "a-re-yeng",
  name: "A Re Yeng",
  canonicalNetwork: "A Re Yeng",
  city: "Pretoria",
  enabled: true,
  dataStatus: "seed",
  coverageRadiusKm: 30,
  maxDirectAccessKm: 1.5,
  maxDirectEgressKm: 1.5,
  center: { lat: -25.7479, lng: 28.2293 },
  
  operatingHours: DEFAULT_OPERATING_HOURS,
  averageFrequency: { peak: 15, offPeak: 30 },
  
  fareZones: [
    { id: "ary_zone1", name: "Local", fromDistance: 0, toDistance: 15, peakFare: 10, offPeakFare: 8 },
    { id: "ary_zone2", name: "Regional", fromDistance: 15, toDistance: 30, peakFare: 18, offPeakFare: 14 }
  ],

  stops: [
    {
      id: "ary_church_square",
      name: "Church Square Station",
      type: "station",
      location: { lat: -25.7461, lng: 28.1881 },
      amenities: ["shelter", "lighting", "seating", "ticket-office"],
      wheelchairAccessible: true,
      securityRating: 4,
      connectedNetworks: ["taxi", "gautrain"]
    },
    {
      id: "ary_hatfield",
      name: "Hatfield Stop",
      type: "stop",
      location: { lat: -25.7484, lng: 28.2316 },
      amenities: ["shelter", "lighting"],
      wheelchairAccessible: true,
      securityRating: 4,
      connectedNetworks: ["gautrain"]
    }
  ],

  strengths: {
    cheapest: true,
    fastest: true,
    safest: true,
    reliable: true,
    leastWalking: false
  }
};

// ======================================================
// METRORAIL (NEW - CRITICAL ADDITION)
// ======================================================

export const METRORAIL_ZONE: TransportNetworkZone = {
  id: "metrorail",
  name: "Metrorail",
  canonicalNetwork: "Metrorail",
  city: "Gauteng",
  enabled: true,
  dataStatus: "seed",
  coverageRadiusKm: 100,
  maxDirectAccessKm: 2.5,
  maxDirectEgressKm: 2.5,
  center: { lat: -26.2041, lng: 28.0473 },
  
  operatingHours: {
    weekday: { start: "04:00", end: "20:00" },
    saturday: { start: "05:00", end: "19:00" },
    sunday: { start: "06:00", end: "18:00" },
    publicHoliday: { start: "06:00", end: "18:00" }
  },
  averageFrequency: { peak: 30, offPeak: 60 },
  
  fareZones: [
    { id: "metro_zone1", name: "Local", fromDistance: 0, toDistance: 20, peakFare: 12, offPeakFare: 9 },
    { id: "metro_zone2", name: "Regional", fromDistance: 20, toDistance: 50, peakFare: 22, offPeakFare: 17 },
    { id: "metro_zone3", name: "Long Distance", fromDistance: 50, toDistance: 100, peakFare: 35, offPeakFare: 28 }
  ],

  stops: [
    {
      id: "metro_park",
      name: "Park Station",
      type: "station",
      location: { lat: -26.2048, lng: 28.0436 },
      amenities: ["ticket-office", "shelter"],
      wheelchairAccessible: false,
      securityRating: 3,
      connectedNetworks: ["gautrain", "taxi", "rea-vaya"]
    },
    {
      id: "metro_soweto",
      name: "Soweto Station",
      type: "station",
      location: { lat: -26.2608, lng: 27.9426 },
      amenities: ["shelter"],
      wheelchairAccessible: false,
      securityRating: 2,
      connectedNetworks: ["taxi"]
    },
    {
      id: "metro_pretoria",
      name: "Pretoria Station",
      type: "station",
      location: { lat: -25.7479, lng: 28.1881 },
      amenities: ["ticket-office", "shelter"],
      wheelchairAccessible: false,
      securityRating: 3,
      connectedNetworks: ["gautrain", "taxi", "a-re-yeng"]
    }
  ],

  strengths: {
    cheapest: true,
    fastest: false,
    safest: false,
    reliable: false,
    leastWalking: false
  }
};

// ======================================================
// TAXI NETWORK (ENHANCED)
// ======================================================

export const TAXI_ZONE: TransportNetworkZone = {
  id: "taxi",
  name: "Minibus Taxi",
  canonicalNetwork: "Taxi",
  city: "South Africa",
  enabled: true,
  dataStatus: "seed",
  coverageRadiusKm: 999,
  maxDirectAccessKm: 3,
  maxDirectEgressKm: 3,
  center: { lat: -26.2041, lng: 28.0473 },
  
  operatingHours: {
    weekday: { start: "04:00", end: "22:00" },
    saturday: { start: "04:00", end: "22:00" },
    sunday: { start: "05:00", end: "21:00" },
    publicHoliday: { start: "05:00", end: "21:00" }
  },
  
  fareZones: TAXI_FARE_ZONES,

  stops: [
    {
      id: "taxi_bara",
      name: "Bara Taxi Rank",
      type: "rank",
      location: { lat: -26.2608, lng: 27.9426 },
      amenities: ["shelter", "seating", "food-vendors"],
      wheelchairAccessible: false,
      securityRating: 3,
      connectedNetworks: ["rea-vaya", "metrorail"]
    },
    {
      id: "taxi_noord",
      name: "Noord Taxi Rank",
      type: "rank",
      location: { lat: -26.1951, lng: 28.0403 },
      amenities: ["shelter", "seating", "food-vendors", "ticket-office"],
      wheelchairAccessible: false,
      securityRating: 3,
      connectedNetworks: ["gautrain"]
    },
    {
      id: "taxi_louis_botha",
      name: "Louis Botha Corridor",
      type: "corridor",
      location: { lat: -26.1635, lng: 28.0762 },
      amenities: ["lighting"],
      wheelchairAccessible: false,
      securityRating: 2
    },
    {
      id: "taxi_empire",
      name: "Empire Road Corridor",
      type: "corridor",
      location: { lat: -26.1818, lng: 28.0245 },
      amenities: ["lighting"],
      wheelchairAccessible: false,
      securityRating: 2
    },
    {
      id: "taxi_midrand",
      name: "Midrand Taxi Rank",
      type: "rank",
      location: { lat: -25.9994, lng: 28.1269 },
      amenities: ["shelter", "seating", "food-vendors"],
      wheelchairAccessible: false,
      securityRating: 3,
      connectedNetworks: ["gautrain"]
    }
  ],

  strengths: {
    cheapest: true,
    fastest: false,
    safest: false,
    reliable: false,
    leastWalking: true
  }
};

// ======================================================
// TRANSFER POINTS (Where networks connect)
// ======================================================

export interface TransferPoint {
  id: string;
  name: string;
  location: Coordinate;
  networks: string[];
  walkingDistance: number; // meters
  estimatedTransferTime: number; // minutes
  accessibility: "excellent" | "good" | "fair" | "poor";
}

export const TRANSFER_POINTS: TransferPoint[] = [
  {
    id: "transfer_park",
    name: "Park Station Hub",
    location: { lat: -26.2048, lng: 28.0436 },
    networks: ["gautrain", "metrorail", "taxi", "rea-vaya"],
    walkingDistance: 200,
    estimatedTransferTime: 5,
    accessibility: "good"
  },
  {
    id: "transfer_sandton",
    name: "Sandton Interchange",
    location: { lat: -26.1076, lng: 28.0567 },
    networks: ["gautrain", "taxi"],
    walkingDistance: 100,
    estimatedTransferTime: 3,
    accessibility: "excellent"
  },
  {
    id: "transfer_pretoria",
    name: "Pretoria Station Hub",
    location: { lat: -25.7479, lng: 28.1881 },
    networks: ["gautrain", "metrorail", "taxi", "a-re-yeng"],
    walkingDistance: 250,
    estimatedTransferTime: 7,
    accessibility: "fair"
  }
];

// ======================================================
// HELPER FUNCTIONS
// ======================================================

export const getNetworkById = (id: string): TransportNetworkZone | undefined => {
  return TRANSPORT_ZONES.find(zone => zone.id === id);
};

export const getNetworksByCity = (city: string): TransportNetworkZone[] => {
  return TRANSPORT_ZONES.filter(zone => 
    zone.city.toLowerCase().includes(city.toLowerCase())
  );
};

export const getTransferPoints = (networkIds: string[]): TransferPoint[] => {
  return TRANSFER_POINTS.filter(point =>
    networkIds.every(network => point.networks.includes(network))
  );
};

export const getFareForDistance = (
  network: TransportNetworkZone,
  distanceKm: number,
  isPeak: boolean = true
): number | null => {
  if (!network.fareZones) return null;
  
  const zone = network.fareZones.find(
    zone => distanceKm >= zone.fromDistance && distanceKm < zone.toDistance
  );
  
  if (!zone) return null;
  return isPeak ? zone.peakFare : zone.offPeakFare;
};

export const isOperating = (network: TransportNetworkZone): boolean => {
  if (!network.operatingHours) return true;
  
  const now = new Date();
  const day = now.getDay();
  const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  
  let hours;
  if (day === 0) hours = network.operatingHours.sunday;
  else if (day === 6) hours = network.operatingHours.saturday;
  else hours = network.operatingHours.weekday;
  
  return currentTime >= hours.start && currentTime <= hours.end;
};

// ======================================================
// EXPORT ALL
// ======================================================

export const TRANSPORT_ZONES: TransportNetworkZone[] = [
  REA_VAYA_ZONE,
  GAUTRAIN_ZONE,
  A_RE_YENG_ZONE,
  METRORAIL_ZONE,
  TAXI_ZONE
];