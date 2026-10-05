"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEVERITY = exports.DEFAULT_THRESHOLDS = void 0;
exports.evaluateAlerts = evaluateAlerts;
exports.toAlerts = toAlerts;
const geo_1 = require("./geo");
const health_1 = require("./health");
const profiles_1 = require("./profiles");
const route_1 = require("./route");
const series_1 = require("./series");
exports.DEFAULT_THRESHOLDS = {
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
exports.SEVERITY = {
    temperature_critical: "critical",
    reefer_setpoint: "critical",
    door_in_motion: "critical",
    gas_high: "critical",
    unscheduled_stop: "warning",
    route_deviation: "warning",
    health_forecast: "warning",
};
function trailing(samples, pred) {
    let n = 0;
    for (let i = samples.length - 1; i >= 0 && pred(samples[i]); i--)
        n++;
    return n;
}
/** Rule engine. Defaults follow the BRD alert catalogue (Appendix A). */
function evaluateAlerts(c, samples, th = exports.DEFAULT_THRESHOLDS) {
    const prof = (0, profiles_1.getProfile)(c.profileId);
    const route = (0, geo_1.getRoute)(c.routeId);
    if (!prof || !route || samples.length === 0)
        return [];
    const out = [];
    const last = samples[samples.length - 1];
    const outside = trailing(samples, (s) => (0, health_1.excursionC)(s.tempC, prof) > 0);
    const exc = (0, health_1.excursionC)(last.tempC, prof);
    if (exc > th.tempCriticalC || outside * series_1.STEP_MIN >= th.tempCriticalMin) {
        out.push({ type: "temperature_critical", severity: "critical", minutesAgo: outside * series_1.STEP_MIN, params: { tempC: last.tempC, excessC: Math.round(exc * 10) / 10 } });
    }
    if (c.reefer && c.setpointC !== null) {
        const sp = c.setpointC;
        const off = trailing(samples, (s) => Math.abs(s.tempC - sp) > th.reeferSetpointC);
        if (off * series_1.STEP_MIN >= th.reeferMin) {
            out.push({ type: "reefer_setpoint", severity: "critical", minutesAgo: off * series_1.STEP_MIN, params: { setpointC: sp, tempC: last.tempC } });
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
    const stops = (0, route_1.findStops)(samples, route);
    const ongoing = stops.find((s) => s.endMinAgo === 0 && !s.scheduled && s.durationMin >= th.unscheduledStopMin);
    if (ongoing)
        out.push({ type: "unscheduled_stop", severity: "warning", minutesAgo: ongoing.durationMin, params: { minutes: ongoing.durationMin } });
    const dev = (0, route_1.deviationKm)(samples, route);
    if (dev > th.deviationKm)
        out.push({ type: "route_deviation", severity: "warning", minutesAgo: 0, params: { km: Math.round(dev * 10) / 10 } });
    if (prof.reefer && !out.some((a) => a.type === "temperature_critical" || a.type === "reefer_setpoint")) {
        const f = (0, health_1.forecastBreach)(samples, prof);
        if (f.etaH !== null)
            out.push({ type: "health_forecast", severity: "warning", minutesAgo: 0, params: { etaH: Math.round(f.etaH * 10) / 10, limit: f.limit ?? "upper" } });
    }
    return out;
}
function toAlerts(c, raw) {
    return raw.map((r, i) => ({ id: `${c.id}-${r.type}-${i}`, containerId: c.id, type: r.type, severity: r.severity, minutesAgo: r.minutesAgo, state: "open", params: r.params }));
}
