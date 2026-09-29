/**
 * Pulse Transit / Johannesburg Metrobus Phase 1E.
 * An OFFLINE, non-routing evidence review package for the Phase 1D crosswalk.
 * No network, route geometry, stop photos, stop membership, fares, ETAs, or app imports.
 * Run from frontend: node scripts/transit/auditMetrobusEvidence.mjs
 */
import { createHash } from 'node:crypto';
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_REL = 'src/data/transit/gauteng/metrobus';
const INPUT = 'route-crosswalk/metrobus-route-crosswalk.json';
const INPUT_QA = 'route-crosswalk/reports/qa.json';
const OUTPUT = 'source-review';
const EXPECTED_FIELDS = [
  'gisFeatureCount', 'uniqueGisNameRouteCodes', 'partialIndexedInventoryRoutes',
  'exactCodeOverlaps', 'gisOnlyCodesRelativeToPartialExcerpt',
  'indexedOnlyCodesRelativeToGIS', 'gisNameVersusRawRouteIdDisagreements',
  'gisFeaturesMissingParsedCode', 'gisFeaturesMissingGeometry',
];
function ensure(condition, message) { if (!condition) throw new Error(message); }
function safeText(value) { return value === undefined || value === null ? '' : String(value); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function csvEscape(v) {
  let s = safeText(v);
  // Neutralise spreadsheet formula injection even if a future upstream source is user-edited.
  if (/^[\t\r\n ]*[=+@-]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s.trim())) s = `'${s}`;
  return /[,"\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
function csv(headers, rows) {
  return [headers.join(','), ...rows.map(r => headers.map(h => csvEscape(r[h])).join(','))].join('\r\n') + '\r\n';
}
function uniqueCount(items) { return new Set(items).size; }
function category(row) {
  return row.indexedInventory ? 'exact-code-overlap-only' : 'GIS-only-relative-to-partial-excerpt';
}
function projectRoute(row) {
  return {
    gisObjectId: row.gisObjectId,
    gisName: row.gisName,
    passengerRouteCodeFromGisName: row.routeCodeFromName,
    rawGisRouteIdUninterpreted: row.rawRouteIdField,
    nameVersusRawIdDisagreement: row.routeIdDisagreesWithName,
    inventoryCodeMatch: Boolean(row.indexedInventory),
    gisDescription: row.gisDescription,
    gisOrigin: row.gisOriginLabel,
    gisDestination: row.gisDestinationLabel,
    indexedRouteLabel: row.indexedInventory?.routeLabel ?? null,
    indexedFrom: row.indexedInventory?.fromLabel ?? null,
    indexedTo: row.indexedInventory?.toLabel ?? null,
    indexedVia: row.indexedInventory?.viaLabel ?? null,
    gisPolylineLengthKmNotPassengerDistance: row.gisPolylineLengthKm,
    indexedPublishedDistanceKmNotLegDistance: row.indexedInventory?.publishedDistanceKm ?? null,
    operatorPageDownloaded: row.indexedInventory?.sourcePageDownloaded === true,
    evidenceClass: category(row),
    currentServiceVerified: false,
    geometryEquivalentToIndexedListingVerified: false,
    directionVerified: false,
    orderedStopMembershipVerified: false,
    transferVerified: false,
    routingEnabled: false,
  };
}
const ROUTE_HEADERS = [
  'gisObjectId', 'gisName', 'passengerRouteCodeFromGisName',
  'rawGisRouteIdUninterpreted', 'nameVersusRawIdDisagreement',
  'gisDescription', 'gisOrigin', 'gisDestination',
  'indexedRouteLabel', 'indexedFrom', 'indexedTo', 'indexedVia',
  'gisPolylineLengthKmNotPassengerDistance', 'indexedPublishedDistanceKmNotLegDistance',
  'evidenceClass', 'currentServiceVerified', 'directionVerified',
  'orderedStopMembershipVerified', 'routingEnabled',
];
const INDEXED_HEADERS = [
  'routeNumber', 'publishedRouteLabel', 'fromLabel', 'toLabel', 'viaLabel',
  'publishedDistanceKm', 'geometryPresent', 'currentServiceVerified', 'passengerRoutingEnabled',
];
export function buildMetrobusEvidenceAudit(crosswalk, phase1dQa, generatedAt = new Date().toISOString()) {
  ensure(crosswalk?.metadata?.passengerRoutingEnabled === false, 'Crosswalk must have passenger routing disabled.');
  ensure(crosswalk?.metadata?.directionVerified === false &&
    crosswalk?.metadata?.routeStopMembershipVerified === false &&
    crosswalk?.metadata?.currentServiceVerified === false,
  'Crosswalk must not claim service, direction or stop membership has been verified.');
  ensure(Array.isArray(crosswalk?.gisRoutes) && Array.isArray(crosswalk?.inventoryOnlyRoutes),
    'Phase 1D crosswalk is missing gisRoutes or inventoryOnlyRoutes arrays.');
  ensure(phase1dQa?.errors?.length === 0, 'Phase 1D QA has errors.');
  for (const k of EXPECTED_FIELDS) {
    ensure(Number.isSafeInteger(crosswalk.summary?.[k]) && crosswalk.summary[k] >= 0,
      `Invalid crosswalk summary field: ${k}`);
    ensure(crosswalk.summary[k] === phase1dQa.summary?.[k], `Phase 1D QA summary mismatch: ${k}`);
  }
  const gis = crosswalk.gisRoutes;
  const indexedOnly = crosswalk.inventoryOnlyRoutes;
  ensure(gis.length === crosswalk.summary.gisFeatureCount, 'GIS count mismatch.');
  ensure(indexedOnly.length === crosswalk.summary.indexedOnlyCodesRelativeToGIS, 'Indexed-only count mismatch.');
  ensure(uniqueCount(gis.map(r => r.gisObjectId)) === gis.length, 'Duplicate GIS OBJECTID.');
  ensure(uniqueCount(gis.map(r => r.routeCodeFromName).filter(Boolean)) ===
    crosswalk.summary.uniqueGisNameRouteCodes, 'Unique GIS code count mismatch.');
  ensure(gis.every(r => r.passengerRoutingEnabled === false &&
    r.currentServiceVerified === false && r.travelDirectionVerified === false &&
    r.routeStopMembershipVerified === false), 'A GIS row claims unsupported routing/service/direction/stops.');
  ensure(indexedOnly.every(r => r.passengerRoutingEnabled === false &&
    r.currentServiceVerified === false && r.geometryPresent === false),
  'An indexed-only row claims unsupported geometry/service/routing.');
  const exact = gis.filter(r => Boolean(r.indexedInventory)).map(projectRoute);
  const gisOnly = gis.filter(r => !r.indexedInventory).map(projectRoute);
  const disagreements = gis.filter(r => r.routeIdDisagreesWithName === true).map(projectRoute);
  const indexedProjection = indexedOnly.map(r => ({
    routeNumber: r.routeNumber,
    publishedRouteLabel: r.publishedRouteLabel,
    fromLabel: r.fromLabel,
    toLabel: r.toLabel,
    viaLabel: r.viaLabel,
    publishedDistanceKm: r.publishedDistanceKm,
    geometryPresent: false,
    currentServiceVerified: false,
    passengerRoutingEnabled: false,
  }));
  ensure(exact.length === crosswalk.summary.exactCodeOverlaps, 'Exact-overlap count mismatch.');
  ensure(gisOnly.length === crosswalk.summary.gisOnlyCodesRelativeToPartialExcerpt, 'GIS-only count mismatch.');
  ensure(disagreements.length === crosswalk.summary.gisNameVersusRawRouteIdDisagreements,
    'Identifier disagreement count mismatch.');
  ensure(exact.length + gisOnly.length === gis.length, 'GIS reconciliation does not partition.');
  ensure(exact.length + indexedProjection.length === crosswalk.summary.partialIndexedInventoryRoutes,
    'Partial inventory reconciliation does not partition.');
  const qa = {
    generatedAt,
    source: 'Existing local Metrobus Phase 1D crosswalk and QA only; no new operator verification',
    counts: {
      gisFeatures: gis.length,
      inventoryRoutes: crosswalk.summary.partialIndexedInventoryRoutes,
      exactCodeOverlapsForManualValidation: exact.length,
      gisOnlyRelativeToIncompleteExcerpt: gisOnly.length,
      indexedOnlyRelativeToGIS: indexedProjection.length,
      rawGisIdDisagreementsForInterpretation: disagreements.length,
    },
    restrictions: {
      sourceRights: 'CoJ GIS metadata: CoJ to decide. Obtain reuse rights before public distribution.',
      publishedStopMembership: false,
      verifiedRouteDirection: false,
      verifiedCurrentOperation: false,
      verifiedRouteGeometryEquivalence: false,
      verifiedFaresAndSchedules: false,
      passengerRoutingEnabled: false,
      geographicProximityDoesNotProveStopMembership: true,
    },
    checksPassed: [
      'Source Phase 1D QA matches crosswalk counts',
      'GIS object IDs are unique',
      'GIS and partial inventory category totals reconcile',
      'No source record claims verified services, direction, stops or passenger routing',
      'Only minimal review metadata is exported; no geometry, stop photos or private filenames',
    ],
    errors: [],
  };
  const outputs = {
    'exact-code-overlaps.csv': csv(ROUTE_HEADERS, exact),
    'gis-only-relative-to-partial-excerpt.csv': csv(ROUTE_HEADERS, gisOnly),
    'indexed-only-relative-to-gis.csv': csv(INDEXED_HEADERS, indexedProjection),
    'gis-name-vs-route-id-review.csv': csv(ROUTE_HEADERS, disagreements),
  };
  return { qa, outputs };
}
async function atomic(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, content, 'utf8');
  await rename(temp, file);
}
export async function runMetrobusEvidenceAudit(root = path.join(process.cwd(), DATA_REL)) {
  const crosswalkBytes = await readFile(path.join(root, INPUT));
  const qaBytes = await readFile(path.join(root, INPUT_QA));
  const read = b => JSON.parse(b.toString('utf8').replace(/^\uFEFF/, ''));
  const { qa, outputs } = buildMetrobusEvidenceAudit(read(crosswalkBytes), read(qaBytes));
  qa.inputSha256 = { crosswalk: sha256(crosswalkBytes), crosswalkQa: sha256(qaBytes) };
  const dir = path.join(root, OUTPUT);
  await Promise.all([
    ...Object.entries(outputs).map(([filename, content]) => atomic(path.join(dir, filename), content)),
    atomic(path.join(dir, 'reports/qa.json'), JSON.stringify(qa, null, 2) + '\n'),
  ]);
  console.log('\nMetrobus Phase 1E: evidence review worklists ready.');
  for (const [label, value] of Object.entries(qa.counts)) console.log(`${label}: ${value}`);
  console.log(`Output: ${dir}`);
  console.log('All matches are code-level only. Stop membership, direction, operation, fares, reuse rights and passenger routing remain UNVERIFIED / DISABLED.');
  return qa;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runMetrobusEvidenceAudit().catch(error => {
    console.error(`Metrobus Phase 1E failed: ${error.message}`);
    process.exitCode = 1;
  });
}
