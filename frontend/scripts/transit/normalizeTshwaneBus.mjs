import fs from "node:fs/promises";
import path from "node:path";

// ============================================================
// Pulse Transit - Tshwane Bus Services Normalizer
//
// INPUT
//   src/data/transit/gauteng/tshwane-bus/stops.geojson
//   src/data/transit/gauteng/tshwane-bus/routes.geojson
//
// NOTE
// The City GIS layer called "stops" contains route endpoint /
// terminal points, not a complete roadside bus-stop dataset.
//
// OUTPUT
//   normalized-terminals.json
//   normalized-routes.json
//   normalization-report.json
// ============================================================

const ROOT = path.resolve(
  "src/data/transit/gauteng/tshwane-bus"
);

const TERMINALS_SOURCE_FILE = path.join(
  ROOT,
  "stops.geojson"
);

const ROUTES_SOURCE_FILE = path.join(
  ROOT,
  "routes.geojson"
);

const TERMINALS_OUTPUT_FILE = path.join(
  ROOT,
  "normalized-terminals.json"
);

const ROUTES_OUTPUT_FILE = path.join(
  ROOT,
  "normalized-routes.json"
);

const REPORT_OUTPUT_FILE = path.join(
  ROOT,
  "normalization-report.json"
);

// ============================================================
// HELPERS
// ============================================================

const cleanText = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
};

const safeNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
};

const slugify = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const unique = (values) =>
  [...new Set(values)];

