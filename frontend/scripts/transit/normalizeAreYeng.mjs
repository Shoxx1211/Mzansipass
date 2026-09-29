import fs from "node:fs/promises";
import path from "node:path";

// ============================================================
// Pulse Transit - A Re Yeng Normalizer
//
// INPUTS:
//   src/data/transit/gauteng/areyeng/stops.geojson
//   src/data/transit/gauteng/areyeng/routes.geojson
//
// OUTPUTS:
//   normalized-stops.json
//   normalized-routes.json
//   normalization-report.json
//
// IMPORTANT:
// Stop -> route relationships in this file are SPATIAL
// CANDIDATES. They are not presented as official route-stop
// assignments unless a future official source confirms them.
// ============================================================

const ROOT = path.resolve(
  "src/data/transit/gauteng/areyeng"
);

const STOPS_FILE = path.join(ROOT, "stops.geojson");
const ROUTES_FILE = path.join(ROOT, "routes.geojson");

const NORMALIZED_STOPS_FILE = path.join(
  ROOT,
  "normalized-stops.json"
);

const NORMALIZED_ROUTES_FILE = path.join(
  ROOT,
  "normalized-routes.json"
);

const REPORT_FILE = path.join(
  ROOT,
  "normalization-report.json"
);

// GIS centre-lines and stop points are not always perfectly aligned.
// This is a matching tolerance, NOT an official walking distance.
const MATCH_THRESHOLD_METERS =
  Number(process.env.AREYENG_MATCH_THRESHOLD_M ?? 35);

const EARTH_RADIUS_M = 6_371_000;

// ============================================================
// BASIC HELPERS
// ============================================================

const toRadians = (degrees) =>
  (degrees * Math.PI) / 180;

const safeNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const cleanText = (value) =>
  typeof value === "string"
    ? value.trim()
    : "";

const slugify = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// ============================================================
// ROUTE TYPE NORMALIZATION
// ============================================================

const normalizeRouteType = (value) => {
  const text = cleanText(value).toLowerCase();

  if (text.includes("feeder")) {
    return "feeder";
  }

  if (text.includes("complementary")) {
    return "complementary";
  }

  if (text.includes("trunk")) {
    return "trunk";
  }

  return "unknown";
};

// ============================================================
// GEOJSON HELPERS
// ============================================================

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

// ============================================================
// POINT -> ROUTE DISTANCE
//
// Uses a local equirectangular projection around the stop.
// Accurate enough for short distances such as determining
// whether a GIS point is near a route centre-line.
// ============================================================

const pointToSegmentDistanceMeters = (
  pointLng,
  pointLat,
  aLng,
  aLat,
  bLng,
  bLat
) => {
  const latReference = toRadians(pointLat);

  const project = (lng, lat) => ({
    x:
      EARTH_RADIUS_M *
      toRadians(lng - pointLng) *
      Math.cos(latReference),

    y:
      EARTH_RADIUS_M *
      toRadians(lat - pointLat),
  });

  const a = project(aLng, aLat);
  const b = project(bLng, bLat);

  const abX = b.x - a.x;
  const abY = b.y - a.y;

  const lengthSquared =
    abX * abX + abY * abY;

  if (lengthSquared === 0) {
    return Math.sqrt(
      a.x * a.x +
      a.y * a.y
    );
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      -(
        a.x * abX +
        a.y * abY
      ) / lengthSquared
    )
  );

  const closestX =
    a.x + t * abX;

  const closestY =
    a.y + t * abY;

  return Math.sqrt(
    closestX * closestX +
    closestY * closestY
  );
};

const distanceToRouteMeters = (
  lng,
  lat,
  geometry
) => {
  const parts = getRouteParts(geometry);

  let bestDistance = Infinity;

  for (const part of parts) {
    if (!Array.isArray(part)) {
      continue;
    }

    for (
      let index = 0;
      index < part.length - 1;
      index += 1
    ) {
      const start = part[index];
      const end = part[index + 1];

      if (
        !isValidCoordinate(start) ||
        !isValidCoordinate(end)
      ) {
        continue;
      }

      const distance =
        pointToSegmentDistanceMeters(
          lng,
          lat,
          Number(start[0]),
          Number(start[1]),
          Number(end[0]),
          Number(end[1])
        );

      if (distance < bestDistance) {
        bestDistance = distance;
      }
    }
  }

  return Number.isFinite(bestDistance)
    ? bestDistance
    : null;
};

// ============================================================
// MATCH CONFIDENCE
//
// This describes geometric closeness only.
// It does NOT mean that the route-stop relationship has been
// officially confirmed.
// ============================================================

const getSpatialConfidence = (distanceM) => {
  if (distanceM <= 30) {
    return "high";
  }

  if (distanceM <= 60) {
    return "medium";
  }

  return "low";
};

