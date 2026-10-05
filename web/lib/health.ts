import type { CargoProfile, Sample } from "./types";
import { STEP_MIN } from "./series";

export const Q10 = 2;
/** Weighted degree-hours at which the health score halves. */
export const DH_HALF = 4;
export const FORECAST_WINDOW = 36; // samples, 3 hours
export const FORECAST_HORIZON_H = 6;

export function excursionC(tempC: number, p: CargoProfile): number {
  if (tempC > p.tMax) return tempC - p.tMax;
  if (tempC < p.tMin) return p.tMin - tempC;
  return 0;
}

export function rhExcursion(rh: number, p: CargoProfile): number {
  if (rh > p.rhMax) return rh - p.rhMax;
  if (rh < p.rhMin) return p.rhMin - rh;
  return 0;
}

export interface HealthResult {
  score: number;
  tempDegreeHours: number;
  weightedDegreeHours: number;
  rhPointHours: number;
  minutesOutside: number;
  remainingShelfLifeH: number;
}

/** Cargo health: Q10-weighted degree-hours outside the temperature band plus a humidity term. Score from 0 to 100. */
export function computeHealth(samples: Sample[], p: CargoProfile): HealthResult {
  const dtH = STEP_MIN / 60;
  let dh = 0, wdh = 0, rhh = 0, minOut = 0;
  for (const s of samples) {
    const e = excursionC(s.tempC, p);
    if (e > 0) {
      dh += e * dtH;
      wdh += e * dtH * Math.pow(Q10, e / 10);
      minOut += STEP_MIN;
    }
    rhh += (rhExcursion(s.rh, p) / 10) * dtH;
  }
  const damage = wdh + 0.5 * rhh;
  const score = Math.max(0, Math.min(100, 100 * Math.pow(0.5, damage / DH_HALF)));
  return {
    score: Math.round(score * 10) / 10,
    tempDegreeHours: Math.round(dh * 100) / 100,
    weightedDegreeHours: Math.round(wdh * 100) / 100,
    rhPointHours: Math.round(rhh * 100) / 100,
    minutesOutside: minOut,
    remainingShelfLifeH: Math.round(p.shelfLifeH * (score / 100)),
  };
}

export interface Forecast {
  slopeCPerH: number;
  r2: number;
  /** Hours until the upper or lower limit is crossed, or null when no breach is expected. */
  etaH: number | null;
  limit: "upper" | "lower" | null;
}

/** Linear fit over the last three hours, projected up to six hours ahead. */
export function forecastBreach(samples: Sample[], p: CargoProfile): Forecast {
  const w = samples.slice(-FORECAST_WINDOW);
  if (w.length < 6) return { slopeCPerH: 0, r2: 0, etaH: null, limit: null };
  const n = w.length;
  const xs = w.map((_, i) => (i * STEP_MIN) / 60);
  const ys = w.map((s) => s.tempC);
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); syy += (ys[i] - my) ** 2; }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const r2 = syy === 0 ? 0 : (sxy * sxy) / (sxx * syy);
  const now = ys[n - 1];
  const inBand = now >= p.tMin && now <= p.tMax;
  if (!inBand || r2 < 0.7 || Math.abs(slope) < 0.15) return { slopeCPerH: slope, r2, etaH: null, limit: null };
  if (slope > 0) {
    const eta = (p.tMax - now) / slope;
    return eta <= FORECAST_HORIZON_H ? { slopeCPerH: slope, r2, etaH: eta, limit: "upper" } : { slopeCPerH: slope, r2, etaH: null, limit: null };
  }
  const eta = (now - p.tMin) / -slope;
  return eta <= FORECAST_HORIZON_H ? { slopeCPerH: slope, r2, etaH: eta, limit: "lower" } : { slopeCPerH: slope, r2, etaH: null, limit: null };
}

export interface Factor { key: "temp" | "rh" | "door" | "time"; value: number }

export function topFactors(samples: Sample[], p: CargoProfile): Factor[] {
  const h = computeHealth(samples, p);
  let doorEvents = 0;
  for (let i = 1; i < samples.length; i++) if (samples[i].door === "open" && samples[i - 1].door === "closed") doorEvents++;
  const f: Factor[] = [
    { key: "temp", value: h.tempDegreeHours },
    { key: "rh", value: h.rhPointHours },
    { key: "door", value: doorEvents },
    { key: "time", value: h.minutesOutside },
  ];
  return f.sort((a, b) => b.value - a.value);
}
