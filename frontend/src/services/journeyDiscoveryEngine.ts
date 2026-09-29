// src/services/journeyDiscoveryEngine.ts
// Pulse Transit - production-safe Gauteng journey discovery
//
// Uses committed normalized public operator datasets only.
// It deliberately distinguishes:
// - official service / GIS evidence
// - complete passenger routing
//
// Candidates that still need timetable, transfer or total-fare validation remain
// visible to commuters but are not selectable for trip start.

import type {
  Location,
  TransportRecommendation,
} from "../types";

type RouteGeometry =
  | {
      type: "LineString";
      coordinates: number[][];
    }
  | {
      type: "MultiLineString";
      coordinates: number[][][];
    };

interface AReYengRoute {
  id: string;
  operatorId: "areyeng";
  code: string;
  name: string;
  type?: string;
  geometry: RouteGeometry;
}

interface AReYengStop {
  id: string;
  name: string;
  location: Location;
  candidateRoutes: Array<{
    routeId: string;
    routeCode: string;
  }>;
}

interface GautrainStation {
  stationId: string;
  name: string;
  location: Location;
}

interface GautrainService {
  id: string;
  name: string;
  corridor?: string;
  stations: GautrainStation[];
  verification?: {
    serviceMembership?: string;
  };
}

interface GautrainRailData {
  services: GautrainService[];
}

interface FareMatrix {
  stationOrder: string[];
  values: Array<Array<number | null>>;
}

interface GautrainFareData {
  currency: string;
  stationReferences: Record<
    string,
    {
      stationId: string;
      name: string;
    }
  >;
  payAsYouGo: {
    peakFares: FareMatrix;
    offPeakFares: FareMatrix;
  };
}

interface NearbyStation {
  station: GautrainStation;
  distanceKm: number;
}

interface RouteProximity {
  route: AReYengRoute;
  distanceMetres: number;
}

interface TshwaneBusTerminal {
  id: string;
  role: "from" | "to" | "unknown";
  routeIds: string[];
  location: Location;
  rawRouteLabel: string | null;
  routeDescription: string | null;
  status: string | null;
}

interface TshwaneBusRouteVariant {
  geometry: RouteGeometry | null;
}

interface TshwaneBusRoute {
  id: string;
  routeId: string;
  name: string;
  approved: boolean;
  descriptions: string[];
  geometryVariants: TshwaneBusRouteVariant[];
  terminals: {
    from: string[];
    to: string[];
    unknown: string[];
    all: string[];
  };
}

const EARTH_METRES = 6_371_000;
const ARE_YENG_ROUTE_RADIUS_METRES = 800;
const ARE_YENG_TRANSFER_RADIUS_METRES = 700;
const GAUTRAIN_WALK_ACCESS_RADIUS_KM = 1.6;
const GAUTRAIN_DISCOVERY_ACCESS_RADIUS_KM = 15;
const GAUTRAIN_MULTIMODAL_ACCESS_RADIUS_KM = 45;
const GAUTRAIN_STATION_DESTINATION_RADIUS_KM = 3;
const BUS_WALK_ACCESS_RADIUS_KM = 1.6;
const BUS_ROAD_ACCESS_RADIUS_KM = 45;
const TSHWANE_BUS_ROUTE_RADIUS_METRES = 1000;
const MAX_RESULTS = 10;

const toRadians = (value: number): number =>
  (value * Math.PI) / 180;

const roundKm = (value: number): number =>
  Math.round(value * 100) / 100;

const haversineKm = (
  a: Location,
  b: Location,
): number => {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);

  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);

  const h =
    sinLat * sinLat +
    Math.cos(lat1) *
      Math.cos(lat2) *
      sinLng *
      sinLng;

  return (
    (2 *
      EARTH_METRES *
      Math.atan2(
        Math.sqrt(h),
        Math.sqrt(1 - h),
      )) /
    1000
  );
};

const project = (
  lat: number,
  lng: number,
  referenceLatitude: number,
): {
  x: number;
  y: number;
} => ({
  x:
    EARTH_METRES *
    toRadians(lng) *
    Math.cos(
      toRadians(referenceLatitude),
    ),
  y:
    EARTH_METRES *
    toRadians(lat),
});

const distanceToSegmentMetres = (
  point: Location,
  a: number[],
  b: number[],
): number => {
  if (
    a.length < 2 ||
    b.length < 2
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const p = project(
    point.lat,
    point.lng,
    point.lat,
  );

  const projectedA = project(
    a[1],
    a[0],
    point.lat,
  );

  const projectedB = project(
    b[1],
    b[0],
    point.lat,
  );

  const dx =
    projectedB.x - projectedA.x;

  const dy =
    projectedB.y - projectedA.y;

  if (dx === 0 && dy === 0) {
    return Math.hypot(
      p.x - projectedA.x,
      p.y - projectedA.y,
    );
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      (
        (p.x - projectedA.x) * dx +
        (p.y - projectedA.y) * dy
      ) /
        (dx * dx + dy * dy),
    ),
  );

  return Math.hypot(
    p.x - (projectedA.x + dx * t),
    p.y - (projectedA.y + dy * t),
  );
};

