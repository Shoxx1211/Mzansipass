// src/services/fareService.ts
// Pulse Transit - transparent fare estimation
//
// Fares come from configured network fare tables or verified user-reported
// fares. This service intentionally does NOT invent surge pricing, holiday
// surcharges, app discounts, luggage fees, or group discounts.

import type { TransitNetwork } from "../types";
import {
  TRANSPORT_ZONES,
  TAXI_FARE_ZONES,
  getFareForDistance,
  type TransportNetworkZone,
} from "../data/transportZones";

export interface FareContext {
  isPeak: boolean;
  isNight: boolean;
  isWeekend: boolean;
  isHoliday?: boolean;
  isRaining?: boolean;
  demandMultiplier?: number;
}

export interface FareInput {
  network: TransitNetwork;
  distance: number;
  context?: FareContext;
  passengerCount?: number;
  hasLuggage?: boolean;
  isRoundTrip?: boolean;
  paymentMethod?: "cash" | "card" | "app";
}

export interface FareResult {
  fare: number;
  originalFare?: number;
  confidence: number;
  source: "configured" | "learned";
  breakdown?: FareBreakdown;
  discounts?: FareDiscount[];
  surgeMultiplier?: number;
}

export interface FareBreakdown {
  baseFare: number;
  distanceCharge: number;
  peakSurcharge: number;
  nightSurcharge: number;
  weekendDiscount: number;
  luggageFee: number;
  groupDiscount: number;
  roundTripDiscount: number;
  paymentDiscount: number;
  total: number;
}

export interface FareDiscount {
  type: string;
  amount: number;
  percentage?: number;
  reason: string;
}

export interface LearnedFare {
  network: TransitNetwork;
  distance: number;
  actualFare: number;
  estimatedFare: number;
  timestamp: number;
  accuracy: number;
}

const CONFIG = {
  MIN_FARE: 1,
  MAX_FARE: 1000,
  MAX_LEARNED_AGE_MS: 30 * 24 * 60 * 60 * 1000,
  SIMILAR_DISTANCE_KM: 4,
  MIN_LEARNED_SAMPLES: 2,
};

const PEAK_HOURS = {
  morning: { start: 6, end: 9 },
  evening: { start: 16, end: 19 },
};

const FARE_LEARNING_KEY = "pulse_fare_learning_v2";

interface LearnedFareMatch {
  fare: number;
  confidence: number;
  samples: number;
}

