import fs from "node:fs/promises";
import path from "node:path";

// ============================================================
// Pulse Transit - Rea Vaya GIS Normalizer
//
// INPUT:
//   src/data/transit/gauteng/reavaya/raw/gis/*.geojson
//
// OUTPUT:
//   canonical-route-geometries.geojson
//   phase1c-stations.geojson
//   brt-station-points.geojson
//   supplemental-route-segments.geojson
//   gis-network.json
//   gis-normalization-report.json
//
// Principles:
// - preserve official City geometry
// - do not invent station names
// - do not infer route direction from line coordinate order
// - do not infer stop sequence
// - do not merge unordered segment layers into fake routes
// - distinguish canonical coded geometry from supplemental evidence
// ============================================================

const ROOT = path.resolve(
  "src/data/transit/gauteng/reavaya"
);

const RAW_GIS = path.join(
  ROOT,
  "raw",
  "gis"
);


// ============================================================
// Input files
// ============================================================

const FILES = {
  brtRoutes:
    path.join(
      RAW_GIS,
      "brt-routes.geojson"
    ),

  brtStations:
    path.join(
      RAW_GIS,
      "brt-stations.geojson"
    ),

  brtStops:
    path.join(
      RAW_GIS,
      "brt-stops.geojson"
    ),

  feederRoutes:
    path.join(
      RAW_GIS,
      "brt-feeder-routes.geojson"
    ),

  trunkRoutes:
    path.join(
      RAW_GIS,
      "brt-trunk-routes.geojson"
    ),

  phase1cStations:
    path.join(
      RAW_GIS,
      "phase1c-stations.geojson"
    ),

  c1:
    path.join(
      RAW_GIS,
      "route-c1.geojson"
    ),

  f11:
    path.join(
      RAW_GIS,
      "route-f11.geojson"
    ),

  t1:
    path.join(
      RAW_GIS,
      "route-t1.geojson"
    ),

  t2:
    path.join(
      RAW_GIS,
      "route-t2.geojson"
    ),

  t3:
    path.join(
      RAW_GIS,
      "route-t3.geojson"
    ),
};


// ============================================================
// Output files
// ============================================================

const OUTPUTS = {
  canonicalRoutes:
    path.join(
      ROOT,
      "canonical-route-geometries.geojson"
    ),

  phase1cStations:
    path.join(
      ROOT,
      "phase1c-stations.geojson"
    ),

  stationPoints:
    path.join(
      ROOT,
      "brt-station-points.geojson"
    ),

  supplementalSegments:
    path.join(
      ROOT,
      "supplemental-route-segments.geojson"
    ),

  network:
    path.join(
      ROOT,
      "gis-network.json"
    ),

  report:
    path.join(
      ROOT,
      "gis-normalization-report.json"
    ),
};


// ============================================================
// Expected route inventory
// ============================================================

const EXPECTED_FEEDERS = [
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
  "F11",
  "F12",
];

const EXPECTED_TRUNKS = [
  "T1",
  "T2",
  "T3",
];

const MASTER_ROUTE_FILES = [
  {
    routeCode: "C1",
    filename: FILES.c1,
    sourceLayer:
      "BRT C1 Dobsonville To Ellis Park",
  },

  {
    routeCode: "F11",
    filename: FILES.f11,
    sourceLayer:
      "BRT F11 Yeoville To Metro Centre",
  },

  {
    routeCode: "T1",
    filename: FILES.t1,
    sourceLayer:
      "BRT T1 Thokoza To Ellis Park",
  },

  {
    routeCode: "T2",
    filename: FILES.t2,
    sourceLayer:
      "BRT T2 Thokoza To Braamfontein",
  },

  {
    routeCode: "T3",
    filename: FILES.t3,
    sourceLayer:
      "BRT T3 Thokoza To Metro Centre",
  },
];


// ============================================================
// Helpers
// ============================================================

