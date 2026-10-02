/**
 * Evidence-aware public transport pricing: a fare is a paid ticket product,
 * not necessarily one bus/train leg. Complete totals require every paid leg
 * to be priced from a matching published table or a passenger-confirmed receipt.
 */
import { publishedReaVayaFare, putcoSoshanguveFare, type FarePeriod } from "./publishedFareCatalog";

export type FareInputLeg = {
  id: string;
  mode: "walk" | "rea-vaya" | "putco" | "metrorail" | "taxi";
  /** Verifiable Rea Vaya passenger service length, not road/geodesic km. */
  serviceKm?: number | null;
  serviceDistanceBasis?: "operator-journey" | "straight-line" | "road";
  period?: FarePeriod;
  /** Same paid Rea Vaya journey only when operator transfer rules validated. */
  paidJourneyId?: string;
  continuationVerified?: boolean;
  putcoArea?: "soshanguve" | "soweto";
  fromZone?: string;
  toZone?: string;
  /** A receipt/payment supplied by rider, not a prediction. */
  passengerPaid?: number;
};
export type FareLine = {
  ticket: string;
  amount: number | null;
  evidence: "published" | "passenger-paid" | "unknown" | "free-walk";
  source?: string;
  explanation: string;
};
export type FareQuote = {
  lines: FareLine[];
  knownSubtotal: number;
  total: number | null;
  complete: boolean;
};

const finitePrice = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0;

export function quoteMultimodalFare(
  legs: FareInputLeg[],
  serviceDate = "2026-10-02",
): FareQuote {
  if (legs.length === 0) {
    return {lines: [], knownSubtotal: 0, total: null, complete: false};
  }
  const lines: FareLine[] = [];
  const doneGroups = new Set<string>();
  const multiLegGroups = new Map<string, FareInputLeg[]>();
  for (const leg of legs) {
    if (leg.mode === "rea-vaya" && leg.paidJourneyId) {
      const old = multiLegGroups.get(leg.paidJourneyId) ?? [];
      old.push(leg);
      multiLegGroups.set(leg.paidJourneyId, old);
    }
  }
  const ungroupedReaVayaLegs = legs.filter(leg => leg.mode === "rea-vaya" && !leg.paidJourneyId);
  for (const leg of legs) {
    if (leg.mode === "walk") {
      lines.push({ticket:leg.id,amount:0,evidence:"free-walk",explanation:"Walking has no operator ticket."});
      continue;
    }
    if (leg.mode === "rea-vaya") {
      const id = leg.paidJourneyId;
      if (id && doneGroups.has(id)) continue;
      if (id) doneGroups.add(id);
      const group = id ? multiLegGroups.get(id) ?? [leg] : [leg];
      const validContinuation = group.length < 2 ||
        group.every(part => part.continuationVerified === true);
      const ambiguousUngroupedTransfer = !id && ungroupedReaVayaLegs.length > 1;
      const validDistance = group.every(part =>
        part.serviceDistanceBasis === "operator-journey" &&
        typeof part.serviceKm === "number" &&
        Number.isFinite(part.serviceKm) && part.serviceKm > 0);
      const matchingPeriod = group.every(part => part.period === group[0].period);
      const fare = validDistance && validContinuation && matchingPeriod &&
        !ambiguousUngroupedTransfer && group[0].period
          ? publishedReaVayaFare(group.reduce((sum,part) => sum + (part.serviceKm ?? 0),0),
            group[0].period,serviceDate)
          : null;
      lines.push({
        ticket:id ? "Rea Vaya fare group " + id : leg.id,
        amount:fare?.amount ?? null,
        evidence:fare ? "published":"unknown",
        ...(fare ? {source:fare.sourceUrl} : {}),
        explanation: fare
          ? "One published fare for " + group.length + " bus leg(s); validated continuity, documented on-network distance."
          : "Rea Vaya fare needs on-network distance and (for transfers) verified ticket continuation, not a road estimate.",
      });
      continue;
    }
    if (leg.mode === "putco") {
      const priced = leg.putcoArea === "soshanguve" && leg.fromZone && leg.toZone
        ? putcoSoshanguveFare(leg.fromZone,leg.toZone,serviceDate) : null;
      lines.push({
        ticket: leg.id,amount:priced?.amount ?? null,
        evidence:priced ? "published" : "unknown",
        ...(priced ? {source:priced.sourceUrl} : {}),
        explanation:priced ? priced.description :
          "PUTCO ticket price needs the exact service-area zone pair and product; Soweto fares cannot use Soshanguve prices.",
      });
      continue;
    }
    if (leg.mode === "metrorail") {
      lines.push({
        ticket:leg.id,amount:null,evidence:"unknown",
        source:"https://www.sanews.gov.za/south-africa/metrorail-increases-train-fare",
        explanation:"PRASA ticket price requires a sourced current station-to-station zone/fare pair.",
      });
      continue;
    }
    if (leg.mode === "taxi") {
      lines.push({
        ticket:leg.id,amount:finitePrice(leg.passengerPaid) ? leg.passengerPaid : null,
        evidence:finitePrice(leg.passengerPaid) ? "passenger-paid":"unknown",
        explanation:finitePrice(leg.passengerPaid)
          ? "Passenger-confirmed paid fare, not a route-wide public tariff."
          : "Association-specific taxi fare not yet documented for this boarding/destination pair.",
      });
    }
  }
  const knownSubtotal = Math.round(lines.reduce((sum,line)=>sum+(line.amount ?? 0),0)*100)/100;
  const complete = lines.length > 0 && lines.every(line=>line.amount !== null);
  return {lines,knownSubtotal,total:complete?knownSubtotal:null,complete};
}