const distanceToLineMetres = (
  point: Location,
  line: number[][],
): number => {
  if (line.length < 2) {
    return Number.POSITIVE_INFINITY;
  }

  let shortest =
    Number.POSITIVE_INFINITY;

  for (
    let index = 1;
    index < line.length;
    index += 1
  ) {
    shortest = Math.min(
      shortest,
      distanceToSegmentMetres(
        point,
        line[index - 1],
        line[index],
      ),
    );
  }

  return shortest;
};

const distanceToGeometryMetres = (
  point: Location,
  geometry: RouteGeometry,
): number => {
  if (geometry.type === "LineString") {
    return distanceToLineMetres(
      point,
      geometry.coordinates,
    );
  }

  let shortest =
    Number.POSITIVE_INFINITY;

  for (const line of geometry.coordinates) {
    shortest = Math.min(
      shortest,
      distanceToLineMetres(
        point,
        line,
      ),
    );
  }

  return shortest;
};

const nearestStation = (
  point: Location,
  service: GautrainService,
): NearbyStation | null => {
  let best: NearbyStation | null =
    null;

  for (const station of service.stations) {
    const distanceKm = haversineKm(
      point,
      station.location,
    );

    if (
      !best ||
      distanceKm < best.distanceKm
    ) {
      best = {
        station,
        distanceKm,
      };
    }
  }

  return best;
};

const nearestStopForRoute = (
  point: Location,
  routeId: string,
  stops: AReYengStop[],
): {
  stop: AReYengStop;
  distanceKm: number;
} | null => {
  let best:
    | {
        stop: AReYengStop;
        distanceKm: number;
      }
    | null = null;

  for (const stop of stops) {
    const servesRoute =
      stop.candidateRoutes.some(
        (candidate) =>
          candidate.routeId ===
          routeId,
      );

    if (!servesRoute) {
      continue;
    }

    const distanceKm =
      haversineKm(
        point,
        stop.location,
      );

    if (
      !best ||
      distanceKm < best.distanceKm
    ) {
      best = {
        stop,
        distanceKm,
      };
    }
  }

  return best;
};

const routeProximities = (
  point: Location,
  routes: AReYengRoute[],
  maxDistanceMetres: number,
): RouteProximity[] =>
  routes
    .map((route) => ({
      route,
      distanceMetres:
        distanceToGeometryMetres(
          point,
          route.geometry,
        ),
    }))
    .filter(
      (candidate) =>
        candidate.distanceMetres <=
        maxDistanceMetres,
    )
    .sort(
      (a, b) =>
        a.distanceMetres -
        b.distanceMetres,
    );

const gautrainStationKey = (
  stationId: string,
  fares: GautrainFareData,
): string | null => {
  for (
    const [
      key,
      reference,
    ] of Object.entries(
      fares.stationReferences,
    )
  ) {
    if (
      reference.stationId ===
      stationId
    ) {
      return key;
    }
  }

  return null;
};

const isPeakFarePeriod = (
  now: Date,
): boolean => {
  const day = now.getDay();

  // Gautrain's published 2026 fare guide treats weekends as peak.
  if (day === 0 || day === 6) {
    return true;
  }

  const minutes =
    now.getHours() * 60 +
    now.getMinutes();

  const morningPeak =
    minutes >= 6 * 60 &&
    minutes < 8 * 60 + 30;

  const afternoonPeak =
    minutes >= 15 * 60 &&
    minutes < 18 * 60 + 30;

  return (
    morningPeak ||
    afternoonPeak
  );
};

const gautrainFare = (
  originStationId: string,
  destinationStationId: string,
  fares: GautrainFareData,
  now: Date,
): number | null => {
  const originKey =
    gautrainStationKey(
      originStationId,
      fares,
    );

  const destinationKey =
    gautrainStationKey(
      destinationStationId,
      fares,
    );

  if (
    !originKey ||
    !destinationKey ||
    originKey === destinationKey
  ) {
    return null;
  }

  const matrix = isPeakFarePeriod(now)
    ? fares.payAsYouGo.peakFares
    : fares.payAsYouGo.offPeakFares;

  const originIndex =
    matrix.stationOrder.indexOf(
      originKey,
    );

  const destinationIndex =
    matrix.stationOrder.indexOf(
      destinationKey,
    );

  if (
    originIndex < 0 ||
    destinationIndex < 0
  ) {
    return null;
  }

  const value =
    matrix.values[originIndex]?.[
      destinationIndex
    ];

  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : null;
};

const serviceLabel = (
  service: GautrainService,
): string =>
  service.corridor
    ? service.corridor
        .split("-")
        .map(
          (part) =>
            part.charAt(0).toUpperCase() +
            part.slice(1),
        )
        .join("-")
    : service.name;

