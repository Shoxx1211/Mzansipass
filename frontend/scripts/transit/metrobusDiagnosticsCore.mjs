/**
 * Pulse Metrobus Phase 1H: LOCAL developer geometry diagnostics only.
 * This module NEVER returns a passenger journey, transfer, boarding location,
 * fare, travel duration, current service claim or inferred travel direction.
 */
export function diagnoseMetrobusGeometry(graph, screening, origin, destination, distanceFn, topN = 5) {
  if (!graph || !screening || !Array.isArray(graph.nodes?.routes) ||
      !Array.isArray(graph.nodes?.stops) || !Array.isArray(graph.edges?.spatialSupport) ||
      !Array.isArray(graph.edges?.passengerTravel) || graph.edges.passengerTravel.length !== 0 ||
      !Array.isArray(graph.edges?.verifiedTransfers) || graph.edges.verifiedTransfers.length !== 0 ||
      graph.metadata?.passengerRoutingEnabled !== false ||
      graph.metadata?.licensingReviewRequired !== true ||
      graph.metadata?.currentOperationVerified !== false ||
      graph.metadata?.directionVerified !== false ||
      graph.metadata?.routeStopMembershipVerified !== false ||
      screening.passengerRoutingEnabled !== false ||
      screening.verifiedPassengerJourneys?.length !== 0 ||
      typeof distanceFn !== 'function' || !Number.isInteger(topN) || topN < 1 || topN > 10) {
    throw new Error('Only the validated, unverified local Phase 1G evidence graph is permitted.');
  }
  const threshold = screening.screeningThresholdMetres;
  if (!Number.isFinite(threshold) || threshold < 100 || threshold > 1500) {
    throw new Error('Invalid screening threshold.');
  }
  const rows = graph.nodes.routes.map(r => {
    const da = distanceFn(origin, r.geometry.coordinates);
    const db = distanceFn(destination, r.geometry.coordinates);
    if (!Number.isFinite(da.distanceMetresApprox) || !Number.isFinite(db.distanceMetresApprox)) {
      throw new Error('Nonfinite GIS distance.');
    }
    return {
      gisObjectId: r.gisObjectId,
      routeNodeId: r.id,
      routeCode: r.routeCodeFromName,
      gisDescription: r.gisDescription ?? null,
      indexedCodeOverlapOnly: r.indexedCodeOverlapOnly === true,
      originProximityMetresApprox: da.distanceMetresApprox,
      destinationProximityMetresApprox: db.distanceMetresApprox,
      originNearestPolylinePoint: da.nearestPolylinePoint,
      destinationNearestPolylinePoint: db.nearestPolylinePoint,
      nearOrigin: da.distanceMetresApprox <= threshold,
      nearDestination: db.distanceMetresApprox <= threshold,
      gapToOriginThresholdMetresApprox: Math.max(0, Math.round(da.distanceMetresApprox - threshold)),
      gapToDestinationThresholdMetresApprox: Math.max(0, Math.round(db.distanceMetresApprox - threshold)),
      evidence: 'GIS-shape-proximity-only',
      passengerJourneyAvailable: false,
      boardingVerified: false,
      directionVerified: false,
    };
  });
  const byA = (x, y) => x.originProximityMetresApprox - y.originProximityMetresApprox || x.gisObjectId - y.gisObjectId;
  const byB = (x, y) => x.destinationProximityMetresApprox - y.destinationProximityMetresApprox || x.gisObjectId - y.gisObjectId;
  const byBoth = (x, y) =>
    Math.max(x.originProximityMetresApprox, x.destinationProximityMetresApprox) -
    Math.max(y.originProximityMetresApprox, y.destinationProximityMetresApprox) ||
    x.originProximityMetresApprox + x.destinationProximityMetresApprox -
    y.originProximityMetresApprox - y.destinationProximityMetresApprox || x.gisObjectId - y.gisObjectId;
  const nearestToOrigin = [...rows].sort(byA).slice(0, topN);
  const nearestToDestination = [...rows].sort(byB).slice(0, topN);
  const lowestJointProximityShapes = [...rows].sort(byBoth).slice(0, Math.min(3, topN));
  const aWithin = rows.filter(r => r.nearOrigin);
  const bWithin = rows.filter(r => r.nearDestination);
  const shared = screening.commonGeometryCandidates.length;
  let reasonCode;
  if (shared > 0) reasonCode = 'same-shape-proximity-detected';
  else if (aWithin.length === 0 && bWithin.length === 0) reasonCode = 'no-shapes-near-either-endpoint';
  else if (aWithin.length === 0) reasonCode = 'no-shapes-near-origin';
  else if (bWithin.length === 0) reasonCode = 'no-shapes-near-destination';
  else reasonCode = 'different-shapes-near-endpoints';

  // Co-proximity uses the SAME unpublished GIS stop POINT associated spatially
  // with two DIFFERENT route geometries. It does not establish an interchange.
  const coProximityWitnesses = [];
  const stopById = new Map(graph.nodes.stops.map(s => [s.id, s]));
  const stopsByRoute = new Map();
  if (!shared && aWithin.length && bWithin.length) {
    const aRoutes = [...aWithin].sort(byA).slice(0, 8);
    const bRoutes = [...bWithin].sort(byB).slice(0, 8);
    const candidateRouteIds = new Set([...aRoutes, ...bRoutes].map(r => r.routeNodeId));
    for (const edge of graph.edges.spatialSupport) {
      if (!candidateRouteIds.has(edge.routeNodeId)) continue;
      if (edge.kind !== 'spatial-support-only' || edge.traversableByPassenger !== false ||
          edge.confirmedBoarding !== false || edge.confirmedTransfer !== false) {
        throw new Error('Unexpected passenger-claim edge in spatial-only graph.');
      }
      if (!stopsByRoute.has(edge.routeNodeId)) stopsByRoute.set(edge.routeNodeId, new Map());
      stopsByRoute.get(edge.routeNodeId).set(edge.stopNodeId, edge.proximityMetresApprox);
    }
    for (const ar of aRoutes) {
      const aStops = stopsByRoute.get(ar.routeNodeId);
      if (!aStops) continue;
      for (const br of bRoutes) {
        if (ar.routeNodeId === br.routeNodeId) continue;
        const bStops = stopsByRoute.get(br.routeNodeId);
        if (!bStops) continue;
        for (const [stopId, da] of aStops) {
          const db = bStops.get(stopId);
          if (db === undefined) continue;
          const stop = stopById.get(stopId);
          if (!stop) throw new Error('Unresolved GIS stop evidence node.');
          coProximityWitnesses.push({
            originRouteCode: ar.routeCode, destinationRouteCode: br.routeCode,
            originRouteObjectId: ar.gisObjectId, destinationRouteObjectId: br.gisObjectId,
            stopGisObjectId: stop.gisObjectId, stopLocationDescription: stop.locationDescription,
            stopCoordinate: stop.coordinate,
            routeAToGisPointMetresApprox: da, routeBToGisPointMetresApprox: db,
            evidence: 'same-GIS-point-near-two-different-polylines-NOT-transfer',
            boardingVerified: false, routeMembershipVerified: false,
            transferVerified: false, traversableByPassenger: false,
          });
        }
      }
    }
    coProximityWitnesses.sort((x, y) =>
      (x.routeAToGisPointMetresApprox + x.routeBToGisPointMetresApprox) -
      (y.routeAToGisPointMetresApprox + y.routeBToGisPointMetresApprox) ||
      x.stopGisObjectId - y.stopGisObjectId);
  }
  return {
    kind: 'developer-only-endpoint-diagnostics',
    reasonCode,
    nearestToOrigin,
    nearestToDestination,
    lowestJointProximityShapes,
    endpointShapeCounts: { origin: aWithin.length, destination: bWithin.length, both: shared },
    coProximityWitnesses: coProximityWitnesses.slice(0, 10),
    coProximityIsExhaustive: false,
    screeningThresholdMetres: threshold,
    unverified: ['current service', 'travel direction', 'ordered stops', 'boarding', 'transfer', 'fare', 'timetable', 'reuse rights'],
    allDistancesAreApproximateStraightLineGeometryProximity: true,
    passengerRoutingEnabled: false,
    verifiedPassengerJourneys: [],
  };
}
