import { describe, expect, it } from "vitest";
import type { TransportRecommendation } from "../src/types";
import {
  getBoardingHint,
  getCommuterFare,
} from "../src/features/planner/SimpleTransportOptions";

const rail: TransportRecommendation = {
  id: "test-rail",
  mode: "Gautrain",
  score: 85,
  estimatedFare: 59,
  estimatedTime: null,
  estimatedTravelTime: null,
  walkingDistance: 0.5,
  reason: "Official service connection",
  badges: ["OFFICIAL_SERVICE"],
  color: "#09f",
  confidence: 0.9,
  nearestStop: "Park Station",
  fareStatus: "verified",
  selectable: true,
  journeyLegs: [{
    id: "rail", mode: "rail", label: "Gautrain", from: "Park", to: "Sandton",
    fare: 59, fareStatus: "verified",
  }],
};

describe("commuter fare truthfulness", () => {
  it("shows a known single-leg fare", () => {
    expect(getCommuterFare(rail).value).toBe("R59");
    expect(getCommuterFare(rail).note).toContain("Published");
  });

  it("does not call an access-required rail fare the full price", () => {
    const result = getCommuterFare({
      ...rail, badges: ["ACCESS_REQUIRED"],
    });
    expect(result.value).toBe("R59");
    expect(result.note).toContain("getting there costs extra");
  });

  it("estimates the unknown taxi leg and includes the known train fare", () => {
    const result = getCommuterFare({
      ...rail,
      fareStatus: "estimated",
      estimatedFare: 59,
      journeyLegs: [
        { id: "taxi", mode: "taxi", label: "Taxi", fare: null, fareStatus: "unverified" },
        ...(rail.journeyLegs ?? []),
      ],
    });
    expect(result.value).toBe("Est. R64–R164");
    expect(result.note).toContain("Provisional fare estimate");
  });

  it("shows provisional taxi fare bands as guides, not published prices", () => {
    const result = getCommuterFare({
      ...rail, mode: "Taxi", estimatedFare: null,
      fareStatus: "unverified", journeyLegs: [],
      fareEstimateRange: { minimum: 18, maximum: 26, basis: "provisional-taxi" },
    });
    expect(result.value).toBe("R18–R26");
    expect(result.note).toContain("guide only");
  });

  it("does not claim a boarding stop for service-area-only data", () => {
    expect(getBoardingHint({
      ...rail, evidenceStatus: "published-service-area",
    })).toBe("Boarding point to confirm");
    expect(getBoardingHint(rail)).toBe("Board near Park Station");
  });
});


describe("numeric fallback for every operator", () => {
  for (const mode of ["Taxi", "Gautrain", "Rea Vaya", "A Re Yeng", "Tshwane Bus Service", "Metrorail", "Putco"] as const) {
    for (const distance of [undefined, 0, NaN, 12, 150]) {
      it(`${mode} gives numeric guidance at distance ${distance}`, () => {
        const result = getCommuterFare({ ...rail, mode, estimatedFare: null,
          fareStatus: "unverified", journeyLegs: [], serviceDistanceKm: distance });
        expect(result.value).toMatch(/R[0-9]/);
        expect(result.value).not.toMatch(/NaN|Infinity|confirm/);
      });
    }
  }
  it("prices an unverified taxi leg even when its recommendation has a range", () => {
    const result = getCommuterFare({ ...rail, mode: "Taxi", estimatedFare: 20,
      fareStatus: "estimated", serviceDistanceKm: 8,
      fareEstimateRange: {minimum: 10, maximum: 20, basis: "provisional-taxi"},
      journeyLegs: [{id: "taxi", mode: "taxi", label: "Taxi", fare: null, fareStatus: "unverified", distanceKm: 8}] });
    expect(result.value).toBe("Est. R10–R20");
  });
});
