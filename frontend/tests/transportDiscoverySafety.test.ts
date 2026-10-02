import { describe, expect, it } from "vitest";
import { JourneyDiscoveryEngine } from "../src/services/journeyDiscoveryEngine";

describe("Soweto corridor evidence safeguards", () => {
  it("does not imply PUTCO runs an identified Soweto-to-Boksburg service", async () => {
    // Fixed integration fixtures. They are not commuter live GPS fixes.
    const soweto = { lat: -26.2678, lng: 27.8585, accuracy: 10, timestamp: 0 };
    const boksburg = { lat: -26.2160, lng: 28.2596, accuracy: 10, timestamp: 0 };
    const recs = await JourneyDiscoveryEngine.discover(soweto, boksburg);
    expect(recs.some(rec => rec.mode === "Putco")).toBe(false);
  });
});
