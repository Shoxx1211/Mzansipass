import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const paths = {
  types: path.join(
    ROOT,
    "src",
    "types.ts",
  ),

  recommendations: path.join(
    ROOT,
    "src",
    "features",
    "planner",
    "TransportRecommendations.tsx",
  ),

  engine: path.join(
    ROOT,
    "src",
    "services",
    "recommendationEngine.ts",
  ),

  app: path.join(
    ROOT,
    "src",
    "app",
    "App.tsx",
  ),
};

// ============================================================
// FILE HELPERS
// ============================================================

function read(file) {
  return fs.readFileSync(
    file,
    "utf8",
  );
}

function write(file, text) {
  fs.writeFileSync(
    file,
    text,
    "utf8",
  );
}

function backup(file) {
  const backupFile =
    `${file}.pre-reavaya-integration.bak`;

  if (!fs.existsSync(backupFile)) {
    fs.copyFileSync(
      file,
      backupFile,
    );

    console.log(
      `Backup: ${backupFile}`,
    );
  }
}

function normalizeLF(value) {
  return value.replace(
    /\r\n/g,
    "\n",
  );
}

function toCRLF(value) {
  return normalizeLF(value).replace(
    /\n/g,
    "\r\n",
  );
}

function containsEquivalent(
  text,
  snippet,
) {
  return (
    text.includes(snippet) ||
    normalizeLF(text).includes(
      normalizeLF(snippet),
    )
  );
}

function replaceRequired(
  text,
  before,
  after,
  label,
) {
  // ----------------------------------------------------------
  // REGEX
  // ----------------------------------------------------------

  if (before instanceof RegExp) {
    const regex =
      new RegExp(
        before.source,
        before.flags.replace(
          "g",
          "",
        ),
      );

    const afterAlreadyPresent =
      typeof after === "string" &&
      (
        text.includes(after) ||
        normalizeLF(text).includes(
          normalizeLF(after),
        )
      );

    if (afterAlreadyPresent) {
      console.log(
        `Already applied: ${label}`,
      );

      return text;
    }

    if (!regex.test(text)) {
      throw new Error(
        `Could not find expected block: ${label}`,
      );
    }

    console.log(
      `Applied: ${label}`,
    );

    return text.replace(
      regex,
      after,
    );
  }

  // ----------------------------------------------------------
  // STRING
  // ----------------------------------------------------------

  if (
    containsEquivalent(
      text,
      after,
    )
  ) {
    console.log(
      `Already applied: ${label}`,
    );

    return text;
  }

  if (text.includes(before)) {
    console.log(
      `Applied: ${label}`,
    );

    return text.replace(
      before,
      after,
    );
  }

  const lfText =
    normalizeLF(text);

  const lfBefore =
    normalizeLF(before);

  if (
    lfText.includes(lfBefore)
  ) {
    const usesCRLF =
      text.includes("\r\n");

    const replacement =
      usesCRLF
        ? toCRLF(after)
        : normalizeLF(after);

    const start =
      lfText.indexOf(lfBefore);

    /*
     * We cannot use the normalized index against the original CRLF
     * string safely, so perform the replacement on the normalized
     * form and then restore line endings if necessary.
     */
    const replacedLF =
      lfText.slice(
        0,
        start,
      ) +
      normalizeLF(replacement) +
      lfText.slice(
        start +
          lfBefore.length,
      );

    console.log(
      `Applied: ${label}`,
    );

    return usesCRLF
      ? toCRLF(replacedLF)
      : replacedLF;
  }

  throw new Error(
    `Could not find expected block: ${label}`,
  );
}

// ============================================================
// 1. TYPES
// ============================================================

