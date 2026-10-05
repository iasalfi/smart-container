import { describe, expect, it } from "vitest";
import { CITIES } from "../src/cities";
import { corridorPoint, distanceToCorridorKm, haversineKm, project, inView } from "../src/geo";
import { actualPath, approvedStops, etaMinutes, excursions, findStops } from "../src/route";
import { routeLengthKm } from "../src/geo";
import { atT, jedRuh, make } from "./helpers";

describe("geo and route logic", () => {
  it("TC-U-060 haversine distance Jeddah to Riyadh is about 840 km", () => {
    const d = haversineKm(CITIES.jeddah, CITIES.riyadh);
    expect(d).toBeGreaterThan(810); expect(d).toBeLessThan(870);
  });
  it("TC-U-061 distance to corridor is 0 on the corridor and positive off it", () => {
    const on = corridorPoint(jedRuh, 0.37);
    expect(distanceToCorridorKm(jedRuh, on)).toBeLessThan(0.05);
    expect(distanceToCorridorKm(jedRuh, { lon: on.lon, lat: on.lat + 0.2 })).toBeGreaterThan(5);
  });
  it("TC-U-062 a stop needs speed under 3 km/h for at least 5 minutes", () => {
    const run = (v: number, n: number) => findStops(make(40, (i) => ({ speedKmh: i >= 40 - n ? v : 80, ...atT(0.5) })), jedRuh).filter((s) => s.endMinAgo === 0);
    expect(run(2.9, 1)).toHaveLength(1);
    expect(run(3.0, 3)).toHaveLength(0);
    expect(run(0, 3)[0].durationMin).toBe(15);
    expect(findStops(make(40, () => ({ speedKmh: 80 })), jedRuh)).toHaveLength(0);
  });
  it("TC-U-063 stops within 3 km of approved points are scheduled", () => {
    const [origin, mid1, , dest] = approvedStops(jedRuh);
    const stopAt = (p: { lat: number; lon: number }) => findStops(make(20, (i) => ({ speedKmh: i > 14 ? 0 : 80, lat: p.lat, lon: p.lon })), jedRuh)[0];
    expect(stopAt(origin).scheduled).toBe(true);
    expect(stopAt(mid1).scheduled).toBe(true);
    expect(stopAt(dest).scheduled).toBe(true);
    expect(stopAt(atT(0.5)).scheduled).toBe(false);
  });
  it("TC-U-064 excursions are grouped with the correct peak", () => {
    const s = make(60, (i) => ({ tempC: i >= 10 && i < 14 ? 7 + (i === 12 ? 2 : 0) : i >= 40 && i < 43 ? 0.5 : 4 }));
    const ex = excursions(s, 2, 6);
    expect(ex).toHaveLength(2);
    expect(ex[0].peak).toBe(9); expect(ex[0].durationMin).toBe(20);
    expect(ex[1].peak).toBe(0.5); expect(ex[1].durationMin).toBe(15);
    expect(excursions(make(10, () => ({})), 2, 6)).toEqual([]);
  });
  it("TC-U-065 ETA decreases with progress and is zero at the end", () => {
    const len = routeLengthKm(jedRuh);
    const e = [0.2, 0.5, 0.8, 1].map((p) => etaMinutes(p, len));
    expect(e[0]).toBeGreaterThan(e[1]); expect(e[1]).toBeGreaterThan(e[2]); expect(e[3]).toBe(0);
  });
  it("TC-U-066 cities project inside the map view with correct relative positions", () => {
    for (const c of Object.values(CITIES)) expect(inView(c), c.id).toBe(true);
    expect(project(CITIES.jeddah).x).toBeLessThan(project(CITIES.riyadh).x);
    expect(project(CITIES.tabuk).y).toBeLessThan(project(CITIES.jizan).y);
  });
  it("TC-U-067 corridorPoint clamps t below 0 and above 1", () => {
    expect(corridorPoint(jedRuh, -1)).toEqual(corridorPoint(jedRuh, 0));
    expect(corridorPoint(jedRuh, 2)).toEqual(corridorPoint(jedRuh, 1));
    expect(corridorPoint(jedRuh, 0).lon).toBeCloseTo(CITIES.jeddah.lon, 5);
  });
  it("TC-U-068 actualPath skips repeated positions", () => {
    const s = make(10, (i) => ({ ...atT(i < 5 ? 0.1 : 0.1 + (i - 4) * 0.01) }));
    const nodes = actualPath(s).match(/[ML]/g)!.length;
    expect(nodes).toBe(6);
  });
});
