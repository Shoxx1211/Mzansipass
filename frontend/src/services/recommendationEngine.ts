// src/services/recommendationEngine.ts
// Pulse Transit - route-fit recommendation engine
//
// This engine deliberately separates "a network is nearby" from
// "a network can plausibly serve this origin -> destination journey".
// It only returns direct candidates when BOTH ends are close enough to
// configured stops for the same network.

import {
  TRANSPORT_ZONES,
  getFareForDistance,
  type TransportNetworkZone,
  type TransportStop,
} from "../data/transportZones";

import type {
  Location,
  TransitNetwork,
  TransportRecommendation,
} from "../types";
import { HabitEngine } from "./habitEngine";
import { ReaVayaApplicabilityEngine } from "./reaVayaApplicabilityEngine";

export interface RecommendationOptions {
  destination?: string;
  destinationLocation?: Location | null;
  routeDistanceKm?: number | null;
  roadDurationSeconds?: number | null;
  timeOfDay?: Date;
  userPreferences?: {
    preferFastest?: boolean;
    preferCheapest?: boolean;
    maxWalkingDistance?: number; // kilometres, total access + egress
    preferredNetworks?: TransitNetwork[];
  };
  includeAlternatives?: boolean;
  maxRecommendations?: number;
}

export interface ScoredRecommendation extends TransportRecommendation {
  rawScore: number;
  walkingScore: number;
  costScore: number;
  timeScore: number;
  routeFitScore: number;
}

const WALKING_SPEED_KMH = 5;

const SCORE_WEIGHTS = {
  routeFit: 0.4,
  walking: 0.25,
  time: 0.2,
  cost: 0.15,
};

const FALLBACK_NETWORK_SPEED_KMH: Record<TransitNetwork, number> = {
  Taxi: 30,
  Gautrain: 55,
  "Rea Vaya": 24,
  "A Re Yeng": 24,
  "Tshwane Bus Service": 22,
  Metrorail: 35,
  Putco: 28,
};

const ROAD_BASELINE_MULTIPLIER: Record<TransitNetwork, number> = {
  Taxi: 1,
  Gautrain: 0.7,
  "Rea Vaya": 1.15,
  "A Re Yeng": 1.15,
  "Tshwane Bus Service": 1.2,
  Metrorail: 0.95,
  Putco: 1.15,
};

