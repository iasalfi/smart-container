import { corridorPoint, haversineKm, type LonLat } from "./geo";
import type { RouteDef } from "./cities";

/** A road as [lon, lat] pairs, the order MapLibre and GeoJSON use. */
export type Coord = [number, number];

export interface Road {
  coords: Coord[];
  km: number;
  durationMin: number;
  /** "road" when the routing service answered, "estimate" when the line was built locally. */
  source: "road" | "estimate";
}

export const OSRM_BASE = "https://router.project-osrm.org";
export const ESTIMATE_ROAD_FACTOR = 1.22;
export const ESTIMATE_KMH = 80;

const ll = (c: Coord): LonLat => ({ lon: c[0], lat: c[1] });

/** Distance in km from the start to every vertex. */
export function cumulativeKm(coords: Coord[]): number[] {
  const out = [0];
  for (let i = 1; i < coords.length; i++) out.push(out[i - 1] + haversineKm(ll(coords[i - 1]), ll(coords[i])));
  return out;
}

export function lengthKm(coords: Coord[]): number {
  const c = cumulativeKm(coords);
  return c.length ? c[c.length - 1] : 0;
}

/** Initial compass bearing from a to b, 0 to 360. */
export function bearingDeg(a: Coord, b: Coord): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(r(b[0] - a[0])) * Math.cos(r(b[1]));
  const x = Math.cos(r(a[1])) * Math.sin(r(b[1])) - Math.sin(r(a[1])) * Math.cos(r(b[1])) * Math.cos(r(b[0] - a[0]));
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

export interface RoadPoint { lon: number; lat: number; bearing: number; km: number }

/** The point a share (0 to 1) of the way along the road, with the direction of travel there. */
export function pointAtShare(coords: Coord[], share: number, cumulative?: number[]): RoadPoint {
  if (coords.length === 0) return { lon: 0, lat: 0, bearing: 0, km: 0 };
  if (coords.length === 1) return { lon: coords[0][0], lat: coords[0][1], bearing: 0, km: 0 };
  const cum = cumulative ?? cumulativeKm(coords);
  const total = cum[cum.length - 1];
  const s = Math.min(1, Math.max(0, share));
  const target = s * total;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  const seg = cum[i] - cum[i - 1];
  const f = seg === 0 ? 0 : (target - cum[i - 1]) / seg;
  const a = coords[i - 1], b = coords[i];
  return { lon: a[0] + (b[0] - a[0]) * f, lat: a[1] + (b[1] - a[1]) * f, bearing: bearingDeg(a, b), km: target };
}

/** The part of the road from the start up to a share, ending exactly at that point. */
export function sliceToShare(coords: Coord[], share: number): Coord[] {
  if (coords.length < 2 || share <= 0) return coords.length ? [coords[0]] : [];
  if (share >= 1) return coords.slice();
  const cum = cumulativeKm(coords);
  const target = share * cum[cum.length - 1];
  const out: Coord[] = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    if (cum[i] < target) { out.push(coords[i]); continue; }
    const p = pointAtShare(coords, share);
    out.push([p.lon, p.lat]);
    break;
  }
  return out;
}

/** How far a truck gets in a stretch of simulated time, as a new share of the road. */
export function advanceShare(share: number, speedKmh: number, roadKm: number, simSeconds: number): number {
  if (roadKm <= 0 || speedKmh <= 0) return Math.min(1, Math.max(0, share));
  return Math.min(1, Math.max(0, share + (speedKmh * (simSeconds / 3600)) / roadKm));
}

/** South-west and north-east corners, for fitting a map to a line. */
export function boundsOf(coords: Coord[]): [Coord, Coord] | null {
  if (coords.length === 0) return null;
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of coords) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
  return [[w, s], [e, n]];
}

/** A local stand-in for a road: the planned corridor, sampled, used when the routing service cannot be reached. */
export function corridorCoords(route: RouteDef, steps = 60): Coord[] {
  const out: Coord[] = [];
  for (let i = 0; i <= steps; i++) { const p = corridorPoint(route, i / steps); out.push([p.lon, p.lat]); }
  return out;
}

/** A local stand-in for a multi-stop road: straight legs between the stops. */
export function estimateRoad(points: LonLat[]): Road {
  const coords: Coord[] = points.map((p) => [p.lon, p.lat]);
  const km = lengthKm(coords) * ESTIMATE_ROAD_FACTOR;
  return { coords, km, durationMin: Math.round((km / ESTIMATE_KMH) * 60), source: "estimate" };
}

export function roadFromCoords(coords: Coord[], source: Road["source"]): Road {
  const km = lengthKm(coords) * (source === "estimate" ? ESTIMATE_ROAD_FACTOR : 1);
  return { coords, km, durationMin: Math.round((km / ESTIMATE_KMH) * 60), source };
}

export function osrmUrl(points: LonLat[], alternatives = false, full = false): string {
  const path = points.map((p) => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(";");
  return `${OSRM_BASE}/route/v1/driving/${path}?overview=${full ? "full" : "simplified"}&geometries=geojson&alternatives=${alternatives ? "true" : "false"}`;
}

/** Reads the routes out of a routing-service answer. Returns an empty list when the answer holds no usable route. */
export function parseOsrm(json: unknown): Road[] {
  const routes = (json as { code?: string; routes?: unknown[] } | null)?.routes;
  if (!json || (json as { code?: string }).code !== "Ok" || !Array.isArray(routes)) return [];
  const out: Road[] = [];
  for (const r of routes as { geometry?: { coordinates?: unknown }; distance?: number; duration?: number }[]) {
    const c = r?.geometry?.coordinates;
    if (!Array.isArray(c) || c.length < 2 || typeof r.distance !== "number" || typeof r.duration !== "number") continue;
    const coords = (c as unknown[]).filter((p): p is Coord => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])).map((p) => [p[0], p[1]] as Coord);
    if (coords.length < 2) continue;
    out.push({ coords, km: r.distance / 1000, durationMin: Math.round(r.duration / 60), source: "road" });
  }
  return out;
}
