import { ROUTE_REGISTRY } from "../constants";

type Location = { lat: number; lng: number };

export class RouteEngine {

  static findClosestRoute(userLoc: Location) {
    let bestMatch = null;
    let bestDistance = Infinity;

    for (const route of ROUTE_REGISTRY) {
      if (!route.coordinates) continue;

      for (const point of route.coordinates) {
        const dist = this.distance(userLoc, point);

        if (dist < bestDistance) {
          bestDistance = dist;
          bestMatch = route;
        }
      }
    }

    return {
      route: bestMatch,
      distance: bestDistance
    };
  }

  private static distance(a: Location, b: Location) {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI/180;
    const dLon = (b.lng - a.lng) * Math.PI/180;

    const x =
      Math.sin(dLat/2)**2 +
      Math.cos(a.lat*Math.PI/180) *
      Math.cos(b.lat*Math.PI/180) *
      Math.sin(dLon/2)**2;

    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  }
}