const isPeakHour = (date: Date): boolean => {
  const hour = date.getHours();
  return (hour >= 6 && hour <= 9) || (hour >= 16 && hour <= 19);
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export class RecommendationEngine {
  static getRecommendations(
    userLocation: Location,
    options: RecommendationOptions = {},
  ): TransportRecommendation[] {
    const {
      destinationLocation = null,
      routeDistanceKm = null,
      roadDurationSeconds = null,
      timeOfDay = new Date(),
      userPreferences = {},
      includeAlternatives = true,
      maxRecommendations = 5,
    } = options;

    // Text alone is not enough to claim that a network serves the destination.
    if (!destinationLocation) {
      return [];
    }

    const recommendations: ScoredRecommendation[] = [];
    const isPeak = isPeakHour(timeOfDay);
    const habitPrediction = HabitEngine.predict(userLocation, timeOfDay);

    for (const zone of TRANSPORT_ZONES) {
      if (!zone.enabled || zone.stops.length === 0) continue;

      const network = zone.canonicalNetwork;

      // Rea Vaya uses the evidence-based runtime engine below.
      // Never send it through the older configured-stop approximation.
      if (network === "Rea Vaya") {
        continue;
      }

      if (
        userPreferences.preferredNetworks?.length &&
        !userPreferences.preferredNetworks.includes(network)
      ) {
        continue;
      }

      const originStop = this.findClosestStop(userLocation, zone);
      const destinationStop = this.findClosestStop(destinationLocation, zone);

      // A single nearby stop is not evidence of a usable origin->destination trip.
      if (originStop.stop.id === destinationStop.stop.id) {
        continue;
      }

      if (
        originStop.distance > zone.maxDirectAccessKm ||
        destinationStop.distance > zone.maxDirectEgressKm
      ) {
        continue;
      }

      const totalWalkingDistance =
        originStop.distance + destinationStop.distance;

      if (
        userPreferences.maxWalkingDistance !== undefined &&
        totalWalkingDistance > userPreferences.maxWalkingDistance
      ) {
        continue;
      }

      const straightServiceDistance = this.calculateDistance(
        originStop.stop.location.lat,
        originStop.stop.location.lng,
        destinationStop.stop.location.lat,
        destinationStop.stop.location.lng,
      );

      // Configured stops are points, not route geometry. Add a small path factor
      // rather than pretending the straight-line distance is exact.
      const serviceDistanceKm = Math.max(0.5, straightServiceDistance * 1.12);

      const configuredFare = getFareForDistance(
        zone,
        serviceDistanceKm,
        isPeak,
      );

      // Do not invent a fare outside the configured fare table.
      if (configuredFare === null) {
        continue;
      }

      const estimatedTime = this.estimateTravelTimeMinutes({
        network,
        zone,
        serviceDistanceKm,
        walkingDistanceKm: totalWalkingDistance,
        routeDistanceKm,
        roadDurationSeconds,
        isPeak,
      });

      const routeFitScore = this.calculateRouteFitScore(
        originStop.distance,
        destinationStop.distance,
        zone,
      );
      const walkingScore = this.calculateWalkingScore(totalWalkingDistance);
      const costScore = this.calculateCostScore(configuredFare);
      const timeScore = this.calculateTimeScore(estimatedTime);

      let rawScore =
        routeFitScore * SCORE_WEIGHTS.routeFit +
        walkingScore * SCORE_WEIGHTS.walking +
        timeScore * SCORE_WEIGHTS.time +
        costScore * SCORE_WEIGHTS.cost;

      // Habits may break a tie, but they can never make an invalid network valid.
      if (
        habitPrediction.network === network &&
        habitPrediction.confidence > 0.6
      ) {
        rawScore += Math.min(4, habitPrediction.confidence * 4);
      }

      if (userPreferences.preferFastest) {
        rawScore += timeScore * 0.08;
      }

      if (userPreferences.preferCheapest) {
        rawScore += costScore * 0.08;
      }

      const score = Math.round(clamp(rawScore, 0, 100));
      const badges = this.generateBadges(
        zone,
        totalWalkingDistance,
        configuredFare,
        estimatedTime,
      );

      recommendations.push({
        fareStatus: "unverified",
selectable: false,
        id: `${zone.id}:${originStop.stop.id}:${destinationStop.stop.id}`,
        mode: network,
        score,
        rawScore,
        walkingScore,
        costScore,
        timeScore,
        routeFitScore,
        estimatedFare: configuredFare,
        estimatedTime,
        estimatedTravelTime: estimatedTime,
        walkingDistance: Math.round(totalWalkingDistance * 100) / 100,
        serviceDistanceKm: Math.round(serviceDistanceKm * 10) / 10,
        nearestStop: originStop.stop.name,
        destinationStop: destinationStop.stop.name,
        routeName: `${originStop.stop.name} → ${destinationStop.stop.name}`,
        subtitle: "Direct network candidate",
        reason: this.generateReason(
          zone,
          originStop.distance,
          destinationStop.distance,
        ),
        badges,
        color: this.getTransportColor(network),
        confidence: this.calculateConfidence(
          zone,
          originStop.distance,
          destinationStop.distance,
        ),
        dataQuality: zone.dataStatus === "verified" ? "verified" : "configured",
        direct: true,
        alternativeStops: includeAlternatives
          ? this.getAlternativeStops(zone, userLocation, originStop.stop.id)
          : undefined,
      });
    }

    // ======================================================
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
            `reavaya:${selectedRoutes.join(
              "-",
            )}`,

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

          // A published whole-network range is not this passenger's fare.
          // Null prevents selecting a journey from displaying R0.
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
              ? `Official Rea Vaya route geometry for ${selectedRoutes.join(
                  ", ",
                )} is within Pulse's 800 m engineering access threshold at both ends. Exact fare, service direction and transit time remain unverified.`
              : `Pulse found a Rea Vaya path across ${selectedRoutes.join(
                  " → ",
                )} using canonical route geometry and published shared-stop connectivity. Timed transfer compatibility remains unverified.`,

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

          // The commuter may choose and track this evidence-backed route.
          // Missing fare/time stays explicitly unverified and can be
          // confirmed after the journey.
          selectable:
            true,
        });
      }
    }

    const sorted = recommendations.sort((a, b) => {
      if (userPreferences.preferCheapest) {
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
      }

      return b.score - a.score;
    });

    return sorted.slice(0, maxRecommendations);
  }

  static getBestRecommendation(
    userLocation: Location,
    options: RecommendationOptions = {},
  ): TransportRecommendation | null {
    return this.getRecommendations(userLocation, options)[0] ?? null;
  }

  static compareOptions(
    option1: TransportRecommendation,
    option2: TransportRecommendation,
  ): {
    winner: TransportRecommendation;
    differences: string[];
  } {
    const differences: string[] = [];

    if (
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
        `${this.displayMode(
          cheaper.mode,
        )} is about R${Math.abs(
          dearer.estimatedFare! -
            cheaper.estimatedFare!,
        ).toFixed(0)} cheaper`,
      );
    }

    if (
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
        `${this.displayMode(
          faster.mode,
        )} is about ${Math.abs(
          slower.estimatedTime! -
            faster.estimatedTime!,
        )} min quicker`,
      );
    }

    if (option1.walkingDistance !== option2.walkingDistance) {
      const lessWalking =
        option1.walkingDistance < option2.walkingDistance ? option1 : option2;
      const moreWalking = lessWalking === option1 ? option2 : option1;
      differences.push(
        `${this.displayMode(lessWalking.mode)} has ${Math.abs(
          moreWalking.walkingDistance - lessWalking.walkingDistance,
        ).toFixed(1)} km less access walking`,
      );
    }

    return {
      winner: option1.score >= option2.score ? option1 : option2,
      differences,
    };
  }

  private static findClosestStop(
    location: Location,
    zone: TransportNetworkZone,
  ): { stop: TransportStop; distance: number } {
    let closest = zone.stops[0];
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const stop of zone.stops) {
      const distance = this.calculateDistance(
        location.lat,
        location.lng,
        stop.location.lat,
        stop.location.lng,
      );

      if (distance < closestDistance) {
        closest = stop;
        closestDistance = distance;
      }
    }

    return { stop: closest, distance: closestDistance };
  }

  private static getAlternativeStops(
    zone: TransportNetworkZone,
    userLocation: Location,
    currentStopId: string,
  ): string[] {
    return zone.stops
      .filter((stop) => stop.id !== currentStopId)
      .map((stop) => ({
        name: stop.name,
        distance: this.calculateDistance(
          userLocation.lat,
          userLocation.lng,
          stop.location.lat,
          stop.location.lng,
        ),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
      .map((item) => item.name);
  }

  private static estimateTravelTimeMinutes(args: {
    network: TransitNetwork;
    zone: TransportNetworkZone;
    serviceDistanceKm: number;
    walkingDistanceKm: number;
    routeDistanceKm: number | null;
    roadDurationSeconds: number | null;
    isPeak: boolean;
  }): number {
    const {
      network,
      zone,
      serviceDistanceKm,
      walkingDistanceKm,
      routeDistanceKm,
      roadDurationSeconds,
      isPeak,
    } = args;

    const walkingMinutes = (walkingDistanceKm / WALKING_SPEED_KMH) * 60;

    const frequency = zone.averageFrequency
      ? isPeak
        ? zone.averageFrequency.peak
        : zone.averageFrequency.offPeak
      : 16;

    const expectedWaitMinutes = clamp(frequency / 2, 2, 20);

    let inVehicleMinutes: number;

    if (
      roadDurationSeconds !== null &&
      routeDistanceKm !== null &&
      routeDistanceKm > 0 &&
      roadDurationSeconds > 0
    ) {
      const roadMinutesPerKm = roadDurationSeconds / 60 / routeDistanceKm;
      inVehicleMinutes =
        serviceDistanceKm *
        roadMinutesPerKm *
        ROAD_BASELINE_MULTIPLIER[network];
    } else {
      inVehicleMinutes =
        (serviceDistanceKm / FALLBACK_NETWORK_SPEED_KMH[network]) * 60;
    }

    return Math.max(
      1,
      Math.round(walkingMinutes + expectedWaitMinutes + inVehicleMinutes),
    );
  }

  private static calculateRouteFitScore(
    accessKm: number,
    egressKm: number,
    zone: TransportNetworkZone,
  ): number {
    const accessRatio = accessKm / Math.max(zone.maxDirectAccessKm, 0.1);
    const egressRatio = egressKm / Math.max(zone.maxDirectEgressKm, 0.1);
    const worstRatio = Math.max(accessRatio, egressRatio);
    return clamp(100 - worstRatio * 55, 35, 100);
  }

  private static calculateWalkingScore(walkingDistanceKm: number): number {
    if (walkingDistanceKm <= 0.4) return 100;
    if (walkingDistanceKm <= 0.8) return 90;
    if (walkingDistanceKm <= 1.5) return 75;
    if (walkingDistanceKm <= 2.5) return 55;
    if (walkingDistanceKm <= 4) return 35;
    return 20;
  }

  private static calculateCostScore(fare: number): number {
    if (fare <= 15) return 100;
    if (fare <= 25) return 90;
    if (fare <= 45) return 75;
    if (fare <= 70) return 60;
    if (fare <= 120) return 45;
    return 30;
  }

  private static calculateTimeScore(minutes: number): number {
    if (minutes <= 20) return 100;
    if (minutes <= 35) return 85;
    if (minutes <= 50) return 70;
    if (minutes <= 75) return 55;
    if (minutes <= 105) return 40;
    return 25;
  }

  private static calculateConfidence(
    zone: TransportNetworkZone,
    accessKm: number,
    egressKm: number,
  ): number {
    const base = zone.dataStatus === "verified" ? 0.86 : 0.52;
    const accessBonus =
      accessKm <= 0.5 && egressKm <= 0.5
        ? 0.1
        : accessKm <= 1 && egressKm <= 1
          ? 0.05
          : 0;

    return Math.round(clamp(base + accessBonus, 0.4, 0.95) * 100) / 100;
  }

  private static generateBadges(
    zone: TransportNetworkZone,
    walkingDistanceKm: number,
    fare: number,
    estimatedTime: number,
  ): string[] {
    const badges = ["DIRECT"];

    if (walkingDistanceKm <= 1) badges.push("LOW_WALK");
    if (fare <= 25) badges.push("LOW_FARE");
    if (estimatedTime <= 35) badges.push("QUICK_ESTIMATE");
    if (zone.dataStatus === "seed") badges.push("CONFIGURED_DATA");

    return badges.slice(0, 4);
  }

  private static generateReason(
    zone: TransportNetworkZone,
    accessKm: number,
    egressKm: number,
  ): string {
    const accessText =
      accessKm < 0.1 ? "under 100 m" : `${accessKm.toFixed(1)} km`;
    const egressText =
      egressKm < 0.1 ? "under 100 m" : `${egressKm.toFixed(1)} km`;

    return `Configured ${zone.name} stops are ${accessText} from your origin and ${egressText} from your destination. Pulse is treating this as a direct candidate, not a live operator-confirmed route.`;
  }

  private static getTransportColor(network: TransitNetwork): string {
    const colors: Record<TransitNetwork, string> = {
      Taxi: "from-amber-600 to-orange-600",
      Gautrain: "from-yellow-500 to-orange-500",
      "Rea Vaya": "from-blue-500 to-cyan-500",
      "A Re Yeng": "from-purple-500 to-pink-500",
      "Tshwane Bus Service": "from-teal-500 to-emerald-500",
      Metrorail: "from-green-500 to-emerald-500",
      Putco: "from-sky-500 to-blue-600",
    };

    return colors[network];
  }

  private static displayMode(mode: TransitNetwork): string {
    return mode === "Taxi" ? "Minibus Taxi" : mode;
  }

  private static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
