/**
 * Pulse Transit / Johannesburg Metrobus: PARTIAL indexed excerpt bootstrap.
 * No network calls. No HTTPS/TLS bypass. No app routing integration.
 * Re-run ingestMetrobusInventory.mjs only when a genuine complete official
 * HTML snapshot becomes available over a valid HTTPS connection.
 */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const source = path.join(root, 'src/data/transit/gauteng/metrobus/sources/operator-indexed-excerpt.json');
const out = path.join(root, 'src/data/transit/gauteng/metrobus/partial-inventory');

const sha256 = (contents) => createHash('sha256').update(contents).digest('hex');

function verify(raw) {
  if (raw.retrieval !== 'search-indexed-operator-page-excerpt' || raw.completeness !== 'partial' || raw.sourcePageDownloaded !== false) {
    throw new Error('Source declaration must identify a partial search-index excerpt; refusing to upgrade source strength.');
  }
  if (!Array.isArray(raw.routes) || raw.routes.length < 10) {
    throw new Error('Indexed excerpt lacks a usable partial route list.');
  }
  const ids = new Set();
  for (const row of raw.routes) {
    if (!Array.isArray(row) || row.length !== 4) throw new Error('Invalid source row: ' + JSON.stringify(row));
    const [code, description, via, distance] = row;
    if (!/^\d{1,4}[A-Z]{0,2}$/.test(code) || ids.has(code)) throw new Error('Invalid or duplicate route code: ' + code);
    if (typeof description !== 'string' || !/\bto\b/i.test(description) || (via !== null && typeof via !== 'string')) throw new Error('Invalid route description: ' + code);
    if (!Number.isFinite(distance) || distance <= 0 || distance > 300) throw new Error('Invalid published route distance: ' + code);
    ids.add(code);
  }
  const route42 = raw.routes.find((row) => row[0] === '42');
  if (!route42 || route42[3] !== 12.2) throw new Error('Operator-indexed route 42 control failed.');
  return ids;
}

async function saveAtomic(target, obj) {
  await mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  await rename(tmp, target);
}

async function main() {
  const input = await readFile(source, 'utf8');
  const raw = JSON.parse(input);
  verify(raw);
  const asOf = new Date().toISOString();
  const routes = raw.routes.map(([code, description, via, distance], i) => {
    const endpoints = description.split(/\s+to\s+/i);
    return {
      routeNumber: code,
      publishedRouteLabel: description,
      fromLabel: endpoints[0]?.trim() || null,
      toLabel: endpoints.slice(1).join(' to ').trim() || null,
      viaLabel: via,
      publishedDistanceKm: distance,
      sourceRow: i + 1,
      sourceKind: raw.retrieval,
      sourcePageDownloaded: false,
      geometryStatus: 'missing',
      stopSequenceStatus: 'missing',
      operatingStatus: 'unverified',
      directionStatus: 'unverified',
      passengerTimeStatus: 'unverified',
      fareStatus: 'unverified',
    };
  });
  const inventory = {
    operator: raw.operator,
    kind: 'partial-indexed-operator-route-excerpt',
    sourceUrl: raw.sourceUrl,
    sourceObservedOn: raw.observedOn,
    importedAt: asOf,
    sourceSha256: sha256(input),
    completeness: 'partial',
    originalOperatorHtmlDownloaded: false,
    usableForPassengerRouting: false,
    limitations: [
      'Indexed search excerpt, not the full verified live official route table.',
      'Route listing is not evidence of currently operating service.',
      'No validated stop points, ordered stop sequences, directions, route geometry, timetable or current fare.',
      'Published distance is operator-listing distance, never used as passenger origin-to-destination leg distance.',
    ],
    routes,
  };
  const qa = {
    auditedAt: asOf,
    routeRowsParsed: routes.length,
    uniqueRouteNumbers: new Set(routes.map((r) => r.routeNumber)).size,
    partialExcerpt: true,
    completeOperatorSnapshot: false,
    geographyAvailable: false,
    stopGeometryAvailable: false,
    operatorTimetableValidated: false,
    currentFareValidated: false,
    passengerRoutingEnabled: false,
    sourceSha256: inventory.sourceSha256,
    conclusion: 'Partial indexed inventory only; excluded from the live journey engine.',
  };
  await saveAtomic(path.join(out, 'normalized/routes.json'), inventory);
  await saveAtomic(path.join(out, 'reports/qa.json'), qa);
  console.log(`Metrobus indexed partial inventory: ${routes.length} route entries`);
  console.log(`Unique route numbers: ${qa.uniqueRouteNumbers}`);
  console.log('Source: search-indexed official-page excerpt (NO verified downloaded HTML)');
  console.log('Geometry: MISSING | Stops: MISSING | Timetable: UNVERIFIED | Fares: UNVERIFIED');
  console.log('Passenger routing: DISABLED');
  console.log('Output: ' + out);
}
main().catch((error) => { console.error('Metrobus partial bootstrap failed: ' + error.message); process.exitCode = 1; });
