import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

// ============================================================
// Pulse Transit - Rea Vaya Evidence Graph Builder
//
// PURPOSE
// ------------------------------------------------------------
// Reconcile:
//
//   routes.json
//   fares.json
//   phase-1b-network.json
//   canonical-route-geometries.geojson
//   supplemental-route-segments.geojson
//   brt-station-points.geojson
//   phase1c-stations.geojson
//
// into:
//
//   route-catalog.json
//   reavaya-network-graph.json
//   reavaya-transfer-candidates.json
//   reavaya-reconciliation-report.json
//
// This is an EVIDENCE graph.
//
// It does NOT claim:
// - verified service direction
// - complete stop sequence
// - exact timetable
// - live arrival data
// - every geometric crossing is a passenger transfer
// - GIS line length is Rea Vaya fare distance
// ============================================================


// ============================================================
// Paths
// ============================================================

const ROOT = path.resolve(
  "src/data/transit/gauteng/reavaya"
);

const INPUT = {
  routes:
    path.join(
      ROOT,
      "routes.json"
    ),

  fares:
    path.join(
      ROOT,
      "fares.json"
    ),

  phase1b:
    path.join(
      ROOT,
      "phase-1b-network.json"
    ),

  canonicalGeometry:
    path.join(
      ROOT,
      "canonical-route-geometries.geojson"
    ),

  supplementalGeometry:
    path.join(
      ROOT,
      "supplemental-route-segments.geojson"
    ),

  generalStations:
    path.join(
      ROOT,
      "brt-station-points.geojson"
    ),

  phase1cStations:
    path.join(
      ROOT,
      "phase1c-stations.geojson"
    ),
};


const OUTPUT = {
  routeCatalog:
    path.join(
      ROOT,
      "route-catalog.json"
    ),

  graph:
    path.join(
      ROOT,
      "reavaya-network-graph.json"
    ),

  transfers:
    path.join(
      ROOT,
      "reavaya-transfer-candidates.json"
    ),

  report:
    path.join(
      ROOT,
      "reavaya-reconciliation-report.json"
    ),
};


// ============================================================
// Conservative spatial thresholds
// ============================================================
//
// These thresholds are DERIVED engineering tolerances.
//
// They are NOT official Rea Vaya walking/transfer distances.
//
// The official GIS point and official GIS route geometry may
// sit on different positions within the same road/station
// footprint, so a small tolerance is required.
//
// These links remain marked as spatially derived.
// ============================================================

const GENERAL_STATION_ROUTE_ATTACH_METERS =
  50;

const PHASE1C_ROUTE_ATTACH_METERS =
  60;


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


const round = (
  value,
  decimals = 3
) => {

  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor
    ) /
    factor
  );
};


const toRadians = (
  degrees
) =>
    (
      degrees *
      Math.PI
    ) /
    180;


const haversineMeters = (
  a,
  b
) => {

  const [
    lon1,
    lat1,
  ] = a;

  const [
    lon2,
    lat2,
  ] = b;


  const earthRadius =
    6371000;


  const dLat =
    toRadians(
      lat2 - lat1
    );

  const dLon =
    toRadians(
      lon2 - lon1
    );


  const lat1Rad =
    toRadians(
      lat1
    );

  const lat2Rad =
    toRadians(
      lat2
    );


  const h =
    Math.sin(
      dLat / 2
    ) ** 2 +
    Math.cos(
      lat1Rad
    ) *
      Math.cos(
        lat2Rad
      ) *
      Math.sin(
        dLon / 2
      ) ** 2;


  return (
    2 *
    earthRadius *
    Math.asin(
      Math.sqrt(h)
    )
  );
};


const getLineParts = (
  geometry
) => {

  if (!geometry) {
    return [];
  }


  if (
    geometry.type ===
    "LineString"
  ) {

    return [
      geometry.coordinates,
    ];
  }


  if (
    geometry.type ===
    "MultiLineString"
  ) {

    return (
      geometry.coordinates ??
      []
    );
  }


  return [];
};


const geometryLengthMeters = (
  geometry
) => {

  let total =
    0;


  for (
    const line of
      getLineParts(
        geometry
      )
  ) {

    for (
      let i = 1;
      i < line.length;
      i += 1
    ) {

      total +=
        haversineMeters(
          line[i - 1],
          line[i]
        );
    }
  }


  return total;
};


// ============================================================
// Point-to-line distance
//
// Local equirectangular projection around the tested point.
// This is suitable for small station-to-route tolerances.
// ============================================================

