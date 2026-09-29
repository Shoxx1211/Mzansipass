import fs from "node:fs/promises";
import path from "node:path";

// ============================================================
// Pulse Transit - PUTCO Soshanguve Normalizer
//
// INPUT
//   zones.json
//   fares.json
//   trip-codes.json
//   transfers.json
//
// OUTPUT
//   normalized-network.json
//   normalization-report.json
//
// Principles:
// - preserve official source relationships
// - do not invent GPS zone polygons
// - preserve ambiguous place names
// - distinguish physical zones from fare groups
// ============================================================

const ROOT = path.resolve(
  "src/data/transit/gauteng/putco/soshanguve"
);

const FILES = {
  zones: path.join(ROOT, "zones.json"),
  fares: path.join(ROOT, "fares.json"),
  tripCodes: path.join(ROOT, "trip-codes.json"),
  transfers: path.join(ROOT, "transfers.json"),

  network: path.join(ROOT, "normalized-network.json"),
  report: path.join(ROOT, "normalization-report.json"),
};

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const readJson = async (filename) => {
  const raw = await fs.readFile(filename, "utf8");

  if (!raw.trim()) {
    throw new Error(
      `${filename} is empty`
    );
  }

  return JSON.parse(raw);
};

const normalizeName = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s/-]/g, "")
    .replace(/\s+/g, " ");

const unique = (values) =>
  [...new Set(values)];

const buildZoneIndex = (zonesData) => {
  const zoneById = new Map();

  for (const zone of zonesData.zones ?? []) {
    zoneById.set(
      zone.id,
      zone
    );
  }

  return zoneById;
};

const buildPlaceIndex = (zonesData) => {
  const index = new Map();

  for (const zone of zonesData.zones ?? []) {
    for (const place of zone.places ?? []) {
      const key =
        normalizeName(place);

      if (!index.has(key)) {
        index.set(key, {
          normalizedName: key,
          displayNames: [],
          zoneIds: [],
          fareGroups: [],
        });
      }

      const record =
        index.get(key);

      record.displayNames.push(
        place
      );

      record.zoneIds.push(
        zone.id
      );

      record.fareGroups.push(
        zone.fareGroup
      );
    }
  }

  return [...index.values()]
    .map((record) => ({
      ...record,
      displayNames:
        unique(record.displayNames),
      zoneIds:
        unique(record.zoneIds),
      fareGroups:
        unique(record.fareGroups),
      ambiguous:
        unique(record.zoneIds).length > 1,
    }))
    .sort((a, b) =>
      a.normalizedName.localeCompare(
        b.normalizedName
      )
    );
};

const resolveFareGroupFromZoneLabel = (
  label,
  zoneById
) => {
  if (!label) {
    return null;
  }

  const parts =
    String(label)
      .split("/")
      .map((value) =>
        value.trim()
      )
      .filter(Boolean);

  const groups =
    unique(
      parts
        .map((zoneId) =>
          zoneById.get(zoneId)
            ?.fareGroup
        )
        .filter(Boolean)
    );

  if (groups.length === 1) {
    return groups[0];
  }

  return null;
};

const validateZoneReferences = (
  values,
  zoneById
) => {
  return values.filter(
    (zoneId) =>
      !zoneById.has(zoneId)
  );
};

// ------------------------------------------------------------
// Normalization
// ------------------------------------------------------------

