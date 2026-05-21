// src/services/recommendationEngine.ts
// Pulse Transit - Premium Recommendation Engine
// Features: Real-time factors, personalization, multi-modal scoring, learning from history

import {
  TRANSPORT_ZONES,
  type TransportNetworkZone
} from "../data/transportZones";

import type {
  Location,
  TransitNetwork,
  TransportRecommendation
} from "../types";
import { HabitEngine } from "./habitEngine";



// ======================================================
// TYPES
// ======================================================



export interface RecommendationOptions {
  destination?: string;
  timeOfDay?: Date;
  userPreferences?: {
    preferFastest?: boolean;
    preferCheapest?: boolean;
    preferSafest?: boolean;
    maxWalkingDistance?: number;
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
  safetyScore: number;
  reliabilityScore: number;
}

// ======================================================
// CONSTANTS
// ======================================================

const TIME_WEIGHTS = {
  PEAK_MULTIPLIER: 1.3,
  OFF_PEAK_MULTIPLIER: 0.9,
  NIGHT_MULTIPLIER: 1.2
};

const SCORE_WEIGHTS = {
  walking: 0.25,
  cost: 0.25,
  time: 0.2,
  safety: 0.15,
  reliability: 0.15
};

const WALKING_SPEED_KMH = 5;

// ======================================================
// HELPER FUNCTIONS
// ======================================================

const isPeakHour = (date: Date): boolean => {
  const hour = date.getHours();
  return (hour >= 6 && hour <= 9) || (hour >= 16 && hour <= 19);
};

const isNightTime = (date: Date): boolean => {
  const hour = date.getHours();
  return hour >= 20 || hour <= 4;
};

const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

// ======================================================
// MAIN ENGINE
// ======================================================

export class RecommendationEngine {

  static getRecommendations(
    userLocation: Location,
    options: RecommendationOptions = {}
  ): TransportRecommendation[] {
    const { 
      timeOfDay = new Date(),
      userPreferences = {},
      includeAlternatives = true,
      maxRecommendations = 5
    } = options;

    const recommendations: ScoredRecommendation[] = [];
    const isPeak = isPeakHour(timeOfDay);
    const isNight = isNightTime(timeOfDay);
    const isWeekendDay = isWeekend(timeOfDay);

    const habitPrediction = HabitEngine.predict(userLocation, timeOfDay);

    for (const zone of TRANSPORT_ZONES) {
      if (userPreferences.preferredNetworks?.length && 
          !userPreferences.preferredNetworks.includes(zone.name as TransitNetwork)) {
        continue;
      }

      const zoneDistance = this.calculateDistance(
        userLocation.lat, userLocation.lng,
        zone.center.lat, zone.center.lng
      );

      if (zoneDistance > zone.coverageRadiusKm) {
        continue;
      }

      const closestStop = this.findClosestStop(userLocation, zone);
      const walkingDistance = closestStop.distance;

      if (userPreferences.maxWalkingDistance && 
          walkingDistance > userPreferences.maxWalkingDistance) {
        continue;
      }

      let estimatedFare = this.estimateFare(zone.name, walkingDistance);
      if (isPeak && zone.name === "Gautrain") {
        estimatedFare *= TIME_WEIGHTS.PEAK_MULTIPLIER;
      } else if (isNight && zone.name === "Taxi") {
        estimatedFare *= TIME_WEIGHTS.NIGHT_MULTIPLIER;
      } else if (isWeekendDay) {
        estimatedFare *= 0.95;
      }

      let estimatedTravelTime = this.estimateTravelTime(zone.name, walkingDistance);
      if (isPeak) {
        estimatedTravelTime *= TIME_WEIGHTS.PEAK_MULTIPLIER;
      }

      const walkingScore = this.calculateWalkingScore(walkingDistance, userPreferences.preferFastest);
      const costScore = this.calculateCostScore(estimatedFare, zone.name, userPreferences.preferCheapest);
      const timeScore = this.calculateTimeScore(estimatedTravelTime, userPreferences.preferFastest);
      const safetyScore = this.calculateSafetyScore(zone, isNight, userPreferences.preferSafest);
      const reliabilityScore = this.calculateReliabilityScore(zone, isPeak);

      const rawScore = (
        walkingScore * SCORE_WEIGHTS.walking +
        costScore * SCORE_WEIGHTS.cost +
        timeScore * SCORE_WEIGHTS.time +
        safetyScore * SCORE_WEIGHTS.safety +
        reliabilityScore * SCORE_WEIGHTS.reliability
      );

      let finalScore = rawScore;
      if (habitPrediction.network === zone.name && habitPrediction.confidence > 0.6) {
        finalScore = Math.min(100, finalScore * (1 + habitPrediction.confidence * 0.2));
      }

      const badges = this.generateBadges(zone, walkingDistance, isPeak, isNight);
      let reason = this.generateReason(zone.name, walkingDistance, habitPrediction);
      
      let peakSurcharge: number | undefined;
      if ((isPeak && zone.name === "Gautrain") || (isNight && zone.name === "Taxi")) {
        peakSurcharge = estimatedFare * (isPeak ? 0.1 : 0.15);
        reason += isPeak ? " (Peak hour pricing applies)" : " (Night surcharge applies)";
      }

      recommendations.push({
        id: zone.id,
        mode: zone.name,
        score: Math.min(100, Math.max(0, Math.round(finalScore))),
        rawScore,
        walkingScore,
        costScore,
        timeScore,
        safetyScore,
        reliabilityScore,
        estimatedFare: Math.round(estimatedFare * 100) / 100,
        estimatedTravelTime: Math.round(estimatedTravelTime),
        walkingDistance: Math.round(walkingDistance * 100) / 100,
        nearestStop: closestStop.stop.name,
        reason,
        badges,
        color: this.getTransportColor(zone.name),
        confidence: this.calculateConfidence(zone, walkingDistance),
        alternativeStops: includeAlternatives ? 
          this.getAlternativeStops(zone, userLocation, closestStop.stop.id) : 
          undefined,
        peakSurcharge
      });
    }

    const sorted = recommendations.sort((a, b) => b.score - a.score);
    
    if (userPreferences.preferCheapest) {
      sorted.sort((a, b) => a.estimatedFare - b.estimatedFare);
    } else if (userPreferences.preferFastest) {
      sorted.sort((a, b) => a.estimatedTravelTime - b.estimatedTravelTime);
    }
    
    return sorted.slice(0, maxRecommendations);
  }

