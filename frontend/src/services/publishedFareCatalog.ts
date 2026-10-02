/**
 * Public-operator fare catalogue (data provenance is part of the result).
 * Data is NOT a claim about live fares or an exact stop-to-stop fare unless
 * the journey distance / PUTCO fare zones are independently established.
 * Do not derive public-transport fares from Mapbox driving distance.
 */
import reaVayaData from "../data/transit/gauteng/reavaya/fares.json";
import putcoSoshanguve from "../data/transit/gauteng/putco/soshanguve/fares.json";

export type FarePeriod = "peak" | "offPeak";
export type PublishedTariff = {
  operator: "Rea Vaya" | "PUTCO";
  amount: number;
  currency: "ZAR";
  basis: "official-distance-band" | "official-zone-pair";
  effectiveFrom: string;
  effectiveTo?: string;
  sourceUrl: string;
  description: string;
};

type ReaVayaFareBand = {
  lowerBoundKm: number;
  upperBoundKm: number | null;
  peakFare: number;
  offPeakFare: number;
};

export const REAVAYA_SOURCE = reaVayaData.source.sourceUrl;
export const PUTCO_ZONE_GUIDE = "https://putco.co.za/smartap/";
export const PUTCO_SOWETO_2026_NOTICE =
  "https://putco.co.za/wp-content/uploads/2026/05/2026-Final-Soweto-Passenger-Notice-Fare-Increase.docx-2-1.pdf";

export function publishedReaVayaFare(
  serviceDistanceKm: number,
  period: FarePeriod,
  serviceDate = "2026-10-02",
): PublishedTariff | null {
  if (!Number.isFinite(serviceDistanceKm) || serviceDistanceKm <= 0 ||
      serviceDate < reaVayaData.effectiveFrom ||
      serviceDate > reaVayaData.effectiveTo) return null;

  // Use the official 2026/27 fare matrix already stored in the repository.
  const bands = reaVayaData.fareModel.bands as ReaVayaFareBand[];
  const band = bands.find(row =>
    serviceDistanceKm > row.lowerBoundKm ||
    (row.lowerBoundKm === 0 && serviceDistanceKm > 0)
  // Upper bound is inclusive. Exact multiples (5,10,15...) must remain in
  // the preceding band, not be rounded up.
  && (row.upperBoundKm === null || serviceDistanceKm <= row.upperBoundKm));
  if (!band) return null;

  return {
    operator: "Rea Vaya",
    amount: period === "peak" ? band.peakFare : band.offPeakFare,
    currency: "ZAR",
    basis: "official-distance-band",
    effectiveFrom: reaVayaData.effectiveFrom,
    effectiveTo: reaVayaData.effectiveTo,
    sourceUrl: REAVAYA_SOURCE,
    description: "Official 2026/27 " + (period === "peak" ? "peak" : "off-peak") +
      " fare for a measured Rea Vaya passenger journey of " +
      serviceDistanceKm.toFixed(2) + " km",
  };
}

/** PUTCO fares come from ticket zones, not a universal price per km. */
export function putcoSoshanguveFare(
  fromZone: string,
  toZone: string,
  serviceDate = "2026-10-02",
): PublishedTariff | null {
  if (serviceDate < putcoSoshanguve.effectiveFrom) return null;
  const fare = putcoSoshanguve.ticketProducts.find(row =>
    row.fromZone === fromZone && row.toZone === toZone);
  if (!fare) return null;
  return {
    operator: "PUTCO",
    amount: fare.cash,
    currency: "ZAR",
    basis: "official-zone-pair",
    effectiveFrom: putcoSoshanguve.effectiveFrom,
    sourceUrl: PUTCO_ZONE_GUIDE,
    description: "PUTCO Soshanguve cash ticket " + fare.code +
      ", zone " + fromZone + " to " + toZone +
      ". Only applies to this documented zone pair.",
  };
}

/**
 * Source explicitly provides both peak and off-peak prices, but its peak
 * clock window isn't normalized, so show both until boarding time is known.
 */
export function reaVayaPeakAndOffPeak(serviceDistanceKm: number, serviceDate = "2026-10-02") {
  const peak = publishedReaVayaFare(serviceDistanceKm, "peak", serviceDate);
  const offPeak = publishedReaVayaFare(serviceDistanceKm, "offPeak", serviceDate);
  return peak && offPeak ? { peak, offPeak } : null;
}
