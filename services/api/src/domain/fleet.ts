import { mulberry32, pick, range } from "./rng";
import { CITIES, ROUTES } from "./cities";
import { corridorPoint, getRoute } from "./geo";
import { computeHealth } from "./health";
import { getProfile, PROFILES } from "./profiles";
import { buildSeries, type SeriesParams } from "./series";
import { evaluateAlerts, toAlerts, DEFAULT_THRESHOLDS, type Thresholds } from "./alerts";
import type { Alert, Container, Sample } from "./types";

export const FLEET_SIZE = 1000;
export const COUNTS = { normal: 912, warning: 61, critical: 27, offline: 12 } as const;
const SCENARIOS: [Container["scenario"], number][] = [
  ["temp", 9], ["reefer", 6], ["door", 7], ["gas", 5],
  ["stop", 20], ["deviation", 17], ["forecast", 24],
];
export const CUSTOMERS = ["Najd Fresh Foods", "Red Sea Seafood", "Gulf Pharma Supply", "Hijaz Retail Group", "Eastern Dairy Co", "Tabuk Produce", "Desert Gate Trading", "Peninsula Electronics"];
const DRIVERS = ["Ahmed Al-Harbi", "Khalid Al-Otaibi", "Fahad Al-Qahtani", "Saud Al-Dosari", "Omar Al-Ghamdi", "Yousef Al-Zahrani", "Nasser Al-Shehri", "Majed Al-Mutairi", "Salman Al-Anazi", "Faisal Al-Subaie", "Turki Al-Juhani", "Abdullah Al-Malki"];
const LETTERS = "ABDEGHJKLNRSTUVXZ";

const CRITICAL_SCENARIOS = new Set(["temp", "reefer", "door", "gas"]);

