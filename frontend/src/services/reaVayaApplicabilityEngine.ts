import runtimeData from "../data/transit/gauteng/reavaya/reavaya-runtime.json";

export type ReaVayaCoordinates = {
  lat: number;
  lng: number;
};

export type ReaVayaApplicabilityStatus =
  | "direct"
  | "transfer"
  | "unsupported";

export type ReaVayaRouteAccess = {
  routeCode: string;
  routeFamily: string;
  distanceKm: number;
};

export type ReaVayaTransferLeg = {
  fromRoute: string;
  toRoute: string;
  sharedStopLabels: string[];
};

export type ReaVayaApplicabilityResult = {
  status: ReaVayaApplicabilityStatus;

  originMatches: ReaVayaRouteAccess[];
  destinationMatches: ReaVayaRouteAccess[];

  selectedRoutes: string[];
  transfers: ReaVayaTransferLeg[];

  direct: boolean;

  accessDistanceKm: number | null;
  egressDistanceKm: number | null;
  totalAccessWalkingKm: number | null;

  evidence:
    | "same-canonical-route"
    | "published-shared-stop-connectivity"
    | "insufficient-evidence";

  fare: {
    exactFareAvailable: false;
    currency: string;
    effectiveFrom: string;
    effectiveTo: string;
    peakRange: {
      minimum: number;
      maximum: number;
    } | null;
    offPeakRange: {
      minimum: number;
      maximum: number;
    } | null;
  };

  time: {
    exactJourneyTimeAvailable: false;
  };

  limitations: string[];
};

type RuntimeRoute = {
  routeCode: string;
  routeFamily: string;
  bbox: [number, number, number, number] | null;
  geometry: {
    type: "LineString" | "MultiLineString";
    coordinates: unknown;
  };
};

type RuntimeTransfer = {
  routeA: string;
  routeB: string;
  sharedStopLabels: string[];
};

type RuntimeData = {
  coordinateReferenceSystem: string;

  routes: RuntimeRoute[];

  connectivity: {
    publishedTransferEdges: RuntimeTransfer[];
    adjacency: Record<string, string[]>;
  };

  fares: {
    currency: string;
    effectiveFrom: string;
    effectiveTo: string;

    peakPublishedRange: {
      minimum: number;
      maximum: number;
    } | null;

    offPeakPublishedRange: {
      minimum: number;
      maximum: number;
    } | null;

    exactPassengerFareAvailable: false;
  };
};

const runtime =
  runtimeData as unknown as RuntimeData;

// ------------------------------------------------------------
// Product threshold, not an operator rule.
//
// The engine allows callers to override it.
// ------------------------------------------------------------

const DEFAULT_MAX_ACCESS_KM = 0.8;

const toRadians = (
  degrees: number,
): number =>
  (degrees * Math.PI) / 180;

const haversineKm = (
  a: [number, number],
  b: [number, number],
): number => {
  const earthRadiusKm = 6371;

  const [lon1, lat1] = a;
  const [lon2, lat2] = b;

  const dLat =
    toRadians(lat2 - lat1);

  const dLon =
    toRadians(lon2 - lon1);

  const lat1Rad =
    toRadians(lat1);

  const lat2Rad =
    toRadians(lat2);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) ** 2;

  return (
    2 *
    earthRadiusKm *
    Math.asin(Math.sqrt(h))
  );
};

// ------------------------------------------------------------
// Small-distance local projection for point → segment distance.
// ------------------------------------------------------------