const directGautrainCandidates = (
  origin: Location,
  destination: Location,
  railData: GautrainRailData,
  fares: GautrainFareData,
  now: Date,
): TransportRecommendation[] => {
  const results:
    TransportRecommendation[] = [];

  for (const service of railData.services) {
    const originMatch =
      nearestStation(
        origin,
        service,
      );

    const destinationMatch =
      nearestStation(
        destination,
        service,
      );

    if (
      !originMatch ||
      !destinationMatch ||
      originMatch.station.stationId ===
        destinationMatch.station.stationId ||
      originMatch.distanceKm >
        GAUTRAIN_DISCOVERY_ACCESS_RADIUS_KM ||
      destinationMatch.distanceKm >
        GAUTRAIN_DISCOVERY_ACCESS_RADIUS_KM
    ) {
      continue;
    }

    const fare = gautrainFare(
      originMatch.station.stationId,
      destinationMatch.station.stationId,
      fares,
      now,
    );

    const totalAccess =
      originMatch.distanceKm +
      destinationMatch.distanceKm;

    const accessRequired =
      originMatch.distanceKm >
        GAUTRAIN_WALK_ACCESS_RADIUS_KM ||
      destinationMatch.distanceKm >
        GAUTRAIN_WALK_ACCESS_RADIUS_KM;

    const accessScore = Math.max(
      52,
      96 -
        (
          totalAccess /
          (
            GAUTRAIN_DISCOVERY_ACCESS_RADIUS_KM *
            2
          )
        ) *
          44,
    );

    results.push({
      id:
        `discovery:gautrain:${service.id}:${originMatch.station.stationId}:${destinationMatch.station.stationId}`,
      mode: "Gautrain",
      score: Math.round(accessScore),
      estimatedFare: fare,
      estimatedTime: null,
      estimatedTravelTime: null,
      walkingDistance:
        roundKm(totalAccess),
      nearestStop:
        originMatch.station.name,
      destinationStop:
        destinationMatch.station.name,
      routeName:
        `${originMatch.station.name} → ${destinationMatch.station.name}`,
      subtitle:
        accessRequired
          ? "Gautrain rail option · station access required"
          : "Official Gautrain service match",
      reason:
        accessRequired
          ? `Gautrain's published ${service.name} connects ${originMatch.station.name} and ${destinationMatch.station.name}. Your journey needs an access leg of about ${roundKm(originMatch.distanceKm)} km to the origin station and about ${roundKm(destinationMatch.distanceKm)} km after the destination station. Pulse is showing the verified rail leg while leaving the access mode, timetable compatibility and total door-to-door time unverified.`
          : `Gautrain's published ${service.name} includes both ${originMatch.station.name} and ${destinationMatch.station.name}. Pulse measured approximately ${roundKm(originMatch.distanceKm)} km access at the origin and ${roundKm(destinationMatch.distanceKm)} km at the destination. Timetable compatibility and total door-to-door time are not yet verified.`,
      badges: accessRequired
        ? [
            "OFFICIAL_SERVICE",
            "ACCESS_REQUIRED",
          ]
        : [
            "OFFICIAL_SERVICE",
            "DIRECT",
          ],
      color: "#00AEEF",
      confidence: 0.94,
      dataQuality: "verified",
      direct: true,
      routeCodes: [
        serviceLabel(service),
      ],
      transferStops: [],
      journeyLegs: [
        {
          id: "gautrain-rail",
          mode: "rail",
          label:
            `Gautrain · ${originMatch.station.name} → ${destinationMatch.station.name}`,
          operator: "Gautrain",
          from:
            originMatch.station.name,
          to:
            destinationMatch.station.name,
          fare,
          fareStatus:
            fare === null
              ? "unverified"
              : "verified",
          evidence: "published",
        },
      ],
      fareStatus:
        fare === null
          ? "unverified"
          : "verified",
      timeStatus: "unverified",
      evidenceStatus:
        "published-service-membership",
      selectable:
        fare !== null &&
        !accessRequired,
    });
  }

  return results;
};



const distanceToTshwaneRouteMetres = (
  point: Location,
  route: TshwaneBusRoute,
): number => {
  let shortest = Number.POSITIVE_INFINITY;

  for (const variant of route.geometryVariants) {
    if (!variant.geometry) {
      continue;
    }

    shortest = Math.min(
      shortest,
      distanceToGeometryMetres(
        point,
        variant.geometry,
      ),
    );
  }

  return shortest;
};

const aReYengRoadAccessCandidates = (
  origin: Location,
  destination: Location,
  routes: AReYengRoute[],
  stops: AReYengStop[],
): TransportRecommendation[] => {
  const destinationRoutes =
    routeProximities(
      destination,
      routes,
      ARE_YENG_ROUTE_RADIUS_METRES,
    );

  const results: TransportRecommendation[] = [];

  for (const destinationRoute of destinationRoutes) {
    const accessStop =
      nearestStopForRoute(
        origin,
        destinationRoute.route.id,
        stops,
      );

    const exitStop =
      nearestStopForRoute(
        destination,
        destinationRoute.route.id,
        stops,
      );

    if (!accessStop) {
      continue;
    }

    if (
      accessStop.distanceKm <=
        BUS_WALK_ACCESS_RADIUS_KM ||
      accessStop.distanceKm >
        BUS_ROAD_ACCESS_RADIUS_KM
    ) {
      continue;
    }

    results.push({
      id:
        `discovery:areyeng-road-access:${destinationRoute.route.id}`,
      mode: "A Re Yeng",
      score: 84,
      estimatedFare: null,
      estimatedTime: null,
      estimatedTravelTime: null,
      walkingDistance:
        roundKm(accessStop.distanceKm),
      nearestStop:
        accessStop.stop.name,
      destinationStop:
        exitStop?.stop.name,
      routeName:
        `Taxi → A Re Yeng · ${destinationRoute.route.code}`,
      subtitle:
        "Taxi + A Re Yeng",
      reason:
        `Official City of Tshwane GIS places A Re Yeng ${destinationRoute.route.code} within about ${Math.round(destinationRoute.distanceMetres)} m of your destination. The nearest mapped stop on that route is about ${roundKm(accessStop.distanceKm)} km from your origin, so Pulse is showing a road/taxi access leg before the bus. The exact access fare, today's timetable and direction remain unverified.`,
      badges: [
        "MULTIMODAL",
        "OFFICIAL_GIS",
        "ACCESS_REQUIRED",
      ],
      color: "#00A86B",
      confidence: 0.84,
      dataQuality: "verified",
      direct: false,
      routeCodes: [
        "Taxi",
        destinationRoute.route.code,
      ],
      transferStops: [
        accessStop.stop.name,
      ],
      journeyLegs: [
        {
          id: "access-road",
          mode: "taxi",
          label:
            "Taxi",
          from: "Origin",
          to:
            accessStop.stop.name,
          distanceKm:
            roundKm(
              accessStop.distanceKm,
            ),
          fare: null,
          fareStatus:
            "unverified",
          evidence:
            "road-access",
        },
        {
          id: "areyeng-bus",
          mode: "bus",
          label:
            `A Re Yeng · ${destinationRoute.route.code}`,
          operator:
            "A Re Yeng",
          from:
            accessStop.stop.name,
          to:
            exitStop?.stop.name ??
            "Destination area",
          fare: null,
          fareStatus:
            "unverified",
          evidence:
            "official-gis",
        },
      ],
      fareStatus: "unverified",
      timeStatus: "unverified",
      evidenceStatus:
        "multi-operator-official-gis-connection",
      selectable: true,
    });

    if (results.length >= 2) {
      break;
    }
  }

  return results;
};

