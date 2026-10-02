import type { TransportRecommendation } from "../types";

/** Use only a priced end-to-end trip. Never project a rail-only fare as the
 * cost of an unpriced taxi + train journey. */
export function completeOneWayFare(rec: TransportRecommendation): number | null {
  if (rec.selectable === false || rec.fareStatus === "unverified" ||
      rec.estimatedFare === null || !Number.isFinite(rec.estimatedFare) ||
      rec.estimatedFare < 0 || rec.badges?.includes("ACCESS_REQUIRED")) return null;
  if ((rec.journeyLegs ?? []).some(leg =>
    leg.mode !== "walk" &&
    (leg.fare === null || leg.fare === undefined ||
      !Number.isFinite(leg.fare) || leg.fareStatus === "unverified"))) return null;
  return rec.estimatedFare;
}

export function recurringTravelCost(
  oneWayFare: number | null,
  days: number,
  tripsPerDay: number,
): number | null {
  if (oneWayFare === null || !Number.isFinite(oneWayFare) || oneWayFare < 0 ||
      !Number.isInteger(days) || days < 1 || days > 31 ||
      !Number.isInteger(tripsPerDay) || tripsPerDay < 1 || tripsPerDay > 6) return null;
  return Math.round(oneWayFare * days * tripsPerDay * 100) / 100;
}
