/**
 * Development-only unified Gauteng coverage adapter.
 *
 * Combines:
 * - Rea Vaya canonical-route / published-transfer evidence
 * - Municipal GIS same-shape evidence
 * - Gautrain published service-membership evidence
 *
 * IMPORTANT:
 * This module does NOT authorize passenger routing.
 * It does not infer exact fares, ETAs, boarding points,
 * operating status, stopping order or service direction.
 */

import type { Location } from "../types";

import {
  ReaVayaApplicabilityEngine,
} from "./reaVayaApplicabilityEngine";

import {
  screenUnifiedCoverage,
  type UnifiedCoverageRaw,
} from "./unifiedCoverageCore.mjs";

// ======================================================
// REA VAYA TYPES
// ======================================================

type ReaVayaResult = ReturnType<
  typeof ReaVayaApplicabilityEngine.evaluate
>;

export type ReaVayaCoverage = {
  status: ReaVayaResult["status"];

  routes: string[];

  /**
   * Backward-compatible flat collection used by
   * the current developer panel.
   */
  publishedTransfers: string[];

  /**
   * Complete transfer evidence.
   */
  transferDetails: ReaVayaResult["transfers"];

  evidence: ReaVayaResult["evidence"];

  direct: boolean;

  accessDistanceKm:
    ReaVayaResult["accessDistanceKm"];

  egressDistanceKm:
    ReaVayaResult["egressDistanceKm"];

  totalAccessWalkingKm:
    ReaVayaResult["totalAccessWalkingKm"];

  exactFare: null;
  etaMinutes: null;

  directionVerified: false;

  selectable: false;
};

// ======================================================
// NORMALIZED PHASE 2E CANDIDATE
// ======================================================

export type UnifiedJourneyEvidenceKind =
  | "canonical-route"
  | "published-transfer"
  | "gis-shape"
  | "published-service-membership";

export type UnifiedJourneyCandidateStatus =
  | "direct"
  | "transfer"
  | "geographic-evidence"
  | "service-membership";

export type UnifiedJourneyCandidate = {
  id: string;

  operatorId: string;
  operatorName: string;

  mode:
    | "bus"
    | "rail";

  status: UnifiedJourneyCandidateStatus;

  evidenceKind: UnifiedJourneyEvidenceKind;

  /**
   * Route/service identifiers supported by the
   * underlying evidence.
   */
  routeCodes: string[];

  routeName?: string;

  transferStops: string[];

  originDistanceMetres: number | null;
  destinationDistanceMetres: number | null;

  /**
   * False for every Phase 2E diagnostic candidate.
   *
   * Geographic or published-network evidence does
   * not yet establish a complete passenger journey.
   */
  passengerRoutingVerified: false;

  directionVerified: false;
  operatingTodayVerified: false;

  fare: null;
  etaMinutes: null;

  selectable: false;
};

// ======================================================
// COMPLETE REPORT
// ======================================================

export type UnifiedCoverageReport =
  UnifiedCoverageRaw & {
    reaVaya: ReaVayaCoverage;

    /**
     * Phase 2E normalized evidence model.
     *
     * Existing shapeMatches / railMatches remain
     * available for backwards compatibility.
     */
    journeyCandidates:
      UnifiedJourneyCandidate[];
  };

// ======================================================
// DISPLAY LABELS
// ======================================================

const operatorName = (
  operatorId: string,
): string => {
  switch (operatorId) {
    case "metrobus":
      return "Metrobus";

    case "areyeng":
      return "A Re Yeng";

    case "tshwane-bus":
      return "Tshwane Bus Service";

    case "gautrain":
      return "Gautrain";

    case "ekurhuleni-gms-unassigned":
      return "Ekurhuleni / GMS";

    default:
      return operatorId;
  }
};

// ======================================================
// ENGINE
// ======================================================

