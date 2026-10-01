import { describe, expect, it } from "vitest";
import type { TrackedJourneyLeg } from "../src/types";
import {
  confirmMultimodalSwitch,
  currentLegIndex,
  finishMultimodalJourney,
  getMultimodalTotals,
} from "../src/services/multimodalJourney";

// Deterministic engineering acceptance scenario, NOT a certified route.
// GPS odometer and user confirmations drive this journey, not made-up stops.
const START = 1_780_000_000_000;

const plannedTrip = (): TrackedJourneyLeg[] => [
  {
    id: "taxi",
    label: "Minibus taxi",
    mode: "taxi",
    operator: "Taxi",
    from: "Home",
    to: "Transfer point (to verify)",
    startedAt: START,
    startDistanceKm: 0,
    plannedDistanceKm: 9.1,
    estimatedFare: 20,
    fareEstimateSource: "configured",
  },
  {
    id: "bus",
    label: "Municipal bus",
    mode: "bus",
    operator: "Tshwane Bus Service",
    from: "Transfer point (to verify)",
    to: "Near destination",
    startedAt: 0,
    startDistanceKm: 0,
    estimatedFare: null,
    fareEstimateSource: "unknown",
  },
  {
    id: "walk",
    label: "Walk to destination",
    mode: "walk",
    startedAt: 0,
    startDistanceKm: 0,
    estimatedFare: 0,
  },
];

describe("multimodal engineering acceptance: taxi → bus → walk", () => {
  it("tracks three user-confirmed legs and totals exactly the fares paid", () => {
    const initial = plannedTrip();
    expect(currentLegIndex(initial)).toBe(0);
    const busStarted = confirmMultimodalSwitch(initial, 8.4, START + 900_000, 18);
    expect(busStarted[0].endDistanceKm).toBe(8.4);
    expect(busStarted[0].actualFare).toBe(18);
    expect(busStarted[1].startDistanceKm).toBe(8.4);
    expect(currentLegIndex(busStarted)).toBe(1);
    // The initial immutable list must not have been mutated.
    expect(initial[0].endedAt).toBeUndefined();

    const walkStarted = confirmMultimodalSwitch(
      busStarted,
      21.6,
      START + 2_100_000,
      24,
    );
    expect(currentLegIndex(walkStarted)).toBe(2);
    const done = finishMultimodalJourney(
      walkStarted,
      22.9,
      START + 2_600_000,
    );
    const totals = getMultimodalTotals(done);
    expect(totals.recordedFare).toBe(42);
    expect(totals.travelledDistanceKm).toBeCloseTo(22.9, 8);
    expect(totals.boardedLegCount).toBe(3);
    expect(totals.unknownPaidLegs).toBe(0);
    expect(totals.allFaresConfirmed).toBe(true);
    expect(currentLegIndex(done)).toBe(-1);
  });

  it("never charges for a leg the commuter did not board", () => {
    const done = finishMultimodalJourney(plannedTrip(), 4.6, START + 300_000);
    const totals = getMultimodalTotals(done);
    expect(done[1].startedAt).toBe(0);
    expect(done[2].startedAt).toBe(0);
    expect(totals.boardedLegCount).toBe(1);
    expect(totals.travelledDistanceKm).toBeCloseTo(4.6);
    expect(totals.recordedFare).toBe(0);
    expect(totals.unknownPaidLegs).toBe(1);
    expect(totals.allFaresConfirmed).toBe(false);
  });

  it("keeps the full-trip total incomplete until the bus fare is confirmed", () => {
    const busStarted = confirmMultimodalSwitch(plannedTrip(), 7.8, START + 200_000, 20);
    const done = finishMultimodalJourney(busStarted, 17.2, START + 800_000);
    const totals = getMultimodalTotals(done);
    expect(totals.recordedFare).toBe(20);
    expect(totals.unknownPaidLegs).toBe(1);
    expect(totals.allFaresConfirmed).toBe(false);
  });

  it("rejects backward GPS distance, malformed fares, and impossible transfer", () => {
    expect(() => confirmMultimodalSwitch(plannedTrip(), -0.1, START + 2_000, 10))
      .toThrow(/distance/i);
    expect(() => confirmMultimodalSwitch(plannedTrip(), 4, START + 2_000, -8))
      .toThrow(/fare/i);
    const done = finishMultimodalJourney(plannedTrip(), 1, START + 1_000);
    expect(() => confirmMultimodalSwitch(done, 2, START + 2_000, 12))
      .toThrow(/next transport leg/i);
  });
});