const buildNormalizedNetwork = ({
  zones,
  fares,
  tripCodes,
  transfers,
}) => {
  const zoneById =
    buildZoneIndex(zones);

  const placeIndex =
    buildPlaceIndex(zones);

  const fareProducts =
    (fares.ticketProducts ?? [])
      .map((product) => ({
        ...product,

        sourceFromLabel:
          product.fromZone ?? null,

        sourceToLabel:
          product.toZone ?? null,

        inferredFromFareGroup:
          resolveFareGroupFromZoneLabel(
            product.fromZone,
            zoneById
          ),

        inferredToFareGroup:
          resolveFareGroupFromZoneLabel(
            product.toZone,
            zoneById
          ),

        provenance:
          "official-2026-putco-fare-table",
      }));

  const fareProductByCode =
    new Map(
      fareProducts.map(
        (product) => [
          product.code,
          product,
        ]
      )
    );

  const normalizedTripCodes =
    (tripCodes.mappings ?? [])
      .map((mapping) => {
        const originGroups =
          unique(
            (mapping.originZones ?? [])
              .map((zoneId) =>
                zoneById.get(zoneId)
                  ?.fareGroup
              )
              .filter(Boolean)
          );

        const destinationParts =
          String(
            mapping.destinationZone ?? ""
          )
            .split("/")
            .map((item) =>
              item.trim()
            )
            .filter(Boolean);

        const destinationGroups =
          unique(
            destinationParts
              .map((zoneId) =>
                zoneById.get(zoneId)
                  ?.fareGroup
              )
              .filter(Boolean)
          );

        const fareProduct =
          fareProductByCode.get(
            mapping.tripCode
          ) ?? null;

        return {
          ...mapping,

          originFareGroups:
            originGroups,

          destinationPhysicalZones:
            destinationParts,

          destinationFareGroups:
            destinationGroups,

          fareProductCode:
            fareProduct?.code ??
            null,

          fareProductFound:
            Boolean(fareProduct),

          relationship:
            "official-putco-trip-code-notice",
        };
      });

  const normalizedTransfers =
    (transfers.transferPoints ?? [])
      .map((point) => ({
        ...point,

        physicalZone:
          point.zoneId
            ? zoneById.get(
                point.zoneId
              ) ?? null
            : null,

        candidatePhysicalZone:
          point.candidateZoneId
            ? zoneById.get(
                point.candidateZoneId
              ) ?? null
            : null,

        relationship:
          "official-putco-transfer-point",
      }));

  return {
    schemaVersion: 1,

    operatorId:
      "putco",

    serviceArea:
      "soshanguve",

    generatedAt:
      new Date().toISOString(),

    capabilities: {
      officialPhysicalZones:
        true,

      officialPlaceZoneReferences:
        true,

      officialGpsZonePolygons:
        false,

      official2026Fares:
        true,

      officialTripCodes:
        true,

      officialTransferPoints:
        true,

      routeGeometry:
        false,

      timetable:
        false,

      realtime:
        false,
    },

    zones: {
      physical:
        zones.zones ?? [],

      fareGroups:
        zones.fareGroups ?? {},

      placeIndex,
    },

    fares: {
      currency:
        fares.currency ??
        "ZAR",

      effectiveFrom:
        fares.effectiveFrom ??
        null,

      products:
        fareProducts,

      cashMatrix:
        fares.zonedCashFares ??
        null,
    },

    tripCodes:
      normalizedTripCodes,

    transfers: {
      policy:
        transfers.cashTransferPolicy ??
        null,

      points:
        normalizedTransfers,
    },
  };
};

// ------------------------------------------------------------
// QA Report
// ------------------------------------------------------------

