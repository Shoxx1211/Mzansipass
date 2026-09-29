/**
 * Pulse Transit - Metrobus GIS Phase 1C
 * Offline normalization + spatial SUPPORT ONLY. No network requests, no planner writes.
 * Source: locally downloaded CoJ Transportation/MapServer layers 22 and 52.
 * Run from the frontend directory: node scripts/transit/normalizeMetrobusGIS.mjs
 */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REL = 'src/data/transit/gauteng/metrobus';
const LAYER_ROUTE = 22;
const LAYER_STOP = 52;
const NEAR_METRES = 75; // Engineering screening threshold; NOT an operator walking rule.
const COS_GAUTENG = Math.cos((-26 * Math.PI) / 180);
const METRES_PER_DEG_LON = 111_320 * COS_GAUTENG;
const METRES_PER_DEG_LAT = 110_574;

function fail(message) { throw new Error(message); }
function finite(n) { return typeof n === 'number' && Number.isFinite(n); }
function round(n, dp = 2) { return Number(n.toFixed(dp)); }
function isWgs84(lng, lat) {
  return finite(lng) && finite(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}
function isGautengVicinity(lng, lat) {
  return lng >= 25.0 && lng <= 31.0 && lat >= -28.5 && lat <= -23.5;
}
function projected(lng, lat) { return [lng * METRES_PER_DEG_LON, lat * METRES_PER_DEG_LAT]; }
function haversineKm(a, b) {
  const rad = Math.PI / 180;
  const dlat = (b[1] - a[1]) * rad;
  const dlng = (b[0] - a[0]) * rad;
  const t = Math.sin(dlat / 2) ** 2 + Math.cos(a[1] * rad) *
    Math.cos(b[1] * rad) * Math.sin(dlng / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.min(1, Math.sqrt(t)));
}
function routeCode(name) {
  if (typeof name !== 'string') return null;
  const match = name.trim().match(/\bROUTE[\s_.-]*(\d{1,4}[A-Z]{0,2})\b/i) ||
    name.trim().match(/^(\d{1,4}[A-Z]{0,2})$/i);
  return match ? match[1].toUpperCase() : null;
}
function routeName(raw) { return typeof raw === 'string' ? raw.trim() : null; }
function sourceObjectId(feature) {
  const id = feature?.attributes?.OBJECTID;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
async function readWithHash(file) {
  const buffer = await readFile(file);
  return { data: JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, '')),
    sha256: createHash('sha256').update(buffer).digest('hex') };
}
async function writeJSON(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  await rename(temp, file);
}
function buildRoute(feature, errors, warnings) {
  const a = feature?.attributes || {};
  const objectId = sourceObjectId(feature);
  const paths = [];
  const parts = feature?.geometry?.paths;
  if (!Array.isArray(parts)) errors.push(`Route OBJECTID ${objectId}: missing polyline paths`);
  let skippedVertices = 0;
  let outsideGautengBounds = false;
  let km = 0;
  let segments = 0;
  const extent = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
  for (const rawPath of Array.isArray(parts) ? parts : []) {
    if (!Array.isArray(rawPath)) continue;
    const line = [];
    for (const point of rawPath) {
      const lng = point?.[0]; const lat = point?.[1];
      if (!isWgs84(lng, lat)) { skippedVertices++; continue; }
      if (!isGautengVicinity(lng, lat)) outsideGautengBounds = true;
      const coord = [lng, lat];
      if (line.length) { km += haversineKm(line[line.length - 1], coord); segments++; }
      line.push(coord);
      extent.west = Math.min(extent.west, lng); extent.east = Math.max(extent.east, lng);
      extent.south = Math.min(extent.south, lat); extent.north = Math.max(extent.north, lat);
    }
    if (line.length >= 2) paths.push(line);
  }
  if (!paths.length || segments === 0) errors.push(`Route OBJECTID ${objectId}: no usable WGS84 segments`);
  if (skippedVertices) warnings.push(`Route OBJECTID ${objectId}: skipped ${skippedVertices} invalid vertices`);
  if (outsideGautengBounds) warnings.push(`Route OBJECTID ${objectId}: some coordinates outside Gauteng screening bounds`);
  const name = routeName(a.NAME);
  const code = routeCode(name);
  const numericRouteIdField = finite(a.ROUTE_ID) ? a.ROUTE_ID : null;
  // Example in source: NAME = ROUTE 55, ROUTE_ID = 60. Never overwrite a published code with ROUTE_ID.
  const numericLabel = code && /^\d+$/.test(code) ? Number(code) : null;
  const idDisagreement = numericLabel !== null && numericRouteIdField !== null &&
    numericLabel !== numericRouteIdField;
  return {
    gisObjectId: objectId,
    gisName: name,
    routeCodeFromName: code,
    rawRouteIdField: numericRouteIdField,
    routeIdDisagreesWithName: idDisagreement,
    gisDescription: routeName(a.NAME_OF_RO),
    originLabel: routeName(a.ROUTE_ORIG),
    originAddress: routeName(a.ORIGIN_ADD),
    destinationLabel: routeName(a.ROUTE_DEST),
    destinationAddress: routeName(a.DESTINATIO),
    nativeShapeLengthMetres: finite(a['SHAPE.STLength()']) ? a['SHAPE.STLength()'] : null,
    geometry: { type: 'MultiLineString', coordinates: paths },
    gisPolylineLengthKm: segments ? round(km, 3) : null,
    extentWgs84: segments ? extent : null,
    segmentCount: segments,
    geometryEvidence: 'city-gis-polyline; no validated operating status/direction',
    passengerRoutingEnabled: false,
  };
}
function parseExifDate(value) {
  if (!finite(value)) return null;
  const date = new Date(value);
  const y = date.getUTCFullYear();
  return y >= 1995 && y <= 2100 ? date.toISOString() : null;
}
function buildStop(feature, errors, warnings) {
  const a = feature?.attributes || {};
  const objectId = sourceObjectId(feature);
  const lng = feature?.geometry?.x;
  const lat = feature?.geometry?.y;
  const valid = isWgs84(lng, lat);
  if (!valid) errors.push(`Stop OBJECTID ${objectId}: missing/invalid WGS84 coordinate`);
  if (valid && !isGautengVicinity(lng, lat)) warnings.push(`Stop OBJECTID ${objectId}: outside Gauteng screening bounds`);
  return {
    gisObjectId: objectId,
    locationDescription: routeName(a.LOCATION),
    coordinate: valid ? { lat, lng } : null,
    exifCaptureDateReported: parseExifDate(a.EXIF_DATET),
    hasSourcePhotoReference: Boolean(a.PHOTONAME),
    geometryEvidence: 'city-gis-point; no operator-published route or stop-sequence association',
    passengerBoardingValidated: false,
  };
}
function spatialRoutesAndCandidates(routes, stops, thresholdMetres) {
  // Approximate local planar projection is sufficient for proximity SCREENING only.
  // Candidate pairs are NOT stop membership, transfers, boarding points or direction evidence.
  const shapes = routes.filter(r => r.extentWgs84).map(r => {
    const segments = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const part of r.geometry.coordinates) {
      for (let i = 1; i < part.length; i++) {
        const a = projected(...part[i - 1]); const b = projected(...part[i]);
        const box = { x1: a[0], y1: a[1], x2: b[0], y2: b[1],
          minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]),
          minY: Math.min(a[1], b[1]), maxY: Math.max(a[1], b[1]) };
        segments.push(box);
        minX = Math.min(minX, box.minX); maxX = Math.max(maxX, box.maxX);
        minY = Math.min(minY, box.minY); maxY = Math.max(maxY, box.maxY);
      }
    }
    return { gisObjectId: r.gisObjectId, routeCodeFromName: r.routeCodeFromName,
      bbox: { minX, minY, maxX, maxY }, segments };
  });
  const candidates = [];
  const nearByStop = new Map();
  for (const stop of stops) {
    if (!stop.coordinate) continue;
    const [x, y] = projected(stop.coordinate.lng, stop.coordinate.lat);
    for (const r of shapes) {
      const b = r.bbox;
      if (x < b.minX - thresholdMetres || x > b.maxX + thresholdMetres ||
          y < b.minY - thresholdMetres || y > b.maxY + thresholdMetres) continue;
      let best2 = thresholdMetres * thresholdMetres;
      let near = false;
      for (const s of r.segments) {
        if (x < s.minX - thresholdMetres || x > s.maxX + thresholdMetres ||
            y < s.minY - thresholdMetres || y > s.maxY + thresholdMetres) continue;
        const dx = s.x2 - s.x1; const dy = s.y2 - s.y1;
        const t = dx === 0 && dy === 0 ? 0 :
          Math.max(0, Math.min(1, ((x - s.x1) * dx + (y - s.y1) * dy) / (dx * dx + dy * dy)));
        const px = s.x1 + t * dx, py = s.y1 + t * dy;
        const d2 = (x - px) ** 2 + (y - py) ** 2;
        if (d2 <= best2) { best2 = d2; near = true; }
      }
      if (near) {
        candidates.push({ stopGisObjectId: stop.gisObjectId,
          routeGisObjectId: r.gisObjectId, routeCodeFromName: r.routeCodeFromName,
          proximityMetresApprox: round(Math.sqrt(best2), 1), evidence: 'spatial-support-only',
          isPublishedStopMembership: false, isPassengerTransfer: false });
        nearByStop.set(stop.gisObjectId, (nearByStop.get(stop.gisObjectId) || 0) + 1);
      }
    }
  }
  return { candidates, stopsNearOneOrMore: nearByStop.size,
    stopsNearMultipleGISRouteFeatures: [...nearByStop.values()].filter(n => n > 1).length };
}
function inventoryCodes(data) {
  if (!Array.isArray(data?.routes)) return [];
  return [...new Set(data.routes.map(r => {
    const raw = r?.routeNumber ?? r?.routeCode ?? r?.number;
    return raw === null || raw === undefined ? null : String(raw).trim().toUpperCase();
  }).filter(x => x && /^\d{1,4}[A-Z]{0,2}$/.test(x)))].sort();
}
function duplicates(items, getKey) {
  const counts = new Map();
  for (const v of items) {
    const key = getKey(v);
    if (key === null || key === undefined) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));
}

