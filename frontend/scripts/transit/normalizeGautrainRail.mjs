import fs from "node:fs/promises";
import path from "node:path";

// ============================================================
// Pulse Transit - Gautrain Rail Service Normalizer
//
// INPUT
//   stations.json
//   raw/general-information.html
//
// OUTPUT
//   rail-lines.json
//   rail-normalization-report.json
//
// Important:
// - Records official service/corridor membership.
// - Does NOT invent track geometry.
// - Does NOT assume every listed station is an adjacent stop.
// - Does NOT infer transfer requirements.
// - Does NOT create travel times.
// ============================================================

const ROOT = path.resolve(
  "src/data/transit/gauteng/gautrain"
);

const RAW_DIR = path.join(
  ROOT,
  "raw"
);

const STATIONS_FILE = path.join(
  ROOT,
  "stations.json"
);

const GENERAL_INFO_FILE = path.join(
  RAW_DIR,
  "general-information.html"
);

const OUTPUT_FILE = path.join(
  ROOT,
  "rail-lines.json"
);

const REPORT_FILE = path.join(
  ROOT,
  "rail-normalization-report.json"
);

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const readJson = async (filename) => {
  const raw =
    await fs.readFile(
      filename,
      "utf8"
    );

  if (!raw.trim()) {
    throw new Error(
      `${filename} is empty`
    );
  }

  return JSON.parse(raw);
};

const decodeHtml = (value) =>
  String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&deg;/gi, "°")
    .replace(
      /&#(\d+);/g,
      (_, code) =>
        String.fromCodePoint(
          Number(code)
        )
    );

const stripHtml = (html) =>
  decodeHtml(
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
        /<!--[\s\S]*?-->/g,
        " "
      )
      .replace(
        /<[^>]+>/g,
        " "
      )
  )
    .replace(/\s+/g, " ")
    .trim();

const normalizeText = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const unique = (values) =>
  [...new Set(values)];

// ------------------------------------------------------------
// Official service definitions
//
// These reproduce service membership from the current
// Gautrain general-information wording.
//
// They are NOT declared as physical track adjacency.
// ------------------------------------------------------------

const SERVICE_DEFINITIONS = [
  {
    id: "gautrain-north-south",
    name: "North-South Commuter Service",
    serviceClass: "commuter",
    corridor: "north-south",

    sourceStationNames: [
      "Park",
      "Rosebank",
      "Sandton",
      "Midrand",
      "Centurion",
      "Pretoria",
      "Hatfield",
    ],

    sourceStationIds: [
      "gautrain-station-park",
      "gautrain-station-rosebank",
      "gautrain-station-sandton",
      "gautrain-station-midrand",
      "gautrain-station-centurion",
      "gautrain-station-pretoria",
      "gautrain-station-hatfield",
    ],

    sourceRelationship:
      "official-current-service-description",

    sourceOrderMeaning:
      "stations-listed-by-official-source",

    physicalAdjacencyVerified:
      false,

    completeStoppingPatternVerified:
      false,
  },

  {
    id: "gautrain-east-west",
    name: "East-West Commuter Service",
    serviceClass: "commuter",
    corridor: "east-west",

    sourceStationNames: [
      "Rhodesfield",
      "Marlboro",
      "Sandton",
    ],

    sourceStationIds: [
      "gautrain-station-rhodesfield",
      "gautrain-station-marlboro",
      "gautrain-station-sandton",
    ],

    sourceRelationship:
      "official-current-service-description",

    sourceOrderMeaning:
      "stations-listed-by-official-source",

    physicalAdjacencyVerified:
      false,

    completeStoppingPatternVerified:
      false,
  },

  {
    id: "gautrain-airport",
    name: "Airport Service",
    serviceClass: "airport",
    corridor: "east-west-airport",

    sourceStationNames: [
      "Sandton",
      "Marlboro",
      "OR Tambo",
    ],

    sourceStationIds: [
      "gautrain-station-sandton",
      "gautrain-station-marlboro",
      "gautrain-station-or-tambo",
    ],

    sourceRelationship:
      "official-current-service-description",

    sourceOrderMeaning:
      "service-membership-only",

    physicalAdjacencyVerified:
      false,

    completeStoppingPatternVerified:
      false,
  },
];

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

