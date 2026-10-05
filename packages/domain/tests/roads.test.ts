import { describe, expect, it } from "vitest";
import { ROUTES } from "../src/cities";
import { advanceShare, bearingDeg, boundsOf, corridorCoords, cumulativeKm, estimateRoad, lengthKm, osrmUrl, parseOsrm, pointAtShare, sliceToShare, type Coord } from "../src/roads";

const L: Coord[] = [[46, 24], [47, 24], [47, 25]];

describe("Road geometry", () => {
  it("TC-U-124 a road is measured, split by share and sliced without losing its end points", () => {
    const cum = cumulativeKm(L);
    expect(cum[0]).toBe(0);
    expect(cum[2]).toBeCloseTo(lengthKm(L), 6);
    expect(lengthKm(L)).toBeGreaterThan(200);
    const start = pointAtShare(L, 0), end = pointAtShare(L, 1), mid = pointAtShare(L, 0.5);
    expect([start.lon, start.lat]).toEqual([46, 24]);
    expect(end.lon).toBeCloseTo(47, 6);
    expect(end.lat).toBeCloseTo(25, 6);
    expect(mid.km).toBeCloseTo(lengthKm(L) / 2, 3);
    expect(pointAtShare(L, -3).km).toBe(0);
    expect(pointAtShare(L, 9).km).toBeCloseTo(lengthKm(L), 3);
    const cut = sliceToShare(L, 0.5);
    expect(cut[0]).toEqual([46, 24]);
    expect(lengthKm(cut)).toBeCloseTo(lengthKm(L) / 2, 2);
    expect(sliceToShare(L, 1)).toEqual(L);
    expect(sliceToShare(L, 0)).toEqual([[46, 24]]);
  });

  it("TC-U-125 the heading follows the direction of the road and a truck advances with speed and time", () => {
    expect(bearingDeg([46, 24], [47, 24])).toBeCloseTo(90, 0);
    expect(bearingDeg([47, 24], [47, 25])).toBeCloseTo(0, 0);
    expect(pointAtShare(L, 0.1).bearing).toBeCloseTo(90, 0);
    expect(pointAtShare(L, 0.9).bearing).toBeCloseTo(0, 0);
    expect(advanceShare(0.2, 80, 800, 3600)).toBeCloseTo(0.3, 6);
    expect(advanceShare(0.2, 0, 800, 3600)).toBe(0.2);
    expect(advanceShare(0.95, 120, 800, 3600)).toBe(1);
    expect(advanceShare(0.5, 80, 0, 60)).toBe(0.5);
  });

  it("TC-U-126 the routing service answer is read safely and a bad answer gives no route", () => {
    const ok = { code: "Ok", routes: [{ geometry: { coordinates: [[46, 24], [46.5, 24.2], [47, 25]] }, distance: 123456, duration: 5400 }, { geometry: { coordinates: [[46, 24]] }, distance: 1, duration: 1 }, { geometry: { coordinates: [[46, 24], [47, 25]] }, distance: "x", duration: 1 }] };
    const r = parseOsrm(ok);
    expect(r).toHaveLength(1);
    expect(r[0].km).toBeCloseTo(123.456, 3);
    expect(r[0].durationMin).toBe(90);
    expect(r[0].source).toBe("road");
    for (const bad of [null, undefined, {}, { code: "NoRoute" }, { code: "Ok" }, { code: "Ok", routes: "x" }, "oops", 7]) expect(parseOsrm(bad)).toEqual([]);
    const url = osrmUrl([{ lon: 39.17, lat: 21.54 }, { lon: 46.68, lat: 24.71 }], true);
    expect(url).toContain("/route/v1/driving/39.17000,21.54000;46.68000,24.71000");
    expect(url).toContain("alternatives=true");
    expect(osrmUrl([{ lon: 1, lat: 2 }, { lon: 3, lat: 4 }])).toContain("alternatives=false");
  });

  it("TC-U-127 every corridor has a local stand-in road, so tracking still works when routing is down", () => {
    for (const r of ROUTES) {
      const c = corridorCoords(r);
      expect(c.length).toBeGreaterThan(10);
      expect(lengthKm(c)).toBeGreaterThan(100);
      const b = boundsOf(c)!;
      expect(b[0][0]).toBeLessThanOrEqual(b[1][0]);
      expect(b[0][1]).toBeLessThanOrEqual(b[1][1]);
    }
    const e = estimateRoad([{ lon: 39.17, lat: 21.54 }, { lon: 46.68, lat: 24.71 }]);
    expect(e.source).toBe("estimate");
    expect(e.km).toBeGreaterThan(900);
    expect(e.durationMin).toBeGreaterThan(600);
    expect(boundsOf([])).toBeNull();
  });
});
