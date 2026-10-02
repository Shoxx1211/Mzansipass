import { describe, expect, it } from "vitest";
import type { TransportRecommendation } from "../src/types";
import { completeOneWayFare, recurringTravelCost } from "../src/services/commuterCost";

const priced: TransportRecommendation = {
  id: "example", mode: "Taxi", score: 40, selectable: true,
  estimatedFare: 20, fareStatus: "estimated", estimatedTime: null,
  estimatedTravelTime: null, walkingDistance: 0, reason: "fixture", badges: [],
  color: "#0ff", confidence: 0.5,
};

describe("careful commuter budget projections", () => {
  it("computes monthly cost only for full trip fares", () => {
    expect(recurringTravelCost(completeOneWayFare(priced), 22, 2)).toBe(880);
  });
  it("will not price unverified or partial multimodal journeys", () => {
    expect(completeOneWayFare({ ...priced, fareStatus: "unverified" })).toBeNull();
    expect(completeOneWayFare({ ...priced, badges: ["ACCESS_REQUIRED"] })).toBeNull();
    expect(completeOneWayFare({ ...priced, journeyLegs: [
      { id: "taxi", mode: "taxi", label: "Taxi", fare: null },
      { id: "train", mode: "rail", label: "Train", fare: 20 },
    ] })).toBeNull();
  });
  it("rejects nonsensical commute schedule inputs", () => {
    expect(recurringTravelCost(20, 33, 2)).toBeNull();
    expect(recurringTravelCost(20, 22, -1)).toBeNull();
    expect(recurringTravelCost(null, 22, 2)).toBeNull();
  });
});
