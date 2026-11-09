import { describe, expect, it } from "vitest";
import type { TripData, TrackedJourneyLeg } from "../src/types";
import { finaliseTripFare, getCommuterSpendingStats, getTripCost } from "../src/services/spendingStats";

const trip = (id: string, time: number, fare: number, more: Partial<TripData> = {}): TripData => ({
  id, network: "Taxi", startTime: time, endTime: time,
  fare, distance: 8.3, ...more,
});

const leg = (id: string, actualFare: number | null,
  estimatedFare: number | null): TrackedJourneyLeg => ({
  id, label: id, mode: "taxi", startDistanceKm: 0, startedAt: 1,
  actualFare, estimatedFare,
});

describe("private on-device commuter spending", () => {
  it("separates Monday-based weeks and local calendar months", () => {
    const now = new Date(2026, 10, 9, 17);
    const spending = getCommuterSpendingStats([
      trip("today", new Date(2026, 10, 9, 8).getTime(), 25),
      trip("yesterday", new Date(2026, 10, 8, 20).getTime(), 17),
      trip("previous-month", new Date(2026, 9, 31, 8).getTime(), 40),
    ], now);
    expect(spending.thisWeek.total).toBe(25);
    expect(spending.lastWeek.total).toBe(17);
    expect(spending.thisMonth.total).toBe(42);
    expect(spending.lastMonth.total).toBe(40);
    expect(spending.allTime.total).toBe(82);
  });

  it("keeps estimated fares clearly separate from confirmed payments", () => {
    const cost = getTripCost(trip("mixed", 1, 0, {
      estimatedFare: 50,
      legs: [leg("taxi", 18, 20), leg("bus", null, 12), leg("unknown", null, null)],
    }));
    expect(cost).toEqual({ confirmed: 18, estimated: 12, missingFares: 1, total: 30 });
  });

  it("preserves an estimated fare when the commuter doesn't enter an actual amount", () => {
    const input = trip("estimate", 1, 0, {
      estimatedFare: 23,
      legs: [leg("first", null, 23)],
    });
    const saved = finaliseTripFare(input, "");
    expect(saved.fare).toBe(23);
    expect(saved.fareBasis).toBe("estimated");
    expect(getTripCost(saved).confirmed).toBe(0);
    expect(getTripCost(saved).estimated).toBe(23);
  });

  it("uses a real paid fare over an estimate when entered", () => {
    const input = trip("paid", 1, 0, {
      estimatedFare: 23,
      legs: [leg("first", null, 23)],
    });
    const saved = finaliseTripFare(input, "20");
    expect(saved.fare).toBe(20);
    expect(saved.fareBasis).toBe("actual");
    expect(saved.legs?.[0].actualFare).toBe(20);
    expect(getTripCost(saved).estimated).toBe(0);
  });

  it("counts unknown fares without inventing a price, and ignores future timestamps", () => {
    const now = new Date(2026, 10, 9, 17);
    const spending = getCommuterSpendingStats([
      trip("no-price", new Date(2026, 10, 9, 12).getTime(), 0),
      trip("future", new Date(2026, 10, 10, 12).getTime(), 50),
    ], now);
    expect(spending.thisWeek.total).toBe(0);
    expect(spending.thisWeek.trips).toBe(1);
    expect(spending.thisWeek.missingFares).toBe(1);
  });
});