export async function normalizeMetrobusGIS({ inputRoot, outputRoot, spatial = true } = {}) {
  inputRoot ||= path.join(process.cwd(), REL);
  outputRoot ||= path.join(inputRoot, 'gis-normalized');
  const input = path.join(inputRoot, 'gis-raw');
  const [routeSnapshot, stopSnapshot, routeMeta, stopMeta, syncReport] = await Promise.all([
    readWithHash(path.join(input, 'metrobus-routes-wgs84.json')),
    readWithHash(path.join(input, 'metrobus-stops-wgs84.json')),
    readWithHash(path.join(input, 'metrobus-routes-metadata.json')),
    readWithHash(path.join(input, 'metrobus-stops-metadata.json')),
    readWithHash(path.join(input, 'sync-report.json')),
  ]);
  const routeRaw = routeSnapshot.data, stopRaw = stopSnapshot.data;
  const reportRaw = syncReport.data;
  if (routeRaw.source?.layerId !== LAYER_ROUTE || stopRaw.source?.layerId !== LAYER_STOP) {
    fail('Source layer ID mismatch: expected CoJ layers 22 (routes) and 52 (stops).');
  }
  if (routeRaw.spatialReference?.requestedWkid !== 4326 ||
      stopRaw.spatialReference?.requestedWkid !== 4326) {
    fail('Snapshots do not declare requested WGS84 (outSR=4326).');
  }
  if (routeRaw.geometryType !== 'esriGeometryPolyline' ||
      stopRaw.geometryType !== 'esriGeometryPoint') {
    fail('Unexpected ArcGIS geometry type.');
  }
  if (!Array.isArray(routeRaw.features) || !Array.isArray(stopRaw.features)) {
    fail('Missing feature arrays; do not normalize partial downloads.');
  }
  const expectedRoutes = reportRaw.layers?.find(l => l.layerId === LAYER_ROUTE)?.features;
  const expectedStops = reportRaw.layers?.find(l => l.layerId === LAYER_STOP)?.features;
  if (routeRaw.features.length !== routeRaw.featureCount ||
      stopRaw.features.length !== stopRaw.featureCount ||
      expectedRoutes !== routeRaw.features.length || expectedStops !== stopRaw.features.length) {
    fail('Feature count does not match snapshot and sync report. Refusing partial/corrupt input.');
  }
  const errors = [], warnings = [];
  const routes = routeRaw.features.map(f => buildRoute(f, errors, warnings));
  const stops = stopRaw.features.map(f => buildStop(f, errors, warnings));
  for (const [label, rows] of [['route', routes], ['stop', stops]]) {
    const idMissing = rows.filter(r => r.gisObjectId === null).length;
    if (idMissing) errors.push(`${label}: ${idMissing} records missing valid OBJECTID`);
    const dup = duplicates(rows, r => r.gisObjectId);
    if (dup.length) errors.push(`${label}: duplicate OBJECTID values: ${JSON.stringify(dup.slice(0, 5))}`);
  }
  const nameCodeGroups = new Map();
  for (const r of routes) {
    if (!r.routeCodeFromName) continue;
    if (!nameCodeGroups.has(r.routeCodeFromName)) nameCodeGroups.set(r.routeCodeFromName, []);
    nameCodeGroups.get(r.routeCodeFromName).push(r.gisObjectId);
  }
  const gisCodes = [...nameCodeGroups.keys()].sort();
  const partialFile = path.join(inputRoot, 'partial-inventory/normalized/routes.json');
  let partial = null;
  if (existsSync(partialFile)) {
    const partialDoc = (await readWithHash(partialFile)).data;
    const codes = inventoryCodes(partialDoc);
    const gis = new Set(gisCodes), inv = new Set(codes);
    partial = { referenceKind: partialDoc.kind ?? 'partial-inventory',
      partialInventoryRouteCodes: codes.length,
      labelCodeOverlap: codes.filter(code => gis.has(code)),
      partialCodesWithoutGISNameMatch: codes.filter(code => !gis.has(code)),
      gisCodesOutsidePartialExcerpt: gisCodes.filter(code => !inv.has(code)),
      caution: 'Code-level label match only. Does not establish route shape equivalence, direction or current service.' };
  } else {
    warnings.push('No partial-inventory/normalized/routes.json found; code-overlap reconciliation skipped.');
  }
  const coordinateDuplicates = duplicates(stops.filter(s => s.coordinate),
    s => `${s.coordinate.lng.toFixed(6)},${s.coordinate.lat.toFixed(6)}`);
  const exifDates = stops.map(s => s.exifCaptureDateReported).filter(Boolean).sort();
  const codeDisagreements = routes.filter(r => r.routeIdDisagreesWithName).map(r => ({
    gisObjectId: r.gisObjectId, gisName: r.gisName, routeCodeFromName: r.routeCodeFromName,
    rawRouteIdField: r.rawRouteIdField }));
  const spatialResult = spatial ? spatialRoutesAndCandidates(routes, stops, NEAR_METRES) : null;
  const qa = {
    generatedAt: new Date().toISOString(), phase: 'metrobus-gis-normalization-1c',
    authority: 'City of Johannesburg GIS; present-day Metrobus operations NOT validated',
    rawSource: {
      routeLayer: LAYER_ROUTE, stopLayer: LAYER_STOP,
      routeSnapshotSha256: routeSnapshot.sha256, stopSnapshotSha256: stopSnapshot.sha256,
      routeMetadataSha256: routeMeta.sha256, stopMetadataSha256: stopMeta.sha256,
      syncReportSha256: syncReport.sha256,
      retrievedAtRoutes: routeRaw.source?.retrievedAt ?? null,
      retrievedAtStops: stopRaw.source?.retrievedAt ?? null,
      routeLayerCopyrightText: routeMeta.data.copyrightText ?? null,
      stopLayerCopyrightText: stopMeta.data.copyrightText ?? null,
    },
    routes: { gisFeatures: routes.length, validPolylineFeatures: routes.filter(r => r.segmentCount > 0).length,
      uniqueCodesExtractedFromNAME: gisCodes.length,
      featuresWithoutParsedRouteCode: routes.filter(r => !r.routeCodeFromName).length,
      routeCodeGroups: Object.fromEntries(nameCodeGroups),
      routeNameVersusRouteIdDisagreements: codeDisagreements,
      totalLineSegments: routes.reduce((sum, r) => sum + r.segmentCount, 0) },
    stops: { gisFeatures: stops.length, validCoordinates: stops.filter(s => s.coordinate).length,
      stopsWithLocationDescription: stops.filter(s => s.locationDescription).length,
      duplicateCoordinatesRoundedToSixDecimals: coordinateDuplicates,
      recordsWithEXIFCaptureDate: exifDates.length,
      earliestReportedEXIFCaptureDate: exifDates[0] ?? null,
      latestReportedEXIFCaptureDate: exifDates.at(-1) ?? null,
      caution: 'The GIS stop layer provides points/photos, not route membership or proof of currently active boarding stops.' },
    partialInventoryReconciliation: partial,
    spatialSupport: spatialResult ? {
      screeningThresholdMetres: NEAR_METRES,
      candidatePairs: spatialResult.candidates.length,
      stopsNearAtLeastOneGISRouteFeature: spatialResult.stopsNearOneOrMore,
      stopsNearMultipleGISRouteFeatures: spatialResult.stopsNearMultipleGISRouteFeatures,
      instruction: 'Candidates are proximity ONLY; never turn these into transfer/boarding/stop-order edges.'
    } : { skipped: true },
    errors, warnings: [...new Set(warnings)].slice(0, 100),
    policy: { completeCurrentOperatorInventory: false, validatedRouteStopMembership: false,
      verifiedDirection: false, verifiedOperatingStatus: false, verifiedFares: false,
      verifiedTimetables: false, permissionForAppRedistributionConfirmed: false,
      passengerRoutingEnabled: false, transferInstructionsEnabled: false,
      sourceLicenceReviewRequired: true },
  };
  // Save normalized data to a NEW folder; original source snapshots and partial inventory remain unchanged.
  await writeJSON(path.join(outputRoot, 'routes.json'), {
    metadata: { source: 'CoJ GIS / Transportation / layer 22', sourceHash: routeSnapshot.sha256,
      operatorStatus: 'unverified', rightsReviewRequired: true, passengerRoutingEnabled: false }, routes });
  await writeJSON(path.join(outputRoot, 'stops.json'), {
    metadata: { source: 'CoJ GIS / Transportation / layer 52', sourceHash: stopSnapshot.sha256,
      routeMembership: 'unknown', passengerBoardingValidated: false, rightsReviewRequired: true }, stops });
  if (spatialResult) {
    await writeJSON(path.join(outputRoot, 'spatial-stop-route-candidates.json'), {
      evidence: 'spatial-support-only', thresholdMetres: NEAR_METRES,
      notSuitableFor: ['boarding instructions', 'route-stop membership', 'transfer edges', 'stop sequence'],
      candidates: spatialResult.candidates });
  }
  await writeJSON(path.join(outputRoot, 'reports/qa.json'), qa);
  return { qa, outputRoot };
}

