import { describe, expect, it } from "vitest";
import { evaluateAlerts, DEFAULT_THRESHOLDS, SEVERITY } from "../src/alerts";
import { getFleet } from "../src/fleet";
import { corridorPoint } from "../src/geo";
import { atT, jedRuh, make } from "./helpers";
import type { Container } from "../src/types";

const base = getFleet().find((c) => c.scenario === "none")!;
const reefer: Container = { ...base, routeId: "jed-ruh", profileId: "dairy", reefer: true, setpointC: 4 };
const types = (c: Container, s: ReturnType<typeof make>, th = DEFAULT_THRESHOLDS) => evaluateAlerts(c, s, th).map((a) => a.type);
const at05 = atT(0.5);

describe("alert rules", () => {
  it("TC-U-040 temperature more than 3 C outside the band is critical", () => {
    const a = evaluateAlerts(reefer, make(289, (i) => ({ tempC: i === 288 ? 9.5 : 4, ...at05 })));
    expect(a.find((x) => x.type === "temperature_critical")?.severity).toBe("critical");
  });
  it("TC-U-041 20 minutes outside the band is critical", () => {
    expect(types(reefer, make(289, (i) => ({ tempC: i >= 285 ? 6.5 : 4, ...at05 })))).toContain("temperature_critical");
    expect(types(reefer, make(289, (i) => ({ tempC: i >= 286 ? 6.5 : 4, ...at05 })))).not.toContain("temperature_critical");
  });
  it("TC-U-042 readings inside the band raise no temperature alert", () => {
    expect(types(reefer, make(289, () => ({ tempC: 5.9, ...at05 })))).not.toContain("temperature_critical");
  });
  it("TC-U-043 reefer off its set point for 15 minutes is critical", () => {
    expect(types(reefer, make(289, (i) => ({ tempC: i >= 286 ? 6.5 : 4, ...at05 })))).toContain("reefer_setpoint");
    expect(types(reefer, make(289, (i) => ({ tempC: i >= 287 ? 6.5 : 4, ...at05 })))).not.toContain("reefer_setpoint");
  });
  it("TC-U-044 door open above 5 km/h is critical", () => {
    expect(types(reefer, make(289, (i) => ({ door: i >= 286 ? "open" : "closed", speedKmh: 60, ...at05 })))).toContain("door_in_motion");
  });
  it("TC-U-045 door open while stationary raises no door alert", () => {
    expect(types(reefer, make(289, (i) => ({ door: i >= 280 ? "open" : "closed", speedKmh: 0, ...at05 })))).not.toContain("door_in_motion");
  });
  it("TC-U-046 an ongoing unscheduled stop over 5 minutes is a warning", () => {
    const a = evaluateAlerts(reefer, make(289, (i) => ({ speedKmh: i >= 281 ? 0 : 80, ...at05 })));
    const stop = a.find((x) => x.type === "unscheduled_stop");
    expect(stop?.severity).toBe("warning"); expect(stop?.params.minutes).toBe(40);
  });
  it("TC-U-047 a stop at an approved location is not alerted", () => {
    const p = atT(0.35);
    expect(types(reefer, make(289, (i) => ({ speedKmh: i >= 281 ? 0 : 80, ...p })))).not.toContain("unscheduled_stop");
  });
  it("TC-U-048 more than 2 km from the corridor is a warning", () => {
    const c = corridorPoint(jedRuh, 0.5);
    expect(types(reefer, make(289, () => ({ lat: c.lat + 6 / 111, lon: c.lon })))).toContain("route_deviation");
  });
  it("TC-U-049 1 km from the corridor raises no deviation", () => {
    const c = corridorPoint(jedRuh, 0.5);
    expect(types(reefer, make(289, () => ({ lat: c.lat + 1 / 111, lon: c.lon })))).not.toContain("route_deviation");
  });
  it("TC-U-050 NH3 and H2S above thresholds are critical", () => {
    const gas = (nh3: number, h2s: number) => make(289, () => ({ nh3, h2s, ...at05 }));
    expect(types(reefer, gas(30, 1))).toContain("gas_high");
    expect(types(reefer, gas(2, 12))).toContain("gas_high");
    expect(types(reefer, gas(24, 9))).not.toContain("gas_high");
  });
  it("TC-U-051 custom thresholds change the outcome", () => {
    const s = make(289, (i) => ({ tempC: i === 288 ? 9.5 : 4, ...at05 }));
    expect(types(reefer, s)).toContain("temperature_critical");
    expect(types(reefer, s, { ...DEFAULT_THRESHOLDS, tempCriticalC: 10 })).not.toContain("temperature_critical");
  });
  it("TC-U-052 forecast alert is a warning and is suppressed when a critical temperature alert exists", () => {
    const rising = make(289, (i) => ({ tempC: 4 + Math.max(0, i - 250) * 0.025, ...at05 }));
    const a = evaluateAlerts(reefer, rising);
    expect(a.find((x) => x.type === "health_forecast")?.severity).toBe("warning");
    const out = make(289, (i) => ({ tempC: i >= 270 ? 11 : 4 + Math.max(0, i - 250) * 0.025, ...at05 }));
    expect(types(reefer, out)).not.toContain("health_forecast");
  });
  it("TC-U-053 severity map matches the BRD catalogue", () => {
    const crit = Object.entries(SEVERITY).filter(([, v]) => v === "critical").map(([k]) => k).sort();
    const warn = Object.entries(SEVERITY).filter(([, v]) => v === "warning").map(([k]) => k).sort();
    expect(crit).toEqual(["door_in_motion", "gas_high", "reefer_setpoint", "temperature_critical"]);
    expect(warn).toEqual(["health_forecast", "route_deviation", "unscheduled_stop"]);
  });
});
