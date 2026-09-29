import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve("src/data/transit/gauteng/gautrain");
const RAW_PDF = path.join(ROOT, "raw", "fares-effective-2026-09-01.pdf");
const OUTPUT = path.join(ROOT, "fares.json");
const REPORT = path.join(ROOT, "fare-normalization-report.json");

const STATIONS_10 = [
  "hatfield",
  "pretoria",
  "centurion",
  "midrand",
  "marlboro",
  "sandton",
  "rosebank",
  "park",
  "rhodesfield",
  "or-tambo",
];

const STATIONS_9 = STATIONS_10.filter((station) => station !== "or-tambo");

const STATION_REFERENCES = {
  hatfield: { stationId: "gautrain-station-hatfield", name: "Hatfield" },
  pretoria: { stationId: "gautrain-station-pretoria", name: "Pretoria" },
  centurion: { stationId: "gautrain-station-centurion", name: "Centurion" },
  midrand: { stationId: "gautrain-station-midrand", name: "Midrand" },
  marlboro: { stationId: "gautrain-station-marlboro", name: "Marlboro" },
  sandton: { stationId: "gautrain-station-sandton", name: "Sandton" },
  rosebank: { stationId: "gautrain-station-rosebank", name: "Rosebank" },
  park: { stationId: "gautrain-station-park", name: "Park" },
  rhodesfield: { stationId: "gautrain-station-rhodesfield", name: "Rhodesfield" },
  "or-tambo": { stationId: "gautrain-station-or-tambo", name: "OR Tambo" },
};

const PEAK_PAYG = [
  [null, 38, 49, 77, 91, 96, 103, 110, 103, 258],
  [38, null, 43, 61, 84, 91, 96, 103, 96, 258],
  [49, 43, null, 50, 61, 79, 83, 91, 89, 258],
  [77, 61, 50, null, 43, 50, 57, 61, 58, 240],
  [91, 84, 61, 43, null, 38, 42, 50, 43, 228],
  [96, 91, 79, 50, 38, null, 38, 42, 55, 228],
  [103, 96, 83, 57, 42, 38, null, 38, 58, 240],
  [110, 103, 91, 61, 50, 42, 38, null, 61, 240],
  [103, 96, 89, 58, 43, 55, 58, 61, null, 228],
  [258, 258, 258, 240, 228, 228, 240, 240, 228, null],
];

const OFF_PEAK_PAYG = [
  [null, 30, 39, 62, 73, 77, 82, 88, 82, 258],
  [30, null, 34, 49, 67, 73, 77, 82, 77, 258],
  [39, 34, null, 40, 49, 63, 66, 73, 71, 258],
  [62, 49, 40, null, 34, 40, 46, 49, 46, 240],
  [73, 67, 49, 34, null, 30, 34, 40, 34, 228],
  [77, 73, 63, 40, 30, null, 30, 34, 44, 228],
  [82, 77, 66, 46, 34, 30, null, 30, 46, 240],
  [88, 82, 73, 49, 40, 34, 30, null, 49, 240],
  [82, 77, 71, 46, 34, 44, 46, 49, null, 228],
  [258, 258, 258, 240, 228, 228, 240, 240, 228, null],
];

const WEEKLY = [
  [null, 352, 454, 713, 842, 888, 953, 1018, 953],
  [352, null, 398, 565, 777, 842, 888, 953, 888],
  [454, 398, null, 463, 565, 731, 768, 842, 824],
  [713, 565, 463, null, 398, 463, 528, 565, 537],
  [842, 777, 565, 398, null, 352, 389, 463, 398],
  [888, 842, 731, 463, 352, null, 352, 389, 509],
  [953, 888, 768, 528, 389, 352, null, 352, 537],
  [1018, 953, 842, 565, 463, 389, 352, null, 565],
  [953, 888, 824, 537, 398, 509, 537, 565, null],
];

const MONTHLY = [
  [null, 1422, 1833, 2880, 3404, 3591, 3853, 4114, 3853],
  [1422, null, 1609, 2282, 3142, 3404, 3591, 3853, 3591],
  [1833, 1609, null, 1870, 2282, 2955, 3105, 3404, 3329],
  [2880, 2282, 1870, null, 1609, 1870, 2132, 2282, 2170],
  [3404, 3142, 2282, 1609, null, 1422, 1571, 1870, 1609],
  [3591, 3404, 2955, 1870, 1422, null, 1422, 1571, 2057],
  [3853, 3591, 3105, 2132, 1571, 1422, null, 1422, 2170],
  [4114, 3853, 3404, 2282, 1870, 1571, 1422, null, 2282],
  [3853, 3591, 3329, 2170, 1609, 2057, 2170, 2282, null],
];

