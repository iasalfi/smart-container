import { describe, expect, it } from "vitest";
import { generateFleet, getAlerts, getContainer, getFleet, getSeries, COUNTS } from "../src/fleet";
import { mulberry32, pick, range } from "../src/rng";
import { project, inView } from "../src/geo";
import { SAMPLES } from "../src/series";
import { getProfile } from "../src/profiles";

const fleet = getFleet();

describe("fleet data", () => {
  it("TC-U-001 fleet has exactly 1,000 containers", () => { expect(fleet).toHaveLength(1000); });
  it("TC-U-002 status split is 912 normal, 61 warning, 27 critical", () => {
    const n = { normal: 0, warning: 0, critical: 0 };
    fleet.forEach((c) => n[c.status]++);
    expect(n).toEqual({ normal: COUNTS.normal, warning: COUNTS.warning, critical: COUNTS.critical });
  });
  it("TC-U-003 IDs are unique and follow the SC-#### format", () => {
    expect(new Set(fleet.map((c) => c.id)).size).toBe(1000);
    expect(fleet.every((c) => /^SC-\d{4}$/.test(c.id))).toBe(true);
  });
  it("TC-U-004 generation is deterministic", () => { expect(generateFleet()).toEqual(generateFleet()); });
  it("TC-U-005 every position is inside Saudi Arabia and the map view", () => {
    for (const c of fleet) {
      expect(c.lat).toBeGreaterThan(15.5); expect(c.lat).toBeLessThan(33);
      expect(c.lon).toBeGreaterThan(34); expect(c.lon).toBeLessThan(56.5);
      expect(inView(c)).toBe(true);
      const p = project(c); expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  });
  it("TC-U-006 readings are in valid ranges", () => {
    for (const c of fleet) {
      expect(c.batteryPct).toBeGreaterThanOrEqual(0); expect(c.batteryPct).toBeLessThanOrEqual(100);
      expect(c.signal).toBeGreaterThanOrEqual(0); expect(c.signal).toBeLessThanOrEqual(5);
      expect(c.healthScore).toBeGreaterThanOrEqual(0); expect(c.healthScore).toBeLessThanOrEqual(100);
      expect(c.rh).toBeGreaterThan(0); expect(c.rh).toBeLessThanOrEqual(100);
      expect(Number.isFinite(c.tempC)).toBe(true);
    }
  });
  it("TC-U-007 twelve devices are offline with zero signal", () => {
    const off = fleet.filter((c) => !c.online);
    expect(off).toHaveLength(COUNTS.offline);
    expect(off.every((c) => c.signal === 0 && c.status === "normal")).toBe(true);
  });
  it("TC-U-008 reefer set point sits inside the band, dry cargo has none", () => {
    for (const c of fleet) {
      const p = getProfile(c.profileId)!;
      if (c.reefer) { expect(c.setpointC).not.toBeNull(); expect(c.setpointC!).toBeGreaterThanOrEqual(p.tMin); expect(c.setpointC!).toBeLessThanOrEqual(p.tMax); }
      else expect(c.setpointC).toBeNull();
    }
  });
  it("TC-U-009 gas modules only on gas-relevant cargo", () => {
    for (const c of fleet) if (c.gas) expect(getProfile(c.profileId)!.gasRelevant).toBe(true);
  });
  it("TC-U-010 rule engine agrees with status for all containers", () => {
    const alerts = getAlerts();
    const by = new Map<string, typeof alerts>();
    alerts.forEach((a) => by.set(a.containerId, [...(by.get(a.containerId) ?? []), a]));
    for (const c of fleet) {
      const al = by.get(c.id) ?? [];
      if (c.status === "normal") expect(al, c.id).toHaveLength(0);
      else if (c.status === "critical") expect(al.some((a) => a.severity === "critical"), c.id).toBe(true);
      else { expect(al.length, c.id).toBeGreaterThan(0); expect(al.every((a) => a.severity === "warning"), c.id).toBe(true); }
    }
    expect(alerts.length).toBe(102);
  });
  it("TC-U-011 series has 289 samples at 5 minute steps ending now", () => {
    const s = getSeries("SC-1001")!;
    expect(s).toHaveLength(SAMPLES);
    expect(s[0].minAgo).toBe(1440); expect(s[SAMPLES - 1].minAgo).toBe(0);
    expect(s[1].minAgo - s[2].minAgo).toBe(5);
  });
  it("TC-U-012 series is deterministic for a container", () => {
    expect(getSeries("SC-1060")).toEqual(getSeries("SC-1060"));
  });
  it("TC-U-013 getContainer returns undefined for unknown, null or empty IDs", () => {
    expect(getContainer("SC-0000")).toBeUndefined();
    expect(getContainer(null)).toBeUndefined();
    expect(getContainer("")).toBeUndefined();
  });
  it("TC-U-014 getSeries returns undefined for an unknown ID", () => { expect(getSeries("SC-0000")).toBeUndefined(); });
  it("TC-U-015 pick throws on an empty list", () => { expect(() => pick(mulberry32(1), [])).toThrow(); });
  it("TC-U-016 range stays inside its bounds", () => {
    const r = mulberry32(42);
    for (let i = 0; i < 1000; i++) { const v = range(r, 5, 9); expect(v).toBeGreaterThanOrEqual(5); expect(v).toBeLessThan(9); }
  });
});