  static getBestRecommendation(
    userLocation: Location,
    options: RecommendationOptions = {}
  ): TransportRecommendation | null {
    const recommendations = this.getRecommendations(userLocation, options);
    return recommendations[0] || null;
  }

  static compareOptions(
    option1: TransportRecommendation,
    option2: TransportRecommendation
  ): {
    winner: TransportRecommendation;
    differences: string[];
  } {
    const differences: string[] = [];
    
    if (option1.estimatedFare < option2.estimatedFare) {
      differences.push(`${option1.mode} is R${(option2.estimatedFare - option1.estimatedFare).toFixed(2)} cheaper`);
    } else if (option2.estimatedFare < option1.estimatedFare) {
      differences.push(`${option2.mode} is R${(option1.estimatedFare - option2.estimatedFare).toFixed(2)} cheaper`);
    }
    
    if (option1.estimatedTravelTime < option2.estimatedTravelTime) {
      differences.push(`${option1.mode} is ${option2.estimatedTravelTime - option1.estimatedTravelTime} min faster`);
    } else if (option2.estimatedTravelTime < option1.estimatedTravelTime) {
      differences.push(`${option2.mode} is ${option1.estimatedTravelTime - option2.estimatedTravelTime} min faster`);
    }
    
    if (option1.walkingDistance < option2.walkingDistance) {
      differences.push(`${option1.mode} has ${(option2.walkingDistance - option1.walkingDistance).toFixed(2)} km less walking`);
    }
    
    return {
      winner: option1.score >= option2.score ? option1 : option2,
      differences
    };
  }

  // ======================================================
  // SCORING METHODS
  // ======================================================

  private static calculateWalkingScore(
    walkingDistance: number, 
    preferFastest?: boolean
  ): number {
    let score = 100;
    
    if (walkingDistance < 0.2) score = 100;
    else if (walkingDistance < 0.5) score = 85;
    else if (walkingDistance < 1) score = 70;
    else if (walkingDistance < 1.5) score = 50;
    else if (walkingDistance < 2) score = 30;
    else score = 15;
    
    if (preferFastest && walkingDistance > 0.5) {
      score *= 0.7;
    }
    
    return Math.min(100, score);
  }

  private static calculateCostScore(
    fare: number,
    _mode: string,
    preferCheapest?: boolean
  ): number {
    let score = 100;
    
    if (fare <= 15) score = 100;
    else if (fare <= 25) score = 85;
    else if (fare <= 40) score = 70;
    else if (fare <= 60) score = 50;
    else if (fare <= 80) score = 35;
    else if (fare <= 100) score = 20;
    else score = 10;
    
    if (preferCheapest) {
      score = Math.min(100, score * 1.2);
    }
    
    return score;
  }

  private static calculateTimeScore(
    travelTime: number,
    preferFastest?: boolean
  ): number {
    let score = 100;
    
    if (travelTime <= 15) score = 100;
    else if (travelTime <= 25) score = 85;
    else if (travelTime <= 40) score = 65;
    else if (travelTime <= 60) score = 45;
    else if (travelTime <= 90) score = 30;
    else score = 15;
    
    if (preferFastest) {
      score = Math.min(100, score * 1.2);
    }
    
    return score;
  }

  private static calculateSafetyScore(
    zone: TransportNetworkZone,
    isNight: boolean,
    preferSafest?: boolean
  ): number {
    let score = 70;
    
    if (zone.strengths.safest) score += 20;
    if (zone.name === "Gautrain") score += 15;
    if (zone.name === "Rea Vaya") score += 10;
    
    if (isNight && zone.name === "Taxi") {
      score -= 15;
    }
    
    if (preferSafest) {
      score = Math.min(100, score * 1.15);
    }
    
    return Math.min(100, Math.max(0, score));
  }

