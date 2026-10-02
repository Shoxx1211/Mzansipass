import type { JourneyLeg, TransitNetwork } from "../types";

/**
 * Synthetic road distance does not prove a bus/rail passenger fare.
 * This controls use of the legacy, distance-based taxi approximation
 * in both the recommendation chooser and live tracking.
 */
export function mayUseLegacyFareEngine(
  leg: JourneyLeg,
  network: TransitNetwork | null,
): boolean {
  return network === "Taxi" &&
    leg.mode === "taxi" &&
    leg.distanceSource === "road" &&
    typeof leg.distanceKm === "number" &&
    Number.isFinite(leg.distanceKm) &&
    leg.distanceKm > 0;
}

/**
 * Never price two Rea Vaya legs separately as if each were a new ticket
 * without verifying the fare continuation / tap sequence.
 */
export function hasUnresolvedReaVayaTransfer(
  legs: JourneyLeg[],
): boolean {
  return legs.filter(leg => leg.mode === "bus" && leg.operator === "Rea Vaya").length > 1;
}
