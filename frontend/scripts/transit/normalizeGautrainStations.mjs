import fs from "node:fs/promises";
import path from "node:path";

// ============================================================
// Pulse Transit - Gautrain Station Normalizer
//
// Reads official station HTML snapshots downloaded by:
//   syncGautrainCore.ps1
//
// Extracts:
// - station name
// - official GPS coordinates
//
// Converts:
//   S:26°11.732', E:28°02.493'
// to:
//   decimal latitude / longitude
//
// OUTPUT
//   src/data/transit/gauteng/gautrain/stations.json
//   src/data/transit/gauteng/gautrain/
//       station-normalization-report.json
//
// No coordinates are guessed.
// ============================================================

const ROOT = path.resolve(
  "src/data/transit/gauteng/gautrain"
);

const RAW_DIR = path.join(
  ROOT,
  "raw"
);

const STATIONS_OUTPUT = path.join(
  ROOT,
  "stations.json"
);

const REPORT_OUTPUT = path.join(
  ROOT,
  "station-normalization-report.json"
);

// ------------------------------------------------------------
// Official station source files
// ------------------------------------------------------------

const STATION_SOURCES = [
  {
    id: "park",
    name: "Park",
    file: "station-park.html",
    sourceUrl:
      "https://www.gautrain.co.za/commuter/stationinfo?stationName=Park",
  },
  {
    id: "rosebank",
    name: "Rosebank",
    file: "station-rosebank.html",
    sourceUrl:
      "https://www.gautrain.co.za/commuter/stationinfo?stationName=Rosebank",
  },
  {
    id: "sandton",
    name: "Sandton",
    file: "station-sandton.html",
    sourceUrl:
      "https://www.gautrain.co.za/commuter/stationinfo?stationName=Sandton",
  },
  {
    id: "marlboro",
    name: "Marlboro",
    file: "station-marlboro.html",
    sourceUrl:
      "https://www.gautrain.co.za/commuter/stationinfo?stationName=Marlboro",
  },
  {
    id: "midrand",
    name: "Midrand",
    file: "station-midrand.html",
    sourceUrl:
      "https://www.gautrain.co.za/commuter/stationinfo?stationName=Midrand",
  },
  {
    id: "centurion",
    name: "Centurion",
    file: "station-centurion.html",
    sourceUrl:
      "https://www.gautrain.co.za/commuter/stationinfo?stationName=Centurion",
  },
  {
    id: "pretoria",
    name: "Pretoria",
    file: "station-pretoria.html",
    sourceUrl:
      "https://www.gautrain.co.za/commuter/stationinfo?stationName=Pretoria",
  },
  {
    id: "hatfield",
    name: "Hatfield",
    file: "station-hatfield.html",
    sourceUrl:
      "https://www.gautrain.co.za/commuter/stationinfo?stationName=Hatfield",
  },
  {
    id: "rhodesfield",
    name: "Rhodesfield",
    file: "station-rhodesfield.html",
    sourceUrl:
      "https://www.gautrain.co.za/commuter/stationinfo?stationName=Rhodesfield",
  },
  {
    id: "or-tambo",
    name: "OR Tambo",
    file: "station-or-tambo.html",
    sourceUrl:
      "https://www.gautrain.co.za/commuter/stationinfo?stationName=OR%20Tambo",
  },
];

// ------------------------------------------------------------
// HTML helpers
// ------------------------------------------------------------

const decodeHtml = (text) => {
  if (!text) {
    return "";
  }

  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&deg;/gi, "°")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&rsquo;/gi, "’")
    .replace(/&lsquo;/gi, "‘")
    .replace(/&prime;/gi, "′")
    .replace(
      /&#(\d+);/g,
      (_, value) =>
        String.fromCodePoint(
          Number(value)
        )
    )
    .replace(
      /&#x([0-9a-f]+);/gi,
      (_, value) =>
        String.fromCodePoint(
          Number.parseInt(
            value,
            16
          )
        )
    );
};

