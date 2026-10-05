import { CITIES, type RouteDef } from "./cities";
import { corridorPoint, haversineKm, distanceToCorridorKm, project } from "./geo";
import { APPROVED_STOP_T, STEP_MIN } from "./series";
import type { Sample } from "./types";

export const STOP_SPEED_KMH = 3;
export const STOP_MIN_MINUTES = 5;
export const DEVIATION_KM = 2;
export const APPROVED_RADIUS_KM = 3;

export interface Stop {
  startMinAgo: number;
  endMinAgo: number;
  durationMin: number;
  lat: number;
  lon: number;
  scheduled: boolean;
}

export function approvedStops(route: RouteDef) {
  return [
    { lon: CITIES[route.from].lon, lat: CITIES[route.from].lat },
    ...APPROVED_STOP_T.map((t) => corridorPoint(route, t)),
    { lon: CITIES[route.to].lon, lat: CITIES[route.to].lat },
  ];
}

/** A stop is speed under 3 km/h for at least 5 minutes. Scheduled when it sits within 3 km of an approved stop. */
export function findStops(samples: Sample[], route: RouteDef): Stop[] {
  const approved = approvedStops(route);
  const stops: Stop[] = [];
  let i = 0;
  while (i < samples.length) {
    if (samples[i].speedKmh < STOP_SPEED_KMH) {
      let j = i;
      while (j + 1 < samples.length && samples[j + 1].speedKmh < STOP_SPEED_KMH) j++;
      const duration = (j - i + 1) * STEP_MIN;
      if (duration >= STOP_MIN_MINUTES) {
        const s = samples[i];
        const scheduled = approved.some((a) => haversineKm(a, s) <= APPROVED_RADIUS_KM);
        stops.push({ startMinAgo: s.minAgo, endMinAgo: samples[j].minAgo, durationMin: duration, lat: s.lat, lon: s.lon, scheduled });
      }
      i = j + 1;
    } else i++;
  }
  return stops;
}

export function deviationKm(samples: Sample[], route: RouteDef): number {
  const last = samples[samples.length - 1];
  return distanceToCorridorKm(route, last);
}

export function etaMinutes(progress: number, routeLenKm: number, avgKmh = 80): number {
  return Math.max(0, Math.round(((1 - progress) * routeLenKm / avgKmh) * 60));
}

/** SVG path of the distance travelled, skipping repeated positions. */
export function actualPath(samples: Sample[]): string {
  return samples
    .filter((x, i) => i === 0 || x.lat !== samples[i - 1].lat || x.lon !== samples[i - 1].lon)
    .map((x, i) => { const p = project(x); return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; })
    .join("");
}

export interface Excursion { from: number; to: number; peak: number; durationMin: number }

/** Periods when the temperature sat outside the allowed band. `from` and `to` are minutes ago. */
export function excursions(samples: Sample[], tMin: number, tMax: number): Excursion[] {
  const out: Excursion[] = [];
  let cur: Excursion | null = null;
  let worst = 0;
  for (const x of samples) {
    const dev = x.tempC > tMax ? x.tempC - tMax : x.tempC < tMin ? tMin - x.tempC : 0;
    if (dev > 0) {
      if (!cur) { cur = { from: x.minAgo, to: x.minAgo, peak: x.tempC, durationMin: 0 }; worst = 0; }
      cur.to = x.minAgo;
      cur.durationMin += STEP_MIN;
      if (dev > worst) { worst = dev; cur.peak = x.tempC; }
    } else if (cur) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  return out;
}
