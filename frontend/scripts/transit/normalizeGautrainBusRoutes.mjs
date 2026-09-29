import fs from "node:fs/promises";
import path from "node:path";

// ============================================================
// Pulse Transit - Gautrain Bus Route Inventory Normalizer
//
// INPUT
//   raw/bus-route-source-manifest.json
//   stations.json
//
// OUTPUT
//   bus-routes.json
//   bus-route-normalization-report.json
//
// This phase normalizes the official route-map inventory only.
//
// It DOES NOT infer:
// - route geometry
// - stop sequence
// - stop coordinates
// - timetable
// - travel time
// - live bus location
// ============================================================

const ROOT = path.resolve(
  "src/data/transit/gauteng/gautrain"
);

const MANIFEST_FILE = path.join(
  ROOT,
  "raw",
  "bus-route-source-manifest.json"
);

const STATIONS_FILE = path.join(
  ROOT,
  "stations.json"
);

const OUTPUT_FILE = path.join(
  ROOT,
  "bus-routes.json"
);

const REPORT_FILE = path.join(
  ROOT,
  "bus-route-normalization-report.json"
);

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const readJson = async (filename) => {
  const raw = await fs.readFile(
    filename,
    "utf8"
  );

  if (!raw.trim()) {
    throw new Error(
      `${filename} is empty`
    );
  }

  // PowerShell may emit UTF-8 BOM
  const cleaned = raw.replace(
    /^\uFEFF/,
    ""
  );

  return JSON.parse(cleaned);
};

const slugify = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeWhitespace = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const unique = (values) =>
  [...new Set(values)];

// ------------------------------------------------------------
// Explicit route-code extraction
//
// We only return a code when the OFFICIAL source title itself
// contains an obvious route-code token.
//
// Examples:
//   C2
//   H3
//   M4-1
//   RF2_1
//   RB4
//   J2
//   HMS1
//   SMS1
//
// Code-less midi-bus maps remain code: null.
// ------------------------------------------------------------

const extractRouteCode = (title) => {
  const text =
    normalizeWhitespace(title);

  const patterns = [
    /\bRF\d+(?:[_-]\d+)?\b/i,
    /\bRB\d+(?:[_-]\d+)?\b/i,
    /\bHMS\d+(?:[_-]\d+)?\b/i,
    /\bSMS\d+(?:[_-]\d+)?\b/i,
    /\bRPS\d+(?:[_-]\d+)?\b/i,

    /\bC\d+(?:[_-]\d+)?\b/i,
    /\bH\d+(?:[_-]\d+)?\b/i,
    /\bM\d+(?:[_-]\d+)?\b/i,
    /\bJ\d+(?:[_-]\d+)?\b/i,
    /\bP\d+(?:[_-]\d+)?\b/i,
    /\bS\d+(?:[_-]\d+)?\b/i,
  ];

  for (const pattern of patterns) {
    const match =
      text.match(pattern);

    if (match) {
      return match[0]
        .toUpperCase();
    }
  }

  return null;
};

// ------------------------------------------------------------
// Vehicle classification
//
// "midibus" only when source manifest/title explicitly
// identifies midi-bus.
//
// Other maps come from the official Gautrain bus-route
// download collection and are represented as "bus" with
// source-page-default classification.
// ------------------------------------------------------------

const classifyVehicle = (route) => {
  const title =
    String(
      route.sourceTitle ?? ""
    );

  const explicitMidi =
    route.vehicleTypeHint ===
      "midibus" ||
    /\bmidi[\s_-]?bus\b|\bmidibus\b/i.test(
      title
    );

  if (explicitMidi) {
    return {
      mode: "midibus",
      method:
        "explicit-official-title",
      confidence: "official",
    };
  }

  return {
    mode: "bus",
    method:
      "official-bus-route-download-collection",
    confidence: "official-context",
  };
};

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

