"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = exports.corridorPoint = exports.getRoute = exports.CUSTOMERS = exports.COUNTS = exports.FLEET_SIZE = void 0;
exports.generateFleet = generateFleet;
exports.getFleet = getFleet;
exports.getContainer = getContainer;
exports.getSeries = getSeries;
exports.getAlerts = getAlerts;
exports.alertsForContainer = alertsForContainer;
const rng_1 = require("./rng");
const cities_1 = require("./cities");
const geo_1 = require("./geo");
Object.defineProperty(exports, "corridorPoint", { enumerable: true, get: function () { return geo_1.corridorPoint; } });
Object.defineProperty(exports, "getRoute", { enumerable: true, get: function () { return geo_1.getRoute; } });
const health_1 = require("./health");
const profiles_1 = require("./profiles");
Object.defineProperty(exports, "getProfile", { enumerable: true, get: function () { return profiles_1.getProfile; } });
const series_1 = require("./series");
const alerts_1 = require("./alerts");
exports.FLEET_SIZE = 1000;
exports.COUNTS = { normal: 912, warning: 61, critical: 27, offline: 12 };
const SCENARIOS = [
    ["temp", 9], ["reefer", 6], ["door", 7], ["gas", 5],
    ["stop", 20], ["deviation", 17], ["forecast", 24],
];
exports.CUSTOMERS = ["Najd Fresh Foods", "Red Sea Seafood", "Gulf Pharma Supply", "Hijaz Retail Group", "Eastern Dairy Co", "Tabuk Produce", "Desert Gate Trading", "Peninsula Electronics"];
const DRIVERS = ["Ahmed Al-Harbi", "Khalid Al-Otaibi", "Fahad Al-Qahtani", "Saud Al-Dosari", "Omar Al-Ghamdi", "Yousef Al-Zahrani", "Nasser Al-Shehri", "Majed Al-Mutairi", "Salman Al-Anazi", "Faisal Al-Subaie", "Turki Al-Juhani", "Abdullah Al-Malki"];
const LETTERS = "ABDEGHJKLNRSTUVXZ";
const CRITICAL_SCENARIOS = new Set(["temp", "reefer", "door", "gas"]);
function shuffle(rnd, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function weightedRoute(rnd) {
    const total = cities_1.ROUTES.reduce((s, r) => s + r.weight, 0);
    let x = rnd() * total;
    for (const r of cities_1.ROUTES) {
        x -= r.weight;
        if (x <= 0)
            return r;
    }
    return cities_1.ROUTES[0];
}
const seriesParams = new Map();
let fleet = null;
const seriesMemo = new Map();
function generateFleet() {
    const rnd = (0, rng_1.mulberry32)(20261005);
    const order = shuffle(rnd, Array.from({ length: exports.FLEET_SIZE }, (_, i) => i));
    const scenarioOf = new Array(exports.FLEET_SIZE).fill("none");
    let cursor = 0;
    for (const [sc, n] of SCENARIOS)
        for (let k = 0; k < n; k++)
            scenarioOf[order[cursor++]] = sc;
    const normalIdx = order.slice(cursor);
    const offline = new Set(normalIdx.slice(0, exports.COUNTS.offline));
    const reeferProfiles = profiles_1.PROFILES.filter((p) => p.reefer);
    const gasProfiles = profiles_1.PROFILES.filter((p) => p.gasRelevant);
    const list = [];
    seriesParams.clear();
    seriesMemo.clear();
    for (let i = 0; i < exports.FLEET_SIZE; i++) {
        const sc = scenarioOf[i];
        const prof = sc === "forecast" ? (0, rng_1.pick)(rnd, reeferProfiles.filter((p) => (p.tMax - p.tMin) / 2 <= 2.5)) : sc === "temp" || sc === "reefer" ? (0, rng_1.pick)(rnd, reeferProfiles) : sc === "gas" ? (0, rng_1.pick)(rnd, gasProfiles) : (0, rng_1.pick)(rnd, profiles_1.PROFILES);
        const route = weightedRoute(rnd);
        let progress = (0, rng_1.range)(rnd, 0.12, 0.88);
        if (sc === "stop") {
            const bands = [[0.12, 0.3], [0.42, 0.62], [0.78, 0.88]];
            const b = (0, rng_1.pick)(rnd, bands);
            progress = (0, rng_1.range)(rnd, b[0], b[1]);
        }
        const gas = sc === "gas" || (prof.gasRelevant && rnd() < 0.2);
        const padlock = rnd() < 0.3;
        const id = `SC-${1001 + i}`;
        const params = { id, profileId: prof.id, routeId: route.id, scenario: sc, progress, gas, seed: 1000 + i * 7919, };
        seriesParams.set(id, params);
        const samples = (0, series_1.buildSeries)(params);
        const last = samples[samples.length - 1];
        const prev = samples.slice().reverse().find((s) => s.lat !== last.lat || s.lon !== last.lon) ?? last;
        const heading = (Math.atan2(last.lon - prev.lon, last.lat - prev.lat) * 180) / Math.PI;
        const health = (0, health_1.computeHealth)(samples, prof);
        const status = CRITICAL_SCENARIOS.has(sc) ? "critical" : sc === "none" ? "normal" : "warning";
        const isOffline = offline.has(i);
        const from = cities_1.CITIES[route.from], to = cities_1.CITIES[route.to];
        const plate = `${LETTERS[Math.floor(rnd() * LETTERS.length)]}${LETTERS[Math.floor(rnd() * LETTERS.length)]}${LETTERS[Math.floor(rnd() * LETTERS.length)]} ${1000 + Math.floor(rnd() * 8999)}`;
        list.push({
            id, profileId: prof.id, reefer: prof.reefer, plate, driver: (0, rng_1.pick)(rnd, DRIVERS), customer: (0, rng_1.pick)(rnd, exports.CUSTOMERS),
            tripId: `TR-${100100 + i * 3}`, routeId: route.id, origin: from.en, destination: to.en, status, online: !isOffline,
            progress, lat: last.lat, lon: last.lon, speedKmh: isOffline ? 0 : last.speedKmh, headingDeg: Math.round((heading + 360) % 360),
            tempC: last.tempC, rh: last.rh, setpointC: prof.reefer ? Math.round(((prof.tMin + prof.tMax) / 2) * 10) / 10 : null,
            door: last.door, lock: padlock ? (sc === "door" ? "unlocked" : "locked") : "none", padlock,
            gas: gas && last.nh3 !== null && last.h2s !== null ? { nh3: last.nh3, h2s: last.h2s } : null,
            batteryPct: Math.round((0, rng_1.range)(rnd, 22, 100)), signal: isOffline ? 0 : 1 + Math.floor(rnd() * 5),
            healthScore: health.score, scenario: sc, lastSeenMin: isOffline ? Math.round((0, rng_1.range)(rnd, 25, 90)) : Math.floor(rnd() * 5),
        });
    }
    return list;
}
function getFleet() {
    if (!fleet)
        fleet = generateFleet();
    return fleet;
}
function getContainer(id) {
    if (!id)
        return undefined;
    return getFleet().find((c) => c.id === id);
}
function getSeries(id) {
    getFleet();
    const hit = seriesMemo.get(id);
    if (hit)
        return hit;
    const p = seriesParams.get(id);
    if (!p)
        return undefined;
    const s = (0, series_1.buildSeries)(p);
    if (seriesMemo.size > 40)
        seriesMemo.clear();
    seriesMemo.set(id, s);
    return s;
}
let alertsCache = null;
let alertsFor = null;
/** All alerts for the fleet, evaluated by the rule engine. */
function getAlerts(th = alerts_1.DEFAULT_THRESHOLDS) {
    if (alertsCache && alertsFor === th)
        return alertsCache;
    const out = [];
    for (const c of getFleet()) {
        if (c.status === "normal" && c.scenario === "none") {
            const s = (0, series_1.buildSeries)(seriesParams.get(c.id));
            out.push(...(0, alerts_1.toAlerts)(c, (0, alerts_1.evaluateAlerts)(c, s, th)));
            continue;
        }
        const s = getSeries(c.id);
        out.push(...(0, alerts_1.toAlerts)(c, (0, alerts_1.evaluateAlerts)(c, s, th)));
    }
    out.sort((a, b) => (a.severity === b.severity ? a.minutesAgo - b.minutesAgo : a.severity === "critical" ? -1 : 1));
    alertsCache = out;
    alertsFor = th;
    return out;
}
function alertsForContainer(id, th = alerts_1.DEFAULT_THRESHOLDS) {
    const c = getContainer(id);
    const s = getSeries(id);
    if (!c || !s)
        return [];
    return (0, alerts_1.toAlerts)(c, (0, alerts_1.evaluateAlerts)(c, s, th));
}
