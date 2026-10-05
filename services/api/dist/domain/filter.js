"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMPTY_FILTER = void 0;
exports.normalise = normalise;
exports.matchesQuery = matchesQuery;
exports.filterFleet = filterFleet;
exports.countByStatus = countByStatus;
exports.EMPTY_FILTER = { q: "", status: "all", profile: "all", reeferOnly: false };
function normalise(s) {
    return s.trim().toLowerCase().replace(/\s+/g, " ");
}
function matchesQuery(c, q) {
    const n = normalise(q);
    if (n === "")
        return true;
    return [c.id, c.tripId, c.plate, c.driver, c.customer].some((f) => f.toLowerCase().includes(n));
}
function filterFleet(list, f) {
    return list.filter((c) => (f.status === "all" || c.status === f.status) &&
        (f.profile === "all" || c.profileId === f.profile) &&
        (!f.reeferOnly || c.reefer) &&
        (!f.customer || c.customer === f.customer) &&
        matchesQuery(c, f.q));
}
function countByStatus(list) {
    const r = { total: list.length, normal: 0, warning: 0, critical: 0, offline: 0 };
    for (const c of list) {
        r[c.status]++;
        if (!c.online)
            r.offline++;
    }
    return r;
}
