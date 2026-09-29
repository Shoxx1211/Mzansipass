/**
 * Pulse / Metrobus Phase 1G - PRIVATE offline A/B geometry diagnostic.
 * Requires Phase 1F .local-dev/metrobus/metrobus-dev-index.json.
 * Does not change passenger-facing React app or publish City GIS data.
 */
import path from 'node:path';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateMetrobusDevIndex } from './metrobusCoverageCore.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));

function embedJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
async function atomic(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = file + '.' + process.pid + '.tmp';
  await writeFile(tmp, content, 'utf8');
  await rename(tmp, file);
}

export async function buildMetrobusCoverageSandbox({
  inputPath = path.resolve('.local-dev/metrobus/metrobus-dev-index.json'),
  outDir = path.resolve('.local-dev/metrobus'),
  templatePath = path.join(HERE, 'metrobusCoverageSandbox.template.html'),
  corePath = path.join(HERE, 'metrobusCoverageCore.mjs'),
} = {}) {
  const raw = await readFile(inputPath);
  const devIndex = JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, ''));
  const summary = validateMetrobusDevIndex(devIndex);
  const tpl = await readFile(templatePath, 'utf8');
  const core = await readFile(corePath, 'utf8');
  for (const marker of ['__PULSE_METROBUS_DEV_INDEX__', '__PULSE_METROBUS_COVERAGE_CORE__']) {
    if (!tpl.includes(marker)) throw new Error(`Missing HTML marker: ${marker}`);
  }
  if (/\bimport\s/.test(core) || !core.includes('export function analyzeMetrobusGisCoverage(')) {
    throw new Error('Expected dependency-free coverage module.');
  }
  const browserCore = core.replace(/\bexport function /g, 'function ');
  const html = tpl
    .replace('__PULSE_METROBUS_COVERAGE_CORE__', browserCore)
    .replace('__PULSE_METROBUS_DEV_INDEX__', embedJson(devIndex));
  const outputFile = path.join(outDir, 'metrobus-coverage-sandbox.html');
  const reportFile = path.join(outDir, 'reports/phase1g-qa.json');
  const qa = {
    generatedAt: new Date().toISOString(),
    sourceIndexSha256: createHash('sha256').update(raw).digest('hex'),
    summary, errors: [],
    dataPolicy: {
      developmentOnly: true, publishingAllowed: false, licensingReviewRequired: true,
      currentOperationVerified: false, routeDirectionVerified: false,
      routeStopMembershipVerified: false, boardingVerified: false, transfersVerified: false,
      publishedJourneyEdges: 0, selectablePassengerJourneys: 0,
      queryMeaning: 'WGS84 point-to-City-GIS-polyline proximity only',
    },
  };
  await atomic(outputFile, html);
  await atomic(reportFile, JSON.stringify(qa, null, 2) + '\n');
  console.log('Metrobus Phase 1G: offline developer A/B GIS coverage sandbox ready.');
  for (const [key, value] of Object.entries(summary)) console.log(`${key}: ${value}`);
  console.log(`Open: ${outputFile}`);
  console.log('Private geometry inspection ONLY. No passenger journeys, fares, stop membership, ETA or routing enabled.');
  return { outputFile, reportFile, qa };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildMetrobusCoverageSandbox().catch(error => {
    console.error('Metrobus Phase 1G failed: ' + error.message);
    process.exitCode = 1;
  });
}
