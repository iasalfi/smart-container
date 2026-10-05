"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FORECAST_HORIZON_H = exports.FORECAST_WINDOW = exports.DH_HALF = exports.Q10 = void 0;
exports.excursionC = excursionC;
exports.rhExcursion = rhExcursion;
exports.computeHealth = computeHealth;
exports.forecastBreach = forecastBreach;
exports.topFactors = topFactors;
const series_1 = require("./series");
exports.Q10 = 2;
/** Weighted degree-hours at which the health score halves. */
exports.DH_HALF = 4;
exports.FORECAST_WINDOW = 36; // samples, 3 hours
exports.FORECAST_HORIZON_H = 6;
function excursionC(tempC, p) {
    if (tempC > p.tMax)
        return tempC - p.tMax;
    if (tempC < p.tMin)
        return p.tMin - tempC;
    return 0;
}
function rhExcursion(rh, p) {
    if (rh > p.rhMax)
        return rh - p.rhMax;
    if (rh < p.rhMin)
        return p.rhMin - rh;
    return 0;
}
/** Cargo health: Q10-weighted degree-hours outside the temperature band plus a humidity term. Score from 0 to 100. */
function computeHealth(samples, p) {
    const dtH = series_1.STEP_MIN / 60;
    let dh = 0, wdh = 0, rhh = 0, minOut = 0;
    for (const s of samples) {
        const e = excursionC(s.tempC, p);
        if (e > 0) {
            dh += e * dtH;
            wdh += e * dtH * Math.pow(exports.Q10, e / 10);
            minOut += series_1.STEP_MIN;
        }
        rhh += (rhExcursion(s.rh, p) / 10) * dtH;
    }
    const damage = wdh + 0.5 * rhh;
    const score = Math.max(0, Math.min(100, 100 * Math.pow(0.5, damage / exports.DH_HALF)));
    return {
        score: Math.round(score * 10) / 10,
        tempDegreeHours: Math.round(dh * 100) / 100,
        weightedDegreeHours: Math.round(wdh * 100) / 100,
        rhPointHours: Math.round(rhh * 100) / 100,
        minutesOutside: minOut,
        remainingShelfLifeH: Math.round(p.shelfLifeH * (score / 100)),
    };
}
/** Linear fit over the last three hours, projected up to six hours ahead. */
function forecastBreach(samples, p) {
    const w = samples.slice(-exports.FORECAST_WINDOW);
    if (w.length < 6)
        return { slopeCPerH: 0, r2: 0, etaH: null, limit: null };
    const n = w.length;
    const xs = w.map((_, i) => (i * series_1.STEP_MIN) / 60);
    const ys = w.map((s) => s.tempC);
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxx = 0, sxy = 0, syy = 0;
    for (let i = 0; i < n; i++) {
        sxx += (xs[i] - mx) ** 2;
        sxy += (xs[i] - mx) * (ys[i] - my);
        syy += (ys[i] - my) ** 2;
    }
    const slope = sxx === 0 ? 0 : sxy / sxx;
    const r2 = syy === 0 ? 0 : (sxy * sxy) / (sxx * syy);
    const now = ys[n - 1];
    const inBand = now >= p.tMin && now <= p.tMax;
    if (!inBand || r2 < 0.7 || Math.abs(slope) < 0.15)
        return { slopeCPerH: slope, r2, etaH: null, limit: null };
    if (slope > 0) {
        const eta = (p.tMax - now) / slope;
        return eta <= exports.FORECAST_HORIZON_H ? { slopeCPerH: slope, r2, etaH: eta, limit: "upper" } : { slopeCPerH: slope, r2, etaH: null, limit: null };
    }
    const eta = (now - p.tMin) / -slope;
    return eta <= exports.FORECAST_HORIZON_H ? { slopeCPerH: slope, r2, etaH: eta, limit: "lower" } : { slopeCPerH: slope, r2, etaH: null, limit: null };
}
function topFactors(samples, p) {
    const h = computeHealth(samples, p);
    let doorEvents = 0;
    for (let i = 1; i < samples.length; i++)
        if (samples[i].door === "open" && samples[i - 1].door === "closed")
            doorEvents++;
    const f = [
        { key: "temp", value: h.tempDegreeHours },
        { key: "rh", value: h.rhPointHours },
        { key: "door", value: doorEvents },
        { key: "time", value: h.minutesOutside },
    ];
    return f.sort((a, b) => b.value - a.value);
}
