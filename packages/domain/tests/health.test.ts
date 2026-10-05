import { describe, expect, it } from "vitest";
import { computeHealth, forecastBreach, topFactors } from "../src/health";
import { getProfile } from "../src/profiles";
import { make } from "./helpers";

const dairy = getProfile("dairy")!; // 2 to 6 C, 55 to 85 %RH, shelf life 336 h

describe("cargo health model", () => {
  it("TC-U-020 no excursion scores 100", () => {
    const h = computeHealth(make(289, () => ({ tempC: 4, rh: 70 })), dairy);
    expect(h.score).toBe(100); expect(h.tempDegreeHours).toBe(0);
  });
  it("TC-U-021 score stays between 0 and 100 under extreme excursions", () => {
    const h = computeHealth(make(289, () => ({ tempC: 66, rh: 100 })), dairy);
    expect(h.score).toBeGreaterThanOrEqual(0); expect(h.score).toBeLessThanOrEqual(100); expect(Number.isFinite(h.score)).toBe(true);
  });
  it("TC-U-022 longer or larger excursions never raise the score", () => {
    const scores = [0, 6, 24, 60, 120].map((n) => computeHealth(make(289, (i) => ({ tempC: i >= 289 - n ? 9 : 4 })), dairy).score);
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    expect(scores[4]).toBeLessThan(scores[0]);
  });
  it("TC-U-023 Q10 weighting: the same degree-hours cost more at a higher excursion", () => {
    const a = computeHealth(make(289, (i) => ({ tempC: i >= 289 - 48 ? 8 : 4 })), dairy); // 2 C for 4 h = 8 degree-hours
    const b = computeHealth(make(289, (i) => ({ tempC: i >= 289 - 24 ? 10 : 4 })), dairy); // 4 C for 2 h = 8 degree-hours
    expect(a.tempDegreeHours).toBeCloseTo(b.tempDegreeHours, 5);
    expect(b.score).toBeLessThan(a.score);
  });
  it("TC-U-024 humidity outside the band lowers the score", () => {
    const h = computeHealth(make(289, (i) => ({ rh: i >= 289 - 72 ? 105 : 70 })), dairy);
    expect(h.score).toBeLessThan(100);
  });
  it("TC-U-025 empty series returns a safe result", () => {
    const h = computeHealth([], dairy);
    expect(h.score).toBe(100); expect(Number.isNaN(h.score)).toBe(false);
  });
  it("TC-U-026 forecast detects a steady rise with an ETA inside 6 hours", () => {
    const s = make(289, (i) => ({ tempC: 4 + ((i - 250) * 5) / 60 * 0.3 })); // +0.3 C per hour
    const last = s[s.length - 1].tempC;
    const f = forecastBreach(s, dairy);
    expect(last).toBeLessThan(6);
    expect(f.limit).toBe("upper");
    expect(f.etaH).not.toBeNull();
    expect(f.etaH!).toBeGreaterThan(0); expect(f.etaH!).toBeLessThanOrEqual(6);
  });
  it("TC-U-027 forecast returns no breach for a flat series", () => { expect(forecastBreach(make(289, () => ({ tempC: 4 })), dairy).etaH).toBeNull(); });
  it("TC-U-028 forecast stays quiet when already outside the band", () => {
    const s = make(289, (i) => ({ tempC: 6.5 + i * 0.001 }));
    expect(forecastBreach(s, dairy).etaH).toBeNull();
  });
  it("TC-U-029 forecast ignores compressor oscillation", () => {
    const s = make(289, (i) => ({ tempC: 4 + 0.45 * Math.sin((2 * Math.PI * i) / 16) }));
    expect(forecastBreach(s, dairy).etaH).toBeNull();
  });
  it("TC-U-030 forecast handles very short series", () => {
    expect(() => forecastBreach(make(3, () => ({})), dairy)).not.toThrow();
    expect(forecastBreach(make(3, () => ({})), dairy).etaH).toBeNull();
  });
  it("TC-U-031 forecast detects a fall toward the lower limit", () => {
    const s = make(289, (i) => ({ tempC: 4 - ((i - 250) * 5) / 60 * 0.3 }));
    const f = forecastBreach(s, dairy);
    expect(f.limit).toBe("lower"); expect(f.etaH!).toBeLessThanOrEqual(6);
  });
  it("TC-U-032 remaining shelf life scales with the score", () => {
    const good = computeHealth(make(289, () => ({})), dairy);
    const bad = computeHealth(make(289, (i) => ({ tempC: i > 200 ? 12 : 4 })), dairy);
    expect(good.remainingShelfLifeH).toBe(dairy.shelfLifeH);
    expect(bad.remainingShelfLifeH).toBeLessThan(good.remainingShelfLifeH);
  });
  it("TC-U-033 top factors are complete and sorted", () => {
    const f = topFactors(make(289, (i) => ({ tempC: i > 250 ? 9 : 4, door: i === 10 ? "open" : "closed" })), dairy);
    expect(f.map((x) => x.key).sort()).toEqual(["door", "rh", "temp", "time"]);
    for (let i = 1; i < f.length; i++) expect(f[i].value).toBeLessThanOrEqual(f[i - 1].value);
  });
});