const pointToSegmentKm = (
  point: [number, number],
  a: [number, number],
  b: [number, number],
): number => {
  const earthRadiusKm = 6371;

  const pointLon =
    toRadians(point[0]);

  const pointLat =
    toRadians(point[1]);

  const cosLat =
    Math.cos(pointLat);

  const project = (
    coordinate: [number, number],
  ): [number, number] => {
    const lon =
      toRadians(coordinate[0]);

    const lat =
      toRadians(coordinate[1]);

    return [
      (lon - pointLon) *
        cosLat *
        earthRadiusKm,

      (lat - pointLat) *
        earthRadiusKm,
    ];
  };

  const [ax, ay] =
    project(a);

  const [bx, by] =
    project(b);

  const dx =
    bx - ax;

  const dy =
    by - ay;

  const lengthSquared =
    dx * dx +
    dy * dy;

  if (lengthSquared === 0) {
    return Math.sqrt(
      ax * ax +
        ay * ay,
    );
  }

  let t =
    -(
      ax * dx +
      ay * dy
    ) /
    lengthSquared;

  t =
    Math.max(
      0,
      Math.min(1, t),
    );

  const nearestX =
    ax + t * dx;

  const nearestY =
    ay + t * dy;

  return Math.sqrt(
    nearestX * nearestX +
      nearestY * nearestY,
  );
};

const getLineParts = (
  geometry: RuntimeRoute["geometry"],
): [number, number][][] => {
  if (
    geometry.type ===
    "LineString"
  ) {
    return [
      geometry.coordinates as [
        number,
        number,
      ][],
    ];
  }

  if (
    geometry.type ===
    "MultiLineString"
  ) {
    return geometry.coordinates as [
      number,
      number,
    ][][];
  }

  return [];
};

const pointToGeometryKm = (
  point: [number, number],
  geometry: RuntimeRoute["geometry"],
): number => {
  let best =
    Number.POSITIVE_INFINITY;

  for (
    const line of
      getLineParts(geometry)
  ) {
    if (line.length === 1) {
      best =
        Math.min(
          best,
          haversineKm(
            point,
            line[0],
          ),
        );

      continue;
    }

    for (
      let index = 1;
      index < line.length;
      index += 1
    ) {
      best =
        Math.min(
          best,
          pointToSegmentKm(
            point,
            line[index - 1],
            line[index],
          ),
        );
    }
  }

  return best;
};

const bboxCouldMatch = (
  point: [number, number],
  bbox: [
    number,
    number,
    number,
    number,
  ] | null,
  maxDistanceKm: number,
): boolean => {
  if (!bbox) {
    return true;
  }

  const [
    minLon,
    minLat,
    maxLon,
    maxLat,
  ] = bbox;

  // Deliberately loose pre-filter.
  // Exact distance is still calculated against route geometry.
  const latitudePadding =
    maxDistanceKm / 111;

  const longitudeScale =
    Math.max(
      0.2,
      Math.cos(
        toRadians(point[1]),
      ),
    );

  const longitudePadding =
    maxDistanceKm /
    (
      111 *
      longitudeScale
    );

  return (
    point[0] >=
      minLon -
        longitudePadding &&
    point[0] <=
      maxLon +
        longitudePadding &&
    point[1] >=
      minLat -
        latitudePadding &&
    point[1] <=
      maxLat +
        latitudePadding
  );
};

const findAccessibleRoutes = (
  location: ReaVayaCoordinates,
  maxAccessKm: number,
): ReaVayaRouteAccess[] => {
  const point: [number, number] = [
    location.lng,
    location.lat,
  ];

  const matches =
    runtime.routes
      .filter((route) =>
        bboxCouldMatch(
          point,
          route.bbox,
          maxAccessKm,
        ),
      )
      .map((route) => ({
        routeCode:
          route.routeCode,

        routeFamily:
          route.routeFamily,

        distanceKm:
          pointToGeometryKm(
            point,
            route.geometry,
          ),
      }))
      .filter(
        (match) =>
          Number.isFinite(
            match.distanceKm,
          ) &&
          match.distanceKm <=
            maxAccessKm,
      )
      .map((match) => ({
        ...match,

        distanceKm:
          Math.round(
            match.distanceKm *
              1000,
          ) / 1000,
      }))
      .sort(
        (a, b) =>
          a.distanceKm -
          b.distanceKm,
      );

  return matches;
};

