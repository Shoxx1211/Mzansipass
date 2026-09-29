import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(
  "src/data/transit/gauteng/reavaya"
);

const FILES = [
  "routes.json",
  "fares.json",
  "phase-1b-network.json",
  "gis-network.json",
  "gis-normalization-report.json",
];

const readJson = async (filename) => {
  const raw = await fs.readFile(
    filename,
    "utf8"
  );

  return JSON.parse(
    raw.replace(/^\uFEFF/, "")
  );
};

const describeValue = (
  value,
  depth = 0
) => {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }

  if (typeof value === "object") {
    const keys =
      Object.keys(value);

    return `Object{${keys.join(", ")}}`;
  }

  return `${typeof value}: ${String(value)}`;
};

const printObjectSummary = (
  obj,
  indent = "  "
) => {
  if (
    !obj ||
    typeof obj !== "object"
  ) {
    console.log(
      `${indent}${describeValue(obj)}`
    );

    return;
  }

  for (
    const [key, value] of
      Object.entries(obj)
  ) {
    console.log(
      `${indent}${key}: ${describeValue(value)}`
    );
  }
};

const printArraySample = (
  name,
  array
) => {
  if (!Array.isArray(array)) {
    return;
  }

  console.log("");
  console.log(
    `  SAMPLE: ${name}`
  );

  if (
    array.length === 0
  ) {
    console.log(
      "    [empty]"
    );

    return;
  }

  console.log(
    JSON.stringify(
      array[0],
      null,
      2
    )
      .split("\n")
      .map(
        (line) =>
          `    ${line}`
      )
      .join("\n")
  );
};

const inspectKnownArrays = (
  json
) => {
  const candidates = [
    "routes",
    "stations",
    "stops",
    "stopLists",
    "routeStops",
    "publishedStations",
    "phase1bRoutes",
    "fareBands",
    "bands",
  ];

  for (
    const candidate of
      candidates
  ) {
    if (
      Array.isArray(
        json[candidate]
      )
    ) {
      printArraySample(
        candidate,
        json[candidate]
      );
    }
  }

  for (
    const [key, value] of
      Object.entries(json)
  ) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      for (
        const [
          nestedKey,
          nestedValue,
        ] of
          Object.entries(value)
      ) {
        if (
          Array.isArray(
            nestedValue
          ) &&
          nestedValue.length > 0
        ) {
          printArraySample(
            `${key}.${nestedKey}`,
            nestedValue
          );
        }
      }
    }
  }
};

const main = async () => {
  console.log("");
  console.log(
    "================================================"
  );
  console.log(
    " Pulse Transit - Rea Vaya Normalized Data Inspector"
  );
  console.log(
    "================================================"
  );

  for (
    const filename of
      FILES
  ) {
    const fullPath =
      path.join(
        ROOT,
        filename
      );

    console.log("");
    console.log(
      "------------------------------------------------"
    );

    console.log(
      filename
    );

    console.log(
      "------------------------------------------------"
    );

    try {
      const json =
        await readJson(
          fullPath
        );

      printObjectSummary(
        json
      );

      inspectKnownArrays(
        json
      );
    }
    catch (error) {
      console.log(
        `  FAILED: ${error.message}`
      );
    }
  }

  console.log("");
  console.log(
    "================================================"
  );
  console.log(
    " Inspection complete"
  );
  console.log(
    "================================================"
  );
  console.log("");

  console.log(
    "No files were modified."
  );
};

main().catch(
  (error) => {
    console.error(
      error
    );

    process.exitCode = 1;
  }
);