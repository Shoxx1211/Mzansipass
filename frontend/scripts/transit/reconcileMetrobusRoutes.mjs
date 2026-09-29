/**
 * Pulse Transit / Johannesburg Metrobus Phase 1D
 * OFFLINE evidence crosswalk, NOT a passenger-routing graph.
 *
 * Reads existing Phase 1A partial indexed inventory and Phase 1C GIS routes.
 * Keeps the code parsed from GIS NAME distinct from the raw ROUTE_ID field.
 * A code match is ONLY a string/code match, never proof of current service,
 * equivalent shape, direction, route-stop membership, or fare.
 * No source geometry or stop-photo filenames are copied to the crosswalk.
 */
import { createHash } from 'node:crypto';
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_REL = 'src/data/transit/gauteng/metrobus';
const INPUT_GIS = 'gis-normalized/routes.json';
const INPUT_INVENTORY = 'partial-inventory/normalized/routes.json';

function assert(condition, description) {
  if (!condition) throw new Error(description);
}
function code(value) {
  return typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : null;
}
function unique(values) {
  return [...new Set(values)];
}
function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}
async function readJson(file) {
  const bytes = await readFile(file);
  return { value: JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')), hash: sha256(bytes) };
}
async function writeJsonAtomic(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  await rename(temp, file);
}

export function buildMetrobusCrosswalk(gisDoc, inventoryDoc, provenance = {}) {
  assert(Array.isArray(gisDoc?.routes), 'Phase 1C GIS document must contain a routes array.');
  assert(Array.isArray(inventoryDoc?.routes), 'Partial inventory must contain a routes array.');
  assert(inventoryDoc?.kind === 'partial-indexed-operator-route-excerpt',
    'Refusing to treat another inventory source as the 33-route indexed excerpt.');
  assert(inventoryDoc?.completeness === 'partial' && inventoryDoc?.usableForPassengerRouting === false,
    'Partial inventory must keep routing disabled.');
  assert(gisDoc?.metadata?.passengerRoutingEnabled === false,
    'GIS normalization must keep routing disabled.');

  const inventoryByCode = new Map();
  for (const item of inventoryDoc.routes) {
    const routeCode = code(item.routeNumber);
    assert(routeCode && /^\d{1,4}[A-Z]{0,2}$/.test(routeCode),
      `Invalid indexed route number: ${JSON.stringify(item.routeNumber)}`);
    assert(!inventoryByCode.has(routeCode), `Duplicate partial-inventory route: ${routeCode}`);
    inventoryByCode.set(routeCode, item);
  }

  const seenGisObjectIds = new Set();
  const gisCodes = new Set();
  const overlapCodes = new Set();
  const routeIdDisagreements = [];
  const gisRoutes = gisDoc.routes.map((item) => {
    const objectId = item.gisObjectId;
    assert(Number.isSafeInteger(objectId) && objectId > 0,
      `Invalid GIS object ID ${JSON.stringify(objectId)}`);
    assert(!seenGisObjectIds.has(objectId), `Duplicate GIS OBJECTID ${objectId}`);
    seenGisObjectIds.add(objectId);

    const routeCode = code(item.routeCodeFromName);
    assert(routeCode === null || /^\d{1,4}[A-Z]{0,2}$/.test(routeCode),
      `Unexpected GIS NAME route code for OBJECTID ${objectId}: ${routeCode}`);
    if (routeCode) gisCodes.add(routeCode);
    const indexed = routeCode ? inventoryByCode.get(routeCode) : null;
    if (indexed) overlapCodes.add(routeCode);
    if (item.routeIdDisagreesWithName === true) {
      routeIdDisagreements.push({
        gisObjectId: objectId,
        routeCodeFromName: routeCode,
        rawRouteIdField: item.rawRouteIdField ?? null,
      });
    }
    // IMPORTANT: deliberately omit the actual geometry, raw stop data and photos.
    return {
      gisObjectId: objectId,
      gisName: item.gisName ?? null,
      routeCodeFromName: routeCode,
      rawRouteIdField: item.rawRouteIdField ?? null,
      routeIdDisagreesWithName: item.routeIdDisagreesWithName === true,
      gisDescription: item.gisDescription ?? null,
      gisOriginLabel: item.originLabel ?? null,
      gisDestinationLabel: item.destinationLabel ?? null,
      gisPolylineLengthKm: item.gisPolylineLengthKm ?? null,
      geometryFeatureRef: {
        file: INPUT_GIS,
        gisObjectId: objectId,
      },
      geometryEvidence: item.geometryEvidence ?? 'city-gis-polyline; operation and direction unverified',
      geometryPresent: item.segmentCount > 0,
      indexedInventory: indexed ? {
        codeExactMatchOnly: true,
        sourceKind: indexed.sourceKind,
        routeNumber: indexed.routeNumber,
        routeLabel: indexed.publishedRouteLabel,
        fromLabel: indexed.fromLabel ?? null,
        toLabel: indexed.toLabel ?? null,
        viaLabel: indexed.viaLabel ?? null,
        publishedDistanceKm: indexed.publishedDistanceKm ?? null,
        sourcePageDownloaded: indexed.sourcePageDownloaded === true,
      } : null,
      crosswalkStatus: indexed ? 'exact-code-overlap-only' : 'GIS-only-relative-to-partial-excerpt',
      currentServiceVerified: false,
      geometryEquivalenceToIndexedListingVerified: false,
      travelDirectionVerified: false,
      routeStopMembershipVerified: false,
      passengerRoutingEnabled: false,
    };
  }).sort((a, b) => a.gisObjectId - b.gisObjectId);

  const inventoryOnly = [...inventoryByCode]
    .filter(([routeCode]) => !gisCodes.has(routeCode))
    .map(([routeCode, item]) => ({
      routeNumber: routeCode,
      publishedRouteLabel: item.publishedRouteLabel,
      fromLabel: item.fromLabel ?? null,
      toLabel: item.toLabel ?? null,
      viaLabel: item.viaLabel ?? null,
      publishedDistanceKm: item.publishedDistanceKm ?? null,
      sourceKind: item.sourceKind,
      geometryPresent: false,
      crosswalkStatus: 'indexed-only-relative-to-GIS-snapshot',
      currentServiceVerified: false,
      passengerRoutingEnabled: false,
    })).sort((a, b) => a.routeNumber.localeCompare(b.routeNumber, undefined, { numeric: true }));

  const gisOnlyCodes = [...gisCodes].filter(routeCode => !inventoryByCode.has(routeCode));
  const summary = {
    gisFeatureCount: gisRoutes.length,
    uniqueGisNameRouteCodes: gisCodes.size,
    partialIndexedInventoryRoutes: inventoryByCode.size,
    exactCodeOverlaps: overlapCodes.size,
    gisOnlyCodesRelativeToPartialExcerpt: gisOnlyCodes.length,
    indexedOnlyCodesRelativeToGIS: inventoryOnly.length,
    gisNameVersusRawRouteIdDisagreements: routeIdDisagreements.length,
    gisFeaturesMissingParsedCode: gisRoutes.filter(row => !row.routeCodeFromName).length,
    gisFeaturesMissingGeometry: gisRoutes.filter(row => !row.geometryPresent).length,
  };
  assert(summary.exactCodeOverlaps + summary.indexedOnlyCodesRelativeToGIS === inventoryByCode.size,
    'Inventory code reconciliation totals do not balance.');
  assert(summary.exactCodeOverlaps + summary.gisOnlyCodesRelativeToPartialExcerpt === gisCodes.size,
    'GIS code reconciliation totals do not balance.');

  const crosswalk = {
    metadata: {
      kind: 'Metrobus Phase 1D identifier-and-source crosswalk',
      generatedAt: provenance.generatedAt ?? new Date().toISOString(),
      inputSourceHashes: provenance.inputSourceHashes ?? null,
      gisGeometryFile: INPUT_GIS,
      indexedInventoryFile: INPUT_INVENTORY,
      matchingRule: 'Exact normalized route-code string only: GIS NAME parsed code = partial-indexed routeNumber.',
      note: 'Raw GIS ROUTE_ID meaning has not been independently established; it must not replace a passenger route number.',
      sourceRights: 'City GIS copyright says CoJ to decide; data reuse review required before public redistribution.',
      currentServiceVerified: false,
      directionVerified: false,
      routeStopMembershipVerified: false,
      timetablesVerified: false,
      faresVerified: false,
      passengerRoutingEnabled: false,
      transferInstructionsEnabled: false,
    },
    summary,
    gisRoutes,
    inventoryOnlyRoutes: inventoryOnly,
  };
  const qa = {
    generatedAt: crosswalk.metadata.generatedAt,
    summary,
    routeIdDisagreements,
    gisOnlyCodesRelativeToPartialExcerpt: gisOnlyCodes.sort(),
    indexedOnlyCodesRelativeToGIS: inventoryOnly.map(row => row.routeNumber),
    sourceAndSafetyChecks: {
      indexedInventoryIsPartial: true,
      geomIsReferencedNotDuplicated: true,
      codeMatchDoesNotValidateGeometryEquivalence: true,
      directionValidated: false,
      routeStopMembershipValidated: false,
      currentOperationValidated: false,
      publicationRightsValidated: false,
      passengerRoutingEnabled: false,
    },
    errors: [],
  };
  return { crosswalk, qa };
}

export async function runMetrobusCrosswalk(dataRoot = path.join(process.cwd(), DATA_REL)) {
  const [gis, indexed] = await Promise.all([
    readJson(path.join(dataRoot, INPUT_GIS)),
    readJson(path.join(dataRoot, INPUT_INVENTORY)),
  ]);
  const { crosswalk, qa } = buildMetrobusCrosswalk(gis.value, indexed.value, {
    generatedAt: new Date().toISOString(),
    inputSourceHashes: {
      normalizedGisRoutesSha256: gis.hash,
      partialIndexedInventorySha256: indexed.hash,
    },
  });
  const gisQaPath = path.join(dataRoot, 'gis-normalized/reports/qa.json');
  const partialQaPath = path.join(dataRoot, 'partial-inventory/reports/qa.json');
  const [gisQa, partialQa] = await Promise.all([readJson(gisQaPath), readJson(partialQaPath)]);
  assert(gisQa.value?.errors?.length === 0, 'Phase 1C has QA errors; refusing crosswalk.');
  assert(gisQa.value?.routes?.gisFeatures === crosswalk.summary.gisFeatureCount,
    'GIS count disagrees with Phase 1C QA; rerun normalization.');
  assert(partialQa.value?.routeRowsParsed === crosswalk.summary.partialIndexedInventoryRoutes,
    'Partial inventory count disagrees with bootstrap QA.');
  const recordedOverlap = gisQa.value?.partialInventoryReconciliation?.labelCodeOverlap;
  if (Array.isArray(recordedOverlap)) {
    assert(unique(recordedOverlap).length === crosswalk.summary.exactCodeOverlaps,
      'Overlap count disagrees with Phase 1C QA; rerun normalization.');
  }
  const output = path.join(dataRoot, 'route-crosswalk');
  await writeJsonAtomic(path.join(output, 'metrobus-route-crosswalk.json'), crosswalk);
  await writeJsonAtomic(path.join(output, 'reports/qa.json'), qa);
  console.log('\nMetrobus Phase 1D route-code crosswalk complete.');
  for (const [label, value] of Object.entries(crosswalk.summary)) console.log(`${label}: ${value}`);
  console.log(`Output: ${output}`);
  console.log('Passenger routing: DISABLED | Current operation: UNVERIFIED | Licence: REVIEW REQUIRED');
  return { crosswalk, qa, output };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runMetrobusCrosswalk().catch(error => {
    console.error(`Metrobus crosswalk failed: ${error.message}`);
    process.exitCode = 1;
  });
}
