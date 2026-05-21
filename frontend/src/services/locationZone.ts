// src/services/locationZone.ts
// Pulse Transit - Premium Location Zone Detection
// Features: Expanded zones, reverse geocoding, proximity detection, zone-based recommendations

import type { Location } from "../types";

// ======================================================
// TYPES
// ======================================================

export interface ZoneDefinition {
  name: string;
  city: string;
  province: string;
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  center?: Location;
  radius?: number; // Alternative to bounds
  landmarks?: string[];
  transportHubs?: string[];
  populationDensity?: 'high' | 'medium' | 'low';
  typicalFareMultiplier?: number;
}

export interface NearbyZone {
  zone: ZoneDefinition;
  distance: number;
  direction: string;
}

export interface ZoneInfo {
  currentZone: string;
  nearbyZones: NearbyZone[];
  isCentral: boolean;
  hasGautrainStation: boolean;
  hasTaxiRank: boolean;
  hasBusTerminal: boolean;
}

// ======================================================
// CONSTANTS
// ======================================================

const EARTH_RADIUS_KM = 6371;

// ======================================================
// EXPANDED ZONES DATABASE
// ======================================================

const ZONES: readonly ZoneDefinition[] = [
  // ======================================================
  // GAUTENG - MAJOR CITIES
  // ======================================================
  {
    name: "Johannesburg CBD",
    city: "Johannesburg",
    province: "Gauteng",
    bounds: {
      minLat: -26.22,
      maxLat: -26.18,
      minLng: 28.02,
      maxLng: 28.06
    },
    center: { lat: -26.2041, lng: 28.0473 },
    landmarks: ["Park Station", "Carlton Centre", "Constitution Hill"],
    transportHubs: ["Park Station", "Metrobus Terminal"],
    populationDensity: "high",
    typicalFareMultiplier: 1.0
  },
  {
    name: "Sandton",
    city: "Johannesburg",
    province: "Gauteng",
    bounds: {
      minLat: -26.15,
      maxLat: -26.02,
      minLng: 27.98,
      maxLng: 28.10
    },
    center: { lat: -26.1076, lng: 28.0567 },
    landmarks: ["Sandton City", "Nelson Mandela Square", "Gautrain Station"],
    transportHubs: ["Sandton Gautrain Station", "Sandton Taxi Rank"],
    populationDensity: "high",
    typicalFareMultiplier: 1.1
  },
  {
    name: "Pretoria CBD",
    city: "Pretoria",
    province: "Gauteng",
    bounds: {
      minLat: -25.78,
      maxLat: -25.70,
      minLng: 28.15,
      maxLng: 28.25
    },
    center: { lat: -25.7479, lng: 28.1881 },
    landmarks: ["Church Square", "Union Buildings", "Pretoria Station"],
    transportHubs: ["Pretoria Station", "Church Square Taxi Rank"],
    populationDensity: "high",
    typicalFareMultiplier: 0.95
  },
  {
    name: "Centurion",
    city: "Pretoria",
    province: "Gauteng",
    bounds: {
      minLat: -25.95,
      maxLat: -25.78,
      minLng: 28.10,
      maxLng: 28.25
    },
    center: { lat: -25.8580, lng: 28.1900 },
    landmarks: ["Centurion Mall", "SuperSport Park", "Gautrain Station"],
    transportHubs: ["Centurion Gautrain Station"],
    populationDensity: "medium",
    typicalFareMultiplier: 1.0
  },
  {
    name: "Midrand",
    city: "Midrand",
    province: "Gauteng",
    bounds: {
      minLat: -26.02,
      maxLat: -25.95,
      minLng: 28.08,
      maxLng: 28.18
    },
    center: { lat: -25.9994, lng: 28.1269 },
    landmarks: ["Mall of Africa", "Gallagher Convention Centre", "Gautrain Station"],
    transportHubs: ["Midrand Gautrain Station"],
    populationDensity: "medium",
    typicalFareMultiplier: 1.0
  },
  {
    name: "Rosebank",
    city: "Johannesburg",
    province: "Gauteng",
    bounds: {
      minLat: -26.16,
      maxLat: -26.13,
      minLng: 28.03,
      maxLng: 28.06
    },
    center: { lat: -26.1464, lng: 28.0428 },
    landmarks: ["Rosebank Mall", "Zone", "Gautrain Station"],
    transportHubs: ["Rosebank Gautrain Station"],
    populationDensity: "high",
    typicalFareMultiplier: 1.1
  },
  {
    name: "Randburg",
    city: "Johannesburg",
    province: "Gauteng",
    bounds: {
      minLat: -26.12,
      maxLat: -26.06,
      minLng: 27.98,
      maxLng: 28.03
    },
    center: { lat: -26.0930, lng: 27.9980 },
    landmarks: ["Randburg Square", "Ferndale"],
    transportHubs: ["Randburg Taxi Rank"],
    populationDensity: "medium",
    typicalFareMultiplier: 0.95
  },
  {
    name: "Soweto",
    city: "Johannesburg",
    province: "Gauteng",
    bounds: {
      minLat: -26.30,
      maxLat: -26.20,
      minLng: 27.80,
      maxLng: 27.95
    },
    center: { lat: -26.2678, lng: 27.8585 },
    landmarks: ["Vilakazi Street", "Orlando Towers", "FNB Stadium"],
    transportHubs: ["Bara Taxi Rank", "Orlando Station"],
    populationDensity: "high",
    typicalFareMultiplier: 0.85
  },
  {
    name: "Braamfontein",
    city: "Johannesburg",
    province: "Gauteng",
    bounds: {
      minLat: -26.20,
      maxLat: -26.18,
      minLng: 28.03,
      maxLng: 28.05
    },
    center: { lat: -26.1921, lng: 28.0379 },
    landmarks: ["Wits University", "Constitution Hill"],
    transportHubs: ["Braamfontein Taxi Rank"],
    populationDensity: "high",
    typicalFareMultiplier: 0.95
  },
  {
    name: "Hatfield",
    city: "Pretoria",
    province: "Gauteng",
    bounds: {
      minLat: -25.76,
      maxLat: -25.73,
      minLng: 28.22,
      maxLng: 28.25
    },
    center: { lat: -25.7484, lng: 28.2316 },
    landmarks: ["University of Pretoria", "Hatfield Plaza", "Gautrain Station"],
    transportHubs: ["Hatfield Gautrain Station"],
    populationDensity: "high",
    typicalFareMultiplier: 1.0
  },
  {
    name: "OR Tambo Airport",
    city: "Kempton Park",
    province: "Gauteng",
    bounds: {
      minLat: -26.15,
      maxLat: -26.12,
      minLng: 28.23,
      maxLng: 28.27
    },
    center: { lat: -26.1337, lng: 28.2420 },
    landmarks: ["OR Tambo International Airport"],
    transportHubs: ["Gautrain Station", "Airport Bus Terminal"],
    populationDensity: "low",
    typicalFareMultiplier: 1.3
  },
  
  // ======================================================
  // OUTLYING AREAS
  // ======================================================
  {
    name: "Krugersdorp",
    city: "Krugersdorp",
    province: "Gauteng",
    bounds: {
      minLat: -26.12,
      maxLat: -26.08,
      minLng: 27.70,
      maxLng: 27.80
    },
    center: { lat: -26.1000, lng: 27.7500 },
    landmarks: ["Key West Mall", "Sterkfontein Caves"],
    transportHubs: ["Krugersdorp Taxi Rank"],
    populationDensity: "medium",
    typicalFareMultiplier: 0.9
  },
  {
    name: "Springs",
    city: "Springs",
    province: "Gauteng",
    bounds: {
      minLat: -26.30,
      maxLat: -26.20,
      minLng: 28.40,
      maxLng: 28.50
    },
    center: { lat: -26.2500, lng: 28.4500 },
    landmarks: ["Springs Mall"],
    transportHubs: ["Springs Taxi Rank"],
    populationDensity: "medium",
    typicalFareMultiplier: 0.85
  },
  {
    name: "Vereeniging",
    city: "Vereeniging",
    province: "Gauteng",
    bounds: {
      minLat: -26.75,
      maxLat: -26.60,
      minLng: 27.90,
      maxLng: 28.00
    },
    center: { lat: -26.6800, lng: 27.9500 },
    landmarks: ["River Square Mall", "Vaal River"],
    transportHubs: ["Vereeniging Station", "Vereeniging Taxi Rank"],
    populationDensity: "medium",
    typicalFareMultiplier: 0.9
  }
] as const;

