import type { TripData } from "../types";

/** Guest data has its own device-local namespace, never an invented server user. */
export const GUEST_ID = "pulse-device-guest";
export const GUEST_HISTORY_OWNER = "device-guest";

/** Retain existing account trips and import each guest trip only once. */
export function mergeGuestTrips(
  accountTrips: readonly TripData[],
  guestTrips: readonly TripData[],
): TripData[] {
  const byId = new Map<string, TripData>();
  for (const trip of accountTrips) byId.set(trip.id, trip);
  for (const trip of guestTrips) {
    if (!byId.has(trip.id)) byId.set(trip.id, trip);
  }
  return [...byId.values()].sort((a, b) => b.startTime - a.startTime);
}
