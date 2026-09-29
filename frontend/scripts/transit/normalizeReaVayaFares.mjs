import fs from "node:fs/promises";
import path from "node:path";

// ============================================================
// Pulse Transit - Rea Vaya Fare Normalizer
//
// INPUT
//   src/data/transit/gauteng/reavaya/raw/fares.html
//
// OUTPUT
//   src/data/transit/gauteng/reavaya/fares.json
//   src/data/transit/gauteng/reavaya/fare-normalization-report.json
//
// Important:
// - current 2026/27 fares are transcribed from the official
//   Rea Vaya fare page captured in raw/fares.html
// - source labels are preserved
// - off-peak fare values are NOT calculated from percentages
// - road-driving distance must NOT be substituted for actual
//   Rea Vaya journey distance
// ============================================================

const ROOT = path.resolve(
  "src/data/transit/gauteng/reavaya"
);

const RAW_SOURCE = path.join(
  ROOT,
  "raw",
  "fares.html"
);

const OUTPUT = path.join(
  ROOT,
  "fares.json"
);

const REPORT = path.join(
  ROOT,
  "fare-normalization-report.json"
);

// ------------------------------------------------------------
// Official 2026/27 fare bands
//
// Thresholds are normalized into contiguous computational
// bands:
//
//   <= 5
//   > 5  <= 10
//   > 10 <= 15
//   > 15 <= 25
//   > 25 <= 35
//   > 35 <= 45
//   > 45
//
// The official wording is preserved separately in sourceLabel.
//
// We do NOT infer how Gautrain/Mapbox/etc. distance relates to
// Rea Vaya's fare-system journey distance.
// ------------------------------------------------------------

const FARE_BANDS = [
  {
    id: "rv-fare-0-5",
    sourceLabel: "0 - 5km",
    offPeakSourceLabel:
      "Less than 5km (Minimum Fare)",
    lowerBoundKm: 0,
    lowerInclusive: true,
    upperBoundKm: 5,
    upperInclusive: true,
    peakFare: 11.5,
    offPeakFare: 10.0,
  },

  {
    id: "rv-fare-5-10",
    sourceLabel: "5.1 - 10km",
    offPeakSourceLabel:
      "More than 5km but less than and equals to 10km",
    lowerBoundKm: 5,
    lowerInclusive: false,
    upperBoundKm: 10,
    upperInclusive: true,
    peakFare: 14.5,
    offPeakFare: 13.0,
  },

  {
    id: "rv-fare-10-15",
    sourceLabel: "10.1 - 15km",
    offPeakSourceLabel:
      "More than 10km but less than and equals to 15km",
    lowerBoundKm: 10,
    lowerInclusive: false,
    upperBoundKm: 15,
    upperInclusive: true,
    peakFare: 17.0,
    offPeakFare: 15.0,
  },

  {
    id: "rv-fare-15-25",
    sourceLabel: "15.1 - 25km",
    offPeakSourceLabel:
      "More than 15km but less than and equals to 25km",
    lowerBoundKm: 15,
    lowerInclusive: false,
    upperBoundKm: 25,
    upperInclusive: true,
    peakFare: 19.5,
    offPeakFare: 17.5,
  },

  {
    id: "rv-fare-25-35",
    sourceLabel: "25.1 - 35km",
    offPeakSourceLabel:
      "More than 25km but less than 35km",
    lowerBoundKm: 25,
    lowerInclusive: false,
    upperBoundKm: 35,
    upperInclusive: true,
    peakFare: 21.5,
    offPeakFare: 19.5,
  },

  {
    id: "rv-fare-35-45",
    sourceLabel: "35.1 - 45km",
    offPeakSourceLabel:
      "More than 35km but less than 45km",
    lowerBoundKm: 35,
    lowerInclusive: false,
    upperBoundKm: 45,
    upperInclusive: true,
    peakFare: 22.5,
    offPeakFare: 20.5,
  },

  {
    id: "rv-fare-over-45",
    sourceLabel: "More than 45km",
    offPeakSourceLabel:
      "More than 45km (Maximum Fare)",
    lowerBoundKm: 45,
    lowerInclusive: false,
    upperBoundKm: null,
    upperInclusive: false,
    peakFare: 28.5,
    offPeakFare: 26.5,
  },
];

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const readText = async (filename) => {
  const raw = await fs.readFile(
    filename,
    "utf8"
  );

  if (!raw.trim()) {
    throw new Error(
      `${filename} is empty`
    );
  }

  return raw.replace(
    /^\uFEFF/,
    ""
  );
};

