import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeMapboxFeatures, searchMapboxPlaces, soshanguveBlock } from "../src/services/mapboxSearch";

const feature = (name: string, context = "Tshwane, Gauteng, South Africa", id = name) => ({
  geometry: { type: "Point", coordinates: [28.1, -25.5] },
  properties: { mapbox_id: id, name, place_formatted: context, feature_type: "neighborhood" },
});
const response = (features: unknown[]) => ({ ok: true, json: async () => ({ features }) });
afterEach(() => vi.unstubAllGlobals());

describe("current Mapbox location search", () => {
  it("uses v6 with ZA filtering and longitude-first proximity, without obsolete POI filter", async () => {
    const fetcher = vi.fn().mockResolvedValue(response([feature("Mamelodi")]));
    vi.stubGlobal("fetch", fetcher);
    const places = await searchMapboxPlaces("Mamelodi", { token: "pk.test", proximity: { lat: -25.7, lng: 28.3 } });
    const url = new URL(fetcher.mock.calls[0]![0] as string);
    expect(url.pathname).toBe("/search/geocode/v6/forward");
    expect(url.searchParams.get("country")).toBe("za");
    expect(url.searchParams.get("proximity")).toBe("28.3,-25.7");
    expect(url.searchParams.get("types")).not.toContain("poi");
    expect(places[0]).toMatchObject({ name: "Mamelodi", lat: -25.5, lng: 28.1 });
  });

  it("never substitutes the township centre for Block XX and retries an alternate spelling", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response([feature("Soshanguve")]))
      .mockResolvedValueOnce(response([feature("Soshanguve XX")]));
    vi.stubGlobal("fetch", fetcher);
    const results = await searchMapboxPlaces("Block XX Soshanguve", { token: "pk.test" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(results.map((place) => place.name)).toEqual(["Soshanguve XX"]);
    expect(new URL(fetcher.mock.calls[1]![0] as string).searchParams.get("q")).toBe("Soshanguve XX, Gauteng, South Africa");
  });

  it("leaves an unindexed block unresolved instead of broadening to a city", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([feature("Pretoria")])));
    expect(await searchMapboxPlaces("Soshanguve block XX", { token: "pk.test" })).toEqual([]);
  });

  it("does not reinterpret another township's block as Soshanguve", () => {
    expect(soshanguveBlock("Block A Mamelodi")).toBeNull();
    expect(soshanguveBlock("Soshanguve ext 4")).toBeNull();
    expect(soshanguveBlock("Soshanguve XX")).toBe("XX");
  });

  it("uses Search Box for landmarks and handles its GeoJSON response", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response([feature("Park Station", "Johannesburg, South Africa")]));
    vi.stubGlobal("fetch", fetcher);
    const results = await searchMapboxPlaces("Park Station", { token: "pk.test" });
    expect(new URL(fetcher.mock.calls[1]![0] as string).pathname).toBe("/search/searchbox/v1/forward");
    expect(results[0]?.name).toBe("Park Station");
  });

  it("retains usable geocoding when the landmark endpoint is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response([feature("Pretoria Station")]))
      .mockResolvedValueOnce({ ok: false, status: 403 }));
    expect(await searchMapboxPlaces("Pretoria Station", { token: "pk.test" })).toHaveLength(1);
  });

  it("reports token failures and passes cancellation to fetch", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    await expect(searchMapboxPlaces("Soweto", { token: "pk.test", signal: controller.signal })).rejects.toThrow("allowed website URLs");
    expect(fetcher.mock.calls[0]![1]).toEqual({ signal: controller.signal });
  });

  it("rejects malformed coordinates and uses full addresses for street results", () => {
    expect(decodeMapboxFeatures([{ ...feature("Broken"), geometry: { coordinates: [NaN, -25] } }])).toEqual([]);
    const address = feature("494 Attie Pelzer Street");
    expect(decodeMapboxFeatures([{ ...address, properties: { ...address.properties, feature_type: "address", full_address: "494 Attie Pelzer Street, Pretoria" } }])[0]?.name)
      .toBe("494 Attie Pelzer Street, Pretoria");
  });
});