function patchTypes() {
  const file =
    paths.types;

  backup(file);

  let text =
    read(file);

  const start =
    text.indexOf(
      "export interface TransportRecommendation {",
    );

  if (start === -1) {
    throw new Error(
      "TransportRecommendation interface not found in types.ts",
    );
  }

  const nextSection =
    text.indexOf(
      "// ======================================================",
      start + 50,
    );

  if (nextSection === -1) {
    throw new Error(
      "Could not determine end of TransportRecommendation interface",
    );
  }

  let block =
    text.slice(
      start,
      nextSection,
    );

  block =
    block.replace(
      "estimatedFare: number;",
      "estimatedFare: number | null;",
    );

  block =
    block.replace(
      "estimatedTime: number;",
      "estimatedTime: number | null;",
    );

  block =
    block.replace(
      "estimatedTravelTime: number;",
      "estimatedTravelTime: number | null;",
    );

  if (
    !block.includes(
      "fareStatus?:",
    )
  ) {
    if (
      !block.includes(
        "  direct?: boolean;",
      )
    ) {
      throw new Error(
        "Could not find direct?: boolean inside TransportRecommendation",
      );
    }

    block =
      block.replace(
        "  direct?: boolean;",
        `  direct?: boolean;

  /** Evidence-aware planner metadata. */
  routeCodes?: string[];
  transferStops?: string[];

  fareStatus?:
    | "estimated"
    | "verified"
    | "unverified";

  timeStatus?:
    | "estimated"
    | "verified"
    | "unverified";

  publishedFareRange?: {
    currency: string;
    minimum: number;
    maximum: number;
    period?: "peak" | "offPeak";
  };

  evidenceStatus?:
    | "configured"
    | "same-canonical-route"
    | "published-shared-stop-connectivity";

  /**
   * false means the route can be displayed as evidence,
   * but Pulse must not start a tracked trip from it yet.
   */
  selectable?: boolean;`,
      );
  }

  text =
    text.slice(
      0,
      start,
    ) +
    block +
    text.slice(
      nextSection,
    );

  write(
    file,
    text,
  );

  console.log(
    "Updated: src/types.ts",
  );
}

// ============================================================
// 2. RECOMMENDATION CARD
// ============================================================

function patchRecommendationCard() {
  const file =
    paths.recommendations;

  backup(file);

  let text =
    read(file);

  // ----------------------------------------------------------
  // Fare / time formatting
  // ----------------------------------------------------------

  if (
    !text.includes(
      "const formatFare =",
    )
  ) {
    const newFormatters = `const formatTime = (
  minutes: number | null,
): string => {
  if (
    minutes === null ||
    !Number.isFinite(minutes) ||
    minutes <= 0
  ) {
    return "Not verified";
  }

  if (minutes < 60) {
    return \`\${Math.round(minutes)} min\`;
  }

  const hours =
    Math.floor(minutes / 60);

  const remainder =
    Math.round(minutes % 60);

  return remainder
    ? \`\${hours}h \${remainder}m\`
    : \`\${hours}h\`;
};

const formatFare = (
  recommendation: RecommendationType,
): string => {
  if (
    recommendation.estimatedFare !== null &&
    Number.isFinite(
      recommendation.estimatedFare,
    )
  ) {
    return \`R\${recommendation.estimatedFare.toFixed(0)}\`;
  }

  const range =
    recommendation.publishedFareRange;

  if (range) {
    return \`R\${range.minimum.toFixed(
      0,
    )}–R\${range.maximum.toFixed(0)}\`;
  }

  return "Not verified";
};`;

    text =
      replaceRequired(
        text,
        /const formatTime = \(minutes: number\): string => \{[\s\S]*?\n\};\r?\n\r?\nconst RecommendationCard/,
        `${newFormatters}

const RecommendationCard`,
        "nullable recommendation time/fare formatting",
      );
  } else {
    console.log(
      "Already applied: nullable recommendation time/fare formatting",
    );
  }

  if (
    text.includes(
      "R{recommendation.estimatedFare.toFixed(0)}",
    )
  ) {
    text =
      text.replace(
        "R{recommendation.estimatedFare.toFixed(0)}",
        "{formatFare(recommendation)}",
      );

    console.log(
      "Applied: fare card formatter",
    );
  } else if (
    text.includes(
      "{formatFare(recommendation)}",
    )
  ) {
    console.log(
      "Already applied: fare card formatter",
    );
  } else {
    throw new Error(
      "Could not find expected block: fare card formatter",
    );
  }

  // ----------------------------------------------------------
  // Nullable sorting
  // ----------------------------------------------------------

  if (
    !text.includes(
      "const aTime =",
    ) ||
    !text.includes(
      "const aFare =",
    )
  ) {
    text =
      replaceRequired(
        text,
        /case "fastest":\s*return a\.estimatedTime - b\.estimatedTime;\s*case "cheapest":\s*return a\.estimatedFare - b\.estimatedFare;/,
        `case "fastest": {
            const aTime =
              a.estimatedTime ??
              Number.POSITIVE_INFINITY;

            const bTime =
              b.estimatedTime ??
              Number.POSITIVE_INFINITY;

            return aTime - bTime;
          }

          case "cheapest": {
            const aFare =
              a.estimatedFare ??
              Number.POSITIVE_INFINITY;

            const bFare =
              b.estimatedFare ??
              Number.POSITIVE_INFINITY;

            return aFare - bFare;
          }`,
        "nullable recommendation sorting",
      );
  } else {
    console.log(
      "Already applied: nullable recommendation sorting",
    );
  }

  // ----------------------------------------------------------
  // Evidence-only selection guard
  // ----------------------------------------------------------

  if (
    !text.includes(
      "disabled={recommendation.selectable === false}",
    )
  ) {
    text =
      replaceRequired(
        text,
        "            onClick={onSelect}",
        `            onClick={() => {
              if (
                recommendation.selectable !==
                false
              ) {
                onSelect();
              }
            }}
            disabled={
              recommendation.selectable ===
                false
            }`,
        "evidence-only button guard",
      );
  } else {
    console.log(
      "Already applied: evidence-only button guard",
    );
  }

  if (
    text.includes(
      `{isSelected ? "Selected" : "Choose this option"}`,
    )
  ) {
    text =
      text.replace(
        `{isSelected ? "Selected" : "Choose this option"}`,
        `{recommendation.selectable === false
              ? "Route evidence only"
              : isSelected
                ? "Selected"
                : "Choose this option"}`,
      );

    console.log(
      "Applied: evidence-only button label",
    );
  } else if (
    text.includes(
      '"Route evidence only"',
    )
  ) {
    console.log(
      "Already applied: evidence-only button label",
    );
  } else {
    throw new Error(
      "Could not find expected block: evidence-only button label",
    );
  }

  // ----------------------------------------------------------
  // Wording
  // ----------------------------------------------------------

  text =
    text.replace(
      "Direct network candidates",
      "Evidence-backed journey options",
    );

  text =
    text.replace(
      `{processedRecommendations.length} direct candidate`,
      `{processedRecommendations.length} journey option`,
    );

  text =
    text.replace(
      `{processedRecommendations.length} journey candidate`,
      `{processedRecommendations.length} journey option`,
    );

  write(
    file,
    text,
  );

  console.log(
    "Updated: src/features/planner/TransportRecommendations.tsx",
  );
}

