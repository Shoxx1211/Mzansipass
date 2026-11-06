/**
 * Separate OpenStreetMap-derived rank evidence from operator-verified routes.
 * An OSM amenity is not proof that a minibus operates, where it goes, the fare,
 * or that walking between two map points is possible or safe.
 *
 * The source data is ODbL-licensed separately from the application source.
 */
import osmFacilitiesRaw from "../data/transit/gauteng/taxi/osm-facilities.json";
import type { Location } from "../types";

export type TaxiRankClassification = "minibus-indicated" | "taxi-type-unconfirmed";

export interface TaxiFacility {
  id: string;
  name: string;
  lat: number;
  lng: number;
  classification: TaxiRankClassification;
  osmUrl: string;
}

type ImportedOsmFacilities = {
  schemaVersion: number;
  source: string;
  sourceUrl: string;
  licence: string;
  extractedAt: string | null;
  facilities: TaxiFacility[];
};

const MAX_FACILITY_DISTANCE_KM = 3;
const imported = osmFacilitiesRaw as ImportedOsmFacilities;

export function validTaxiFacility(facility: TaxiFacility): boolean {
  return Boolean(facility) && typeof facility.id === "string" &&
    typeof facility.name === "string" && typeof facility.osmUrl === "string" &&
    /^([nwr])\/\d+$/.test(facility.id) &&
    facility.name.trim().length > 0 &&
    Number.isFinite(facility.lat) && facility.lat >= -90 && facility.lat <= 90 &&
    Number.isFinite(facility.lng) && facility.lng >= -180 && facility.lng <= 180 &&
    ["minibus-indicated", "taxi-type-unconfirmed"].includes(facility.classification) &&
    facility.osmUrl === `https://www.openstreetmap.org/${{
      n: "node", w: "way", r: "relation",
    }[facility.id[0]]}/${facility.id.slice(2)}`;
}

export function getOsmTaxiFacilities(): TaxiFacility[] {
  if (imported.schemaVersion !== 1 || imported.source !== "OpenStreetMap" ||
      imported.licence !== "ODbL-1.0" || !imported.extractedAt ||
      !Number.isFinite(Date.parse(imported.extractedAt)) ||
      !Array.isArray(imported.facilities)) return [];
  return imported.facilities.filter(validTaxiFacility);
}

/**
 * Only tagged or clearly labelled minibus ranks are shown in a minibus view.
 * Other OSM `amenity=taxi` points may represent private metered-cab stands.
 */
export function nearbyMinibusRankCandidates(
  origin: Location | null,
  distanceKm: (a: Location, b: Location) => number,
  facilities: TaxiFacility[] = getOsmTaxiFacilities(),
): Array<{ facility: TaxiFacility; kilometres: number }> {
  if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) return [];
  return facilities
    .filter(f => validTaxiFacility(f) && f.classification === "minibus-indicated")
    .map(facility => ({
      facility,
      kilometres: distanceKm(origin, { lat: facility.lat, lng: facility.lng } as Location),
    }))
    .filter(entry => Number.isFinite(entry.kilometres) &&
      entry.kilometres <= MAX_FACILITY_DISTANCE_KM)
    .sort((a, b) => a.kilometres - b.kilometres);
}
