import fs from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIR = path.resolve(
  "src/data/transit/gauteng/areyeng"
);

const BASE =
  "https://e-gis003.tshwane.gov.za/server/rest/services/Viewer/IdentifyServicesCombined/MapServer";

const SOURCES = {
  stops: `${BASE}/483/query`,
  routes: `${BASE}/484/query`,
};

const buildQueryUrl = (baseUrl) => {
  const url = new URL(baseUrl);

  url.searchParams.set("where", "1=1");
  url.searchParams.set("outFields", "*");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("f", "geojson");

  return url.toString();
};

const downloadGeoJson = async (name, endpoint) => {
  const url = buildQueryUrl(endpoint);

  console.log(`Fetching ${name}...`);

  const response = await fetch(url, {
    headers: {
      Accept: "application/geo+json, application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `${name} request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  if (
    !data ||
    data.type !== "FeatureCollection" ||
    !Array.isArray(data.features)
  ) {
    throw new Error(
      `${name} did not return a valid GeoJSON FeatureCollection`
    );
  }

  const outputPath = path.join(
    OUTPUT_DIR,
    `${name}.geojson`
  );

  await fs.writeFile(
    outputPath,
    JSON.stringify(data, null, 2),
    "utf8"
  );

  console.log(
    `Saved ${data.features.length} ${name} features → ${outputPath}`
  );

  return data.features.length;
};

const main = async () => {
  await fs.mkdir(OUTPUT_DIR, {
    recursive: true,
  });

  const stopCount = await downloadGeoJson(
    "stops",
    SOURCES.stops
  );

  const routeCount = await downloadGeoJson(
    "routes",
    SOURCES.routes
  );

  console.log("");
  console.log("A Re Yeng sync complete.");
  console.log(`Stops/stations: ${stopCount}`);
  console.log(`Route features: ${routeCount}`);
};

main().catch((error) => {
  console.error("");
  console.error("A Re Yeng sync failed:");
  console.error(error);

  process.exitCode = 1;
});