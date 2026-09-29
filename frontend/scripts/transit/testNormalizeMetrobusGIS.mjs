import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { normalizeMetrobusGIS } from './normalizeMetrobusGIS.mjs';

const temp = await mkdtemp(path.join(tmpdir(), 'pulse-metrobus-test-'));
async function save(relative, json) {
  const file = path.join(temp, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(json));
}
try {
  const layer = (id, geometryType, features) => ({
    source: { layerId: id, retrievedAt: '2026-09-22T16:00:00Z' },
    geometryType, spatialReference: { requestedWkid: 4326 },
    featureCount: features.length, features
  });
  await save('gis-raw/metrobus-routes-wgs84.json', layer(22, 'esriGeometryPolyline', [
    { attributes: { OBJECTID: 1, NAME: 'ROUTE 55', ROUTE_ID: 60, NAME_OF_RO: 'GANDHI SQUARE TO MEREDALE',
      'SHAPE.STLength()': 1234 }, geometry: { paths: [ [[27.900, -26.190], [27.910, -26.190]] ] } },
    { attributes: { OBJECTID: 2, NAME: 'ROUTE 63', ROUTE_ID: 63, NAME_OF_RO: 'PRITCHARD TO NEWLANDS' },
      geometry: { paths: [ [[28.000, -26.210], [28.010, -26.210]] ] } }
  ]));
  await save('gis-raw/metrobus-stops-wgs84.json', layer(52, 'esriGeometryPoint', [
    { attributes: { OBJECTID: 201, LOCATION: 'Near route 55', EXIF_DATET: 1326672000000,
      PHOTONAME: 'C:\\Users\\Someone\\Sensitive\\photo.JPG' }, geometry: { x: 27.905, y: -26.190 } },
    { attributes: { OBJECTID: 202, LOCATION: 'Near route 63' }, geometry: { x: 28.005, y: -26.210 } },
    { attributes: { OBJECTID: 203, LOCATION: 'Far from both' }, geometry: { x: 27.800, y: -26.500 } }
  ]));
  await save('gis-raw/metrobus-routes-metadata.json', { copyrightText: 'CoJ to decide' });
  await save('gis-raw/metrobus-stops-metadata.json', {});
  await save('gis-raw/sync-report.json', { layers: [ { layerId: 22, features: 2 }, { layerId: 52, features: 3 } ] });
  await save('partial-inventory/normalized/routes.json', { kind: 'partial-indexed-operator-route-excerpt',
    routes: [{ routeNumber: '55' }, { routeNumber: '63' }, { routeNumber: '421' }] });
  const { qa, outputRoot } = await normalizeMetrobusGIS({ inputRoot: temp });
  assert.equal(qa.routes.gisFeatures, 2);
  assert.equal(qa.routes.uniqueCodesExtractedFromNAME, 2);
  assert.equal(qa.routes.routeNameVersusRouteIdDisagreements.length, 1);
  assert.equal(qa.stops.validCoordinates, 3);
  assert.equal(qa.stops.recordsWithEXIFCaptureDate, 1);
  assert.equal(qa.partialInventoryReconciliation.labelCodeOverlap.length, 2);
  assert.deepEqual(qa.partialInventoryReconciliation.partialCodesWithoutGISNameMatch, ['421']);
  assert.equal(qa.spatialSupport.candidatePairs, 2);
  assert.equal(qa.spatialSupport.stopsNearAtLeastOneGISRouteFeature, 2);
  assert.equal(qa.policy.passengerRoutingEnabled, false);
  assert.equal(qa.errors.length, 0);
  const stopsOutput = JSON.stringify(JSON.parse(await readFile(path.join(outputRoot, 'stops.json'), 'utf8')));
  assert.ok(!stopsOutput.includes('Sensitive'), 'Photo paths must not leak into normalized outputs');
  const candidates = JSON.parse(await readFile(path.join(outputRoot, 'spatial-stop-route-candidates.json'), 'utf8'));
  assert.ok(candidates.candidates.every(c => !c.isPublishedStopMembership && !c.isPassengerTransfer));
  console.log('PASS: 13 synthetic Metrobus GIS assertions');
  console.log('PASS: source layer validation, operator-code mismatch detection, partial overlap, spatial-only policy and output privacy');
} finally {
  await rm(temp, { recursive: true, force: true });
}
