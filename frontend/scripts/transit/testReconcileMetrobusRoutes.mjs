import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildMetrobusCrosswalk, runMetrobusCrosswalk } from './reconcileMetrobusRoutes.mjs';

const gisDoc = {
  metadata: { source: 'CoJ GIS / Transportation / layer 22', passengerRoutingEnabled: false },
  routes: [
    { gisObjectId: 1, gisName: 'ROUTE 55', routeCodeFromName: '55', rawRouteIdField: 60,
      routeIdDisagreesWithName: true, gisDescription: 'Sample', segmentCount: 2,
      geometry: { type: 'MultiLineString', coordinates: [[[28.1, -26.1],[28.2,-26.2]]] },
      gisPolylineLengthKm: 16.4 },
    { gisObjectId: 2, gisName: 'ROUTE 63', routeCodeFromName: '63', rawRouteIdField: 63,
      routeIdDisagreesWithName: false, segmentCount: 2, geometry: { type: 'MultiLineString', coordinates: [[[28.1,-26.1],[28.2,-26.2]]] } },
  ],
};
const inventoryDoc = {
  kind: 'partial-indexed-operator-route-excerpt', completeness: 'partial',
  usableForPassengerRouting: false,
  routes: [
    { routeNumber: '55', publishedRouteLabel: 'A to B', publishedDistanceKm: 9.5,
      sourceKind: 'search-indexed-operator-page-excerpt', sourcePageDownloaded: false },
    { routeNumber: '42', publishedRouteLabel: 'Braamfontein to Elands Park', publishedDistanceKm: 12.2,
      sourceKind: 'search-indexed-operator-page-excerpt', sourcePageDownloaded: false },
  ],
};
let n = 0;
const ok = (condition, description) => { assert.ok(condition, description); n++; };
const {crosswalk, qa} = buildMetrobusCrosswalk(gisDoc, inventoryDoc);
ok(crosswalk.summary.gisFeatureCount === 2, 'two GIS routes');
ok(crosswalk.summary.partialIndexedInventoryRoutes === 2, 'two indexed routes');
ok(crosswalk.summary.exactCodeOverlaps === 1, 'one exact code overlap');
ok(crosswalk.summary.indexedOnlyCodesRelativeToGIS === 1, 'one indexed-only code');
ok(crosswalk.summary.gisOnlyCodesRelativeToPartialExcerpt === 1, 'one GIS-only code');
ok(crosswalk.summary.gisNameVersusRawRouteIdDisagreements === 1, 'one raw ID disagreement');
ok(crosswalk.gisRoutes[0].routeCodeFromName === '55' && crosswalk.gisRoutes[0].rawRouteIdField === 60,
  'preserves NAME-derived code and raw ROUTE_ID separately');
ok(crosswalk.gisRoutes[0].indexedInventory.codeExactMatchOnly === true &&
   crosswalk.gisRoutes[0].geometryEquivalenceToIndexedListingVerified === false,
  'exact code match does not verify geometry');
ok(crosswalk.inventoryOnlyRoutes[0].routeNumber === '42', 'retains indexed-only record');
ok(qa.sourceAndSafetyChecks.passengerRoutingEnabled === false, 'passenger routing disabled');
ok(!JSON.stringify(crosswalk).includes('coordinates'), 'geometry not copied to crosswalk');
ok(!JSON.stringify(crosswalk).includes('PHOTONAME'), 'no stop-photo filenames copied');
const duplicate = structuredClone(inventoryDoc);
duplicate.routes[1].routeNumber = '55';
assert.throws(() => buildMetrobusCrosswalk(gisDoc, duplicate), /Duplicate/); n++;
const unsafe = structuredClone(inventoryDoc);
unsafe.usableForPassengerRouting = true;
assert.throws(() => buildMetrobusCrosswalk(gisDoc, unsafe), /disabled/); n++;

const root = await mkdtemp(path.join(os.tmpdir(), 'pulse-metrobus-1d-'));
try {
  const files = [
    ['gis-normalized/routes.json', gisDoc],
    ['partial-inventory/normalized/routes.json', inventoryDoc],
    ['gis-normalized/reports/qa.json', {
      routes: { gisFeatures: 2 }, partialInventoryReconciliation: { labelCodeOverlap: ['55'] }, errors: [] }],
    ['partial-inventory/reports/qa.json', { routeRowsParsed: 2 }],
  ];
  for (const [name, content] of files) {
    const file = path.join(root, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(content));
  }
  const out = await runMetrobusCrosswalk(root);
  const saved = JSON.parse(await readFile(path.join(out.output, 'metrobus-route-crosswalk.json'), 'utf8'));
  ok(saved.gisRoutes.length === 2 && saved.inventoryOnlyRoutes.length === 1,
    'end-to-end JSON output saved');
  ok(saved.metadata.passengerRoutingEnabled === false, 'saved output preserves safety policy');
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log(`PASS: ${n} Metrobus Phase 1D synthetic assertions`);
console.log('PASS: crosswalk structure, identifier separation, partial overlap, zero geometry export and disabled passenger routing');