// ============================================================
// READ GEOJSON
// ============================================================

const readGeoJson = async (filename) => {
  const raw = await fs.readFile(
    filename,
    "utf8"
  );

  const data = JSON.parse(raw);

  if (
    data?.type !== "FeatureCollection" ||
    !Array.isArray(data.features)
  ) {
    throw new Error(
      `${filename} is not a valid GeoJSON FeatureCollection`
    );
  }

  return data;
};

// ============================================================
// NORMALIZE ROUTES
// ============================================================

const normalizeRoutes = (routeFeatures) => {
  return routeFeatures.map((feature) => {
    const properties =
      feature.properties ?? {};

    const objectId =
      safeNumber(properties.OBJECTID);

    const code =
      cleanText(properties.Route_Code);

    const description =
      cleanText(
        properties.Route_Description
      );

    const rawType =
      cleanText(properties.Route_Type);

    const lengthMeters =
      safeNumber(
        properties["Shape.STLength()"]
      );

    return {
      id:
        objectId !== null
          ? `areyeng-route-${objectId}`
          : `areyeng-route-${slugify(code)}`,

      operatorId: "areyeng",

      code,

      name:
        description ||
        code ||
        "Unnamed A Re Yeng route",

      type: normalizeRouteType(rawType),

      rawRouteType: rawType,

      lengthMeters:
        lengthMeters !== null
          ? Math.round(lengthMeters)
          : null,

      geometry: feature.geometry,

      candidateStopIds: [],

      source: {
        authority: "City of Tshwane",
        dataset: "A Re Yeng Route",
        sourceType: "official-gis",
        rawObjectId: objectId,
      },
    };
  });
};

// ============================================================
// NORMALIZE STOPS
// ============================================================

const normalizeStops = (
  stopFeatures,
  normalizedRoutes
) => {
  return stopFeatures
    .map((feature) => {
      const properties =
        feature.properties ?? {};

      const geometry =
        feature.geometry;

      if (
        geometry?.type !== "Point" ||
        !isValidCoordinate(
          geometry.coordinates
        )
      ) {
        return null;
      }

      const objectId =
        safeNumber(properties.OBJECTID);

      const name =
        cleanText(properties.Label);

      const lng =
        Number(
          geometry.coordinates[0]
        );

      const lat =
        Number(
          geometry.coordinates[1]
        );

      const candidateRoutes = [];

      for (
        const route of normalizedRoutes
      ) {
        const distanceM =
          distanceToRouteMeters(
            lng,
            lat,
            route.geometry
          );

        if (
          distanceM === null ||
          distanceM >
            MATCH_THRESHOLD_METERS
        ) {
          continue;
        }

        candidateRoutes.push({
          routeId: route.id,
          routeCode: route.code,
          distanceToRouteM:
            Math.round(distanceM),
          confidence:
            getSpatialConfidence(
              distanceM
            ),
          matchMethod:
            "spatial-proximity",
        });
      }

      candidateRoutes.sort(
        (a, b) =>
          a.distanceToRouteM -
          b.distanceToRouteM
      );

      return {
        id:
          objectId !== null
            ? `areyeng-stop-${objectId}`
            : `areyeng-stop-${slugify(name)}`,

        operatorId: "areyeng",

        name:
          name ||
          `A Re Yeng stop ${objectId ?? ""}`.trim(),

        location: {
          lat,
          lng,
        },

        candidateRoutes,

        source: {
          authority:
            "City of Tshwane",
          dataset:
            "A Re Yeng Station or Stop",
          sourceType:
            "official-gis",
          rawObjectId:
            objectId,
        },
      };
    })
    .filter(Boolean);
};

// ============================================================
// LINK ROUTE -> CANDIDATE STOPS
// ============================================================

const attachCandidateStopsToRoutes = (
  routes,
  stops
) => {
  const routeMap = new Map(
    routes.map((route) => [
      route.id,
      route,
    ])
  );

  for (const stop of stops) {
    for (
      const candidate of
        stop.candidateRoutes
    ) {
      const route =
        routeMap.get(
          candidate.routeId
        );

      if (!route) {
        continue;
      }

      route.candidateStopIds.push(
        stop.id
      );
    }
  }

  for (const route of routes) {
    route.candidateStopIds =
      [...new Set(
        route.candidateStopIds
      )];
  }

  return routes;
};

// ============================================================
// REPORT
// ============================================================

