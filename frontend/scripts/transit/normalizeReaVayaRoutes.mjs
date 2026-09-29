import fs from "node:fs/promises";
import path from "node:path";

// ============================================================
// Pulse Transit - Rea Vaya Coded Route Inventory Normalizer
//
// INPUT
//   src/data/transit/gauteng/reavaya/raw/operating-routes.html
//
// OUTPUT
//   src/data/transit/gauteng/reavaya/routes.json
//   src/data/transit/gauteng/reavaya/route-normalization-report.json
//
// Scope:
// - official coded route inventory published on the current
//   Rea Vaya Operating Routes page
// - T1-T3
// - C1-C6
// - F1-F12
// - published route-family headways
//
// NOT inferred:
// - stop sequence
// - route geometry
// - exact timetable
// - live arrivals
// - Phase 1C route codes
// ============================================================

const ROOT = path.resolve(
  "src/data/transit/gauteng/reavaya"
);

const SOURCE_FILE = path.join(
  ROOT,
  "raw",
  "operating-routes.html"
);

const OUTPUT_FILE = path.join(
  ROOT,
  "routes.json"
);

const REPORT_FILE = path.join(
  ROOT,
  "route-normalization-report.json"
);

// ------------------------------------------------------------
// Official currently published coded route inventory
// ------------------------------------------------------------

const ROUTES = [
  // ==========================================================
  // TRUNK
  // ==========================================================

  {
    code: "T1",
    family: "trunk",
    publishedPeakHeadwayMinutes: 3,
    publishedOffPeakHeadwayMinutes: 15,
  },

  {
    code: "T2",
    family: "trunk",
    publishedPeakHeadwayMinutes: 10,
    publishedOffPeakHeadwayMinutes: null,
  },

  {
    code: "T3",
    family: "trunk",
    publishedPeakHeadwayMinutes: 3,
    publishedOffPeakHeadwayMinutes: 15,
  },

  // ==========================================================
  // COMPLEMENTARY
  // ==========================================================

  {
    code: "C1",
    family: "complementary",
    publishedPeakHeadwayMinutes: 5,
    publishedOffPeakHeadwayMinutes: 15,
  },

  {
    code: "C2",
    family: "complementary",
    publishedPeakHeadwayMinutes: 10,
    publishedOffPeakHeadwayMinutes: 15,
  },

  {
    code: "C3",
    family: "complementary",
    publishedPeakHeadwayMinutes: 10,
    publishedOffPeakHeadwayMinutes: 20,
  },

  {
    code: "C4",
    family: "complementary",
    publishedPeakHeadwayMinutes: 8,
    publishedOffPeakHeadwayMinutes: 20,
  },

  {
    code: "C5",
    family: "complementary",
    publishedPeakHeadwayMinutes: 15,
    publishedOffPeakHeadwayMinutes: 30,
  },

  {
    code: "C6",
    family: "complementary",
    publishedPeakHeadwayMinutes: 10,
    publishedOffPeakHeadwayMinutes: 30,
  },

  // ==========================================================
  // FEEDER
  // ==========================================================

  {
    code: "F1",
    family: "feeder",
    publishedPeakHeadwayMinutes: 5,
    publishedOffPeakHeadwayMinutes: 20,
  },

  {
    code: "F2",
    family: "feeder",
    publishedPeakHeadwayMinutes: 5,
    publishedOffPeakHeadwayMinutes: 20,
  },

  {
    code: "F3",
    family: "feeder",
    publishedPeakHeadwayMinutes: 15,
    publishedOffPeakHeadwayMinutes: 30,
  },

  {
    code: "F4",
    family: "feeder",
    publishedPeakHeadwayMinutes: 10,
    publishedOffPeakHeadwayMinutes: 30,
  },

  {
    code: "F5",
    family: "feeder",
    publishedPeakHeadwayMinutes: 15,
    publishedOffPeakHeadwayMinutes: 30,
  },

  {
    code: "F6",
    family: "feeder",
    publishedPeakHeadwayMinutes: 10,
    publishedOffPeakHeadwayMinutes: 30,
  },

  {
    code: "F7",
    family: "feeder",
    publishedPeakHeadwayMinutes: 10,
    publishedOffPeakHeadwayMinutes: 30,
  },

  {
    code: "F8",
    family: "feeder",
    publishedPeakHeadwayMinutes: 15,
    publishedOffPeakHeadwayMinutes: 30,
  },

  {
    code: "F9",
    family: "feeder",
    publishedPeakHeadwayMinutes: 10,
    publishedOffPeakHeadwayMinutes: 30,
  },

  {
    code: "F10",
    family: "feeder",
    publishedPeakHeadwayMinutes: 10,
    publishedOffPeakHeadwayMinutes: 30,
  },

  {
    code: "F11",
    family: "feeder",
    publishedPeakHeadwayMinutes: 10,
    publishedOffPeakHeadwayMinutes: 20,
  },

  {
    code: "F12",
    family: "feeder",
    publishedPeakHeadwayMinutes: 10,
    publishedOffPeakHeadwayMinutes: 20,
  },
];

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const readText = async (filename) => {
  const text = await fs.readFile(
    filename,
    "utf8"
  );

  if (!text.trim()) {
    throw new Error(
      `${filename} is empty`
    );
  }

  return text.replace(
    /^\uFEFF/,
    ""
  );
};

