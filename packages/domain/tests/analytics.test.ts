import { describe, expect, it } from "vitest";
import { getAlerts, getFleet } from "../src/fleet";
import { seedJourneys, journeyStatus } from "../src/journey";
import { REPORTS, WIDGETS, analyticsFor, buildReport, countBy, delayBand, journeysIn, scopeOf, toCsv, alertsIn, type ReportCtx } from "../src/analytics";
import type { Persona } from "../src/types";

const CUSTOMER = "Najd Fresh Foods";
const fleet = getFleet();
const alerts = getAlerts();
const journeys = seedJourneys(fleet);
const NOW = Date.UTC(2026, 9, 5, 12, 0);
const PERSONAS: Persona[] = ["operator", "quality", "security", "customer"];

function ctx(p: Persona): ReportCtx {
  const scope = scopeOf(p, fleet, CUSTOMER);
  return { scope, alerts: alertsIn(alerts, scope), journeys: journeysIn(journeys, scope), tickets: {}, nowMs: NOW };
}

describe("analytics and reports", () => {
  it("TC-U-117 a customer is scoped to its own containers and everyone else sees the whole fleet", () => {
    expect(scopeOf("operator", fleet, CUSTOMER).length).toBe(1000);
    expect(scopeOf("quality", fleet, CUSTOMER).length).toBe(1000);
    const mine = scopeOf("customer", fleet, CUSTOMER);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.length).toBeLessThan(1000);
    expect(mine.every((c) => c.customer === CUSTOMER)).toBe(true);
    expect(journeysIn(journeys, mine).length).toBe(mine.length);
    expect(alertsIn(alerts, mine).every((a) => mine.some((c) => c.id === a.containerId))).toBe(true);
  });

  it("TC-U-118 each persona gets its own KPIs, plus the carrier and driver scores every persona shares", () => {
    const ids = new Set<string>();
    for (const p of PERSONAS) {
      const c = ctx(p);
      const a = analyticsFor(p, c.scope, c.alerts, c.journeys, {}, NOW);
      expect(a.kpis.length).toBeGreaterThanOrEqual(6);
      expect(a.kpis.map((k) => k.id)).toEqual(expect.arrayContaining(["x_carrier", "x_driver"]));
      expect(a.widgets).toEqual(WIDGETS[p]);
      for (const k of a.kpis.filter((x) => !x.id.startsWith("x_"))) { expect(ids.has(k.id)).toBe(false); ids.add(k.id); }
      for (const k of a.kpis) expect(Number.isFinite(k.value)).toBe(true);
    }
    const op = analyticsFor("operator", fleet, alerts, journeys, {}, NOW);
    expect(op.kpis.find((k) => k.id === "o_transit")?.value).toBe(journeys.filter((j) => ["in_transit", "delayed"].includes(journeyStatus(j))).length);
  });

  it("TC-U-119 the analytics numbers add up to the scope they were computed for", () => {
    for (const p of PERSONAS) {
      const c = ctx(p);
      const a = analyticsFor(p, c.scope, c.alerts, c.journeys, {}, NOW);
      expect(a.statusMix.reduce((s, x) => s + x.n, 0)).toBe(c.scope.length);
      expect(a.healthBands.reduce((s, x) => s + x, 0)).toBe(c.scope.length);
      expect(a.cargoMix.reduce((s, x) => s + x.n, 0)).toBe(c.scope.length);
      expect(a.lockState.reduce((s, x) => s + x.n, 0)).toBe(c.scope.length);
      const act = c.journeys.filter((j) => ["in_transit", "delayed"].includes(journeyStatus(j))).length;
      expect(a.delayBands.reduce((s, x) => s + x.n, 0)).toBe(act);
      for (const r of a.tempCompliance) expect(r.inBand).toBeLessThanOrEqual(r.n);
    }
  });

  it("TC-U-120 quality sees only quality alert types and security only security types", () => {
    const q = ctx("quality"), s = ctx("security");
    const qa = analyticsFor("quality", q.scope, q.alerts, q.journeys, {}, NOW);
    const sa = analyticsFor("security", s.scope, s.alerts, s.journeys, {}, NOW);
    expect(qa.alertTypes.every((x) => ["temperature_critical", "reefer_setpoint", "health_forecast", "gas_high"].includes(x.key))).toBe(true);
    expect(sa.alertTypes.every((x) => ["door_in_motion", "unscheduled_stop", "route_deviation"].includes(x.key))).toBe(true);
    expect(sa.securityTypes.length).toBe(3);
  });

  it("TC-U-121 delay bands and ETA buckets cover every value once", () => {
    expect([0, 5, 6, 30, 31, 60, 61].map(delayBand)).toEqual(["on_time", "on_time", "d6_30", "d6_30", "d31_60", "d31_60", "d60_plus"]);
    const c = ctx("customer");
    const a = analyticsFor("customer", c.scope, c.alerts, c.journeys, {}, NOW);
    expect(a.etaBuckets.reduce((s, x) => s + x.n, 0)).toBe(c.journeys.length);
    expect(countBy(["a", "b", "a"], (x) => x)).toEqual([{ key: "a", n: 2 }, { key: "b", n: 1 }]);
  });

  it("TC-U-122 every report in the catalogue builds with rows that match its columns, and only for the personas that own it", () => {
    for (const p of PERSONAS) {
      expect(REPORTS[p].length).toBeGreaterThan(0);
      const c = ctx(p);
      for (const id of REPORTS[p]) {
        const r = buildReport(id, c);
        expect(r.cols.length).toBeGreaterThan(3);
        for (const row of r.rows) expect(row.length).toBe(r.cols.length);
        if (r.totals) expect(r.totals.length).toBe(r.cols.length);
      }
    }
    expect(REPORTS.customer).not.toContain("daily_ops");
    expect(REPORTS.customer).not.toContain("security_incidents");
    const mine = buildReport("shipment_status", ctx("customer"));
    expect(mine.rows.length).toBe(scopeOf("customer", fleet, CUSTOMER).length);
    const ops = buildReport("daily_ops", ctx("operator"));
    expect(ops.totals?.[1]).toBe(1000);
  });

  it("TC-U-123 CSV export quotes commas and quotes, neutralises formulas and starts with a byte order mark", () => {
    const csv = toCsv(["a", "b"], [["x,y", 'say "hi"'], ["=1+1", -5], ["ok", "line\nbreak"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"x,y","say ""hi"""');
    expect(csv).toContain("'=1+1,-5");
    expect(csv).toContain('"line\nbreak"');
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});