// ======================================================
// HELPER FUNCTIONS
// ======================================================

/**
 * Calculate distance between two coordinates
 */
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

/**
 * Convert degrees to radians
 */
const deg2rad = (deg: number): number => deg * (Math.PI / 180);

/**
 * Check if a point is inside zone bounds
 */
const isInsideBounds = (lat: number, lng: number, zone: ZoneDefinition): boolean => {
  return (lat >= zone.bounds.minLat && lat <= zone.bounds.maxLat &&
          lng >= zone.bounds.minLng && lng <= zone.bounds.maxLng);
};


/**
 * Calculate cardinal direction between two points
 */
const getDirection = (fromLat: number, fromLng: number, toLat: number, toLng: number): string => {
  const dLng = toLng - fromLng;
  const y = Math.sin(dLng) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) -
            Math.sin(fromLat) * Math.cos(toLat) * Math.cos(dLng);
  const bearing = Math.atan2(y, x) * (180 / Math.PI);
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(((bearing + 360) % 360) / 45) % 8;
  return directions[index];
};

// ======================================================
// PUBLIC API
// ======================================================

/**
 * Detect city/zone from location
 */
export const detectCity = (location: Location): string => {
  const { lat, lng } = location;
  
  for (const zone of ZONES) {
    if (isInsideBounds(lat, lng, zone)) {
      return zone.name;
    }
  }
  
  // Fallback: Find nearest zone
  let nearestZone = "Unknown";
  let minDistance = Infinity;
  
  for (const zone of ZONES) {
    if (zone.center) {
      const distance = calculateDistance(lat, lng, zone.center.lat, zone.center.lng);
      if (distance < minDistance && distance < 50) { // Within 50km
        minDistance = distance;
        nearestZone = zone.name;
      }
    }
  }
  
  return nearestZone;
};