const buildReport = ({
  zones,
  fares,
  tripCodes,
  transfers,
  network,
}) => {
  const zoneById =
    buildZoneIndex(zones);

  const physicalZones =
    zones.zones ?? [];

  const placeIndex =
    network.zones.placeIndex;

  const ambiguousPlaces =
    placeIndex.filter(
      (place) =>
        place.ambiguous
    );

  const fareCodes =
    new Set(
      (fares.ticketProducts ?? [])
        .map(
          (product) =>
            product.code
        )
    );

  const missingFareProducts =
    (tripCodes.mappings ?? [])
      .filter(
        (mapping) =>
          !fareCodes.has(
            mapping.tripCode
          )
      )
      .map(
        (mapping) =>
          mapping.tripCode
      );

  const badTripOriginZones = [];

  for (
    const mapping of
      tripCodes.mappings ?? []
  ) {
    for (
      const zoneId of
        mapping.originZones ?? []
    ) {
      if (
        !zoneById.has(zoneId)
      ) {
        badTripOriginZones.push({
          tripCode:
            mapping.tripCode,
          zoneId,
        });
      }
    }
  }

  const badTripDestinationZones = [];

  for (
    const mapping of
      tripCodes.mappings ?? []
  ) {
    const parts =
      String(
        mapping.destinationZone ?? ""
      )
        .split("/")
        .map((value) =>
          value.trim()
        )
        .filter(Boolean);

    const missing =
      validateZoneReferences(
        parts,
        zoneById
      );

    for (const zoneId of missing) {
      badTripDestinationZones.push({
        tripCode:
          mapping.tripCode,
        zoneId,
      });
    }
  }

  const badTransferZones = [];

  for (
    const point of
      transfers.transferPoints ?? []
  ) {
    if (
      point.zoneId &&
      !zoneById.has(
        point.zoneId
      )
    ) {
      badTransferZones.push({
        transferPoint:
          point.name,
        zoneId:
          point.zoneId,
      });
    }

    if (
      point.candidateZoneId &&
      !zoneById.has(
        point.candidateZoneId
      )
    ) {
      badTransferZones.push({
        transferPoint:
          point.name,
        candidateZoneId:
          point.candidateZoneId,
      });
    }
  }

  return {
    generatedAt:
      new Date().toISOString(),

    operatorId:
      "putco",

    serviceArea:
      "soshanguve",

    physicalZoneCount:
      physicalZones.length,

    fareGroupCount:
      Object.keys(
        zones.fareGroups ?? {}
      ).length,

    uniquePlaceReferenceCount:
      placeIndex.length,

    ambiguousPlaceCount:
      ambiguousPlaces.length,

    ambiguousPlaces:
      ambiguousPlaces.map(
        (place) => ({
          place:
            place.displayNames[0],

          zoneIds:
            place.zoneIds,

          fareGroups:
            place.fareGroups,
        })
      ),

    fareProductCount:
      (
        fares.ticketProducts ??
        []
      ).length,

    tripCodeMappingCount:
      (
        tripCodes.mappings ??
        []
      ).length,

    transferPointCount:
      (
        transfers.transferPoints ??
        []
      ).length,

    missingFareProducts,

    badTripOriginZones,

    badTripDestinationZones,

    badTransferZones,

    gpsPolygonsAvailable:
      false,

    warnings: [
      "PUTCO Soshanguve zone boundaries come from a schematic map, not official GIS polygons.",
      "Place names can be associated with zones, but arbitrary GPS coordinates must not be assigned to a zone solely from the schematic map.",
      "Ambiguous place names are preserved and must not be silently resolved.",
      "PUTCO fare products, trip-code notices and the zoned cash-fare matrix are separate official source structures and may use different zone labels.",
      "No timetable, route geometry or real-time arrival information is created by this normalizer."
    ],
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
    " Pulse Transit - PUTCO Soshanguve Normalizer"
  );

  console.log(
    "================================================"
  );

  const [
    zones,
    fares,
    tripCodes,
    transfers,
  ] =
    await Promise.all([
      readJson(FILES.zones),
      readJson(FILES.fares),
      readJson(FILES.tripCodes),
      readJson(FILES.transfers),
    ]);

  const network =
    buildNormalizedNetwork({
      zones,
      fares,
      tripCodes,
      transfers,
    });

  const report =
    buildReport({
      zones,
      fares,
      tripCodes,
      transfers,
      network,
    });

  await fs.writeFile(
    FILES.network,
    JSON.stringify(
      network,
      null,
      2
    ),
    "utf8"
  );

  await fs.writeFile(
    FILES.report,
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
    `Physical zones: ${report.physicalZoneCount}`
  );

  console.log(
    `Fare groups: ${report.fareGroupCount}`
  );

  console.log(
    `Place references: ${report.uniquePlaceReferenceCount}`
  );

  console.log(
    `Ambiguous places: ${report.ambiguousPlaceCount}`
  );

  console.log(
    `Fare products: ${report.fareProductCount}`
  );

  console.log(
    `Trip-code mappings: ${report.tripCodeMappingCount}`
  );

  console.log(
    `Transfer points: ${report.transferPointCount}`
  );

  console.log("");
  console.log(
    `Missing fare products: ${report.missingFareProducts.length}`
  );

  console.log(
    `Bad trip origin zones: ${report.badTripOriginZones.length}`
  );

  console.log(
    `Bad trip destination zones: ${report.badTripDestinationZones.length}`
  );

  console.log(
    `Bad transfer zones: ${report.badTransferZones.length}`
  );

  if (
    report.ambiguousPlaces.length
  ) {
    console.log("");
    console.log(
      "Ambiguous place references:"
    );

    for (
      const place of
        report.ambiguousPlaces
    ) {
      console.log(
        `  ${place.place}: ${place.zoneIds.join(", ")}`
      );
    }
  }

  console.log("");
  console.log(
    "Created:"
  );

  console.log(
    `  ${FILES.network}`
  );

  console.log(
    `  ${FILES.report}`
  );

  console.log("");

  console.log(
    "Important: no GPS polygons, route geometry, timetable or live data were inferred."
  );

  console.log("");
};

main().catch((error) => {
  console.error("");
  console.error(
    "PUTCO normalization failed:"
  );

  console.error(
    error
  );

  process.exitCode = 1;
});