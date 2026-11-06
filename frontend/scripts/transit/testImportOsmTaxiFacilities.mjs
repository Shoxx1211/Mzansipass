import assert from "node:assert/strict";
import { normalizeOsmTaxiFacilities } from "./importOsmTaxiFacilities.mjs";

const imported = normalizeOsmTaxiFacilities({ elements: [
  { type: "node", id: 1, lat: -26.2, lon: 28.04,
    tags: { amenity: "taxi", taxi_vehicle: "minibus", name: "Test minibus point" } },
  { type: "way", id: 2, center: { lat: -25.75, lon: 28.2 },
    tags: { amenity: "taxi", name: "Unconfirmed taxi rank" } },
  { type: "node", id: 3, lat: -26.18, lon: 28.1,
    tags: { amenity: "taxi", taxi_vehicle: "metered" } },
  { type: "node", id: 4, lat: -33.9, lon: 18.4,
    tags: { amenity: "taxi", name: "Outside Gauteng" } },
  { type: "node", id: 5, lat: -26.2, lon: 28.1,
    tags: { name: "Taxi rank on a building" } },
] }, "2026-11-06T00:00:00.000Z");

assert.equal(imported.facilities.length, 2);
assert.equal(imported.facilities[0].classification, "minibus-indicated");
assert.equal(imported.facilities[0].osmUrl, "https://www.openstreetmap.org/node/1");
assert.equal(imported.facilities[1].classification, "taxi-type-unconfirmed");
assert.equal(imported.licence, "ODbL-1.0");
assert.equal(imported.facilities.every(f => !("routes" in f || "fare" in f)), true);
console.log("OSM taxi import screening tests passed");