export class UnifiedCoverageEngine {
  static async screen(
    origin: Location,
    destination: Location,
    radiusMetres = 800,
  ): Promise<UnifiedCoverageReport> {
    if (!import.meta.env.DEV) {
      throw new Error(
        "Unified GIS diagnostic is disabled outside local development.",
      );
    }

    if (
      !Number.isFinite(radiusMetres) ||
      radiusMetres < 50 ||
      radiusMetres > 1500
    ) {
      throw new Error(
        "Development screen radius must be 50-1500 metres.",
      );
    }

    // --------------------------------------------------
    // PRIVATE DEV-ONLY GIS RUNTIME
    // --------------------------------------------------

    const response = await fetch(
      "/src/data/transit/gauteng/unified-dev/runtime.json",
      {
        headers: {
          Accept: "application/json",
        },

        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(
        `Private coverage snapshot HTTP ${response.status}`,
      );
    }

    const runtime: unknown =
      await response.json();

    // --------------------------------------------------
    // GIS + RAIL SCREENING
    // --------------------------------------------------

    const coverage =
      screenUnifiedCoverage(
        runtime,
        origin,
        destination,
        {
          radiusMetres,
        },
      );

    // --------------------------------------------------
    // REA VAYA GRAPH
    // --------------------------------------------------

    const rea =
      ReaVayaApplicabilityEngine.evaluate(
        origin,
        destination,
        {
          maxAccessKm:
            radiusMetres / 1000,
        },
      );

    const publishedTransfers = [
      ...new Set(
        rea.transfers.flatMap(
          (transfer) =>
            transfer.sharedStopLabels,
        ),
      ),
    ];

    const reaVaya: ReaVayaCoverage = {
      status:
        rea.status,

      routes:
        [...rea.selectedRoutes],

      publishedTransfers,

      transferDetails:
        rea.transfers.map(
          (transfer) => ({
            ...transfer,

            sharedStopLabels: [
              ...transfer.sharedStopLabels,
            ],
          }),
        ),

      evidence:
        rea.evidence,

      direct:
        rea.direct,

      accessDistanceKm:
        rea.accessDistanceKm,

      egressDistanceKm:
        rea.egressDistanceKm,

      totalAccessWalkingKm:
        rea.totalAccessWalkingKm,

      exactFare:
        null,

      etaMinutes:
        null,

      directionVerified:
        false,

      selectable:
        false,
    };

    // ==================================================
    // PHASE 2E NORMALIZATION
    // ==================================================

    const journeyCandidates:
      UnifiedJourneyCandidate[] = [];

    // --------------------------------------------------
    // REA VAYA
    // --------------------------------------------------

    if (
      rea.status !==
      "unsupported"
    ) {
      journeyCandidates.push({
        id:
          `reavaya:${rea.selectedRoutes.join(
            "-",
          )}`,

        operatorId:
          "reavaya",

        operatorName:
          "Rea Vaya",

        mode:
          "bus",

        status:
          rea.status === "direct"
            ? "direct"
            : "transfer",

        evidenceKind:
          rea.status === "direct"
            ? "canonical-route"
            : "published-transfer",

        routeCodes:
          [...rea.selectedRoutes],

        routeName:
          rea.selectedRoutes.join(
            " → ",
          ),

        transferStops:
          [...publishedTransfers],

        originDistanceMetres:
          rea.accessDistanceKm ===
          null
            ? null
            : Math.round(
                rea.accessDistanceKm *
                  1000,
              ),

        destinationDistanceMetres:
          rea.egressDistanceKm ===
          null
            ? null
            : Math.round(
                rea.egressDistanceKm *
                  1000,
              ),

        passengerRoutingVerified:
          false,

        directionVerified:
          false,

        operatingTodayVerified:
          false,

        fare:
          null,

        etaMinutes:
          null,

        selectable:
          false,
      });
    }

    // --------------------------------------------------
    // MUNICIPAL GIS SHAPES
    //
    // Metrobus, A Re Yeng, Tshwane Bus, Ekurhuleni/GMS,
    // etc. These remain geographic evidence only.
    // --------------------------------------------------

    for (
      const match of
        coverage.shapeMatches
    ) {
      journeyCandidates.push({
        id:
          `gis:${match.operatorId}:${match.routeId}`,

        operatorId:
          match.operatorId,

        operatorName:
          operatorName(
            match.operatorId,
          ),

        mode:
          "bus",

        status:
          "geographic-evidence",

        evidenceKind:
          "gis-shape",

        routeCodes:
          match.routeCode
            ? [match.routeCode]
            : [],

        routeName:
          match.routeName,

        transferStops:
          [],

        originDistanceMetres:
          match.originDistanceMetres,

        destinationDistanceMetres:
          match.destinationDistanceMetres,

        passengerRoutingVerified:
          false,

        directionVerified:
          false,

        operatingTodayVerified:
          false,

        fare:
          null,

        etaMinutes:
          null,

        selectable:
          false,
      });
    }

    // --------------------------------------------------
    // GAUTRAIN PUBLISHED SERVICE MEMBERSHIP
    // --------------------------------------------------

    for (
      const match of
        coverage.railMatches
    ) {
      journeyCandidates.push({
        id:
          `rail:${match.operatorId}:${match.serviceId}:${match.originStation}:${match.destinationStation}`,

        operatorId:
          match.operatorId,

        operatorName:
          operatorName(
            match.operatorId,
          ),

        mode:
          "rail",

        status:
          "service-membership",

        evidenceKind:
          "published-service-membership",

        routeCodes:
          [match.serviceId],

        routeName:
          match.serviceName,

        transferStops:
          [],

        originDistanceMetres:
          match.originDistanceMetres,

        destinationDistanceMetres:
          match.destinationDistanceMetres,

        passengerRoutingVerified:
          false,

        directionVerified:
          false,

        operatingTodayVerified:
          false,

        fare:
          null,

        etaMinutes:
          null,

        selectable:
          false,
      });
    }

    // --------------------------------------------------
    // RESULT
    // --------------------------------------------------

    return {
      ...coverage,

      reaVaya,

      journeyCandidates,
    };
  }
}