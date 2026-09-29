/**
 * Pulse Transit — Metrobus (Johannesburg) Phase 1A.
 * Source: https://mbus.joburg.org.za/info_routes.aspx
 *
 * Produces SOURCE-AUDITABLE ROUTE INVENTORY ONLY.
 * Never infers geometry, stops, directions, passenger travel times or fares.
 * No npm packages required; Node 20+.
 *
 * node scripts/transit/ingestMetrobusInventory.mjs
 * node scripts/transit/ingestMetrobusInventory.mjs --html path/to/downloaded.html
 */

import { createHash } from 'node:crypto';
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://mbus.joburg.org.za/info_routes.aspx';
const DEFAULT_OUTPUT = 'src/data/transit/gauteng/metrobus/operator-inventory';

const normalizeSpace = (value) => value.replace(/\s+/g, ' ').trim();

const HTML_ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  rsquo: '’', lsquo: '‘', ndash: '–', mdash: '—', hellip: '…',
};

export function decodeHtml(value) {
  return value.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi, (full, entity) => {
    const token = entity.toLowerCase();
    if (token.startsWith('#')) {
      const hex = token.startsWith('#x');
      const value = Number.parseInt(token.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!Number.isFinite(value) || value < 1 || value > 0x10ffff) return full;
      try { return String.fromCodePoint(value); } catch { return full; }
    }
    return HTML_ENTITIES[token] ?? full;
  });
}

function plainText(value) {
  return normalizeSpace(decodeHtml(
    value
      .replace(/<br\s*\/?\s*>/gi, ' ')
      .replace(/<\/(?:p|div|span)>/gi, ' ')
      .replace(/<[^>]*>/g, ' '),
  ));
}

/** One row; locations are labels from operator text, never geocoded. */
function parseRouteRow(cells, sourceRow) {
  if (cells.length < 4) return null;
  const [routeNumberRaw, publishedRouteLabel, viaLabel, distanceRaw] = cells;
  const routeNumber = normalizeSpace(routeNumberRaw).toUpperCase();
  if (!/^\d{1,4}[A-Z]{0,2}$/.test(routeNumber)) return null;
  if (!publishedRouteLabel || !/\bto\b/i.test(publishedRouteLabel)) return null;

  const distanceMatch = distanceRaw.match(/\b(\d+(?:[.,]\d+)?)\s*(?:km|kms|kilomet(?:re|er)s?)\b/i);
  if (!distanceMatch) return null;
  const publishedDistanceKm = Number(distanceMatch[1].replace(',', '.'));
  if (!Number.isFinite(publishedDistanceKm) || publishedDistanceKm <= 0 || publishedDistanceKm > 500) return null;

  const minutesMatch = distanceRaw.match(/[-–]\s*(\d+(?:[.,]\d+)?)\s*min(?:ute)?s?\b/i);
  const publishedMinutesText = minutesMatch ? `${minutesMatch[1]} minutes` : null;
  const split = publishedRouteLabel.split(/\s+to\s+/i);
  const fromLabel = split.length >= 2 ? normalizeSpace(split[0]) : null;
  const toLabel = split.length >= 2 ? normalizeSpace(split.slice(1).join(' to ')) : null;

  return {
    routeNumber,
    publishedRouteLabel,
    fromLabel,
    toLabel,
    viaLabel: viaLabel || null,
    publishedDistanceKm,
    publishedDistanceRaw: distanceRaw,
    publishedMinutesText,
    sourceRow,
    geometryStatus: 'missing',
    stopSequenceStatus: 'missing',
    operatingStatus: 'unverified',
    directionStatus: 'unverified',
    passengerTimeStatus: 'unverified',
    fareStatus: 'unverified',
  };
}