const buildReport = (
  routes,
  stops
) => {
  const unmatchedStops =
    stops.filter(
      (stop) =>
        stop.candidateRoutes.length === 0
    );

  const multiMatchedStops =
    stops.filter(
      (stop) =>
        stop.candidateRoutes.length > 1
    );

  const routeSummary =
    routes.map((route) => ({
      id: route.id,
      code: route.code,
      type: route.type,
      name: route.name,
      geometryType:
        route.geometry?.type ??
        null,
      candidateStopCount:
        route.candidateStopIds.length,
    }));

  const distanceBuckets = {
    "0-30m": 0,
    "31-60m": 0,
    "61-120m": 0,
  };

  for (const stop of stops) {
    if (
      stop.candidateRoutes.length === 0
    ) {
      continue;
    }

    const closest =
      stop.candidateRoutes[0]
        .distanceToRouteM;

    if (closest <= 30) {
      distanceBuckets["0-30m"] += 1;
    } else if (closest <= 60) {
      distanceBuckets["31-60m"] += 1;
    } else {
      distanceBuckets["61-120m"] += 1;
    }
  }

  return {
    generatedAt:
      new Date().toISOString(),

    operatorId: "areyeng",

    sourceAuthority:
      "City of Tshwane",

    matchThresholdMeters:
      MATCH_THRESHOLD_METERS,

    totalStops:
      stops.length,

    totalRoutes:
      routes.length,

    stopsWithCandidateRoute:
      stops.length -
      unmatchedStops.length,

    unmatchedStopCount:
      unmatchedStops.length,

    multiMatchedStopCount:
      multiMatchedStops.length,

    closestRouteDistanceBuckets:
      distanceBuckets,

    routeSummary,

    unmatchedStops:
      unmatchedStops.map(
        (stop) => ({
          id: stop.id,
          name: stop.name,
          location:
            stop.location,
        })
      ),

    note:
      "Candidate route-stop links are inferred from GIS proximity and are not yet official route-stop assignments.",
  };
};

// ============================================================
// MAIN
// ============================================================

const main = async () => {
  console.log("");
  console.log(
    "============================================"
  );
  console.log(
    " Pulse Transit - A Re Yeng Normalizer"
  );
  console.log(
    "============================================"
  );
  console.log("");

  console.log(
    `Spatial candidate threshold: ${MATCH_THRESHOLD_METERS} m`
  );

  const [
    stopsGeoJson,
    routesGeoJson,
  ] = await Promise.all([
    readGeoJson(STOPS_FILE),
    readGeoJson(ROUTES_FILE),
  ]);

  console.log(
    `Raw stops: ${stopsGeoJson.features.length}`
  );

  console.log(
    `Raw routes: ${routesGeoJson.features.length}`
  );

  let routes =
    normalizeRoutes(
      routesGeoJson.features
    );

  const stops =
    normalizeStops(
      stopsGeoJson.features,
      routes
    );

  routes =
    attachCandidateStopsToRoutes(
      routes,
      stops
    );

  const report =
    buildReport(
      routes,
      stops
    );

  await fs.writeFile(
    NORMALIZED_STOPS_FILE,
    JSON.stringify(
      stops,
      null,
      2
    ),
    "utf8"
  );

  await fs.writeFile(
    NORMALIZED_ROUTES_FILE,
    JSON.stringify(
      routes,
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

  console.log("");
  console.log(
    "Normalization complete."
  );

  console.log(
    `Stops normalized: ${report.totalStops}`
  );

  console.log(
    `Routes normalized: ${report.totalRoutes}`
  );

  console.log(
    `Stops near at least one route: ${report.stopsWithCandidateRoute}`
  );

  console.log(
    `Stops without a route candidate: ${report.unmatchedStopCount}`
  );

  console.log(
    `Stops near multiple routes: ${report.multiMatchedStopCount}`
  );

  console.log("");
  console.log(
    "Closest-route distribution:"
  );

  console.log(
    `  0-30 m:   ${report.closestRouteDistanceBuckets["0-30m"]}`
  );

  console.log(
    `  31-60 m:  ${report.closestRouteDistanceBuckets["31-60m"]}`
  );

  console.log(
    `  61-120 m: ${report.closestRouteDistanceBuckets["61-120m"]}`
  );

  console.log("");
  console.log(
    "Route candidate-stop counts:"
  );

  for (
    const route of
      report.routeSummary
  ) {
    console.log(
      `  ${route.code.padEnd(16)} ${String(route.candidateStopCount).padStart(3)} candidate stops`
    );
  }

  console.log("");
  console.log(
    "Created:"
  );

  console.log(
    `  ${NORMALIZED_STOPS_FILE}`
  );

  console.log(
    `  ${NORMALIZED_ROUTES_FILE}`
  );

  console.log(
    `  ${REPORT_FILE}`
  );

  console.log("");
  console.log(
    "Important: candidate route-stop links are spatial inferences, not yet official stop assignments."
  );

  console.log("");
};

main().catch((error) => {
  console.error("");
  console.error(
    "A Re Yeng normalization failed:"
  );
  console.error(error);
  process.exitCode = 1;
});