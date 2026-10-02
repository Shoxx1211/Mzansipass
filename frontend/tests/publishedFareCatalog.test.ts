import { describe, expect, it } from "vitest";
import {
  publishedReaVayaFare,
  putcoSoshanguveFare,
  reaVayaPeakAndOffPeak,
} from "../src/services/publishedFareCatalog";

describe("2026/27 official Rea Vaya published fare bands", () => {
  it.each([
    [0.1, 11.5, 10], [5, 11.5, 10], [5.01, 14.5, 13],
    [10, 14.5, 13], [10.01, 17, 15], [15, 17, 15],
    [15.01, 19.5, 17.5], [25, 19.5, 17.5],
    [25.01, 21.5, 19.5], [35, 21.5, 19.5],
    [35.01, 22.5, 20.5], [45, 22.5, 20.5],
    [45.01, 28.5, 26.5], [60, 28.5, 26.5],
  ])("%d km prices peak/offpeak R%s/R%s", (km, peak, offPeak) => {
    const quote = reaVayaPeakAndOffPeak(km);
    expect(quote?.peak.amount).toBe(peak);
    expect(quote?.offPeak.amount).toBe(offPeak);
  });

  it("never prices unsupported distances or dates", () => {
    expect(publishedReaVayaFare(0, "peak")).toBeNull();
    expect(publishedReaVayaFare(NaN, "peak")).toBeNull();
    expect(publishedReaVayaFare(-20, "peak")).toBeNull();
    expect(publishedReaVayaFare(8, "peak", "2026-06-30")).toBeNull();
    expect(publishedReaVayaFare(8, "peak", "2027-07-01")).toBeNull();
  });
});

describe("PUTCO zone ticket pricing", () => {
  it("prices only a documented 2026 Soshanguve zone pair", () => {
    expect(putcoSoshanguveFare("L4", "L1")?.amount).toBe(20);
    expect(putcoSoshanguveFare("L4", "L1")?.basis).toBe("official-zone-pair");
  });
  it("does not substitute another area or date", () => {
    expect(putcoSoshanguveFare("Soweto", "Boksburg")).toBeNull();
    expect(putcoSoshanguveFare("L4", "L1", "2026-05-31")).toBeNull();
  });
});
