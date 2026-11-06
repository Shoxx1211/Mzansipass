import { describe, expect, it } from "vitest";
import { GUEST_HISTORY_OWNER, GUEST_ID, mergeGuestTrips } from "../src/services/guestProfile";
import type { TripData } from "../src/types";

const trip = (id: string, startTime: number): TripData => ({
  id, startTime, network: "Rea Vaya", distance: 3, fare: 12,
});

describe("privacy-preserving guest trip storage", () => {
  it("uses a distinct local identity, not a fabricated passenger account", () => {
    expect(GUEST_ID).not.toBe(GUEST_HISTORY_OWNER);
    expect(GUEST_ID).not.toContain("@");
  });

  it("merges only on explicit import, without duplicating account trips", () => {
    const existing = trip("account-a", 50);
    const guest = trip("guest-b", 100);
    expect(mergeGuestTrips([existing], [existing, guest]).map(item => item.id))
      .toEqual(["guest-b", "account-a"]);
    expect(existing.fare).toBe(12);
  });

  it("does not mutate either history when composing a suggested import", () => {
    const account = [trip("account", 100)];
    const guest = [trip("guest", 200)];
    mergeGuestTrips(account, guest);
    expect(account).toHaveLength(1);
    expect(guest).toHaveLength(1);
  });
});
