/**
 * PRASA Gauteng corridor discovery from dated service evidence and published
 * public timetables. This is not live vehicle tracking.
 *
 * Current pilot graph:
 * - Naledi <-> Johannesburg Park Station (16 stops)
 * - Johannesburg Park Station <-> Germiston (4 stops)
 *
 * Shared stations become explicit rail interchanges. Fares remain separate
 * until a current station/zone fare can be sourced for the exact trip.
 */
import type { Location, TransportRecommendation, JourneyLeg } from "../types";
import pilotData from "../data/transit/gauteng/metrorail/gauteng-pilot-2026.json";
import interchangeData from "../data/transit/gauteng/metrorail/interchanges-2026.json";

type Station = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  coordinateSourceUrl?: string;
  scheduledMinutesFromStart?: number | null;
};

type Corridor = {
  id: string;
  label: string;
  operationEvidence: string;
  orderedStopsEvidence: string;
  knownTimetable: boolean;
  notes?: string;
  routeMetrics?: {
    distanceKm?: number;
    scheduledTravelMinutes?: number;
  };
  timetableSource?: {
    sourceUrl?: string;
  };
  publicTimetableSource?: {
    timetableUrl?: string;
    publishedDistanceKm?: number;
  };
  stations: Station[];
};

const data = pilotData as unknown as { pilotCorridors: Corridor[] };
const corridors = data.pilotCorridors;

const earthDistanceKm = (
  a: Pick<Location, "lat" | "lng">,
  b: Pick<Location, "lat" | "lng">,
): number => {
  const rad = (v: number) => v * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) *
      Math.cos(rad(b.lat)) *
      Math.sin(dLng / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
};

export type PilotMetrorailStation = Station;
export type NearestPrasaStation = {
  station: Station;
  corridorId: string;
  corridorLabel: string;
  accessKm: number;
};

export function metrorailStations(): readonly Station[] {
  const seen = new Set<string>();
  const result: Station[] = [];
  for (const corridor of corridors) {
    for (const station of corridor.stations) {
      const key = station.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(station);
    }
  }
  return result;
}

export function nearestPrasaStation(
  point: Pick<Location, "lat" | "lng">,
): NearestPrasaStation | null {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;
  let best: NearestPrasaStation | null = null;
  for (const corridor of corridors) {
    for (const station of corridor.stations) {
      const accessKm = earthDistanceKm(point, station);
      if (!best || accessKm < best.accessKm) {
        best = {
          station,
          corridorId: corridor.id,
          corridorLabel: corridor.label,
          accessKm,
        };
      }
    }
  }
  return best;
}

export function getPrasaInterchangeHints(stationName: string): string[] {
  const node = interchangeData.interchanges.find(
    (item) => item.prasaStation === stationName,
  );
  if (!node) return [];
  return node.connections.map(
    (connection) =>
      connection.operator +
      " at " +
      connection.stop +
      (connection.routeCodes.length
        ? " (routes " + connection.routeCodes.join(", ") + ")"
        : ""),
  );
}

const MAX_ORIGIN_ACCESS_KM = 6;
const MAX_DESTINATION_EGRESS_KM = 4;
const EASY_ACCESS_KM = 1;

type Match = {
  corridor: Corridor;
  station: Station;
  accessKm: number;
};

const matchesForPoint = (
  point: Pick<Location, "lat" | "lng">,
  maxKm: number,
): Match[] => {
  const matches: Match[] = [];
  for (const corridor of corridors) {
    for (const station of corridor.stations) {
      const accessKm = earthDistanceKm(point, station);
      if (accessKm <= maxKm) matches.push({ corridor, station, accessKm });
    }
  }
  return matches.sort((a, b) => a.accessKm - b.accessKm);
};

const timetableMinutes = (
  from: Station,
  to: Station,
): number | null => {
  const a = from.scheduledMinutesFromStart;
  const b = to.scheduledMinutesFromStart;
  if (typeof a === "number" && typeof b === "number") return Math.abs(b - a);
  return null;
};

const publishedSegmentDistance = (
  corridor: Corridor,
  from: Station,
  to: Station,
): number | null => {
  const first = corridor.stations[0];
  const last = corridor.stations[corridor.stations.length - 1];
  const isFullLine =
    (from.name === first?.name && to.name === last?.name) ||
    (from.name === last?.name && to.name === first?.name);
  if (!isFullLine) return null;
  const distance =
    corridor.publicTimetableSource?.publishedDistanceKm ??
    corridor.routeMetrics?.distanceKm;
  return typeof distance === "number" && Number.isFinite(distance)
    ? Math.round(distance * 100) / 100
    : null;
};

