import { describe,expect,it } from "vitest";
import { quoteMultimodalFare, type FareInputLeg } from "../src/services/multimodalFareQuote";

const rv = (id:string,km:number):FareInputLeg=>({
  id,mode:"rea-vaya",serviceKm:km,serviceDistanceBasis:"operator-journey",period:"peak"
});
describe("multimodal paid-ticket fare ledger",()=>{
  it("prices a known Rea Vaya service-distance band",()=>{
    const quote=quoteMultimodalFare([rv("T3",12)]);
    expect(quote.complete).toBe(true);
    expect(quote.total).toBe(17);
    expect(quote.lines[0].evidence).toBe("published");
  });
  it("charges one official fare for validated Rea Vaya transfer, not twice",()=>{
    const quote=quoteMultimodalFare([
      {...rv("F6",4),paidJourneyId:"ticket-A",continuationVerified:true},
      {...rv("T3",9),paidJourneyId:"ticket-A",continuationVerified:true}
    ]);
    expect(quote.lines).toHaveLength(1);
    expect(quote.total).toBe(17);
    expect(quote.lines[0].explanation).toContain("2 bus leg");
  });
  it("refuses to assume the transfer is free without supporting conditions",()=>{
    const quote=quoteMultimodalFare([
      {...rv("F6",4),paidJourneyId:"ticket-A"},
      {...rv("T3",9),paidJourneyId:"ticket-A"}
    ]);
    expect(quote.total).toBeNull();
    expect(quote.complete).toBe(false);
  });
  it("does not estimate fare from geodesic distance or Mapbox driving km",()=>{
    const quote=quoteMultimodalFare([{...rv("T3",20),serviceDistanceBasis:"road"}]);
    expect(quote.total).toBeNull();
  });
  it("uses only Putco Soshanguve tariff for its matching zones",()=>{
    const quote=quoteMultimodalFare([
      {id:"putco-1",mode:"putco",putcoArea:"soshanguve",fromZone:"L4",toZone:"L1"}
    ]);
    expect(quote.total).toBe(20);
    expect(quote.lines[0].source).toContain("putco.co.za");
    const soweto=quoteMultimodalFare([
      {id:"putco-soweto",mode:"putco",putcoArea:"soweto",fromZone:"L4",toZone:"L1"}
    ]);
    expect(soweto.total).toBeNull();
  });
  it("leaves PRASA fare unknown even when a Rea Vaya leg is priced",()=>{
    const quote=quoteMultimodalFare([
      rv("T3",12),{id:"prasa",mode:"metrorail"}
    ]);
    expect(quote.knownSubtotal).toBe(17);
    expect(quote.total).toBeNull();
    expect(quote.complete).toBe(false);
  });
  it("combines separate published fare and paid taxi receipt without pretending taxi is official",()=>{
    const quote=quoteMultimodalFare([
      {id:"walk",mode:"walk"},rv("T3",12),
      {id:"taxi",mode:"taxi",passengerPaid:20}
    ]);
    expect(quote.total).toBe(37);
    expect(quote.lines.at(-1)?.evidence).toBe("passenger-paid");
  });
  it("never reports R0 for an empty journey",()=>{
    const quote=quoteMultimodalFare([]);
    expect(quote.total).toBeNull();
    expect(quote.complete).toBe(false);
  });
});