const tshwaneBusCandidates = (
  origin: Location,
  destination: Location,
  routes: TshwaneBusRoute[],
  terminals: TshwaneBusTerminal[],
): TransportRecommendation[] => {
  const terminalById = new Map(
    terminals.map(
      (terminal) => [
        terminal.id,
        terminal,
      ] as const,
    ),
  );

  const destinationMatches = routes
    .filter((route) => route.approved)
    .map((route) => ({
      route,
      destinationDistanceMetres:
        distanceToTshwaneRouteMetres(
          destination,
          route,
        ),
    }))
    .filter(
      (candidate) =>
        candidate.destinationDistanceMetres <=
        TSHWANE_BUS_ROUTE_RADIUS_METRES,
    )
    .sort(
      (a, b) =>
        a.destinationDistanceMetres -
        b.destinationDistanceMetres,
    );

  const results: TransportRecommendation[] = [];

  for (const match of destinationMatches) {
    const fromTerminals =
      match.route.terminals.from
        .map((id) =>
          terminalById.get(id),
        )
        .filter(
          (
            terminal,
          ): terminal is TshwaneBusTerminal =>
            terminal !== undefined,
        );

    if (!fromTerminals.length) {
      continue;
    }

    const accessTerminal =
      fromTerminals
        .map((terminal) => ({
          terminal,
          distanceKm:
            haversineKm(
              origin,
              terminal.location,
            ),
        }))
        .sort(
          (a, b) =>
            a.distanceKm -
            b.distanceKm,
        )[0];

    if (
      !accessTerminal ||
      accessTerminal.distanceKm >
        BUS_ROAD_ACCESS_RADIUS_KM
    ) {
      continue;
    }

    const requiresRoadAccess =
      accessTerminal.distanceKm >
        BUS_WALK_ACCESS_RADIUS_KM;

    const bestToTerminal =
      match.route.terminals.to
        .map((id) =>
          terminalById.get(id),
        )
        .filter(
          (
            terminal,
          ): terminal is TshwaneBusTerminal =>
            terminal !== undefined,
        )
        .map((terminal) => ({
          terminal,
          distanceKm:
            haversineKm(
              destination,
              terminal.location,
            ),
        }))
        .sort(
          (a, b) =>
            a.distanceKm -
            b.distanceKm,
        )[0];

    const routeLabel =
      match.route.name ||
      match.route.routeId;

    results.push({
      id:
        `discovery:tshwane-bus:${match.route.routeId}:${requiresRoadAccess ? "road-access" : "direct"}`,
      mode:
        "Tshwane Bus Service",
      score:
        requiresRoadAccess
          ? 82
          : 90,
      estimatedFare: null,
      estimatedTime: null,
      estimatedTravelTime: null,
      walkingDistance:
        roundKm(
          accessTerminal.distanceKm,
        ),
      nearestStop:
        "Official departure point",
      destinationStop:
        bestToTerminal
          ? "Near destination"
          : undefined,
      routeName:
        requiresRoadAccess
          ? `Taxi → Tshwane Bus · ${routeLabel}`
          : `Tshwane Bus · ${routeLabel}`,
      subtitle:
        requiresRoadAccess
          ? "Taxi + municipal bus"
          : "Official municipal bus route",
      reason:
        requiresRoadAccess
          ? `City of Tshwane GIS shows approved bus route ${match.route.routeId} within about ${Math.round(match.destinationDistanceMetres)} m of your destination. Its official departure point is about ${roundKm(accessTerminal.distanceKm)} km from your origin, so Pulse is showing a road/taxi access leg followed by Tshwane Bus. The roadside stop sequence, current timetable and exact fare are not yet verified.`
          : `City of Tshwane GIS shows approved bus route ${match.route.routeId} accessible near your origin and within about ${Math.round(match.destinationDistanceMetres)} m of your destination. The roadside stop sequence, current timetable and exact fare are not yet verified.`,
      badges:
        requiresRoadAccess
          ? [
              "MULTIMODAL",
              "OFFICIAL_GIS",
              "ACCESS_REQUIRED",
            ]
          : [
              "OFFICIAL_GIS",
              "DIRECT",
            ],
      color: "#38BDF8",
      confidence:
        requiresRoadAccess
          ? 0.8
          : 0.9,
      dataQuality: "verified",
      direct:
        !requiresRoadAccess,
      routeCodes:
        requiresRoadAccess
          ? [
              "Taxi",
              match.route.routeId,
            ]
          : [
              match.route.routeId,
            ],
      transferStops:
        requiresRoadAccess
          ? [
              "Official departure point",
            ]
          : [],
      journeyLegs:
        requiresRoadAccess
          ? [
              {
                id: "access-road",
                mode: "taxi",
                label:
                  "Taxi",
                from: "Origin",
                to:
                  "Official departure point",
                distanceKm:
                  roundKm(
                    accessTerminal.distanceKm,
                  ),
                fare: null,
                fareStatus:
                  "unverified",
                evidence:
                  "road-access",
              },
              {
                id: "tshwane-bus",
                mode: "bus",
                label:
                  `Tshwane Bus · ${match.route.routeId}`,
                operator:
                  "Tshwane Bus Service",
                from:
                  "Official departure point",
                to:
                  bestToTerminal
                    ? "Near destination"
                    : "Destination area",
                fare: null,
                fareStatus:
                  "unverified",
                evidence:
                  "official-gis",
              },
            ]
          : [
              {
                id: "tshwane-bus",
                mode: "bus",
                label:
                  `Tshwane Bus · ${match.route.routeId}`,
                operator:
                  "Tshwane Bus Service",
                from:
                  "Origin area",
                to:
                  bestToTerminal
                    ? "Near destination"
                    : "Destination area",
                fare: null,
                fareStatus:
                  "unverified",
                evidence:
                  "official-gis",
              },
            ],
      fareStatus: "unverified",
      timeStatus: "unverified",
      evidenceStatus:
        requiresRoadAccess
          ? "multi-operator-official-gis-connection"
          : "official-gis-route",
      selectable: true,
    });

    if (results.length >= 2) {
      break;
    }
  }

  return results;
};

