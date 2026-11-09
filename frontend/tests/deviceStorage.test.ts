// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import LocalTripStorage from "../src/utils/storage";
import Session from "../src/utils/session";
import { GUEST_HISTORY_OWNER } from "../src/services/guestProfile";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("device-only journey storage", () => {
  it("retains saved trips across reloads and isolates guest/account histories", () => {
    const guestTrips = [{ id: "guest-1", fare: 23 }];
    const accountTrips = [{ id: "account-1", fare: 40 }];
    expect(LocalTripStorage.save(GUEST_HISTORY_OWNER, "history", guestTrips)).toBe(true);
    expect(LocalTripStorage.save("commuter@example.com", "history", accountTrips)).toBe(true);
    expect(LocalTripStorage.load(GUEST_HISTORY_OWNER, "history")).toEqual(guestTrips);
    expect(LocalTripStorage.load("commuter@example.com", "history")).toEqual(accountTrips);
    LocalTripStorage.clear(GUEST_HISTORY_OWNER, "history");
    expect(LocalTripStorage.load(GUEST_HISTORY_OWNER, "history")).toBeNull();
    expect(LocalTripStorage.load("commuter@example.com", "history")).toEqual(accountTrips);
  });

  it("keeps offline guest preference on the device", () => {
    Session.save("guest_mode", true);
    expect(Session.load("guest_mode")).toBe(true);
  });

  it("reports storage failure instead of pretending a journey was saved", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(LocalTripStorage.save(GUEST_HISTORY_OWNER, "history", [{ id: "trip" }])).toBe(false);
    expect(error).toHaveBeenCalled();
  });
});
