import { describe,expect,it } from "vitest";
import { mayUseLegacyFareEngine,hasUnresolvedReaVayaTransfer } from "../src/services/trackedFarePolicy";
import type { JourneyLeg } from "../src/types";

const base: JourneyLeg = {id:"1",mode:"taxi",label:"Taxi",operator:"Taxi",distanceKm:8,distanceSource:"road",fare:null};

describe("source-specific commuter fare policy",()=>{
  it("allows only road-backed taxi approximation",()=>{
    expect(mayUseLegacyFareEngine(base,"Taxi")).toBe(true);
    expect(mayUseLegacyFareEngine({...base,distanceSource:"straight"},"Taxi")).toBe(false);
    expect(mayUseLegacyFareEngine({...base,distanceKm:NaN},"Taxi")).toBe(false);
    expect(mayUseLegacyFareEngine({...base,distanceKm:0},"Taxi")).toBe(false);
  });
  it("never supplies synthetic rand-per-kilometre fares to public bus or PRASA trains",()=>{
    expect(mayUseLegacyFareEngine({...base,mode:"bus",operator:"Rea Vaya"},"Rea Vaya")).toBe(false);
    expect(mayUseLegacyFareEngine({...base,mode:"rail",operator:"Metrorail"},"Metrorail")).toBe(false);
    expect(mayUseLegacyFareEngine({...base,mode:"bus",operator:"Putco"},"Putco")).toBe(false);
  });
  it("doesn't double-charge a potential one-ticket Rea Vaya transfer",()=>{
    const bus:JourneyLeg={...base,mode:"bus",operator:"Rea Vaya"};
    expect(hasUnresolvedReaVayaTransfer([bus,{...bus,id:"2"}])).toBe(true);
    expect(hasUnresolvedReaVayaTransfer([base,bus])).toBe(false);
  });
});
