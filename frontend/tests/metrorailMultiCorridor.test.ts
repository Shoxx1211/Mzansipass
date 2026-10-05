import { describe, expect, it } from "vitest";
import { discoverMetrorailCorridor } from "../src/services/metrorailDiscovery";

const loc = (lat: number, lng: number) => ({
  lat, lng, accuracy: 5, timestamp: 0,
});

describe("PRASA multi-corridor discovery", () => {
  it("finds a direct published Park Station to Germiston rail journey", () => {
    const recs = discoverMetrorailCorridor(
      loc(-26.19767, 28.04231),
      loc(-26.2098, 28.16768),
    );
    const direct = recs.find((rec) =>
      rec.routeName === "Park Station → Germiston");
    expect(direct).toBeDefined();
    expect(direct?.estimatedTime).toBe(32);
    expect(direct?.serviceDistanceKm).toBeCloseTo(13.83, 1);
    expect(direct?.journeyLegs).toHaveLength(1);
    expect(direct?.selectable).toBe(true);
  });

  it("joins Soweto's Naledi corridor to Germiston at Park Station", () => {
    const recs = discoverMetrorailCorridor(
      loc(-26.25794, 27.82278),
      loc(-26.2098, 28.16768),
    );
    const transfer = recs.find((rec) =>
      rec.routeName?.includes("Naledi → Park Station → Germiston"));
    expect(transfer).toBeDefined();
    expect(transfer?.journeyLegs).toHaveLength(2);
    expect(transfer?.transferStops?.[0]).toBe("Park Station");
    expect(transfer?.estimatedTime).toBe(82);
    expect(transfer?.fareStatus).toBe("unverified");
  });

  it("does not invent a direct PRASA trip to far-away Boksburg from the current pilot corridors", () => {
    const recs = discoverMetrorailCorridor(
      loc(-26.25794, 27.82278),
      loc(-26.2326, 28.2409),
    );
    expect(recs.some((rec) => rec.destinationStop?.includes("Boksburg"))).toBe(false);
  });
});