const railLeg = (
  corridor: Corridor,
  from: Station,
  to: Station,
  suffix: string,
): JourneyLeg => ({
  id: "prasa:" + corridor.id + ":" + suffix,
  mode: "rail",
  label: "PRASA Metrorail · " + from.name + " → " + to.name,
  operator: "Metrorail",
  from: from.name + " station",
  to: to.name + " station",
  fromLocation: { lat: from.lat, lng: from.lng, accuracy: 0 },
  toLocation: { lat: to.lat, lng: to.lng, accuracy: 0 },
  ...(publishedSegmentDistance(corridor, from, to) !== null
    ? {
        distanceKm: publishedSegmentDistance(corridor, from, to),
        distanceSource: "unknown" as const,
      }
    : {}),
  fare: null,
  fareStatus: "unverified",
  evidence: "published",
});

const sharedStationNames = (a: Corridor, b: Corridor): string[] => {
  const bNames = new Set(b.stations.map((station) => station.name));
  return a.stations
    .map((station) => station.name)
    .filter((name) => bNames.has(name));
};

const makeDirectRecommendation = (
  start: Match,
  end: Match,
): TransportRecommendation | null => {
  if (
    start.corridor.id !== end.corridor.id ||
    start.station.name === end.station.name
  ) {
    return null;
  }

  const minutes = timetableMinutes(start.station, end.station);
  const accessNeeded =
    start.accessKm > EASY_ACCESS_KM || end.accessKm > EASY_ACCESS_KM;
  const interchangeHints = Array.from(
    new Set([
      ...getPrasaInterchangeHints(start.station.name),
      ...getPrasaInterchangeHints(end.station.name),
    ]),
  );
  const serviceKm = publishedSegmentDistance(
    start.corridor,
    start.station,
    end.station,
  );

  return {
    id:
      "metrorail:" +
      start.corridor.id +
      ":" +
      start.station.id +
      ":" +
      end.station.id,
    mode: "Metrorail",
    score: Math.max(
      48,
      Math.round(86 - start.accessKm * 4 - end.accessKm * 4),
    ),
    estimatedFare: null,
    estimatedTime: minutes,
    estimatedTravelTime: minutes,
    walkingDistance:
      Math.round((start.accessKm + end.accessKm) * 100) / 100,
    ...(serviceKm !== null ? { serviceDistanceKm: serviceKm } : {}),
    nearestStop: start.station.name + " PRASA station",
    destinationStop: end.station.name + " PRASA station",
    routeName: start.station.name + " → " + end.station.name,
    subtitle:
      "PRASA " +
      start.corridor.label +
      (minutes !== null ? " · about " + minutes + " min scheduled" : ""),
    reason:
      "Pulse matched both ends to the published " +
      start.corridor.label +
      " rail corridor. The timetable duration is from published schedule data, not live train telemetry. " +
      (accessNeeded
        ? "You still need to reach/leave the mapped station. "
        : "") +
      "The exact PRASA ticket amount remains separate until the matching current station/zone fare is sourced." +
      (interchangeHints.length
        ? " Nearby interchange options: " + interchangeHints.join("; ") + "."
        : ""),
    badges: [
      "OFFICIAL_SERVICE",
      ...(accessNeeded ? ["ACCESS_REQUIRED"] : ["DIRECT"]),
      "FARE_VERIFY",
    ],
    color: "#35C7D8",
    confidence: start.corridor.knownTimetable ? 0.82 : 0.7,
    dataQuality: "verified",
    direct: true,
    routeCodes: [start.corridor.label],
    transferStops: interchangeHints,
    journeyLegs: [
      railLeg(start.corridor, start.station, end.station, "direct"),
    ],
    fareStatus: "unverified",
    timeStatus: minutes !== null ? "estimated" : "unverified",
    evidenceStatus: "published-service-membership",
    selectable: !accessNeeded,
  };
};

