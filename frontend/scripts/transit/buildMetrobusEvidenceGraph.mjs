/**
 * Pulse Transit / Johannesburg Metrobus Phase 1G
 * Builds a LOCAL-ONLY evidence graph + developer origin/destination geometry tester.
 * Does not modify src/, public/, App.tsx, or passenger recommendations.
 * Consumes the verified local Phase 1F index. No network calls, no GIS publishing.
 * node scripts/transit/buildMetrobusEvidenceGraph.mjs
 */
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile, rename, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_INPUT = '.local-dev/metrobus/metrobus-dev-index.json';
const DEFAULT_OUTPUT = '.local-dev/metrobus/phase1g';
const assert = (c, m) => { if (!c) throw new Error(m); };
const validId = v => Number.isSafeInteger(v) && v > 0;
const validCoordinate = (lng, lat) =>
  Number.isFinite(lng) && Number.isFinite(lat) && lng >= 25 && lng <= 31 && lat >= -28.5 && lat <= -23.5;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/** Screen a point against the full GIS polyline, not just its vertices.
 * Locally projected distances are approximate; NEVER label as walking distance. */
export function distanceToPolylineMetres(point, multiline) {
  assert(validCoordinate(point?.lng, point?.lat), 'Point must have valid Gauteng WGS84 lat/lng.');
  assert(Array.isArray(multiline) && multiline.length > 0, 'Route requires a MultiLineString.');
  const phi = point.lat * Math.PI / 180;
  const latScale = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi);
  const lonScale = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi);
  let best = Infinity, closest = null;
  for (const line of multiline) {
    assert(Array.isArray(line) && line.length >= 2, 'Route line has fewer than two points.');
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i];
      assert(Array.isArray(a) && Array.isArray(b) &&
        validCoordinate(a[0], a[1]) && validCoordinate(b[0], b[1]), 'Route contains invalid WGS84 coordinates.');
      const ax = (a[0] - point.lng) * lonScale, ay = (a[1] - point.lat) * latScale;
      const bx = (b[0] - point.lng) * lonScale, by = (b[1] - point.lat) * latScale;
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      const t = len2 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / len2)) : 0;
      const x = ax + t * dx, y = ay + t * dy;
      const dist = Math.hypot(x, y);
      if (dist < best) {
        best = dist;
        closest = { lng: a[0] + t * (b[0] - a[0]), lat: a[1] + t * (b[1] - a[1]) };
      }
    }
  }
  assert(Number.isFinite(best), 'Unable to compute proximity to route geometry.');
  return { distanceMetresApprox: Math.round(best * 10) / 10, nearestPolylinePoint: closest };
}

