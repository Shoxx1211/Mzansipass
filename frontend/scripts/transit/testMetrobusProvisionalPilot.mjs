import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { prepare } from './prepareMetrobusProvisionalPilot.mjs';

const root = process.cwd();
const required = [
  'src/config/metrobusPilotPolicy.ts',
  'src/services/metrobusEvidenceEngine.ts',
  'src/features/planner/MetrobusEvidencePanel.tsx',
];
for (const file of required) assert.ok(fs.existsSync(path.join(root, file)), `Missing file: ${file}`);
const policy = fs.readFileSync(path.join(root, required[0]), 'utf8');
const engine = fs.readFileSync(path.join(root, required[1]), 'utf8');
const panel = fs.readFileSync(path.join(root, required[2]), 'utf8');
for (const fragment of ['developerOnly: true', 'enableTripStart: false', 'enableFareAndEta: false', 'enableTransferDirections: false']) {
  assert.ok(policy.includes(fragment), `Pilot policy lacks ${fragment}`);
}
for (const fragment of ['import.meta.env.DEV', 'runtime.sourceRightsCleared !== false',
  'runtime.currentOperationVerified !== false', 'selectable: false', 'passengerRoutingEnabled: false',
  '"assumed-for-internal-pilot"']) {
  assert.ok(engine.includes(fragment), `Evidence engine lacks ${fragment}`);
}
for (const fragment of ['Internal pilot', 'Provisional', 'GPS', 'Inspect route', 'No trip starts']) {
  assert.ok(panel.toLowerCase().includes(fragment.toLowerCase()), `Pilot panel lacks ${fragment}`);
}
assert.ok(!panel.includes('Start trip'), 'Pilot panel must not advertise trip start');
assert.ok(!panel.includes('Buy ticket'), 'Pilot panel must not advertise ticket sale');

// End-to-end fixture: valid phase1I app + private runtime produces private report.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-metrobus-1j-'));
try {
  const appPath = path.join(temp, 'src', 'app', 'App.tsx');
  const runtimePath = path.join(temp, 'src', 'data', 'transit', 'gauteng', 'metrobus', 'metrobus-planner-runtime.json');
  fs.mkdirSync(path.dirname(appPath), { recursive: true });
  fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
  fs.writeFileSync(appPath, 'import.meta.env.DEV && <MetrobusEvidencePanel />');
  fs.writeFileSync(runtimePath, JSON.stringify({
    source: 'fixture', generatedAt: '2026-09-22T00:00:00.000Z', passengerRoutingEnabled: false,
    sourceRightsCleared: false, currentOperationVerified: false,
    routes: [{routeCode:'55', gisObjectId:1, geometry:{type:'MultiLineString', coordinates:[[[28.0,-26.0],[28.1,-26.1]]]}}],
  }));
  let actual = prepare(temp);
  assert.equal(actual.report.gisRouteCount, 1);
  assert.equal(actual.report.verifiedPassengerTravelEdges, 0);
  assert.ok(fs.existsSync(actual.out));
  const fixture = JSON.parse(fs.readFileSync(runtimePath,'utf8'));
  fixture.sourceRightsCleared = true;
  fs.writeFileSync(runtimePath, JSON.stringify(fixture));
  assert.throws(() => prepare(temp), /Unexpected runtime/);
  console.log('PASS: policy, evidence invariants, pilot UI and safe fixture build');
  console.log('PASS: changed permission status fails closed; public routing/trip starts remain disabled');
} finally {
  fs.rmSync(temp, { recursive:true, force:true });
}
