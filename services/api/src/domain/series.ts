import { mulberry32, range } from "./rng";
import { corridorPoint, getRoute, routeLengthKm, type LonLat } from "./geo";
import { getProfile } from "./profiles";
import type { Container, Sample } from "./types";

export const STEP_MIN = 5;
export const WINDOW_MIN = 1440;
export const SAMPLES = WINDOW_MIN / STEP_MIN + 1; // 289, oldest first
/** Approved (scheduled) stops along every corridor, as fractions of the route. */
export const APPROVED_STOP_T = [0.35, 0.7];
export const STOP_STEPS = 5;

export interface SeriesParams {
  id: string;
  profileId: string;
  routeId: string;
  scenario: Container["scenario"];
  progress: number;
  gas: boolean;
  seed: number;
}

const smooth = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };

/** Builds 24 hours of readings, one every 5 minutes, deterministic for a given container. */
export function buildSeries(p: SeriesParams): Sample[] {
  const rnd = mulberry32(p.seed);
  const route = getRoute(p.routeId);
  const prof = getProfile(p.profileId);
  if (!route || !prof) throw new Error(`buildSeries: unknown route or profile for ${p.id}`);
  const len = routeLengthKm(route);
  const mid = (prof.tMin + prof.tMax) / 2;
  const half = (prof.tMax - prof.tMin) / 2;
  const phase = rnd() * Math.PI * 2;
  const period = 14 + rnd() * 4; // samples, about 70 to 90 minutes
  const amp = prof.reefer ? Math.min(0.45, 0.12 * (prof.tMax - prof.tMin)) : 0;
  const rhMid = (prof.rhMin + prof.rhMax) / 2;
  const rhHalf = (prof.rhMax - prof.rhMin) / 2;

  // movement plan
  const dp0 = (80 * (STEP_MIN / 60)) / len;
  const hold = p.scenario === "stop" ? 8 : 0;
  const M = Math.max(2, Math.round(p.progress / dp0));
  const stopsT = APPROVED_STOP_T.filter((t) => t > 0.05 && t < p.progress - 0.04);
  const stopsInRange = stopsT.length;
  const s0 = SAMPLES - (M + stopsInRange * (STOP_STEPS - 1) + hold);
  const dp = p.progress / M;

  const pos: number[] = new Array(SAMPLES).fill(0);
  const speed: number[] = new Array(SAMPLES).fill(0);
  let cur = 0;
  let i = Math.max(0, s0);
  let moved = 0;
  const pendingStops = [...stopsT];
  while (i < SAMPLES) {
    if (moved < M) {
      cur = Math.min(p.progress, cur + dp);
      moved++;
      if (pendingStops.length && cur >= pendingStops[0]) {
        const t = pendingStops.shift() as number;
        cur = t;
        for (let k = 0; k < STOP_STEPS && i < SAMPLES; k++, i++) { pos[i] = t; speed[i] = 0; }
        continue;
      }
      pos[i] = cur;
      speed[i] = 80 + (rnd() - 0.5) * 16;
      i++;
    } else {
      pos[i] = p.progress;
      speed[i] = 0;
      i++;
    }
  }
  pos[SAMPLES - 1] = p.progress;

  // scenario shaping
  const E = 2.3 + rnd() * 2.7; // forecast eta in hours
  const kk = (E * 60) / 360;
  const gap0 = prof.tMax - mid;
  const dMargin = (kk * gap0) / (1 + kk);
  const tempStart = 150 + rnd() * 150;
  const excess = 3.7 + rnd() * 1.8;
  const reeferExcess = 2.7 + rnd() * 0.6;
  const gasStart = 150 + rnd() * 90;
  const gasNh3 = 30 + rnd() * 30;
  const gasH2s = 8 + rnd() * 12;
  const devMax = 3 + rnd() * 12;
  const dev = (rnd() < 0.5 ? 1 : -1) * devMax;
  const doorIdx = SAMPLES - 3;
  const out: Sample[] = [];
  for (let k = 0; k < SAMPLES; k++) {
    const minAgo = WINDOW_MIN - k * STEP_MIN;
    const tod = (14.5 * 60 - minAgo) / 60; // hours of day
    let tempC: number;
    let rh: number;
    if (prof.reefer) {
      const osc = amp * Math.sin((2 * Math.PI * k) / period + phase);
      let ramp = 0;
      if (p.scenario === "temp") ramp = (mid + excess - mid) * smooth((tempStart - minAgo) / tempStart);
      if (p.scenario === "reefer") ramp = reeferExcess * smooth((tempStart - minAgo) / tempStart);
      tempC = mid + osc + ramp;
      if (p.scenario === "forecast") {
        const D = 360;
        const target = prof.tMax - dMargin - mid;
        const frac = minAgo >= D ? 0 : 1 - minAgo / D;
        tempC = mid + 0.02 * Math.sin((2 * Math.PI * k) / 7 + phase) + target * frac;
      }
      rh = rhMid + 0.18 * rhHalf * Math.sin((2 * Math.PI * k) / (period * 1.3) + phase + 1);
    } else {
      const base = 27 + 5.5 * Math.sin(((tod - 9) / 24) * 2 * Math.PI);
      tempC = base + (rnd() - 0.5) * 0.4;
      rh = 38 + 8 * Math.sin(((tod - 3) / 24) * 2 * Math.PI) + (rnd() - 0.5) * 2;
      if (p.scenario === "forecast") tempC = base;
    }
    if (p.scenario === "temp") rh += 6 * smooth((tempStart - minAgo) / tempStart);
    tempC = Math.round(tempC * 100) / 100;
    rh = Math.min(99, Math.max(5, Math.round(rh * 10) / 10));

    // position, with the optional deviation drift in the last 20 samples
    let pt: LonLat = corridorPoint(route, pos[k]);
    if (p.scenario === "deviation") {
      const f = smooth((k - (SAMPLES - 21)) / 20);
      const a = corridorPoint(route, Math.max(0, pos[k] - 0.01));
      const b = corridorPoint(route, Math.min(1, pos[k] + 0.01));
      const dx = b.lon - a.lon, dy = b.lat - a.lat;
      const n = Math.hypot(dx, dy) || 1;
      const kmPerDeg = 111;
      pt = { lon: pt.lon + (-dy / n) * (dev * f) / kmPerDeg, lat: pt.lat + (dx / n) * (dev * f) / kmPerDeg };
    }

    let door: "open" | "closed" = "closed";
    if (k >= Math.max(0, s0 - 3) && k < Math.max(1, s0)) door = "open"; // loading at the origin
    if (p.scenario === "door" && k >= doorIdx) door = "open"; // opened while moving
    if (p.scenario === "door" && k >= doorIdx) speed[k] = Math.max(speed[k], 62);

    let nh3: number | null = null, h2s: number | null = null;
    if (p.gas) {
      nh3 = 3 + 1.2 * Math.sin(k / 9 + phase);
      h2s = 0.4 + 0.15 * Math.sin(k / 11 + phase);
      if (p.scenario === "gas") {
        const f = smooth((gasStart - minAgo) / gasStart);
        nh3 += gasNh3 * f;
        h2s += gasH2s * f;
      }
      nh3 = Math.round(nh3 * 10) / 10;
      h2s = Math.round(h2s * 10) / 10;
    }
    out.push({ minAgo, tempC, rh, speedKmh: Math.round(speed[k] * 10) / 10, door, lat: pt.lat, lon: pt.lon, nh3, h2s });
  }
  return out;
}

export function rangeBetween(rnd: () => number, a: number, b: number) { return range(rnd, a, b); }