const naturalCodeSort = (a, b) => {
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
    aMatch[1] === bMatch[1]
  ) {
    return (
      Number(aMatch[2]) -
      Number(bMatch[2])
    );
  }

  return String(a).localeCompare(
    String(b)
  );
};


const readJson = async (filename) => {
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


const readFeatureCollection =
  async (filename) => {

    const json =
      await readJson(
        filename
      );

    if (
      json.type !==
      "FeatureCollection"
    ) {
      throw new Error(
        `${filename} is not a GeoJSON FeatureCollection.`
      );
    }

    if (
      !Array.isArray(
        json.features
      )
    ) {
      throw new Error(
        `${filename} has no features array.`
      );
    }

    return json;
  };


const getProperty = (
  properties,
  candidates
) => {

  if (!properties) {
    return null;
  }

  for (
    const candidate of
      candidates
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        properties,
        candidate
      )
    ) {
      return properties[
        candidate
      ];
    }
  }

  return null;
};


const getStringProperty = (
  properties,
  candidates
) => {

  const value =
    getProperty(
      properties,
      candidates
    );

  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const normalized =
    String(value).trim();

  return normalized || null;
};


const getObjectId = (
  properties
) => {

  const candidate =
    getProperty(
      properties,
      [
        "OBJECTID",
        "ObjectID",
        "objectid",
        "FID",
        "FID_",
        "ID",
      ]
    );

  return (
    candidate ??
    null
  );
};


const routeCodeFromFeature = (
  feature
) => {

  const rawName =
    getStringProperty(
      feature.properties,
      [
        "Name",
        "NAME",
        "name",
      ]
    );

  if (!rawName) {
    return null;
  }

  const match =
    rawName
      .toUpperCase()
      .match(
        /\b([FTC]\d{1,2})\b/
      );

  return (
    match?.[1] ??
    null
  );
};


