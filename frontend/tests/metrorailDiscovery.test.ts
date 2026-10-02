import { describe, expect, it } from "vitest";
import { discoverMetrorailCorridor, metrorailStations, nearestPrasaStation } from "../src/services/metrorailDiscovery";
import { getNearbyModeHints } from "../src/services/nearbyNetwork";
import { getCommuterFare, getBoardingHint } from "../src/features/planner/SimpleTransportOptions";

const loc = (lat:number,lng:number)=>({lat,lng,accuracy:20,timestamp:0});

describe("PRASA Naledi–Johannesburg pilot corridor", () => {
  const stations = metrorailStations();
  it("retains a sourced ordered 13-station stop list", () => {
    expect(stations).toHaveLength(13);
    expect(stations[0].name).toBe("Naledi");
    expect(stations[stations.length - 1].name).toBe("Park Station");
    for (const s of stations) {
      expect(Number.isFinite(s.lat)).toBe(true);
      expect(Number.isFinite(s.lng)).toBe(true);
      expect(s.coordinateSourceUrl.startsWith("https://mapcarta.com/")).toBe(true);
    }
  });

  it("returns a real mapped station near Soweto", () => {
    const nearest = nearestPrasaStation(loc(-26.26,27.855));
    expect(nearest?.station.name).toBeTruthy();
    expect(nearest?.accessKm).toBeLessThan(3);
    expect(getNearbyModeHints(loc(-26.26,27.855)).some(h=>h.id==="metrorail")).toBe(true);
  });

  it("can explain a station-to-station Naledi–Park connection without a made-up fare", () => {
    const options = discoverMetrorailCorridor(loc(-26.25794,27.82278),loc(-26.19767,28.04231));
    expect(options).toHaveLength(1);
    expect(options[0].routeName).toBe("Naledi → Park Station");
    expect(options[0].journeyLegs?.[0]?.mode).toBe("rail");
    expect(options[0].selectable).toBe(true);
    expect(options[0].estimatedFare).toBeNull();
    expect(getCommuterFare(options[0]).value).toBe("Fare to confirm");
    expect(getBoardingHint(options[0])).toContain("Closest mapped rail stop:");
  });

  it("keeps longer access to rail from masquerading as a complete journey", () => {
    const choices = discoverMetrorailCorridor(loc(-26.2678,27.8585),loc(-26.19767,28.04231));
    expect(choices).toHaveLength(1);
    expect(choices[0].selectable).toBe(false);
    expect(choices[0].badges).toContain("ACCESS_REQUIRED");
  });

  it("does not call a different destination a direct PRASA trip", () => {
    const soweto = loc(-26.26,27.855);
    const boksburg = loc(-26.216,28.26);
    expect(discoverMetrorailCorridor(soweto,boksburg)).toEqual([]);
  });

  it("does not assume remote stations are nearby", () => {
    expect(getNearbyModeHints(loc(-26.216,28.26)).some(h=>h.id==="metrorail")).toBe(false);
  });

  it("does not produce a false service for invalid points", () => {
    expect(discoverMetrorailCorridor(loc(NaN,27.8),loc(-26.197,28.042))).toEqual([]);
  });
});
