"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.health = health;
exports.handle = handle;
const alerts_1 = require("./domain/alerts");
const cities_1 = require("./domain/cities");
const filter_1 = require("./domain/filter");
const fleet_1 = require("./domain/fleet");
const health_1 = require("./domain/health");
const profiles_1 = require("./domain/profiles");
const route_1 = require("./domain/route");
const geo_1 = require("./domain/geo");
const series_1 = require("./domain/series");
const openapi_1 = require("./openapi");
const STARTED = Date.now();
const CORS = {
    "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
};
// The data is deterministic, so responses can be cached hard at the edge.
const CACHE = "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400";
function json(status, body, cache = true) {
    return { status, body, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache ? CACHE : "no-store", "X-Content-Type-Options": "nosniff", ...CORS } };
}
function fail(status, code, message) {
    return json(status, { error: { code, message } }, false);
}
const STATUSES = ["normal", "warning", "critical"];
const THRESHOLD_KEYS = Object.keys(alerts_1.DEFAULT_THRESHOLDS);
function parseInt0(v, min, max) {
    if (v === null)
        return null;
    if (!/^\d+$/.test(v))
        return "bad";
    const n = Number(v);
    return n < min || n > max ? "bad" : n;
}
function fleetEndpoint(q) {
    const status = q.get("status");
    if (status !== null && !STATUSES.includes(status))
        return fail(400, "invalid_status", "status must be normal, warning or critical.");
    const profile = q.get("profile");
    if (profile !== null && !(0, profiles_1.getProfile)(profile))
        return fail(400, "invalid_profile", `Unknown cargo profile "${profile}".`);
    const reefer = q.get("reefer");
    if (reefer !== null && reefer !== "true" && reefer !== "false")
        return fail(400, "invalid_reefer", "reefer must be true or false.");
    const limit = parseInt0(q.get("limit"), 1, fleet_1.FLEET_SIZE);
    const offset = parseInt0(q.get("offset"), 0, fleet_1.FLEET_SIZE);
    if (limit === "bad")
        return fail(400, "invalid_limit", `limit must be a whole number from 1 to ${fleet_1.FLEET_SIZE}.`);
    if (offset === "bad")
        return fail(400, "invalid_offset", `offset must be a whole number from 0 to ${fleet_1.FLEET_SIZE}.`);
    const f = { q: q.get("q") ?? "", status: status ?? "all", profile: profile ?? "all", reeferOnly: reefer === "true", customer: q.get("customer") ?? undefined };
    const all = (0, fleet_1.getFleet)();
    const matched = (0, filter_1.filterFleet)(all, f);
    const page = matched.slice(offset ?? 0, limit === null ? undefined : (offset ?? 0) + limit);
    return json(200, { total: matched.length, fleetSize: all.length, counts: (0, filter_1.countByStatus)(matched), containers: page });
}
function containerEndpoint(id) {
    const c = (0, fleet_1.getContainer)(id);
    const s = (0, fleet_1.getSeries)(id);
    const prof = c ? (0, profiles_1.getProfile)(c.profileId) : undefined;
    const route = c ? (0, geo_1.getRoute)(c.routeId) : undefined;
    if (!c || !s || !prof || !route)
        return fail(404, "container_not_found", `No container with id "${id}".`);
    const health = (0, health_1.computeHealth)(s, prof);
    return json(200, {
        container: c,
        profile: prof,
        route: { id: route.id, from: cities_1.CITIES[route.from], to: cities_1.CITIES[route.to], lengthKm: Math.round((0, geo_1.routeLengthKm)(route)) },
        health,
        forecast: (0, health_1.forecastBreach)(s, prof),
        factors: (0, health_1.topFactors)(s, prof),
        stops: (0, route_1.findStops)(s, route),
        deviationKm: Math.round((0, route_1.deviationKm)(s, route) * 10) / 10,
        etaMinutes: (0, route_1.etaMinutes)(c.progress, (0, geo_1.routeLengthKm)(route)),
        withinBand: (0, health_1.excursionC)(c.tempC, prof) === 0,
        excursions: (0, route_1.excursions)(s, prof.tMin, prof.tMax),
        alerts: (0, fleet_1.alertsForContainer)(id),
    });
}
function alertsEndpoint(q) {
    const th = { ...alerts_1.DEFAULT_THRESHOLDS };
    let custom = false;
    for (const k of THRESHOLD_KEYS) {
        const raw = q.get(k);
        if (raw === null)
            continue;
        const n = Number(raw);
        if (raw.trim() === "" || !Number.isFinite(n) || n <= 0)
            return fail(400, "invalid_threshold", `${k} must be a number greater than zero.`);
        th[k] = n;
        custom = true;
    }
    const severity = q.get("severity");
    if (severity !== null && severity !== "critical" && severity !== "warning")
        return fail(400, "invalid_severity", "severity must be critical or warning.");
    const customer = q.get("customer");
    const needle = (q.get("q") ?? "").trim().toLowerCase();
    const fleetById = new Map((0, fleet_1.getFleet)().map((c) => [c.id, c]));
    const list = (custom ? (0, fleet_1.getAlerts)(th) : (0, fleet_1.getAlerts)()).filter((a) => (severity === null || a.severity === severity) &&
        (customer === null || fleetById.get(a.containerId)?.customer === customer) &&
        (needle === "" || a.containerId.toLowerCase().includes(needle)));
    return json(200, { total: list.length, thresholds: th, alerts: list });
}
function health() {
    return json(200, { status: "ok", service: "smart-container-api", version: openapi_1.VERSION, fleetSize: fleet_1.FLEET_SIZE, uptimeSeconds: Math.round((Date.now() - STARTED) / 1000), stepMinutes: series_1.STEP_MIN }, false);
}
/** Framework-free router. The Vercel functions and the Node/Docker server both call this. */
function handle(req) {
    if (req.method === "OPTIONS")
        return { status: 204, headers: { ...CORS }, body: null };
    if (req.method !== "GET" && req.method !== "HEAD") {
        const r = fail(405, "method_not_allowed", "This API is read-only. Use GET.");
        r.headers.Allow = "GET, HEAD, OPTIONS";
        return r;
    }
    const path = req.path.replace(/\/+$/, "") || "/";
    if (path === "/" || path === "/api" || path === "/api/v1")
        return json(200, { service: "smart-container-api", version: openapi_1.VERSION, docs: "/api/v1/openapi", health: "/api/v1/health" });
    if (path === "/api/v1/health")
        return health();
    if (path === "/api/v1/openapi")
        return json(200, openapi_1.openapi);
    if (path === "/api/v1/profiles")
        return json(200, { profiles: profiles_1.PROFILES });
    if (path === "/api/v1/fleet")
        return fleetEndpoint(req.query);
    if (path === "/api/v1/alerts")
        return alertsEndpoint(req.query);
    const m = /^\/api\/v1\/containers\/([^/]+)(\/series)?$/.exec(path);
    if (m) {
        let id;
        try {
            id = decodeURIComponent(m[1]);
        }
        catch {
            return fail(400, "invalid_id", "The container id is not valid URL encoding.");
        }
        if (m[2]) {
            const s = (0, fleet_1.getSeries)(id);
            return s ? json(200, { id, intervalMinutes: series_1.STEP_MIN, count: s.length, samples: s }) : fail(404, "container_not_found", `No container with id "${id}".`);
        }
        return containerEndpoint(id);
    }
    return fail(404, "not_found", `No route for ${path}.`);
}