const routeFamilyFromCode = (
  routeCode
) => {

  if (
    routeCode.startsWith(
      "F"
    )
  ) {
    return "feeder";
  }

  if (
    routeCode.startsWith(
      "T"
    )
  ) {
    return "trunk";
  }

  if (
    routeCode.startsWith(
      "C"
    )
  ) {
    return "complementary";
  }

  return "unknown";
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


const coordinatesForGeometry = (
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


const validateWgs84Geometry = (
  geometry
) => {

  const coords =
    coordinatesForGeometry(
      geometry
    );

  if (
    coords.length === 0
  ) {
    return {
      valid: false,
      coordinateCount: 0,
      invalidCoordinates: [],
    };
  }

  const invalid =
    coords.filter(
      ([lon, lat]) =>
        !Number.isFinite(lon) ||
        !Number.isFinite(lat) ||
        lon < -180 ||
        lon > 180 ||
        lat < -90 ||
        lat > 90
    );

  return {
    valid:
      invalid.length === 0,

    coordinateCount:
      coords.length,

    invalidCoordinates:
      invalid.slice(
        0,
        10
      ),
  };
};


const getFeatureCollectionExtent = (
  features
) => {

  const allCoords = [];

  for (
    const feature of features
  ) {
    allCoords.push(
      ...coordinatesForGeometry(
        feature.geometry
      )
    );
  }

  if (
    allCoords.length === 0
  ) {
    return null;
  }

  const longitudes =
    allCoords.map(
      ([lon]) => lon
    );

  const latitudes =
    allCoords.map(
      ([, lat]) => lat
    );

  return {
    minLon:
      Math.min(
        ...longitudes
      ),

    minLat:
      Math.min(
        ...latitudes
      ),

    maxLon:
      Math.max(
        ...longitudes
      ),

    maxLat:
      Math.max(
        ...latitudes
      ),
  };
};


const geometryTypes = (
  features
) =>
    [
      ...new Set(
        features
          .map(
            (feature) =>
              feature
                .geometry
                ?.type
          )
          .filter(
            Boolean
          )
      ),
    ].sort();


const countInvalidGeometry =
  (features) =>
    features.filter(
      (feature) =>
        !validateWgs84Geometry(
          feature.geometry
        ).valid
    ).length;


const writeJson =
  async (
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


const normalizePhase1cDisplayName =
  (sourceName) => {

    if (!sourceName) {
      return null;
    }

    return sourceName
      .replace(
        /^Phase\s*1C\s*/i,
        ""
      )
      .replace(
        /\s+Station$/i,
        ""
      )
      .trim();
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
    " Pulse Transit - Rea Vaya GIS Normalizer"
  );
  console.log(
    "================================================"
  );
  console.log("");


  const errors = [];
  const warnings = [];


  // ==========================================================
  // Load raw files
  // ==========================================================

  const [
    brtRoutes,
    brtStations,
    brtStops,
    feederRoutes,
    trunkRoutes,
    phase1cStations,
  ] =
    await Promise.all([
      readFeatureCollection(
        FILES.brtRoutes
      ),

      readFeatureCollection(
        FILES.brtStations
      ),

      readFeatureCollection(
        FILES.brtStops
      ),

      readFeatureCollection(
        FILES.feederRoutes
      ),

      readFeatureCollection(
        FILES.trunkRoutes
      ),

      readFeatureCollection(
        FILES.phase1cStations
      ),
    ]);


  // ==========================================================
  // Source-count QA
  // ==========================================================

  const sourceCounts = {
    brtRoutes:
      brtRoutes.features.length,

    brtStations:
      brtStations.features.length,

    brtStops:
      brtStops.features.length,

    feederRoutes:
      feederRoutes.features.length,

    trunkRoutes:
      trunkRoutes.features.length,

    phase1cStations:
      phase1cStations.features.length,
  };


  if (
    sourceCounts.brtRoutes !==
    99
  ) {
    warnings.push(
      `General BRT Routes count changed from 99 to ${sourceCounts.brtRoutes}.`
    );
  }


  if (
    sourceCounts.brtStations !==
    58
  ) {
    warnings.push(
      `BRT Stations count changed from 58 to ${sourceCounts.brtStations}.`
    );
  }


  if (
    sourceCounts.brtStops !==
    0
  ) {
    warnings.push(
      `BRT Stops is no longer empty; found ${sourceCounts.brtStops} features. Inspect before using.`
    );
  }


  if (
    sourceCounts.feederRoutes !==
    12
  ) {
    errors.push(
      `Expected 12 named feeder route features; found ${sourceCounts.feederRoutes}.`
    );
  }


  if (
    sourceCounts.trunkRoutes !==
    3
  ) {
    errors.push(
      `Expected 3 named trunk route features; found ${sourceCounts.trunkRoutes}.`
    );
  }


  if (
    sourceCounts.phase1cStations !==
    14
  ) {
    warnings.push(
      `Phase 1C station layer currently contains ${sourceCounts.phase1cStations} features instead of the previously observed 14.`
    );
  }


  // ==========================================================
  // Canonical coded route geometries
  //
  // Only layers where the City exposes one named feature per
  // route code are promoted here.
  // ==========================================================

  const canonicalRoutes = [];


  for (
    const feature of
      feederRoutes.features
  ) {

    const routeCode =
      routeCodeFromFeature(
        feature
      );

    if (!routeCode) {
      errors.push(
        "A feeder geometry has no usable route code."
      );

      continue;
    }

    canonicalRoutes.push({
      type:
        "Feature",

      id:
        `reavaya-${routeCode.toLowerCase()}`,

      geometry:
        feature.geometry,

      properties: {
        operatorId:
          "reavaya",

        routeCode,

        routeFamily:
          "feeder",

        geometryStatus:
          "official-coded-route-geometry",

        geometryDirection:
          "unverified",

        stopSequenceEncoded:
          false,

        sourceAuthority:
          "City of Johannesburg",

        sourceService:
          "Transportation",

        sourceLayerId:
          140,

        sourceLayerName:
          "BRT Feeder Routes",

        sourceObjectId:
          getObjectId(
            feature.properties
          ),
      },
    });
  }


  for (
    const feature of
      trunkRoutes.features
  ) {

    const routeCode =
      routeCodeFromFeature(
        feature
      );

    if (!routeCode) {
      errors.push(
        "A trunk geometry has no usable route code."
      );

      continue;
    }

    canonicalRoutes.push({
      type:
        "Feature",

      id:
        `reavaya-${routeCode.toLowerCase()}`,

      geometry:
        feature.geometry,

      properties: {
        operatorId:
          "reavaya",

        routeCode,

        routeFamily:
          "trunk",

        geometryStatus:
          "official-coded-route-geometry",

        geometryDirection:
          "unverified",

        stopSequenceEncoded:
          false,

        sourceAuthority:
          "City of Johannesburg",

        sourceService:
          "Transportation",

        sourceLayerId:
          54,

        sourceLayerName:
          "BRT Trunk Routes",

        sourceObjectId:
          getObjectId(
            feature.properties
          ),
      },
    });
  }


  canonicalRoutes.sort(
    (a, b) =>
      naturalCodeSort(
        a.properties.routeCode,
        b.properties.routeCode
      )
  );


  const canonicalCodes =
    canonicalRoutes.map(
      (feature) =>
        feature.properties
          .routeCode
    );


  const feederCodes =
    canonicalRoutes
      .filter(
        (feature) =>
          feature.properties
            .routeFamily ===
          "feeder"
      )
      .map(
        (feature) =>
          feature.properties
            .routeCode
      );


  const trunkCodes =
    canonicalRoutes
      .filter(
        (feature) =>
          feature.properties
            .routeFamily ===
          "trunk"
      )
      .map(
        (feature) =>
          feature.properties
            .routeCode
      );


  for (
    const code of
      EXPECTED_FEEDERS
  ) {
    if (
      !feederCodes.includes(
        code
      )
    ) {
      errors.push(
        `Missing canonical feeder geometry for ${code}.`
      );
    }
  }


  for (
    const code of
      EXPECTED_TRUNKS
  ) {
    if (
      !trunkCodes.includes(
        code
      )
    ) {
      errors.push(
        `Missing canonical trunk geometry for ${code}.`
      );
    }
  }


  if (
    new Set(
      canonicalCodes
    ).size !==
    canonicalCodes.length
  ) {
    errors.push(
      "Duplicate route codes exist in canonical route geometry."
    );
  }


  // ==========================================================
  // Canonical geometry QA
  // ==========================================================

  const invalidCanonicalGeometry =
    countInvalidGeometry(
      canonicalRoutes
    );


  if (
    invalidCanonicalGeometry >
    0
  ) {
    errors.push(
      `${invalidCanonicalGeometry} canonical route geometries contain invalid WGS84 coordinates.`
    );
  }


  // ==========================================================
  // Phase 1C named stations
  // ==========================================================

  const normalizedPhase1cStations =
    phase1cStations.features.map(
      (
        feature,
        index
      ) => {

        const sourceName =
          getStringProperty(
            feature.properties,
            [
              "Name",
              "NAME",
              "name",
            ]
          );


        if (!sourceName) {
          errors.push(
            `Phase 1C station feature ${index + 1} has no Name attribute.`
          );
        }


        return {
          type:
            "Feature",

          id:
            `reavaya-phase1c-station-${index + 1}`,

          geometry:
            feature.geometry,

          properties: {
            operatorId:
              "reavaya",

            phase:
              "Phase 1C",

            sourceName,

            displayName:
              normalizePhase1cDisplayName(
                sourceName
              ),

            stationNameStatus:
              "official",

            displayNameStatus:
              "derived-from-official-name",

            coordinateStatus:
              "official-gis",

            sourceAuthority:
              "City of Johannesburg",

            sourceService:
              "TransportationMaster",

            sourceLayerId:
              0,

            sourceLayerName:
              "BRT Stations Phase 1C 11Stations",

            sourceObjectId:
              getObjectId(
                feature.properties
              ),
          },
        };
      }
    );


  const invalidPhase1cCoordinates =
    countInvalidGeometry(
      normalizedPhase1cStations
    );


  if (
    invalidPhase1cCoordinates >
    0
  ) {
    errors.push(
      `${invalidPhase1cCoordinates} Phase 1C station features contain invalid WGS84 coordinates.`
    );
  }


  const phase1cSourceNames =
    normalizedPhase1cStations
      .map(
        (feature) =>
          feature.properties
            .sourceName
      )
      .filter(
        Boolean
      );


  if (
    new Set(
      phase1cSourceNames
    ).size !==
    phase1cSourceNames.length
  ) {
    warnings.push(
      "Duplicate Phase 1C source station names were found."
    );
  }


  // ==========================================================
  // General BRT station points
  //
  // These points are valuable official coordinates, but the
  // inspected layer does not expose a reliable station-name
  // attribute. Do NOT attach tender names here.
  // ==========================================================

  const normalizedStationPoints =
    brtStations.features.map(
      (
        feature,
        index
      ) => {

        return {
          type:
            "Feature",

          id:
            `reavaya-brt-point-${index + 1}`,

          geometry:
            feature.geometry,

          properties: {
            operatorId:
              "reavaya",

            sourceName:
              null,

            stationNameStatus:
              "not-available-in-source-layer",

            coordinateStatus:
              "official-gis",

            sourceAuthority:
              "City of Johannesburg",

            sourceService:
              "Transportation",

            sourceLayerId:
              6,

            sourceLayerName:
              "BRT Stations",

            sourceObjectId:
              getObjectId(
                feature.properties
              ),
          },
        };
      }
    );


  const invalidStationCoordinates =
    countInvalidGeometry(
      normalizedStationPoints
    );


  if (
    invalidStationCoordinates >
    0
  ) {
    errors.push(
      `${invalidStationCoordinates} general BRT station points contain invalid WGS84 coordinates.`
    );
  }


  warnings.push(
    "The general BRT Stations layer contains official point geometry but does not expose a reliable station-name attribute in the inspected data. Pulse therefore does not assign station names to those 58 points."
  );


  // ==========================================================
  // Supplemental route segment layers
  //
  // These are kept as evidence / validation.
  // Their feature ordering must not be interpreted as service
  // ordering or route direction.
  // ==========================================================

  const supplementalSegments = [];

  const masterSegmentCounts =
    {};


  for (
    const routeSource of
      MASTER_ROUTE_FILES
  ) {

    const collection =
      await readFeatureCollection(
        routeSource.filename
      );


    masterSegmentCounts[
      routeSource.routeCode
    ] =
      collection.features.length;


    collection.features.forEach(
      (
        feature,
        index
      ) => {

        const sourcePhase =
          getStringProperty(
            feature.properties,
            [
              "PHASE",
              "Phase",
              "phase",
            ]
          );


        const sourceType =
          getStringProperty(
            feature.properties,
            [
              "TYPE",
              "Type",
              "type",
            ]
          );


        supplementalSegments.push({
          type:
            "Feature",

          id:
            `reavaya-${routeSource.routeCode.toLowerCase()}-segment-${index + 1}`,

          geometry:
            feature.geometry,

          properties: {
            operatorId:
              "reavaya",

            routeCode:
              routeSource.routeCode,

            routeFamily:
              routeFamilyFromCode(
                routeSource.routeCode
              ),

            segmentIndex:
              index + 1,

            segmentIndexStatus:
              "source-feature-index-not-service-sequence",

            sourcePhase,

            sourceType,

            geometryStatus:
              "official-supplemental-segment",

            geometryDirection:
              "unverified",

            serviceSequence:
              null,

            sourceAuthority:
              "City of Johannesburg",

            sourceService:
              "TransportationMaster",

            sourceLayerName:
              routeSource.sourceLayer,

            sourceObjectId:
              getObjectId(
                feature.properties
              ),
          },
        });
      }
    );
  }


  const invalidSupplementalGeometry =
    countInvalidGeometry(
      supplementalSegments
    );


  if (
    invalidSupplementalGeometry >
    0
  ) {
    errors.push(
      `${invalidSupplementalGeometry} supplemental route segments contain invalid WGS84 coordinates.`
    );
  }


  warnings.push(
    "TransportationMaster C1/F11/T1/T2/T3 layers contain multiple GIS features. Their feature order is not treated as route sequence or service direction."
  );


  warnings.push(
    "C1 has official supplemental geometry, but it is not promoted to one ordered canonical route because its segment topology has not yet been verified."
  );


  // ==========================================================
  // Generic BRT route segmentation
  // ==========================================================

  const genericRoutePhaseCounts =
    {};

  const genericRouteTypeCounts =
    {};


  for (
    const feature of
      brtRoutes.features
  ) {

    const phase =
      getStringProperty(
        feature.properties,
        [
          "PHASE",
          "Phase",
          "phase",
        ]
      ) ??
      "unknown";


    const type =
      getStringProperty(
        feature.properties,
        [
          "TYPE",
          "Type",
          "type",
        ]
      ) ??
      "unknown";


    genericRoutePhaseCounts[
      phase
    ] =
      (
        genericRoutePhaseCounts[
          phase
        ] ??
        0
      ) + 1;


    genericRouteTypeCounts[
      type
    ] =
      (
        genericRouteTypeCounts[
          type
        ] ??
        0
      ) + 1;
  }


  // ==========================================================
  // Empty BRT Stops layer
  // ==========================================================

  if (
    brtStops.features.length ===
    0
  ) {
    warnings.push(
      "The official Transportation/BRT Stops layer currently contains zero features. Pulse will not create stop points from this empty source."
    );
  }


  // ==========================================================
  // Phase 1C source-name mismatch
  // ==========================================================

  if (
    phase1cStations.features.length !==
    11
  ) {
    warnings.push(
      `The source layer is named 'BRT Stations Phase 1C 11Stations' but currently contains ${phase1cStations.features.length} features. Pulse uses the actual queried feature count rather than inferring 11 stations from the layer title.`
    );
  }


  // ==========================================================
  // GeoJSON outputs
  // ==========================================================

  const canonicalRouteCollection = {
    type:
      "FeatureCollection",

    name:
      "Pulse Transit Rea Vaya Canonical Coded Route Geometries",

    crsStatus:
      "requested-from-source-as-EPSG:4326",

    features:
      canonicalRoutes,
  };


  const phase1cStationCollection = {
    type:
      "FeatureCollection",

    name:
      "Pulse Transit Rea Vaya Phase 1C Named Stations",

    crsStatus:
      "requested-from-source-as-EPSG:4326",

    features:
      normalizedPhase1cStations,
  };


  const stationPointCollection = {
    type:
      "FeatureCollection",

    name:
      "Pulse Transit Rea Vaya Official BRT Station Points",

    crsStatus:
      "requested-from-source-as-EPSG:4326",

    features:
      normalizedStationPoints,
  };


  const supplementalCollection = {
    type:
      "FeatureCollection",

    name:
      "Pulse Transit Rea Vaya Supplemental Route Segments",

    crsStatus:
      "requested-from-source-as-EPSG:4326",

    features:
      supplementalSegments,
  };


  // ==========================================================
  // GIS network metadata
  // ==========================================================

  const network = {
    schemaVersion:
      1,

    operatorId:
      "reavaya",

    generatedAt:
      new Date().toISOString(),

    authority:
      "City of Johannesburg",

    coordinateReferenceSystem:
      "EPSG:4326",

    sourceCounts,

    canonicalGeometry: {
      routeCount:
        canonicalRoutes.length,

      feederCount:
        feederCodes.length,

      trunkCount:
        trunkCodes.length,

      complementaryCount:
        0,

      routeCodes:
        canonicalCodes,

      sourceFiles: [
        "raw/gis/brt-feeder-routes.geojson",
        "raw/gis/brt-trunk-routes.geojson",
      ],

      outputFile:
        "canonical-route-geometries.geojson",

      status:
        "official-coded-route-geometry",

      directionVerified:
        false,

      stopSequenceVerified:
        false,
    },

    complementaryGeometry: {
      canonicalCodedRoutes: [],

      supplementalCodedRoutes: [
        "C1",
      ],

      missingCanonicalCodes: [
        "C1",
        "C2",
        "C3",
        "C4",
        "C5",
        "C6",
      ],

      rule:
        "Do not invent complementary route geometry. C1 remains supplemental until segment topology is verified.",
    },

    stations: {
      generalOfficialPointCount:
        normalizedStationPoints.length,

      generalNamedPointCount:
        0,

      phase1cNamedPointCount:
        normalizedPhase1cStations.length,

      generalStationOutput:
        "brt-station-points.geojson",

      phase1cOutput:
        "phase1c-stations.geojson",

      stationNamesForGeneralLayer:
        "not-available-in-source-layer",
    },

    supplementalGeometry: {
      routeCodes:
        Object.keys(
          masterSegmentCounts
        ),

      segmentCounts:
        masterSegmentCounts,

      outputFile:
        "supplemental-route-segments.geojson",

      ordered:
        false,

      directionVerified:
        false,
    },

    genericBrtGeometry: {
      sourceFeatureCount:
        brtRoutes.features.length,

      phaseCounts:
        genericRoutePhaseCounts,

      typeCounts:
        genericRouteTypeCounts,

      role:
        "official corridor/segment evidence; not treated as coded route inventory",
    },

    capabilities: {
      namedFeederGeometry:
        true,

      namedTrunkGeometry:
        true,

      namedComplementaryCanonicalGeometry:
        false,

      officialGeneralStationCoordinates:
        true,

      officialGeneralStationNames:
        false,

      officialPhase1cStationCoordinates:
        true,

      officialPhase1cStationNames:
        true,

      completeStopSequence:
        false,

      routeDirection:
        false,

      exactTimetable:
        false,

      realtime:
        false,
    },

    appRules: [
      "Use canonical F1-F12 and T1-T3 geometry for spatial route proximity checks.",
      "Do not infer service direction from GeoJSON coordinate ordering.",
      "Do not assign names to the general BRT station points until a reliable source relationship is established.",
      "Do not treat TransportationMaster feature order as passenger stop order.",
      "Do not treat feature count as route count.",
      "Do not construct C2-C6 geometry from generic BRT segments without route-level evidence.",
      "C1 supplemental geometry may be used for map/reference analysis but not ordered journey traversal until topology is verified.",
      "GIS geometry does not supply fares, timetables or live ETA.",
    ],
  };


  // ==========================================================
  // Report
  // ==========================================================

  const report = {
    generatedAt:
      new Date().toISOString(),

    operatorId:
      "reavaya",

    sourceCounts,

    canonicalRoutes: {
      count:
        canonicalRoutes.length,

      feederCodes,

      trunkCodes,

      routeCodes:
        canonicalCodes,

      geometryTypes:
        geometryTypes(
          canonicalRoutes
        ),

      extent:
        getFeatureCollectionExtent(
          canonicalRoutes
        ),

      invalidGeometryCount:
        invalidCanonicalGeometry,
    },

    phase1cStations: {
      count:
        normalizedPhase1cStations.length,

      sourceNames:
        phase1cSourceNames,

      extent:
        getFeatureCollectionExtent(
          normalizedPhase1cStations
        ),

      invalidGeometryCount:
        invalidPhase1cCoordinates,
    },

    generalBrtStations: {
      count:
        normalizedStationPoints.length,

      namedCount:
        0,

      extent:
        getFeatureCollectionExtent(
          normalizedStationPoints
        ),

      invalidGeometryCount:
        invalidStationCoordinates,
    },

    supplementalSegments: {
      totalCount:
        supplementalSegments.length,

      perRoute:
        masterSegmentCounts,

      geometryTypes:
        geometryTypes(
          supplementalSegments
        ),

      extent:
        getFeatureCollectionExtent(
          supplementalSegments
        ),

      invalidGeometryCount:
        invalidSupplementalGeometry,
    },

    genericBrtRoutes: {
      featureCount:
        brtRoutes.features.length,

      phaseCounts:
        genericRoutePhaseCounts,

      typeCounts:
        genericRouteTypeCounts,

      geometryTypes:
        geometryTypes(
          brtRoutes.features
        ),

      extent:
        getFeatureCollectionExtent(
          brtRoutes.features
        ),
    },

    emptyBrtStopLayer:
      brtStops.features.length ===
      0,

    errorCount:
      errors.length,

    errors,

    warningCount:
      warnings.length,

    warnings,

    qaPassed:
      errors.length === 0,
  };


  // ==========================================================
  // Write outputs
  // ==========================================================

  await writeJson(
    OUTPUTS.canonicalRoutes,
    canonicalRouteCollection
  );

  await writeJson(
    OUTPUTS.phase1cStations,
    phase1cStationCollection
  );

  await writeJson(
    OUTPUTS.stationPoints,
    stationPointCollection
  );

  await writeJson(
    OUTPUTS.supplementalSegments,
    supplementalCollection
  );

  await writeJson(
    OUTPUTS.network,
    network
  );

  await writeJson(
    OUTPUTS.report,
    report
  );


  // ==========================================================
  // Console
  // ==========================================================

  console.log(
    "GIS normalization complete."
  );

  console.log("");

  console.log(
    `Canonical coded route geometries: ${canonicalRoutes.length}`
  );

  console.log(
    `  Feeder: ${feederCodes.length}`
  );

  console.log(
    `  Trunk: ${trunkCodes.length}`
  );

  console.log(
    `  Complementary: 0`
  );

  console.log("");

  console.log(
    `Canonical route codes: ${canonicalCodes.join(", ")}`
  );

  console.log("");

  console.log(
    `General official BRT station points: ${normalizedStationPoints.length}`
  );

  console.log(
    `General station names assigned: 0`
  );

  console.log(
    `Named Phase 1C station points: ${normalizedPhase1cStations.length}`
  );

  console.log("");

  console.log(
    `Supplemental route segments: ${supplementalSegments.length}`
  );

  for (
    const [
      routeCode,
      count,
    ] of
      Object.entries(
        masterSegmentCounts
      )
  ) {
    console.log(
      `  ${routeCode}: ${count}`
    );
  }

  console.log("");

  console.log(
    `Generic BRT route features: ${brtRoutes.features.length}`
  );

  console.log(
    `Empty BRT Stops layer: ${brtStops.features.length === 0 ? "YES" : "NO"}`
  );

  console.log("");

  console.log(
    `Invalid canonical WGS84 geometry: ${invalidCanonicalGeometry}`
  );

  console.log(
    `Invalid general station geometry: ${invalidStationCoordinates}`
  );

  console.log(
    `Invalid Phase 1C station geometry: ${invalidPhase1cCoordinates}`
  );

  console.log(
    `Invalid supplemental geometry: ${invalidSupplementalGeometry}`
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
    `  ${OUTPUTS.canonicalRoutes}`
  );

  console.log(
    `  ${OUTPUTS.phase1cStations}`
  );

  console.log(
    `  ${OUTPUTS.stationPoints}`
  );

  console.log(
    `  ${OUTPUTS.supplementalSegments}`
  );

  console.log(
    `  ${OUTPUTS.network}`
  );

  console.log(
    `  ${OUTPUTS.report}`
  );

  console.log("");

  console.log(
    "Important: GIS geometry normalized only. No route direction, stop sequence, timetable or live ETA was inferred."
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
      "Rea Vaya GIS QA failed."
    );
  }
};


main().catch(
  (error) => {

    console.error("");

    console.error(
      "Rea Vaya GIS normalization failed:"
    );

    console.error(
      error
    );

    process.exitCode = 1;
  }
);