const gautrainRoadAccessCandidates = (
  origin: Location,
  destination: Location,
  railData: GautrainRailData,
  fares: GautrainFareData,
  now: Date,
): TransportRecommendation[] => {
  const results: TransportRecommendation[] = [];

  for (const service of railData.services) {
    const originMatch =
      nearestStation(
        origin,
        service,
      );

    const destinationMatch =
      nearestStation(
        destination,
        service,
      );

    if (
      !originMatch ||
      !destinationMatch ||
      originMatch.station.stationId ===
        destinationMatch.station.stationId
    ) {
      continue;
    }

    const originNeedsRoadAccess =
      originMatch.distanceKm >
        GAUTRAIN_WALK_ACCESS_RADIUS_KM &&
      originMatch.distanceKm <=
        GAUTRAIN_MULTIMODAL_ACCESS_RADIUS_KM;

    const destinationNeedsRoadAccess =
      destinationMatch.distanceKm >
        GAUTRAIN_WALK_ACCESS_RADIUS_KM &&
      destinationMatch.distanceKm <=
        GAUTRAIN_MULTIMODAL_ACCESS_RADIUS_KM;

    const originAtStation =
      originMatch.distanceKm <=
        GAUTRAIN_STATION_DESTINATION_RADIUS_KM;

    const destinationAtStation =
      destinationMatch.distanceKm <=
        GAUTRAIN_STATION_DESTINATION_RADIUS_KM;

    const useRoadThenRail =
      originNeedsRoadAccess &&
      destinationAtStation;

    const useRailThenRoad =
      originAtStation &&
      destinationNeedsRoadAccess;

    if (
      !useRoadThenRail &&
      !useRailThenRoad
    ) {
      continue;
    }

    const railFare =
      gautrainFare(
        originMatch.station.stationId,
        destinationMatch.station.stationId,
        fares,
        now,
      );

    const accessDistanceKm =
      useRoadThenRail
        ? originMatch.distanceKm
        : destinationMatch.distanceKm;

    const routeCodes =
      useRoadThenRail
        ? [
            "Taxi",
            serviceLabel(service),
          ]
        : [
            serviceLabel(service),
            "Taxi",
          ];

    const transferStops = [
      useRoadThenRail
        ? originMatch.station.name
        : destinationMatch.station.name,
    ];

    const routeName =
      useRoadThenRail
        ? `Taxi → Gautrain · ${originMatch.station.name} → ${destinationMatch.station.name}`
        : `Gautrain · ${originMatch.station.name} → ${destinationMatch.station.name} → Taxi`;

    const reason =
      useRoadThenRail
        ? `Pulse found ${originMatch.station.name} as the nearest useful station on Gautrain's published ${service.name}, about ${roundKm(originMatch.distanceKm)} km from your origin. From there, the official Gautrain service continues to ${destinationMatch.station.name}. ${railFare === null ? "" : `The published Gautrain rail leg fare is R${railFare}; `}the taxi/road access fare and exact pickup point are not yet verified.`
        : `Pulse matched your origin to ${originMatch.station.name} on Gautrain's published ${service.name}, then found your destination about ${roundKm(destinationMatch.distanceKm)} km from ${destinationMatch.station.name}. ${railFare === null ? "" : `The published Gautrain rail leg fare is R${railFare}; `}the final taxi/road access fare and exact drop-off route are not yet verified.`;

    results.push({
      id:
        `discovery:gautrain-road-access:${service.id}:${originMatch.station.stationId}:${destinationMatch.station.stationId}:${useRoadThenRail ? "origin" : "destination"}`,
      mode: "Gautrain",
      score: 88,
      estimatedFare: null,
      estimatedTime: null,
      estimatedTravelTime: null,
      walkingDistance:
        roundKm(accessDistanceKm),
      nearestStop:
        useRoadThenRail
          ? originMatch.station.name
          : undefined,
      destinationStop:
        useRailThenRoad
          ? destinationMatch.station.name
          : destinationMatch.station.name,
      routeName,
      subtitle:
        useRoadThenRail
          ? "Taxi + Gautrain"
          : "Gautrain + taxi",
      reason,
      badges: [
        "MULTIMODAL",
        "OFFICIAL_SERVICE",
        "ACCESS_REQUIRED",
      ],
      color: "#00AEEF",
      confidence: 0.9,
      dataQuality: "verified",
      direct: false,
      routeCodes,
      transferStops,
      journeyLegs:
        useRoadThenRail
          ? [
              {
                id: "access-road",
                mode: "taxi",
                label:
                  "Taxi",
                from: "Origin",
                to:
                  originMatch.station.name,
                distanceKm:
                  roundKm(
                    originMatch.distanceKm,
                  ),
                fare: null,
                fareStatus:
                  "unverified",
                evidence:
                  "road-access",
              },
              {
                id: "gautrain-rail",
                mode: "rail",
                label:
                  `Gautrain · ${originMatch.station.name} → ${destinationMatch.station.name}`,
                operator:
                  "Gautrain",
                from:
                  originMatch.station.name,
                to:
                  destinationMatch.station.name,
                fare:
                  railFare,
                fareStatus:
                  railFare === null
                    ? "unverified"
                    : "verified",
                evidence:
                  "published",
              },
            ]
          : [
              {
                id: "gautrain-rail",
                mode: "rail",
                label:
                  `Gautrain · ${originMatch.station.name} → ${destinationMatch.station.name}`,
                operator:
                  "Gautrain",
                from:
                  originMatch.station.name,
                to:
                  destinationMatch.station.name,
                fare:
                  railFare,
                fareStatus:
                  railFare === null
                    ? "unverified"
                    : "verified",
                evidence:
                  "published",
              },
              {
                id: "access-road",
                mode: "taxi",
                label:
                  "Taxi",
                from:
                  destinationMatch.station.name,
                to: "Destination",
                distanceKm:
                  roundKm(
                    destinationMatch.distanceKm,
                  ),
                fare: null,
                fareStatus:
                  "unverified",
                evidence:
                  "road-access",
              },
            ],
      fareStatus: "unverified",
      timeStatus: "unverified",
      evidenceStatus:
        "multi-operator-published-connection",
      selectable: true,
    });
  }

  return results;
};

