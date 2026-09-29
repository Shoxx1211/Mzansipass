/**
 * Pulse / Metrobus Phase 1F — OFFLINE developer-only infrastructure explorer.
 * Consumes Phase 1C & 1D local outputs. DOES NOT alter src/app, planner or public assets.
 * Does not validate active operation, boarding, route direction, transfers, fares or rights.
 * Run inside frontend: node scripts/transit/buildMetrobusDevInfrastructure.mjs
 */
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_REL = 'src/data/transit/gauteng/metrobus';
const INPUTS = Object.freeze({
  routes: 'gis-normalized/routes.json',
  stops: 'gis-normalized/stops.json',
  candidates: 'gis-normalized/spatial-stop-route-candidates.json',
  gisQa: 'gis-normalized/reports/qa.json',
  crosswalk: 'route-crosswalk/metrobus-route-crosswalk.json',
  crosswalkQa: 'route-crosswalk/reports/qa.json',
});
const ensure = (condition, description) => { if (!condition) throw new Error(description); };
const id = (n) => Number.isSafeInteger(n) && n > 0;
const safeLngLat = (lng, lat) => Number.isFinite(lng) && Number.isFinite(lat) && lng >= 25 && lng <= 31 && lat >= -28.5 && lat <= -23.5;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
async function readJson(file) {
  const bytes = await readFile(file);
  return { data: JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')), sha256: sha256(bytes) };
}
async function writeAtomic(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, content, 'utf8');
  await rename(temp, file);
}

