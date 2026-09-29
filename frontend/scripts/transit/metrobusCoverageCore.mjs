/**
 * Pulse Transit / Metrobus Phase 1G
 * Geographic ONLY: proximity to GIS polylines. No passenger stop membership,
 * direction, transfer, route operation, fare, timetable or journey claim.
 * Keep exports in this dependency-free module so the builder can embed the
 * same code into a self-contained offline developer HTML document.
 */
const RAD = Math.PI / 180;

export function validGautengPoint(p) {
  return p && Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    p.lat >= -28.5 && p.lat <= -23.5 && p.lng >= 25 && p.lng <= 31;
}

export function distancePointToRouteMetres(point, route) {
  if (!validGautengPoint(point)) throw new Error('Invalid Gauteng WGS84 point.');
  if (!Array.isArray(route?.geometry)) throw new Error('Invalid route geometry.');
  const xScale = 111320 * Math.cos(point.lat * RAD);
  const yScale = 110574;
  let shortestSquared = Infinity;
  for (const part of route.geometry) {
    if (!Array.isArray(part) || part.length < 2) continue;
    let x0 = (part[0][0] - point.lng) * xScale;
    let y0 = (part[0][1] - point.lat) * yScale;
    for (let i = 1; i < part.length; i++) {
      const xy = part[i];
      const x1 = (xy[0] - point.lng) * xScale;
      const y1 = (xy[1] - point.lat) * yScale;
      const dx = x1 - x0, dy = y1 - y0;
      const denominator = dx * dx + dy * dy;
      const t = denominator === 0 ? 0 : Math.max(0, Math.min(1, -(x0 * dx + y0 * dy) / denominator));
      const px = x0 + t * dx, py = y0 + t * dy;
      shortestSquared = Math.min(shortestSquared, px * px + py * py);
      x0 = x1; y0 = y1;
    }
  }
  return Math.sqrt(shortestSquared);
}

export function distanceBetweenPointsMetres(a, b) {
  if (!validGautengPoint(a) || !validGautengPoint(b)) throw new Error('Invalid WGS84 point.');
  const xScale = 111320 * Math.cos(((a.lat + b.lat) / 2) * RAD);
  return Math.hypot((a.lng - b.lng) * xScale, (a.lat - b.lat) * 110574);
}

function definitelyOutsideExtent(p, e, thresholdMetres) {
  if (!e || !Number.isFinite(e.west) || !Number.isFinite(e.east) ||
      !Number.isFinite(e.south) || !Number.isFinite(e.north)) return false;
  const latitudePadding = (thresholdMetres * 1.06) / 110574;
  const longitudePadding = (thresholdMetres * 1.06) / (111320 * Math.cos(p.lat * RAD));
  return p.lat < e.south - latitudePadding || p.lat > e.north + latitudePadding ||
    p.lng < e.west - longitudePadding || p.lng > e.east + longitudePadding;
}

export function analyzeMetrobusGisCoverage(data, origin, destination, thresholdMetres = 800, nearStopMetres = 500) {
  if (!validGautengPoint(origin) || !validGautengPoint(destination)) {
    throw new Error('Origin and destination must be valid Gauteng coordinates.');
  }
  if (!Number.isFinite(thresholdMetres) || thresholdMetres < 50 || thresholdMetres > 1500) {
    throw new Error('Invalid local GIS coverage screening threshold.');
  }
  if (!Array.isArray(data?.routes) || !Array.isArray(data?.stops)) throw new Error('Missing GIS data.');
  const both = [], originOnly = [], destinationOnly = [];
  for (const r of data.routes) {
    const aMetres = definitelyOutsideExtent(origin, r.extentWgs84, thresholdMetres)
      ? Infinity : distancePointToRouteMetres(origin, r);
    const bMetres = definitelyOutsideExtent(destination, r.extentWgs84, thresholdMetres)
      ? Infinity : distancePointToRouteMetres(destination, r);
    const aNear = aMetres <= thresholdMetres, bNear = bMetres <= thresholdMetres;
    if (!aNear && !bNear) continue;
    const item = {
      gisObjectId: r.gisObjectId,
      routeCodeFromName: r.routeCodeFromName,
      rawRouteIdField: r.rawRouteIdField,
      gisDescription: r.gisDescription ?? null,
      inventoryCodeOverlapOnly: r.inventoryCodeOverlapOnly === true,
      candidateStopCount: r.candidateStopCount ?? 0,
      originShapeDistanceMetres: Number.isFinite(aMetres) ? Math.round(aMetres) : null,
      destinationShapeDistanceMetres: Number.isFinite(bMetres) ? Math.round(bMetres) : null,
      evidence: 'local-gis-polyline-proximity-only',
      verifiedDirection: false,
      confirmedBoarding: false,
      passengerJourney: false,
    };
    if (aNear && bNear) both.push(item);
    else if (aNear) originOnly.push(item);
    else destinationOnly.push(item);
  }
  const order = (a, b) =>
    (Math.max(a.originShapeDistanceMetres ?? Infinity, a.destinationShapeDistanceMetres ?? Infinity) -
     Math.max(b.originShapeDistanceMetres ?? Infinity, b.destinationShapeDistanceMetres ?? Infinity)) ||
    String(a.routeCodeFromName).localeCompare(String(b.routeCodeFromName), undefined, { numeric: true });
  const oneSideOrder = key => (a, b) => a[key] - b[key] || String(a.routeCodeFromName).localeCompare(String(b.routeCodeFromName), undefined, { numeric: true });
  both.sort(order);
  originOnly.sort(oneSideOrder('originShapeDistanceMetres'));
  destinationOnly.sort(oneSideOrder('destinationShapeDistanceMetres'));
  function closestStops(p) {
    return data.stops
      .map(s => ({
        gisObjectId: s.gisObjectId,
        locationDescription: s.locationDescription || 'Unlabelled GIS point',
        distanceMetres: Math.round(distanceBetweenPointsMetres(p, s)),
        evidence: 'point-proximity-only',
        boardingConfirmed: false,
        routeMembershipConfirmed: false,
      }))
      .filter(s => s.distanceMetres <= nearStopMetres)
      .sort((a, b) => a.distanceMetres - b.distanceMetres)
      .slice(0, 5);
  }
  return {
    origin, destination,
    localShapeScreeningMetres: thresholdMetres,
    stopsScreeningMetres: nearStopMetres,
    both, originOnly, destinationOnly,
    nearbyOriginGisStops: closestStops(origin),
    nearbyDestinationGisStops: closestStops(destination),
    labels: {
      both: 'A & B near the same GIS shape (NOT a verified direct service)',
      originOnly: 'A near GIS shape only',
      destinationOnly: 'B near GIS shape only',
    },
    currentOperationVerified: false,
    directionVerified: false,
    orderedStopsVerified: false,
    boardingVerified: false,
    transfersVerified: false,
    passengerRoutingEnabled: false,
    selectablePassengerJourneys: 0,
  };
}