function optionsFromCli(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input-root') options.inputRoot = path.resolve(argv[++i]);
    else if (argv[i] === '--output-root') options.outputRoot = path.resolve(argv[++i]);
    else if (argv[i] === '--skip-spatial') options.spatial = false;
    else fail(`Unknown argument: ${argv[i]}`);
  }
  return options;
}
const invokedAsCli = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsCli) {
  normalizeMetrobusGIS(optionsFromCli(process.argv.slice(2)))
    .then(({ qa, outputRoot }) => {
      console.log('\nMetrobus Phase 1C GIS normalization completed.');
      console.log(`GIS geometry: ${qa.routes.gisFeatures} route features (${qa.routes.uniqueCodesExtractedFromNAME} unique codes parsed from NAME)`);
      console.log(`Stop features: ${qa.stops.gisFeatures}, valid coordinates: ${qa.stops.validCoordinates}`);
      console.log(`NAME vs ROUTE_ID disagreements: ${qa.routes.routeNameVersusRouteIdDisagreements.length}`);
      console.log(`Overlapping indexed route codes: ${qa.partialInventoryReconciliation?.labelCodeOverlap.length ?? 'not available'}`);
      console.log(`Spatial-support-only candidates: ${qa.spatialSupport.candidatePairs ?? 'skipped'}`);
      console.log(`QA errors: ${qa.errors.length}, warnings: ${qa.warnings.length}`);
      console.log('Passenger routing: DISABLED | Current operation: UNVERIFIED | Licence review: REQUIRED');
      console.log(`Output: ${outputRoot}`);
    })
    .catch(err => { console.error(`Metrobus normalization failed: ${err.message}`); process.exitCode = 1; });
}
