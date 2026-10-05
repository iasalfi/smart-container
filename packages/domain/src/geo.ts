import { MERC, VIEW } from "./geo-data";
import { CITIES, ROUTES, type RouteDef } from "./cities";

export interface LonLat { lon: number; lat: number }

/** Web Mercator, same maths as d3-geo geoMercator with the stored scale and translate. */
export function project(p: LonLat): { x: number; y: number } {
  const lam = (p.lon * Math.PI) / 180;
  const phi = (p.lat * Math.PI) / 180;
  return { x: MERC.tx + MERC.k * lam, y: MERC.ty - MERC.k * Math.log(Math.tan(Math.PI / 4 + phi / 2)) };
}

export function inView(p: LonLat): boolean {
  const { x, y } = project(p);
  return x >= 0 && x <= VIEW.w && y >= 0 && y <= VIEW.h;
}

export function getRoute(id: string): RouteDef | undefined {
  return ROUTES.find((r) => r.id === id);
}

/** Point on the planned corridor, a quadratic curve in lon/lat space. t from 0 to 1. */
export function corridorPoint(route: RouteDef, t: number): LonLat {
  const a = CITIES[route.from], b = CITIES[route.to];
  const tt = Math.min(1, Math.max(0, t));
  const mx = (a.lon + b.lon) / 2, my = (a.lat + b.lat) / 2;
  const dx = b.lon - a.lon, dy = b.lat - a.lat;
  const cx = mx - dy * route.bend * 2, cy = my + dx * route.bend * 2;
  const u = 1 - tt;
  return { lon: u * u * a.lon + 2 * u * tt * cx + tt * tt * b.lon, lat: u * u * a.lat + 2 * u * tt * cy + tt * tt * b.lat };
}

export function corridorPath(route: RouteDef, steps = 40): string {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const p = project(corridorPoint(route, i / steps));
    d += (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1);
  }
  return d;
}

/** Great-circle distance in km. */
export function haversineKm(a: LonLat, b: LonLat): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Smallest distance in km from a point to the planned corridor: coarse scan, then a local refinement. */
export function distanceToCorridorKm(route: RouteDef, p: LonLat, samples = 80): number {
  let best = Infinity, bestT = 0;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const d = haversineKm(p, corridorPoint(route, t));
    if (d < best) { best = d; bestT = t; }
  }
  let lo = Math.max(0, bestT - 1 / samples), hi = Math.min(1, bestT + 1 / samples);
  for (let i = 0; i < 40; i++) {
    const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
    const d1 = haversineKm(p, corridorPoint(route, m1)), d2 = haversineKm(p, corridorPoint(route, m2));
    if (d1 < d2) hi = m2; else lo = m1;
    best = Math.min(best, d1, d2);
  }
  return best;
}

export function routeLengthKm(route: RouteDef, samples = 60): number {
  let len = 0;
  let prev = corridorPoint(route, 0);
  for (let i = 1; i <= samples; i++) {
    const cur = corridorPoint(route, i / samples);
    len += haversineKm(prev, cur);
    prev = cur;
  }
  return len;
}
