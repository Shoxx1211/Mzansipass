import fs from 'node:fs';
import path from 'node:path';
const required = [
  'src/services/metrobusEvidenceEngine.ts',
  'src/features/planner/MetrobusEvidencePanel.tsx',
  'scripts/transit/buildMetrobusPlannerRuntime.mjs',
  'scripts/transit/installMetrobusPlannerIntegration.mjs',
];
for (const file of required) {
  if (!fs.existsSync(path.resolve(file))) throw new Error(`Missing ${file}`);
}
const engine = fs.readFileSync('src/services/metrobusEvidenceEngine.ts', 'utf8');
const builder = fs.readFileSync('scripts/transit/buildMetrobusPlannerRuntime.mjs', 'utf8');
const installer = fs.readFileSync('scripts/transit/installMetrobusPlannerIntegration.mjs', 'utf8');
for (const invariant of ['selectable: false', 'passengerRoutingEnabled: false',
  'import.meta.env.DEV', 'await import(']) {
  if (!engine.includes(invariant)) throw new Error(`Missing engine safety invariant: ${invariant}`);
}
if (!builder.includes('graph.nodes?.routes') || !builder.includes('indexedCodeOverlapOnly')) {
  throw new Error('Builder must read the actual Phase 1G evidence graph schema.');
}
if (!installer.includes('import.meta.env.DEV') || !installer.includes('await MetrobusEvidenceEngine.screenJourney')) {
  throw new Error('Metrobus panel must remain developer-only.');
}
console.log('PASS: Phase 1I files, actual Phase 1G schema, and developer-only checks');