// ============================================================
// 3. RECOMMENDATION ENGINE
// ============================================================

function patchRecommendationEngine() {
  const file =
    paths.engine;

  backup(file);

  let text =
    read(file);

  // ----------------------------------------------------------
  // Import
  // ----------------------------------------------------------

  if (
    !text.includes(
      'import { ReaVayaApplicabilityEngine } from "./reaVayaApplicabilityEngine";',
    )
  ) {
    if (
      !text.includes(
        'import { HabitEngine } from "./habitEngine";',
      )
    ) {
      throw new Error(
        "Could not find HabitEngine import",
      );
    }

    text =
      text.replace(
        'import { HabitEngine } from "./habitEngine";',
        `import { HabitEngine } from "./habitEngine";
import { ReaVayaApplicabilityEngine } from "./reaVayaApplicabilityEngine";`,
      );

    console.log(
      "Applied: Rea Vaya engine import",
    );
  } else {
    console.log(
      "Already applied: Rea Vaya engine import",
    );
  }

  // ----------------------------------------------------------
  // Skip old Rea Vaya configured-zone model
  // ----------------------------------------------------------

  if (
    !text.includes(
      'if (network === "Rea Vaya")',
    )
  ) {
    text =
      replaceRequired(
        text,
        "      const network = zone.canonicalNetwork;",
        `      const network = zone.canonicalNetwork;

      // Rea Vaya uses the evidence-based runtime engine below.
      // Never send it through the older configured-stop approximation.
      if (network === "Rea Vaya") {
        continue;
      }`,
        "skip legacy Rea Vaya zone",
      );
  } else {
    console.log(
      "Already applied: skip legacy Rea Vaya zone",
    );
  }

  // ----------------------------------------------------------
  // Evidence-backed Rea Vaya block
  // ----------------------------------------------------------

  if (
    !text.includes(
      "const reaVayaResult =",
    )
  ) {
    const marker =
      "    const sorted = recommendations.sort((a, b) => {";

    if (
      !containsEquivalent(
        text,
        marker,
      )
    ) {
      throw new Error(
        "Could not find RecommendationEngine sorting marker",
      );
    }

    const block = `    // ======================================================
    // REA VAYA — EVIDENCE-BASED RUNTIME
    // ======================================================

    const reaVayaAllowed =
      !userPreferences.preferredNetworks?.length ||
      userPreferences.preferredNetworks.includes(
        "Rea Vaya",
      );

    if (reaVayaAllowed) {
      const reaVayaResult =
        ReaVayaApplicabilityEngine.evaluate(
          {
            lat: userLocation.lat,
            lng: userLocation.lng,
          },
          {
            lat: destinationLocation.lat,
            lng: destinationLocation.lng,
          },
          {
            // Pulse engineering threshold.
            // This is not an official operator walking rule.
            maxAccessKm: 0.8,
          },
        );

      const totalWalking =
        reaVayaResult.totalAccessWalkingKm;

      const walkingWithinPreference =
        totalWalking !== null &&
        (
          userPreferences.maxWalkingDistance ===
            undefined ||
          totalWalking <=
            userPreferences.maxWalkingDistance
        );

      if (
        reaVayaResult.status !== "unsupported" &&
        totalWalking !== null &&
        walkingWithinPreference
      ) {
        const walkingScore =
          this.calculateWalkingScore(
            totalWalking,
          );

        const accessKm =
          reaVayaResult.accessDistanceKm ??
          0.8;

        const egressKm =
          reaVayaResult.egressDistanceKm ??
          0.8;

        const routeFitScore =
          Math.round(
            clamp(
              100 -
                (
                  Math.max(
                    accessKm,
                    egressKm,
                  ) /
                  0.8
                ) *
                  45,
              45,
              98,
            ),
          );

        // Exact fare and journey time are intentionally unknown.
        // Neutral values are used only inside the ranking calculation.
        const costScore = 50;
        const timeScore = 50;

        const rawScore =
          routeFitScore * 0.65 +
          walkingScore * 0.35;

        const selectedRoutes =
          reaVayaResult.selectedRoutes;

        const transferStops =
          reaVayaResult.transfers.flatMap(
            (transfer) =>
              transfer.sharedStopLabels,
          );

        const applicableFareRange =
          isPeak
            ? reaVayaResult.fare.peakRange
            : reaVayaResult.fare.offPeakRange;

        recommendations.push({
          id:
            \`reavaya:\${selectedRoutes.join(
              "-",
            )}\`,

          mode:
            "Rea Vaya",

          score:
            Math.round(
              clamp(
                rawScore,
                0,
                100,
              ),
            ),

          rawScore,
          walkingScore,
          costScore,
          timeScore,
          routeFitScore,

          estimatedFare:
            null,

          estimatedTime:
            null,

          estimatedTravelTime:
            null,

          walkingDistance:
            Math.round(
              totalWalking *
                100,
            ) / 100,

          routeName:
            selectedRoutes.join(
              " → ",
            ),

          subtitle:
            reaVayaResult.status ===
            "direct"
              ? "Verified spatial route fit"
              : "Published shared-stop connection",

          reason:
            reaVayaResult.status ===
            "direct"
              ? \`Official Rea Vaya route geometry for \${selectedRoutes.join(
                  ", ",
                )} is within Pulse's 800 m engineering access threshold at both ends. Exact fare, service direction and transit time remain unverified.\`
              : \`Pulse found a Rea Vaya path across \${selectedRoutes.join(
                  " → ",
                )} using canonical route geometry and published shared-stop connectivity. Timed transfer compatibility remains unverified.\`,

          badges:
            reaVayaResult.status ===
            "direct"
              ? [
                  "DIRECT",
                  "VERIFIED_ROUTE_FIT",
                ]
              : [
                  "TRANSFER",
                  "PUBLISHED_CONNECTION",
                ],

          color:
            this.getTransportColor(
              "Rea Vaya",
            ),

          confidence:
            reaVayaResult.status ===
            "direct"
              ? 0.9
              : 0.82,

          dataQuality:
            "verified",

          direct:
            reaVayaResult.status ===
            "direct",

          routeCodes:
            selectedRoutes,

          transferStops,

          fareStatus:
            "unverified",

          timeStatus:
            "unverified",

          publishedFareRange:
            applicableFareRange
              ? {
                  currency:
                    reaVayaResult.fare
                      .currency,

                  minimum:
                    applicableFareRange
                      .minimum,

                  maximum:
                    applicableFareRange
                      .maximum,

                  period:
                    isPeak
                      ? "peak"
                      : "offPeak",
                }
              : undefined,

          evidenceStatus:
            reaVayaResult.evidence ===
            "same-canonical-route"
              ? "same-canonical-route"
              : "published-shared-stop-connectivity",

          // Evidence can be shown, but the user cannot start a tracked
          // trip until a passenger-specific fare/time is defensible.
          selectable:
            false,
        });
      }
    }

`;

    text =
      replaceRequired(
        text,
        marker,
        block + marker,
        "evidence-based Rea Vaya recommendation block",
      );
  } else {
    console.log(
      "Already applied: evidence-based Rea Vaya recommendation block",
    );
  }

  // ----------------------------------------------------------
  // Null-safe engine sorting
  // ----------------------------------------------------------

  if (
    text.includes(
      "return a.estimatedFare - b.estimatedFare;",
    ) ||
    text.includes(
      "return a.estimatedTime - b.estimatedTime;",
    )
  ) {
    text =
      replaceRequired(
        text,
        /if \(userPreferences\.preferCheapest\) \{\s*return a\.estimatedFare - b\.estimatedFare;\s*\}\s*if \(userPreferences\.preferFastest\) \{\s*return a\.estimatedTime - b\.estimatedTime;\s*\}/,
        `if (userPreferences.preferCheapest) {
        const aFare =
          a.estimatedFare ??
          Number.POSITIVE_INFINITY;

        const bFare =
          b.estimatedFare ??
          Number.POSITIVE_INFINITY;

        return aFare - bFare;
      }

      if (userPreferences.preferFastest) {
        const aTime =
          a.estimatedTime ??
          Number.POSITIVE_INFINITY;

        const bTime =
          b.estimatedTime ??
          Number.POSITIVE_INFINITY;

        return aTime - bTime;
      }`,
        "null-safe recommendation engine sorting",
      );
  } else {
    console.log(
      "Already applied: null-safe recommendation engine sorting",
    );
  }

  // ----------------------------------------------------------
  // Null-safe compareOptions fare section
  // ----------------------------------------------------------

  const oldFareStart =
    text.indexOf(
      "    if (option1.estimatedFare !== option2.estimatedFare) {",
    );

  if (
    oldFareStart !== -1
  ) {
    const timeStart =
      text.indexOf(
        "    if (option1.estimatedTime !== option2.estimatedTime) {",
        oldFareStart,
      );

    if (timeStart === -1) {
      throw new Error(
        "Could not locate compareOptions time block",
      );
    }

    const newFareBlock = `    if (
      option1.estimatedFare !== null &&
      option2.estimatedFare !== null &&
      option1.estimatedFare !==
        option2.estimatedFare
    ) {
      const cheaper =
        option1.estimatedFare <
        option2.estimatedFare
          ? option1
          : option2;

      const dearer =
        cheaper === option1
          ? option2
          : option1;

      differences.push(
        \`\${this.displayMode(
          cheaper.mode,
        )} is about R\${Math.abs(
          dearer.estimatedFare! -
            cheaper.estimatedFare!,
        ).toFixed(0)} cheaper\`,
      );
    }

`;

    text =
      text.slice(
        0,
        oldFareStart,
      ) +
      newFareBlock +
      text.slice(
        timeStart,
      );

    console.log(
      "Applied: null-safe fare comparison",
    );
  } else if (
    text.includes(
      "option1.estimatedFare !== null",
    )
  ) {
    console.log(
      "Already applied: null-safe fare comparison",
    );
  } else {
    throw new Error(
      "Could not locate compareOptions fare block",
    );
  }

  // ----------------------------------------------------------
  // Null-safe compareOptions time section
  // ----------------------------------------------------------

  const oldTimeStart =
    text.indexOf(
      "    if (option1.estimatedTime !== option2.estimatedTime) {",
    );

  if (
    oldTimeStart !== -1
  ) {
    const walkingStart =
      text.indexOf(
        "    if (option1.walkingDistance !== option2.walkingDistance) {",
        oldTimeStart,
      );

    if (walkingStart === -1) {
      throw new Error(
        "Could not locate compareOptions walking block",
      );
    }

    const newTimeBlock = `    if (
      option1.estimatedTime !== null &&
      option2.estimatedTime !== null &&
      option1.estimatedTime !==
        option2.estimatedTime
    ) {
      const faster =
        option1.estimatedTime <
        option2.estimatedTime
          ? option1
          : option2;

      const slower =
        faster === option1
          ? option2
          : option1;

      differences.push(
        \`\${this.displayMode(
          faster.mode,
        )} is about \${Math.abs(
          slower.estimatedTime! -
            faster.estimatedTime!,
        )} min quicker\`,
      );
    }

`;

    text =
      text.slice(
        0,
        oldTimeStart,
      ) +
      newTimeBlock +
      text.slice(
        walkingStart,
      );

    console.log(
      "Applied: null-safe time comparison",
    );
  } else if (
    text.includes(
      "option1.estimatedTime !== null",
    )
  ) {
    console.log(
      "Already applied: null-safe time comparison",
    );
  } else {
    throw new Error(
      "Could not locate compareOptions time block",
    );
  }

  write(
    file,
    text,
  );

  console.log(
    "Updated: src/services/recommendationEngine.ts",
  );
}

