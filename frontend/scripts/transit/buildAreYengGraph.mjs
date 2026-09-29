import fs from "node:fs/promises";
import path from "node:path";

// ============================================================
// Pulse Transit - A Re Yeng Graph Builder
//
// INPUT:
//   normalized-stops.json
//   normalized-routes.json
//
// OUTPUT:
//   graph.json
//   graph-report.json
//
// IMPORTANT:
// Route-stop membership and stop ordering are inferred from
// official GIS geometry. They are NOT treated as officially
// published route-stop assignments.
//
// Direction of travel is also NOT assumed from geometry.
// ============================================================

const ROOT = path.resolve(
  "src/data/transit/gauteng/areyeng"
);

const STOPS_FILE = path.join(
  ROOT,
  "normalized-stops.json"
);

const ROUTES_FILE = path.join(
  ROOT,
  "normalized-routes.json"
);

const GRAPH_FILE = path.join(
  ROOT,
  "graph.json"
);

const REPORT_FILE = path.join(
  ROOT,
  "graph-report.json"
);

const EARTH_RADIUS_M = 6_371_000;

// ============================================================
// BASIC GEO HELPERS
// ============================================================

const toRadians = (degrees) =>
  (degrees * Math.PI) / 180;

const haversineMeters = (
  lat1,
  lng1,
  lat2,
  lng2
) => {
  const dLat =
    toRadians(lat2 - lat1);

  const dLng =
    toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return EARTH_RADIUS_M * c;
};

