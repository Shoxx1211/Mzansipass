// src/services/fareService.ts
// Pulse Transit - Premium Fare Engine
// Features: Predictive learning, real-time adjustments, multi-modal support

import { TransitNetwork } from "../types";

// ======================================================
// TYPES
// ======================================================

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
  paymentMethod?: 'cash' | 'card' | 'app';
}

export interface FareResult {
  fare: number;
  originalFare?: number;
  confidence: number;
  source: "distance" | "learned" | "cached";
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

// ======================================================
// CONSTANTS
// ======================================================

const CONFIG = {
  MIN_FARE: 5,
  MAX_FARE: 500,
  CACHE_DURATION: 24 * 60 * 60 * 1000,
  LEARNING_THRESHOLD: 0.7,
  SURGE_MULTIPLIER_MAX: 2.5,
  SURGE_MULTIPLIER_MIN: 1.0
};

const FIXED_SYSTEMS: string[] = [
  "Rea Vaya",
  "A Re Yeng",
  "Gautrain",
  "Metrorail",
  "Tshwane Bus Service"
];

const PEAK_HOURS = {
  morning: { start: 6, end: 9 },
  evening: { start: 16, end: 19 }
};

const NIGHT_HOURS = { start: 20, end: 4 };

const PUBLIC_HOLIDAYS = [
  "01-01", "03-21", "04-07", "04-10", "04-27",
  "05-01", "06-16", "08-09", "09-24", "12-16", "12-25", "12-26"
];

// ======================================================
// FARE LEARNING CACHE
// ======================================================

const FARE_LEARNING_KEY = "pulse_fare_learning";

class FareLearningCache {
  private data: LearnedFare[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      const saved = localStorage.getItem(FARE_LEARNING_KEY);
      if (saved) {
        this.data = JSON.parse(saved);
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        this.data = this.data.filter(f => f.timestamp > weekAgo);
      }
    } catch (error) {
      console.error("Failed to load fare learning cache:", error);
    }
  }

  private save() {
    try {
      localStorage.setItem(FARE_LEARNING_KEY, JSON.stringify(this.data));
    } catch (error) {
      console.error("Failed to save fare learning cache:", error);
    }
  }

  add(learned: LearnedFare) {
    this.data.push(learned);
    if (this.data.length > 1000) {
      this.data.shift();
    }
    this.save();
  }

  getSimilar(network: TransitNetwork, distance: number): LearnedFare | null {
    const similar = this.data.filter(f => 
      f.network === network && 
      Math.abs(f.distance - distance) < 2
    );
    
    if (similar.length === 0) return null;
    
    const totalWeight = similar.reduce((sum, f) => sum + f.accuracy, 0);
    if (totalWeight === 0) return similar[0];
    
    const weightedFare = similar.reduce((sum, f) => sum + (f.actualFare * f.accuracy), 0) / totalWeight;
    
    return {
      ...similar[0],
      actualFare: weightedFare,
      estimatedFare: weightedFare
    };
  }
}

const fareLearning = new FareLearningCache();

// ======================================================
// HELPER FUNCTIONS
// ======================================================

const isPublicHoliday = (): boolean => {
  const today = new Date();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return PUBLIC_HOLIDAYS.includes(`${month}-${day}`);
};

const getDemandMultiplier = (network: string, ctx: FareContext): number => {
  let multiplier = ctx.demandMultiplier || 1.0;
  
  if (ctx.isPeak) multiplier *= 1.2;
  if (ctx.isNight && network === "Taxi") multiplier *= 1.15;
  if (ctx.isWeekend && network === "Taxi") multiplier *= 1.1;
  if (ctx.isHoliday) multiplier *= 1.25;
  if (ctx.isRaining && network === "Taxi") multiplier *= 1.2;
  
  return Math.min(CONFIG.SURGE_MULTIPLIER_MAX, Math.max(CONFIG.SURGE_MULTIPLIER_MIN, multiplier));
};

