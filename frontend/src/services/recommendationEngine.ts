// src/services/recommendationEngine.ts

import {
  TRANSPORT_ZONES,
  type TransportNetworkZone
} from "../data/transportZones";

import type { Location } from "../types";

// ======================================================
// TYPES
// ======================================================

export interface TransportRecommendation {

  id: string;

  mode: string;

  score: number;

  estimatedFare: number;

  estimatedTravelTime: number;

  walkingDistance: number;

  nearestStop?: string;

  reason: string;

  badges: string[];

  color: string;

}

// ======================================================
// ENGINE
// ======================================================

export class RecommendationEngine {

  // ======================================================
  // MAIN ENTRY
  // ======================================================

  static getRecommendations(
    userLocation: Location,
    _destination?: string
  ): TransportRecommendation[] {

    const recommendations: TransportRecommendation[] = [];

    for (const zone of TRANSPORT_ZONES) {

      // ==================================================
      // CHECK IF USER IS INSIDE SERVICE AREA
      // ==================================================

      const zoneDistance =
        this.calculateDistance(
          userLocation.lat,
          userLocation.lng,
          zone.center.lat,
          zone.center.lng
        );

      if (
        zoneDistance >
        zone.coverageRadiusKm
      ) {
        continue;
      }

      // ==================================================
      // FIND CLOSEST STOP
      // ==================================================

      const closestStop =
        this.findClosestStop(
          userLocation,
          zone
        );

      // ==================================================
      // WALKING DISTANCE
      // ==================================================

      const walkingDistance =
        closestStop.distance;

      // ==================================================
      // SCORE
      // ==================================================

      const score =
        this.calculateTransportScore({
          walkingDistance,
          strengths: zone.strengths,
          zoneName: zone.name
        });

      // ==================================================
      // ESTIMATIONS
      // ==================================================

      const estimatedFare =
        this.estimateFare(
          zone.name,
          walkingDistance
        );

      const estimatedTravelTime =
        this.estimateTravelTime(
          zone.name,
          walkingDistance
        );

      // ==================================================
      // BADGES
      // ==================================================

      const badges =
        this.generateBadges(
          zone,
          walkingDistance
        );

      // ==================================================
      // REASON
      // ==================================================

      const reason =
        this.generateReason(
          zone.name,
          walkingDistance
        );

      recommendations.push({

        id: zone.id,

        mode: zone.name,

        score,

        estimatedFare,

        estimatedTravelTime,

        walkingDistance,

        nearestStop:
          closestStop.stop.name,

        reason,

        badges,

        color:
          this.getTransportColor(
            zone.name
          )

      });

    }

    // ====================================================
    // SORT BEST FIRST
    // ====================================================

    return recommendations.sort(
      (a, b) => b.score - a.score
    );

  }

  // ======================================================
  // CLOSEST STOP
  // ======================================================

  private static findClosestStop(
    userLocation: Location,
    zone: TransportNetworkZone
  ) {

    let closest =
      zone.stops[0];

    let closestDistance =
      Infinity;

    for (const stop of zone.stops) {

      const distance =
        this.calculateDistance(
          userLocation.lat,
          userLocation.lng,
          stop.location.lat,
          stop.location.lng
        );

      if (
        distance <
        closestDistance
      ) {

        closestDistance =
          distance;

        closest = stop;

      }

    }

    return {
      stop: closest,
      distance: closestDistance
    };

  }

  // ======================================================
  // SCORE SYSTEM
  // ======================================================

  private static calculateTransportScore({
    walkingDistance,
    strengths,
    zoneName
  }: {
    walkingDistance: number;
    strengths: TransportNetworkZone["strengths"];
    zoneName: string;
  }) {

    let score = 50;

    // ====================================================
    // WALKING PENALTY
    // ====================================================

    if (walkingDistance < 0.2) {
      score += 25;
    }
    else if (walkingDistance < 0.5) {
      score += 15;
    }
    else if (walkingDistance < 1) {
      score += 5;
    }
    else {
      score -= 15;
    }

    // ====================================================
    // NETWORK STRENGTHS
    // ====================================================

    if (strengths.fastest) {
      score += 10;
    }

    if (strengths.cheapest) {
      score += 8;
    }

    if (strengths.reliable) {
      score += 8;
    }

    if (strengths.safest) {
      score += 10;
    }

    if (strengths.leastWalking) {
      score += 10;
    }

    // ====================================================
    // SPECIAL NETWORK BOOSTS
    // ====================================================

    if (zoneName === "Gautrain") {
      score += 5;
    }

    return Math.min(score, 100);

  }

