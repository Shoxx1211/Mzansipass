/**
 * Import a separately licensed OpenStreetMap Overpass export into Pulse's
 * minibus-taxi facility evidence layer. This script does not fetch data or
 * turn mapped amenities into verified taxi journeys.
 *
 * Usage:
 *   node scripts/transit/importOsmTaxiFacilities.mjs \
 *     /path/to/overpass-export.json --accept-odbl
 *
 * Raw export example (download from a permitted Overpass endpoint, or other
 * OSM distribution; restrict to Gauteng and include way/relation centers):
 * [out:json][timeout:180];
 * (nwr["amenity"="taxi"](-27,27.1,-24.9,29.95);
 *  nwr["taxi_vehicle"](-27,27.1,-24.9,29.95););
 * out center tags;
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUTPUT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/data/transit/gauteng/taxi/osm-facilities.json",
);

/** Geographic screening box, not an administrative Gauteng boundary. */
const inGautengScreen = ({ lat, lon }) =>
  Number.isFinite(lat) && Number.isFinite(lon) &&
  lat >= -27 && lat <= -24.9 && lon >= 27.1 && lon <= 29.95;

const containsMinibusLabel = value =>
  /minibus|mini[ -]?bus|shared?[ -]?taxi|share[ -]?taxi|combi[ -]?taxi/i.test(value ?? "");

function classifyTaxiElement(tags) {
  if (!tags || typeof tags !== "object") return null;
  const amenityTaxi = tags.amenity === "taxi";
  const vehicle = `${tags.taxi_vehicle ?? ""} ${tags.share_taxi ?? ""}`;
  const minibusIndicated = containsMinibusLabel(vehicle) ||
    tags.minibus === "yes" || tags.share_taxi === "yes" ||
    (tags.route === "share_taxi" && tags.public_transport === "station") ||
    containsMinibusLabel(tags.name);
  // A generic taxi amenity is frequently a metered taxi stand, and is never
  // promoted to a confirmed minibus rank simply because it says "taxi".
  if (!amenityTaxi && !minibusIndicated) return null;
  if (/metered|cab|private/i.test(vehicle) && !minibusIndicated) return null;
  return minibusIndicated ? "minibus-indicated" : "taxi-type-unconfirmed";
}

export function normalizeOsmTaxiFacilities(payload, extractedAt) {
  if (!payload || !Array.isArray(payload.elements) ||
      payload.elements.length > 250000 || !Number.isFinite(Date.parse(extractedAt))) {
    throw new Error("Expected an Overpass JSON export and a valid extraction time.");
  }
  const deduped = new Map();
  for (const element of payload.elements) {
    if (!["node", "way", "relation"].includes(element?.type) ||
        !Number.isSafeInteger(element.id) || element.id <= 0) continue;
    const location = element.type === "node" ? element : element.center;
    if (!location || !inGautengScreen(location)) continue;
    const classification = classifyTaxiElement(element.tags);
    if (!classification) continue;
    const kind = { node: "n", way: "w", relation: "r" }[element.type];
    const key = `${kind}/${element.id}`;
    deduped.set(key, {
      id: key,
      name: String(element.tags.name ?? (classification === "minibus-indicated"
        ? "Unnamed mapped minibus taxi point"
        : "Unnamed mapped taxi stand")).trim().slice(0, 120),
      lat: location.lat,
      lng: location.lon,
      classification,
      osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    });
  }
  return {
    schemaVersion: 1,
    source: "OpenStreetMap",
    sourceUrl: "https://www.openstreetmap.org/copyright",
    licence: "ODbL-1.0",
    extractedAt,
    facilities: [...deduped.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

const calledAsScript = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (calledAsScript) {
  const inputPath = process.argv[2];
  if (!inputPath || !process.argv.includes("--accept-odbl")) {
    console.error("Usage: node scripts/transit/importOsmTaxiFacilities.mjs <overpass.json> --accept-odbl");
    process.exitCode = 1;
  } else {
    try {
      const payload = JSON.parse(await readFile(inputPath, "utf8"));
      const result = normalizeOsmTaxiFacilities(payload, new Date().toISOString());
      await writeFile(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`, "utf8");
      const minibusCandidates = result.facilities.filter(f =>
        f.classification === "minibus-indicated").length;
      console.log(`Imported ${result.facilities.length} mapped taxi amenities: ${minibusCandidates} minibus-indicated. Routes verified: 0.`);
      console.log("Source © OpenStreetMap contributors, ODbL; retain attribution and derived-data share-alike obligations.");
    } catch (error) {
      console.error(`Taxi rank import failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