export function buildMetrobusDevInfrastructure(input, generatedAt = new Date().toISOString()) {
  const { routes: routeDoc, stops: stopDoc, candidates: candidateDoc, gisQa, crosswalk, crosswalkQa } = input;
  ensure(routeDoc?.metadata?.passengerRoutingEnabled === false, 'GIS routes must have passenger routing disabled.');
  ensure(stopDoc?.metadata?.routeMembership === 'unknown' && stopDoc?.metadata?.passengerBoardingValidated === false,
    'GIS stops must be unverified for route membership and boarding.');
  ensure(candidateDoc?.evidence === 'spatial-support-only', 'Spatial input MUST be support-only.');
  ensure(candidateDoc?.notSuitableFor?.includes('transfer edges'), 'Spatial candidates must explicitly prohibit transfer edges.');
  ensure(Number.isFinite(candidateDoc.thresholdMetres) && candidateDoc.thresholdMetres > 0 && candidateDoc.thresholdMetres <= 100,
    'Proximity screening threshold unexpectedly high or missing.');
  ensure(gisQa?.errors?.length === 0 && gisQa?.policy?.passengerRoutingEnabled === false,
    'Phase 1C QA must be error free with passenger routing disabled.');
  ensure(crosswalk?.metadata?.passengerRoutingEnabled === false && crosswalk.metadata?.directionVerified === false &&
    crosswalk.metadata?.routeStopMembershipVerified === false && crosswalk.metadata?.currentServiceVerified === false,
    'Phase 1D crosswalk claims unsupported service/direction/stop verification.');
  ensure(crosswalkQa?.errors?.length === 0, 'Phase 1D QA has errors.');
  ensure(Array.isArray(routeDoc.routes) && Array.isArray(stopDoc.stops) &&
    Array.isArray(candidateDoc.candidates) && Array.isArray(crosswalk.gisRoutes),
    'Required normalized arrays are missing.');

  const routesById = new Map();
  const crosswalkById = new Map();
  for (const c of crosswalk.gisRoutes) {
    ensure(id(c.gisObjectId) && !crosswalkById.has(c.gisObjectId), 'Invalid/duplicate crosswalk GIS OBJECTID.');
    ensure(c.passengerRoutingEnabled === false && c.routeStopMembershipVerified === false &&
      c.currentServiceVerified === false && c.travelDirectionVerified === false,
      `Crosswalk row ${c.gisObjectId} claims unsupported verification.`);
    crosswalkById.set(c.gisObjectId, c);
  }
  const routes = routeDoc.routes.map(r => {
    ensure(id(r.gisObjectId) && !routesById.has(r.gisObjectId), 'Invalid/duplicate route OBJECTID.');
    const c = crosswalkById.get(r.gisObjectId);
    ensure(c && c.routeCodeFromName === r.routeCodeFromName && c.rawRouteIdField === r.rawRouteIdField,
      `Crosswalk fields disagree for route OBJECTID ${r.gisObjectId}.`);
    ensure(r.passengerRoutingEnabled === false && r.segmentCount > 0 &&
      r.geometry?.type === 'MultiLineString' && Array.isArray(r.geometry.coordinates),
      `Unsafe or missing geometry for OBJECTID ${r.gisObjectId}.`);
    let segments = 0;
    for (const line of r.geometry.coordinates) {
      ensure(Array.isArray(line) && line.length >= 2, `Route ${r.gisObjectId} has an invalid line.`);
      for (const xy of line) {
        ensure(Array.isArray(xy) && xy.length >= 2 && safeLngLat(xy[0], xy[1]),
          `Route ${r.gisObjectId} has invalid Gauteng WGS84 coordinates.`);
      }
      segments += line.length - 1;
    }
    ensure(segments === r.segmentCount, `Segment count mismatch on route ${r.gisObjectId}.`);
    const result = {
      gisObjectId: r.gisObjectId,
      routeCodeFromName: r.routeCodeFromName,
      rawRouteIdField: r.rawRouteIdField,
      rawIdDisagreesWithName: r.routeIdDisagreesWithName === true,
      gisDescription: r.gisDescription ?? null,
      originLabel: r.originLabel ?? null,
      destinationLabel: r.destinationLabel ?? null,
      gisPolylineLengthKm: r.gisPolylineLengthKm ?? null,
      inventoryCodeOverlapOnly: Boolean(c.indexedInventory),
      publishedInventoryLabel: c.indexedInventory?.routeLabel ?? null,
      geometry: r.geometry.coordinates,
      extentWgs84: r.extentWgs84 ?? null,
      candidateStopCount: 0,
      passengerRoutingEnabled: false,
      verifiedServiceDirection: false,
      verifiedCurrentOperation: false,
      verifiedStopMembership: false,
    };
    routesById.set(r.gisObjectId, result);
    return result;
  });
  ensure(routes.length === crosswalk.gisRoutes.length && routes.length === gisQa.routes?.gisFeatures,
    'GIS route count does not match crosswalk / Phase 1C QA.');
  ensure(routes.length === crosswalk.summary?.gisFeatureCount &&
    crosswalk.summary?.exactCodeOverlaps === routes.filter(r => r.inventoryCodeOverlapOnly).length,
    'GIS route crosswalk reconciliation disagrees.');

  const stopsById = new Map();
  const stops = stopDoc.stops.map(s => {
    ensure(id(s.gisObjectId) && !stopsById.has(s.gisObjectId), 'Invalid/duplicate stop OBJECTID.');
    ensure(s.passengerBoardingValidated === false && s.coordinate &&
      safeLngLat(s.coordinate.lng, s.coordinate.lat), `Unsafe or missing stop coordinates at ${s.gisObjectId}.`);
    const result = {
      gisObjectId: s.gisObjectId,
      lat: s.coordinate.lat,
      lng: s.coordinate.lng,
      locationDescription: s.locationDescription ?? null,
      candidateRouteCount: 0,
      verifiedBoarding: false,
      verifiedRouteMembership: false,
    };
    stopsById.set(s.gisObjectId, result);
    return result;
  });
  ensure(stops.length === gisQa.stops?.validCoordinates, 'Valid GIS stop count does not match QA.');
  const seenPairs = new Set();
  const candidates = candidateDoc.candidates.map(p => {
    ensure(id(p.routeGisObjectId) && id(p.stopGisObjectId) &&
      routesById.has(p.routeGisObjectId) && stopsById.has(p.stopGisObjectId),
      'Spatial candidate refers to unknown GIS route or stop.');
    ensure(p.evidence === 'spatial-support-only' && p.isPublishedStopMembership === false &&
      p.isPassengerTransfer === false && Number.isFinite(p.proximityMetresApprox) &&
      p.proximityMetresApprox >= 0 &&
      p.proximityMetresApprox <= candidateDoc.thresholdMetres + 0.15,
      `Invalid spatial-only candidate for stop ${p.stopGisObjectId}.`);
    const key = `${p.routeGisObjectId}:${p.stopGisObjectId}`;
    ensure(!seenPairs.has(key), `Duplicate spatial-support pair: ${key}`);
    seenPairs.add(key);
    routesById.get(p.routeGisObjectId).candidateStopCount++;
    stopsById.get(p.stopGisObjectId).candidateRouteCount++;
    return {
      routeGisObjectId: p.routeGisObjectId,
      stopGisObjectId: p.stopGisObjectId,
      proximityMetresApprox: p.proximityMetresApprox,
      evidence: 'spatial-support-only',
      confirmedBoarding: false,
      confirmedTransfer: false,
    };
  });
  ensure(candidates.length === gisQa.spatialSupport?.candidatePairs, 'Spatial pair count does not match QA.');
  ensure(stops.length === gisQa.stops?.gisFeatures, 'GIS feature stop count mismatch.');
  ensure([...stopsById.values()].filter(s => s.candidateRouteCount > 0).length ===
    gisQa.spatialSupport?.stopsNearAtLeastOneGISRouteFeature, 'Unique spatially near stop count mismatch.');
  ensure([...stopsById.values()].filter(s => s.candidateRouteCount > 1).length ===
    gisQa.spatialSupport?.stopsNearMultipleGISRouteFeatures, 'Multi-candidate stop count mismatch.');

  const summary = {
    gisRouteGeometries: routes.length,
    gisStopPoints: stops.length,
    inventoryCodeMatches: routes.filter(r => r.inventoryCodeOverlapOnly).length,
    nameVersusRawIdDisagreements: routes.filter(r => r.rawIdDisagreesWithName).length,
    candidateSpatialPairs: candidates.length,
    stopsNearAnyShape: stops.filter(s => s.candidateRouteCount > 0).length,
    stopsNearMultipleShapes: stops.filter(s => s.candidateRouteCount > 1).length,
    screeningThresholdMetres: candidateDoc.thresholdMetres,
    verifiedBoardingEdges: 0,
    verifiedTransferEdges: 0,
    selectablePassengerJourneys: 0,
  };
  ensure(summary.nameVersusRawIdDisagreements === crosswalk.summary?.gisNameVersusRawRouteIdDisagreements,
    'Raw ID disagreement count mismatch.');
  const output = {
    metadata: {
      kind: 'Pulse Metrobus developer-only geometry + proximity inspector',
      generatedAt,
      dataAuthorityClaim: 'City of Johannesburg GIS, layers 22 and 52 (local source snapshots)',
      sourceRights: 'CoJ to decide in GIS metadata; NOT cleared for public app distribution',
      licensingReviewRequired: true,
      currentOperationVerified: false,
      routeDirectionVerified: false,
      publishedOrderedStopsVerified: false,
      boardingVerified: false,
      transfersVerified: false,
      faresVerified: false,
      timetablesVerified: false,
      passengerRoutingEnabled: false,
      routeGraphType: 'dev-spatial-support-index-only',
      sourceStopPhotoFilenamesExcluded: true,
    },
    summary, routes, stops, candidates,
  };
  const qa = {
    generatedAt, summary,
    checksPassed: [
      'Verified Phase 1C and 1D error-free QA and disabled passenger routing',
      'GIS NAME code and raw ROUTE_ID preserved separately',
      'All route geometry WGS84 coordinates screened within Gauteng bounds',
      'Each spatial candidate references known route and stop GIS OBJECTID',
      'All candidate pairs explicitly disallow published boarding and transfers',
      'Stop photo paths and source EXIF metadata excluded from developer viewer',
      'Zero passenger or transfer edges created',
    ],
    errors: [],
  };
  return { output, qa };
}

