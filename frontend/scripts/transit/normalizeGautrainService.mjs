import fs from "node:fs/promises";
import path from "node:path";

// ============================================================
// Pulse Transit - Gautrain Service Normalizer
//
// OUTPUT
//   src/data/transit/gauteng/gautrain/service.json
//   src/data/transit/gauteng/gautrain/service-normalization-report.json
//
// This file records only service rules explicitly published
// by Gautrain.
//
// It DOES NOT create:
// - exact departure times
// - realtime arrivals
// - route-specific bus schedules
// - inferred train travel times
// ============================================================

const ROOT = path.resolve(
  "src/data/transit/gauteng/gautrain"
);

const RAIL_LINES_FILE = path.join(
  ROOT,
  "rail-lines.json"
);

const BUS_ROUTES_FILE = path.join(
  ROOT,
  "bus-routes.json"
);

const OUTPUT_FILE = path.join(
  ROOT,
  "service.json"
);

const REPORT_FILE = path.join(
  ROOT,
  "service-normalization-report.json"
);

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const readJson = async (filename) => {
  const raw = await fs.readFile(
    filename,
    "utf8"
  );

  if (!raw.trim()) {
    throw new Error(
      `${filename} is empty`
    );
  }

  return JSON.parse(
    raw.replace(/^\uFEFF/, "")
  );
};

