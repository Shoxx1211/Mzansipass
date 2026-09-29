import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function prepare(root = process.cwd()) {
  const appFile = path.join(root, 'src', 'app', 'App.tsx');
  const runtimeFile = path.join(root, 'src', 'data', 'transit', 'gauteng', 'metrobus', 'metrobus-planner-runtime.json');
  if (!fs.existsSync(appFile) || !fs.readFileSync(appFile, 'utf8').includes('MetrobusEvidencePanel') ||
      !fs.readFileSync(appFile, 'utf8').includes('import.meta.env.DEV')) {
    throw new Error('Phase 1I is not confirmed in App.tsx. Install/test Phase 1I first.');
  }
  if (!fs.existsSync(runtimeFile)) throw new Error('Missing local Metrobus planner runtime. Run buildMetrobusPlannerRuntime.mjs first.');
  const runtime = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
  for (const [key, value] of Object.entries({
    passengerRoutingEnabled: false,
    sourceRightsCleared: false,
    currentOperationVerified: false,
  })) {
    if (runtime[key] !== value) throw new Error(`Unexpected runtime ${key}; abort pilot.`);
  }
  if (!Array.isArray(runtime.routes) || runtime.routes.length === 0) throw new Error('No GIS routes in private runtime.');
  for (const route of runtime.routes) {
    if (!route.routeCode || route.geometry?.type !== 'MultiLineString' || !Array.isArray(route.geometry.coordinates) || !route.geometry.coordinates.length) {
      throw new Error(`Missing route identity or geometry: ${route.gisObjectId}`);
    }
  }
  const dir = path.join(root, '.local-dev', 'metrobus', 'phase1j');
  fs.mkdirSync(dir, { recursive: true });
  const report = {
    createdAt: new Date().toISOString(),
    source: runtime.source,
    sourceGeneratedAt: runtime.generatedAt,
    gisRouteCount: runtime.routes.length,
    operatingAssumption: 'provisional-active-for-internal-pilot',
    evidenceStatus: 'city-gis-geometry-only',
    publicLicenceConfirmed: false,
    verifiedBoardingEdges: 0,
    verifiedTransferEdges: 0,
    verifiedPassengerTravelEdges: 0,
    tripStartEnabled: false,
    scope: 'Vite development only; public planner unchanged',
  };
  const out = path.join(dir, 'pilot-report.json');
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  return { out, report };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const { out, report } = prepare();
  console.log('Metrobus provisional pilot prepared.');
  console.log('City GIS route shapes:', report.gisRouteCount);
  console.log('Operational assumption: PROVISIONAL / LOCAL ONLY');
  console.log('Public routing and trip starts: DISABLED');
  console.log('Report:', out);
}
