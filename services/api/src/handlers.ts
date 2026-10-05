import { DEFAULT_THRESHOLDS, type Thresholds } from "./domain/alerts";
import { CITIES } from "./domain/cities";
import { filterFleet, countByStatus, type FleetFilter } from "./domain/filter";
import { FLEET_SIZE, alertsForContainer, getAlerts, getContainer, getFleet, getSeries } from "./domain/fleet";
import { computeHealth, excursionC, forecastBreach, topFactors } from "./domain/health";
import { getProfile, PROFILES } from "./domain/profiles";
import { deviationKm, etaMinutes, excursions, findStops } from "./domain/route";
import { getRoute, routeLengthKm } from "./domain/geo";
import { STEP_MIN } from "./domain/series";
import type { Status } from "./domain/types";
import { VERSION, openapi } from "./openapi";

export interface ApiRequest { method: string; path: string; query: URLSearchParams }
export interface ApiResponse { status: number; headers: Record<string, string>; body: unknown }

const STARTED = Date.now();
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};
// The data is deterministic, so responses can be cached hard at the edge.
const CACHE = "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400";

function json(status: number, body: unknown, cache = true): ApiResponse {
  return { status, body, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache ? CACHE : "no-store", "X-Content-Type-Options": "nosniff", ...CORS } };
}
function fail(status: number, code: string, message: string): ApiResponse {
  return json(status, { error: { code, message } }, false);
}

const STATUSES = ["normal", "warning", "critical"] as const;
const THRESHOLD_KEYS = Object.keys(DEFAULT_THRESHOLDS) as (keyof Thresholds)[];

function parseInt0(v: string | null, min: number, max: number): number | "bad" | null {
  if (v === null) return null;
  if (!/^\d+$/.test(v)) return "bad";
  const n = Number(v);
  return n < min || n > max ? "bad" : n;
}

function fleetEndpoint(q: URLSearchParams): ApiResponse {
  const status = q.get("status");
  if (status !== null && !(STATUSES as readonly string[]).includes(status)) return fail(400, "invalid_status", "status must be normal, warning or critical.");
  const profile = q.get("profile");
  if (profile !== null && !getProfile(profile)) return fail(400, "invalid_profile", `Unknown cargo profile "${profile}".`);
  const reefer = q.get("reefer");
  if (reefer !== null && reefer !== "true" && reefer !== "false") return fail(400, "invalid_reefer", "reefer must be true or false.");
  const limit = parseInt0(q.get("limit"), 1, FLEET_SIZE);
  const offset = parseInt0(q.get("offset"), 0, FLEET_SIZE);
  if (limit === "bad") return fail(400, "invalid_limit", `limit must be a whole number from 1 to ${FLEET_SIZE}.`);
  if (offset === "bad") return fail(400, "invalid_offset", `offset must be a whole number from 0 to ${FLEET_SIZE}.`);
  const f: FleetFilter = { q: q.get("q") ?? "", status: (status as Status | null) ?? "all", profile: profile ?? "all", reeferOnly: reefer === "true", customer: q.get("customer") ?? undefined };
  const all = getFleet();
  const matched = filterFleet(all, f);
  const page = matched.slice(offset ?? 0, limit === null ? undefined : (offset ?? 0) + limit);
  return json(200, { total: matched.length, fleetSize: all.length, counts: countByStatus(matched), containers: page });
}

function containerEndpoint(id: string): ApiResponse {
  const c = getContainer(id);
  const s = getSeries(id);
  const prof = c ? getProfile(c.profileId) : undefined;
  const route = c ? getRoute(c.routeId) : undefined;
  if (!c || !s || !prof || !route) return fail(404, "container_not_found", `No container with id "${id}".`);
  const health = computeHealth(s, prof);
  return json(200, {
    container: c,
    profile: prof,
    route: { id: route.id, from: CITIES[route.from], to: CITIES[route.to], lengthKm: Math.round(routeLengthKm(route)) },
    health,
    forecast: forecastBreach(s, prof),
    factors: topFactors(s, prof),
    stops: findStops(s, route),
    deviationKm: Math.round(deviationKm(s, route) * 10) / 10,
    etaMinutes: etaMinutes(c.progress, routeLengthKm(route)),
    withinBand: excursionC(c.tempC, prof) === 0,
    excursions: excursions(s, prof.tMin, prof.tMax),
    alerts: alertsForContainer(id),
  });
}

function alertsEndpoint(q: URLSearchParams): ApiResponse {
  const th: Thresholds = { ...DEFAULT_THRESHOLDS };
  let custom = false;
  for (const k of THRESHOLD_KEYS) {
    const raw = q.get(k);
    if (raw === null) continue;
    const n = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(n) || n <= 0) return fail(400, "invalid_threshold", `${k} must be a number greater than zero.`);
    th[k] = n;
    custom = true;
  }
  const severity = q.get("severity");
  if (severity !== null && severity !== "critical" && severity !== "warning") return fail(400, "invalid_severity", "severity must be critical or warning.");
  const customer = q.get("customer");
  const needle = (q.get("q") ?? "").trim().toLowerCase();
  const fleetById = new Map(getFleet().map((c) => [c.id, c]));
  const list = (custom ? getAlerts(th) : getAlerts()).filter((a) =>
    (severity === null || a.severity === severity) &&
    (customer === null || fleetById.get(a.containerId)?.customer === customer) &&
    (needle === "" || a.containerId.toLowerCase().includes(needle)));
  return json(200, { total: list.length, thresholds: th, alerts: list });
}

export function health(): ApiResponse {
  return json(200, { status: "ok", service: "smart-container-api", version: VERSION, fleetSize: FLEET_SIZE, uptimeSeconds: Math.round((Date.now() - STARTED) / 1000), stepMinutes: STEP_MIN }, false);
}

/** Framework-free router. The Vercel functions and the Node/Docker server both call this. */
export function handle(req: ApiRequest): ApiResponse {
  if (req.method === "OPTIONS") return { status: 204, headers: { ...CORS }, body: null };
  if (req.method !== "GET" && req.method !== "HEAD") {
    const r = fail(405, "method_not_allowed", "This API is read-only. Use GET.");
    r.headers.Allow = "GET, HEAD, OPTIONS";
    return r;
  }
  const path = req.path.replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/api" || path === "/api/v1") return json(200, { service: "smart-container-api", version: VERSION, docs: "/api/v1/openapi", health: "/api/v1/health" });
  if (path === "/api/v1/health") return health();
  if (path === "/api/v1/openapi") return json(200, openapi);
  if (path === "/api/v1/profiles") return json(200, { profiles: PROFILES });
  if (path === "/api/v1/fleet") return fleetEndpoint(req.query);
  if (path === "/api/v1/alerts") return alertsEndpoint(req.query);
  const m = /^\/api\/v1\/containers\/([^/]+)(\/series)?$/.exec(path);
  if (m) {
    let id: string;
    try { id = decodeURIComponent(m[1]); } catch { return fail(400, "invalid_id", "The container id is not valid URL encoding."); }
    if (m[2]) {
      const s = getSeries(id);
      return s ? json(200, { id, intervalMinutes: STEP_MIN, count: s.length, samples: s }) : fail(404, "container_not_found", `No container with id "${id}".`);
    }
    return containerEndpoint(id);
  }
  return fail(404, "not_found", `No route for ${path}.`);
}