const splitRouteIds = (value) => {
  const text = cleanText(value);

  if (!text) {
    return [];
  }

  return unique(
    text
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
};

const isValidPoint = (geometry) => {
  if (
    geometry?.type !== "Point" ||
    !Array.isArray(geometry.coordinates) ||
    geometry.coordinates.length < 2
  ) {
    return false;
  }

  const lng = Number(
    geometry.coordinates[0]
  );

  const lat = Number(
    geometry.coordinates[1]
  );

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

const normalizeTerminalRole = (
  stopType,
  departureDesc
) => {
  const type =
    cleanText(stopType)
      .toLowerCase();

  const departure =
    cleanText(departureDesc)
      .toUpperCase();

  if (
    type === "from location" ||
    departure === "DP"
  ) {
    return "from";
  }

  if (
    type === "to location" ||
    departure === "T"
  ) {
    return "to";
  }

  return "unknown";
};

// ============================================================
// GEOJSON READER
// ============================================================

const readFeatureCollection = async (
  filename
) => {
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
// NORMALIZE TERMINALS
// ============================================================

const normalizeTerminals = (
  features
) => {
  const terminals = [];

  const skipped = [];

  for (const feature of features) {
    const properties =
      feature.properties ?? {};

    const objectId =
      safeNumber(
        properties.OBJECTID
      );

    if (
      !isValidPoint(
        feature.geometry
      )
    ) {
      skipped.push({
        objectId,
        reason:
          "Invalid or unsupported point geometry",
      });

      continue;
    }

    const lng =
      Number(
        feature.geometry.coordinates[0]
      );

    const lat =
      Number(
        feature.geometry.coordinates[1]
      );

    const routeIds =
      splitRouteIds(
        properties.Route_ID
      );

    const stopType =
      cleanText(
        properties.STOP_TYPE
      );

    const departureDesc =
      cleanText(
        properties.Departure_Desc
      );

    const role =
      normalizeTerminalRole(
        stopType,
        departureDesc
      );

    const locationType =
      cleanText(
        properties.STOP_TYPE_LOCATION
      );

    const rawRouteLabel =
      cleanText(
        properties.Route_Label
      );

    const routeDescription =
      cleanText(
        properties.Route_description
      );

    const status =
      cleanText(
        properties.Status
      );

    terminals.push({
      id:
        objectId !== null
          ? `tshwane-bus-terminal-${objectId}`
          : `tshwane-bus-terminal-${terminals.length + 1}`,

      operatorId:
        "tshwane-bus",

      role,

      routeIds,

      routeReferenceMethod:
        "official-route-id",

      location: {
        lat,
        lng,
      },

      locationType:
        locationType || null,

      rawRouteLabel:
        rawRouteLabel || null,

      routeDescription:
        routeDescription || null,

      status:
        status || null,

      sourceFields: {
        stopType:
          stopType || null,

        departureDesc:
          departureDesc || null,
      },

      source: {
        authority:
          "City of Tshwane",

        dataset:
          "Tshwane Bus Service Stops / Route Locations",

        sourceType:
          "official-gis",

        rawObjectId:
          objectId,
      },
    });
  }

  return {
    terminals,
    skipped,
  };
};

// ============================================================
// NORMALIZE ROUTE GEOMETRY FEATURES
// ============================================================

const normalizeRouteVariants = (
  features
) => {
  return features.map(
    (feature) => {
      const properties =
        feature.properties ?? {};

      const objectId =
        safeNumber(
          properties.OBJECTID
        );

      const routeId =
        cleanText(
          properties.Route_ID
        );

      const routeLabel =
        cleanText(
          properties.Route_Label
        );

      const alternate =
        cleanText(
          properties.Alternate
        );

      const status =
        cleanText(
          properties.Status
        );

      const sourceLengthMeters =
        safeNumber(
          properties.Shape_Length
        );

      const logicalRouteId =
        routeId
          ? `tshwane-bus-route-${slugify(routeId)}`
          : `tshwane-bus-route-object-${objectId ?? "unknown"}`;

      return {
        id:
          objectId !== null
            ? `${logicalRouteId}-shape-${objectId}`
            : `${logicalRouteId}-shape`,

        logicalRouteId,

        operatorId:
          "tshwane-bus",

        routeId:
          routeId || null,

        routeLabel:
          routeLabel || null,

        alternate:
          alternate || null,

        status:
          status || null,

        sourceLengthMeters:
          sourceLengthMeters !== null
            ? Math.round(
                sourceLengthMeters
              )
            : null,

        geometryType:
          feature.geometry?.type ??
          null,

        geometry:
          feature.geometry ?? null,

        source: {
          authority:
            "City of Tshwane",

          dataset:
            "Tshwane Bus Service Routes",

          sourceType:
            "official-gis",

          rawObjectId:
            objectId,
        },
      };
    }
  );
};

// ============================================================
// BUILD LOGICAL ROUTES
//
// Multiple geometry records may belong to one logical Route_ID.
// Example:
//   SCA Alternate 1
//   SCA Alternate 2
// ============================================================

const buildLogicalRoutes = (
  variants,
  terminals
) => {
  const routeMap =
    new Map();

  for (const variant of variants) {
    const key =
      variant.routeId ||
      variant.logicalRouteId;

    if (!routeMap.has(key)) {
      routeMap.set(
        key,
        []
      );
    }

    routeMap
      .get(key)
      .push(
        variant
      );
  }

  const routes = [];

  for (
    const [routeKey, routeVariants]
    of routeMap.entries()
  ) {
    const canonical =
      routeVariants[0];

    const routeId =
      canonical.routeId ||
      routeKey;

    const relatedTerminals =
      terminals.filter(
        (terminal) =>
          terminal.routeIds.includes(
            routeId
          )
      );

    const fromTerminalIds =
      relatedTerminals
        .filter(
          (terminal) =>
            terminal.role === "from"
        )
        .map(
          (terminal) =>
            terminal.id
        );

    const toTerminalIds =
      relatedTerminals
        .filter(
          (terminal) =>
            terminal.role === "to"
        )
        .map(
          (terminal) =>
            terminal.id
        );

    const unknownTerminalIds =
      relatedTerminals
        .filter(
          (terminal) =>
            terminal.role === "unknown"
        )
        .map(
          (terminal) =>
            terminal.id
        );

    const statuses =
      unique(
        routeVariants
          .map(
            (variant) =>
              variant.status
          )
          .filter(Boolean)
      );

    const descriptions =
      unique(
        relatedTerminals
          .map(
            (terminal) =>
              terminal.routeDescription
          )
          .filter(Boolean)
      );

    const labels =
      unique(
        routeVariants
          .map(
            (variant) =>
              variant.routeLabel
          )
          .filter(Boolean)
      );

    routes.push({
      id:
        canonical.logicalRouteId,

      operatorId:
        "tshwane-bus",

      routeId,

      name:
        labels[0] ||
        routeId,

      labels,

      statuses,

      approved:
        statuses.some(
          (status) =>
            status.toLowerCase() ===
            "approved"
        ),

      descriptions,

      geometryVariantCount:
        routeVariants.length,

      geometryVariants:
        routeVariants,

      terminals: {
        from:
          fromTerminalIds,

        to:
          toTerminalIds,

        unknown:
          unknownTerminalIds,

        all:
          relatedTerminals.map(
            (terminal) =>
              terminal.id
          ),
      },

      terminalRelationship:
        "official-route-id",

      source: {
        authority:
          "City of Tshwane",

        sourceType:
          "official-gis",
      },
    });
  }

  routes.sort(
    (a, b) =>
      a.routeId.localeCompare(
        b.routeId
      )
  );

  return routes;
};

// ============================================================
// REPORT
// ============================================================

const buildReport = ({
  sourceTerminalCount,
  sourceRouteFeatureCount,
  terminals,
  skippedTerminals,
  variants,
  routes,
}) => {
  const geometryRouteIds =
    new Set(
      variants
        .map(
          (variant) =>
            variant.routeId
        )
        .filter(Boolean)
    );

  const referencedRouteIds =
    unique(
      terminals.flatMap(
        (terminal) =>
          terminal.routeIds
      )
    );

  const unmatchedTerminalRouteIds =
    referencedRouteIds.filter(
      (routeId) =>
        !geometryRouteIds.has(
          routeId
        )
    );

  const routesWithoutTerminals =
    routes
      .filter(
        (route) =>
          route.terminals.all.length === 0
      )
      .map(
        (route) => ({
          routeId:
            route.routeId,

          name:
            route.name,
        })
      );

  const routesWithFromAndTo =
    routes.filter(
      (route) =>
        route.terminals.from.length > 0 &&
        route.terminals.to.length > 0
    );

  const routesWithOnlyFrom =
    routes.filter(
      (route) =>
        route.terminals.from.length > 0 &&
        route.terminals.to.length === 0
    );

  const routesWithOnlyTo =
    routes.filter(
      (route) =>
        route.terminals.to.length > 0 &&
        route.terminals.from.length === 0
    );

  const sharedTerminals =
    terminals.filter(
      (terminal) =>
        terminal.routeIds.length > 1
    );

  const alternateRoutes =
    routes
      .filter(
        (route) =>
          route.geometryVariantCount > 1
      )
      .map(
        (route) => ({
          routeId:
            route.routeId,

          name:
            route.name,

          variantCount:
            route.geometryVariantCount,

          alternates:
            route.geometryVariants.map(
              (variant) =>
                variant.alternate
            ),
        })
      );

  const geometryTypes =
    {};

  for (const variant of variants) {
    const type =
      variant.geometryType ||
      "Unknown";

    geometryTypes[type] =
      (geometryTypes[type] ?? 0) +
      1;
  }

  return {
    generatedAt:
      new Date().toISOString(),

    operatorId:
      "tshwane-bus",

    sourceAuthority:
      "City of Tshwane",

    sourceTerminalFeatureCount:
      sourceTerminalCount,

    normalizedTerminalCount:
      terminals.length,

    skippedTerminalCount:
      skippedTerminals.length,

    sourceRouteFeatureCount,

    normalizedGeometryVariantCount:
      variants.length,

    logicalRouteCount:
      routes.length,

    referencedRouteIdCount:
      referencedRouteIds.length,

    sharedTerminalCount:
      sharedTerminals.length,

    routesWithBothFromAndTo:
      routesWithFromAndTo.length,

    routesWithOnlyFrom:
      routesWithOnlyFrom.length,

    routesWithOnlyTo:
      routesWithOnlyTo.length,

    routesWithoutTerminalData:
      routesWithoutTerminals.length,

    unmatchedTerminalRouteIdCount:
      unmatchedTerminalRouteIds.length,

    unmatchedTerminalRouteIds,

    geometryTypes,

    alternateRoutes,

    routesWithoutTerminals,

    skippedTerminals,

    notes: [
      "The City GIS point layer is treated as route endpoint/terminal data, not as a complete roadside bus-stop dataset.",
      "Terminal-to-route relationships use the official Route_ID field rather than spatial inference.",
      "Comma-separated Route_ID values are treated as one terminal shared by multiple routes.",
      "Multiple geometry features with the same Route_ID are retained as variants of one logical route.",
      "No timetable, roadside stop sequence, fare or live arrival data is inferred by this normalizer."
    ],
  };
};

// ============================================================
// MAIN
// ============================================================

const main = async () => {
  console.log("");
  console.log(
    "================================================"
  );

  console.log(
    " Pulse Transit - Tshwane Bus Normalizer"
  );

  console.log(
    "================================================"
  );

  console.log("");

  const [
    terminalGeoJson,
    routeGeoJson,
  ] = await Promise.all([
    readFeatureCollection(
      TERMINALS_SOURCE_FILE
    ),

    readFeatureCollection(
      ROUTES_SOURCE_FILE
    ),
  ]);

  console.log(
    `Raw endpoint features: ${terminalGeoJson.features.length}`
  );

  console.log(
    `Raw route shapes: ${routeGeoJson.features.length}`
  );

  const {
    terminals,
    skipped,
  } =
    normalizeTerminals(
      terminalGeoJson.features
    );

  const variants =
    normalizeRouteVariants(
      routeGeoJson.features
    );

  const routes =
    buildLogicalRoutes(
      variants,
      terminals
    );

  const report =
    buildReport({
      sourceTerminalCount:
        terminalGeoJson.features.length,

      sourceRouteFeatureCount:
        routeGeoJson.features.length,

      terminals,

      skippedTerminals:
        skipped,

      variants,

      routes,
    });

  await fs.writeFile(
    TERMINALS_OUTPUT_FILE,
    JSON.stringify(
      terminals,
      null,
      2
    ),
    "utf8"
  );

  await fs.writeFile(
    ROUTES_OUTPUT_FILE,
    JSON.stringify(
      routes,
      null,
      2
    ),
    "utf8"
  );

  await fs.writeFile(
    REPORT_OUTPUT_FILE,
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
    `Terminals normalized: ${report.normalizedTerminalCount}`
  );

  console.log(
    `Logical routes: ${report.logicalRouteCount}`
  );

  console.log(
    `Geometry variants: ${report.normalizedGeometryVariantCount}`
  );

  console.log(
    `Shared terminals: ${report.sharedTerminalCount}`
  );

  console.log("");
  console.log(
    "Terminal coverage:"
  );

  console.log(
    `  Both from + to: ${report.routesWithBothFromAndTo}`
  );

  console.log(
    `  Only from:      ${report.routesWithOnlyFrom}`
  );

  console.log(
    `  Only to:        ${report.routesWithOnlyTo}`
  );

  console.log(
    `  No terminals:   ${report.routesWithoutTerminalData}`
  );

  console.log("");
  console.log(
    `Unmatched Route_ID references: ${report.unmatchedTerminalRouteIdCount}`
  );

  if (
    report.unmatchedTerminalRouteIds
      .length > 0
  ) {
    for (
      const routeId of
        report.unmatchedTerminalRouteIds
    ) {
      console.log(
        `  - ${routeId}`
      );
    }
  }

  console.log("");
  console.log(
    "Geometry types:"
  );

  for (
    const [
      geometryType,
      count,
    ] of Object.entries(
      report.geometryTypes
    )
  ) {
    console.log(
      `  ${geometryType}: ${count}`
    );
  }

  console.log("");
  console.log(
    "Routes with multiple geometry variants:"
  );

  if (
    report.alternateRoutes
      .length === 0
  ) {
    console.log(
      "  None"
    );
  } else {
    for (
      const route of
        report.alternateRoutes
    ) {
      console.log(
        `  ${route.routeId} — ${route.name}`
      );

      console.log(
        `    Variants: ${route.variantCount}`
      );

      console.log(
        `    Alternate values: ${route.alternates
          .map(
            (value) =>
              value || "(blank)"
          )
          .join(", ")}`
      );
    }
  }

  console.log("");
  console.log(
    "Created:"
  );

  console.log(
    `  ${TERMINALS_OUTPUT_FILE}`
  );

  console.log(
    `  ${ROUTES_OUTPUT_FILE}`
  );

  console.log(
    `  ${REPORT_OUTPUT_FILE}`
  );

  console.log("");

  console.log(
    "Important: these points are modeled as route terminals/endpoints, not a complete bus-stop inventory."
  );

  console.log("");
};

main().catch((error) => {
  console.error("");
  console.error(
    "Tshwane Bus normalization failed:"
  );

  console.error(error);

  process.exitCode = 1;
});