class FareLearningCache {
  private data: LearnedFare[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const saved = localStorage.getItem(FARE_LEARNING_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return;

      const cutoff = Date.now() - CONFIG.MAX_LEARNED_AGE_MS;
      this.data = parsed.filter(
        (item): item is LearnedFare =>
          item &&
          typeof item.network === "string" &&
          Number.isFinite(item.distance) &&
          Number.isFinite(item.actualFare) &&
          Number.isFinite(item.timestamp) &&
          item.timestamp >= cutoff,
      );
    } catch (error) {
      console.warn("Pulse fare learning cache could not be loaded:", error);
      this.data = [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(FARE_LEARNING_KEY, JSON.stringify(this.data));
    } catch (error) {
      console.warn("Pulse fare learning cache could not be saved:", error);
    }
  }

  add(learned: LearnedFare): void {
    this.data.push(learned);
    this.data = this.data.slice(-1000);
    this.save();
  }

  getSimilar(network: TransitNetwork, distance: number): LearnedFareMatch | null {
    const cutoff = Date.now() - CONFIG.MAX_LEARNED_AGE_MS;

    const similar = this.data.filter(
      (item) =>
        item.network === network &&
        item.timestamp >= cutoff &&
        Math.abs(item.distance - distance) <= CONFIG.SIMILAR_DISTANCE_KM &&
        item.actualFare > 0,
    );

    if (similar.length < CONFIG.MIN_LEARNED_SAMPLES) {
      return null;
    }

    const weights = similar.map((item) => {
      const distanceDifference = Math.abs(item.distance - distance);
      const recencyDays = Math.max(
        0,
        (Date.now() - item.timestamp) / (24 * 60 * 60 * 1000),
      );

      const distanceWeight = 1 / (1 + distanceDifference);
      const recencyWeight = 1 / (1 + recencyDays / 14);
      return distanceWeight * recencyWeight;
    });

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const weightedFare = similar.reduce(
      (sum, item, index) => sum + item.actualFare * weights[index],
      0,
    ) / Math.max(totalWeight, 0.0001);

    const confidence = Math.min(0.88, 0.58 + similar.length * 0.06);

    return {
      fare: weightedFare,
      confidence,
      samples: similar.length,
    };
  }
}

const fareLearning = new FareLearningCache();

const getNetworkZone = (
  network: TransitNetwork,
): TransportNetworkZone | undefined =>
  TRANSPORT_ZONES.find((zone) => zone.canonicalNetwork === network);

const emptyBreakdown = (fare: number): FareBreakdown => ({
  baseFare: fare,
  distanceCharge: 0,
  peakSurcharge: 0,
  nightSurcharge: 0,
  weekendDiscount: 0,
  luggageFee: 0,
  groupDiscount: 0,
  roundTripDiscount: 0,
  paymentDiscount: 0,
  total: fare,
});

/**
 * Provisional MINIBUS taxi guide, not a current association fare sheet.
 * The original locally configured distance bands are seed assumptions.
 * Do not use this as proof of a rank, a through route, or a fixed fare.
 * A local observed-fare cache can supersede the midpoint via FareEngine.
 */
export const getTaxiFareGuide = (
  distanceKm: number | null | undefined,
): { minimum: number; maximum: number; midpoint: number } | null => {
  if (
    distanceKm === null ||
    distanceKm === undefined ||
    !Number.isFinite(distanceKm) ||
    distanceKm <= 0
  ) return null;

  const band = TAXI_FARE_ZONES.find(
    (zone) =>
      distanceKm >= zone.fromDistance &&
      distanceKm <= zone.toDistance,
  );
  if (!band) return null;

  // Explicitly broad uncertainty: ticket prices vary by association/route.
  const low = Math.max(5, Math.round((Math.min(band.peakFare, band.offPeakFare) * 0.8) / 5) * 5);
  const high = Math.ceil((Math.max(band.peakFare, band.offPeakFare) * 1.3) / 5) * 5;
  return {
    minimum: low,
    maximum: high,
    midpoint: Math.round(((low + high) / 2) / 5) * 5,
  };
};

export type OperatorFareGuide = {
  minimum: number;
  maximum: number;
  midpoint: number;
  basis:
    | "provisional-taxi"
    | "operator-estimate"
    | "published-range";
};

/**
 * 2026/27 City of Tshwane AFC single-trip bands. The City publishes the same
 * bands for Tshwane Bus Services and A Re Yeng and defines the band distance
 * as straight-line distance. These values apply from 1 July 2026 to 30 June 2027.
 */
const TSHWANE_2026_27_FARES = [
  { maxKm: 8, fare: 14 },
  { maxKm: 14, fare: 20 },
  { maxKm: 21, fare: 24.5 },
  { maxKm: 29, fare: 27 },
  { maxKm: 38, fare: 31 },
  { maxKm: 48, fare: 33 },
  { maxKm: Number.POSITIVE_INFINITY, fare: 36.5 },
] as const;

const roundMoney = (value: number): number =>
  Math.round(value * 100) / 100;

/**
 * Give every supported operator a useful commuter-facing estimate without
 * pretending a broad guide is an exact ticket quote.
 *
 * Exact published fares already attached to a recommendation always win.
 * This helper is only the fallback used when the route engine cannot prove
 * a stop-to-stop fare yet.
 */
export const getOperatorFareGuide = (
  network: TransitNetwork,
  distanceKm: number | null | undefined,
): OperatorFareGuide | null => {
  const hasDistance =
    typeof distanceKm === "number" &&
    Number.isFinite(distanceKm) &&
    distanceKm > 0;

  if (network === "Taxi") {
    const taxi = getTaxiFareGuide(distanceKm);
    if (taxi) return { ...taxi, basis: "provisional-taxi" };
    // Missing distance still gets a broad pilot guide. Beyond the seeded
    // bands, scale the longest-distance band as a provisional estimate.
    const last = TAXI_FARE_ZONES[TAXI_FARE_ZONES.length - 1];
    const scale = hasDistance ? Math.max(1, distanceKm! / last.toDistance) : 1;
    const minimum = hasDistance
      ? Math.floor(last.offPeakFare * 0.8 * scale / 5) * 5
      : Math.floor(Math.min(...TAXI_FARE_ZONES.map(band => band.offPeakFare)) * 0.8 / 5) * 5;
    const maximum = Math.ceil(last.peakFare * 1.3 * scale / 5) * 5;
    return { minimum, maximum, midpoint: Math.round((minimum + maximum) / 10) * 5,
      basis: "provisional-taxi" };
  }

  if (network === "A Re Yeng" || network === "Tshwane Bus Service") {
    if (!hasDistance) {
      return {
        minimum: 14,
        maximum: 36.5,
        midpoint: 24.5,
        basis: "published-range",
      };
    }

    const band =
      TSHWANE_2026_27_FARES.find((item) => distanceKm! <= item.maxKm) ??
      TSHWANE_2026_27_FARES[TSHWANE_2026_27_FARES.length - 1];
    return {
      minimum: band.fare,
      maximum: band.fare,
      midpoint: band.fare,
      basis: "operator-estimate",
    };
  }

  // Gautrain's current 1 September 2026 pay-as-you-go matrix spans R30–R258.
  // Direct station-pair matches normally carry the exact published fare; this
  // range is only used when the station pair is not yet resolved.
  if (network === "Gautrain") {
    return {
      minimum: 30,
      maximum: 258,
      midpoint: 79,
      basis: "published-range",
    };
  }

  // Rea Vaya's official 2026/27 journey bands span R10 off-peak to R28.50
  // peak. Route-specific published ranges attached by the Rea Vaya engine
  // take priority over this network fallback.
  if (network === "Rea Vaya") {
    return {
      minimum: 10,
      maximum: 28.5,
      midpoint: 19.5,
      basis: "published-range",
    };
  }

  // PUTCO is zone/ticket-code priced rather than a universal per-km service.
  // Until Pulse resolves a passenger's exact zone pair, keep a deliberately
  // broad estimate instead of presenting a made-up exact fare.
  if (network === "Putco") {
    return {
      minimum: 20,
      maximum: 60,
      midpoint: 40,
      basis: "operator-estimate",
    };
  }

  // Current PRASA/Metrorail exact station-pair fares are not yet normalised in
  // Pulse. Use the configured Gauteng pilot bands as an explicitly provisional
  // estimate, never as a published fare.
  if (network === "Metrorail") {
    if (hasDistance) {
      const zone = getNetworkZone("Metrorail");
      const fare = zone
        ? getFareForDistance(zone, distanceKm!, thisFareContext().isPeak)
        : null;
      if (fare !== null) {
        const spread = 0.15;
        return {
          minimum: roundMoney(fare * (1 - spread)),
          maximum: roundMoney(fare * (1 + spread)),
          midpoint: roundMoney(fare),
          basis: "operator-estimate",
        };
      }
    }
    return {
      minimum: 9,
      maximum: 35,
      midpoint: 22,
      basis: "operator-estimate",
    };
  }

  return null;
};

const thisFareContext = (): FareContext => {
  const hour = new Date().getHours();
  const day = new Date().getDay();
  return {
    isPeak:
      (hour >= PEAK_HOURS.morning.start && hour <= PEAK_HOURS.morning.end) ||
      (hour >= PEAK_HOURS.evening.start && hour <= PEAK_HOURS.evening.end),
    isNight: hour >= 20 || hour <= 4,
    isWeekend: day === 0 || day === 6,
    demandMultiplier: 1,
  };
};

export class FareEngine {
  static getTimeContext(date = new Date()): FareContext {
    const hour = date.getHours();
    const day = date.getDay();

    return {
      isPeak:
        (hour >= PEAK_HOURS.morning.start && hour <= PEAK_HOURS.morning.end) ||
        (hour >= PEAK_HOURS.evening.start && hour <= PEAK_HOURS.evening.end),
      isNight: hour >= 20 || hour <= 4,
      isWeekend: day === 0 || day === 6,
      demandMultiplier: 1,
    };
  }