const stripHtml = (html) => {
  return decodeHtml(
    html
      .replace(
        /<script\b[^>]*>[\s\S]*?<\/script>/gi,
        " "
      )
      .replace(
        /<style\b[^>]*>[\s\S]*?<\/style>/gi,
        " "
      )
      .replace(
        /<!--[\s\S]*?-->/g,
        " "
      )
      .replace(
        /<br\s*\/?>/gi,
        " "
      )
      .replace(
        /<\/(?:p|div|h1|h2|h3|h4|h5|li|section)>/gi,
        " "
      )
      .replace(
        /<[^>]+>/g,
        " "
      )
  )
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeText = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// ------------------------------------------------------------
// Heading extraction
// ------------------------------------------------------------

const extractHeadings = (html) => {
  const headings = [];

  const regex =
    /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi;

  let match;

  while (
    (match = regex.exec(html)) !== null
  ) {
    const heading =
      stripHtml(
        match[1]
      );

    if (heading) {
      headings.push(
        heading
      );
    }
  }

  return headings;
};

// ------------------------------------------------------------
// GPS extraction
//
// Handles both:
//
// S:26°11.732'
// S:25°51,097'
//
// Some Gautrain pages use decimal commas.
// ------------------------------------------------------------

const extractGps = (text) => {
  const regex =
    /GPS\s*S\s*:\s*(\d{1,2})\s*°\s*(\d{1,2}(?:[.,]\d+)?)\s*['’′]?\s*,?\s*E\s*:\s*(\d{1,3})\s*°\s*(\d{1,2}(?:[.,]\d+)?)\s*['’′]?/i;

  const match =
    text.match(regex);

  if (!match) {
    return null;
  }

  const latDegrees =
    Number(match[1]);

  const latMinutes =
    Number(
      match[2].replace(
        ",",
        "."
      )
    );

  const lngDegrees =
    Number(match[3]);

  const lngMinutes =
    Number(
      match[4].replace(
        ",",
        "."
      )
    );

  if (
    !Number.isFinite(latDegrees) ||
    !Number.isFinite(latMinutes) ||
    !Number.isFinite(lngDegrees) ||
    !Number.isFinite(lngMinutes)
  ) {
    return null;
  }

  if (
    latMinutes < 0 ||
    latMinutes >= 60 ||
    lngMinutes < 0 ||
    lngMinutes >= 60
  ) {
    return null;
  }

  const latitude =
    -(
      latDegrees +
      latMinutes / 60
    );

  const longitude =
    lngDegrees +
    lngMinutes / 60;

  return {
    raw:
      match[0],

    sourceFormat: {
      latitude: {
        hemisphere: "S",
        degrees:
          latDegrees,
        minutes:
          latMinutes,
      },

      longitude: {
        hemisphere: "E",
        degrees:
          lngDegrees,
        minutes:
          lngMinutes,
      },
    },

    decimal: {
      latitude:
        Number(
          latitude.toFixed(7)
        ),

      longitude:
        Number(
          longitude.toFixed(7)
        ),
    },
  };
};

// ------------------------------------------------------------
// Gauteng sanity bounds
//
// These are QA bounds only.
// They are NOT transit catchment polygons.
// ------------------------------------------------------------

const isPlausibleGautengCoordinate = (
  latitude,
  longitude
) => {
  return (
    latitude >= -27.0 &&
    latitude <= -25.0 &&
    longitude >= 27.0 &&
    longitude <= 29.5
  );
};

// ------------------------------------------------------------
// Normalize one station
// ------------------------------------------------------------

const normalizeStation = async (
  source
) => {
  const filename =
    path.join(
      RAW_DIR,
      source.file
    );

  const html =
    await fs.readFile(
      filename,
      "utf8"
    );

  if (!html.trim()) {
    throw new Error(
      `${source.file} is empty`
    );
  }

  const text =
    stripHtml(html);

  const headings =
    extractHeadings(html);

  const expectedName =
    normalizeText(
      source.name
    );

  const matchingHeading =
    headings.find(
      (heading) =>
        normalizeText(
          heading
        ) === expectedName
    ) ?? null;

  const gps =
    extractGps(text);

  if (!gps) {
    throw new Error(
      `No Gautrain GPS coordinate found in ${source.file}`
    );
  }

  if (
    !isPlausibleGautengCoordinate(
      gps.decimal.latitude,
      gps.decimal.longitude
    )
  ) {
    throw new Error(
      `Coordinate for ${source.name} falls outside Gauteng QA bounds: ` +
      `${gps.decimal.latitude}, ${gps.decimal.longitude}`
    );
  }

  return {
    id:
      `gautrain-station-${source.id}`,

    operatorId:
      "gautrain",

    name:
      source.name,

    type:
      "rail-station",

    modes: [
      "rail",
    ],

    location: {
      lat:
        gps.decimal.latitude,

      lng:
        gps.decimal.longitude,
    },

    coordinateSource: {
      authority:
        "Gautrain",

      sourceType:
        "official-station-page",

      sourceFile:
        source.file,

      sourceUrl:
        source.sourceUrl,

      rawGps:
        gps.raw,

      sourceFormat:
        gps.sourceFormat,

      conversionMethod:
        "degrees-decimal-minutes-to-decimal-degrees",

      confidence:
        "official",
    },

    sourceValidation: {
      expectedStationName:
        source.name,

      h1Headings:
        headings,

      expectedHeadingFound:
        Boolean(
          matchingHeading
        ),
    },
  };
};

// ------------------------------------------------------------
// Duplicate-coordinate QA
// ------------------------------------------------------------

const findCoordinateDuplicates = (
  stations
) => {
  const map =
    new Map();

  for (const station of stations) {
    const key =
      `${station.location.lat},${station.location.lng}`;

    if (!map.has(key)) {
      map.set(
        key,
        []
      );
    }

    map.get(key).push(
      station.name
    );
  }

  return [...map.entries()]
    .filter(
      ([, names]) =>
        names.length > 1
    )
    .map(
      ([coordinate, names]) => ({
        coordinate,
        stations:
          names,
      })
    );
};

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

const main = async () => {
  console.log("");
  console.log(
    "================================================"
  );

  console.log(
    " Pulse Transit - Gautrain Station Normalizer"
  );

  console.log(
    "================================================"
  );

  console.log("");

  const stations = [];

  const failures = [];

  for (
    const source of
      STATION_SOURCES
  ) {
    try {
      const station =
        await normalizeStation(
          source
        );

      stations.push(
        station
      );

      console.log(
        `${station.name.padEnd(12)} ` +
        `${station.location.lat.toFixed(6)}, ` +
        `${station.location.lng.toFixed(6)}`
      );
    } catch (error) {
      failures.push({
        station:
          source.name,

        file:
          source.file,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      });

      console.log(
        `FAILED: ${source.name}`
      );
    }
  }

  const headingMismatches =
    stations
      .filter(
        (station) =>
          !station
            .sourceValidation
            .expectedHeadingFound
      )
      .map(
        (station) => ({
          station:
            station.name,

          headings:
            station
              .sourceValidation
              .h1Headings,
        })
      );

  const coordinateDuplicates =
    findCoordinateDuplicates(
      stations
    );

  const report = {
    generatedAt:
      new Date().toISOString(),

    operatorId:
      "gautrain",

    expectedStationCount:
      STATION_SOURCES.length,

    normalizedStationCount:
      stations.length,

    failedStationCount:
      failures.length,

    failures,

    headingMismatchCount:
      headingMismatches.length,

    headingMismatches,

    duplicateCoordinateCount:
      coordinateDuplicates.length,

    duplicateCoordinates:
      coordinateDuplicates,

    coordinateMethod:
      "Official Gautrain GPS DDM values converted to decimal degrees",

    gpsPolygonsInferred:
      false,

    routeGeometryInferred:
      false,

    notes: [
      "Station coordinates come from official Gautrain station pages.",
      "South latitudes are stored as negative decimal degrees.",
      "East longitudes are stored as positive decimal degrees.",
      "Decimal commas in source GPS values are normalized before conversion.",
      "No train route geometry, timetable or live data is inferred by this normalizer."
    ],
  };

  await fs.writeFile(
    REPORT_OUTPUT,
    JSON.stringify(
      report,
      null,
      2
    ),
    "utf8"
  );

  if (
    failures.length > 0
  ) {
    console.log("");
    console.log(
      "Normalization stopped because one or more station pages failed."
    );

    console.log("");
    console.log(
      `Report written to: ${REPORT_OUTPUT}`
    );

    console.log("");

    for (
      const failure of
        failures
    ) {
      console.log(
        `- ${failure.station}: ${failure.error}`
      );
    }

    process.exitCode = 1;
    return;
  }

  await fs.writeFile(
    STATIONS_OUTPUT,
    JSON.stringify(
      {
        schemaVersion: 1,

        operatorId:
          "gautrain",

        sourceAuthority:
          "Gautrain",

        stationCount:
          stations.length,

        stations,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("");
  console.log(
    "Normalization complete."
  );

  console.log(
    `Stations normalized: ${report.normalizedStationCount}`
  );

  console.log(
    `Heading mismatches: ${report.headingMismatchCount}`
  );

  console.log(
    `Duplicate coordinates: ${report.duplicateCoordinateCount}`
  );

  console.log("");
  console.log(
    "Created:"
  );

  console.log(
    `  ${STATIONS_OUTPUT}`
  );

  console.log(
    `  ${REPORT_OUTPUT}`
  );

  console.log("");
  console.log(
    "Important: no train route geometry, timetable or live data were inferred."
  );

  console.log("");
};

main().catch(
  (error) => {
    console.error("");
    console.error(
      "Gautrain station normalization failed:"
    );

    console.error(
      error
    );

    process.exitCode = 1;
  }
);