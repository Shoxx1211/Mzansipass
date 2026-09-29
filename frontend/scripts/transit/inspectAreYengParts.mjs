import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(
  "src/data/transit/gauteng/areyeng"
);

const ROUTES_FILE = path.join(
  ROOT,
  "normalized-routes.json"
);

const EARTH_RADIUS_M = 6_371_000;

const toRadians = (degrees) =>
  (degrees * Math.PI) / 180;

const haversineMeters = (
  lat1,
  lng1,
  lat2,
  lng2
) => {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return (
    EARTH_RADIUS_M *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
};

const getParts = (geometry) => {
  if (geometry?.type !== "MultiLineString") {
    return [];
  }

  return geometry.coordinates ?? [];
};

const getEndpoint = (part, which) => {
  if (!Array.isArray(part) || part.length === 0) {
    return null;
  }

  const coordinate =
    which === "start"
      ? part[0]
      : part[part.length - 1];

  if (
    !Array.isArray(coordinate) ||
    coordinate.length < 2
  ) {
    return null;
  }

  return {
    lng: Number(coordinate[0]),
    lat: Number(coordinate[1]),
  };
};

const distanceBetween = (a, b) => {
  if (!a || !b) return null;

  return haversineMeters(
    a.lat,
    a.lng,
    b.lat,
    b.lng
  );
};

const main = async () => {
  const raw = await fs.readFile(
    ROUTES_FILE,
    "utf8"
  );

  const routes = JSON.parse(raw);

  const multipartRoutes =
    routes.filter(
      (route) =>
        route.geometry?.type ===
        "MultiLineString"
    );

  console.log("");
  console.log(
    "================================================"
  );
  console.log(
    " Pulse Transit - A Re Yeng Part Connectivity"
  );
  console.log(
    "================================================"
  );

  for (const route of multipartRoutes) {
    const parts =
      getParts(route.geometry);

    console.log("");
    console.log(
      `${route.code} — ${route.name}`
    );

    console.log(
      `Parts: ${parts.length}`
    );

    const connections = [];

    for (
      let aIndex = 0;
      aIndex < parts.length;
      aIndex += 1
    ) {
      for (
        let bIndex = aIndex + 1;
        bIndex < parts.length;
        bIndex += 1
      ) {
        const aStart =
          getEndpoint(
            parts[aIndex],
            "start"
          );

        const aEnd =
          getEndpoint(
            parts[aIndex],
            "end"
          );

        const bStart =
          getEndpoint(
            parts[bIndex],
            "start"
          );

        const bEnd =
          getEndpoint(
            parts[bIndex],
            "end"
          );

        const possibilities = [
          {
            connection: "end -> start",
            distanceM:
              distanceBetween(
                aEnd,
                bStart
              ),
          },
          {
            connection: "end -> end",
            distanceM:
              distanceBetween(
                aEnd,
                bEnd
              ),
          },
          {
            connection: "start -> start",
            distanceM:
              distanceBetween(
                aStart,
                bStart
              ),
          },
          {
            connection: "start -> end",
            distanceM:
              distanceBetween(
                aStart,
                bEnd
              ),
          },
        ].filter(
          (candidate) =>
            candidate.distanceM !== null
        );

        possibilities.sort(
          (x, y) =>
            x.distanceM -
            y.distanceM
        );

        const closest =
          possibilities[0];

        connections.push({
          partA: aIndex,
          partB: bIndex,
          connection:
            closest.connection,
          distanceM:
            Math.round(
              closest.distanceM
            ),
        });
      }
    }

    connections.sort(
      (a, b) =>
        a.distanceM -
        b.distanceM
    );

    for (const result of connections) {
      const marker =
        result.distanceM <= 25
          ? "CONNECTED"
          : result.distanceM <= 75
            ? "NEAR"
            : result.distanceM <= 200
              ? "POSSIBLE"
              : "";

      console.log(
        `  Part ${result.partA} <-> Part ${result.partB}` +
        ` | ${String(result.distanceM).padStart(5)} m` +
        ` | ${result.connection.padEnd(14)}` +
        ` ${marker}`
      );
    }
  }

  console.log("");
};

main().catch((error) => {
  console.error("");
  console.error(
    "Part inspection failed:"
  );
  console.error(error);
  process.exitCode = 1;
});