const roughlyContains = (
  html,
  value
) => {
  const normalizedHtml =
    html
      .replace(/&nbsp;/gi, " ")
      .replace(/&#8211;|&ndash;/gi, "-")
      .replace(/&#8212;|&mdash;/gi, "-")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .toLowerCase();

  return normalizedHtml.includes(
    String(value)
      .toLowerCase()
  );
};

const fareForDistance = (
  distanceKm,
  fareType = "peak"
) => {
  if (
    !Number.isFinite(distanceKm) ||
    distanceKm < 0
  ) {
    return null;
  }

  const band =
    FARE_BANDS.find(
      (candidate) => {
        const aboveLower =
          candidate.lowerInclusive
            ? distanceKm >=
              candidate.lowerBoundKm
            : distanceKm >
              candidate.lowerBoundKm;

        const belowUpper =
          candidate.upperBoundKm ===
          null
            ? true
            : candidate.upperInclusive
            ? distanceKm <=
              candidate.upperBoundKm
            : distanceKm <
              candidate.upperBoundKm;

        return (
          aboveLower &&
          belowUpper
        );
      }
    );

  if (!band) {
    return null;
  }

  return fareType === "offPeak"
    ? band.offPeakFare
    : band.peakFare;
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
    " Pulse Transit - Rea Vaya Fare Normalizer"
  );
  console.log(
    "================================================"
  );

  const html =
    await readText(
      RAW_SOURCE
    );

  const errors = [];
  const warnings = [];

  // ----------------------------------------------------------
  // Source presence checks
  // ----------------------------------------------------------

  const sourceChecks = [
    {
      label: "2026/27 fare period",
      value: "1 July 2026",
    },
    {
      label: "minimum peak fare",
      value: "R11.50",
    },
    {
      label: "maximum peak fare",
      value: "R28.50",
    },
    {
      label: "ABT card price",
      value: "R30",
    },
    {
      label: "off-peak section",
      value: "OFF PEAK",
    },
  ];

  for (
    const check of
      sourceChecks
  ) {
    if (
      !roughlyContains(
        html,
        check.value
      )
    ) {
      warnings.push(
        `Could not confirm "${check.label}" using simple HTML text matching: ${check.value}`
      );
    }
  }

  // ----------------------------------------------------------
  // Fare-band QA
  // ----------------------------------------------------------

  if (
    FARE_BANDS.length !== 7
  ) {
    errors.push(
      `Expected 7 distance bands, found ${FARE_BANDS.length}.`
    );
  }

  for (
    let i = 0;
    i <
    FARE_BANDS.length;
    i += 1
  ) {
    const band =
      FARE_BANDS[i];

    if (
      band.peakFare <= 0 ||
      band.offPeakFare <= 0
    ) {
      errors.push(
        `${band.id}: fares must be positive.`
      );
    }

    if (
      band.offPeakFare >
      band.peakFare
    ) {
      errors.push(
        `${band.id}: off-peak fare exceeds peak fare.`
      );
    }

    if (
      i > 0
    ) {
      const previous =
        FARE_BANDS[i - 1];

      if (
        previous.upperBoundKm !==
          band.lowerBoundKm
      ) {
        errors.push(
          `${band.id}: distance bands are not contiguous.`
        );
      }

      if (
        band.peakFare <
        previous.peakFare
      ) {
        errors.push(
          `${band.id}: peak fares decrease as distance increases.`
        );
      }
    }
  }

  // ----------------------------------------------------------
  // Boundary QA
  // ----------------------------------------------------------

  const boundaryTests = [
    [0, 11.5],
    [5, 11.5],
    [5.001, 14.5],
    [10, 14.5],
    [10.001, 17.0],
    [15, 17.0],
    [15.001, 19.5],
    [25, 19.5],
    [25.001, 21.5],
    [35, 21.5],
    [35.001, 22.5],
    [45, 22.5],
    [45.001, 28.5],
  ];

  for (
    const [
      distance,
      expected,
    ] of boundaryTests
  ) {
    const actual =
      fareForDistance(
        distance,
        "peak"
      );

    if (
      actual !== expected
    ) {
      errors.push(
        `Fare boundary test failed at ${distance} km: expected ${expected}, found ${actual}.`
      );
    }
  }

  // ----------------------------------------------------------
  // Current normalized fare dataset
  // ----------------------------------------------------------

  const fares = {
    schemaVersion: 1,

    operatorId: "reavaya",

    currency: "ZAR",

    effectiveFrom:
      "2026-07-01",

    effectiveTo:
      "2027-06-30",

    source: {
      authority:
        "Rea Vaya / City of Johannesburg",

      documentTitle:
        "Rea Vaya Fares",

      sourceType:
        "official-web-page",

      sourceFile:
        "raw/fares.html",

      sourceUrl:
        "https://reavaya.org.za/fares/",

      confidence:
        "official",

      transcriptionMethod:
        "official-published-values-transcribed-and-QA-checked",
    },

    fareModel: {
      type:
        "distance-banded",

      distanceUnit:
        "km",

      distanceBasis:
        "Rea Vaya journey distance",

      distanceRoundingRule:
        "not-specified-by-source",

      computationalBandPolicy: {
        status:
          "normalized-derived-boundaries",

        explanation:
          "Published labels are preserved on each band. Continuous thresholds are normalized as <=5, >5<=10, >10<=15, >15<=25, >25<=35, >35<=45 and >45 for deterministic application logic.",

        officialFareEngineEquivalent:
          "not-claimed",
      },

      bands:
        FARE_BANDS.map(
          (band) => ({
            ...band,

            currency:
              "ZAR",
          })
        ),
    },

    offPeak: {
      published:
        true,

      marketingDescription:
        "10% discount for off-peak travel",

      calculationMethod:
        "use-published-off-peak-values",

      calculateAsPercentage:
        false,

      timeWindow:
        null,

      timeWindowStatus:
        "not-normalized-from-fare-source",

      note:
        "Pulse must use the published off-peak fare column, not calculate a 10% reduction itself.",
    },

    transferRule: {
      fareContinuationSupported:
        true,

      publishedRule:
        "A connecting bus ride may count as continuation of the first journey rather than a new trip.",

      passengerAction:
        "At a Rea Vaya station, passengers continuing onto a connecting bus do not tap out and tap in again; they tap out at the final destination.",

      transferTimeLimit:
        null,

      transferTimeLimitStatus:
        "not-specified-in-normalized-source",
    },

    paymentProducts: {
      abtCard: {
        price:
          30,

        minimumBalanceToTravel:
          30,

        currency:
          "ZAR",
      },

      qrSingleUse: {
        price:
          30,

        currency:
          "ZAR",
      },

      qrEventPass: {
        price:
          60,

        currency:
          "ZAR",
      },
    },

    penalties: {
      generalPenaltyFee:
        30,

      inspectionFareEvasionPenalty:
        60,

      currency:
        "ZAR",
    },

    appRules: [
      "Do not calculate Rea Vaya fare from Mapbox driving distance.",
      "Do not calculate Rea Vaya fare from straight-line distance.",
      "Fare calculation requires an appropriate Rea Vaya journey distance or official fare-system equivalent.",
      "Use published off-peak values rather than mathematically subtracting 10 percent.",
      "Do not infer an off-peak time window from the fare table until the applicable service/fare rule has been verified.",
      "Do not charge each leg independently when an official Rea Vaya transfer is treated as continuation of one journey.",
      "Preserve the published effective period when presenting current fares.",
    ],
  };

  // ----------------------------------------------------------
  // QA report
  // ----------------------------------------------------------

  const report = {
    generatedAt:
      new Date().toISOString(),

    operatorId:
      "reavaya",

    effectiveFrom:
      fares.effectiveFrom,

    effectiveTo:
      fares.effectiveTo,

    sourceFile:
      "raw/fares.html",

    sourceBytes:
      Buffer.byteLength(
        html,
        "utf8"
      ),

    fareBandCount:
      FARE_BANDS.length,

    peakFareRange: {
      minimum:
        Math.min(
          ...FARE_BANDS.map(
            (band) =>
              band.peakFare
          )
        ),

      maximum:
        Math.max(
          ...FARE_BANDS.map(
            (band) =>
              band.peakFare
          )
        ),
    },

    offPeakFareRange: {
      minimum:
        Math.min(
          ...FARE_BANDS.map(
            (band) =>
              band.offPeakFare
          )
        ),

      maximum:
        Math.max(
          ...FARE_BANDS.map(
            (band) =>
              band.offPeakFare
          )
        ),
    },

    distanceBandsContiguous:
      errors.every(
        (error) =>
          !error.includes(
            "distance bands are not contiguous"
          )
      ),

    offPeakNeverExceedsPeak:
      errors.every(
        (error) =>
          !error.includes(
            "off-peak fare exceeds peak fare"
          )
      ),

    boundaryTestsPassed:
      errors.every(
        (error) =>
          !error.includes(
            "Fare boundary test failed"
          )
      ),

    sourceChecks,

    warningCount:
      warnings.length,

    warnings,

    errorCount:
      errors.length,

    errors,

    qaPassed:
      errors.length === 0,

    notes: [
      "Current fares are effective 1 July 2026 through 30 June 2027.",
      "Seven official distance-based peak and off-peak fare values are stored.",
      "The official source labels are retained even where wording differs between the main fare table and off-peak table.",
      "A deterministic contiguous threshold representation is included for future application logic, but is explicitly marked as normalized rather than a claim about the internal Rea Vaya fare engine.",
      "No route distance, stop sequence, timetable, GPS geometry or ETA is inferred.",
    ],
  };

  // ----------------------------------------------------------
  // Write outputs
  // ----------------------------------------------------------

  await fs.writeFile(
    OUTPUT,
    JSON.stringify(
      fares,
      null,
      2
    ),
    "utf8"
  );

  await fs.writeFile(
    REPORT,
    JSON.stringify(
      report,
      null,
      2
    ),
    "utf8"
  );

  // ----------------------------------------------------------
  // Console output
  // ----------------------------------------------------------

  console.log("");
  console.log(
    "Fare normalization complete."
  );

  console.log("");
  console.log(
    `Effective: ${fares.effectiveFrom} -> ${fares.effectiveTo}`
  );

  console.log(
    `Fare bands: ${FARE_BANDS.length}`
  );

  console.log(
    `Peak fares: R${report.peakFareRange.minimum.toFixed(
      2
    )} - R${report.peakFareRange.maximum.toFixed(
      2
    )}`
  );

  console.log(
    `Off-peak fares: R${report.offPeakFareRange.minimum.toFixed(
      2
    )} - R${report.offPeakFareRange.maximum.toFixed(
      2
    )}`
  );

  console.log(
    `Boundary tests passed: ${report.boundaryTestsPassed ? "YES" : "NO"}`
  );

  console.log(
    `Off-peak never exceeds peak: ${report.offPeakNeverExceedsPeak ? "YES" : "NO"}`
  );

  console.log("");
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
    `  ${OUTPUT}`
  );

  console.log(
    `  ${REPORT}`
  );

  console.log("");

  console.log(
    "Important: no road-distance fare calculation, route geometry, timetable or ETA was inferred."
  );

  console.log("");

  if (
    errors.length
  ) {
    for (
      const error of
        errors
    ) {
      console.error(
        `ERROR: ${error}`
      );
    }

    throw new Error(
      "Rea Vaya fare QA failed."
    );
  }
};

main().catch(
  (error) => {
    console.error("");
    console.error(
      "Rea Vaya fare normalization failed:"
    );

    console.error(error);

    process.exitCode = 1;
  }
);