export async function runMetrobusDevInfrastructure({
  dataRoot = path.resolve(DATA_REL),
  outputRoot = path.resolve('.local-dev/metrobus'),
  templatePath = fileURLToPath(new URL('./metrobusDevViewer.template.html', import.meta.url)),
} = {}) {
  const names = Object.keys(INPUTS);
  const reads = await Promise.all(names.map(key => readJson(path.join(dataRoot, INPUTS[key]))));
  const input = Object.fromEntries(names.map((key, i) => [key, reads[i].data]));
  const { output, qa } = buildMetrobusDevInfrastructure(input);
  qa.inputSha256 = Object.fromEntries(names.map((key, i) => [INPUTS[key], reads[i].sha256]));
  const tpl = await readFile(templatePath, 'utf8');
  ensure(tpl.includes('__PULSE_METROBUS_DEV_DATA__'), 'Local viewer template is missing data marker.');
  // Only locally saved HTML. Escape HTML/script-breaking characters in embedded JSON.
  const embedded = JSON.stringify(output).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const html = tpl.replace('__PULSE_METROBUS_DEV_DATA__', embedded);
  // A nested .gitignore keeps generated raw geometry + HTML out of accidental commits.
  await writeAtomic(path.join(path.dirname(outputRoot), '.gitignore'), '*\n!.gitignore\n');
  await writeAtomic(path.join(outputRoot, 'metrobus-dev-index.json'), JSON.stringify(output, null, 2) + '\n');
  await writeAtomic(path.join(outputRoot, 'reports/qa.json'), JSON.stringify(qa, null, 2) + '\n');
  await writeAtomic(path.join(outputRoot, 'metrobus-dev-viewer.html'), html);
  console.log('\nMetrobus Phase 1F: local developer infrastructure generated.');
  for (const [k, v] of Object.entries(output.summary)) console.log(`${k}: ${v}`);
  console.log(`Developer-only viewer: ${path.join(outputRoot, 'metrobus-dev-viewer.html')}`);
  console.log('NOT in public app / passenger planner. NO verified boarding, directions, transfers, fares or operating status.');
  console.log('GIS redistribution rights not yet cleared. Keep generated viewer private.');
  return { output, qa, outputRoot };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runMetrobusDevInfrastructure().catch(e => { console.error(`Metrobus Phase 1F failed: ${e.message}`); process.exitCode = 1; });
}
