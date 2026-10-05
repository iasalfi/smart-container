import { getRoute } from "./geo";
import { excursionC, forecastBreach } from "./health";
import { getProfile } from "./profiles";
import { deviationKm, findStops } from "./route";
import { STEP_MIN } from "./series";
import type { Alert, AlertType, Container, Sample, Severity } from "./types";

export interface Thresholds {
  tempCriticalC: number;
  tempCriticalMin: number;
  reeferSetpointC: number;
  reeferMin: number;
  doorSpeedKmh: number;
  unscheduledStopMin: number;
  deviationKm: number;
  nh3Ppm: number;
  h2sPpm: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  tempCriticalC: 3,
  tempCriticalMin: 20,
  reeferSetpointC: 2,
  reeferMin: 15,
  doorSpeedKmh: 5,
  unscheduledStopMin: 5,
  deviationKm: 2,
  nh3Ppm: 25,
  h2sPpm: 10,
};

export const SEVERITY: Record<AlertType, Severity> = {
  temperature_critical: "critical",
  reefer_setpoint: "critical",
  door_in_motion: "critical",
  gas_high: "critical",
  unscheduled_stop: "warning",
  route_deviation: "warning",
  health_forecast: "warning",
};

function trailing(samples: Sample[], pred: (s: Sample) => boolean): number {
  let n = 0;
  for (let i = samples.length - 1; i >= 0 && pred(samples[i]); i--) n++;
  return n;
}

export interface RawAlert { type: AlertType; severity: Severity; minutesAgo: number; params: Record<string, number | string> }

/** Rule engine. Defaults follow the BRD alert catalogue (Appendix A). */
export function evaluateAlerts(c: Container, samples: Sample[], th: Thresholds = DEFAULT_THRESHOLDS): RawAlert[] {
  const prof = getProfile(c.profileId);
  const route = getRoute(c.routeId);
  if (!prof || !route || samples.length === 0) return [];
  const out: RawAlert[] = [];
  const last = samples[samples.length - 1];

  const outside = trailing(samples, (s) => excursionC(s.tempC, prof) > 0);
  const exc = excursionC(last.tempC, prof);
  if (exc > th.tempCriticalC || outside * STEP_MIN >= th.tempCriticalMin) {
    out.push({ type: "temperature_critical", severity: "critical", minutesAgo: outside * STEP_MIN, params: { tempC: last.tempC, excessC: Math.round(exc * 10) / 10 } });
  }

  if (c.reefer && c.setpointC !== null) {
    const sp = c.setpointC;
    const off = trailing(samples, (s) => Math.abs(s.tempC - sp) > th.reeferSetpointC);
    if (off * STEP_MIN >= th.reeferMin) {
      out.push({ type: "reefer_setpoint", severity: "critical", minutesAgo: off * STEP_MIN, params: { setpointC: sp, tempC: last.tempC } });
    }
  }

  const recent = samples.slice(-12);
  const doorHit = recent.filter((s) => s.door === "open" && s.speedKmh > th.doorSpeedKmh);
  if (doorHit.length > 0) {
    out.push({ type: "door_in_motion", severity: "critical", minutesAgo: doorHit[0].minAgo, params: { speedKmh: Math.round(doorHit[doorHit.length - 1].speedKmh) } });
  }

  if (last.nh3 !== null && last.h2s !== null && (last.nh3 >= th.nh3Ppm || last.h2s >= th.h2sPpm)) {
    out.push({ type: "gas_high", severity: "critical", minutesAgo: 0, params: { nh3: last.nh3, h2s: last.h2s } });
  }

  const stops = findStops(samples, route);
  const ongoing = stops.find((s) => s.endMinAgo === 0 && !s.scheduled && s.durationMin >= th.unscheduledStopMin);
  if (ongoing) out.push({ type: "unscheduled_stop", severity: "warning", minutesAgo: ongoing.durationMin, params: { minutes: ongoing.durationMin } });

  const dev = deviationKm(samples, route);
  if (dev > th.deviationKm) out.push({ type: "route_deviation", severity: "warning", minutesAgo: 0, params: { km: Math.round(dev * 10) / 10 } });

  if (prof.reefer && !out.some((a) => a.type === "temperature_critical" || a.type === "reefer_setpoint")) {
    const f = forecastBreach(samples, prof);
    if (f.etaH !== null) out.push({ type: "health_forecast", severity: "warning", minutesAgo: 0, params: { etaH: Math.round(f.etaH * 10) / 10, limit: f.limit ?? "upper" } });
  }
  return out;
}

export function toAlerts(c: Container, raw: RawAlert[]): Alert[] {
  return raw.map((r, i) => ({ id: `${c.id}-${r.type}-${i}`, containerId: c.id, type: r.type, severity: r.severity, minutesAgo: r.minutesAgo, state: "open" as const, params: r.params }));
}