export function validateMetrobusDevIndex(data) {
  if (!data || !data.metadata || !data.summary ||
    !Array.isArray(data.routes) || !Array.isArray(data.stops) || !Array.isArray(data.candidates)) {
    throw new Error('Invalid Phase 1F developer index.');
  }
  for (const key of ['currentOperationVerified', 'routeDirectionVerified', 'publishedOrderedStopsVerified',
    'boardingVerified', 'transfersVerified', 'faresVerified', 'timetablesVerified', 'passengerRoutingEnabled']) {
    if (data.metadata[key] !== false) throw new Error(`Unsafe or unknown metadata flag: ${key}`);
  }
  if (data.metadata.licensingReviewRequired !== true ||
      data.metadata.routeGraphType !== 'dev-spatial-support-index-only') {
    throw new Error('Expected private GIS support-only index with licence review required.');
  }
  if (data.routes.length !== data.summary.gisRouteGeometries ||
      data.stops.length !== data.summary.gisStopPoints ||
      data.candidates.length !== data.summary.candidateSpatialPairs ||
      data.summary.verifiedBoardingEdges !== 0 ||
      data.summary.verifiedTransferEdges !== 0 ||
      data.summary.selectablePassengerJourneys !== 0) {
    throw new Error('Dev index summary/verification state mismatch.');
  }
  const routeIds = new Set(), stopIds = new Set();
  for (const r of data.routes) {
    if (!Number.isSafeInteger(r.gisObjectId) || r.gisObjectId <= 0 || routeIds.has(r.gisObjectId) ||
       r.passengerRoutingEnabled !== false || r.verifiedServiceDirection !== false ||
       r.verifiedCurrentOperation !== false || r.verifiedStopMembership !== false ||
       !Array.isArray(r.geometry) || !r.geometry.length) {
      throw new Error(`Unsafe or duplicate GIS route: ${r.gisObjectId}`);
    }
    for (const part of r.geometry) {
      if (!Array.isArray(part) || part.length < 2 || part.some(xy =>
        !Array.isArray(xy) || !validGautengPoint({ lng: xy[0], lat: xy[1] }))) {
        throw new Error(`Invalid WGS84 GIS shape: ${r.gisObjectId}`);
      }
    }
    routeIds.add(r.gisObjectId);
  }
  for (const s of data.stops) {
    if (!Number.isSafeInteger(s.gisObjectId) || s.gisObjectId <= 0 || stopIds.has(s.gisObjectId) ||
      !validGautengPoint(s) || s.verifiedBoarding !== false || s.verifiedRouteMembership !== false) {
      throw new Error(`Unsafe or duplicate stop GIS point: ${s.gisObjectId}`);
    }
    stopIds.add(s.gisObjectId);
  }
  const pairs = new Set();
  for (const p of data.candidates) {
    const k = `${p.routeGisObjectId}:${p.stopGisObjectId}`;
    if (!routeIds.has(p.routeGisObjectId) || !stopIds.has(p.stopGisObjectId) || pairs.has(k) ||
      p.evidence !== 'spatial-support-only' || p.confirmedBoarding !== false ||
      p.confirmedTransfer !== false) throw new Error('Invalid spatial-only candidate.');
    pairs.add(k);
  }
  return {
    gisRouteGeometries: data.routes.length,
    gisStopPoints: data.stops.length,
    candidateSpatialPairs: data.candidates.length,
    verifiedBoardingEdges: 0,
    verifiedTransferEdges: 0,
    selectablePassengerJourneys: 0,
  };
}
