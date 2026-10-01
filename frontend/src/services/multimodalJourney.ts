import type { TrackedJourneyLeg } from "../types";

/**
 * End-to-end trip ledger: one shared implementation for tracker UI, trip
 * completion, journey history and deterministic acceptance tests.
 *
 * Distances are GPS odometer kilometres measured since Start Journey.
 * A change is NEVER inferred from speed/GPS. Only user confirmation changes it.
 */
export const currentLegIndex = (legs: TrackedJourneyLeg[]): number =>
  legs.findIndex((leg) => leg.startedAt > 0 && leg.endedAt === undefined);

export const confirmMultimodalSwitch = (
  legs: TrackedJourneyLeg[],
  odometerKm: number,
  timestamp: number,
  farePaid: number | null,
): TrackedJourneyLeg[] => {
  const current = currentLegIndex(legs);
  if (current < 0 || current + 1 >= legs.length) {
    throw new Error("There is no next transport leg to switch to.");
  }
  const leg = legs[current];
  if (!Number.isFinite(odometerKm) || odometerKm < leg.startDistanceKm) {
    throw new Error("GPS distance must be monotonic.");
  }
  if (!Number.isFinite(timestamp) || timestamp < leg.startedAt) {
    throw new Error("Trip timestamps must be monotonic.");
  }
  if (
    farePaid !== null &&
    (!Number.isFinite(farePaid) || farePaid < 0 || farePaid > 1000)
  ) {
    throw new Error("Enter a valid fare or leave it blank.");
  }
  return legs.map((entry, index) => {
    if (index === current) {
      return {
        ...entry,
        endDistanceKm: odometerKm,
        endedAt: timestamp,
        ...(farePaid !== null ? { actualFare: farePaid } : {}),
      };
    }
    if (index === current + 1) {
      return { ...entry, startedAt: timestamp, startDistanceKm: odometerKm };
    }
    return entry;
  });
};

export const finishMultimodalJourney = (
  legs: TrackedJourneyLeg[],
  odometerKm: number,
  timestamp: number,
): TrackedJourneyLeg[] => {
  const current = currentLegIndex(legs);
  if (current < 0) return legs;
  const leg = legs[current];
  if (!Number.isFinite(odometerKm) || odometerKm < leg.startDistanceKm) {
    throw new Error("GPS distance must be monotonic.");
  }
  if (!Number.isFinite(timestamp) || timestamp < leg.startedAt) {
    throw new Error("Trip timestamps must be monotonic.");
  }
  return legs.map((entry, index) =>
    index === current
      ? { ...entry, endDistanceKm: odometerKm, endedAt: timestamp }
      : entry,
  );
};

export interface MultimodalTotals {
  recordedFare: number;
  unknownPaidLegs: number;
  travelledDistanceKm: number;
  boardedLegCount: number;
  allFaresConfirmed: boolean;
}

export const getMultimodalTotals = (
  legs: TrackedJourneyLeg[],
): MultimodalTotals => {
  let recordedFare = 0;
  let unknownPaidLegs = 0;
  let travelledDistanceKm = 0;
  let boardedLegCount = 0;

  for (const leg of legs) {
    // An unboarded proposed leg contributes neither a fare nor kilometres.
    if (leg.startedAt <= 0) continue;
    boardedLegCount += 1;
    travelledDistanceKm += Math.max(
      0,
      (leg.endDistanceKm ?? leg.startDistanceKm) - leg.startDistanceKm,
    );
    if (leg.mode === "walk") continue;
    if (typeof leg.actualFare === "number" &&
        Number.isFinite(leg.actualFare) && leg.actualFare >= 0) {
      recordedFare += leg.actualFare;
    } else {
      unknownPaidLegs += 1;
    }
  }

  return {
    recordedFare: Math.round(recordedFare * 100) / 100,
    unknownPaidLegs,
    travelledDistanceKm,
    boardedLegCount,
    allFaresConfirmed: boardedLegCount > 0 && unknownPaidLegs === 0,
  };
};