  private static calculateReliabilityScore(
    zone: TransportNetworkZone,
    isPeak: boolean
  ): number {
    let score = 70;
    
    if (zone.strengths.reliable) score += 20;
    if (zone.name === "Gautrain") score += 15;
    if (zone.name === "Rea Vaya") score += 10;
    
    if (isPeak && zone.name === "Metrorail") {
      score -= 15;
    }
    
    return Math.min(100, Math.max(0, score));
  }

  private static calculateConfidence(
    zone: TransportNetworkZone,
    walkingDistance: number
  ): number {
    let confidence = 0.7;
    
    if (walkingDistance < 0.3) confidence += 0.1;
    if (zone.strengths.reliable) confidence += 0.1;
    if (zone.name === "Gautrain") confidence += 0.05;
    
    return Math.min(0.95, confidence);
  }

  // ======================================================
  // UTILITY METHODS
  // ======================================================

  private static findClosestStop(
    userLocation: Location,
    zone: TransportNetworkZone
  ): { stop: typeof zone.stops[0]; distance: number } {
    let closest = zone.stops[0];
    let closestDistance = Infinity;

    for (const stop of zone.stops) {
      const distance = this.calculateDistance(
        userLocation.lat, userLocation.lng,
        stop.location.lat, stop.location.lng
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = stop;
      }
    }

    return { stop: closest, distance: closestDistance };
  }

  private static getAlternativeStops(
    zone: TransportNetworkZone,
    _userLocation: Location,
    currentStopId: string
  ): string[] {
    return zone.stops
      .filter(stop => stop.id !== currentStopId)
      .map(stop => stop.name)
      .slice(0, 3);
  }

  private static estimateFare(mode: string, walkingDistance: number): number {
    const baseFare: Record<string, number> = {
      "Rea Vaya": 18,
      "A Re Yeng": 16,
      "Gautrain": 65,
      "Metrorail": 12,
      "Minibus Taxi": 20,
      "Taxi": 20,
      "Tshwane Bus Service": 14
    };
    
    let fare = baseFare[mode] || 25;
    
    if (walkingDistance < 0.2) {
      fare *= 0.95;
    }
    
    return fare;
  }

  private static estimateTravelTime(mode: string, walkingDistance: number): number {
    const walkingMinutes = Math.round((walkingDistance / WALKING_SPEED_KMH) * 60);
    const baseTime: Record<string, number> = {
      "Gautrain": 20,
      "Rea Vaya": 35,
      "A Re Yeng": 30,
      "Metrorail": 40,
      "Minibus Taxi": 25,
      "Taxi": 25,
      "Tshwane Bus Service": 35
    };
    
    return (baseTime[mode] || 30) + walkingMinutes;
  }

  private static generateBadges(
    zone: TransportNetworkZone,
    walkingDistance: number,
    isPeak: boolean,
    isNight: boolean
  ): string[] {
    const badges: string[] = [];

    if (walkingDistance < 0.3) badges.push("🚶 Close");
    if (zone.strengths.fastest) badges.push("⚡ Fast");
    if (zone.strengths.cheapest) badges.push("💰 Affordable");
    if (zone.strengths.reliable) badges.push("✅ Reliable");
    if (zone.strengths.safest) badges.push("🛡️ Safe");
    if (zone.name === "Gautrain") badges.push("🚆 Premium");
    
    if (isPeak && zone.name === "Gautrain") badges.push("📈 Peak");
    if (isNight && zone.name === "Taxi") badges.push("🌙 Night");
    
    return badges.slice(0, 4);
  }

  private static generateReason(
    mode: string,
    walkingDistance: number,
    habitPrediction?: { network: TransitNetwork | null; confidence: number }
  ): string {
    if (walkingDistance < 0.2) {
      return `${mode} stop is steps away`;
    }
    
    if (habitPrediction?.network === mode && habitPrediction.confidence > 0.7) {
      return `Matches your usual ${mode} routine`;
    }
    
    const reasons: Record<string, string> = {
      "Gautrain": "Fastest option for longer trips",
      "Minibus Taxi": "Flexible with many pickup points",
      "Rea Vaya": "Dedicated BRT lanes avoid traffic",
      "Metrorail": "Most affordable option",
      "Taxi": "Convenient door-to-door service"
    };
    
    return reasons[mode] || `${mode} available nearby`;
  }

  private static getTransportColor(mode: string): string {
    const colors: Record<string, string> = {
      "Gautrain": "from-yellow-500 to-orange-500",
      "Rea Vaya": "from-blue-500 to-cyan-500",
      "A Re Yeng": "from-purple-500 to-pink-500",
      "Metrorail": "from-green-500 to-emerald-500",
      "Minibus Taxi": "from-amber-600 to-orange-600",
      "Taxi": "from-amber-600 to-orange-600",
      "Tshwane Bus Service": "from-teal-500 to-emerald-500"
    };
    
    return colors[mode] || "from-slate-500 to-slate-700";
  }

  private static calculateDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}