const transferEdgeFor = (
  routeA: string,
  routeB: string,
): RuntimeTransfer | null => {
  return (
    runtime.connectivity
      .publishedTransferEdges
      .find((edge) => {
        return (
          (
            edge.routeA ===
              routeA &&
            edge.routeB ===
              routeB
          ) ||
          (
            edge.routeA ===
              routeB &&
            edge.routeB ===
              routeA
          )
        );
      }) ??
    null
  );
};

type RoutePath = {
  routes: string[];
  transfers: ReaVayaTransferLeg[];
};

const findPublishedPath = (
  starts: string[],
  destinations: Set<string>,
): RoutePath | null => {
  const queue: Array<{
    route: string;
    routes: string[];
    transfers: ReaVayaTransferLeg[];
  }> = [];

  const visited =
    new Set<string>();

  for (
    const start of starts
  ) {
    queue.push({
      route: start,
      routes: [start],
      transfers: [],
    });

    visited.add(start);
  }

  while (
    queue.length > 0
  ) {
    const current =
      queue.shift();

    if (!current) {
      break;
    }

    if (
      destinations.has(
        current.route,
      )
    ) {
      return {
        routes:
          current.routes,

        transfers:
          current.transfers,
      };
    }

    const neighbours =
      runtime.connectivity
        .adjacency[
          current.route
        ] ??
      [];

    for (
      const neighbour of
        neighbours
    ) {
      if (
        visited.has(
          neighbour,
        )
      ) {
        continue;
      }

      const edge =
        transferEdgeFor(
          current.route,
          neighbour,
        );

      // Never traverse an edge that lacks
      // published shared-stop evidence.
      if (!edge) {
        continue;
      }

      visited.add(
        neighbour,
      );

      queue.push({
        route:
          neighbour,

        routes: [
          ...current.routes,
          neighbour,
        ],

        transfers: [
          ...current.transfers,
          {
            fromRoute:
              current.route,

            toRoute:
              neighbour,

            sharedStopLabels:
              edge
                .sharedStopLabels ??
              [],
          },
        ],
      });
    }
  }

  return null;
};

const buildFareInfo = () => ({
  exactFareAvailable:
    false as const,

  currency:
    runtime.fares.currency,

  effectiveFrom:
    runtime.fares
      .effectiveFrom,

  effectiveTo:
    runtime.fares
      .effectiveTo,

  peakRange:
    runtime.fares
      .peakPublishedRange,

  offPeakRange:
    runtime.fares
      .offPeakPublishedRange,
});

const unsupportedResult = (
  originMatches: ReaVayaRouteAccess[],
  destinationMatches: ReaVayaRouteAccess[],
): ReaVayaApplicabilityResult => ({
  status:
    "unsupported",

  originMatches,
  destinationMatches,

  selectedRoutes: [],
  transfers: [],

  direct:
    false,

  accessDistanceKm:
    originMatches[0]
      ?.distanceKm ??
    null,

  egressDistanceKm:
    destinationMatches[0]
      ?.distanceKm ??
    null,

  totalAccessWalkingKm:
    originMatches.length &&
    destinationMatches.length
      ? Math.round(
          (
            originMatches[0]
              .distanceKm +
            destinationMatches[0]
              .distanceKm
          ) *
            1000,
        ) / 1000
      : null,

  evidence:
    "insufficient-evidence",

  fare:
    buildFareInfo(),

  time: {
    exactJourneyTimeAvailable:
      false,
  },

  limitations: [
    "No sufficiently verified Rea Vaya path was established using the current canonical route geometry and published shared-stop connectivity.",
    "Complementary routes without canonical runtime geometry are not spatially traversed.",
    "No exact fare, timetable or live ETA is inferred.",
  ],
});