export function parseOfficialMetrobusInventory(html, { minRows = 50 } = {}) {
  if (typeof html !== 'string' || html.length < 500) {
    throw new Error('Downloaded HTML was unexpectedly small; no route data was published.');
  }
  if (!/(?:metro\s*bus|city of johannesburg)/i.test(plainText(html.slice(0, 200000)))) {
    throw new Error('Official Johannesburg Metrobus page signature was not present.');
  }

  const rows = [];
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)) {
    const cells = [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]\s*>/gi)]
      .map((cell) => plainText(cell[1]));
    rows.push({ index: match.index ?? 0, cells });
  }

  const header = rows.find((row) => {
    const joined = row.cells.join(' ').toUpperCase();
    return joined.includes('ROUTE NUMBER') && joined.includes('ROUTE') && joined.includes('VIA') && joined.includes('DISTANCE');
  });
  if (!header) {
    throw new Error('Expected ROUTE NUMBER / ROUTE / VIA / DISTANCE table header is missing. Site structure may have changed.');
  }

  // Stop at the close of the table containing the route header. Other site
  // tables (links, footer, navigation) are deliberately outside our scope.
  const tableClose = html.toLowerCase().indexOf('</table', header.index);
  const relevant = rows.filter((row) => row.index > header.index && (tableClose < 0 || row.index < tableClose));
  const routes = relevant.map((row, i) => parseRouteRow(row.cells, i + 1)).filter(Boolean);
  if (routes.length < minRows) {
    throw new Error(`Parsed only ${routes.length} route rows; required at least ${minRows}. Refusing to publish an incomplete inventory.`);
  }

  const seen = new Map();
  const duplicates = [];
  for (const route of routes) {
    const previous = seen.get(route.routeNumber);
    if (previous) duplicates.push({ routeNumber: route.routeNumber, first: previous, second: route.publishedRouteLabel });
    else seen.set(route.routeNumber, route.publishedRouteLabel);
  }
  if (duplicates.length) {
    throw new Error(`Duplicate route numbers require manual review: ${JSON.stringify(duplicates)}`);
  }

  // The site's minute values are *not* a validated timetable. Record apparent
  // outliers for source QA without silently editing or using them as ETA.
  const publishedTimeWarnings = [];
  for (const route of routes) {
    if (!route.publishedMinutesText) continue;
    const minutes = Number(route.publishedMinutesText.replace(' minutes', '').replace(',', '.'));
    if (minutes > 0 && route.publishedDistanceKm / (minutes / 60) > 90) {
      publishedTimeWarnings.push({
        routeNumber: route.routeNumber,
        publishedDistanceKm: route.publishedDistanceKm,
        publishedMinutesText: route.publishedMinutesText,
        impliedAverageSpeedKmh: Math.round(route.publishedDistanceKm / (minutes / 60)),
        action: 'Do not use as passenger ETA without independently verified schedule.',
      });
    }
  }

  return {
    routes,
    quality: {
      routeRowsParsed: routes.length,
      uniqueRouteNumbers: seen.size,
      missingViaLabels: routes.filter((r) => !r.viaLabel).length,
      missingPublishedMinutes: routes.filter((r) => !r.publishedMinutesText).length,
      publishedTimeWarnings,
      geographyAvailable: false,
      stopGeometryAvailable: false,
      operatorTimetableValidated: false,
      currentFareValidated: false,
      passengerRoutingEnabled: false,
      conclusion: 'Inventory only; operator route names and published distances, not a routable stop graph.',
    },
  };
}

async function atomicJson(filepath, data) {
  await mkdir(path.dirname(filepath), { recursive: true });
  const staging = `${filepath}.tmp-${process.pid}`;
  await writeFile(staging, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await rename(staging, filepath);
}

async function loadOfficialHtml(htmlFile) {
  if (htmlFile) return { html: await readFile(htmlFile, 'utf8'), retrieval: 'user-supplied-html' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(SOURCE_URL, {
      signal: controller.signal,
      headers: { 'User-Agent': 'PulseTransit-SourceAudit/1.0 (+manual QA; no commercial transit feed)' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    if (html.length > 12_000_000) throw new Error('Unexpectedly large HTML; refusing ingestion');
    return { html, retrieval: 'https-fetch' };
  } finally {
    clearTimeout(timeout);
  }
}

function argumentValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  if (!process.argv[index + 1] || process.argv[index + 1].startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return process.argv[index + 1];
}

async function main() {
  const output = path.resolve(argumentValue('--output') ?? DEFAULT_OUTPUT);
  const localHtml = argumentValue('--html');
  const downloadedAt = new Date().toISOString();
  const { html, retrieval } = await loadOfficialHtml(localHtml);
  const sha256 = createHash('sha256').update(html).digest('hex');
  const snapshotName = `route-page-${downloadedAt.replace(/[:.]/g, '-')}.html`;
  const rawFile = path.join(output, 'raw', snapshotName);
  await mkdir(path.dirname(rawFile), { recursive: true });
  await writeFile(rawFile, html, 'utf8');

  let parsed;
  try {
    parsed = parseOfficialMetrobusInventory(html);
  } catch (error) {
    throw new Error(`${error.message}\nRaw snapshot retained for audit: ${rawFile}`);
  }

  const source = {
    operator: 'City of Johannesburg Metrobus',
    sourceUrl: SOURCE_URL,
    retrievedAt: downloadedAt,
    retrieval,
    rawSnapshot: path.relative(output, rawFile).replaceAll('\\', '/'),
    rawSha256: sha256,
    sourceScope: 'Published route number, text description, via text, distance and unvalidated time text.',
    excludedScope: ['actual stop positions', 'route geometry', 'direction', 'stop order', 'current operating status', 'current fares', 'journey ETA', 'live service'],
  };
  const inventory = {
    operator: source.operator,
    kind: 'official-published-route-inventory',
    asOf: downloadedAt,
    sourceUrl: SOURCE_URL,
    sourceSha256: sha256,
    usableForPassengerRouting: false,
    routes: parsed.routes,
  };
  await atomicJson(path.join(output, 'normalized', 'routes.json'), inventory);
  await atomicJson(path.join(output, 'reports', 'qa.json'), {
    auditedAt: downloadedAt,
    sourceUrl: SOURCE_URL,
    sourceSha256: sha256,
    ...parsed.quality,
  });
  await atomicJson(path.join(output, 'source-manifest.json'), source);

  console.log(`Metrobus official route inventory: ${parsed.quality.routeRowsParsed} routes`);
  console.log(`QA: ${parsed.quality.publishedTimeWarnings.length} published-time anomalies to review`);
  console.log('Geometry: MISSING | Stops: MISSING | Timetable: UNVERIFIED | Fares: UNVERIFIED');
  console.log('Passenger routing: DISABLED');
  console.log(`Output: ${output}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`Metrobus ingestion failed: ${error.message}`);
    console.error('For TLS/network trouble, download the official page using Windows curl.exe then rerun with --html.');
    process.exitCode = 1;
  });
}
