/** Nearby transport evidence is not a journey recommendation. Do not merge
 * these hints into priced end-to-end results unless both ends and transfers
 * match a real operator route. */
import brtStationsRaw from "../data/transit/gauteng/reavaya/brt-station-points.geojson?raw";
import areyengStops from "../data/transit/gauteng/areyeng/normalized-stops.json";
import gautrainData from "../data/transit/gauteng/gautrain/stations.json";
import type { Location } from "../types";
import { nearestPrasaStation } from "./metrorailDiscovery";
import { nearbyMinibusRankCandidates } from "./taxiFacilityEvidence";

type PointFeature = { geometry?: { type?: string; coordinates?: number[] } };
type BRTData = { features?: PointFeature[] };
export type NearbyModeHint = {
  id: "reavaya" | "areyeng" | "putco" | "gautrain" | "metrorail" | "taxi";
  name: string;
  detail: string;
  stopName?: string;
  kilometres?: number;
  dataType: "mapped-stop" | "mapped-facility" | "regional-service";
  sourceUrl: string;
  sourceLabel?: string;
  attribution?: string;
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

/** Coarse PUTCO discovery only, never used as a boarding-stop boundary. */
const isInSoshanguveArea = (origin: Location) =>
  origin.lat >= -25.65 && origin.lat <= -25.42 &&
  origin.lng >= 28.00 && origin.lng <= 28.23;

export function getNearbyModeHints(
  origin: Location | null,
): NearbyModeHint[] {
  if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) return [];

  const hints: NearbyModeHint[] = [];

  // ODbL rank point evidence only. No inferred route, fare, taxi stopping
  // pattern or walking-path guarantee is included in this hint.
  const nearestTaxiRank = nearbyMinibusRankCandidates(origin, earthDistanceKm)[0];
  if (nearestTaxiRank) {
    hints.push({
      id: "taxi", name: "Minibus taxi (mapped candidate)",
      stopName: nearestTaxiRank.facility.name,
      detail: "An OpenStreetMap feature indicates a possible minibus taxi rank. " +
        "The rank, destinations, boarding bays, fare and operating times " +
        "have not been independently verified by Pulse. Confirm locally.",
      kilometres: Math.round(nearestTaxiRank.kilometres * 100) / 100,
      dataType: "mapped-facility",
      sourceUrl: nearestTaxiRank.facility.osmUrl,
      sourceLabel: "View OpenStreetMap feature",
      attribution: "© OpenStreetMap contributors (ODbL)",
    });
  }
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
      detail: "City-mapped BRT station point. The source has no station name or confirmed route calls; check the station sign and serving routes before boarding.",
      kilometres: Math.round(nearestBrt * 100) / 100,
      dataType: "mapped-stop",
      sourceUrl: "https://reavaya.org.za/rea-vaya-operating-routes/",
    });
  }

  // Official City of Tshwane mapped stops. Candidate route codes come from
  // geometric proximity, NOT a confirmed timetable, direction or stop call.
  const nearestAreyeng = areyengStops
    .filter(stop => Number.isFinite(stop.location.lat) && Number.isFinite(stop.location.lng))
    .map(stop => ({ stop, km: earthDistanceKm(origin, stop.location) }))
    .sort((a, b) => a.km - b.km)[0];
  if (nearestAreyeng && nearestAreyeng.km <= 2.5) {
    const routeCodes = [...new Set(nearestAreyeng.stop.candidateRoutes
      .map(route => route.routeCode))].slice(0, 3);
    hints.push({
      id: "areyeng", name: "A Re Yeng",
      stopName: nearestAreyeng.stop.name,
      detail: `City-mapped stop: ${nearestAreyeng.stop.name}. ` +
        (routeCodes.length ? `Nearby mapped route corridors: ${routeCodes.join(", ")}. ` : "") +
        "Route proximity does not confirm a service call, direction or departure.",
      kilometres: Math.round(nearestAreyeng.km * 100) / 100,
      dataType: "mapped-stop",
      sourceUrl: "https://www.areyeng.co.za/routes-stops/a-re-yeng-bus-stations/",
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
      stopName: nearestGautrain.name,
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
      stopName: nearestMetrorail.station.name,
      detail: "Nearest mapped pilot-corridor station: " +
        nearestMetrorail.station.name + " (" + nearestMetrorail.corridorLabel + "). " +
        "Reaching the platform and train departure must be checked. " +
        "Mapped distance is straight-line, not a walking route.",
      kilometres: Math.round(nearestMetrorail.accessKm * 100) / 100,
      dataType: "mapped-stop",
      sourceUrl: "https://www.prasa.com/",
    });
  }

  if (isInSowetoArea(origin) || isInSoshanguveArea(origin)) {
    hints.push({
      id: "putco", name: "PUTCO",
      detail: isInSoshanguveArea(origin)
        ? "PUTCO publishes Soshanguve zone and transfer-place information, but no verified GPS boarding-stop coordinates for this pin. Check the operator's route finder."
        : "PUTCO publishes service for parts of Soweto. Its nearest boarding stop has not been established from this pin.",
      dataType: "regional-service",
      sourceUrl: "https://putco.co.za/tickets-route-finder/",
    });
  }
  return hints.sort((a, b) =>
    (a.kilometres ?? Number.POSITIVE_INFINITY) -
    (b.kilometres ?? Number.POSITIVE_INFINITY));
}