const makeTransferRecommendation = (
  start: Match,
  end: Match,
): TransportRecommendation | null => {
  if (start.corridor.id === end.corridor.id) return null;

  const shared = sharedStationNames(start.corridor, end.corridor);
  if (!shared.length) return null;

  const transferName = shared
    .map((name) => {
      const a = start.corridor.stations.find((station) => station.name === name);
      const b = end.corridor.stations.find((station) => station.name === name);
      if (!a || !b) return null;
      const firstMinutes = timetableMinutes(
        start.station,
        a,
      );
      const secondMinutes = timetableMinutes(
        b,
        end.station,
      );
      return {
        name,
        a,
        b,
        minutes:
          firstMinutes !== null && secondMinutes !== null
            ? firstMinutes + secondMinutes
            : null,
      };
    })
    .filter(
      (
        value,
      ): value is {
        name: string;
        a: Station;
        b: Station;
        minutes: number | null;
      } => value !== null,
    )
    .sort((x, y) => (x.minutes ?? 9999) - (y.minutes ?? 9999))[0];

  if (
    !transferName ||
    transferName.name === start.station.name ||
    transferName.name === end.station.name
  ) {
    return null;
  }

  const accessNeeded =
    start.accessKm > EASY_ACCESS_KM || end.accessKm > EASY_ACCESS_KM;
  const transferHints = getPrasaInterchangeHints(transferName.name);

  return {
    id:
      "metrorail:transfer:" +
      start.corridor.id +
      ":" +
      end.corridor.id +
      ":" +
      start.station.id +
      ":" +
      end.station.id,
    mode: "Metrorail",
    score: Math.max(
      45,
      Math.round(78 - start.accessKm * 4 - end.accessKm * 4),
    ),
    estimatedFare: null,
    estimatedTime: transferName.minutes,
    estimatedTravelTime: transferName.minutes,
    walkingDistance:
      Math.round((start.accessKm + end.accessKm) * 100) / 100,
    nearestStop: start.station.name + " PRASA station",
    destinationStop: end.station.name + " PRASA station",
    routeName:
      start.station.name +
      " → " +
      transferName.name +
      " → " +
      end.station.name,
    subtitle:
      "PRASA rail change at " +
      transferName.name +
      (transferName.minutes !== null
        ? " · about " + transferName.minutes + " min on published schedules"
        : ""),
    reason:
      "Pulse joined two published PRASA corridors at their shared " +
      transferName.name +
      " station. This is a rail interchange, not a claim that the two trains are timed to connect. " +
      "Allow transfer time and check the current departure board. The exact PRASA fare is still pending a matching current station/zone tariff.",
    badges: [
      "OFFICIAL_SERVICE",
      "TRANSFER",
      ...(accessNeeded ? ["ACCESS_REQUIRED"] : []),
      "FARE_VERIFY",
    ],
    color: "#35C7D8",
    confidence: 0.78,
    dataQuality: "verified",
    direct: false,
    routeCodes: [start.corridor.label, end.corridor.label],
    transferStops: [
      transferName.name,
      ...transferHints,
    ],
    journeyLegs: [
      railLeg(
        start.corridor,
        start.station,
        transferName.a,
        "to-" + transferName.name.toLowerCase().replaceAll(" ", "-"),
      ),
      railLeg(
        end.corridor,
        transferName.b,
        end.station,
        "from-" + transferName.name.toLowerCase().replaceAll(" ", "-"),
      ),
    ],
    fareStatus: "unverified",
    timeStatus: transferName.minutes !== null ? "estimated" : "unverified",
    evidenceStatus: "published-shared-stop-connectivity",
    selectable: !accessNeeded,
  };
};

const uniqueRecommendations = (
  recommendations: TransportRecommendation[],
): TransportRecommendation[] => {
  const seen = new Set<string>();
  return recommendations.filter((rec) => {
    const key =
      rec.mode +
      "|" +
      (rec.nearestStop ?? "") +
      "|" +
      (rec.destinationStop ?? "") +
      "|" +
      (rec.routeName ?? "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function discoverMetrorailCorridor(
  origin: Location,
  destination: Location,
): TransportRecommendation[] {
  const starts = matchesForPoint(origin, MAX_ORIGIN_ACCESS_KM).slice(0, 6);
  const ends = matchesForPoint(destination, MAX_DESTINATION_EGRESS_KM).slice(0, 6);
  if (!starts.length || !ends.length) return [];

  const recommendations: TransportRecommendation[] = [];
  for (const start of starts) {
    for (const end of ends) {
      const direct = makeDirectRecommendation(start, end);
      if (direct) recommendations.push(direct);
      const transfer = makeTransferRecommendation(start, end);
      if (transfer) recommendations.push(transfer);
    }
  }

  return uniqueRecommendations(recommendations)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}
