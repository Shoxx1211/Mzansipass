import { describe, expect, it } from "vitest";
import { earthDistanceKm, getNearbyModeHints } from "../src/services/nearbyNetwork";
import {
  getOsmTaxiFacilities,
  nearbyMinibusRankCandidates,
  validTaxiFacility,
  type TaxiFacility,
} from "../src/services/taxiFacilityEvidence";

const testRank: TaxiFacility = {
  id: "n/125",
  name: "Sample minibus point (test fixture only)",
  lat: -26.2,
  lng: 28.04,
  classification: "minibus-indicated",
  osmUrl: "https://www.openstreetmap.org/node/125",
};

describe("operator-backed nearby access", () => {
  it("finds a named City of Tshwane GIS stop near the commuter", () => {
    const hints = getNearbyModeHints({ lat: -25.68182, lng: 28.1838, timestamp: 0 });
    const areyeng = hints.find(item => item.id === "areyeng");
    expect(areyeng?.stopName).toBe("HECTOR PIETERSON");
    expect(areyeng?.kilometres).toBeLessThan(0.1);
    expect(areyeng?.detail).toContain("does not confirm a service call");
  });

  it("does not suggest A Re Yeng as nearby in Johannesburg", () => {
    const hints = getNearbyModeHints({ lat: -26.2041, lng: 28.0473, timestamp: 0 });
    expect(hints.some(item => item.id === "areyeng")).toBe(false);
  });

  it("does not invent PUTCO GPS boarding stops in Soshanguve", () => {
    const hints = getNearbyModeHints({ lat: -25.54, lng: 28.11, timestamp: 0 });
    const putco = hints.find(item => item.id === "putco");
    expect(putco?.dataType).toBe("regional-service");
    expect(putco?.kilometres).toBeUndefined();
  });

  it("returns no geographic claims without a valid origin", () => {
    expect(getNearbyModeHints(null)).toEqual([]);
    expect(getNearbyModeHints({ lat: Number.NaN, lng: 28, timestamp: 0 })).toEqual([]);
  });
});

describe("ODbL taxi facility safeguards", () => {
  it("does not create taxi ranks from an empty, un-imported source", () => {
    expect(getOsmTaxiFacilities()).toEqual([]);
    expect(getNearbyModeHints({ lat: -26.2, lng: 28.04 })
      .some(hint => hint.id === "taxi")).toBe(false);
  });

  it("rejects invalid geometry and unrelated map feature links", () => {
    expect(validTaxiFacility(testRank)).toBe(true);
    expect(validTaxiFacility({ ...testRank, lat: NaN })).toBe(false);
    expect(validTaxiFacility({ ...testRank, osmUrl: "https://unrelated.example/125" })).toBe(false);
  });

  it("never presents a generic taxi stand as a confirmed minibus candidate", () => {
    const origin = { lat: -26.2, lng: 28.04 };
    const genericStand = { ...testRank, id: "w/126", classification: "taxi-type-unconfirmed" as const,
      osmUrl: "https://www.openstreetmap.org/way/126" };
    const distantRank = { ...testRank, id: "n/127", lat: -25.7,
      osmUrl: "https://www.openstreetmap.org/node/127" };
    const result = nearbyMinibusRankCandidates(origin, earthDistanceKm,
      [genericStand, distantRank, testRank]);
    expect(result).toHaveLength(1);
    expect(result[0].facility.id).toBe(testRank.id);
    expect(result[0].kilometres).toBe(0);
  });
});
