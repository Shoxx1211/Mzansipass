import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const candidates = [
  path.join(cwd, '.local-dev', 'metrobus', 'phase1g', 'metrobus-evidence-graph.json'),
  path.join(cwd, '.local-dev', 'metrobus', 'phase1h', 'metrobus-evidence-graph.json'),
];
const source = candidates.find(fs.existsSync);
if (!source) throw new Error('No local Metrobus Phase 1G graph found. Run buildMetrobusEvidenceGraph.mjs first.');
const graph = JSON.parse(fs.readFileSync(source, 'utf8'));
if (graph.metadata?.passengerRoutingEnabled !== false ||
    graph.metadata?.distribution !== 'local-dev-only') {
  throw new Error('Unexpected graph safety metadata; refusing to create Metrobus runtime.');
}
const routeNodes = graph.nodes?.routes ?? graph.routeNodes ?? graph.routes;
if (!Array.isArray(routeNodes) || routeNodes.length === 0) {
  throw new Error('No route nodes found in Phase 1G nodes.routes.');
}
const routes = routeNodes.map((r) => ({
  routeCode: String(r.routeCodeFromName ?? r.routeCode ?? r.code ?? ''),
  gisObjectId: Number(r.gisObjectId ?? r.objectId),
  rawRouteIdField: r.rawRouteIdField == null ? null : Number(r.rawRouteIdField),
  description: String(r.gisDescription ?? r.description ?? ''),
  originLabel: String(r.originLabel ?? ''),
  destinationLabel: String(r.destinationLabel ?? ''),
  indexedExcerptOverlap: r.indexedCodeOverlapOnly === true,
  geometry: r.geometry,
}));
for (const r of routes) {
  if (!r.routeCode || !Number.isFinite(r.gisObjectId) ||
      r.geometry?.type !== 'MultiLineString' || !Array.isArray(r.geometry.coordinates) ||
      !r.geometry.coordinates.length) {
    throw new Error(`Incomplete route node in local evidence graph: ${r.gisObjectId}`);
  }
}
if (Number.isFinite(graph.summary?.routeNodes) && graph.summary.routeNodes !== routes.length) {
  throw new Error('Route count does not match Phase 1G graph summary.');
}
const outDir = path.join(cwd, 'src', 'data', 'transit', 'gauteng', 'metrobus');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'metrobus-planner-runtime.json');
fs.writeFileSync(out, JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: 'Phase 1G local City GIS evidence graph',
  evidenceStatus: 'city-gis-geometry-only',
  passengerRoutingEnabled: false,
  sourceRightsCleared: false,
  currentOperationVerified: false,
  routeCount: routes.length,
  routes,
}, null, 2));
// Prevent accidental commit of locally fetched City GIS geometry.
const ignore = path.join(outDir, '.gitignore');
const existing = fs.existsSync(ignore) ? fs.readFileSync(ignore, 'utf8') : '';
if (!existing.split(/\r?\n/).includes('metrobus-planner-runtime.json')) {
  fs.appendFileSync(ignore, `${existing && !existing.endsWith('\n') ? '\n' : ''}metrobus-planner-runtime.json\n`);
}
console.log('Metrobus private developer runtime created:', out);
console.log('Route shapes:', routes.length, '| passenger routing: DISABLED | public reuse: NOT CLEARED');
