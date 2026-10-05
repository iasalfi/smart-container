"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APPROVED_RADIUS_KM = exports.DEVIATION_KM = exports.STOP_MIN_MINUTES = exports.STOP_SPEED_KMH = void 0;
exports.approvedStops = approvedStops;
exports.findStops = findStops;
exports.deviationKm = deviationKm;
exports.etaMinutes = etaMinutes;
exports.actualPath = actualPath;
exports.excursions = excursions;
const cities_1 = require("./cities");
const geo_1 = require("./geo");
const series_1 = require("./series");
exports.STOP_SPEED_KMH = 3;
exports.STOP_MIN_MINUTES = 5;
exports.DEVIATION_KM = 2;
exports.APPROVED_RADIUS_KM = 3;
function approvedStops(route) {
    return [
        { lon: cities_1.CITIES[route.from].lon, lat: cities_1.CITIES[route.from].lat },
        ...series_1.APPROVED_STOP_T.map((t) => (0, geo_1.corridorPoint)(route, t)),
        { lon: cities_1.CITIES[route.to].lon, lat: cities_1.CITIES[route.to].lat },
    ];
}
/** A stop is speed under 3 km/h for at least 5 minutes. Scheduled when it sits within 3 km of an approved stop. */
function findStops(samples, route) {
    const approved = approvedStops(route);
    const stops = [];
    let i = 0;
    while (i < samples.length) {
        if (samples[i].speedKmh < exports.STOP_SPEED_KMH) {
            let j = i;
            while (j + 1 < samples.length && samples[j + 1].speedKmh < exports.STOP_SPEED_KMH)
                j++;
            const duration = (j - i + 1) * series_1.STEP_MIN;
            if (duration >= exports.STOP_MIN_MINUTES) {
                const s = samples[i];
                const scheduled = approved.some((a) => (0, geo_1.haversineKm)(a, s) <= exports.APPROVED_RADIUS_KM);
                stops.push({ startMinAgo: s.minAgo, endMinAgo: samples[j].minAgo, durationMin: duration, lat: s.lat, lon: s.lon, scheduled });
            }
            i = j + 1;
        }
        else
            i++;
    }
    return stops;
}
function deviationKm(samples, route) {
    const last = samples[samples.length - 1];
    return (0, geo_1.distanceToCorridorKm)(route, last);
}
function etaMinutes(progress, routeLenKm, avgKmh = 80) {
    return Math.max(0, Math.round(((1 - progress) * routeLenKm / avgKmh) * 60));
}
/** SVG path of the distance travelled, skipping repeated positions. */
function actualPath(samples) {
    return samples
        .filter((x, i) => i === 0 || x.lat !== samples[i - 1].lat || x.lon !== samples[i - 1].lon)
        .map((x, i) => { const p = (0, geo_1.project)(x); return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; })
        .join("");
}
/** Periods when the temperature sat outside the allowed band. `from` and `to` are minutes ago. */
function excursions(samples, tMin, tMax) {
    const out = [];
    let cur = null;
    let worst = 0;
    for (const x of samples) {
        const dev = x.tempC > tMax ? x.tempC - tMax : x.tempC < tMin ? tMin - x.tempC : 0;
        if (dev > 0) {
            if (!cur) {
                cur = { from: x.minAgo, to: x.minAgo, peak: x.tempC, durationMin: 0 };
                worst = 0;
            }
            cur.to = x.minAgo;
            cur.durationMin += series_1.STEP_MIN;
            if (dev > worst) {
                worst = dev;
                cur.peak = x.tempC;
            }
        }
        else if (cur) {
            out.push(cur);
            cur = null;
        }
    }
    if (cur)
        out.push(cur);
    return out;
}
