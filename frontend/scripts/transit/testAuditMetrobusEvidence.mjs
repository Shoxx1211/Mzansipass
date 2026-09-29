import assert from 'node:assert/strict';
import { buildMetrobusEvidenceAudit, runMetrobusEvidenceAudit } from './auditMetrobusEvidence.mjs';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const base = {
  gisObjectId: 1, gisName: 'ROUTE 55', routeCodeFromName: '55', rawRouteIdField: 60,
  routeIdDisagreesWithName: true, gisDescription: 'GANDHI SQUARE TO MEREDALE',
  gisOriginLabel: 'Gandhi Square', gisDestinationLabel: 'Meredale',
  gisPolylineLengthKm: 16, geometryPresent: true, passengerRoutingEnabled: false,
  currentServiceVerified: false, travelDirectionVerified: false, routeStopMembershipVerified: false,
  indexedInventory: {
    routeNumber: '55', routeLabel: 'Gandhi Square to Meredale',
    fromLabel: 'Gandhi Square', toLabel: 'Meredale', viaLabel: null,
    publishedDistanceKm: 17, sourcePageDownloaded: false,
  },
};
const row2 = { ...base, gisObjectId: 2, gisName: 'ROUTE 99', routeCodeFromName: '99',
  rawRouteIdField: 99, routeIdDisagreesWithName: false, indexedInventory: null };
const row3 = { ...base, gisObjectId: 3, gisName: 'ROUTE 42', routeCodeFromName: '42',
  rawRouteIdField: 42, routeIdDisagreesWithName: false,
  indexedInventory: { ...base.indexedInventory, routeNumber: '42', routeLabel: 'Area A to Area B' } };
const summary = {
  gisFeatureCount: 3,
  uniqueGisNameRouteCodes: 3,
  partialIndexedInventoryRoutes: 3,
  exactCodeOverlaps: 2,
  gisOnlyCodesRelativeToPartialExcerpt: 1,
  indexedOnlyCodesRelativeToGIS: 1,
  gisNameVersusRawRouteIdDisagreements: 1,
  gisFeaturesMissingParsedCode: 0,
  gisFeaturesMissingGeometry: 0,
};
const crosswalk = {
  metadata: { passengerRoutingEnabled: false, directionVerified: false,
    routeStopMembershipVerified: false, currentServiceVerified: false },
  summary,
  gisRoutes: [base, row2, row3],
  inventoryOnlyRoutes: [{routeNumber: '500', publishedRouteLabel: 'Town to District',
    fromLabel: 'Town', toLabel: 'District', viaLabel: null, publishedDistanceKm: 12,
    passengerRoutingEnabled: false, currentServiceVerified: false, geometryPresent: false}],
};
const qa = { errors: [], summary };
const check = (predicate, message) => assert.ok(predicate, message);
const out = buildMetrobusEvidenceAudit(crosswalk, qa, '2026-09-22T00:00:00.000Z');
check(out.qa.counts.gisFeatures === 3, 'GIS count');
check(out.qa.counts.inventoryRoutes === 3, 'inventory count');
check(out.qa.counts.exactCodeOverlapsForManualValidation === 2, 'exact overlap');
check(out.qa.counts.gisOnlyRelativeToIncompleteExcerpt === 1, 'GIS-only');
check(out.qa.counts.indexedOnlyRelativeToGIS === 1, 'indexed-only');
check(out.qa.counts.rawGisIdDisagreementsForInterpretation === 1, 'identifier conflicts');
check(out.outputs['exact-code-overlaps.csv'].includes('ROUTE 55'), '55 included');
check(!out.outputs['gis-only-relative-to-partial-excerpt.csv'].includes('ROUTE 55'), '55 excluded GIS-only');
check(out.outputs['gis-name-vs-route-id-review.csv'].includes('60'), 'raw id kept');
check(!Object.values(out.outputs).join('').includes('coordinates'), 'no coordinate geometry');
check(!Object.values(out.outputs).join('').includes('PHOTONAME'), 'no image/photofile');
check(out.qa.restrictions.passengerRoutingEnabled === false, 'routing gated');
assert.throws(() => buildMetrobusEvidenceAudit({...crosswalk, metadata: {...crosswalk.metadata, passengerRoutingEnabled: true}}, qa), /routing disabled/);
assert.throws(() => buildMetrobusEvidenceAudit({...crosswalk, summary: {...summary, gisFeatureCount: 4}}, qa), /QA summary mismatch/);
assert.throws(() => buildMetrobusEvidenceAudit({...crosswalk, gisRoutes: [base, base, row3]}, qa), /Duplicate GIS OBJECTID/);
assert.throws(() => buildMetrobusEvidenceAudit(crosswalk, {...qa, errors: ['upstream error']}), /QA has errors/);
const temp = await mkdtemp(path.join(tmpdir(), 'pulse-metrobus-1e-'));
try {
  await mkdir(path.join(temp, 'route-crosswalk/reports'), { recursive: true });
  await writeFile(path.join(temp, 'route-crosswalk/metrobus-route-crosswalk.json'), JSON.stringify(crosswalk));
  await writeFile(path.join(temp, 'route-crosswalk/reports/qa.json'), JSON.stringify(qa));
  const result = await runMetrobusEvidenceAudit(temp);
  const report = JSON.parse(await readFile(path.join(temp, 'source-review/reports/qa.json'), 'utf8'));
  check(report.counts.gisFeatures === 3, 'end-to-end QA output');
  check(report.inputSha256.crosswalk.length === 64, 'end-to-end source hash');
  const written = await readFile(path.join(temp, 'source-review/exact-code-overlaps.csv'), 'utf8');
  check(written.split('\r\n').filter(Boolean).length === 3, 'end-to-end CSV two matches plus header');
  check(result.restrictions.passengerRoutingEnabled === false, 'end-to-end routing disabled');
} finally {
  await rm(temp, { recursive: true, force: true });
}
console.log('PASS: 20 Metrobus Phase 1E synthetic + end-to-end assertions');
console.log('PASS: category reconciliation, raw-ID separation, disabled routing, QA guards and no geometry/photo exports');