// ============================================================
// 4. APP SAFEGUARDS
// ============================================================

function patchApp() {
  const file =
    paths.app;

  backup(file);

  let text =
    read(file);

  // ----------------------------------------------------------
  // Never price evidence-only Rea Vaya with Mapbox car distance
  // ----------------------------------------------------------

  if (
    !text.includes(
      'recommendation.fareStatus === "unverified"',
    )
  ) {
    text =
      replaceRequired(
        text,
        /(\s+const networkName = recommendation\.mode as TransitNetwork;\r?\n)(\s+const fareDistance =)/,
        `$1
            // Evidence-only recommendations must never be priced
            // using the Mapbox road-driving distance.
            if (
              recommendation.fareStatus ===
              "unverified"
            ) {
              return [
                networkName,
                null,
              ] as const;
            }

$2`,
        "skip FareEngine for unverified fare",
      );
  } else {
    console.log(
      "Already applied: skip FareEngine for unverified fare",
    );
  }

  // ----------------------------------------------------------
  // Safe planned duration
  // ----------------------------------------------------------

  if (
    !text.includes(
      "Mapbox currently supplies a road-driving duration.",
    ) &&
    !text.includes(
      "Mapbox's duration is currently a driving baseline.",
    )
  ) {
    const safeDuration = `  const plannedDurationSeconds = useMemo(() => {
    if (
      selectedRecommendation?.estimatedTime !==
        null &&
      selectedRecommendation?.estimatedTime !==
        undefined &&
      Number.isFinite(
        selectedRecommendation.estimatedTime,
      )
    ) {
      return Math.max(
        0,
        Math.round(
          selectedRecommendation.estimatedTime *
            60,
        ),
      );
    }

    // Mapbox currently supplies a road-driving duration.
    // It is only safe as a planned duration for Taxi.
    if (
      network === "Taxi" &&
      routePlan.source ===
        "mapbox-road" &&
      routePlan.roadDurationSeconds !==
        null &&
      routePlan.roadDurationSeconds >
        0
    ) {
      return routePlan.roadDurationSeconds;
    }

    return 0;
  }, [
    network,
    routePlan.roadDurationSeconds,
    routePlan.source,
    selectedRecommendation,
  ]);

  const trustedLiveDistanceKm`;

    text =
      replaceRequired(
        text,
        /  const plannedDurationSeconds = useMemo\(\(\) => \{[\s\S]*?\n  \}, \[[\s\S]*?\]\);\r?\n\r?\n  const trustedLiveDistanceKm/,
        safeDuration,
        "safe plannedDurationSeconds",
      );
  } else {
    console.log(
      "Already applied: safe plannedDurationSeconds",
    );
  }

  // ----------------------------------------------------------
  // Selection guard
  // ----------------------------------------------------------

  const selectStart =
    text.indexOf(
      "  const handleSelectRecommendation = useCallback(",
    );

  const nextMarker =
    "  // ====================================================\n  // LIVE BACKGROUND TRACKER SUBSCRIPTION";

  let selectEnd =
    text.indexOf(
      nextMarker,
      selectStart,
    );

  if (
    selectEnd === -1
  ) {
    selectEnd =
      normalizeLF(text).indexOf(
        nextMarker,
      );

    if (
      selectEnd !== -1
    ) {
      const lfText =
        normalizeLF(text);

      const startLF =
        lfText.indexOf(
          "  const handleSelectRecommendation = useCallback(",
        );

      const endLF =
        lfText.indexOf(
          nextMarker,
          startLF,
        );

      if (
        startLF === -1 ||
        endLF === -1
      ) {
        throw new Error(
          "Could not locate handleSelectRecommendation block",
        );
      }

      const replacement = `  const handleSelectRecommendation = useCallback(
    (rec: RecommendationType) => {
      if (rec.selectable === false) {
        setError(
          "Pulse can verify this Rea Vaya route fit, but an exact journey fare and travel time are not verified yet, so this option cannot be started as a tracked trip.",
        );

        return;
      }

      const selectedNetwork =
        rec.mode as TransitNetwork;

      const recalculatedFare =
        networkEstimates[
          selectedNetwork
        ];

      const finalFare =
        recalculatedFare ??
        rec.estimatedFare;

      if (
        finalFare === null ||
        !Number.isFinite(finalFare)
      ) {
        setError(
          "Pulse does not yet have a usable fare for this journey.",
        );

        return;
      }

      setSelectedRecommendation(rec);
      setNetwork(selectedNetwork);
      setEstimatedFare(finalFare);
      setPlanningStep("fare");
      setError(null);
    },
    [networkEstimates],
  );

`;

      let patchedLF =
        lfText.slice(
          0,
          startLF,
        ) +
        replacement +
        lfText.slice(
          endLF,
        );

      if (
        text.includes("\r\n")
      ) {
        patchedLF =
          toCRLF(
            patchedLF,
          );
      }

      text =
        patchedLF;
    }
  } else {
    if (
      selectStart === -1
    ) {
      throw new Error(
        "Could not locate handleSelectRecommendation block",
      );
    }

    const replacement = `  const handleSelectRecommendation = useCallback(
    (rec: RecommendationType) => {
      if (rec.selectable === false) {
        setError(
          "Pulse can verify this Rea Vaya route fit, but an exact journey fare and travel time are not verified yet, so this option cannot be started as a tracked trip.",
        );

        return;
      }

      const selectedNetwork =
        rec.mode as TransitNetwork;

      const recalculatedFare =
        networkEstimates[
          selectedNetwork
        ];

      const finalFare =
        recalculatedFare ??
        rec.estimatedFare;

      if (
        finalFare === null ||
        !Number.isFinite(finalFare)
      ) {
        setError(
          "Pulse does not yet have a usable fare for this journey.",
        );

        return;
      }

      setSelectedRecommendation(rec);
      setNetwork(selectedNetwork);
      setEstimatedFare(finalFare);
      setPlanningStep("fare");
      setError(null);
    },
    [networkEstimates],
  );

`;

    text =
      text.slice(
        0,
        selectStart,
      ) +
      replacement +
      text.slice(
        selectEnd,
      );
  }

  console.log(
    "Applied: safe recommendation selection",
  );

  write(
    file,
    text,
  );

  console.log(
    "Updated: src/app/App.tsx",
  );
}

// ============================================================
// RUN
// ============================================================

console.log("");
console.log(
  "================================================",
);

console.log(
  " Pulse Transit - Apply Rea Vaya Planner Integration",
);

console.log(
  "================================================",
);

console.log("");

patchTypes();
patchRecommendationCard();
patchRecommendationEngine();
patchApp();

console.log("");
console.log(
  "================================================",
);

console.log(
  " Rea Vaya planner integration patch complete",
);

console.log(
  "================================================",
);

console.log("");

console.log(
  "Backups are stored beside the original files with:",
);

console.log(
  "  .pre-reavaya-integration.bak",
);

console.log("");

console.log(
  "Next command:",
);

console.log(
  "  npm.cmd run build",
);

console.log("");