const minutesBetween = (
  start,
  end
) => {
  const [startH, startM] =
    start.split(":").map(Number);

  const [endH, endM] =
    end.split(":").map(Number);

  return (
    endH * 60 +
    endM -
    (startH * 60 + startM)
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
    " Pulse Transit - Gautrain Service Normalizer"
  );
  console.log(
    "================================================"
  );

  const railLines =
    await readJson(
      RAIL_LINES_FILE
    );

  const busRoutes =
    await readJson(
      BUS_ROUTES_FILE
    );

  // ----------------------------------------------------------
  // Verified published service facts
  // ----------------------------------------------------------

  const service = {
    schemaVersion: 1,

    operatorId: "gautrain",

    retrievedAt: "2026-09-17",

    sources: [
      {
        authority: "Gautrain",
        title:
          "General Information",
        url:
          "https://www.gautrain.co.za/commuter/generalinformation",
        sourceType:
          "official-web-page",
        confidence:
          "official",
      },
      {
        authority: "Gautrain",
        title:
          "Fares / Trip Planning Information",
        url:
          "https://www.gautrain.co.za/commuter/farecalc",
        sourceType:
          "official-web-page",
        confidence:
          "official",
      },
    ],

    publishedNetworkWindow: {
      start: "05:30",
      end: "20:30",

      appliesTo:
        [
          "train",
          "bus",
        ],

      interpretation:
        "published overall Gautrain operating window",

      routeSpecificGuarantee:
        false,

      note:
        "This does not mean every train service or feeder bus route has departures continuously throughout the full window.",
    },

    rail: {
      weekday: {
        peak: {
          headwayMinutes: 10,

          periods: [
            "06:00-08:30",
            "15:00-18:30",
          ],

          sourceMeaning:
            "Gautrain states trains depart at 10-minute intervals during peak periods.",
        },

        offPeak: {
          headwayMinutes: 20,

          periods: [
            "05:30-06:00",
            "08:30-15:00",
            "18:30-20:30",
          ],

          sourceMeaning:
            "Gautrain states trains depart at 20-minute intervals during off-peak periods.",
        },
      },

      weekendAndPublicHoliday: {
        appliesExplicitlyToServiceIds: [
          "gautrain-north-south",
          "gautrain-east-west",
        ],

        periods: [
          {
            start: "05:30",
            end: "09:00",
            headwayMinutes: 30,
          },
          {
            start: "09:00",
            end: "16:00",
            headwayMinutes: 20,
          },
          {
            start: "16:00",
            end: "20:30",
            headwayMinutes: 30,
          },
        ],

        airportServiceFrequency:
          "not-normalized-from-this-source",

        note:
          "The published weekend/public-holiday frequency wording specifically names the North-South and East-West lines. No Airport Service weekend frequency is inferred.",
      },

      exactDepartureTimesAvailable:
        false,

      realtimeAvailableInDataset:
        false,

      timetableStatus:
        "frequency-rules-only",
    },

    feederBus: {
      routeInventoryCount:
        busRoutes.routeCount,

      busRouteCount:
        busRoutes.busRouteCount,

      midibusRouteCount:
        busRoutes.midibusRouteCount,

      publishedNetworkWindow: {
        start: "05:30",
        end: "20:30",
      },

      weekendAvailability: {
        status:
          "limited",

        routeSpecificScheduleKnown:
          false,

        note:
          "Gautrain warns that bus services are limited over weekends. Pulse must check a route-specific schedule before presenting weekend availability as confirmed.",
      },

      routeSpecificSchedulesNormalized:
        false,

      stopSequencesNormalized:
        false,

      stopCoordinatesNormalized:
        false,

      liveVehicleLocationsAvailableInDataset:
        false,
    },

    appRules: [
      "Do not convert published headways into an exact departure time unless a verified timetable or live departure source is available.",
      "Do not claim that every Gautrain feeder bus operates for the entire 05:30-20:30 network window.",
      "Do not claim weekend availability for an individual feeder route unless route-specific service has been verified.",
      "Use 10-minute weekday peak and 20-minute weekday off-peak train headways as published frequency information, not as live countdowns.",
      "Use the published weekend/public-holiday frequency pattern only for the North-South and East-West services unless additional official evidence supports the Airport Service.",
      "Do not generate a rail ETA merely from frequency information.",
    ],
  };

  // ----------------------------------------------------------
  // QA
  // ----------------------------------------------------------

  const errors = [];
  const warnings = [];

  if (
    railLines.operatorId !==
    "gautrain"
  ) {
    errors.push(
      "rail-lines.json does not identify Gautrain."
    );
  }

  if (
    busRoutes.operatorId !==
    "gautrain"
  ) {
    errors.push(
      "bus-routes.json does not identify Gautrain."
    );
  }

  if (
    busRoutes.routeCount !== 45
  ) {
    warnings.push(
      `Current normalized feeder inventory contains ${busRoutes.routeCount} routes instead of the 45-route September 2026 source snapshot.`
    );
  }

  const serviceIds =
    new Set(
      (
        railLines.services ??
        []
      ).map(
        (service) =>
          service.id
      )
    );

  for (
    const id of
      service.rail
        .weekendAndPublicHoliday
        .appliesExplicitlyToServiceIds
  ) {
    if (
      !serviceIds.has(id)
    ) {
      errors.push(
        `Weekend frequency references missing rail service: ${id}`
      );
    }
  }

  const weekdayPeakHeadway =
    service.rail.weekday
      .peak
      .headwayMinutes;

  const weekdayOffPeakHeadway =
    service.rail.weekday
      .offPeak
      .headwayMinutes;

  if (
    weekdayPeakHeadway !== 10
  ) {
    errors.push(
      "Published weekday peak headway should be 10 minutes."
    );
  }

  if (
    weekdayOffPeakHeadway !== 20
  ) {
    errors.push(
      "Published weekday off-peak headway should be 20 minutes."
    );
  }

  const operatingWindowMinutes =
    minutesBetween(
      service
        .publishedNetworkWindow
        .start,
      service
        .publishedNetworkWindow
        .end
    );

  if (
    operatingWindowMinutes !==
    900
  ) {
    errors.push(
      `Unexpected overall service window length: ${operatingWindowMinutes} minutes.`
    );
  }

  const weekendPeriods =
    service.rail
      .weekendAndPublicHoliday
      .periods;

  for (
    let i = 1;
    i <
    weekendPeriods.length;
    i += 1
  ) {
    if (
      weekendPeriods[i - 1].end !==
      weekendPeriods[i].start
    ) {
      errors.push(
        "Weekend/public-holiday frequency periods are not contiguous."
      );
    }
  }

  if (
    weekendPeriods[0].start !==
      "05:30" ||
    weekendPeriods[
      weekendPeriods.length - 1
    ].end !==
      "20:30"
  ) {
    errors.push(
      "Weekend frequency periods do not span the published service window."
    );
  }

  // ----------------------------------------------------------
  // Report
  // ----------------------------------------------------------

  const report = {
    generatedAt:
      new Date().toISOString(),

    operatorId:
      "gautrain",

    serviceWindow: {
      start: "05:30",
      end: "20:30",
    },

    weekdayRail: {
      peakHeadwayMinutes:
        10,

      offPeakHeadwayMinutes:
        20,
    },

    weekendRail: {
      explicitlyCoveredServices: [
        "gautrain-north-south",
        "gautrain-east-west",
      ],

      morningHeadwayMinutes:
        30,

      daytimeHeadwayMinutes:
        20,

      eveningHeadwayMinutes:
        30,

      airportFrequencyInferred:
        false,
    },

    feederNetwork: {
      routeCount:
        busRoutes.routeCount,

      busCount:
        busRoutes.busRouteCount,

      midibusCount:
        busRoutes.midibusRouteCount,

      routeSpecificSchedules:
        false,

      weekendAvailability:
        "limited-and-route-specific",
    },

    exactDepartureTimesStored:
      false,

    liveArrivalDataStored:
      false,

    errors,

    warnings,

    qaPassed:
      errors.length === 0,
  };

  // ----------------------------------------------------------
  // Write
  // ----------------------------------------------------------

  await fs.writeFile(
    OUTPUT_FILE,
    JSON.stringify(
      service,
      null,
      2
    ),
    "utf8"
  );

  await fs.writeFile(
    REPORT_FILE,
    JSON.stringify(
      report,
      null,
      2
    ),
    "utf8"
  );

  // ----------------------------------------------------------
  // Console
  // ----------------------------------------------------------

  console.log("");
  console.log(
    "Service normalization complete."
  );

  console.log("");
  console.log(
    "Published network window: 05:30-20:30"
  );

  console.log(
    "Weekday peak rail headway: 10 min"
  );

  console.log(
    "Weekday off-peak rail headway: 20 min"
  );

  console.log(
    "Weekend/public holiday rail:"
  );

  console.log(
    "  05:30-09:00 -> 30 min"
  );

  console.log(
    "  09:00-16:00 -> 20 min"
  );

  console.log(
    "  16:00-20:30 -> 30 min"
  );

  console.log("");
  console.log(
    `Feeder routes referenced: ${busRoutes.routeCount}`
  );

  console.log(
    `QA errors: ${errors.length}`
  );

  console.log(
    `Warnings: ${warnings.length}`
  );

  if (
    warnings.length
  ) {
    console.log("");

    for (
      const warning of
        warnings
    ) {
      console.log(
        `WARNING: ${warning}`
      );
    }
  }

  console.log("");
  console.log(
    "Created:"
  );

  console.log(
    `  ${OUTPUT_FILE}`
  );

  console.log(
    `  ${REPORT_FILE}`
  );

  console.log("");

  console.log(
    "Important: no exact departures, live arrivals, route-specific weekend bus availability or ETA were inferred."
  );

  if (
    errors.length
  ) {
    console.log("");

    for (
      const error of
        errors
    ) {
      console.error(
        `ERROR: ${error}`
      );
    }

    throw new Error(
      "Gautrain service QA failed."
    );
  }
};

main().catch(
  (error) => {
    console.error("");
    console.error(
      "Gautrain service normalization failed:"
    );
    console.error(error);
    process.exitCode = 1;
  }
);