const calculateBreakdown = (
  baseFare: number,
  _distance: number,
  ctx: FareContext,
  network: string,
  input: FareInput
): FareBreakdown => {
  const distanceCharge = baseFare * 0.6;
  const peakSurcharge = ctx.isPeak ? baseFare * 0.2 : 0;
  const nightSurcharge = (ctx.isNight && network === "Taxi") ? baseFare * 0.15 : 0;
  const weekendDiscount = (ctx.isWeekend && network !== "Taxi") ? -baseFare * 0.1 : 0;
  const luggageFee = input.hasLuggage ? 10 : 0;
  const groupDiscount = (input.passengerCount && input.passengerCount >= 3) ? -baseFare * 0.1 : 0;
  const roundTripDiscount = input.isRoundTrip ? -baseFare * 0.15 : 0;
  const paymentDiscount = input.paymentMethod === 'app' ? -baseFare * 0.05 : 0;
  
  const total = baseFare + peakSurcharge + nightSurcharge + weekendDiscount + 
                luggageFee + groupDiscount + roundTripDiscount + paymentDiscount;
  
  return {
    baseFare,
    distanceCharge,
    peakSurcharge,
    nightSurcharge,
    weekendDiscount,
    luggageFee,
    groupDiscount,
    roundTripDiscount,
    paymentDiscount,
    total: Math.max(CONFIG.MIN_FARE, total)
  };
};

// ======================================================
// MAIN FARE ENGINE
// ======================================================

export class FareEngine {

  static getTimeContext(): FareContext {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    const isWeekend = day === 0 || day === 6;
    const isPeak = (hour >= PEAK_HOURS.morning.start && hour <= PEAK_HOURS.morning.end) ||
                   (hour >= PEAK_HOURS.evening.start && hour <= PEAK_HOURS.evening.end);
    
    let isNight = hour >= NIGHT_HOURS.start || hour <= NIGHT_HOURS.end;
    
    if (NIGHT_HOURS.start > NIGHT_HOURS.end) {
      isNight = hour >= NIGHT_HOURS.start || hour <= NIGHT_HOURS.end;
    }

    return {
      isPeak,
      isNight,
      isWeekend,
      isHoliday: isPublicHoliday(),
      demandMultiplier: 1.0
    };
  }

  static async computeFinalFare(input: FareInput): Promise<FareResult> {
    const { network, distance, passengerCount = 1, hasLuggage = false, isRoundTrip = false, paymentMethod = 'cash' } = input;
    
    const safeDistance = Math.max(0, distance || 0);
    const ctx = input.context || this.getTimeContext();
    
    await new Promise(r => setTimeout(r, 10));
    
    const learned = fareLearning.getSimilar(network, safeDistance);
    let baseFare: number;
    let source: FareResult['source'] = "distance";
    
    if (learned && learned.accuracy > CONFIG.LEARNING_THRESHOLD) {
      baseFare = learned.actualFare;
      source = "learned";
    } else {
      baseFare = this.calculateBaseFare(network, safeDistance, ctx);
      source = "distance";
    }
    
    const surgeMultiplier = getDemandMultiplier(network, ctx);
    let finalFare = baseFare * surgeMultiplier;
    
    if (passengerCount > 1 && network === "Taxi") {
      finalFare *= (1 + (passengerCount - 1) * 0.15);
    }
    
    if (hasLuggage && network === "Taxi") {
      finalFare += 10;
    }
    
    if (isRoundTrip && network !== "Taxi") {
      finalFare *= 0.85;
    }
    
    if (paymentMethod === 'app') {
      finalFare *= 0.95;
    }
    
    const breakdown = calculateBreakdown(baseFare, safeDistance, ctx, network, input);
    
    const discounts: FareDiscount[] = [];
    if (ctx.isWeekend && network !== "Taxi") {
      discounts.push({ type: "weekend", amount: -baseFare * 0.1, reason: "Weekend discount" });
    }
    if (isRoundTrip && network !== "Taxi") {
      discounts.push({ type: "roundtrip", amount: -baseFare * 0.15, reason: "Round trip discount" });
    }
    if (paymentMethod === 'app') {
      discounts.push({ type: "payment", amount: -baseFare * 0.05, reason: "App payment discount" });
    }
    if (input.passengerCount && input.passengerCount >= 3) {
      discounts.push({ type: "group", amount: -baseFare * 0.1, reason: "Group discount (3+ passengers)" });
    }
    
    const final = this.finalizeFare(finalFare);
    
    return {
      fare: final,
      originalFare: baseFare,
      confidence: FIXED_SYSTEMS.includes(network) ? 0.95 : 0.85,
      source,
      breakdown,
      discounts: discounts.length > 0 ? discounts : undefined,
      surgeMultiplier: surgeMultiplier !== 1 ? surgeMultiplier : undefined
    };
  }

