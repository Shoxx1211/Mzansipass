// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
  CapacitorCookies: {},
  CapacitorHttp: {},
}));

import { AuthApi } from "../src/services/authApi";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("offline-first account startup", () => {
  it("does not allow a stale server refresh to log someone in after choosing guest", async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>(resolve => {
      resolveFetch = resolve;
    }));
    vi.stubGlobal("fetch", fetchMock);
    const refresh = AuthApi.restore();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    AuthApi.cancelPendingRestore();
    resolveFetch(new Response(JSON.stringify({
      user: { id: "test", email: "commuter@example.com", role: "passenger" },
      access_token: "stale-token",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    expect(await refresh).toBeNull();
    expect(AuthApi.accessToken).toBeNull();
  });

  it("times out a hanging refresh rather than keeping commuters waiting indefinitely", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, options: RequestInit) =>
      new Promise((_resolve, reject) => {
        options.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")));
      })));
    const refresh = AuthApi.restore();
    await vi.advanceTimersByTimeAsync(5_100);
    expect(await refresh).toBeNull();
  });
});