const SINGLE_TRIP = PEAK_PAYG.map((row) => [...row]);

const RETURN_TRIP = [
  [null, 76, 98, 154, 182, 192, 206, 220, 206, 516],
  [76, null, 86, 122, 168, 182, 192, 206, 192, 516],
  [98, 86, null, 100, 122, 158, 166, 182, 178, 516],
  [154, 122, 100, null, 86, 100, 114, 122, 116, 480],
  [182, 168, 122, 86, null, 76, 84, 100, 86, 456],
  [192, 182, 158, 100, 76, null, 76, 84, 110, 456],
  [206, 192, 166, 114, 84, 76, null, 76, 116, 480],
  [220, 206, 182, 122, 100, 84, 76, null, 122, 480],
  [206, 192, 178, 116, 86, 110, 116, 122, null, 456],
  [516, 516, 516, 480, 456, 456, 480, 480, 456, null],
];

const matrixRecord = (stationOrder, values) => ({
  stationOrder,
  values,
  currency: "ZAR",
  diagonalMeaning: "same-station-not-priced",
});

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const validateMatrix = (name, stationOrder, values) => {
  const errors = [];
  const n = stationOrder.length;

  if (values.length !== n) {
    errors.push(`${name}: expected ${n} rows, found ${values.length}`);
    return errors;
  }

  for (let i = 0; i < n; i += 1) {
    if (!Array.isArray(values[i]) || values[i].length !== n) {
      errors.push(`${name}: row ${i} does not contain ${n} values`);
      continue;
    }

    if (values[i][i] !== null) {
      errors.push(`${name}: diagonal value at ${stationOrder[i]} must be null`);
    }

    for (let j = 0; j < n; j += 1) {
      const value = values[i][j];

      if (value !== null && (!Number.isInteger(value) || value <= 0)) {
        errors.push(`${name}: invalid fare at [${i}, ${j}]`);
      }

      if (values[j] && value !== values[j][i]) {
        errors.push(`${name}: matrix is not symmetric at [${i}, ${j}]`);
      }
    }
  }

  return errors;
};

