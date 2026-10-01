import type { Location } from "../types";
import { METROBUS_PILOT_POLICY } from "../config/metrobusPilotPolicy";

export interface MetrobusGeometryMatch {
  routeCode: string;
  gisObjectId: number;
  rawRouteIdField: number | null;
  description: string;
  originLabel: string;
  destinationLabel: string;
  originDistanceMetres: number;
  destinationDistanceMetres: number;
  combinedDistanceMetres: number;
  indexedExcerptOverlap: boolean;
  /** Internal assumption, NOT evidence that this route currently operates. */
  provisionallyUsableForPilot: boolean;
}

export interface MetrobusEvidenceResult {
  status: "same-geometry" | "no-same-geometry";
  thresholdMetres: number;
  matches: MetrobusGeometryMatch[];
  nearestOrigin: MetrobusGeometryMatch[];
  nearestDestination: MetrobusGeometryMatch[];
  evidenceStatus: "city-gis-geometry-only";
  operatingStatus: "assumed-for-internal-pilot";
  sourceRightsStatus: "pending-review";
  selectable: false;
  passengerRoutingEnabled: false;
}

type RuntimeRoute = {
  routeCode: string;
  gisObjectId: number;
  rawRouteIdField: number | null;
  description: string;
  originLabel: string;
  destinationLabel: string;
  indexedExcerptOverlap: boolean;
  geometry: { type: "MultiLineString"; coordinates: number[][][] };
};

const EARTH_METRES = 6_371_000;
const toRadians = (value: number) => (value * Math.PI) / 180;

function project(lat: number, lng: number, referenceLatitude: number) {
  return {
    x: EARTH_METRES * toRadians(lng) * Math.cos(toRadians(referenceLatitude)),
    y: EARTH_METRES * toRadians(lat),
  };
}

function distanceToSegment(point: Location, a: number[], b: number[]): number {
  const referenceLatitude = point.lat;
  const p = project(point.lat, point.lng, referenceLatitude);
  const aProjected = project(a[1], a[0], referenceLatitude);
  const bProjected = project(b[1], b[0], referenceLatitude);
  const dx = bProjected.x - aProjected.x;
  const dy = bProjected.y - aProjected.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - aProjected.x, p.y - aProjected.y);
  const t = Math.max(0, Math.min(1,
    ((p.x - aProjected.x) * dx + (p.y - aProjected.y) * dy) / (dx * dx + dy * dy),
  ));
  return Math.hypot(p.x - (aProjected.x + dx * t), p.y - (aProjected.y + dy * t));
}

function distanceToRoute(point: Location, route: RuntimeRoute): number {
  let shortest = Number.POSITIVE_INFINITY;
  for (const line of route.geometry.coordinates) {
    for (let index = 1; index < line.length; index += 1) {
      const distance = distanceToSegment(point, line[index - 1], line[index]);
      if (distance < shortest) shortest = distance;
    }
  }
  return shortest;
}

function toMatch(route: RuntimeRoute, originDistanceMetres: number, destinationDistanceMetres: number): MetrobusGeometryMatch {
  return {
    routeCode: route.routeCode,
    gisObjectId: route.gisObjectId,
    rawRouteIdField: route.rawRouteIdField,
    description: route.description,
    originLabel: route.originLabel,
    destinationLabel: route.destinationLabel,
    originDistanceMetres,
    destinationDistanceMetres,
    combinedDistanceMetres: originDistanceMetres + destinationDistanceMetres,
    indexedExcerptOverlap: route.indexedExcerptOverlap,
    provisionallyUsableForPilot: METROBUS_PILOT_POLICY.provisionalOperationAssumption,
  };
}

export class MetrobusEvidenceEngine {
  static async screenJourney(
    origin: Location,
    destination: Location,
    thresholdMetres = METROBUS_PILOT_POLICY.screeningRadiusMetres,
  ): Promise<MetrobusEvidenceResult> {
    if (!import.meta.env.DEV || !METROBUS_PILOT_POLICY.enabled || !METROBUS_PILOT_POLICY.developerOnly) {
      throw new Error("Metrobus provisional pilot is available only in local development.");
    }
    if (![origin.lat, origin.lng, destination.lat, destination.lng].every(Number.isFinite)) {
      throw new Error("Metrobus screening requires valid origin and destination coordinates.");
    }
    if (!Number.isFinite(thresholdMetres) || thresholdMetres <= 0 || thresholdMetres > 1500) {
      throw new Error("Metrobus screening radius must be within 1–1500 m.");
    }

    // Dynamic import is reachable only in Vite DEV. This geometry remains local and gitignored.
    // This private dataset is intentionally local and gitignored while rights
    // are reviewed. Never import it statically into commuter or CI builds.
    const privateDevPath = "../data/transit/gauteng/metrobus/metrobus-planner-runtime.json";
    const { default: runtime } = await import(/* @vite-ignore */ privateDevPath);
    if (runtime.passengerRoutingEnabled !== false ||
        runtime.sourceRightsCleared !== false ||
        runtime.currentOperationVerified !== false) {
      throw new Error("Unexpected Metrobus GIS provenance. Stop the provisional pilot.");
    }

    const routes = (runtime.routes ?? []) as RuntimeRoute[];
    const measured = routes.map((route) => toMatch(
      route,
      distanceToRoute(origin, route),
      distanceToRoute(destination, route),
    ));
    const matches = measured
      .filter((candidate) =>
        candidate.originDistanceMetres <= thresholdMetres &&
        candidate.destinationDistanceMetres <= thresholdMetres)
      .sort((a, b) => a.combinedDistanceMetres - b.combinedDistanceMetres);

    return {
      status: matches.length ? "same-geometry" : "no-same-geometry",
      thresholdMetres,
      matches: matches.slice(0, 8),
      nearestOrigin: [...measured].sort((a, b) => a.originDistanceMetres - b.originDistanceMetres).slice(0, 5),
      nearestDestination: [...measured].sort((a, b) => a.destinationDistanceMetres - b.destinationDistanceMetres).slice(0, 5),
      evidenceStatus: "city-gis-geometry-only",
      operatingStatus: "assumed-for-internal-pilot",
      sourceRightsStatus: "pending-review",
      selectable: false,
      passengerRoutingEnabled: false,
    };
  }
}
