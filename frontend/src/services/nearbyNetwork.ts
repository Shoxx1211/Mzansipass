/** Nearby transport evidence is not a journey recommendation. Do not merge
 * these hints into priced end-to-end results unless both ends and transfers
 * match a real operator route. */
import brtStationsRaw from "../data/transit/gauteng/reavaya/brt-station-points.geojson?raw";
import gautrainData from "../data/transit/gauteng/gautrain/stations.json";
import type { Location } from "../types";
import { nearestPrasaStation } from "./metrorailDiscovery";

type PointFeature = { geometry?: { type?: string; coordinates?: number[] } };
type BRTData = { features?: PointFeature[] };
export type NearbyModeHint = {
  id: "reavaya" | "putco" | "gautrain" | "metrorail";
  name: string;
  detail: string;
  kilometres?: number;
  dataType: "mapped-stop" | "regional-service";
  sourceUrl: string;
};

const brtStations = JSON.parse(brtStationsRaw) as BRTData;

export const earthDistanceKm = (
  a: Pick<Location, "lat" | "lng">,
  b: Pick<Location, "lat" | "lng">,
): number => {
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lng - a.lng);
  const root = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(root), Math.sqrt(Math.max(0, 1 - root)));
};

/** Engineering-only coarse region filter. Not a claim of a specific bus stop. */
const isInSowetoArea = (origin: Location) =>
  origin.lat >= -26.42 && origin.lat <= -26.17 &&
  origin.lng >= 27.68 && origin.lng <= 28.02;

export function getNearbyModeHints(
  origin: Location | null,
): NearbyModeHint[] {
  if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) return [];

  const hints: NearbyModeHint[] = [];
  let nearestBrt = Number.POSITIVE_INFINITY;
  for (const feature of brtStations.features ?? []) {
    const coord = feature.geometry?.coordinates;
    if (feature.geometry?.type !== "Point" || !coord ||
        !Number.isFinite(coord[0]) || !Number.isFinite(coord[1])) continue;
    nearestBrt = Math.min(nearestBrt, earthDistanceKm(origin, { lng: coord[0], lat: coord[1] }));
  }
  if (nearestBrt <= 2.5) {
    hints.push({
      id: "reavaya", name: "Rea Vaya",
      detail: "City-mapped BRT station. Check its name, entrance and serving routes before boarding.",
      kilometres: Math.round(nearestBrt * 100) / 100,
      dataType: "mapped-stop",
      sourceUrl: "https://reavaya.org.za/rea-vaya-operating-routes/",
    });
  }

  const nearestGautrain = gautrainData.stations
    .map(st => ({ name: st.name, km: earthDistanceKm(origin, st.location) }))
    .sort((a, b) => a.km - b.km)[0];
  // Beyond 5km, don't call Gautrain nearby; the journey planner can still
  // propose access transport to a distant station.
  if (nearestGautrain && nearestGautrain.km <= 5) {
    hints.push({
      id: "gautrain", name: "Gautrain",
      detail: "Nearest published station: " + nearestGautrain.name +
        ". Distance is straight-line, not a walking route.",
      kilometres: Math.round(nearestGautrain.km * 100) / 100,
      dataType: "mapped-stop",
      sourceUrl: "https://www.gautrain.co.za/routes",
    });
  }

  // Include PRASA access in the same locality view as buses/taxis.
  // This is a mapped station, not a prediction that a train is arriving.
  const nearestMetrorail = nearestPrasaStation(origin);
  if (nearestMetrorail && nearestMetrorail.accessKm <= 5) {
    hints.push({
      id: "metrorail", name: "PRASA Metrorail",
      detail: "Nearest mapped Naledi–Park Station corridor stop: " +
        nearestMetrorail.station.name +
        ". Reaching the platform and train departure must be checked. " +
        "Mapped distance is straight-line, not a walking route.",
      kilometres: Math.round(nearestMetrorail.accessKm * 100) / 100,
      dataType: "mapped-stop",
      sourceUrl: "https://www.prasa.com/",
    });
  }

  if (isInSowetoArea(origin)) {
    hints.push({
      id: "putco", name: "PUTCO",
      detail: "PUTCO publishes service for parts of Soweto. Its nearest boarding stop has not been established from this pin.",
      dataType: "regional-service",
      sourceUrl: "https://putco.co.za/smartap/",
    });
  }
  return hints;
}