const directAReYengCandidates = (
  origin: Location,
  destination: Location,
  routes: AReYengRoute[],
  stops: AReYengStop[],
): TransportRecommendation[] => {
  const originRoutes =
    routeProximities(
      origin,
      routes,
      ARE_YENG_ROUTE_RADIUS_METRES,
    );

  const destinationDistances =
    new Map(
      routeProximities(
        destination,
        routes,
        ARE_YENG_ROUTE_RADIUS_METRES,
      ).map((candidate) => [
        candidate.route.id,
        candidate.distanceMetres,
      ]),
    );

  const results:
    TransportRecommendation[] = [];

  for (const originCandidate of originRoutes) {
    const destinationDistance =
      destinationDistances.get(
        originCandidate.route.id,
      );

    if (
      destinationDistance ===
      undefined
    ) {
      continue;
    }

    const originStop =
      nearestStopForRoute(
        origin,
        originCandidate.route.id,
        stops,
      );

    const destinationStop =
      nearestStopForRoute(
        destination,
        originCandidate.route.id,
        stops,
      );

    const totalAccessKm =
      (
        originStop?.distanceKm ??
        originCandidate.distanceMetres /
          1000
      ) +
      (
        destinationStop?.distanceKm ??
        destinationDistance / 1000
      );

    const score = Math.max(
      50,
      92 -
        (
          originCandidate.distanceMetres +
          destinationDistance
        ) /
          55,
    );

    results.push({
      id:
        `discovery:areyeng:${originCandidate.route.id}`,
      mode: "A Re Yeng",
      score: Math.round(score),
      estimatedFare: null,
      estimatedTime: null,
      estimatedTravelTime: null,
      walkingDistance:
        roundKm(totalAccessKm),
      nearestStop:
        originStop?.stop.name,
      destinationStop:
        destinationStop?.stop.name,
      routeName:
        `${originCandidate.route.code} · ${originCandidate.route.name}`,
      subtitle:
        "Official City of Tshwane route match",
      reason:
        `Official A Re Yeng GIS places ${originCandidate.route.code} within approximately ${Math.round(originCandidate.distanceMetres)} m of the origin and ${Math.round(destinationDistance)} m of the destination. Pulse has not yet verified today's timetable, travel direction or an exact passenger fare for this trip.`,
      badges: [
        "OFFICIAL_GIS",
        "DIRECT",
      ],
      color: "#00A86B",
      confidence: 0.9,
      dataQuality: "verified",
      direct: true,
      routeCodes: [
        originCandidate.route.code,
      ],
      transferStops: [],
      journeyLegs: [
        {
          id: "areyeng-bus",
          mode: "bus",
          label:
            `A Re Yeng · ${originCandidate.route.code}`,
          operator:
            "A Re Yeng",
          from:
            originStop?.stop.name ??
            "Origin area",
          to:
            destinationStop?.stop.name ??
            "Destination area",
          fare: null,
          fareStatus:
            "unverified",
          evidence:
            "official-gis",
        },
      ],
      fareStatus: "unverified",
      timeStatus: "unverified",
      evidenceStatus:
        "official-gis-route",
      selectable: true,
    });

    if (results.length >= 2) {
      break;
    }
  }

  return results;
};