const main = async () => {
  console.log("");
  console.log(
    "================================================"
  );

  console.log(
    " Pulse Transit - Gautrain Rail Normalizer"
  );

  console.log(
    "================================================"
  );

  const stationsData =
    await readJson(
      STATIONS_FILE
    );

  const rawGeneralInfo =
    await fs.readFile(
      GENERAL_INFO_FILE,
      "utf8"
    );

  if (
    !rawGeneralInfo.trim()
  ) {
    throw new Error(
      "general-information.html is empty"
    );
  }

  const generalInfoText =
    stripHtml(
      rawGeneralInfo
    );

  const normalizedGeneralInfo =
    normalizeText(
      generalInfoText
    );

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

  // ----------------------------------------------------------
  // Validate all station references
  // ----------------------------------------------------------

  const missingStationReferences = [];

  for (
    const service of
      SERVICE_DEFINITIONS
  ) {
    for (
      const stationId of
        service.sourceStationIds
    ) {
      if (
        !stationById.has(
          stationId
        )
      ) {
        missingStationReferences.push({
          serviceId:
            service.id,
          stationId,
        });
      }
    }
  }

  // ----------------------------------------------------------
  // Validate that station names actually appear in the
  // downloaded official general-information page.
  // ----------------------------------------------------------

  const sourceNameChecks = [];

  for (
    const service of
      SERVICE_DEFINITIONS
  ) {
    for (
      const stationName of
        service.sourceStationNames
    ) {
      const present =
        normalizedGeneralInfo.includes(
          normalizeText(
            stationName
          )
        );

      sourceNameChecks.push({
        serviceId:
          service.id,

        stationName,

        present,
      });
    }
  }

  const missingSourceNames =
    sourceNameChecks.filter(
      (item) =>
        !item.present
    );

  // ----------------------------------------------------------
  // Build service records
  // ----------------------------------------------------------

  const services =
    SERVICE_DEFINITIONS.map(
      (definition) => ({
        id:
          definition.id,

        operatorId:
          "gautrain",

        mode:
          "rail",

        name:
          definition.name,

        serviceClass:
          definition.serviceClass,

        corridor:
          definition.corridor,

        stations:
          definition.sourceStationIds.map(
            (stationId) => {
              const station =
                stationById.get(
                  stationId
                );

              return {
                stationId,

                name:
                  station?.name ??
                  null,

                location:
                  station?.location ??
                  null,
              };
            }
          ),

        sourceStationOrder:
          definition.sourceStationIds,

        sourceOrderMeaning:
          definition.sourceOrderMeaning,

        verification: {
          serviceMembership:
            "official",

          physicalAdjacency:
            definition
              .physicalAdjacencyVerified,

          completeStoppingPattern:
            definition
              .completeStoppingPatternVerified,

          timetable:
            false,

          travelTimes:
            false,

          routeGeometry:
            false,
        },

        provenance: {
          authority:
            "Gautrain",

          sourceFile:
            "general-information.html",

          sourceType:
            definition
              .sourceRelationship,

          retrievedFromOfficialSite:
            true,
        },
      })
    );

  // ----------------------------------------------------------
  // Build station-to-service membership
  //
  // Important:
  // Shared membership is NOT automatically treated as proof
  // that a passenger must/can transfer there.
  // ----------------------------------------------------------

  const stationMembership =
    new Map();

  for (
    const service of
      services
  ) {
    for (
      const station of
        service.stations
    ) {
      if (
        !stationMembership.has(
          station.stationId
        )
      ) {
        stationMembership.set(
          station.stationId,
          []
        );
      }

      stationMembership
        .get(
          station.stationId
        )
        .push(
          service.id
        );
    }
  }

  const stationServiceMembership =
    [...stationMembership.entries()]
      .map(
        ([
          stationId,
          serviceIds,
        ]) => ({
          stationId,

          stationName:
            stationById.get(
              stationId
            )?.name ??
            null,

          serviceIds:
            unique(
              serviceIds
            ),

          serviceCount:
            unique(
              serviceIds
            ).length,

          sharedServiceStation:
            unique(
              serviceIds
            ).length > 1,

          transferRuleVerified:
            false,
        })
      )
      .sort(
        (a, b) =>
          a.stationName.localeCompare(
            b.stationName
          )
      );

  const sharedServiceStations =
    stationServiceMembership.filter(
      (item) =>
        item.sharedServiceStation
    );

  // ----------------------------------------------------------
  // Service-level station coverage
  // ----------------------------------------------------------

  const referencedStationIds =
    unique(
      services.flatMap(
        (service) =>
          service.stations.map(
            (station) =>
              station.stationId
          )
      )
    );

  const unreferencedStations =
    stations
      .filter(
        (station) =>
          !referencedStationIds.includes(
            station.id
          )
      )
      .map(
        (station) => ({
          id:
            station.id,

          name:
            station.name,
        })
      );

  // ----------------------------------------------------------
  // Output
  // ----------------------------------------------------------

  const output = {
    schemaVersion: 1,

    operatorId:
      "gautrain",

    generatedAt:
      new Date().toISOString(),

    stationCount:
      stations.length,

    serviceCount:
      services.length,

    services,

    stationServiceMembership,

    capabilities: {
      officialStationCoordinates:
        true,

      officialServiceMembership:
        true,

      verifiedPhysicalTrackEdges:
        false,

      verifiedCompleteStoppingPatterns:
        false,

      verifiedTransferRules:
        false,

      routeGeometry:
        false,

      timetable:
        false,

      liveTrainPosition:
        false,
    },

    notes: [
      "The current Gautrain general-information page is used for service/corridor membership.",
      "The order of station names in an official description is preserved but is not automatically treated as physical track adjacency.",
      "Shared service membership does not by itself prove a transfer is required or permitted.",
      "No rail travel time is calculated from straight-line or Mapbox driving distance.",
      "No route geometry, timetable or live train position is inferred."
    ],
  };

  const report = {
    generatedAt:
      new Date().toISOString(),

    operatorId:
      "gautrain",

    inputStationCount:
      stations.length,

    serviceCount:
      services.length,

    stationsReferencedByServices:
      referencedStationIds.length,

    unreferencedStationCount:
      unreferencedStations.length,

    unreferencedStations,

    missingStationReferenceCount:
      missingStationReferences.length,

    missingStationReferences,

    missingSourceNameCount:
      missingSourceNames.length,

    missingSourceNames,

    sharedServiceStationCount:
      sharedServiceStations.length,

    sharedServiceStations:
      sharedServiceStations.map(
        (item) => ({
          stationId:
            item.stationId,

          stationName:
            item.stationName,

          serviceIds:
            item.serviceIds,

          transferRuleVerified:
            false,
        })
      ),

    adjacencyEdgesCreated:
      0,

    routeGeometryCreated:
      false,

    timetableCreated:
      false,

    warnings: [
      "Service membership must not yet be interpreted as a verified stop-to-stop graph.",
      "Exact train stopping patterns and transfer behaviour require schedule or equivalent official verification.",
      "Airport-service membership does not by itself establish whether every listed station is a passenger stop on every train.",
      "No rail duration or ETA is generated in this phase."
    ],
  };

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

  console.log("");
  console.log(
    "Normalization complete."
  );

  console.log(
    `Stations loaded: ${report.inputStationCount}`
  );

  console.log(
    `Services recorded: ${report.serviceCount}`
  );

  console.log(
    `Stations referenced: ${report.stationsReferencedByServices}`
  );

  console.log(
    `Missing station references: ${report.missingStationReferenceCount}`
  );

  console.log(
    `Missing source names: ${report.missingSourceNameCount}`
  );

  console.log(
    `Unreferenced stations: ${report.unreferencedStationCount}`
  );

  console.log(
    `Shared-service stations: ${report.sharedServiceStationCount}`
  );

  if (
    report.sharedServiceStations.length
  ) {
    console.log("");
    console.log(
      "Shared-service stations:"
    );

    for (
      const station of
        report.sharedServiceStations
    ) {
      console.log(
        `  ${station.stationName}: ${station.serviceIds.join(", ")}`
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
    "Important: no physical track edges, transfer rules, timetable or rail ETA were inferred."
  );

  console.log("");
};

main().catch(
  (error) => {
    console.error("");
    console.error(
      "Gautrain rail normalization failed:"
    );

    console.error(
      error
    );

    process.exitCode = 1;
  }
);