  static calculateBaseFare(network: string, distance: number, ctx: FareContext): number {
    // Rea Vaya
    if (network === "Rea Vaya") {
      if (distance <= 5) return 11;
      if (distance <= 10) return 14;
      if (distance <= 15) return 16.5;
      if (distance <= 25) return 19;
      if (distance <= 35) return 21;
      if (distance <= 45) return 22;
      return 28;
    }

    // A Re Yeng
    if (network === "A Re Yeng") {
      if (distance <= 5) return 10;
      if (distance <= 10) return 13;
      if (distance <= 15) return 16;
      if (distance <= 25) return 18;
      return 22;
    }

    // Gautrain
    if (network === "Gautrain") {
      let fare = 0;
      if (distance <= 10) {
        fare = 35;
      } else if (distance <= 30) {
        fare = 60 + (distance - 10) * 2.5;
      } else {
        fare = 110 + (distance - 30) * 2;
      }
      if (distance > 40) fare += 120;
      
      if (ctx.isPeak) fare *= 1.1;
      if (ctx.isWeekend) fare *= 0.9;
      
      return fare;
    }

    // Metrorail
    if (network === "Metrorail") {
      let base = 10;
      if (distance > 10) base = 12;
      if (distance > 20) base = 14;
      if (distance > 30) base = 16;
      
      const isOffPeak = !ctx.isPeak && !ctx.isNight;
      if (isOffPeak) base *= 0.5;
      
      return base;
    }

    // Tshwane Bus Service
    if (network === "Tshwane Bus Service") {
      if (distance <= 5) return 10;
      if (distance <= 10) return 14;
      return 18;
    }

    // Taxi
    if (network === "Taxi") {
      const base = 12 + distance * 2.2;
      if (ctx.isPeak) return base * 1.25;
      if (ctx.isNight) return base * 1.15;
      return base;
    }

    return distance * 2;
  }

  static learnFare(estimated: number, actual: number, network: string, distance: number): void {
    const accuracy = actual / estimated;
    const accuracyScore = accuracy > 1 ? 1 / accuracy : accuracy;
    
    fareLearning.add({
      network: network as TransitNetwork,
      distance,
      actualFare: actual,
      estimatedFare: estimated,
      timestamp: Date.now(),
      accuracy: accuracyScore
    });
  }

  static async compareNetworks(distance: number, networks: TransitNetwork[]): Promise<Map<TransitNetwork, number>> {
    const results = new Map<TransitNetwork, number>();
    const ctx = this.getTimeContext();
    
    for (const network of networks) {
      const fare = this.calculateBaseFare(network, distance, ctx);
      results.set(network, this.finalizeFare(fare));
    }
    
    return results;
  }

  static async getPriceRange(network: string, distance: number): Promise<{ min: number; max: number; avg: number }> {
    const baseFare = this.calculateBaseFare(network, distance, this.getTimeContext());
    
    let min = baseFare;
    let max = baseFare;
    
    if (network === "Taxi") {
      min = baseFare * 0.8;
      max = baseFare * 1.3;
    } else if (network === "Gautrain") {
      min = baseFare * 0.9;
      max = baseFare * 1.1;
    } else {
      min = baseFare * 0.95;
      max = baseFare * 1.05;
    }
    
    return {
      min: this.finalizeFare(min),
      max: this.finalizeFare(max),
      avg: this.finalizeFare(baseFare)
    };
  }

  static isSurgeActive(network: string): boolean {
    const ctx = this.getTimeContext();
    return (ctx.isPeak && network === "Taxi") || 
           (ctx.isNight && network === "Taxi") ||
           (ctx.isHoliday === true) ||
           ((ctx.demandMultiplier ?? 1.0) > 1.2);
  }

  static getSurgeReason(network: string): string | null {
    const ctx = this.getTimeContext();
    if (ctx.isPeak && network === "Taxi") return "Peak hour pricing";
    if (ctx.isNight && network === "Taxi") return "Night surcharge";
    if (ctx.isHoliday) return "Public holiday surcharge";
    if (ctx.isRaining && network === "Taxi") return "Weather surcharge";
    return null;
  }

  private static finalizeFare(value: number): number {
    let safe = Math.max(CONFIG.MIN_FARE, value);
    safe = Math.min(CONFIG.MAX_FARE, safe);
    return Math.round(safe * 100) / 100;
  }
}

export { fareLearning };