const multimodalCandidates = (
  origin: Location,
  destination: Location,
  railData: GautrainRailData,
  fares: GautrainFareData,
  routes: AReYengRoute[],
  stops: AReYengStop[],
  now: Date,
): TransportRecommendation[] => {
  const results:
    TransportRecommendation[] = [];

  const destinationRoutes =
    routeProximities(
      destination,
      routes,
      ARE_YENG_ROUTE_RADIUS_METRES,
    );

  const originRoutes =
    routeProximities(
      origin,
      routes,
      ARE_YENG_ROUTE_RADIUS_METRES,
    );

  for (const service of railData.services) {
    const railOrigin =
      nearestStation(
        origin,
        service,
      );

    const railDestination =
      nearestStation(
        destination,
        service,
      );

    // --------------------------------------------------
    // GAUTRAIN -> A RE YENG
    // --------------------------------------------------

    if (
      railOrigin &&
      railOrigin.distanceKm <=
        GAUTRAIN_DISCOVERY_ACCESS_RADIUS_KM
    ) {
      let best:
        | {
            station: GautrainStation;
            route: RouteProximity;
            transferDistanceMetres: number;
          }
        | null = null;

      for (const station of service.stations) {
        if (
          station.stationId ===
          railOrigin.station.stationId
        ) {
          continue;
        }

        for (const route of destinationRoutes) {
          const transferDistanceMetres =
            distanceToGeometryMetres(
              station.location,
              route.route.geometry,
            );

          if (
            transferDistanceMetres >
            ARE_YENG_TRANSFER_RADIUS_METRES
          ) {
            continue;
          }

          if (
            !best ||
            transferDistanceMetres +
              route.distanceMetres <
              best.transferDistanceMetres +
                best.route.distanceMetres
          ) {
            best = {
              station,
              route,
              transferDistanceMetres,
            };
          }
        }
      }

      if (best) {
        const destinationStop =
          nearestStopForRoute(
            destination,
            best.route.route.id,
            stops,
          );

        const transferStop =
          nearestStopForRoute(
            best.station.location,
            best.route.route.id,
            stops,
          );

        const accessKm =
          railOrigin.distanceKm +
          (
            destinationStop?.distanceKm ??
            best.route.distanceMetres /
              1000
          ) +
          (
            transferStop?.distanceKm ??
            best.transferDistanceMetres /
              1000
          );

        const railFare =
          gautrainFare(
            railOrigin.station.stationId,
            best.station.stationId,
            fares,
            now,
          );

        results.push({
          id:
            `discovery:multi:gautrain-areyeng:${service.id}:${best.route.route.id}`,
          mode: "Gautrain",
          score: 82,
          estimatedFare: null,
          estimatedTime: null,
          estimatedTravelTime: null,
          walkingDistance:
            roundKm(accessKm),
          nearestStop:
            railOrigin.station.name,
          destinationStop:
            destinationStop?.stop.name,
          routeName:
            `Gautrain → A Re Yeng · ${best.route.route.code}`,
          subtitle:
            "Multi-modal connection candidate",
          reason:
            `Pulse can connect the published Gautrain ${service.name} from ${railOrigin.station.name} to ${best.station.name}, then match A Re Yeng ${best.route.route.code} near that station and your destination. ${railFare === null ? "" : `The published Gautrain rail leg fare is R${railFare}; `}the complete combined fare, transfer timing and exact interchange path are not yet verified.`,
          badges: [
            "MULTIMODAL",
            "PUBLISHED_CONNECTION",
          ],
          color: "#6D5DFB",
          confidence: 0.84,
          dataQuality: "verified",
          direct: false,
          routeCodes: [
            serviceLabel(service),
            best.route.route.code,
          ],
          transferStops: [
            transferStop?.stop.name ??
              best.station.name,
          ],
          fareStatus: "unverified",
          timeStatus: "unverified",
          evidenceStatus:
            "multi-operator-published-connection",
          selectable: false,
        });
      }
    }

    // --------------------------------------------------
    // A RE YENG -> GAUTRAIN
    // --------------------------------------------------

    if (
      railDestination &&
      railDestination.distanceKm <=
        GAUTRAIN_DISCOVERY_ACCESS_RADIUS_KM
    ) {
      let best:
        | {
            station: GautrainStation;
            route: RouteProximity;
            transferDistanceMetres: number;
          }
        | null = null;

      for (const station of service.stations) {
        if (
          station.stationId ===
          railDestination.station.stationId
        ) {
          continue;
        }

        for (const route of originRoutes) {
          const transferDistanceMetres =
            distanceToGeometryMetres(
              station.location,
              route.route.geometry,
            );

          if (
            transferDistanceMetres >
            ARE_YENG_TRANSFER_RADIUS_METRES
          ) {
            continue;
          }

          if (
            !best ||
            transferDistanceMetres +
              route.distanceMetres <
              best.transferDistanceMetres +
                best.route.distanceMetres
          ) {
            best = {
              station,
              route,
              transferDistanceMetres,
            };
          }
        }
      }

      if (best) {
        const originStop =
          nearestStopForRoute(
            origin,
            best.route.route.id,
            stops,
          );

        const transferStop =
          nearestStopForRoute(
            best.station.location,
            best.route.route.id,
            stops,
          );

        const accessKm =
          railDestination.distanceKm +
          (
            originStop?.distanceKm ??
            best.route.distanceMetres /
              1000
          ) +
          (
            transferStop?.distanceKm ??
            best.transferDistanceMetres /
              1000
          );

        const railFare =
          gautrainFare(
            best.station.stationId,
            railDestination.station.stationId,
            fares,
            now,
          );

        results.push({
          id:
            `discovery:multi:areyeng-gautrain:${best.route.route.id}:${service.id}`,
          mode: "Gautrain",
          score: 80,
          estimatedFare: null,
          estimatedTime: null,
          estimatedTravelTime: null,
          walkingDistance:
            roundKm(accessKm),
          nearestStop:
            originStop?.stop.name,
          destinationStop:
            railDestination.station.name,
          routeName:
            `A Re Yeng ${best.route.route.code} → Gautrain`,
          subtitle:
            "Multi-modal connection candidate",
          reason:
            `Pulse can match A Re Yeng ${best.route.route.code} near your origin and a Gautrain station, then connect through the published ${service.name} to ${railDestination.station.name}. ${railFare === null ? "" : `The published Gautrain rail leg fare is R${railFare}; `}the complete combined fare, transfer timing and exact interchange path are not yet verified.`,
          badges: [
            "MULTIMODAL",
            "PUBLISHED_CONNECTION",
          ],
          color: "#6D5DFB",
          confidence: 0.82,
          dataQuality: "verified",
          direct: false,
          routeCodes: [
            best.route.route.code,
            serviceLabel(service),
          ],
          transferStops: [
            transferStop?.stop.name ??
              best.station.name,
          ],
          fareStatus: "unverified",
          timeStatus: "unverified",
          evidenceStatus:
            "multi-operator-published-connection",
          selectable: false,
        });
      }
    }
  }

  return results;
};

