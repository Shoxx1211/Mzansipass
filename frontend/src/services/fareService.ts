// services/fareService.ts

import { TransitNetwork } from '../types';

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
  userReportedFare?: number;
}

// ===============================
// CONFIG (PRODUCTION SAFETY)
// ===============================
const CONFIG = {
  MIN_FARE: 5,
  MAX_FARE: 150
};

// ===============================
// ROUTE FARE TABLE (EXPANDABLE)
// ===============================
const ROUTE_FARES: Record<string, number> = {
  // Rea Vaya
  'rv-t1': 21,
  'rv-c1': 14,

  // A Re Yeng
  'ary-t1': 18,
  'ary-f1': 12,

  // Taxi (baseline)
  'tx-cbd-randburg': 20,
  'tx-cbd-soweto': 18,
  'tx-pta-mamelodi': 16,

  // Gautrain
  'gt-ns': 60,
  'gt-h3': 25,

  // Metrorail
  'mr-soweto': 10
};

// ===============================
// FARE ENGINE
// ===============================
export class FareEngine {

  // ===============================
  // TIME CONTEXT
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
  // MAIN ENTRY (PRODUCTION)
  // ===============================
  static async computeFinalFare(input: FareInput): Promise<number> {
    const { network, distance, matchedRoute, userReportedFare } = input;

    // 🔒 VALIDATION
    const safeDistance = Math.max(0, distance || 0);

    // simulate async UX
    await new Promise(r => setTimeout(r, 80));

    const ctx = this.getTimeContext();

    // 🚖 TAXI — REAL WORLD PRIORITY
    if (network === 'Taxi') {
      return this.computeTaxiFare(
        safeDistance,
        userReportedFare,
        ctx
      );
    }

    // 🧠 ROUTE-BASED PRICING (PRIMARY)
    if (matchedRoute && ROUTE_FARES[matchedRoute]) {
      const base = ROUTE_FARES[matchedRoute];
      return this.finalizeFare(
        this.applyModifiers(base, network, ctx)
      );
    }

    // 📏 DISTANCE FALLBACK
    const base = this.distanceFare(network, safeDistance);

    return this.finalizeFare(
      this.applyModifiers(base, network, ctx)
    );
  }

  // ===============================
  // TAXI ENGINE (SMARTER)
  // ===============================
  private static computeTaxiFare(
    distance: number,
    userReportedFare: number | undefined,
    ctx: FareContext
  ): number {

    // 🔥 If user provides fare → TRUST IT (crowdsourced truth)
    if (userReportedFare && userReportedFare > 0) {
      return this.finalizeFare(userReportedFare);
    }

    // fallback estimation
    let base = 12 + distance * 2.2;

    // taxi behaves like surge pricing in SA
    if (ctx.isPeak) base *= 1.25;
    if (ctx.isNight) base *= 1.15;

    return this.finalizeFare(base);
  }

  // ===============================
  // DISTANCE PRICING
  // ===============================
  static distanceFare(network: TransitNetwork, distance: number): number {

    switch (network) {

      case 'Gautrain':
        return 25 + distance * 4.5;

      case 'Rea Vaya':
      case 'A Re Yeng':
        if (distance <= 5) return 10.5;
        if (distance <= 15) return 17.5;
        return 21;

      case 'Tshwane Bus Service':
        return distance <= 8 ? 12 : 18;

      case 'Metrorail':
        return 9.5;

      case 'Taxi':
        return 12 + distance * 2.2;

      default:
        return distance * 2;
    }
  }

  // ===============================
  // APPLY MODIFIERS (REAL-WORLD)
  // ===============================
  static applyModifiers(
    fare: number,
    network: TransitNetwork,
    ctx: FareContext
  ): number {

    let adjusted = fare;

    // 🚆 Gautrain dynamics
    if (network === 'Gautrain') {
      if (ctx.isPeak) adjusted *= 1.15;
      if (ctx.isWeekend) adjusted *= 0.9;
    }

    // 🚌 BRT systems
    if (network === 'Rea Vaya' || network === 'A Re Yeng') {
      if (ctx.isPeak) adjusted *= 1.05;
    }

    // 🚆 Metrorail stays flat (cheap system)
    if (network === 'Metrorail') {
      adjusted *= 1;
    }

    return adjusted;
  }

  // ===============================
  // FINALIZE FARE (PROTECTION LAYER)
  // ===============================
  private static finalizeFare(value: number): number {

    let safe = value;

    // clamp to realistic bounds
    safe = Math.max(CONFIG.MIN_FARE, safe);
    safe = Math.min(CONFIG.MAX_FARE, safe);

    return this.roundFare(safe);
  }

  // ===============================
  // ROUNDING
  // ===============================
  static roundFare(value: number): number {
    return Math.round(value * 100) / 100;
  }
}