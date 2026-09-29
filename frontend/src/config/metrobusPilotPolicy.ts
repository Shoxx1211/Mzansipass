/**
 * Phase 1J — INTERNAL, reversible pilot assumption.
 * Treat City GIS route shapes as potentially usable for geographic screening.
 * This is NOT independent verification of operation, direction, stops or licence.
 */
export const METROBUS_PILOT_POLICY = {
  enabled: true,
  developerOnly: true,
  provisionalOperationAssumption: true,
  screeningRadiusMetres: 800,
  maxVisibleCandidates: 4,
  sourceStatus: "city-gis-unverified",
  boardingMembershipStatus: "unverified",
  directionStatus: "unverified",
  faresStatus: "unverified",
  sourceRightsStatus: "pending-review",
  enableTripStart: false,
  enableFareAndEta: false,
  enableTransferDirections: false,
} as const;