const dedupeRecommendations = (
  recommendations: TransportRecommendation[],
): TransportRecommendation[] => {
  const seen = new Set<string>();

  return recommendations.filter(
    (recommendation) => {
      if (seen.has(recommendation.id)) {
        return false;
      }

      seen.add(recommendation.id);
      return true;
    },
  );
};

export class JourneyDiscoveryEngine {
  static async discover(
    origin: Location,
    destination: Location,
    now = new Date(),
  ): Promise<TransportRecommendation[]> {
    if (
      ![
        origin.lat,
        origin.lng,
        destination.lat,
        destination.lng,
      ].every(Number.isFinite)
    ) {
      return [];
    }

    const [
      railModule,
      fareModule,
      routeModule,
      stopModule,
      tshwaneRouteModule,
      tshwaneTerminalModule,
    ] = await Promise.all([
      import(
        "../data/transit/gauteng/gautrain/rail-lines.json"
      ),
      import(
        "../data/transit/gauteng/gautrain/fares.json"
      ),
      import(
        "../data/transit/gauteng/areyeng/normalized-routes.json"
      ),
      import(
        "../data/transit/gauteng/areyeng/normalized-stops.json"
      ),
      import(
        "../data/transit/gauteng/tshwane-bus/normalized-routes.json"
      ),
      import(
        "../data/transit/gauteng/tshwane-bus/normalized-terminals.json"
      ),
    ]);

    const railData =
      railModule.default as GautrainRailData;

    const fares =
      fareModule.default as GautrainFareData;

    const routes =
      routeModule.default as AReYengRoute[];

    const stops =
      stopModule.default as AReYengStop[];

    const tshwaneRoutes =
      tshwaneRouteModule.default as TshwaneBusRoute[];

    const tshwaneTerminals =
      tshwaneTerminalModule.default as TshwaneBusTerminal[];

    return dedupeRecommendations([
      ...directGautrainCandidates(
        origin,
        destination,
        railData,
        fares,
        now,
      ),
      ...gautrainRoadAccessCandidates(
        origin,
        destination,
        railData,
        fares,
        now,
      ),
      ...directAReYengCandidates(
        origin,
        destination,
        routes,
        stops,
      ),
      ...aReYengRoadAccessCandidates(
        origin,
        destination,
        routes,
        stops,
      ),
      ...tshwaneBusCandidates(
        origin,
        destination,
        tshwaneRoutes,
        tshwaneTerminals,
      ),
      ...multimodalCandidates(
        origin,
        destination,
        railData,
        fares,
        routes,
        stops,
        now,
      ),
    ])
      .sort(
        (a, b) =>
          b.score - a.score,
      )
      .slice(0, MAX_RESULTS);
  }
}
