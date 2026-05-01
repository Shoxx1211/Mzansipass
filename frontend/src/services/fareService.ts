// src/services/fareService.ts

import { TransitNetwork } from "../types";

// ===============================
// TYPES
// ===============================
interface FareContext {
  isPeak: boolean;
  isNight: boolean;
  isWeekend: boolean;
}

export interface FareInput {
  network: TransitNetwork;
  distance: number;
  matchedRoute?: string;
  destination?: string;
  userReportedFare?: number;
}

export interface FareResult {
  fare: number;
  confidence: number;
  source: "route" | "distance" | "user" | "hybrid";
}

// ===============================
// CONFIG
// ===============================
const CONFIG = {
  MIN_FARE: 5,
  MAX_FARE: 300
};

// ===============================
// 🚀 FARE ENGINE
// ===============================
export class FareEngine {

  // ===============================
  // 🕒 TIME CONTEXT
  // ===============================
  static getTimeContext(): FareContext {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    return {
      isWeekend: day === 0 || day === 6,
      isPeak: (hour >= 6 && hour <= 9) || (hour >= 16 && hour <= 19),
      isNight: hour >= 20 || hour <= 4
    };
  }

  // ===============================
  // 🧠 MAIN ENGINE
  // ===============================
  static async computeFinalFare(input: FareInput): Promise<FareResult> {
    const { network, distance } = input;

    const safeDistance = Math.max(0, distance || 0);

    // 🔥 Fixed systems (deterministic pricing)
    const FIXED_SYSTEMS = [
      "Rea Vaya",
      "A Re Yeng",
      "Gautrain",
      "Metrorail"
    ];

    // simulate slight latency (UX smoothness)
    await new Promise((r) => setTimeout(r, 30));

    let base = this.distanceFare(network, safeDistance);

    // Only taxi gets dynamic modifiers
    if (!FIXED_SYSTEMS.includes(network)) {
      const ctx = this.getTimeContext();
      base = this.applyModifiers(base, network, ctx);
    }

    return {
      fare: this.finalizeFare(base),
      confidence: FIXED_SYSTEMS.includes(network) ? 0.95 : 0.75,
      source: "distance"
    };
  }

  // ===============================
  // 📏 REAL-WORLD DISTANCE MODELS
  // ===============================
  static distanceFare(
    network: TransitNetwork,
    distance: number
  ): number {

    // ===============================
    // 🚍 REA VAYA (REAL 2026 BANDS)
    // ===============================
    if (network === "Rea Vaya") {
      if (distance <= 5) return 11.0;
      if (distance <= 10) return 14.0;
      if (distance <= 15) return 16.5;
      if (distance <= 25) return 19.0;
      if (distance <= 35) return 21.0;
      if (distance <= 45) return 22.0;
      return 28.0;
    }

    // ===============================
    // 🚍 A RE YENG (REFINED BANDS)
    // ===============================
    if (network === "A Re Yeng") {
      if (distance <= 5) return 10;
      if (distance <= 10) return 13;
      if (distance <= 15) return 16;
      if (distance <= 25) return 18;
      return 22;
    }

    // ===============================
    // 🚆 GAUTRAIN (ZONE-LIKE MODEL)
    // ===============================
    if (network === "Gautrain") {
      let fare = 0;

      // Short trips
      if (distance <= 10) {
        fare = 35;
      }

      // Medium trips
      else if (distance <= 30) {
        fare = 60 + (distance - 10) * 2.5;
      }

      // Long trips
      else {
        fare = 110 + (distance - 30) * 2;
      }

      // Airport premium simulation
      if (distance > 40) {
        fare += 120;
      }

      const ctx = this.getTimeContext();

      if (ctx.isPeak) fare *= 1.1;
      if (ctx.isWeekend) fare *= 0.9;

      return fare;
    }

    // ===============================
    // 🚆 METRORAIL (PRASA 2025)
    // ===============================
    if (network === "Metrorail") {
      let base = 10;

      if (distance > 10) base = 12;
      if (distance > 20) base = 14;
      if (distance > 30) base = 16;

      // 🔥 TRUE OFF-PEAK WINDOW (9am–2pm)
      const hour = new Date().getHours();
      const isOffPeak = hour >= 9 && hour <= 14;

      if (isOffPeak) base *= 0.5;

      return base;
    }

    // ===============================
    // 🚌 TSHWANE BUS (SIMPLE MODEL)
    // ===============================
    if (network === "Tshwane Bus Service") {
      if (distance <= 5) return 10;
      if (distance <= 10) return 14;
      return 18;
    }

    // ===============================
    // 🚐 TAXI (ADAPTIVE CORE)
    // ===============================
    if (network === "Taxi") {
      return 12 + distance * 2.2;
    }

    // fallback
    return distance * 2;
  }

  // ===============================
  // ⚙️ MODIFIERS (TAXI ONLY)
  // ===============================
  static applyModifiers(
    fare: number,
    network: TransitNetwork,
    ctx: FareContext
  ): number {

    let adjusted = fare;

    if (network === "Taxi") {
      if (ctx.isPeak) adjusted *= 1.25;
      if (ctx.isNight) adjusted *= 1.15;
    }

    return adjusted;
  }

  // ===============================
  // 🧹 FINALIZE
  // ===============================
  private static finalizeFare(value: number): number {
    let safe = value;

    safe = Math.max(CONFIG.MIN_FARE, safe);
    safe = Math.min(CONFIG.MAX_FARE, safe);

    return Math.round(safe * 100) / 100;
  }
}