function shuffle<T>(rnd: () => number, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function weightedRoute(rnd: () => number) {
  const total = ROUTES.reduce((s, r) => s + r.weight, 0);
  let x = rnd() * total;
  for (const r of ROUTES) { x -= r.weight; if (x <= 0) return r; }
  return ROUTES[0];
}

export interface SeriesCache { get(id: string): Sample[] | undefined }

const seriesParams = new Map<string, SeriesParams>();
let fleet: Container[] | null = null;
const seriesMemo = new Map<string, Sample[]>();

export function generateFleet(): Container[] {
  const rnd = mulberry32(20261005);
  const order = shuffle(rnd, Array.from({ length: FLEET_SIZE }, (_, i) => i));
  const scenarioOf = new Array<Container["scenario"]>(FLEET_SIZE).fill("none");
  let cursor = 0;
  for (const [sc, n] of SCENARIOS) for (let k = 0; k < n; k++) scenarioOf[order[cursor++]] = sc;
  const normalIdx = order.slice(cursor);
  const offline = new Set(normalIdx.slice(0, COUNTS.offline));

  const reeferProfiles = PROFILES.filter((p) => p.reefer);
  const gasProfiles = PROFILES.filter((p) => p.gasRelevant);
  const list: Container[] = [];
  seriesParams.clear();
  seriesMemo.clear();

  for (let i = 0; i < FLEET_SIZE; i++) {
    const sc = scenarioOf[i];
    const prof = sc === "forecast" ? pick(rnd, reeferProfiles.filter((p) => (p.tMax - p.tMin) / 2 <= 2.5)) : sc === "temp" || sc === "reefer" ? pick(rnd, reeferProfiles) : sc === "gas" ? pick(rnd, gasProfiles) : pick(rnd, PROFILES);
    const route = weightedRoute(rnd);
    let progress = range(rnd, 0.12, 0.88);
    if (sc === "stop") {
      const bands: [number, number][] = [[0.12, 0.3], [0.42, 0.62], [0.78, 0.88]];
      const b = pick(rnd, bands);
      progress = range(rnd, b[0], b[1]);
    }
    const gas = sc === "gas" || (prof.gasRelevant && rnd() < 0.2);
    const padlock = rnd() < 0.3;
    const id = `SC-${1001 + i}`;
    const params: SeriesParams = { id, profileId: prof.id, routeId: route.id, scenario: sc, progress, gas, seed: 1000 + i * 7919, };
    seriesParams.set(id, params);
    const samples = buildSeries(params);
    const last = samples[samples.length - 1];
    const prev = samples.slice().reverse().find((s) => s.lat !== last.lat || s.lon !== last.lon) ?? last;
    const heading = (Math.atan2(last.lon - prev.lon, last.lat - prev.lat) * 180) / Math.PI;
    const health = computeHealth(samples, prof);
    const status: Container["status"] = CRITICAL_SCENARIOS.has(sc) ? "critical" : sc === "none" ? "normal" : "warning";
    const isOffline = offline.has(i);
    const from = CITIES[route.from], to = CITIES[route.to];
    const plate = `${LETTERS[Math.floor(rnd() * LETTERS.length)]}${LETTERS[Math.floor(rnd() * LETTERS.length)]}${LETTERS[Math.floor(rnd() * LETTERS.length)]} ${1000 + Math.floor(rnd() * 8999)}`;
    list.push({
      id, profileId: prof.id, reefer: prof.reefer, plate, driver: pick(rnd, DRIVERS), customer: pick(rnd, CUSTOMERS),
      tripId: `TR-${100100 + i * 3}`, routeId: route.id, origin: from.en, destination: to.en, status, online: !isOffline,
      progress, lat: last.lat, lon: last.lon, speedKmh: isOffline ? 0 : last.speedKmh, headingDeg: Math.round((heading + 360) % 360),
      tempC: last.tempC, rh: last.rh, setpointC: prof.reefer ? Math.round(((prof.tMin + prof.tMax) / 2) * 10) / 10 : null,
      door: last.door, lock: padlock ? (sc === "door" ? "unlocked" : "locked") : "none", padlock,
      gas: gas && last.nh3 !== null && last.h2s !== null ? { nh3: last.nh3, h2s: last.h2s } : null,
      batteryPct: Math.round(range(rnd, 22, 100)), signal: isOffline ? 0 : 1 + Math.floor(rnd() * 5),
      healthScore: health.score, scenario: sc, lastSeenMin: isOffline ? Math.round(range(rnd, 25, 90)) : Math.floor(rnd() * 5),
    });
  }
  return list;
}

export function getFleet(): Container[] {
  if (!fleet) fleet = generateFleet();
  return fleet;
}

export function getContainer(id: string | null | undefined): Container | undefined {
  if (!id) return undefined;
  return getFleet().find((c) => c.id === id);
}

export function getSeries(id: string): Sample[] | undefined {
  getFleet();
  const hit = seriesMemo.get(id);
  if (hit) return hit;
  const p = seriesParams.get(id);
  if (!p) return undefined;
  const s = buildSeries(p);
  if (seriesMemo.size > 40) seriesMemo.clear();
  seriesMemo.set(id, s);
  return s;
}

let alertsCache: Alert[] | null = null;
let alertsFor: Thresholds | null = null;

/** All alerts for the fleet, evaluated by the rule engine. */
export function getAlerts(th: Thresholds = DEFAULT_THRESHOLDS): Alert[] {
  if (alertsCache && alertsFor === th) return alertsCache;
  const out: Alert[] = [];
  for (const c of getFleet()) {
    if (c.status === "normal" && c.scenario === "none") {
      const s = buildSeries(seriesParams.get(c.id) as SeriesParams);
      out.push(...toAlerts(c, evaluateAlerts(c, s, th)));
      continue;
    }
    const s = getSeries(c.id) as Sample[];
    out.push(...toAlerts(c, evaluateAlerts(c, s, th)));
  }
  out.sort((a, b) => (a.severity === b.severity ? a.minutesAgo - b.minutesAgo : a.severity === "critical" ? -1 : 1));
  alertsCache = out;
  alertsFor = th;
  return out;
}

export function alertsForContainer(id: string, th: Thresholds = DEFAULT_THRESHOLDS): Alert[] {
  const c = getContainer(id);
  const s = getSeries(id);
  if (!c || !s) return [];
  return toAlerts(c, evaluateAlerts(c, s, th));
}

export { getRoute, corridorPoint, getProfile };