/** A development-only same-polyline spatial search, NOT a journey-planning result. */
export function screenMetrobusGeometry(graph, origin, destination, screeningMetres = 800) {
  assert(Number.isFinite(screeningMetres) && screeningMetres >= 100 && screeningMetres <= 1500,
    'Developer-only screening radius must be between 100 and 1500 metres.');
  assert(validCoordinate(origin?.lng, origin?.lat) && validCoordinate(destination?.lng, destination?.lat),
    'Both points must be valid WGS84 coordinates in the Gauteng screening bounds.');
  assert(graph?.metadata?.passengerRoutingEnabled === false && graph?.metadata?.currentOperationVerified === false &&
    graph?.metadata?.directionVerified === false && graph?.metadata?.routeStopMembershipVerified === false &&
    graph?.metadata?.licensingReviewRequired === true &&
    Array.isArray(graph?.edges?.passengerTravel) && graph.edges.passengerTravel.length === 0 &&
    Array.isArray(graph?.edges?.verifiedTransfers) && graph.edges.verifiedTransfers.length === 0,
    'Only a restricted, zero-passenger-edge developer graph may be screened.');
  const both = [], originOnly = [], destinationOnly = [];
  for (const route of graph.nodes.routes) {
    const a = distanceToPolylineMetres(origin, route.geometry.coordinates);
    const b = distanceToPolylineMetres(destination, route.geometry.coordinates);
    const row = {
      gisObjectId: route.gisObjectId,
      routeNodeId: route.id,
      routeCode: route.routeCodeFromName,
      gisDescription: route.gisDescription,
      indexedCodeOverlapOnly: route.indexedCodeOverlapOnly,
      originProximityMetresApprox: a.distanceMetresApprox,
      destinationProximityMetresApprox: b.distanceMetresApprox,
      originNearestPolylinePoint: a.nearestPolylinePoint,
      destinationNearestPolylinePoint: b.nearestPolylinePoint,
      evidence: 'same-GIS-polyline-proximity-only',
      boardingVerified: false,
      currentOperationVerified: false,
      travelDirectionVerified: false,
      passengerJourneyAvailable: false,
      fare: null,
      time: null,
    };
    if (a.distanceMetresApprox <= screeningMetres && b.distanceMetresApprox <= screeningMetres) both.push(row);
    else if (a.distanceMetresApprox <= screeningMetres) originOnly.push(row);
    else if (b.distanceMetresApprox <= screeningMetres) destinationOnly.push(row);
  }
  const byProximity = (x, y) =>
    Math.max(x.originProximityMetresApprox, x.destinationProximityMetresApprox) -
    Math.max(y.originProximityMetresApprox, y.destinationProximityMetresApprox) ||
    x.originProximityMetresApprox + x.destinationProximityMetresApprox -
    y.originProximityMetresApprox - y.destinationProximityMetresApprox || x.gisObjectId - y.gisObjectId;
  both.sort(byProximity);
  originOnly.sort((x, y) => x.originProximityMetresApprox - y.originProximityMetresApprox || x.gisObjectId - y.gisObjectId);
  destinationOnly.sort((x, y) => x.destinationProximityMetresApprox - y.destinationProximityMetresApprox || x.gisObjectId - y.gisObjectId);
  return {
    kind: 'developer-geometry-screening',
    evidence: 'same-GIS-polyline-proximity-only',
    screeningThresholdMetres: screeningMetres,
    straightLineToGeometryOnly: true,
    noRouteDirectionInferred: true,
    noBoardingOrStopMembershipInferred: true,
    noTransfersInferred: true,
    noOperatingServiceInferred: true,
    passengerRoutingEnabled: false,
    commonGeometryCandidates: both,
    originOnlyGeometryCandidates: originOnly,
    destinationOnlyGeometryCandidates: destinationOnly,
    verifiedPassengerJourneys: [],
  };
}

