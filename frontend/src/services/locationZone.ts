import type { Location } from "../types";

// ======================================================
// TYPES
// ======================================================
export type ZoneDefinition = {
  name: string;

  bounds: {
    minLat: number;
    maxLat: number;

    minLng: number;
    maxLng: number;
  };
};

// ======================================================
// SOUTH AFRICA TRANSIT ZONES
// ======================================================
const ZONES: readonly ZoneDefinition[] = [

  // ======================================================
  // PRETORIA / TSHWANE
  // ======================================================
  {
    name: "Pretoria",

    bounds: {
      minLat: -26.00,
      maxLat: -25.50,

      minLng: 27.95,
      maxLng: 28.45
    }
  },

  // ======================================================
  // JOHANNESBURG
  // ======================================================
  {
    name: "Johannesburg",

    bounds: {
      minLat: -26.40,
      maxLat: -26.00,

      minLng: 27.70,
      maxLng: 28.25
    }
  },

  // ======================================================
  // CENTURION
  // ======================================================
  {
    name: "Centurion",

    bounds: {
      minLat: -25.95,
      maxLat: -25.78,

      minLng: 28.10,
      maxLng: 28.25
    }
  },

  // ======================================================
  // SANDTON
  // ======================================================
  {
    name: "Sandton",

    bounds: {
      minLat: -26.15,
      maxLat: -26.02,

      minLng: 27.98,
      maxLng: 28.10
    }
  }

] as const;

// ======================================================
// HELPERS
// ======================================================
const isInsideBounds = (
  lat: number,
  lng: number,
  zone: ZoneDefinition
): boolean => {

  return (
    lat >= zone.bounds.minLat &&
    lat <= zone.bounds.maxLat &&
    lng >= zone.bounds.minLng &&
    lng <= zone.bounds.maxLng
  );

};

// ======================================================
// DETECT CITY / ZONE
// ======================================================
export const detectCity = (
  location: Location
): string => {

  const {
    lat,
    lng
  } = location;

  for (const zone of ZONES) {

    if (
      isInsideBounds(
        lat,
        lng,
        zone
      )
    ) {

      return zone.name;

    }

  }

  return "Unknown";

};

// ======================================================
// EXPORT ZONES
// ======================================================
export const LOCATION_ZONES = ZONES;