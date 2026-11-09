import type { TripData } from "../types";

export interface TripCost {
  confirmed: number;
  estimated: number;
  missingFares: number;
  total: number;
}

export interface SpendingPeriod {
  confirmed: number;
  estimated: number;
  total: number;
  trips: number;
  missingFares: number;
  distanceKm: number;
}

export interface CommuterSpendingStats {
  thisWeek: SpendingPeriod;
  lastWeek: SpendingPeriod;
  thisMonth: SpendingPeriod;
  lastMonth: SpendingPeriod;
  allTime: SpendingPeriod;
}

const validFare = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const rounded = (value: number): number => Math.round(value * 100) / 100;

/** A fare estimate remains an estimate in every Stats total. */
export function getTripCost(trip: TripData): TripCost {
  const boarded = (trip.legs ?? []).filter(leg =>
    leg.startedAt > 0 && leg.mode !== "walk");
  if (boarded.length > 0) {
    let confirmed = 0;
    let estimated = 0;
    let missingFares = 0;
    for (const leg of boarded) {
      if (validFare(leg.actualFare)) confirmed += leg.actualFare;
      else if (validFare(leg.estimatedFare)) estimated += leg.estimatedFare;
      else missingFares += 1;
    }
    // A single-leg planner can have a journey-level estimate even when the
    // operator did not publish a stop-level fare. Never apply this fallback
    // to a partially recorded transfer journey (it would double-count).
    if (boarded.length === 1 && missingFares === 1 &&
        validFare(trip.estimatedFare)) {
      estimated = trip.estimatedFare;
      missingFares = 0;
    }
    if (boarded.length > 1 && missingFares === boarded.length &&
        validFare(trip.estimatedFare)) {
      estimated = trip.estimatedFare;
      missingFares = 0;
    }
    return { confirmed: rounded(confirmed), estimated: rounded(estimated),
      missingFares, total: rounded(confirmed + estimated) };
  }

  // Historical single-mode trips may not have had a fare ledger. Preserve
  // their recorded amount, but don't claim a projected amount was paid.
  if (validFare(trip.fare) && trip.fare > 0) {
    const estimated = trip.fareBasis === "estimated" ? trip.fare : 0;
    return { confirmed: rounded(trip.fare - estimated), estimated: rounded(estimated),
      missingFares: 0, total: rounded(trip.fare) };
  }
  if (validFare(trip.estimatedFare)) {
    return { confirmed: 0, estimated: rounded(trip.estimatedFare),
      missingFares: 0, total: rounded(trip.estimatedFare) };
  }
  return { confirmed: 0, estimated: 0, missingFares: 1, total: 0 };
}

/** Preserve the projected cost when a passenger has not entered a paid fare. */
export function finaliseTripFare(trip: TripData, paidFareInput: string): TripData {
  const isMultiModal = (trip.legs?.length ?? 0) > 1;
  const paid = Number.parseFloat(paidFareInput);
  const hasPaidFare = !isMultiModal && paidFareInput.trim().length > 0 &&
    Number.isFinite(paid) && paid > 0 && paid <= 1_000;
  const legs = hasPaidFare && trip.legs?.length === 1
    ? [{ ...trip.legs[0], actualFare: paid }]
    : trip.legs;
  const recorded = getTripCost({ ...trip, legs });
  const basis: TripData["fareBasis"] =
    recorded.estimated > 0 && recorded.confirmed > 0 ? "mixed"
      : recorded.estimated > 0 ? "estimated"
      : recorded.confirmed > 0 && recorded.missingFares === 0 ? "actual"
      : "unknown";
  return {
    ...trip,
    legs,
    fare: hasPaidFare ? rounded(paid) : recorded.total,
    ...(hasPaidFare ? { actualFare: rounded(paid) } : {}),
    fareBasis: hasPaidFare ? "actual" : basis,
  };
}

const empty = (): SpendingPeriod => ({
  confirmed: 0, estimated: 0, total: 0, trips: 0, missingFares: 0,
  distanceKm: 0,
});

const add = (period: SpendingPeriod, trip: TripData) => {
  const cost = getTripCost(trip);
  period.confirmed += cost.confirmed;
  period.estimated += cost.estimated;
  period.missingFares += cost.missingFares;
  period.trips += 1;
  period.distanceKm += Number.isFinite(trip.distance) && trip.distance > 0
    ? trip.distance : 0;
};

const finish = (period: SpendingPeriod): SpendingPeriod => ({
  ...period,
  confirmed: rounded(period.confirmed),
  estimated: rounded(period.estimated),
  total: rounded(period.confirmed + period.estimated),
  distanceKm: rounded(period.distanceKm),
});

/** Calendar weeks start Monday, using the phone's local timezone. */
export function getCommuterSpendingStats(
  trips: TripData[], now = new Date(),
): CommuterSpendingStats {
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(),
    now.getDate() - ((now.getDay() + 6) % 7)).getTime();
  const startOfLastWeek = new Date(now.getFullYear(), now.getMonth(),
    now.getDate() - ((now.getDay() + 6) % 7) - 7).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const result: CommuterSpendingStats = {
    thisWeek: empty(), lastWeek: empty(), thisMonth: empty(),
    lastMonth: empty(), allTime: empty(),
  };
  const nowMs = now.getTime();
  for (const trip of trips) {
    const date = trip.endTime ?? trip.startTime;
    if (!Number.isFinite(date) || date <= 0 || date > nowMs) continue;
    add(result.allTime, trip);
    if (date >= startOfWeek) add(result.thisWeek, trip);
    else if (date >= startOfLastWeek) add(result.lastWeek, trip);
    if (date >= startOfMonth) add(result.thisMonth, trip);
    else if (date >= startOfLastMonth) add(result.lastMonth, trip);
  }
  return {
    thisWeek: finish(result.thisWeek), lastWeek: finish(result.lastWeek),
    thisMonth: finish(result.thisMonth), lastMonth: finish(result.lastMonth),
    allTime: finish(result.allTime),
  };
}
