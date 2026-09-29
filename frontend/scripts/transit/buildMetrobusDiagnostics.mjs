/**
 * Phase 1H local-only diagnostics from Phase 1G graph. No network calls.
 * No changes to src/, public/, passenger route engine or build output.
 */
import { readFile, mkdir, writeFile, rename, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { distanceToPolylineMetres, screenMetrobusGeometry } from './buildMetrobusEvidenceGraph.mjs';
import { diagnoseMetrobusGeometry } from './metrobusDiagnosticsCore.mjs';

const base = path.resolve('.local-dev/metrobus/phase1g');
const out = path.resolve('.local-dev/metrobus/phase1h');
const safe = (condition, message) => { if (!condition) throw new Error(message); };
const validCoordinate = (lng, lat) =>
  Number.isFinite(lng) && Number.isFinite(lat) && lng >= 25 && lng <= 31 && lat >= -28.5 && lat <= -23.5;
const assert = (c, m) => { if (!c) throw new Error(m); };
const hash = content => createHash('sha256').update(content).digest('hex');
const writeAtomic = async (filename, content) => {
  await mkdir(path.dirname(filename), { recursive: true });
  const tmp = filename + '.' + process.pid + '.tmp';
  await writeFile(tmp, content, 'utf8');
  await rename(tmp, filename);
};
export function validatePhase1GForDiagnostics(g) {
  safe(g?.metadata?.distribution === 'local-dev-only' && g.metadata.licensingReviewRequired === true &&
    g.metadata.passengerRoutingEnabled === false && g.metadata.currentOperationVerified === false &&
    g.metadata.directionVerified === false && g.metadata.routeStopMembershipVerified === false &&
    g.metadata.boardingVerified === false && g.metadata.transfersVerified === false &&
    g.metadata.faresVerified === false && g.metadata.timetablesVerified === false,
    'Unsafe or missing Phase 1G local-only evidence policy.');
  safe(Array.isArray(g.nodes?.routes) && Array.isArray(g.nodes?.stops) &&
    Array.isArray(g.edges?.spatialSupport) &&
    Array.isArray(g.edges?.passengerTravel) && g.edges.passengerTravel.length === 0 &&
    Array.isArray(g.edges?.verifiedBoarding) && g.edges.verifiedBoarding.length === 0 &&
    Array.isArray(g.edges?.verifiedTransfers) && g.edges.verifiedTransfers.length === 0,
    'Graph must have zero passenger travel, boarding or transfer edges.');
  safe(g.nodes.routes.length === g.summary.routeNodes &&
    g.nodes.stops.length === g.summary.stopEvidenceNodes &&
    g.edges.spatialSupport.length === g.summary.spatialSupportEdges &&
    g.summary.verifiedPassengerTravelEdges === 0 &&
    g.summary.verifiedTransferEdges === 0 &&
    g.summary.verifiedBoardingEdges === 0 &&
    g.summary.enabledPassengerJourneys === 0,
    'Phase 1G graph summary mismatch or unsupported passenger edges.');
  return true;
}
export async function buildMetrobusDiagnostics({
  graphPath = path.join(base, 'metrobus-evidence-graph.json'),
  outputRoot = out,
  templatePath = fileURLToPath(new URL('./metrobusDiagnostics.template.html', import.meta.url)),
} = {}) {
  let raw;
  try { raw = await readFile(graphPath); }
  catch { throw new Error(`Phase 1G local graph not found at ${graphPath}. First run node scripts/transit/buildMetrobusEvidenceGraph.mjs`); }
  const graph = JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, ''));
  validatePhase1GForDiagnostics(graph);
  const template = await readFile(templatePath, 'utf8');
  for (const marker of ['__PULSE_METROBUS_EVIDENCE_GRAPH__', '__PULSE_METROBUS_SCREEN_CORE__']) {
    safe(template.includes(marker), `Template missing ${marker}`);
  }
  const embeddedGraph = JSON.stringify(graph).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const core = [
    `const assert = ${assert.toString()};`,
    `const validCoordinate = ${validCoordinate.toString()};`,
    distanceToPolylineMetres.toString(),
    screenMetrobusGeometry.toString(),
    diagnoseMetrobusGeometry.toString(),
  ].join('\n');
  const html = template.replace('__PULSE_METROBUS_EVIDENCE_GRAPH__', embeddedGraph)
    .replace('__PULSE_METROBUS_SCREEN_CORE__', core);
  safe(!html.includes('__PULSE_METROBUS_'), 'Unresolved template placeholders.');
  const qa = {
    generatedAt: new Date().toISOString(),
    inputSha256: hash(raw),
    source: 'existing validated Phase 1G local evidence graph',
    graphSummary: graph.summary,
    diagnostics: ['nearest shape to A', 'nearest shape to B', 'smallest joint geometry gap',
      'shared GIS point co-proximity witnesses (NEVER transfers)'],
    passengerRoutingEnabled: false,
    licenceReviewRequired: true,
    publicFilesModified: false,
    graphReadOnly: true,
    errors: [],
  };
  // Keep the generated report+HTML in a child of .local-dev only.
  safe(path.relative(path.resolve('.local-dev'), outputRoot).split(path.sep)[0] !== '..' &&
    outputRoot !== path.resolve('.local-dev'), 'Output must remain inside .local-dev.');
  const ignored = path.resolve('.local-dev/.gitignore');
  try { await access(ignored); }
  catch { await writeAtomic(ignored, '*\n!.gitignore\n'); }
  await writeAtomic(path.join(outputRoot, 'metrobus-diagnostics.html'), html);
  await writeAtomic(path.join(outputRoot, 'reports', 'qa.json'), JSON.stringify(qa, null, 2) + '\n');
  console.log('Metrobus Phase 1H LOCAL diagnostics ready.');
  console.log(`GIS route nodes: ${graph.summary.routeNodes}; GIS stop nodes: ${graph.summary.stopEvidenceNodes}`);
  console.log(`Spatial evidence edges: ${graph.summary.spatialSupportEdges}; verified passenger edges: 0`);
  console.log(`Viewer: ${path.join(outputRoot, 'metrobus-diagnostics.html')}`);
  console.log('No public planner files modified; current operation, direction, boarding, fares and reuse unverified.');
  return { graph, qa, html };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildMetrobusDiagnostics().catch(err => { console.error(`Phase 1H failed: ${err.message}`); process.exitCode = 1; });
}