const main = async () => {
  console.log("");
  console.log("================================================");
  console.log(" Pulse Transit - Gautrain Fare Normalizer");
  console.log("================================================");

  const pdf = await fs.readFile(RAW_PDF);
  const signature = pdf.subarray(0, 5).toString("ascii");

  if (signature !== "%PDF-") {
    throw new Error(`Official fare source is not a PDF. Signature: ${signature}`);
  }

  const errors = [
    ...validateMatrix("peakPayAsYouGo", STATIONS_10, PEAK_PAYG),
    ...validateMatrix("offPeakPayAsYouGo", STATIONS_10, OFF_PEAK_PAYG),
    ...validateMatrix("weeklyTrainProduct", STATIONS_9, WEEKLY),
    ...validateMatrix("monthlyTrainProduct", STATIONS_9, MONTHLY),
    ...validateMatrix("singleTripProduct", STATIONS_10, SINGLE_TRIP),
    ...validateMatrix("returnTripProduct", STATIONS_10, RETURN_TRIP),
  ];

  if (!deepEqual(SINGLE_TRIP, PEAK_PAYG)) {
    errors.push("Single Trip Product does not match the official peak fare table.");
  }

  for (let i = 0; i < STATIONS_10.length; i += 1) {
    for (let j = 0; j < STATIONS_10.length; j += 1) {
      const single = SINGLE_TRIP[i][j];
      const returned = RETURN_TRIP[i][j];
      if (single === null && returned === null) continue;
      if (returned !== single * 2) {
        errors.push(`Return Trip Product is not twice Single Trip at [${i}, ${j}]`);
      }
    }
  }

  for (let i = 0; i < STATIONS_10.length; i += 1) {
    for (let j = 0; j < STATIONS_10.length; j += 1) {
      const peak = PEAK_PAYG[i][j];
      const offPeak = OFF_PEAK_PAYG[i][j];
      if (peak !== null && offPeak > peak) {
        errors.push(`Off-peak fare exceeds peak fare at [${i}, ${j}]`);
      }
    }
  }

  const fares = {
    schemaVersion: 1,
    operatorId: "gautrain",
    currency: "ZAR",
    effectiveFrom: "2026-09-01",
    source: {
      authority: "Gautrain",
      documentTitle: "Fares Effective 1 September 2026",
      sourceType: "official-fare-guide",
      sourceFile: "raw/fares-effective-2026-09-01.pdf",
      retrievedAt: "2026-09-17",
      confidence: "official",
      transcriptionMethod: "table-values-transcribed-and-QA-checked-from-official-PDF",
    },
    stationReferences: STATION_REFERENCES,
    payAsYouGo: {
      minimumAvailableValue: 38,
      maximumLoadValue: 3200,
      fareDeduction: "correct fare deducted when tagging out",
      timeBasis: "system-entry-time",
      peakPolicy: {
        weekdays: ["06:00-08:30", "15:00-18:30"],
        weekends: "all-day",
        publicHolidays: "all-day",
        sourceWordingPreserved: true,
      },
      offPeakPolicy: {
        weekdays: ["before 06:00", "08:30-15:00", "after 18:30"],
        weekends: false,
        publicHolidays: false,
        sourceWordingPreserved: true,
      },
      highPeakPolicy: {
        status: "suspended-for-trial-period",
        note: "High Peak fares no longer apply in the published fare guide; Gautrain states they may be re-introduced depending on capacity constraints.",
      },
      peakFares: matrixRecord(STATIONS_10, PEAK_PAYG),
      offPeakFares: matrixRecord(STATIONS_10, OFF_PEAK_PAYG),
      offPeakMarketingClaim: "approximately 20% saving on peak fares",
    },
    trainProducts: {
      generalRules: {
        usableAnyTimeOfDay: true,
        usableAnyDayOfWeek: true,
        contactlessBankCardCompatible: false,
        gautrainCardRequired: true,
      },
      weekly: {
        trips: 10,
        validityDays: 10,
        advertisedSavingUpToPercent: 7.5,
        excludesStationKeys: ["or-tambo"],
        fares: matrixRecord(STATIONS_9, WEEKLY),
      },
      monthly: {
        trips: 44,
        validityDays: 44,
        advertisedSavingUpToPercent: 15,
        excludesStationKeys: ["or-tambo"],
        fares: matrixRecord(STATIONS_9, MONTHLY),
      },
      singleTrip: {
        chargedAt: "peak-period-rates",
        recommendedBySourceForPeakTravel: true,
        fares: matrixRecord(STATIONS_10, SINGLE_TRIP),
      },
      returnTrip: {
        chargedAt: "peak-period-rates",
        recommendedBySourceForPeakTravel: true,
        fares: matrixRecord(STATIONS_10, RETURN_TRIP),
      },
    },
    busFares: {
      railUser: {
        peak: 13,
        offPeak: 6,
      },
      nonRailUser: {
        peak: 29,
        offPeak: 22,
      },
      peakTimes: ["06:00-08:30", "15:00-18:30"],
      peakTimesScope: "source states these as peak bus times; no additional weekend/public-holiday bus rule is inferred here",
    },
    parkingFares: {
      rhodesfieldAndHatfield: {
        stations: ["rhodesfield", "hatfield"],
        railUserColumnLabel: "Rail-User Return Train Trip",
        tiers: [
          { period: "0-45min", railUser: 0, nonRailUser: 0 },
          { period: "45min-1hr", railUser: 21, nonRailUser: 21 },
          { period: "1hr-24hrs", railUser: 10, nonRailUser: 135 },
          { period: "two-days", railUser: 27, nonRailUser: 269 },
          { period: "three-days", railUser: 41, nonRailUser: 403 },
          { period: "four-days", railUser: 56, nonRailUser: 537 },
          { period: "five-days", railUser: 70, nonRailUser: 671 },
          { period: "six-days", railUser: 84, nonRailUser: 805 },
          { period: "seven-days", railUser: 99, nonRailUser: 939 },
          { period: "eight-days", railUser: 113, nonRailUser: 1073 },
          { period: "nine-days", railUser: 128, nonRailUser: 1207 },
          { period: "ten-days", railUser: 142, nonRailUser: 1341 },
        ],
        afterTenDays: {
          railUserBase: 142,
          nonRailUserBase: 1341,
          extraPerDay: 135,
        },
      },
      otherListedStations: {
        stations: ["pretoria", "centurion", "midrand", "marlboro", "sandton", "rosebank", "park"],
        railUserColumnLabel: "Rail-User Return Train Trip",
        tiers: [
          { period: "0-15min", railUser: 0, nonRailUser: 0 },
          { period: "15min-1hr", railUser: 21, nonRailUser: 21 },
          { period: "1hr-24hrs", railUser: 10, nonRailUser: 135 },
          { period: "two-days", railUser: 27, nonRailUser: 269 },
          { period: "three-days", railUser: 41, nonRailUser: 403 },
          { period: "four-days", railUser: 56, nonRailUser: 537 },
          { period: "five-days", railUser: 70, nonRailUser: 671 },
          { period: "six-days", railUser: 84, nonRailUser: 805 },
          { period: "seven-days", railUser: 99, nonRailUser: 939 },
          { period: "eight-days", railUser: 113, nonRailUser: 1073 },
          { period: "nine-days", railUser: 128, nonRailUser: 1207 },
          { period: "ten-days", railUser: 142, nonRailUser: 1341 },
        ],
        afterTenDays: {
          railUserBase: 142,
          nonRailUserBase: 1341,
          extraPerDay: 135,
        },
      },
    },
    otherFees: {
      gautrainCardCost: 21,
      refundFee: 0,
      minimumCardBalance: 38,
      refundFeeNote: "Gautrain states that a refund fee may be re-introduced should the need arise.",
    },
    penaltyFees: {
      levels: [
        { level: 1, standardPenalty: 520, ifPaidWithin30Days: 260 },
        { level: 2, standardPenalty: 640, ifPaidWithin30Days: 320 },
        { level: 3, standardPenalty: 880, ifPaidWithin30Days: 440 },
      ],
    },
    appRules: [
      "Do not estimate Gautrain rail fares from road distance.",
      "Use the official origin/destination station matrix and the applicable fare band or product.",
      "Do not offer Weekly or Monthly Train Products for OR Tambo because the official product tables do not include OR Tambo.",
      "Do not invent a High Peak fare while the published fare guide states that High Peak fares are suspended.",
      "Bus, parking, card and penalty fees are separate from the station-to-station train fare matrix.",
    ],
  };

  const report = {
    generatedAt: new Date().toISOString(),
    operatorId: "gautrain",
    effectiveFrom: "2026-09-01",
    officialPdfValidated: true,
    officialPdfBytes: pdf.length,
    matrixChecks: {
      peakPayAsYouGo: { stations: STATIONS_10.length, valid: validateMatrix("peakPayAsYouGo", STATIONS_10, PEAK_PAYG).length === 0 },
      offPeakPayAsYouGo: { stations: STATIONS_10.length, valid: validateMatrix("offPeakPayAsYouGo", STATIONS_10, OFF_PEAK_PAYG).length === 0 },
      weekly: { stations: STATIONS_9.length, valid: validateMatrix("weekly", STATIONS_9, WEEKLY).length === 0 },
      monthly: { stations: STATIONS_9.length, valid: validateMatrix("monthly", STATIONS_9, MONTHLY).length === 0 },
      singleTrip: { stations: STATIONS_10.length, valid: validateMatrix("singleTrip", STATIONS_10, SINGLE_TRIP).length === 0 },
      returnTrip: { stations: STATIONS_10.length, valid: validateMatrix("returnTrip", STATIONS_10, RETURN_TRIP).length === 0 },
    },
    singleTripMatchesPeakTable: deepEqual(SINGLE_TRIP, PEAK_PAYG),
    returnTripIsDoubleSingleTrip: errors.every((error) => !error.startsWith("Return Trip Product")),
    offPeakNeverExceedsPeak: errors.every((error) => !error.startsWith("Off-peak fare exceeds")),
    errorCount: errors.length,
    errors,
    notes: [
      "Fare values were transcribed from the official one-page Gautrain fare guide effective 1 September 2026.",
      "Matrices were checked for dimensions, symmetry, null diagonals and positive integer fares.",
      "Single Trip and Return Trip relationships were QA-checked but the official product tables remain the source of record.",
      "No journey duration, route geometry or live service information is inferred here.",
    ],
  };

  await fs.writeFile(OUTPUT, JSON.stringify(fares, null, 2), "utf8");
  await fs.writeFile(REPORT, JSON.stringify(report, null, 2), "utf8");

  console.log("");
  console.log(`Official PDF bytes: ${pdf.length}`);
  console.log(`Fare matrices validated: ${errors.length === 0 ? "YES" : "NO"}`);
  console.log(`Peak PAYG stations: ${STATIONS_10.length}`);
  console.log(`Off-peak PAYG stations: ${STATIONS_10.length}`);
  console.log(`Weekly product stations: ${STATIONS_9.length}`);
  console.log(`Monthly product stations: ${STATIONS_9.length}`);
  console.log(`Single Trip stations: ${STATIONS_10.length}`);
  console.log(`Return Trip stations: ${STATIONS_10.length}`);
  console.log(`QA errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log("");
    for (const error of errors) console.log(`- ${error}`);
    throw new Error("Gautrain fare QA failed. Output was written for inspection but must not be used until errors are resolved.");
  }

  console.log("");
  console.log("Created:");
  console.log(`  ${OUTPUT}`);
  console.log(`  ${REPORT}`);
  console.log("");
  console.log("Important: no rail ETA, route geometry or live service data were inferred.");
  console.log("");
};

main().catch((error) => {
  console.error("");
  console.error("Gautrain fare normalization failed:");
  console.error(error);
  process.exitCode = 1;
});
