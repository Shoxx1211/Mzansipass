import fs from "node:fs/promises";
import path from "node:path";

// ============================================================
// Pulse Transit - Rea Vaya Runtime Dataset Builder
//
// Converts the reconciled research/source datasets into one
// compact runtime asset for the actual Pulse journey engine.
//
// SAFE RUNTIME POLICY
// ------------------------------------------------------------
// Traversable spatial routes:
//   - only canonical coded geometry
//
// Transfer evidence usable by the journey engine:
//   - published shared-stop evidence only
//   - both routes must have canonical geometry
//
// Supporting evidence only:
//   - shared unnamed GIS station-point proximity
//
// NOT supplied as runtime facts:
//   - service direction
//   - exact timetable
//   - live ETA
//   - exact passenger fare
// ============================================================

const ROOT = path.resolve(
  "src/data/transit/gauteng/reavaya"
);

const INPUT = {
  routeCatalog:
    path.join(
      ROOT,
      "route-catalog.json"
    ),

  transfers:
    path.join(
      ROOT,
      "reavaya-transfer-candidates.json"
    ),

  canonicalGeometry:
    path.join(
      ROOT,
      "canonical-route-geometries.geojson"
    ),

  fares:
    path.join(
      ROOT,
      "fares.json"
    ),
};

const OUTPUT = {
  runtime:
    path.join(
      ROOT,
      "reavaya-runtime.json"
    ),

  report:
    path.join(
      ROOT,
      "reavaya-runtime-report.json"
    ),
};


// ============================================================
// Helpers
// ============================================================

const readJson = async (
  filename
) => {

  const raw =
    await fs.readFile(
      filename,
      "utf8"
    );

  if (!raw.trim()) {
    throw new Error(
      `${filename} is empty.`
    );
  }

  return JSON.parse(
    raw.replace(
      /^\uFEFF/,
      ""
    )
  );
};


const writeJson = async (
  filename,
  data
) => {

  await fs.writeFile(
    filename,
    JSON.stringify(
      data,
      null,
      2
    ),
    "utf8"
  );
};


const naturalRouteSort = (
  a,
  b
) => {

  const aMatch =
    String(a).match(
      /^([A-Z]+)(\d+)$/i
    );

  const bMatch =
    String(b).match(
      /^([A-Z]+)(\d+)$/i
    );

  if (
    aMatch &&
    bMatch &&
    aMatch[1] ===
      bMatch[1]
  ) {

    return (
      Number(
        aMatch[2]
      ) -
      Number(
        bMatch[2]
      )
    );
  }

  return String(a)
    .localeCompare(
      String(b)
    );
};


const collectCoordinates = (
  value,
  output = []
) => {

  if (!Array.isArray(value)) {
    return output;
  }

  if (
    value.length >= 2 &&
    typeof value[0] ===
      "number" &&
    typeof value[1] ===
      "number"
  ) {

    output.push([
      value[0],
      value[1],
    ]);

    return output;
  }


  for (
    const child of value
  ) {

    collectCoordinates(
      child,
      output
    );
  }


  return output;
};


const geometryCoordinates = (
  geometry
) => {

  if (
    !geometry ||
    !geometry.coordinates
  ) {
    return [];
  }

  return collectCoordinates(
    geometry.coordinates
  );
};


const bboxForGeometry = (
  geometry
) => {

  const coordinates =
    geometryCoordinates(
      geometry
    );


  if (
    coordinates.length ===
    0
  ) {
    return null;
  }


  const lons =
    coordinates.map(
      ([lon]) => lon
    );

  const lats =
    coordinates.map(
      ([, lat]) => lat
    );


  return [
    Math.min(
      ...lons
    ),

    Math.min(
      ...lats
    ),

    Math.max(
      ...lons
    ),

    Math.max(
      ...lats
    ),
  ];
};


const unique = (
  values
) =>
    [
      ...new Set(
        values
      ),
    ];


const routePairKey = (
  a,
  b
) => {

  return [
    a,
    b,
  ]
    .sort(
      naturalRouteSort
    )
    .join(
      "::"
    );
};


// ============================================================
// Main
// ============================================================