/**
 * Get city name (broader region)
 */
export const detectCityName = (location: Location): string => {
  const zone = getCurrentZone(location);
  return zone?.city || "Unknown";
};

/**
 * Get province from location
 */
export const detectProvince = (location: Location): string => {
  const zone = getCurrentZone(location);
  return zone?.province || "Unknown";
};

/**
 * Get full zone information
 */
export const getCurrentZone = (location: Location): ZoneDefinition | undefined => {
  const { lat, lng } = location;
  return ZONES.find(zone => isInsideBounds(lat, lng, zone));
};

/**
 * Get comprehensive zone info
 */
export const getZoneInfo = (location: Location): ZoneInfo => {
  const currentZone = getCurrentZone(location);
  const nearbyZones: NearbyZone[] = [];
  
  for (const zone of ZONES) {
    if (zone.center && zone !== currentZone) {
      const distance = calculateDistance(location.lat, location.lng, zone.center.lat, zone.center.lng);
      if (distance < 20) { // Within 20km
        nearbyZones.push({
          zone,
          distance,
          direction: getDirection(location.lat, location.lng, zone.center.lat, zone.center.lng)
        });
      }
    }
  }
  
  nearbyZones.sort((a, b) => a.distance - b.distance);
  
  return {
    currentZone: currentZone?.name || "Unknown",
    nearbyZones: nearbyZones.slice(0, 5),
    isCentral: currentZone?.populationDensity === "high",
    hasGautrainStation: currentZone?.transportHubs?.some(hub => hub.includes("Gautrain")) ?? false,
    hasTaxiRank: currentZone?.transportHubs?.some(hub => hub.includes("Taxi Rank")) ?? false,
    hasBusTerminal: currentZone?.transportHubs?.some(hub => hub.includes("Bus") || hub.includes("Terminal")) ?? false
  };
};

/**
 * Get all zones for a city
 */
export const getZonesByCity = (city: string): ZoneDefinition[] => {
  return ZONES.filter(zone => zone.city === city);
};

/**
 * Get all zones by province
 */
export const getZonesByProvince = (province: string): ZoneDefinition[] => {
  return ZONES.filter(zone => zone.province === province);
};

/**
 * Get popular landmarks near location
 */
export const getNearbyLandmarks = (location: Location, radiusKm: number = 5): string[] => {
  const nearby: string[] = [];
  
  for (const zone of ZONES) {
    if (zone.center) {
      const distance = calculateDistance(location.lat, location.lng, zone.center.lat, zone.center.lng);
      if (distance < radiusKm && zone.landmarks) {
        nearby.push(...zone.landmarks);
      }
    }
  }
  
  return [...new Set(nearby)]; // Remove duplicates
};

/**
 * Get transport hubs near location
 */
export const getNearbyTransportHubs = (location: Location, radiusKm: number = 3): string[] => {
  const nearby: string[] = [];
  
  for (const zone of ZONES) {
    if (zone.center) {
      const distance = calculateDistance(location.lat, location.lng, zone.center.lat, zone.center.lng);
      if (distance < radiusKm && zone.transportHubs) {
        nearby.push(...zone.transportHubs);
      }
    }
  }
  
  return [...new Set(nearby)];
};

/**
 * Get fare multiplier for current location
 */
export const getFareMultiplier = (location: Location): number => {
  const zone = getCurrentZone(location);
  return zone?.typicalFareMultiplier || 1.0;
};

/**
 * Check if location is in a major city center
 */
export const isCentralArea = (location: Location): boolean => {
  const zone = getCurrentZone(location);
  return zone?.populationDensity === "high";
};

/**
 * Get all available zones
 */
export const getAllZones = (): readonly ZoneDefinition[] => ZONES;

/**
 * Search zones by name
 */
export const searchZones = (query: string): ZoneDefinition[] => {
  const lowerQuery = query.toLowerCase();
  return ZONES.filter(zone => 
    zone.name.toLowerCase().includes(lowerQuery) ||
    zone.city.toLowerCase().includes(lowerQuery) ||
    zone.province.toLowerCase().includes(lowerQuery)
  );
};

/**
 * Get zone statistics
 */
export const getZoneStats = () => {
  const cities = new Set(ZONES.map(z => z.city));
  const provinces = new Set(ZONES.map(z => z.province));
  
  return {
    totalZones: ZONES.length,
    totalCities: cities.size,
    totalProvinces: provinces.size,
    highDensityZones: ZONES.filter(z => z.populationDensity === "high").length,
    zonesWithGautrain: ZONES.filter(z => z.transportHubs?.some(h => h.includes("Gautrain"))).length,
    zonesWithTaxiRank: ZONES.filter(z => z.transportHubs?.some(h => h.includes("Taxi Rank"))).length
  };
};

// ======================================================
// EXPORT
// ======================================================

export const LOCATION_ZONES = ZONES;