const pointToSegmentMeters = (
  point,
  a,
  b
) => {

  const earthRadius =
    6371000;


  const pointLon =
    toRadians(
      point[0]
    );

  const pointLat =
    toRadians(
      point[1]
    );


  const cosLat =
    Math.cos(
      pointLat
    );


  const project = (
    coord
  ) => {

    const lon =
      toRadians(
        coord[0]
      );

    const lat =
      toRadians(
        coord[1]
      );


    return [
      (
        lon -
        pointLon
      ) *
        cosLat *
        earthRadius,

      (
        lat -
        pointLat
      ) *
        earthRadius,
    ];
  };


  const [
    ax,
    ay,
  ] =
    project(a);

  const [
    bx,
    by,
  ] =
    project(b);


  const dx =
    bx - ax;

  const dy =
    by - ay;


  const lengthSquared =
    dx * dx +
    dy * dy;


  if (
    lengthSquared ===
    0
  ) {

    return Math.sqrt(
      ax * ax +
      ay * ay
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
      Math.min(
        1,
        t
      )
    );


  const nearestX =
    ax +
    t * dx;

  const nearestY =
    ay +
    t * dy;


  return Math.sqrt(
    nearestX *
      nearestX +
    nearestY *
      nearestY
  );
};


const pointToGeometryMeters = (
  point,
  geometry
) => {

  let best =
    Infinity;


  for (
    const line of
      getLineParts(
        geometry
      )
  ) {

    if (
      line.length === 1
    ) {

      best =
        Math.min(
          best,
          haversineMeters(
            point,
            line[0]
          )
        );

      continue;
    }


    for (
      let i = 1;
      i < line.length;
      i += 1
    ) {

      const distance =
        pointToSegmentMeters(
          point,
          line[i - 1],
          line[i]
        );


      if (
        distance <
        best
      ) {
        best =
          distance;
      }
    }
  }


  return best;
};


const normalizeStopLabel = (
  value
) => {

  return String(
    value ??
    ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /&/g,
      " and "
    )
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
};


const stableHash = (
  value
) => {

  return crypto
    .createHash(
      "sha1"
    )
    .update(
      String(value)
    )
    .digest(
      "hex"
    )
    .slice(
      0,
      12
    );
};


const routeNodeId = (
  routeCode
) =>
    `route:${routeCode}`;


const pairKey = (
  routeA,
  routeB
) => {

  const sorted =
    [
      routeA,
      routeB,
    ].sort(
      naturalRouteSort
    );

  return (
    `${sorted[0]}::${sorted[1]}`
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
    " Pulse Transit - Rea Vaya Evidence Graph Builder"
  );
  console.log(
    "================================================"
  );
  console.log("");


  const errors = [];
  const warnings = [];


  // ==========================================================
  // Load inputs
  // ==========================================================

  const [
    routeInventory,
    fares,
    phase1b,
    canonicalGeometry,
    supplementalGeometry,
    generalStations,
    phase1cStations,
  ] =
    await Promise.all([
      readJson(
        INPUT.routes
      ),

      readJson(
        INPUT.fares
      ),

      readJson(
        INPUT.phase1b
      ),

      readJson(
        INPUT.canonicalGeometry
      ),

      readJson(
        INPUT.supplementalGeometry
      ),

      readJson(
        INPUT.generalStations
      ),

      readJson(
        INPUT.phase1cStations
      ),
    ]);


  // ==========================================================
  // Basic source QA
  // ==========================================================

  if (
    routeInventory.operatorId !==
    "reavaya"
  ) {
    errors.push(
      "routes.json operatorId is not reavaya."
    );
  }


  if (
    fares.operatorId !==
    "reavaya"
  ) {
    errors.push(
      "fares.json operatorId is not reavaya."
    );
  }


  if (
    !Array.isArray(
      routeInventory.routes
    )
  ) {
    errors.push(
      "routes.json has no routes array."
    );
  }


  if (
    !Array.isArray(
      phase1b.routes
    )
  ) {
    errors.push(
      "phase-1b-network.json has no routes array."
    );
  }


  if (
    canonicalGeometry.type !==
    "FeatureCollection"
  ) {
    errors.push(
      "Canonical geometry is not a FeatureCollection."
    );
  }


  if (
    generalStations.type !==
    "FeatureCollection"
  ) {
    errors.push(
      "General station data is not a FeatureCollection."
    );
  }


  if (
    phase1cStations.type !==
    "FeatureCollection"
  ) {
    errors.push(
      "Phase 1C station data is not a FeatureCollection."
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
  // Lookup maps
  // ==========================================================

  const currentRouteByCode =
    new Map(
      routeInventory.routes.map(
        (route) => [
          route.routeCode,
          route,
        ]
      )
    );


  const phase1bByCode =
    new Map(
      phase1b.routes.map(
        (route) => [
          route.routeCode,
          route,
        ]
      )
    );


  const canonicalGeometryByCode =
    new Map();


  for (
    const feature of
      canonicalGeometry.features
  ) {

    const routeCode =
      feature
        ?.properties
        ?.routeCode;


    if (!routeCode) {

      errors.push(
        "Canonical route feature missing routeCode."
      );

      continue;
    }


    if (
      canonicalGeometryByCode.has(
        routeCode
      )
    ) {

      errors.push(
        `Duplicate canonical geometry for ${routeCode}.`
      );

      continue;
    }


    canonicalGeometryByCode.set(
      routeCode,
      feature
    );
  }


  const supplementalCountByCode =
    new Map();


  for (
    const feature of
      supplementalGeometry.features ??
      []
  ) {

    const code =
      feature
        ?.properties
        ?.routeCode;


    if (!code) {
      continue;
    }


    supplementalCountByCode.set(
      code,
      (
        supplementalCountByCode.get(
          code
        ) ??
        0
      ) + 1
    );
  }


  // ==========================================================
  // Route catalog
  // ==========================================================

  const routeCatalog =
    [];


  for (
    const route of
      routeInventory.routes
  ) {

    const code =
      route.routeCode;


    const schedule =
      phase1bByCode.get(
        code
      ) ??
      null;


    const geometryFeature =
      canonicalGeometryByCode.get(
        code
      ) ??
      null;


    const geometryLengthKm =
      geometryFeature
        ? geometryLengthMeters(
            geometryFeature.geometry
          ) /
          1000
        : null;


    const scheduleDistanceKm =
      schedule
        ?.distanceKmOneDirection ??
      null;


    let distanceComparison =
      null;


    if (
      Number.isFinite(
        geometryLengthKm
      ) &&
      Number.isFinite(
        scheduleDistanceKm
      ) &&
      scheduleDistanceKm >
        0
    ) {

      const differenceKm =
        geometryLengthKm -
        scheduleDistanceKm;


      distanceComparison = {
        officialScheduleDistanceKm:
          scheduleDistanceKm,

        derivedGisGeometryLengthKm:
          round(
            geometryLengthKm,
            3
          ),

        differenceKm:
          round(
            differenceKm,
            3
          ),

        differencePercentOfSchedule:
          round(
            (
              differenceKm /
              scheduleDistanceKm
            ) *
              100,
            1
          ),

        interpretation:
          "QA-only comparison; GIS polyline length is not automatically treated as Rea Vaya fare distance.",
      };
    }


    const supplementalCount =
      supplementalCountByCode.get(
        code
      ) ??
      0;


    let spatialCoverage =
      "none";


    if (geometryFeature) {
      spatialCoverage =
        "canonical-coded-geometry";
    }
    else if (
      supplementalCount >
      0
    ) {
      spatialCoverage =
        "supplemental-segment-geometry";
    }


    routeCatalog.push({
      id:
        route.id,

      operatorId:
        "reavaya",

      routeCode:
        code,

      routeFamily:
        route.routeFamily,

      mode:
        route.mode,

      currentOperatingRouteInventory:
        true,

      servicePattern:
        route.servicePattern,

      currentInventoryVerification:
        route.verification,

      phase1bSchedule7:
        schedule
          ? {
              available:
                true,

              title:
                schedule.title,

              distanceKmOneDirection:
                schedule.distanceKmOneDirection,

              pathDescription:
                schedule.pathDescription,

              publishedStops:
                schedule.publishedStops,

              publishedStopCount:
                schedule.publishedStopCount,

              stopListStatus:
                schedule.stopListStatus,

              stopDirectionality:
                schedule.stopDirectionality,

              narrativeMentionedStations:
                schedule.narrativeMentionedStations,

              sourcePages:
                schedule.sourcePages,
            }
          : {
              available:
                false,
            },

      geometry: {
        spatialCoverage,

        canonicalGeometryAvailable:
          Boolean(
            geometryFeature
          ),

        supplementalSegmentCount:
          supplementalCount,

        derivedGeometryLengthKm:
          geometryFeature
            ? round(
                geometryLengthKm,
                3
              )
            : null,

        directionVerified:
          false,

        stopSequenceEncoded:
          false,

        geometryFile:
          geometryFeature
            ? "canonical-route-geometries.geojson"
            : null,

        distanceComparison,
      },

      fareReadiness: {
        currentFareDatasetAvailable:
          true,

        fareDatasetEffectiveFrom:
          fares.effectiveFrom,

        fareDatasetEffectiveTo:
          fares.effectiveTo,

        fareDistanceKnownForArbitraryJourney:
          false,

        reason:
          "The fare schedule is available, but a passenger-specific Rea Vaya journey distance must still be established by the journey engine.",
      },

      userFacingCapabilities: {
        canShowRouteCode:
          true,

        canShowPublishedHeadway:
          true,

        canShowCanonicalRouteOnMap:
          Boolean(
            geometryFeature
          ),

        canShowExactDeparture:
          false,

        canShowLiveArrival:
          false,

        canClaimVerifiedDirection:
          false,
      },
    });
  }


  routeCatalog.sort(
    (
      a,
      b
    ) =>
      naturalRouteSort(
        a.routeCode,
        b.routeCode
      )
  );


  // ==========================================================
  // Published stop evidence nodes
  // ==========================================================

  const stopNodeMap =
    new Map();


  const routeStopEdges =
    [];


  const addPublishedStop = ({
    routeCode,
    label,
    evidenceType,
    sourceIndex = null,
  }) => {

    const normalizedKey =
      normalizeStopLabel(
        label
      );


    if (!normalizedKey) {
      return;
    }


    const stopId =
      `published-stop:${stableHash(
        normalizedKey
      )}`;


    if (
      !stopNodeMap.has(
        stopId
      )
    ) {

      stopNodeMap.set(
        stopId,
        {
          id:
            stopId,

          nodeType:
            "published-stop-evidence",

          normalizedKey,

          displayLabel:
            label,

          labelVariants:
            new Set(),

          routeCodes:
            new Set(),

          evidenceTypes:
            new Set(),
        }
      );
    }


    const node =
      stopNodeMap.get(
        stopId
      );


    node.labelVariants.add(
      label
    );

    node.routeCodes.add(
      routeCode
    );

    node.evidenceTypes.add(
      evidenceType
    );


    routeStopEdges.push({
      id:
        `edge:${routeCode}:${stopId}:${evidenceType}:${sourceIndex ?? "x"}`,

      edgeType:
        "route-published-stop-evidence",

      from:
        routeNodeId(
          routeCode
        ),

      to:
        stopId,

      routeCode,

      evidenceType,

      sourceIndex,

      sourceOrderStatus:
        evidenceType ===
        "published-stop-list"
          ? "published-list-order-preserved-but-direction-unverified"
          : "no-sequence-claimed",

      passengerBoardingCoordinateKnown:
        false,

      source:
        "Phase 1B Schedule 7",
    });
  };


  for (
    const route of
      phase1b.routes
  ) {

    const code =
      route.routeCode;


    if (
      Array.isArray(
        route.publishedStops
      )
    ) {

      route.publishedStops.forEach(
        (
          stop,
          index
        ) => {

          addPublishedStop({
            routeCode:
              code,

            label:
              stop,

            evidenceType:
              "published-stop-list",

            sourceIndex:
              index,
          });
        }
      );
    }


    if (
      Array.isArray(
        route.narrativeMentionedStations
      )
    ) {

      route.narrativeMentionedStations.forEach(
        (
          stop,
          index
        ) => {

          addPublishedStop({
            routeCode:
              code,

            label:
              stop,

            evidenceType:
              "route-narrative-mention",

            sourceIndex:
              index,
          });
        }
      );
    }
  }


  const publishedStopNodes =
    [
      ...stopNodeMap.values(),
    ].map(
      (node) => ({
        id:
          node.id,

        nodeType:
          node.nodeType,

        normalizedKey:
          node.normalizedKey,

        displayLabel:
          node.displayLabel,

        labelVariants:
          [
            ...node.labelVariants,
          ].sort(),

        routeCodes:
          [
            ...node.routeCodes,
          ].sort(
            naturalRouteSort
          ),

        evidenceTypes:
          [
            ...node.evidenceTypes,
          ].sort(),

        coordinates:
          null,

        coordinateStatus:
          "not-established-from-published-text",
      })
    );


  // ==========================================================
  // Official general BRT station-point nodes
  // ==========================================================

  const generalStationNodes =
    [];

  const generalStationRouteEdges =
    [];


  for (
    const feature of
      generalStations.features
  ) {

    const point =
      feature
        ?.geometry
        ?.coordinates;


    if (
      !Array.isArray(point) ||
      point.length <
        2
    ) {
      continue;
    }


    const stationId =
      feature.id ??
      `general-station:${generalStationNodes.length + 1}`;


    const attachments =
      [];


    for (
      const [
        routeCode,
        routeFeature,
      ] of
        canonicalGeometryByCode.entries()
    ) {

      const distanceMeters =
        pointToGeometryMeters(
          point,
          routeFeature.geometry
        );


      if (
        distanceMeters <=
        GENERAL_STATION_ROUTE_ATTACH_METERS
      ) {

        attachments.push({
          routeCode,

          distanceMeters:
            round(
              distanceMeters,
              1
            ),
        });


        generalStationRouteEdges.push({
          id:
            `edge:${stationId}:${routeCode}`,

          edgeType:
            "official-station-point-near-route",

          from:
            stationId,

          to:
            routeNodeId(
              routeCode
            ),

          routeCode,

          distanceMeters:
            round(
              distanceMeters,
              1
            ),

          thresholdMeters:
            GENERAL_STATION_ROUTE_ATTACH_METERS,

          relationshipStatus:
            "derived-spatial-association",

          passengerTransferVerified:
            false,

          sourcePoint:
            "official City of Johannesburg GIS",

          sourceRouteGeometry:
            "official City of Johannesburg GIS",
        });
      }
    }


    attachments.sort(
      (
        a,
        b
      ) =>
        a.distanceMeters -
        b.distanceMeters
    );


    generalStationNodes.push({
      id:
        stationId,

      nodeType:
        "official-brt-station-point",

      name:
        null,

      nameStatus:
        "not-available-in-source-layer",

      coordinates:
        point,

      coordinateStatus:
        "official-gis",

      routeAttachments:
        attachments,

      routeAttachmentStatus:
        "derived-by-spatial-proximity",

      source:
        feature.properties,
    });
  }


  // ==========================================================
  // Named Phase 1C stations
  // ==========================================================

  const phase1cStationNodes =
    [];

  const phase1cRouteEdges =
    [];


  for (
    const feature of
      phase1cStations.features
  ) {

    const point =
      feature
        ?.geometry
        ?.coordinates;


    if (
      !Array.isArray(point) ||
      point.length <
        2
    ) {
      continue;
    }


    const stationId =
      feature.id ??
      `phase1c-station:${phase1cStationNodes.length + 1}`;


    const attachments =
      [];


    for (
      const [
        routeCode,
        routeFeature,
      ] of
        canonicalGeometryByCode.entries()
    ) {

      const distanceMeters =
        pointToGeometryMeters(
          point,
          routeFeature.geometry
        );


      if (
        distanceMeters <=
        PHASE1C_ROUTE_ATTACH_METERS
      ) {

        attachments.push({
          routeCode,

          distanceMeters:
            round(
              distanceMeters,
              1
            ),
        });


        phase1cRouteEdges.push({
          id:
            `edge:${stationId}:${routeCode}`,

          edgeType:
            "phase1c-station-near-existing-coded-route",

          from:
            stationId,

          to:
            routeNodeId(
              routeCode
            ),

          routeCode,

          distanceMeters:
            round(
              distanceMeters,
              1
            ),

          thresholdMeters:
            PHASE1C_ROUTE_ATTACH_METERS,

          relationshipStatus:
            "derived-spatial-association",

          serviceAssignmentVerified:
            false,

          important:
            "Spatial proximity does not prove this Phase 1C station is served by this coded route.",
        });
      }
    }


    attachments.sort(
      (
        a,
        b
      ) =>
        a.distanceMeters -
        b.distanceMeters
    );


    phase1cStationNodes.push({
      id:
        stationId,

      nodeType:
        "official-phase1c-named-station",

      name:
        feature
          ?.properties
          ?.displayName ??
        null,

      sourceName:
        feature
          ?.properties
          ?.sourceName ??
        null,

      nameStatus:
        feature
          ?.properties
          ?.stationNameStatus ??
        "official",

      coordinates:
        point,

      coordinateStatus:
        "official-gis",

      existingCodedRouteAttachments:
        attachments,

      attachmentStatus:
        "spatial-only-not-service-assignment",
    });
  }


  // ==========================================================
  // Route-to-route transfer / connectivity evidence
  // ==========================================================

  const transferMap =
    new Map();


  const getTransferCandidate = (
    routeA,
    routeB
  ) => {

    const key =
      pairKey(
        routeA,
        routeB
      );


    if (
      !transferMap.has(
        key
      )
    ) {

      const [
        first,
        second,
      ] =
        key.split(
          "::"
        );


      transferMap.set(
        key,
        {
          id:
            `route-link:${first}:${second}`,

          routeA:
            first,

          routeB:
            second,

          evidence:
            [],

          sharedPublishedStopCount:
            0,

          sharedOfficialStationPointCount:
            0,

          sharedPhase1cSpatialPointCount:
            0,
        }
      );
    }


    return transferMap.get(
      key
    );
  };


  // ----------------------------------------------------------
  // Shared published stop evidence
  // ----------------------------------------------------------

  for (
    const stop of
      publishedStopNodes
  ) {

    const routes =
      stop.routeCodes;


    if (
      routes.length <
      2
    ) {
      continue;
    }


    for (
      let i = 0;
      i <
      routes.length;
      i += 1
    ) {

      for (
        let j = i + 1;
        j <
        routes.length;
        j += 1
      ) {

        const candidate =
          getTransferCandidate(
            routes[i],
            routes[j]
          );


        candidate
          .sharedPublishedStopCount +=
          1;


        candidate.evidence.push({
          evidenceType:
            "shared-published-stop-label",

          stopId:
            stop.id,

          label:
            stop.displayLabel,

          source:
            "Phase 1B Schedule 7",

          confidenceClass:
            "published-route-stop-overlap",
        });
      }
    }
  }


  // ----------------------------------------------------------
  // Shared official general station points
  // ----------------------------------------------------------

  for (
    const station of
      generalStationNodes
  ) {

    const routes =
      station
        .routeAttachments
        .map(
          (entry) =>
            entry.routeCode
        );


    if (
      routes.length <
      2
    ) {
      continue;
    }


    for (
      let i = 0;
      i <
      routes.length;
      i += 1
    ) {

      for (
        let j = i + 1;
        j <
        routes.length;
        j += 1
      ) {

        const candidate =
          getTransferCandidate(
            routes[i],
            routes[j]
          );


        candidate
          .sharedOfficialStationPointCount +=
          1;


        candidate.evidence.push({
          evidenceType:
            "shared-official-station-point-proximity",

          stationId:
            station.id,

          coordinates:
            station.coordinates,

          confidenceClass:
            "derived-from-two-official-gis-sources",

          operationalTransferVerified:
            false,
        });
      }
    }
  }


  // ----------------------------------------------------------
  // Phase 1C spatial overlaps
  //
  // Stored separately because these do NOT prove current coded
  // route assignment to Phase 1C.
  // ----------------------------------------------------------

  for (
    const station of
      phase1cStationNodes
  ) {

    const routes =
      station
        .existingCodedRouteAttachments
        .map(
          (entry) =>
            entry.routeCode
        );


    if (
      routes.length <
      2
    ) {
      continue;
    }


    for (
      let i = 0;
      i <
      routes.length;
      i += 1
    ) {

      for (
        let j = i + 1;
        j <
        routes.length;
        j += 1
      ) {

        const candidate =
          getTransferCandidate(
            routes[i],
            routes[j]
          );


        candidate
          .sharedPhase1cSpatialPointCount +=
          1;


        candidate.evidence.push({
          evidenceType:
            "shared-phase1c-station-spatial-proximity",

          stationId:
            station.id,

          stationName:
            station.name,

          confidenceClass:
            "spatial-only",

          codedRouteServiceAssignmentVerified:
            false,
        });
      }
    }
  }


  const transferCandidates =
    [
      ...transferMap.values(),
    ]
      .map(
        (candidate) => {

          const publishedEvidence =
            candidate
              .sharedPublishedStopCount >
            0;


          const sharedOfficialPoint =
            candidate
              .sharedOfficialStationPointCount >
            0;


          let connectivityStatus =
            "spatial-candidate-only";


          if (
            publishedEvidence
          ) {
            connectivityStatus =
              "supported-by-published-shared-stop";
          }
          else if (
            sharedOfficialPoint
          ) {
            connectivityStatus =
              "supported-by-shared-official-station-point-proximity";
          }


          return {
            ...candidate,

            connectivityStatus,

            conservativeNetworkConnectivitySupported:
              publishedEvidence ||
              sharedOfficialPoint,

            userFacingTransferVerified:
              false,

            exactTransferWalkingPathKnown:
              false,

            exactTransferTimeKnown:
              false,

            timetableConnectionKnown:
              false,

            note:
              "Connectivity evidence is useful for network graph construction but is not equivalent to a guaranteed timed passenger transfer.",
          };
        }
      )
      .sort(
        (
          a,
          b
        ) => {

          const first =
            naturalRouteSort(
              a.routeA,
              b.routeA
            );

          if (first !== 0) {
            return first;
          }

          return naturalRouteSort(
            a.routeB,
            b.routeB
          );
        }
      );


  // ==========================================================
  // Route graph nodes
  // ==========================================================

  const routeNodes =
    routeCatalog.map(
      (route) => ({
        id:
          routeNodeId(
            route.routeCode
          ),

        nodeType:
          "route",

        operatorId:
          "reavaya",

        routeCode:
          route.routeCode,

        routeFamily:
          route.routeFamily,

        canonicalGeometryAvailable:
          route.geometry
            .canonicalGeometryAvailable,

        supplementalGeometryAvailable:
          route.geometry
            .supplementalSegmentCount >
          0,

        phase1bDetailAvailable:
          route
            .phase1bSchedule7
            .available,
      })
    );


  // ==========================================================
  // Coverage analysis
  // ==========================================================

  const routeCodes =
    routeCatalog.map(
      (route) =>
        route.routeCode
    );


  const canonicalCodes =
    routeCatalog
      .filter(
        (route) =>
          route.geometry
            .canonicalGeometryAvailable
      )
      .map(
        (route) =>
          route.routeCode
      );


  const phase1bCodes =
    routeCatalog
      .filter(
        (route) =>
          route
            .phase1bSchedule7
            .available
      )
      .map(
        (route) =>
          route.routeCode
      );


  const supplementalOnlyCodes =
    routeCatalog
      .filter(
        (route) =>
          !route.geometry
            .canonicalGeometryAvailable &&
          route.geometry
            .supplementalSegmentCount >
            0
      )
      .map(
        (route) =>
          route.routeCode
      );


  const noSpatialGeometryCodes =
    routeCatalog
      .filter(
        (route) =>
          !route.geometry
            .canonicalGeometryAvailable &&
          route.geometry
            .supplementalSegmentCount ===
            0
      )
      .map(
        (route) =>
          route.routeCode
      );


  // ==========================================================
  // Attachments QA
  // ==========================================================

  const attachedGeneralStations =
    generalStationNodes.filter(
      (station) =>
        station
          .routeAttachments
          .length >
        0
    );


  const unattachedGeneralStations =
    generalStationNodes.filter(
      (station) =>
        station
          .routeAttachments
          .length ===
        0
    );


  const multiRouteGeneralStations =
    generalStationNodes.filter(
      (station) =>
        station
          .routeAttachments
          .length >
        1
    );


  const attachedPhase1cStations =
    phase1cStationNodes.filter(
      (station) =>
        station
          .existingCodedRouteAttachments
          .length >
        0
    );


  // ==========================================================
  // Fare metadata
  // ==========================================================

  const fareBands =
    fares
      ?.fareModel
      ?.bands ??
    [];


  if (
    fareBands.length !==
    7
  ) {

    warnings.push(
      `Expected 7 current Rea Vaya fare bands; found ${fareBands.length}.`
    );
  }


  // ==========================================================
  // Explicit limitations
  // ==========================================================

  warnings.push(
    "Complementary routes do not yet have canonical coded route geometry. C1 has supplemental segments only; C2-C6 are not traversed spatially by this graph."
  );


  warnings.push(
    "The 58 general BRT station points have official coordinates but no reliable names in their GIS source layer."
  );


  warnings.push(
    "Route direction remains unverified. Network connectivity is therefore non-directional in this evidence graph."
  );


  warnings.push(
    "Spatial station-to-route associations use derived GIS tolerances and are not official service-assignment fields."
  );


  warnings.push(
    "A route-to-route connectivity candidate is not automatically a guaranteed operational transfer or timed connection."
  );


  warnings.push(
    "GIS geometry length is QA/reference information only and must not replace the published Rea Vaya journey-distance basis for fare calculation."
  );


  // ==========================================================
  // Graph output
  // ==========================================================

  const graph = {
    schemaVersion:
      1,

    graphType:
      "evidence-based-route-connectivity-graph",

    operatorId:
      "reavaya",

    generatedAt:
      new Date().toISOString(),

    coordinateReferenceSystem:
      "EPSG:4326",

    purpose:
      "Support conservative Rea Vaya applicability and network-connectivity reasoning without inventing missing service data.",

    spatialAssociationRules: {
      generalStationToRouteThresholdMeters:
        GENERAL_STATION_ROUTE_ATTACH_METERS,

      phase1cStationToExistingRouteThresholdMeters:
        PHASE1C_ROUTE_ATTACH_METERS,

      thresholdsStatus:
        "derived-engineering-tolerances-not-official-service-rules",
    },

    coverage: {
      currentRouteInventoryCount:
        routeCodes.length,

      canonicalGeometryRouteCount:
        canonicalCodes.length,

      phase1bDetailedRouteCount:
        phase1bCodes.length,

      supplementalOnlyRouteCodes:
        supplementalOnlyCodes,

      noSpatialGeometryRouteCodes:
        noSpatialGeometryCodes,

      generalOfficialStationPointCount:
        generalStationNodes.length,

      namedPhase1cStationCount:
        phase1cStationNodes.length,

      publishedStopEvidenceNodeCount:
        publishedStopNodes.length,

      routeConnectivityCandidateCount:
        transferCandidates.length,
    },

    nodes: {
      routes:
        routeNodes,

      publishedStopEvidence:
        publishedStopNodes,

      generalBrtStationPoints:
        generalStationNodes,

      phase1cNamedStations:
        phase1cStationNodes,
    },

    edges: {
      routeToPublishedStopEvidence:
        routeStopEdges,

      generalStationToRouteSpatial:
        generalStationRouteEdges,

      phase1cStationToExistingRouteSpatial:
        phase1cRouteEdges,

      routeConnectivity:
        transferCandidates,
    },

    fares: {
      currentDatasetAvailable:
        true,

      currency:
        fares.currency,

      effectiveFrom:
        fares.effectiveFrom,

      effectiveTo:
        fares.effectiveTo,

      fareModelType:
        fares
          ?.fareModel
          ?.type,

      fareDistanceBasis:
        fares
          ?.fareModel
          ?.distanceBasis,

      fareBandCount:
        fareBands.length,

      passengerSpecificFareCalculationReady:
        false,

      reason:
        "The network graph still needs a passenger-specific Rea Vaya journey-distance calculation before selecting a fare band.",
    },

    routingCapabilities: {
      currentRouteInventory:
        true,

      canonicalFeederGeometry:
        true,

      canonicalTrunkGeometry:
        true,

      canonicalComplementaryGeometry:
        false,

      sharedPublishedStopConnectivity:
        true,

      officialStationSpatialConnectivity:
        true,

      verifiedDirection:
        false,

      completeStopSequence:
        false,

      exactTimetable:
        false,

      liveArrivals:
        false,

      passengerSpecificFareDistance:
        false,

      finalJourneyRoutingReady:
        false,
    },

    appRules: [
      "Use this graph as evidence for Rea Vaya applicability, not as a complete timetable router.",
      "Do not claim boarding at an unnamed GIS station point by name.",
      "Do not interpret route geometry coordinate order as service direction.",
      "Do not traverse C2-C6 spatially until route-level geometry evidence exists.",
      "C1 supplemental segments are evidence only until ordered topology is established.",
      "Shared published stops support route connectivity but do not prove timed connections.",
      "Shared GIS station-point proximity supports spatial connectivity but remains a derived association.",
      "Never use GIS route length as the Rea Vaya fare distance without a passenger-specific validated journey-distance method.",
      "Never generate a live ETA from this static graph.",
    ],
  };


  // ==========================================================
  // Transfer output
  // ==========================================================

  const transferOutput = {
    schemaVersion:
      1,

    operatorId:
      "reavaya",

    generatedAt:
      new Date().toISOString(),

    definition:
      "Route-to-route connectivity evidence. These are candidates/supporting links, not guaranteed passenger transfers.",

    candidateCount:
      transferCandidates.length,

    candidates:
      transferCandidates,
  };


  // ==========================================================
  // Reconciliation report
  // ==========================================================

  const distanceComparisons =
    routeCatalog
      .filter(
        (route) =>
          route.geometry
            .distanceComparison
      )
      .map(
        (route) => ({
          routeCode:
            route.routeCode,

          ...route.geometry
            .distanceComparison,
        })
      );


  const report = {
    generatedAt:
      new Date().toISOString(),

    operatorId:
      "reavaya",

    routeCoverage: {
      currentInventoryCount:
        routeCodes.length,

      currentRouteCodes:
        routeCodes,

      canonicalGeometryCount:
        canonicalCodes.length,

      canonicalGeometryCodes:
        canonicalCodes,

      phase1bDetailCount:
        phase1bCodes.length,

      phase1bDetailCodes:
        phase1bCodes,

      supplementalOnlyCodes,

      noSpatialGeometryCodes,
    },

    stationCoverage: {
      generalOfficialStationPoints:
        generalStationNodes.length,

      generalStationsAttachedToAtLeastOneCanonicalRoute:
        attachedGeneralStations.length,

      generalStationsNotAttachedAtThreshold:
        unattachedGeneralStations.length,

      generalStationsNearMultipleCanonicalRoutes:
        multiRouteGeneralStations.length,

      phase1cNamedStations:
        phase1cStationNodes.length,

      phase1cStationsNearExistingCanonicalRoutes:
        attachedPhase1cStations.length,

      generalAttachmentThresholdMeters:
        GENERAL_STATION_ROUTE_ATTACH_METERS,

      phase1cAttachmentThresholdMeters:
        PHASE1C_ROUTE_ATTACH_METERS,
    },

    publishedStopEvidence: {
      uniqueNormalizedStopNodes:
        publishedStopNodes.length,

      routeStopEvidenceEdges:
        routeStopEdges.length,

      nodesSharedByMultipleRoutes:
        publishedStopNodes.filter(
          (node) =>
            node.routeCodes.length >
            1
        ).length,
    },

    routeConnectivity: {
      candidateCount:
        transferCandidates.length,

      candidatesWithPublishedSharedStop:
        transferCandidates.filter(
          (candidate) =>
            candidate
              .sharedPublishedStopCount >
            0
        ).length,

      candidatesWithSharedOfficialStationPoint:
        transferCandidates.filter(
          (candidate) =>
            candidate
              .sharedOfficialStationPointCount >
            0
        ).length,

      conservativeConnectivitySupportedCount:
        transferCandidates.filter(
          (candidate) =>
            candidate
              .conservativeNetworkConnectivitySupported
        ).length,

      userFacingVerifiedTransferCount:
        0,
    },

    distanceComparisons,

    fares: {
      effectiveFrom:
        fares.effectiveFrom,

      effectiveTo:
        fares.effectiveTo,

      bandCount:
        fareBands.length,

      journeyFareCalculationReady:
        false,
    },

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
  // Route catalog output wrapper
  // ==========================================================

  const routeCatalogOutput = {
    schemaVersion:
      1,

    operatorId:
      "reavaya",

    generatedAt:
      new Date().toISOString(),

    routeCount:
      routeCatalog.length,

    routes:
      routeCatalog,
  };


  // ==========================================================
  // Write outputs
  // ==========================================================

  await writeJson(
    OUTPUT.routeCatalog,
    routeCatalogOutput
  );


  await writeJson(
    OUTPUT.graph,
    graph
  );


  await writeJson(
    OUTPUT.transfers,
    transferOutput
  );


  await writeJson(
    OUTPUT.report,
    report
  );


  // ==========================================================
  // Console output
  // ==========================================================

  console.log(
    "Rea Vaya evidence graph built."
  );

  console.log("");

  console.log(
    `Current route inventory: ${routeCodes.length}`
  );

  console.log(
    `Canonical coded geometry: ${canonicalCodes.length}`
  );

  console.log(
    `Phase 1B detailed routes: ${phase1bCodes.length}`
  );

  console.log(
    `Supplemental-only geometry routes: ${supplementalOnlyCodes.join(", ") || "none"}`
  );

  console.log(
    `Routes with no spatial geometry: ${noSpatialGeometryCodes.join(", ") || "none"}`
  );

  console.log("");

  console.log(
    `Published stop evidence nodes: ${publishedStopNodes.length}`
  );

  console.log(
    `Route-stop evidence edges: ${routeStopEdges.length}`
  );

  console.log(
    `Shared published stop nodes: ${
      publishedStopNodes.filter(
        (node) =>
          node.routeCodes.length >
          1
      ).length
    }`
  );

  console.log("");

  console.log(
    `General BRT station points: ${generalStationNodes.length}`
  );

  console.log(
    `Attached to >=1 canonical route: ${attachedGeneralStations.length}`
  );

  console.log(
    `Unattached at ${GENERAL_STATION_ROUTE_ATTACH_METERS}m: ${unattachedGeneralStations.length}`
  );

  console.log(
    `Near multiple canonical routes: ${multiRouteGeneralStations.length}`
  );

  console.log("");

  console.log(
    `Named Phase 1C stations: ${phase1cStationNodes.length}`
  );

  console.log(
    `Near existing canonical routes: ${attachedPhase1cStations.length}`
  );

  console.log("");

  console.log(
    `Route connectivity candidates: ${transferCandidates.length}`
  );

  console.log(
    `With published shared-stop evidence: ${
      transferCandidates.filter(
        (candidate) =>
          candidate
            .sharedPublishedStopCount >
          0
      ).length
    }`
  );

  console.log(
    `With shared official station-point evidence: ${
      transferCandidates.filter(
        (candidate) =>
          candidate
            .sharedOfficialStationPointCount >
          0
      ).length
    }`
  );

  console.log(
    `Conservative connectivity supported: ${
      transferCandidates.filter(
        (candidate) =>
          candidate
            .conservativeNetworkConnectivitySupported
      ).length
    }`
  );

  console.log("");

  console.log(
    `Schedule-vs-GIS distance comparisons: ${distanceComparisons.length}`
  );

  console.log(
    `Current fare bands available: ${fareBands.length}`
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
    `  ${OUTPUT.routeCatalog}`
  );

  console.log(
    `  ${OUTPUT.graph}`
  );

  console.log(
    `  ${OUTPUT.transfers}`
  );

  console.log(
    `  ${OUTPUT.report}`
  );

  console.log("");

  console.log(
    "Important: this is an evidence/connectivity graph, not yet a complete directional timetable journey router."
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
      "Rea Vaya evidence graph QA failed."
    );
  }
};


main().catch(
  (error) => {

    console.error("");

    console.error(
      "Rea Vaya graph build failed:"
    );

    console.error(
      error
    );

    process.exitCode =
      1;
  }
);