  static async computeFinalFare(input: FareInput): Promise<FareResult> {
    const safeDistance = Number.isFinite(input.distance)
      ? Math.max(0, input.distance)
      : 0;

    if (safeDistance <= 0) {
      throw new Error("A positive service distance is required for fare estimation.");
    }

    const context = input.context ?? this.getTimeContext();

    const learned = fareLearning.getSimilar(input.network, safeDistance);
    if (learned) {
      const fare = this.finalizeFare(learned.fare);
      return {
        fare,
        originalFare: fare,
        confidence: learned.confidence,
        source: "learned",
        breakdown: emptyBreakdown(fare),
      };
    }

    const zone = getNetworkZone(input.network);
    if (!zone) {
      throw new Error(`No fare configuration exists for ${input.network}.`);
    }

    const configuredFare = getFareForDistance(
      zone,
      safeDistance,
      context.isPeak,
    );

    if (configuredFare === null) {
      throw new Error(
        `No configured ${input.network} fare covers ${safeDistance.toFixed(1)} km.`,
      );
    }

    const fare = this.finalizeFare(configuredFare);
    const confidence = zone.dataStatus === "verified" ? 0.9 : 0.58;

    return {
      fare,
      originalFare: fare,
      confidence,
      source: "configured",
      breakdown: emptyBreakdown(fare),
    };
  }

