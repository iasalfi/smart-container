import type { Sample } from "../src/types";
import { STEP_MIN } from "../src/series";
import { CITIES } from "../src/cities";
import { corridorPoint, getRoute } from "../src/geo";

export const jedRuh = getRoute("jed-ruh")!;

/** Builds a series of n samples ending now, from a function of the index. */
export function make(n: number, f: (i: number) => Partial<Sample>): Sample[] {
  return Array.from({ length: n }, (_, i) => ({
    minAgo: (n - 1 - i) * STEP_MIN, tempC: 4, rh: 70, speedKmh: 80, door: "closed" as const,
    lat: corridorPoint(jedRuh, 0.5).lat, lon: corridorPoint(jedRuh, 0.5).lon, nh3: null, h2s: null, ...f(i),
  }));
}

export function atT(t: number) { const p = corridorPoint(jedRuh, t); return { lat: p.lat, lon: p.lon }; }
export const jeddah = CITIES.jeddah;
export const riyadh = CITIES.riyadh;