const main = async () => {
  console.log("");
  console.log(
    "================================================"
  );

  console.log(
    " Pulse Transit - Gautrain Bus Route Normalizer"
  );

  console.log(
    "================================================"
  );

  const manifest =
    await readJson(
      MANIFEST_FILE
    );

  const stationsData =
    await readJson(
      STATIONS_FILE
    );

  const sourceRoutes =
    manifest.routes ?? [];

  const stations =
    stationsData.stations ?? [];

  const stationById =
    new Map(
      stations.map(
        (station) => [
          station.id,
          station,
        ]
      )
    );

  if (!sourceRoutes.length) {
    throw new Error(
      "Manifest contains no routes."
    );
  }

  // ----------------------------------------------------------
  // Normalize routes
  // ----------------------------------------------------------

  const normalizedRoutes =
    [];

  const missingStations =
    [];

  const invalidPdfs =
    [];

  for (
    const source of sourceRoutes
  ) {
    const station =
      stationById.get(
        source.stationId
      );

    if (!station) {
      missingStations.push({
        sourceTitle:
          source.sourceTitle,

        stationId:
          source.stationId,
      });
    }

    if (
      source.pdfValidated !== true
    ) {
      invalidPdfs.push({
        sourceTitle:
          source.sourceTitle,

        sourceFile:
          source.sourceFile,
      });
    }

    const routeCode =
      extractRouteCode(
        source.sourceTitle
      );

    const vehicle =
      classifyVehicle(
        source
      );

    const fallbackKey =
      slugify(
        source.sourceTitle
      );

    const identifierPart =
      routeCode
        ? slugify(routeCode)
        : fallbackKey;

    const id =
      [
        "gautrain",
        vehicle.mode,
        source.stationKey,
        identifierPart,
      ]
        .filter(Boolean)
        .join("-");

    normalizedRoutes.push({
      id,

      operatorId:
        "gautrain",

      mode:
        vehicle.mode,

      stationId:
        source.stationId,

      stationKey:
        source.stationKey,

      stationName:
        station?.name ??
        null,

      routeCode,

      officialTitle:
        normalizeWhitespace(
          source.sourceTitle
        ),

      routeMap: {
        sourceFile:
          source.sourceFile,

        sourceUrl:
          source.sourceUrl,

        pdfValidated:
          source.pdfValidated ===
          true,

        bytes:
          Number(
            source.bytes ?? 0
          ),
      },

      classification: {
        vehicleType:
          vehicle.mode,

        method:
          vehicle.method,

        confidence:
          vehicle.confidence,

        routeCodeMethod:
          routeCode
            ? "explicit-token-in-official-title"
            : "not-published-in-title",
      },

      verification: {
        routeExists:
          "official",

        stationAssociation:
          "official",

        routeCode:
          routeCode
            ? "official-title"
            : "not-available",

        routeMap:
          source.pdfValidated
            ? "official-validated-pdf"
            : "unverified",

        stopSequence:
          false,

        stopCoordinates:
          false,

        routeGeometry:
          false,

        timetable:
          false,

        travelTime:
          false,

        liveVehicleLocation:
          false,
      },

      provenance: {
        authority:
          "Gautrain",

        relationship:
          source.relationship ??
          "official-route-map-download",

        stationAssignmentMethod:
          source.stationAssignmentMethod ??
          "official-source-url-folder",

        sourceSnapshot:
          "raw/bus-route-source-manifest.json",
      },
    });
  }

  // ----------------------------------------------------------
  // QA: duplicate IDs
  // ----------------------------------------------------------

  const idGroups =
    new Map();

  for (
    const route of
      normalizedRoutes
  ) {
    if (
      !idGroups.has(
        route.id
      )
    ) {
      idGroups.set(
        route.id,
        []
      );
    }

    idGroups
      .get(route.id)
      .push(route);
  }

  const duplicateIds =
    [...idGroups.entries()]
      .filter(
        ([, routes]) =>
          routes.length > 1
      )
      .map(
        ([id, routes]) => ({
          id,

          routes:
            routes.map(
              (route) =>
                route.officialTitle
            ),
        })
      );

  // ----------------------------------------------------------
  // QA: duplicate route codes inside same station
  // ----------------------------------------------------------

  const codeGroups =
    new Map();

  for (
    const route of
      normalizedRoutes
  ) {
    if (!route.routeCode) {
      continue;
    }

    const key =
      `${route.stationId}:${route.routeCode}`;

    if (
      !codeGroups.has(key)
    ) {
      codeGroups.set(
        key,
        []
      );
    }

    codeGroups
      .get(key)
      .push(route);
  }

  const duplicateStationCodes =
    [...codeGroups.entries()]
      .filter(
        ([, routes]) =>
          routes.length > 1
      )
      .map(
        ([key, routes]) => ({
          key,

          titles:
            routes.map(
              (route) =>
                route.officialTitle
            ),
        })
      );

  // ----------------------------------------------------------
  // Route summaries
  // ----------------------------------------------------------

  const busRoutes =
    normalizedRoutes.filter(
      (route) =>
        route.mode === "bus"
    );

  const midibusRoutes =
    normalizedRoutes.filter(
      (route) =>
        route.mode ===
        "midibus"
    );

  const codedRoutes =
    normalizedRoutes.filter(
      (route) =>
        route.routeCode
    );

  const uncodedRoutes =
    normalizedRoutes.filter(
      (route) =>
        !route.routeCode
    );

  const stationSummary =
    [...new Set(
      normalizedRoutes.map(
        (route) =>
          route.stationKey
      )
    )]
      .sort()
      .map(
        (stationKey) => {
          const routes =
            normalizedRoutes.filter(
              (route) =>
                route.stationKey ===
                stationKey
            );

          return {
            stationKey,

            stationId:
              routes[0]
                ?.stationId ??
              null,

            routeCount:
              routes.length,

            busCount:
              routes.filter(
                (route) =>
                  route.mode ===
                  "bus"
              ).length,

            midibusCount:
              routes.filter(
                (route) =>
                  route.mode ===
                  "midibus"
              ).length,

            explicitCodeCount:
              routes.filter(
                (route) =>
                  route.routeCode
              ).length,

            uncodedCount:
              routes.filter(
                (route) =>
                  !route.routeCode
              ).length,
          };
        }
      );

  // ----------------------------------------------------------
  // Final output
  // ----------------------------------------------------------

  const output = {
    schemaVersion: 1,

    operatorId:
      "gautrain",

    generatedAt:
      new Date().toISOString(),

    routeCount:
      normalizedRoutes.length,

    busRouteCount:
      busRoutes.length,

    midibusRouteCount:
      midibusRoutes.length,

    routes:
      normalizedRoutes,

    capabilities: {
      officialRouteInventory:
        true,

      officialStationAssociation:
        true,

      validatedOfficialRouteMaps:
        invalidPdfs.length === 0,

      routeCodesWherePublished:
        true,

      completeStopSequences:
        false,

      stopCoordinates:
        false,

      routeGeometry:
        false,

      timetable:
        false,

      realtime:
        false,
    },

    notes: [
      "Each record represents an official Gautrain downloadable route map.",
      "Route codes are populated only where an explicit code appears in the official route title.",
      "Code-less midi-bus routes are preserved with routeCode null rather than assigning invented codes.",
      "Bus versus midi-bus classification uses explicit official midi-bus wording where present; remaining maps belong to Gautrain's official bus-route collection.",
      "No stop sequence, route geometry, timetable, duration or ETA is inferred in this phase."
    ],
  };

  const report = {
    generatedAt:
      new Date().toISOString(),

    operatorId:
      "gautrain",

    sourceManifestRouteCount:
      sourceRoutes.length,

    normalizedRouteCount:
      normalizedRoutes.length,

    stationGroupCount:
      stationSummary.length,

    busRouteCount:
      busRoutes.length,

    midibusRouteCount:
      midibusRoutes.length,

    explicitRouteCodeCount:
      codedRoutes.length,

    uncodedRouteCount:
      uncodedRoutes.length,

    uncodedRoutes:
      uncodedRoutes.map(
        (route) => ({
          stationKey:
            route.stationKey,

          officialTitle:
            route.officialTitle,

          mode:
            route.mode,
        })
      ),

    missingStationCount:
      missingStations.length,

    missingStations,

    invalidPdfCount:
      invalidPdfs.length,

    invalidPdfs,

    duplicateIdCount:
      duplicateIds.length,

    duplicateIds,

    duplicateStationRouteCodeCount:
      duplicateStationCodes.length,

    duplicateStationRouteCodes:
      duplicateStationCodes,

    stationSummary,

    errors: [
      ...(missingStations.length
        ? [
            `${missingStations.length} route records reference missing stations.`,
          ]
        : []),

      ...(invalidPdfs.length
        ? [
            `${invalidPdfs.length} route maps are not validated PDFs.`,
          ]
        : []),

      ...(duplicateIds.length
        ? [
            `${duplicateIds.length} normalized route IDs are duplicated.`,
          ]
        : []),

      ...(duplicateStationCodes.length
        ? [
            `${duplicateStationCodes.length} route codes are duplicated within the same station group.`,
          ]
        : []),
    ],

    warnings: [
      "A route-map PDF proves publication of a route map but does not automatically establish a machine-readable stop sequence.",
      "Code-less midi-bus routes retain null routeCode values.",
      "No coordinates are extracted from schematic map artwork in this phase.",
      "No bus or midi-bus ETA is created."
    ],
  };

  // ----------------------------------------------------------
  // Write files
  // ----------------------------------------------------------

  await fs.writeFile(
    OUTPUT_FILE,
    JSON.stringify(
      output,
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

  // ----------------------------------------------------------
  // Console
  // ----------------------------------------------------------

  console.log("");
  console.log(
    "Normalization complete."
  );

  console.log(
    `Routes normalized: ${report.normalizedRouteCount}`
  );

  console.log(
    `Bus routes: ${report.busRouteCount}`
  );

  console.log(
    `Midi-bus routes: ${report.midibusRouteCount}`
  );

  console.log(
    `Routes with explicit codes: ${report.explicitRouteCodeCount}`
  );

  console.log(
    `Routes without explicit codes: ${report.uncodedRouteCount}`
  );

  console.log(
    `Station groups: ${report.stationGroupCount}`
  );

  console.log("");
  console.log(
    `Missing stations: ${report.missingStationCount}`
  );

  console.log(
    `Invalid PDFs: ${report.invalidPdfCount}`
  );

  console.log(
    `Duplicate IDs: ${report.duplicateIdCount}`
  );

  console.log(
    `Duplicate station route codes: ${report.duplicateStationRouteCodeCount}`
  );

  console.log("");

  if (
    report.uncodedRoutes.length
  ) {
    console.log(
      "Routes with no explicit published code:"
    );

    for (
      const route of
        report.uncodedRoutes
    ) {
      console.log(
        `  [${route.stationKey}] ${route.officialTitle}`
      );
    }

    console.log("");
  }

  console.log(
    "Created:"
  );

  console.log(
    `  ${OUTPUT_FILE}`
  );

  console.log(
    `  ${REPORT_FILE}`
  );

  console.log("");

  console.log(
    "Important: no stops, route geometry, timetable or ETA were inferred."
  );

  console.log("");

  if (
    report.errors.length
  ) {
    for (
      const error of
        report.errors
    ) {
      console.error(
        `ERROR: ${error}`
      );
    }

    throw new Error(
      "Gautrain bus-route normalization QA failed."
    );
  }
};

main().catch(
  (error) => {
    console.error("");
    console.error(
      "Gautrain bus-route normalization failed:"
    );

    console.error(
      error
    );

    process.exitCode = 1;
  }
);