export class ReaVayaApplicabilityEngine {
  static evaluate(
    origin: ReaVayaCoordinates,
    destination: ReaVayaCoordinates,
    options: {
      maxAccessKm?: number;
    } = {},
  ): ReaVayaApplicabilityResult {
    const maxAccessKm =
      options.maxAccessKm ??
      DEFAULT_MAX_ACCESS_KM;

    const originMatches =
      findAccessibleRoutes(
        origin,
        maxAccessKm,
      );

    const destinationMatches =
      findAccessibleRoutes(
        destination,
        maxAccessKm,
      );

    if (
      originMatches.length ===
        0 ||
      destinationMatches.length ===
        0
    ) {
      return unsupportedResult(
        originMatches,
        destinationMatches,
      );
    }

    const destinationCodes =
      new Set(
        destinationMatches.map(
          (match) =>
            match.routeCode,
        ),
      );

    // --------------------------------------------------------
    // DIRECT
    // --------------------------------------------------------

    const directMatches =
      originMatches.filter(
        (match) =>
          destinationCodes.has(
            match.routeCode,
          ),
      );

    if (
      directMatches.length >
      0
    ) {
      const selected =
        directMatches[0];

      const destinationMatch =
        destinationMatches.find(
          (match) =>
            match.routeCode ===
            selected.routeCode,
        );

      if (!destinationMatch) {
        return unsupportedResult(
          originMatches,
          destinationMatches,
        );
      }

      return {
        status:
          "direct",

        originMatches,
        destinationMatches,

        selectedRoutes: [
          selected.routeCode,
        ],

        transfers: [],

        direct:
          true,

        accessDistanceKm:
          selected.distanceKm,

        egressDistanceKm:
          destinationMatch.distanceKm,

        totalAccessWalkingKm:
          Math.round(
            (
              selected.distanceKm +
              destinationMatch.distanceKm
            ) *
              1000,
          ) / 1000,

        evidence:
          "same-canonical-route",

        fare:
          buildFareInfo(),

        time: {
          exactJourneyTimeAvailable:
            false,
        },

        limitations: [
          "The same canonical Rea Vaya route geometry is near both journey endpoints.",
          "Service direction is not yet verified from the runtime dataset.",
          "No exact passenger fare, departure time or live ETA is inferred.",
        ],
      };
    }

    // --------------------------------------------------------
    // TRANSFER PATH
    // --------------------------------------------------------

    const path =
      findPublishedPath(
        originMatches.map(
          (match) =>
            match.routeCode,
        ),
        destinationCodes,
      );

    if (!path) {
      return unsupportedResult(
        originMatches,
        destinationMatches,
      );
    }

    const originSelected =
      originMatches.find(
        (match) =>
          match.routeCode ===
          path.routes[0],
      );

    const finalRoute =
      path.routes[
        path.routes.length - 1
      ];

    const destinationSelected =
      destinationMatches.find(
        (match) =>
          match.routeCode ===
          finalRoute,
      );

    if (
      !originSelected ||
      !destinationSelected
    ) {
      return unsupportedResult(
        originMatches,
        destinationMatches,
      );
    }

    return {
      status:
        "transfer",

      originMatches,
      destinationMatches,

      selectedRoutes:
        path.routes,

      transfers:
        path.transfers,

      direct:
        false,

      accessDistanceKm:
        originSelected
          .distanceKm,

      egressDistanceKm:
        destinationSelected
          .distanceKm,

      totalAccessWalkingKm:
        Math.round(
          (
            originSelected
              .distanceKm +
            destinationSelected
              .distanceKm
          ) *
            1000,
        ) / 1000,

      evidence:
        "published-shared-stop-connectivity",

      fare:
        buildFareInfo(),

      time: {
        exactJourneyTimeAvailable:
          false,
      },

      limitations: [
        "Every route-to-route graph edge is supported by published shared-stop evidence.",
        "Published shared-stop evidence does not guarantee a timed or operational transfer.",
        "Service direction and exact transfer walking path remain unverified.",
        "No exact passenger fare, departure time or live ETA is inferred.",
      ],
    };
  }
}