export function buildMetrobusEvidenceGraph(input, generatedAt = new Date().toISOString()) {
  assert(input?.metadata?.passengerRoutingEnabled === false &&
    input.metadata.licensingReviewRequired === true && input.metadata.currentOperationVerified === false &&
    input.metadata.routeDirectionVerified === false && input.metadata.publishedOrderedStopsVerified === false &&
    input.metadata.boardingVerified === false && input.metadata.transfersVerified === false &&
    input.metadata.faresVerified === false && input.metadata.timetablesVerified === false,
    'Phase 1F must explicitly preserve all unverified statuses and data-use review.');
  assert(Array.isArray(input.routes) && Array.isArray(input.stops) && Array.isArray(input.candidates),
    'Phase 1F route/stop/spatial-candidate arrays are missing.');
  assert(input.summary?.verifiedBoardingEdges === 0 && input.summary?.verifiedTransferEdges === 0 &&
    input.summary?.selectablePassengerJourneys === 0, 'Phase 1F contains unsupported passenger routing edges.');
  assert(Number.isFinite(input.summary.screeningThresholdMetres) &&
    input.summary.screeningThresholdMetres > 0 && input.summary.screeningThresholdMetres <= 100,
    'GIS stop-screening threshold is missing or out of bounds.');

  const seenRoutes = new Set(), seenStops = new Set(), seenEdges = new Set();
  const routeNodes = input.routes.map(r => {
    assert(validId(r.gisObjectId) && !seenRoutes.has(r.gisObjectId), 'Duplicate/invalid GIS route ID.');
    seenRoutes.add(r.gisObjectId);
    assert(typeof r.routeCodeFromName === 'string' && r.routeCodeFromName.length &&
      Array.isArray(r.geometry) && r.geometry.length && r.passengerRoutingEnabled === false &&
      r.verifiedServiceDirection === false && r.verifiedCurrentOperation === false &&
      r.verifiedStopMembership === false, `Route ${r.gisObjectId} has unsupported verification or missing geometry.`);
    let segs = 0;
    for (const line of r.geometry) {
      assert(Array.isArray(line) && line.length >= 2, `Route ${r.gisObjectId} contains empty GIS geometry.`);
      for (const xy of line) assert(Array.isArray(xy) && validCoordinate(xy[0], xy[1]),
        `Route ${r.gisObjectId} has out-of-bounds coordinates.`);
      segs += line.length - 1;
    }
    assert(segs > 0, 'Every GIS route must contain at least one segment.');
    return {
      id: `metrobus:gis-route:${r.gisObjectId}`,
      gisObjectId: r.gisObjectId,
      routeCodeFromName: r.routeCodeFromName,
      rawRouteIdField: r.rawRouteIdField,
      rawIdDisagreesWithName: r.rawIdDisagreesWithName,
      gisDescription: r.gisDescription ?? null,
      originLabel: r.originLabel ?? null,
      destinationLabel: r.destinationLabel ?? null,
      indexedCodeOverlapOnly: r.inventoryCodeOverlapOnly === true,
      indexedRouteLabel: r.publishedInventoryLabel ?? null,
      geometry: { type: 'MultiLineString', coordinates: r.geometry },
      extentWgs84: r.extentWgs84 ?? null,
      gisPolylineLengthKm: r.gisPolylineLengthKm ?? null,
      candidateStopCount: r.candidateStopCount,
      geometryEvidence: 'City GIS local snapshot; current service and direction unknown',
      operatingStatus: 'unverified', directionStatus: 'unverified',
      stopMembershipStatus: 'unverified', fareStatus: 'unverified', timetableStatus: 'unverified',
      passengerRoutingEnabled: false,
    };
  });
  const stopNodes = input.stops.map(s => {
    assert(validId(s.gisObjectId) && !seenStops.has(s.gisObjectId), 'Duplicate/invalid GIS stop ID.');
    seenStops.add(s.gisObjectId);
    assert(validCoordinate(s.lng, s.lat) && s.verifiedBoarding === false && s.verifiedRouteMembership === false,
      `Stop ${s.gisObjectId} unexpectedly verifies boarding or has bad coordinates.`);
    return {
      id: `metrobus:gis-stop:${s.gisObjectId}`,
      gisObjectId: s.gisObjectId,
      coordinate: { lng: s.lng, lat: s.lat },
      locationDescription: s.locationDescription ?? null,
      candidateRouteCount: s.candidateRouteCount,
      boardingStatus: 'unverified', routeMembershipStatus: 'unverified',
    };
  });
  const spatialSupport = input.candidates.map(p => {
    assert(validId(p.routeGisObjectId) && seenRoutes.has(p.routeGisObjectId) &&
      validId(p.stopGisObjectId) && seenStops.has(p.stopGisObjectId),
      'Spatial candidate refers to an unknown GIS node.');
    assert(p.evidence === 'spatial-support-only' && p.confirmedBoarding === false &&
      p.confirmedTransfer === false && Number.isFinite(p.proximityMetresApprox) &&
      p.proximityMetresApprox >= 0 &&
      p.proximityMetresApprox <= input.summary.screeningThresholdMetres + 0.15,
      'Spatial edge improperly asserts published boarding/transfer or exceeds screening threshold.');
    const key = `${p.routeGisObjectId}:${p.stopGisObjectId}`;
    assert(!seenEdges.has(key), `Duplicate spatial support edge ${key}.`);
    seenEdges.add(key);
    return {
      kind: 'spatial-support-only', routeNodeId: `metrobus:gis-route:${p.routeGisObjectId}`,
      stopNodeId: `metrobus:gis-stop:${p.stopGisObjectId}`,
      proximityMetresApprox: p.proximityMetresApprox,
      confirmedBoarding: false, confirmedRouteMembership: false, confirmedTransfer: false,
      traversableByPassenger: false,
    };
  });
  assert(routeNodes.length === input.summary.gisRouteGeometries &&
    stopNodes.length === input.summary.gisStopPoints &&
    spatialSupport.length === input.summary.candidateSpatialPairs,
    'Phase 1F summary and graph node/edge counts disagree.');
  const countedByRoute = new Map(), countedByStop = new Map();
  for (const edge of spatialSupport) {
    countedByRoute.set(edge.routeNodeId, (countedByRoute.get(edge.routeNodeId) ?? 0) + 1);
    countedByStop.set(edge.stopNodeId, (countedByStop.get(edge.stopNodeId) ?? 0) + 1);
  }
  for (const r of routeNodes) assert(r.candidateStopCount === (countedByRoute.get(r.id) ?? 0),
    `Route ${r.gisObjectId} candidate count disagrees with edges.`);
  for (const s of stopNodes) assert(s.candidateRouteCount === (countedByStop.get(s.id) ?? 0),
    `Stop ${s.gisObjectId} candidate count disagrees with edges.`);
  const overlapCount = routeNodes.filter(r => r.indexedCodeOverlapOnly).length;
  const mismatchCount = routeNodes.filter(r => r.rawIdDisagreesWithName).length;
  assert(overlapCount === input.summary.inventoryCodeMatches &&
    mismatchCount === input.summary.nameVersusRawIdDisagreements &&
    [...countedByStop.values()].filter(n => n > 1).length === input.summary.stopsNearMultipleShapes &&
    countedByStop.size === input.summary.stopsNearAnyShape,
    'Graph totals disagree with Phase 1F reconciliation / stop-support QA.');

  const summary = {
    routeNodes: routeNodes.length, stopEvidenceNodes: stopNodes.length,
    spatialSupportEdges: spatialSupport.length, indexedCodeOverlaps: overlapCount,
    rawIdDisagreements: mismatchCount,
    stopsNearAnyRouteGeometry: countedByStop.size,
    stopsNearMultipleRouteGeometries: [...countedByStop.values()].filter(n => n > 1).length,
    verifiedPassengerTravelEdges: 0, verifiedTransferEdges: 0, verifiedBoardingEdges: 0,
    enabledPassengerJourneys: 0,
  };
  return {
    metadata: {
      kind: 'Metrobus Phase 1G — LOCAL DEVELOPER ONLY evidence graph',
      generatedAt, source: 'Phase 1F local developer index, from City of Johannesburg GIS layers 22/52',
      distribution: 'local-dev-only',
      sourceRights: 'CoJ to decide in route GIS metadata; public/commercial reuse not cleared',
      licensingReviewRequired: true, passengerRoutingEnabled: false,
      currentOperationVerified: false, directionVerified: false,
      routeStopMembershipVerified: false, boardingVerified: false,
      transfersVerified: false, faresVerified: false, timetablesVerified: false,
      graphType: 'spatial-evidence-only-NOT-passenger-route-graph',
      stopScreeningRadiusMetres: input.summary.screeningThresholdMetres,
      geometryScreeningDefaultMetres: 800,
      prohibitedInferences: ['active service', 'travel direction', 'published boarding stops',
        'stop order', 'transfers', 'fares', 'ETAs', 'walking distance'],
    },
    summary,
    nodes: { routes: routeNodes, stops: stopNodes },
    edges: { spatialSupport, passengerTravel: [], verifiedTransfers: [], verifiedBoarding: [] },
  };
}