  // ======================================================
  // ESTIMATED FARE
  // ======================================================

  private static estimateFare(
    mode: string,
    _walkingDistance: number
  ) {

    switch (mode) {

      case "Rea Vaya":
        return 18;

      case "A Re Yeng":
        return 16;

      case "Gautrain":
        return 65;

      case "Metrorail":
        return 12;

      case "Minibus Taxi":
        return 20;

      default:
        return 25;

    }

  }

  // ======================================================
  // ESTIMATED TIME
  // ======================================================

  private static estimateTravelTime(
    mode: string,
    walkingDistance: number
  ) {

    const walkingMinutes =
      Math.round(
        walkingDistance * 12
      );

    switch (mode) {

      case "Gautrain":
        return 20 + walkingMinutes;

      case "Rea Vaya":
        return 35 + walkingMinutes;

      case "A Re Yeng":
        return 30 + walkingMinutes;

      case "Metrorail":
        return 40 + walkingMinutes;

      case "Minibus Taxi":
        return 25 + walkingMinutes;

      default:
        return 30 + walkingMinutes;

    }

  }

  // ======================================================
  // BADGES
  // ======================================================

  private static generateBadges(
    zone: TransportNetworkZone,
    walkingDistance: number
  ) {

    const badges: string[] = [];

    if (
      walkingDistance < 0.3
    ) {
      badges.push(
        "Close Nearby"
      );
    }

    if (
      zone.strengths.fastest
    ) {
      badges.push(
        "Fast"
      );
    }

    if (
      zone.strengths.cheapest
    ) {
      badges.push(
        "Affordable"
      );
    }

    if (
      zone.strengths.reliable
    ) {
      badges.push(
        "Reliable"
      );
    }

    if (
      zone.strengths.safest
    ) {
      badges.push(
        "Safe"
      );
    }

    return badges;

  }

  // ======================================================
  // REASON
  // ======================================================

  private static generateReason(
    mode: string,
    walkingDistance: number
  ) {

    if (
      walkingDistance < 0.2
    ) {
      return `${mode} is very close to your current location`;
    }

    if (
      mode === "Gautrain"
    ) {
      return "Fast and reliable for longer distance travel";
    }

    if (
      mode === "Minibus Taxi"
    ) {
      return "Minimal walking with flexible pickup access";
    }

    if (
      mode === "Rea Vaya"
    ) {
      return "Reliable BRT corridor available nearby";
    }

    return `${mode} transport is available nearby`;

  }

  // ======================================================
  // COLORS
  // ======================================================

  private static getTransportColor(
    mode: string
  ) {

    switch (mode) {

      case "Gautrain":
        return "from-yellow-500 to-orange-500";

      case "Rea Vaya":
        return "from-blue-500 to-cyan-500";

      case "A Re Yeng":
        return "from-purple-500 to-pink-500";

      case "Metrorail":
        return "from-green-500 to-emerald-500";

      case "Minibus Taxi":
        return "from-zinc-700 to-zinc-900";

      default:
        return "from-slate-500 to-slate-700";

    }

  }

  // ======================================================
  // HAVERSINE DISTANCE
  // ======================================================

  private static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) {

    const R = 6371;

    const dLat =
      ((lat2 - lat1) * Math.PI) / 180;

    const dLon =
      ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +

      Math.cos(
        (lat1 * Math.PI) / 180
      ) *
        Math.cos(
          (lat2 * Math.PI) / 180
        ) *

      Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c =
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      );

    return R * c;

  }

}