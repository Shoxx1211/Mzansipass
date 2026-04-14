// services/fareService.ts

import { TransitNetwork } from '../types';

// ---------------- TYPES ----------------
interface FareContext {
  isPeak: boolean;
  isNight: boolean;
  isWeekend: boolean;
}

export interface FareInput {
  network: TransitNetwork;
  distance: number;
  matchedRoute?: string;
  userReportedFare?: number; // 🔥 for taxi override later
}

// ---------------- ROUTE FARE TABLE ----------------
// 🔥 Intelligence layer (expand over time)
const ROUTE_FARES: Record<string, number> = {
  // Rea Vaya
  'rv-t1': 21,
  'rv-c1': 14,

  // A Re Yeng
  'ary-t1': 18,
  'ary-f1': 12,

  // Taxi (baseline estimates)
  'tx-cbd-randburg': 20,
  'tx-cbd-soweto': 18,
  'tx-pta-mamelodi': 16,

  // Gautrain
  'gt-ns': 60,
  'gt-h3': 25,

  // Metrorail
  'mr-soweto': 10
};

// ---------------- ENGINE ----------------
export class FareEngine {

  // ---------------- TIME CONTEXT ----------------
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

  // ---------------- MAIN ENTRY (FIXED ✅) ----------------
  static async computeFinalFare(input: FareInput): Promise<number> {
    const { network, distance, matchedRoute, userReportedFare } = input;

    // simulate async (smooth UX)
    await new Promise(r => setTimeout(r, 120));

    const ctx = this.getTimeContext();

    // 🚖 TAXI REAL-WORLD OVERRIDE (MOST IMPORTANT)
    if (network === 'Taxi' && userReportedFare) {
      return this.roundFare(userReportedFare);
    }

    // 🧠 ROUTE-BASED PRICING (PRIMARY ENGINE)
    if (matchedRoute && ROUTE_FARES[matchedRoute]) {
      return this.applyModifiers(
        ROUTE_FARES[matchedRoute],
        network,
        ctx
      );
    }

    // 📏 DISTANCE FALLBACK
    const base = this.distanceFare(network, distance);

    return this.applyModifiers(base, network, ctx);
  }

  // ---------------- DISTANCE FALLBACK ----------------
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
        return 12 + distance * 2; // fallback ONLY

      default:
        return distance * 2;
    }
  }

  // ---------------- APPLY REAL-WORLD MODIFIERS ----------------
  static applyModifiers(
    fare: number,
    network: TransitNetwork,
    ctx: FareContext
  ): number {

    let adjusted = fare;

    // 🚆 Gautrain pricing dynamics
    if (network === 'Gautrain') {
      if (ctx.isPeak) adjusted *= 1.15;
      if (ctx.isWeekend) adjusted *= 0.9;
    }

    // 🚖 Taxi behavior
    if (network === 'Taxi') {
      if (ctx.isPeak) adjusted *= 1.2;
      if (ctx.isNight) adjusted *= 1.15;
    }

    // 🚌 BRT systems
    if (network === 'Rea Vaya' || network === 'A Re Yeng') {
      if (ctx.isPeak) adjusted *= 1.05;
    }

    return this.roundFare(adjusted);
  }

  // ---------------- HELPERS ----------------
  static roundFare(value: number): number {
    return Math.round(value * 100) / 100;
  }
}