async function writeAtomic(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, content, 'utf8');
  await rename(tmp, file);
}

export async function runMetrobusEvidenceGraph({
  inputPath = path.resolve(DEFAULT_INPUT),
  outputRoot = path.resolve(DEFAULT_OUTPUT),
  templatePath = fileURLToPath(new URL('./metrobusJourneySandbox.template.html', import.meta.url)),
} = {}) {
  let bytes;
  try { bytes = await readFile(inputPath); }
  catch { throw new Error(`Phase 1F local index not found: ${inputPath}\nFirst run: node scripts/transit/buildMetrobusDevInfrastructure.mjs`); }
  const input = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  const graph = buildMetrobusEvidenceGraph(input);
  const template = await readFile(templatePath, 'utf8');
  assert(template.includes('__PULSE_METROBUS_EVIDENCE_GRAPH__') && template.includes('__PULSE_METROBUS_SCREEN_CORE__'),
    'Local sandbox template marker not found.');
  const escaped = JSON.stringify(graph).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const core = [
    `const assert = ${assert.toString()};`,
    `const validCoordinate = ${validCoordinate.toString()};`,
    distanceToPolylineMetres.toString(),
    screenMetrobusGeometry.toString(),
  ].join('\n');
  const html = template.replace('__PULSE_METROBUS_EVIDENCE_GRAPH__', escaped)
    .replace('__PULSE_METROBUS_SCREEN_CORE__', core);
  const qa = {
    auditedAt: graph.metadata.generatedAt,
    inputPath: DEFAULT_INPUT,
    inputSha256: sha256(bytes),
    summary: graph.summary,
    policies: {
      passengerRoutingEnabled: false, sourceRightsCleared: false,
      operationVerified: false, directionVerified: false, stopMembershipVerified: false,
      edgeType: 'spatial-support-only',
      publicBuildFilesTouched: false,
    },
    checksPassed: [
      'Phase 1F source metadata retains all unverified operational statuses',
      '110/1,922/8,492 expected counts are validated against actual source summary, not hardcoded',
      'GIS NAME passenger code and raw ROUTE_ID preserved independently',
      'Every graph node and spatial support edge validated for unique IDs and WGS84',
      'Support edges are non-traversable and never become transfers or boarding edges',
      'Developer origin/destination tester uses straight-line proximity to complete GIS polylines only',
      'Generated geometry, index, and offline sandbox remain within ignored .local-dev directory',
      'No source photo paths, EXIF data or original raw stop attributes copied from the Phase 1F index',
    ],
    errors: [],
  };
  const ignore = path.join(path.dirname(path.dirname(outputRoot)), '.gitignore');
  try { await access(ignore); }
  catch { await writeAtomic(ignore, '*\n!.gitignore\n'); }
  await writeAtomic(path.join(outputRoot, 'metrobus-evidence-graph.json'), JSON.stringify(graph, null, 2) + '\n');
  await writeAtomic(path.join(outputRoot, 'reports/qa.json'), JSON.stringify(qa, null, 2) + '\n');
  await writeAtomic(path.join(outputRoot, 'metrobus-journey-sandbox.html'), html);
  console.log('\nMetrobus Phase 1G evidence graph generated (DEVELOPER ONLY).');
  for (const [k, v] of Object.entries(graph.summary)) console.log(`${k}: ${v}`);
  console.log(`Local geometry tester: ${path.join(outputRoot, 'metrobus-journey-sandbox.html')}`);
  console.log('0 verified passenger travel, boarding or transfer edges. No passenger planner modifications.');
  return { graph, qa, html, outputRoot };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runMetrobusEvidenceGraph().catch(error => {
    console.error(`Metrobus Phase 1G failed: ${error.message}`);
    process.exitCode = 1;
  });
}