const htmlToText = (html) =>
  html
    .replace(
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      " "
    )
    .replace(
      /<style\b[^>]*>[\s\S]*?<\/style>/gi,
      " "
    )
    .replace(
      /<[^>]+>/g,
      " "
    )
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&#8211;|&ndash;/gi,
      "-"
    )
    .replace(
      /&#8212;|&mdash;/gi,
      "-"
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();

const countByFamily = (
  routes,
  family
) =>
  routes.filter(
    (route) =>
      route.family === family
  ).length;

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

const main = async () => {
  console.log("");
  console.log(
    "================================================"
  );
  console.log(
    " Pulse Transit - Rea Vaya Route Normalizer"
  );
  console.log(
    "================================================"
  );

  const html =
    await readText(
      SOURCE_FILE
    );

  const sourceText =
    htmlToText(
      html
    );

  const errors = [];
  const warnings = [];

  // ----------------------------------------------------------
  // Source route-code presence
  // ----------------------------------------------------------

  const missingCodes =
    [];

  for (
    const route of ROUTES
  ) {
    const pattern =
      new RegExp(
        `\\b${route.code}\\b`,
        "i"
      );

    if (
      !pattern.test(
        sourceText
      )
    ) {
      missingCodes.push(
        route.code
      );
    }
  }

  if (
    missingCodes.length
  ) {
    errors.push(
      `Official source snapshot is missing expected route codes: ${missingCodes.join(", ")}`
    );
  }

  // ----------------------------------------------------------
  // Expected route-family sizes
  // ----------------------------------------------------------

  const trunkCount =
    countByFamily(
      ROUTES,
      "trunk"
    );

  const complementaryCount =
    countByFamily(
      ROUTES,
      "complementary"
    );

  const feederCount =
    countByFamily(
      ROUTES,
      "feeder"
    );

  if (
    trunkCount !== 3
  ) {
    errors.push(
      `Expected 3 trunk routes, found ${trunkCount}.`
    );
  }

  if (
    complementaryCount !== 6
  ) {
    errors.push(
      `Expected 6 complementary routes, found ${complementaryCount}.`
    );
  }

  if (
    feederCount !== 12
  ) {
    errors.push(
      `Expected 12 feeder routes, found ${feederCount}.`
    );
  }

  if (
    ROUTES.length !== 21
  ) {
    errors.push(
      `Expected 21 coded routes, found ${ROUTES.length}.`
    );
  }

  // ----------------------------------------------------------
  // Duplicate-code QA
  // ----------------------------------------------------------

  const codeCounts =
    new Map();

  for (
    const route of ROUTES
  ) {
    codeCounts.set(
      route.code,
      (
        codeCounts.get(
          route.code
        ) ?? 0
      ) + 1
    );
  }

  const duplicateCodes =
    [...codeCounts.entries()]
      .filter(
        ([, count]) =>
          count > 1
      )
      .map(
        ([code]) =>
          code
      );

  if (
    duplicateCodes.length
  ) {
    errors.push(
      `Duplicate route codes found: ${duplicateCodes.join(", ")}`
    );
  }

  // ----------------------------------------------------------
  // Headway QA
  // ----------------------------------------------------------

  for (
    const route of ROUTES
  ) {
    if (
      !Number.isInteger(
        route
          .publishedPeakHeadwayMinutes
      ) ||
      route
        .publishedPeakHeadwayMinutes <=
        0
    ) {
      errors.push(
        `${route.code}: invalid peak headway.`
      );
    }

    const offPeak =
      route
        .publishedOffPeakHeadwayMinutes;

    if (
      offPeak !== null &&
      (
        !Number.isInteger(
          offPeak
        ) ||
        offPeak <= 0
      )
    ) {
      errors.push(
        `${route.code}: invalid off-peak headway.`
      );
    }
  }

  // ----------------------------------------------------------
  // Generic time-window quality warning
  //
  // The current web page contains generic peak/off-peak wording
  // that overlaps. We deliberately do not normalize those
  // generic periods into machine-routing rules in this phase.
  // ----------------------------------------------------------

  warnings.push(
    "The current Operating Routes page contains overlapping generic peak/off-peak wording. Exact generic peak/off-peak time windows are therefore not normalized in this dataset."
  );

  warnings.push(
    "Published route-family headway figures are descriptive service frequencies, not live countdowns or exact departure times."
  );

  warnings.push(
    "Phase 1C(a) is operational, but this 21-route coded inventory must not be treated as proof that it contains every Phase 1C service."
  );

  // ----------------------------------------------------------
  // Normalize routes
  // ----------------------------------------------------------

  const normalizedRoutes =
    ROUTES.map(
      (route) => ({
        id:
          `reavaya-${route.code.toLowerCase()}`,

        operatorId:
          "reavaya",

        routeCode:
          route.code,

        routeFamily:
          route.family,

        mode:
          "bus",

        servicePattern: {
          publishedPeakHeadwayMinutes:
            route
              .publishedPeakHeadwayMinutes,

          publishedOffPeakHeadwayMinutes:
            route
              .publishedOffPeakHeadwayMinutes,

          offPeakServicePublished:
            route
              .publishedOffPeakHeadwayMinutes !==
            null,

          exactPeakWindow:
            null,

          exactOffPeakWindow:
            null,

          windowVerificationStatus:
            "not-normalized-due-to-source-wording-conflict",

          exactDeparturesStored:
            false,

          realtimeStored:
            false,
        },

        verification: {
          routeCode:
            "official-current-operating-routes-page",

          routeFamily:
            "official-current-operating-routes-page",

          publishedHeadway:
            "official-current-operating-routes-page",

          endpointPair:
            false,

          stopSequence:
            false,

          stopCoordinates:
            false,

          routeGeometry:
            false,

          exactTimetable:
            false,

          realtime:
            false,
        },

        source: {
          authority:
            "Rea Vaya / City of Johannesburg",

          sourceFile:
            "raw/operating-routes.html",

          sourceUrl:
            "https://reavaya.org.za/rea-vaya-operating-routes/",

          confidence:
            "official",
        },
      })
    );

  // ----------------------------------------------------------
  // Output
  // ----------------------------------------------------------

  const output = {
    schemaVersion: 1,

    operatorId:
      "reavaya",

    generatedAt:
      new Date().toISOString(),

    sourceSnapshot:
      "raw/operating-routes.html",

    codedRouteCount:
      normalizedRoutes.length,

    routeFamilies: {
      trunk: {
        prefix: "T",
        routeCount:
          trunkCount,
      },

      complementary: {
        prefix: "C",
        routeCount:
          complementaryCount,
      },

      feeder: {
        prefix: "F",
        routeCount:
          feederCount,
      },
    },

    routes:
      normalizedRoutes,

    phase1C: {
      operational:
        true,

      serviceStartDate:
        "2025-12-01",

      statusSource:
        "City of Johannesburg Phase 1C(a) operating announcement",

      routeCodeCoverageStatus:
        "not-proven-by-this-coded-route-inventory",

      integrationRule:
        "Do not automatically assign Phase 1C corridor services to existing T/C/F codes without route-level official evidence.",
    },

    capabilities: {
      codedRouteInventory:
        true,

      publishedFamilyHeadways:
        true,

      exactGenericPeakWindow:
        false,

      exactGenericOffPeakWindow:
        false,

      completeStopSequences:
        false,

      stopCoordinates:
        false,

      routeGeometry:
        false,

      exactTimetable:
        false,

      realtime:
        false,
    },

    appRules: [
      "Use route-specific published headways as descriptive frequency information, not live ETA.",
      "Do not infer exact peak/off-peak time applicability from the conflicting generic wording on the current operating-routes page.",
      "Do not assume the 21 coded T/C/F routes represent all currently operating Phase 1C(a) services.",
      "Do not invent Phase 1C route codes.",
      "Do not invent endpoints, stops or route geometry from the route code alone.",
    ],
  };

  // ----------------------------------------------------------
  // Report
  // ----------------------------------------------------------

  const report = {
    generatedAt:
      new Date().toISOString(),

    operatorId:
      "reavaya",

    sourceFile:
      "raw/operating-routes.html",

    sourceBytes:
      Buffer.byteLength(
        html,
        "utf8"
      ),

    codedRouteCount:
      ROUTES.length,

    trunkRouteCount:
      trunkCount,

    complementaryRouteCount:
      complementaryCount,

    feederRouteCount:
      feederCount,

    routesWithPeakHeadway:
      ROUTES.filter(
        (route) =>
          route
            .publishedPeakHeadwayMinutes !==
          null
      ).length,

    routesWithOffPeakHeadway:
      ROUTES.filter(
        (route) =>
          route
            .publishedOffPeakHeadwayMinutes !==
          null
      ).length,

    routesWithoutPublishedOffPeakHeadway:
      ROUTES
        .filter(
          (route) =>
            route
              .publishedOffPeakHeadwayMinutes ===
            null
        )
        .map(
          (route) =>
            route.code
        ),

    missingSourceRouteCodes:
      missingCodes,

    duplicateRouteCodes:
      duplicateCodes,

    genericTimeWindowsNormalized:
      false,

    phase1CCodeCoverageClaimed:
      false,

    errorCount:
      errors.length,

    errors,

    warningCount:
      warnings.length,

    warnings,

    qaPassed:
      errors.length === 0,

    notes: [
      "The current official route page publishes three trunk, six complementary and twelve feeder codes.",
      "T2 has no off-peak headway value in the current summary table and is stored as null rather than inferred.",
      "Generic peak/off-peak periods are not normalized because the current page contains overlapping wording.",
      "Phase 1C(a) operational status is recorded separately from the 21-route coded inventory.",
      "No stops, geometry, journey duration, exact departure time or live ETA is inferred.",
    ],
  };

  // ----------------------------------------------------------
  // Write
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
    "Route normalization complete."
  );

  console.log("");

  console.log(
    `Coded routes: ${ROUTES.length}`
  );

  console.log(
    `Trunk: ${trunkCount}`
  );

  console.log(
    `Complementary: ${complementaryCount}`
  );

  console.log(
    `Feeder: ${feederCount}`
  );

  console.log("");

  console.log(
    `Routes with peak headway: ${report.routesWithPeakHeadway}`
  );

  console.log(
    `Routes with off-peak headway: ${report.routesWithOffPeakHeadway}`
  );

  console.log(
    `No published off-peak headway: ${report.routesWithoutPublishedOffPeakHeadway.join(", ") || "none"}`
  );

  console.log("");

  console.log(
    `Missing route codes in source: ${missingCodes.length}`
  );

  console.log(
    `Duplicate route codes: ${duplicateCodes.length}`
  );

  console.log(
    `QA errors: ${errors.length}`
  );

  console.log(
    `Warnings: ${warnings.length}`
  );

  if (
    warnings.length
  ) {
    console.log("");

    for (
      const warning of
        warnings
    ) {
      console.log(
        `WARNING: ${warning}`
      );
    }
  }

  console.log("");

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
    "Important: no stop sequence, geometry, exact timetable or ETA was inferred."
  );

  console.log("");

  if (
    errors.length
  ) {
    for (
      const error of
        errors
    ) {
      console.error(
        `ERROR: ${error}`
      );
    }

    throw new Error(
      "Rea Vaya route QA failed."
    );
  }
};

main().catch(
  (error) => {
    console.error("");
    console.error(
      "Rea Vaya route normalization failed:"
    );

    console.error(
      error
    );

    process.exitCode = 1;
  }
);