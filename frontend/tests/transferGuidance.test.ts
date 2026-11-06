import { describe, expect, it } from "vitest";
import { getTransferGuidance } from "../src/services/transferGuidance";
import type { TransportRecommendation } from "../src/types";

const candidate: TransportRecommendation = {
  id: "transfer", mode: "Rea Vaya", score: 70,
  estimatedFare: null, estimatedTime: null, estimatedTravelTime: null,
  walkingDistance: 1.2, reason: "Published connectivity", badges: [],
  color: "cyan", confidence: 0.8, direct: false,
};

describe("transfer hints without unsupported directions", () => {
  it("names Bosmont only from the published shared-stop edge", () => {
    const hints = getTransferGuidance({ ...candidate, routeCodes: ["F6", "F7"],
      transferDetails: [{ fromRoute: "F6", toRoute: "F7", sharedStopLabels: ["Bosmont"] }] });
    expect(hints[0].title).toContain("Bosmont");
    expect(hints[0].detail).toContain("F6 and F7");
    expect(hints[0].detail).toContain("check the route direction");
  });

  it("uses each edge's own stop when multiple transfers exist", () => {
    const hints = getTransferGuidance({ ...candidate, transferDetails: [
      { fromRoute: "F1", toRoute: "T1", sharedStopLabels: ["A"] },
      { fromRoute: "T1", toRoute: "F7", sharedStopLabels: ["B"] },
    ] });
    expect(hints.map(hint => hint.title)).toEqual([
      "Possible interchange: A", "Possible interchange: B",
    ]);
  });

  it("never invents a transfer stop from route codes alone", () => {
    expect(getTransferGuidance({ ...candidate, routeCodes: ["F6", "F7"] })).toEqual([]);
  });

  it("describes mapped bus-to-rail legs as possible changes", () => {
    const hints = getTransferGuidance({ ...candidate, journeyLegs: [
      { id: "bus", mode: "bus", label: "Bus", from: "Origin", to: "Central" },
      { id: "rail", mode: "rail", label: "Train", from: "Station", to: "Destination" },
    ] });
    expect(hints[0].title).toContain("Central");
    expect(hints[0].detail).toContain("from Station");
    expect(hints[0].detail).toContain("not live departure instructions");
  });
});