const main = async () => {

  console.log("");
  console.log(
    "================================================"
  );
  console.log(
    " Pulse Transit - Rea Vaya Runtime Builder"
  );
  console.log(
    "================================================"
  );
  console.log("");


  const errors = [];
  const warnings = [];


  // ==========================================================
  // Load sources
  // ==========================================================

  const [
    catalog,
    transferData,
    geometryData,
    fares,
  ] =
    await Promise.all([
      readJson(
        INPUT.routeCatalog
      ),

      readJson(
        INPUT.transfers
      ),

      readJson(
        INPUT.canonicalGeometry
      ),

      readJson(
        INPUT.fares
      ),
    ]);


  if (
    catalog.operatorId !==
    "reavaya"
  ) {

    errors.push(
      "route-catalog.json is not a Rea Vaya dataset."
    );
  }


  if (
    !Array.isArray(
      catalog.routes
    )
  ) {

    errors.push(
      "route-catalog.json has no routes array."
    );
  }


  if (
    geometryData.type !==
    "FeatureCollection"
  ) {

    errors.push(
      "canonical-route-geometries.geojson is not a FeatureCollection."
    );
  }


  if (
    !Array.isArray(
      transferData.candidates
    )
  ) {

    errors.push(
      "reavaya-transfer-candidates.json has no candidates array."
    );
  }


  if (
    errors.length
  ) {

    throw new Error(
      errors.join(
        "\n"
      )
    );
  }


  // ==========================================================
  // Geometry lookup
  // ==========================================================

  const geometryByCode =
    new Map();


  for (
    const feature of
      geometryData.features
  ) {

    const routeCode =
      feature
        ?.properties
        ?.routeCode;


    if (!routeCode) {

      errors.push(
        "Canonical geometry feature has no routeCode."
      );

      continue;
    }


    if (
      geometryByCode.has(
        routeCode
      )
    ) {

      errors.push(
        `Duplicate canonical route geometry for ${routeCode}.`
      );

      continue;
    }


    geometryByCode.set(
      routeCode,
      feature
    );
  }


  // ==========================================================
  // Runtime route records
  // ==========================================================

  const runtimeRoutes = [];

  const metadataOnlyRoutes = [];


  for (
    const route of
      catalog.routes
  ) {

    const code =
      route.routeCode;


    const geometryFeature =
      geometryByCode.get(
        code
      ) ??
      null;


    if (!geometryFeature) {

      metadataOnlyRoutes.push({
        routeCode:
          code,

        routeFamily:
          route.routeFamily,

        reason:
          route.geometry
            .spatialCoverage ===
          "supplemental-segment-geometry"
            ? "supplemental-geometry-only"
            : "no-canonical-route-geometry",

        supplementalSegmentCount:
          route.geometry
            .supplementalSegmentCount,

        phase1bDetailAvailable:
          route
            .phase1bSchedule7
            .available,
      });

      continue;
    }


    runtimeRoutes.push({
      routeCode:
        code,

      routeFamily:
        route.routeFamily,

      mode:
        route.mode,

      geometryStatus:
        "official-canonical-coded-geometry",

      geometryDirectionVerified:
        false,

      stopSequenceVerified:
        false,

      bbox:
        bboxForGeometry(
          geometryFeature.geometry
        ),

      geometry:
        geometryFeature.geometry,

      servicePattern:
        route.servicePattern,

      phase1b:
        route
          .phase1bSchedule7
          .available
          ? {
              available:
                true,

              title:
                route
                  .phase1bSchedule7
                  .title,

              officialOneDirectionDistanceKm:
                route
                  .phase1bSchedule7
                  .distanceKmOneDirection,

              publishedStopCount:
                route
                  .phase1bSchedule7
                  .publishedStopCount,

              stopListStatus:
                route
                  .phase1bSchedule7
                  .stopListStatus,
            }
          : {
              available:
                false,
            },
    });
  }


  runtimeRoutes.sort(
    (
      a,
      b
    ) =>
      naturalRouteSort(
        a.routeCode,
        b.routeCode
      )
  );


  metadataOnlyRoutes.sort(
    (
      a,
      b
    ) =>
      naturalRouteSort(
        a.routeCode,
        b.routeCode
      )
  );


  const traversableCodes =
    new Set(
      runtimeRoutes.map(
        (route) =>
          route.routeCode
      )
    );


  // ==========================================================
  // Transfer evidence
  //
  // Strong runtime transfer edge:
  //   published shared-stop evidence
  //   AND both routes have canonical geometry.
  //
  // Spatial-only GIS evidence remains supporting information.
  // ==========================================================

  const publishedTransferEdges = [];

  const spatialSupportEdges = [];

  const nonTraversablePublishedEvidence =
    [];


  const seenPublishedPairs =
    new Set();


  const seenSpatialPairs =
    new Set();


  for (
    const candidate of
      transferData.candidates
  ) {

    const routeA =
      candidate.routeA;

    const routeB =
      candidate.routeB;


    const bothTraversable =
      traversableCodes.has(
        routeA
      ) &&
      traversableCodes.has(
        routeB
      );


    const publishedEvidence =
      candidate
        .sharedPublishedStopCount >
      0;


    const spatialEvidence =
      candidate
        .sharedOfficialStationPointCount >
      0;


    if (
      publishedEvidence
    ) {

      const labels =
        unique(
          (
            candidate.evidence ??
            []
          )
            .filter(
              (entry) =>
                entry.evidenceType ===
                "shared-published-stop-label"
            )
            .map(
              (entry) =>
                entry.label
            )
            .filter(
              Boolean
            )
        );


      const edge = {
        routeA,
        routeB,

        relationship:
          "published-shared-stop-connectivity",

        sharedPublishedStopCount:
          candidate
            .sharedPublishedStopCount,

        sharedStopLabels:
          labels,

        passengerTransferGuaranteed:
          false,

        exactWalkingPathKnown:
          false,

        exactTransferTimeKnown:
          false,

        timetableConnectionKnown:
          false,
      };


      if (
        bothTraversable
      ) {

        const key =
          routePairKey(
            routeA,
            routeB
          );


        if (
          !seenPublishedPairs.has(
            key
          )
        ) {

          seenPublishedPairs.add(
            key
          );

          publishedTransferEdges.push(
            edge
          );
        }
      }
      else {

        nonTraversablePublishedEvidence.push({
          ...edge,

          reason:
            "one-or-both-routes-do-not-have-canonical-runtime-geometry",
        });
      }
    }


    if (
      spatialEvidence &&
      bothTraversable
    ) {

      const key =
        routePairKey(
          routeA,
          routeB
        );


      if (
        !seenSpatialPairs.has(
          key
        )
      ) {

        seenSpatialPairs.add(
          key
        );


        spatialSupportEdges.push({
          routeA,
          routeB,

          relationship:
            "shared-official-station-point-spatial-support",

          sharedOfficialStationPointCount:
            candidate
              .sharedOfficialStationPointCount,

          usableAsTransferInstruction:
            false,

          note:
            "This is supporting spatial evidence only. It must not independently create a passenger transfer instruction.",
        });
      }
    }
  }


  publishedTransferEdges.sort(
    (
      a,
      b
    ) => {

      const first =
        naturalRouteSort(
          a.routeA,
          b.routeA
        );

      if (
        first !==
        0
      ) {
        return first;
      }

      return naturalRouteSort(
        a.routeB,
        b.routeB
      );
    }
  );


  // ==========================================================
  // Adjacency for published transfer evidence only
  // ==========================================================

  const adjacency = {};


  for (
    const route of
      runtimeRoutes
  ) {

    adjacency[
      route.routeCode
    ] = [];
  }


  for (
    const edge of
      publishedTransferEdges
  ) {

    adjacency[
      edge.routeA
    ].push(
      edge.routeB
    );

    adjacency[
      edge.routeB
    ].push(
      edge.routeA
    );
  }


  for (
    const code of
      Object.keys(
        adjacency
      )
  ) {

    adjacency[
      code
    ] =
      unique(
        adjacency[
          code
        ]
      ).sort(
        naturalRouteSort
      );
  }


  // ==========================================================
  // Fare summary
  //
  // We expose only the published range at runtime.
  // The journey engine must NOT invent an exact fare until
  // passenger-specific Rea Vaya distance is established.
  // ==========================================================

  const fareBands =
    fares
      ?.fareModel
      ?.bands ??
    [];


  const peakFares =
    fareBands
      .map(
        (band) =>
          band.peakFare
      )
      .filter(
        Number.isFinite
      );


  const offPeakFares =
    fareBands
      .map(
        (band) =>
          band.offPeakFare
      )
      .filter(
        Number.isFinite
      );


  const fareSummary = {
    currency:
      fares.currency,

    effectiveFrom:
      fares.effectiveFrom,

    effectiveTo:
      fares.effectiveTo,

    fareModel:
      fares
        ?.fareModel
        ?.type,

    distanceBasis:
      fares
        ?.fareModel
        ?.distanceBasis,

    peakPublishedRange:
      peakFares.length
        ? {
            minimum:
              Math.min(
                ...peakFares
              ),

            maximum:
              Math.max(
                ...peakFares
              ),
          }
        : null,

    offPeakPublishedRange:
      offPeakFares.length
        ? {
            minimum:
              Math.min(
                ...offPeakFares
              ),

            maximum:
              Math.max(
                ...offPeakFares
              ),
          }
        : null,

    exactPassengerFareAvailable:
      false,

    exactPassengerFareReason:
      "Passenger-specific Rea Vaya journey distance is not yet established by the runtime journey engine.",

    bands:
      fareBands.map(
        (band) => ({
          id:
            band.id,

          lowerBoundKm:
            band.lowerBoundKm,

          lowerInclusive:
            band.lowerInclusive,

          upperBoundKm:
            band.upperBoundKm,

          upperInclusive:
            band.upperInclusive,

          peakFare:
            band.peakFare,

          offPeakFare:
            band.offPeakFare,
        })
      ),
  };


  // ==========================================================
  // Runtime output
  // ==========================================================

  const runtime = {
    schemaVersion:
      1,

    runtimeDataset:
      "reavaya",

    generatedAt:
      new Date().toISOString(),

    operator: {
      id:
        "reavaya",

      displayName:
        "Rea Vaya",

      mode:
        "bus",

      city:
        "Johannesburg",
    },

    coordinateReferenceSystem:
      "EPSG:4326",

    routeCoverage: {
      currentPublishedRouteCount:
        catalog.routeCount,

      spatiallyTraversableRouteCount:
        runtimeRoutes.length,

      metadataOnlyRouteCount:
        metadataOnlyRoutes.length,

      traversableRouteCodes:
        runtimeRoutes.map(
          (route) =>
            route.routeCode
        ),

      metadataOnlyRouteCodes:
        metadataOnlyRoutes.map(
          (route) =>
            route.routeCode
        ),
    },

    routes:
      runtimeRoutes,

    metadataOnlyRoutes,

    connectivity: {
      policy:
        "Only published shared-stop evidence creates runtime route-to-route traversal edges.",

      publishedTransferEdgeCount:
        publishedTransferEdges.length,

      publishedTransferEdges,

      adjacency,

      spatialSupportEdgeCount:
        spatialSupportEdges.length,

      spatialSupportEdges,

      nonTraversablePublishedEvidenceCount:
        nonTraversablePublishedEvidence.length,

      nonTraversablePublishedEvidence,
    },

    fares:
      fareSummary,

    truthModel: {
      verifiedDirection:
        false,

      completeStopSequence:
        false,

      exactTimetable:
        false,

      liveArrivals:
        false,

      exactPassengerFare:
        false,

      spatialRouteGeometryForTraversableRoutes:
        true,

      publishedTransferEvidence:
        true,
    },

    journeyEngineRules: [
      "A direct candidate requires origin and destination spatial access to the same canonical route.",
      "A transfer candidate requires published shared-stop connectivity between every traversed route pair.",
      "Shared GIS station-point proximity may support evidence but must not independently create a transfer instruction.",
      "Metadata-only routes must not be spatially traversed.",
      "Do not infer route direction from GeoJSON coordinate order.",
      "Do not claim exact departure time or live arrival.",
      "Do not calculate an exact fare from Mapbox road distance or raw GIS line length.",
      "If evidence is insufficient, return Rea Vaya as unavailable or unverified rather than fabricating a journey.",
    ],
  };


  // ==========================================================
  // QA
  // ==========================================================

  if (
    runtimeRoutes.length !==
    15
  ) {

    errors.push(
      `Expected 15 canonical runtime routes; found ${runtimeRoutes.length}.`
    );
  }


  if (
    metadataOnlyRoutes.length !==
    6
  ) {

    warnings.push(
      `Expected 6 metadata-only routes from the current 21-route inventory; found ${metadataOnlyRoutes.length}.`
    );
  }


  if (
    fareBands.length !==
    7
  ) {

    errors.push(
      `Expected 7 current fare bands; found ${fareBands.length}.`
    );
  }


  const geometryMissingBbox =
    runtimeRoutes.filter(
      (route) =>
        !route.bbox
    );


  if (
    geometryMissingBbox.length
  ) {

    errors.push(
      `Runtime routes missing bounding boxes: ${geometryMissingBbox
        .map(
          (route) =>
            route.routeCode
        )
        .join(", ")}`
    );
  }


  warnings.push(
    "Runtime traversal excludes C1-C6 because they do not yet have canonical coded geometry suitable for conservative spatial journey routing."
  );


  warnings.push(
    "Published shared-stop edges support graph connectivity but still do not prove service direction, timetable compatibility or a guaranteed passenger transfer."
  );


  warnings.push(
    "Spatial-only station-point evidence is retained separately and cannot create a runtime transfer edge."
  );


  warnings.push(
    "The runtime fare dataset exposes current fare bands and ranges, but exact passenger fare remains disabled until Rea Vaya journey distance can be established."
  );


  // ==========================================================
  // Report
  // ==========================================================

  const report = {
    generatedAt:
      new Date().toISOString(),

    operatorId:
      "reavaya",

    sourceRouteCount:
      catalog.routeCount,

    runtimeRouteCount:
      runtimeRoutes.length,

    runtimeRouteCodes:
      runtimeRoutes.map(
        (route) =>
          route.routeCode
      ),

    metadataOnlyRouteCount:
      metadataOnlyRoutes.length,

    metadataOnlyRouteCodes:
      metadataOnlyRoutes.map(
        (route) =>
          route.routeCode
      ),

    publishedTransferEdges:
      publishedTransferEdges.length,

    spatialSupportEdges:
      spatialSupportEdges.length,

    publishedEvidenceExcludedBecauseRouteNotSpatiallyTraversable:
      nonTraversablePublishedEvidence.length,

    fareBandCount:
      fareBands.length,

    exactPassengerFareEnabled:
      false,

    errorCount:
      errors.length,

    errors,

    warningCount:
      warnings.length,

    warnings,

    qaPassed:
      errors.length ===
      0,
  };


  // ==========================================================
  // Write
  // ==========================================================

  await writeJson(
    OUTPUT.runtime,
    runtime
  );


  await writeJson(
    OUTPUT.report,
    report
  );


  // ==========================================================
  // Console
  // ==========================================================

  console.log(
    "Rea Vaya runtime dataset built."
  );

  console.log("");

  console.log(
    `Current published routes: ${catalog.routeCount}`
  );

  console.log(
    `Spatially traversable routes: ${runtimeRoutes.length}`
  );

  console.log(
    `Metadata-only routes: ${metadataOnlyRoutes.length}`
  );

  console.log("");

  console.log(
    `Traversable route codes: ${runtimeRoutes
      .map(
        (route) =>
          route.routeCode
      )
      .join(", ")}`
  );

  console.log("");

  console.log(
    `Published transfer edges usable by runtime: ${publishedTransferEdges.length}`
  );

  console.log(
    `Spatial-support edges only: ${spatialSupportEdges.length}`
  );

  console.log(
    `Published edges excluded because route geometry is incomplete: ${nonTraversablePublishedEvidence.length}`
  );

  console.log("");

  console.log(
    `Current fare bands: ${fareBands.length}`
  );

  console.log(
    `Exact passenger fare enabled: NO`
  );

  console.log("");

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
    `  ${OUTPUT.runtime}`
  );

  console.log(
    `  ${OUTPUT.report}`
  );

  console.log("");

  console.log(
    "Important: this runtime asset is conservative by design. Spatial-only GIS proximity does not create passenger transfer instructions."
  );

  console.log("");


  if (
    errors.length
  ) {

    throw new Error(
      "Rea Vaya runtime dataset QA failed."
    );
  }
};


main().catch(
  (error) => {

    console.error("");

    console.error(
      "Rea Vaya runtime build failed:"
    );

    console.error(
      error
    );

    process.exitCode =
      1;
  }
);