  static calculateBaseFare(
    network: TransitNetwork,
    distance: number,
    context: FareContext = this.getTimeContext(),
  ): number {
    const zone = getNetworkZone(network);
    if (!zone) {
      throw new Error(`No fare configuration exists for ${network}.`);
    }

    const configuredFare = getFareForDistance(
      zone,
      Math.max(0, distance),
      context.isPeak,
    );

    if (configuredFare === null) {
      throw new Error(
        `No configured ${network} fare covers ${distance.toFixed(1)} km.`,
      );
    }

    return this.finalizeFare(configuredFare);
  }

  static learnFare(
    estimated: number,
    actual: number,
    network: string,
    distance: number,
  ): void {
    if (
      !Number.isFinite(actual) ||
      actual <= 0 ||
      !Number.isFinite(distance) ||
      distance <= 0
    ) {
      return;
    }

    const safeEstimated =
      Number.isFinite(estimated) && estimated > 0 ? estimated : actual;
    const ratio = actual / safeEstimated;
    const accuracy = ratio > 1 ? 1 / ratio : ratio;

    fareLearning.add({
      network: network as TransitNetwork,
      distance,
      actualFare: actual,
      estimatedFare: safeEstimated,
      timestamp: Date.now(),
      accuracy: Math.max(0, Math.min(1, accuracy)),
    });
  }

  static async compareNetworks(
    distance: number,
    networks: TransitNetwork[],
  ): Promise<Map<TransitNetwork, number>> {
    const results = new Map<TransitNetwork, number>();
    const context = this.getTimeContext();

    for (const network of networks) {
      try {
        results.set(
          network,
          this.calculateBaseFare(network, distance, context),
        );
      } catch {
        // Missing/unsupported configured fares are intentionally omitted.
      }
    }

    return results;
  }

  static async getPriceRange(
    network: TransitNetwork,
    distance: number,
  ): Promise<{ min: number; max: number; avg: number }> {
    const learned = fareLearning.getSimilar(network, distance);
    if (learned) {
      const avg = this.finalizeFare(learned.fare);
      return {
        min: this.finalizeFare(avg * 0.9),
        max: this.finalizeFare(avg * 1.1),
        avg,
      };
    }

    const avg = this.calculateBaseFare(network, distance, this.getTimeContext());
    const zone = getNetworkZone(network);
    const spread = zone?.dataStatus === "verified" ? 0.05 : 0.15;

    return {
      min: this.finalizeFare(avg * (1 - spread)),
      max: this.finalizeFare(avg * (1 + spread)),
      avg,
    };
  }

  static isSurgeActive(_network: string): boolean {
    return false;
  }

  static getSurgeReason(_network: string): string | null {
    return null;
  }

  private static finalizeFare(value: number): number {
    const safe = Math.min(CONFIG.MAX_FARE, Math.max(CONFIG.MIN_FARE, value));
    return Math.round(safe * 100) / 100;
  }
}

export { fareLearning };
