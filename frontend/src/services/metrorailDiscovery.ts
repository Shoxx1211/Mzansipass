/**
 * PRASA Gauteng corridor discovery, not a live timetable.
 * 2026 Parliament reports Naledi–Johannesburg service restoration;
 * the 2022 public resumption report supplies an ordered stop list;
 * OSM/Mapcarta supplies approximate station locations.
 *
 * Never turn a published rail corridor into a current train departure or
 * quote a ticket amount without the current station-to-station fare matrix.
 */
import type { Location, TransportRecommendation } from "../types";
import pilotData from "../data/transit/gauteng/metrorail/gauteng-pilot-2026.json";
// Kept self-contained: nearbyNetwork imports this module for PRASA visibility.
const earthDistanceKm = (
  a: Pick<Location, "lat" | "lng">,
  b: Pick<Location, "lat" | "lng">,
): number => {
  const rad = (v: number) => v * Math.PI / 180;
  const phi = rad(b.lat - a.lat);
  const lambda = rad(b.lng - a.lng);
  const h = Math.sin(phi / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(lambda / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1-h)));
};

const corridor = pilotData.pilotCorridors[0];
export type PilotMetrorailStation = (typeof corridor.stations)[number];

export function metrorailStations(): readonly PilotMetrorailStation[] {
  return corridor.stations;
}

export type NearestPrasaStation = {
  station: PilotMetrorailStation;
  accessKm: number;
};

export function nearestPrasaStation(point: Pick<Location,"lat"|"lng">): NearestPrasaStation | null {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;
  const stations = corridor.stations;
  let best: NearestPrasaStation | null = null;
  for (const station of stations) {
    const accessKm = earthDistanceKm(point, station);
    if (best === null || accessKm < best.accessKm) best = {station, accessKm};
  }
  return best;
}

const MAX_ORIGIN_ACCESS_KM = 6;
const MAX_DESTINATION_EGRESS_KM = 3;

export function discoverMetrorailCorridor(
  origin: Location,
  destination: Location,
): TransportRecommendation[] {
  const start = nearestPrasaStation(origin);
  const end = nearestPrasaStation(destination);
  if (!start || !end ||
      start.station.id === end.station.id ||
      start.accessKm > MAX_ORIGIN_ACCESS_KM ||
      end.accessKm > MAX_DESTINATION_EGRESS_KM) return [];

  const originName = start.station.name;
  const destinationName = end.station.name;
  const accessNeeded = start.accessKm > 1 || end.accessKm > 1;

  return [{
    id: "metrorail:naledi-park:" + start.station.id + ":" + end.station.id,
    mode: "Metrorail",
    score: Math.max(45, Math.round(77 - start.accessKm * 4 - end.accessKm * 4)),
    estimatedFare: null,
    estimatedTime: null,
    estimatedTravelTime: null,
    fareStatus: "unverified",
    timeStatus: "unverified",
    walkingDistance: Math.round((start.accessKm + end.accessKm) * 100) / 100,
    nearestStop: originName + " PRASA station",
    destinationStop: destinationName + " PRASA station",
    routeName: originName + " → " + destinationName,
    subtitle: "PRASA Naledi–Johannesburg corridor · timetable to check",
    reason:
      "PRASA's 2026 parliamentary report lists the Johannesburg–Naledi corridor as recovered. " +
      "The station order comes from its published 2022 resumption report. " +
      "Nearest mapped access to " + originName + " is about " + start.accessKm.toFixed(1) +
      " km as the crow flies; from " + destinationName + " to your destination is about " +
      end.accessKm.toFixed(1) +
      " km. Real walking/connecting journeys may be longer. " +
      (accessNeeded ? "Plan transport to or from the station separately. " : "") +
      "Current stop-by-stop departures, transfer compatibility and the station-specific passenger fare are not established.",
    badges: ["OFFICIAL_SERVICE", "FARE_VERIFY", ...(accessNeeded ? ["ACCESS_REQUIRED"] : [])],
    color: "#35C7D8",
    confidence: 0.65,
    dataQuality: "limited",
    direct: !accessNeeded,
    routeCodes: ["PRASA Naledi–Park Station"],
    transferStops: [],
    journeyLegs: [{
      id: "prasa-naledi-park-rail",
      mode: "rail",
      label: "PRASA Metrorail · " + originName + " → " + destinationName,
      operator: "Metrorail",
      from: originName + " station",
      to: destinationName + " station",
      fromLocation: {lat:start.station.lat,lng:start.station.lng,accuracy:0},
      toLocation: {lat:end.station.lat,lng:end.station.lng,accuracy:0},
      distanceSource: "unknown",
      fare: null,
      fareStatus: "unverified",
      evidence: "published",
    }],
    evidenceStatus: "published-service-membership",
    // The timetable, station calls and full fare still need confirmation.
    selectable: false,
  }];
}