const isValidCoordinate = (coordinate) => {
  if (
    !Array.isArray(coordinate) ||
    coordinate.length < 2
  ) {
    return false;
  }

  const lng = Number(coordinate[0]);
  const lat = Number(coordinate[1]);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

const getRouteParts = (geometry) => {
  if (!geometry) {
    return [];
  }

  if (
    geometry.type === "LineString" &&
    Array.isArray(geometry.coordinates)
  ) {
    return [geometry.coordinates];
  }

  if (
    geometry.type === "MultiLineString" &&
    Array.isArray(geometry.coordinates)
  ) {
    return geometry.coordinates;
  }

  return [];
};

// ============================================================
// PROJECT STOP ONTO A ROUTE SEGMENT
// ============================================================

const projectPointToSegment = (
  pointLng,
  pointLat,
  aLng,
  aLat,
  bLng,
  bLat
) => {
  const referenceLat =
    toRadians(pointLat);

  const toXY = (lng, lat) => ({
    x:
      EARTH_RADIUS_M *
      toRadians(lng - pointLng) *
      Math.cos(referenceLat),

    y:
      EARTH_RADIUS_M *
      toRadians(lat - pointLat),
  });

  const a =
    toXY(aLng, aLat);

  const b =
    toXY(bLng, bLat);

  const dx =
    b.x - a.x;

  const dy =
    b.y - a.y;

  const lengthSquared =
    dx * dx + dy * dy;

  let t = 0;

  if (lengthSquared > 0) {
    t =
      -(a.x * dx + a.y * dy) /
      lengthSquared;

    t = Math.max(
      0,
      Math.min(1, t)
    );
  }

  const projectedX =
    a.x + t * dx;

  const projectedY =
    a.y + t * dy;

  const distanceM =
    Math.sqrt(
      projectedX * projectedX +
      projectedY * projectedY
    );

  const projectedLng =
    aLng +
    (bLng - aLng) * t;

  const projectedLat =
    aLat +
    (bLat - aLat) * t;

  return {
    fraction: t,
    distanceM,
    projectedLng,
    projectedLat,
  };
};

// ============================================================
// PREPARE ROUTE PARTS
// ============================================================

const prepareRouteParts = (geometry) => {
  const rawParts =
    getRouteParts(geometry);

  let routeOffsetM = 0;

  return rawParts.map(
    (coordinates, partIndex) => {
      const segments = [];

      let partDistanceM = 0;

      for (
        let i = 0;
        i < coordinates.length - 1;
        i += 1
      ) {
        const start =
          coordinates[i];

        const end =
          coordinates[i + 1];

        if (
          !isValidCoordinate(start) ||
          !isValidCoordinate(end)
        ) {
          continue;
        }

        const startLng =
          Number(start[0]);

        const startLat =
          Number(start[1]);

        const endLng =
          Number(end[0]);

        const endLat =
          Number(end[1]);

        const segmentLengthM =
          haversineMeters(
            startLat,
            startLng,
            endLat,
            endLng
          );

        segments.push({
          segmentIndex: i,

          start: {
            lat: startLat,
            lng: startLng,
          },

          end: {
            lat: endLat,
            lng: endLng,
          },

          segmentLengthM,

          startDistanceAlongPartM:
            partDistanceM,

          startDistanceAlongRouteM:
            routeOffsetM +
            partDistanceM,
        });

        partDistanceM +=
          segmentLengthM;
      }

      const result = {
        partIndex,
        lengthMeters:
          partDistanceM,
        routeOffsetMeters:
          routeOffsetM,
        segments,
      };

      routeOffsetM +=
        partDistanceM;

      return result;
    }
  );
};

// ============================================================
// FIND CLOSEST POSITION ON ROUTE
// ============================================================

const locateStopOnRoute = (
  stop,
  preparedParts
) => {
  let best = null;

  for (
    const part of preparedParts
  ) {
    for (
      const segment of part.segments
    ) {
      const projection =
        projectPointToSegment(
          stop.location.lng,
          stop.location.lat,
          segment.start.lng,
          segment.start.lat,
          segment.end.lng,
          segment.end.lat
        );

      if (
        best !== null &&
        projection.distanceM >=
          best.distanceToGeometryM
      ) {
        continue;
      }

      const segmentProgressM =
        segment.segmentLengthM *
        projection.fraction;

      best = {
        partIndex:
          part.partIndex,

        segmentIndex:
          segment.segmentIndex,

        fractionAlongSegment:
          projection.fraction,

        distanceToGeometryM:
          projection.distanceM,

        distanceAlongPartM:
          segment.startDistanceAlongPartM +
          segmentProgressM,

        distanceAlongRouteM:
          segment.startDistanceAlongRouteM +
          segmentProgressM,

        projectedLocation: {
          lat:
            projection.projectedLat,

          lng:
            projection.projectedLng,
        },
      };
    }
  }

  return best;
};

// ============================================================
// BUILD ONE ROUTE
// ============================================================

const buildRouteGraph = (
  route,
  allStops
) => {
  const preparedParts =
    prepareRouteParts(
      route.geometry
    );

  const candidateStopSet =
    new Set(
      route.candidateStopIds ?? []
    );

  const candidateStops =
    allStops.filter(
      (stop) =>
        candidateStopSet.has(
          stop.id
        )
    );

  const locatedStops =
    candidateStops
      .map((stop) => {
        const position =
          locateStopOnRoute(
            stop,
            preparedParts
          );

        if (!position) {
          return null;
        }

        return {
          stopId: stop.id,
          stopName: stop.name,

          location:
            stop.location,

          partIndex:
            position.partIndex,

          segmentIndex:
            position.segmentIndex,

          fractionAlongSegment:
            Number(
              position
                .fractionAlongSegment
                .toFixed(6)
            ),

          distanceToGeometryM:
            Math.round(
              position
                .distanceToGeometryM
            ),

          distanceAlongPartM:
            Math.round(
              position
                .distanceAlongPartM
            ),

          distanceAlongRouteM:
            Math.round(
              position
                .distanceAlongRouteM
            ),

          projectedLocation:
            position
              .projectedLocation,
        };
      })
      .filter(Boolean);

  const stopsByPart =
    new Map();

  for (
    const located of
      locatedStops
  ) {
    if (
      !stopsByPart.has(
        located.partIndex
      )
    ) {
      stopsByPart.set(
        located.partIndex,
        []
      );
    }

    stopsByPart
      .get(located.partIndex)
      .push(located);
  }

  const parts = [];

  const adjacencyCandidates = [];

  for (
    const part of preparedParts
  ) {
    const partStops =
      stopsByPart.get(
        part.partIndex
      ) ?? [];

    partStops.sort(
      (a, b) =>
        a.distanceAlongPartM -
        b.distanceAlongPartM
    );

    const edges = [];

    for (
      let index = 0;
      index <
      partStops.length - 1;
      index += 1
    ) {
      const from =
        partStops[index];

      const to =
        partStops[index + 1];

      const routeDistanceM =
        Math.max(
          0,
          to.distanceAlongPartM -
            from.distanceAlongPartM
        );

      const edge = {
        id:
          `${route.id}:part-${part.partIndex}:${from.stopId}:${to.stopId}`,

        routeId:
          route.id,

        routeCode:
          route.code,

        partIndex:
          part.partIndex,

        fromStopId:
          from.stopId,

        toStopId:
          to.stopId,

        distanceAlongGeometryM:
          routeDistanceM,

        relationship:
          "gis-geometry-adjacency",

        direction:
          "unverified",
      };

      edges.push(edge);

      adjacencyCandidates.push(
        edge
      );
    }

    parts.push({
      partIndex:
        part.partIndex,

      geometryLengthM:
        Math.round(
          part.lengthMeters
        ),

      orderedStops:
        partStops,

      edges,
    });
  }

  const orderedStops =
    [...locatedStops].sort(
      (a, b) => {
        if (
          a.partIndex !==
          b.partIndex
        ) {
          return (
            a.partIndex -
            b.partIndex
          );
        }

        return (
          a.distanceAlongPartM -
          b.distanceAlongPartM
        );
      }
    );

  return {
    id:
      route.id,

    operatorId:
      route.operatorId,

    code:
      route.code,

    name:
      route.name,

    type:
      route.type,

    geometryType:
      route.geometry?.type ??
      null,

    geometry:
      route.geometry,

    sourceLengthMeters:
      route.lengthMeters,

    computedGeometryLengthMeters:
      Math.round(
        preparedParts.reduce(
          (sum, part) =>
            sum +
            part.lengthMeters,
          0
        )
      ),

    sequenceMethod:
      "projection-on-official-gis-route",

    sequenceConfidence:
      route.geometry?.type ===
      "LineString"
        ? "medium"
        : "provisional",

    serviceDirection:
      "unverified",

    candidateStopCount:
      orderedStops.length,

    orderedStops,

    parts,

    adjacencyCandidates,

    source:
      route.source,
  };
};

// ============================================================
// TRANSFER CANDIDATES
// ============================================================

const buildTransferCandidates = (
  stops
) => {
  return stops
    .filter(
      (stop) =>
        Array.isArray(
          stop.candidateRoutes
        ) &&
        stop.candidateRoutes
          .length > 1
    )
    .map((stop) => ({
      stopId:
        stop.id,

      stopName:
        stop.name,

      location:
        stop.location,

      routeIds:
        stop.candidateRoutes.map(
          (route) =>
            route.routeId
        ),

      routeCodes:
        stop.candidateRoutes.map(
          (route) =>
            route.routeCode
        ),

      relationship:
        "shared-gis-stop-candidate",

      confidence:
        "provisional",

      note:
        "Multiple route geometries pass close to this official stop point. Transfer/service relationship requires further verification.",
    }));
};

// ============================================================
// BUILD REPORT
// ============================================================

const buildReport = (
  routes,
  transferCandidates
) => {
  const routeSummary =
    routes.map((route) => {
      const allEdges =
        route.adjacencyCandidates;

      const gapDistances =
        allEdges.map(
          (edge) =>
            edge.distanceAlongGeometryM
        );

      const maxGapM =
        gapDistances.length
          ? Math.max(
              ...gapDistances
            )
          : null;

      const avgGapM =
        gapDistances.length
          ? Math.round(
              gapDistances.reduce(
                (sum, distance) =>
                  sum +
                  distance,
                0
              ) /
                gapDistances.length
            )
          : null;

      return {
        routeId:
          route.id,

        code:
          route.code,

        type:
          route.type,

        name:
          route.name,

        geometryType:
          route.geometryType,

        candidateStopCount:
          route.candidateStopCount,

        partCount:
          route.parts.length,

        adjacencyCount:
          route
            .adjacencyCandidates
            .length,

        maxGapM,

        avgGapM,

        sequenceConfidence:
          route.sequenceConfidence,
      };
    });

  return {
    generatedAt:
      new Date().toISOString(),

    operatorId:
      "areyeng",

    sourceAuthority:
      "City of Tshwane",

    routeCount:
      routes.length,

    sharedStopCandidateCount:
      transferCandidates.length,

    routeSummary,

    warnings: [
      "Route-stop membership is inferred from spatial proximity.",
      "Stop ordering is inferred by projection onto official GIS route geometry.",
      "Geometry direction is not assumed to equal actual service direction.",
      "MultiLineString ordering is provisional until service topology is independently verified.",
      "Shared stops are candidate transfer/service points, not confirmed transfer instructions.",
    ],
  };
};

// ============================================================
// MAIN
// ============================================================

const main = async () => {
  console.log("");
  console.log(
    "=============================================="
  );

  console.log(
    " Pulse Transit - A Re Yeng Graph Builder"
  );

  console.log(
    "=============================================="
  );

  console.log("");

  const [
    stopsRaw,
    routesRaw,
  ] = await Promise.all([
    fs.readFile(
      STOPS_FILE,
      "utf8"
    ),

    fs.readFile(
      ROUTES_FILE,
      "utf8"
    ),
  ]);

  const stops =
    JSON.parse(stopsRaw);

  const normalizedRoutes =
    JSON.parse(routesRaw);

  if (!Array.isArray(stops)) {
    throw new Error(
      "normalized-stops.json must contain an array"
    );
  }

  if (
    !Array.isArray(
      normalizedRoutes
    )
  ) {
    throw new Error(
      "normalized-routes.json must contain an array"
    );
  }

  const graphRoutes =
    normalizedRoutes.map(
      (route) =>
        buildRouteGraph(
          route,
          stops
        )
    );

  const transferCandidates =
    buildTransferCandidates(
      stops
    );

  const graph = {
    schemaVersion: 1,

    generatedAt:
      new Date().toISOString(),

    operator: {
      id:
        "areyeng",

      name:
        "A Re Yeng",

      authority:
        "City of Tshwane",
    },

    routes:
      graphRoutes,

    stops:
      stops.map(
        (stop) => ({
          id:
            stop.id,

          name:
            stop.name,

          location:
            stop.location,

          candidateRoutes:
            stop.candidateRoutes,

          source:
            stop.source,
        })
      ),

    transferCandidates,
  };

  const report =
    buildReport(
      graphRoutes,
      transferCandidates
    );

  await fs.writeFile(
    GRAPH_FILE,
    JSON.stringify(
      graph,
      null,
      2
    ),
    "utf8"
  );

  await fs.writeFile(
    REPORT_FILE,
    JSON.stringify(
      report,
      null,
      2
    ),
    "utf8"
  );

  console.log(
    `Routes built: ${report.routeCount}`
  );

  console.log(
    `Shared-stop candidates: ${report.sharedStopCandidateCount}`
  );

  console.log("");
  console.log(
    "Route graph summary:"
  );

  for (
    const route of
      report.routeSummary
  ) {
    console.log("");

    console.log(
      `${route.code} — ${route.name}`
    );

    console.log(
      `  Geometry: ${route.geometryType}`
    );

    console.log(
      `  Parts: ${route.partCount}`
    );

    console.log(
      `  Ordered stops: ${route.candidateStopCount}`
    );

    console.log(
      `  Stop-to-stop edges: ${route.adjacencyCount}`
    );

    console.log(
      `  Average gap: ${
        route.avgGapM === null
          ? "n/a"
          : `${route.avgGapM} m`
      }`
    );

    console.log(
      `  Largest gap: ${
        route.maxGapM === null
          ? "n/a"
          : `${route.maxGapM} m`
      }`
    );

    console.log(
      `  Sequence confidence: ${route.sequenceConfidence}`
    );
  }

  console.log("");
  console.log(
    "Created:"
  );

  console.log(
    `  ${GRAPH_FILE}`
  );

  console.log(
    `  ${REPORT_FILE}`
  );

  console.log("");

  console.log(
    "Important: service direction remains unverified."
  );

  console.log("");
};

main().catch((error) => {
  console.error("");
  console.error(
    "A Re Yeng graph build failed:"
  );

  console.error(error);

  process.exitCode = 1;
});