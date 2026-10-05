import { describe, expect, it } from "vitest";
import { getAlerts, getFleet } from "../src/fleet";
import { seedJourneys } from "../src/journey";
import {
  EVENT_POINTS, TODAY, addDays, daysUntil, eligibleDrivers, licenceState, nextId, seedRegistry, validateAssignment, validateDriver, validateEvent, validatePartner,
  type DriverInput, type PartnerInput,
} from "../src/partners";
import { buildPeople, driverScore, gradeOf, partnerScore, riskBand } from "../src/people";
import { DEVICE_LIMITS, advanceWo, buildCases, caseStats, deviceIssues, lifecycleOf, nextPostStep, nextWoId, seedWorkOrders, type WorkOrder } from "../src/cases";
import { REPORTS, alertsIn, analyticsFor, buildReport, journeysIn, scopeOf } from "../src/analytics";
import { classify } from "../src/itsm";

const fleet = getFleet();
const alerts = getAlerts();
const journeys = seedJourneys(fleet);
const reg = seedRegistry();
const NOW = Date.UTC(2026, 9, 5, 12, 0);

const goodPartner: PartnerInput = { name: "Gulf Road Haulage", city: "riyadh", contact: "Omar Said", phone: "0501234567", trucks: 40, reeferTrucks: 10, contractEnd: "2027-12-31", insuranceEnd: "2027-06-30", status: "active" };
const goodDriver: DriverInput = { name: "Faisal Otaibi", partnerId: reg.partners[0].id, phone: "0551234567", licenceNo: "1999999999", licenceClass: "heavy", licenceExpiry: "2028-01-01", years: 6, coldChain: true, status: "active" };

describe("freight partners and drivers", () => {
  it("TC-U-128 the registry holds 8 partners and 40 drivers each, with unique licence numbers, and never changes", () => {
    expect(reg.partners).toHaveLength(8);
    expect(reg.drivers).toHaveLength(320);
    expect(new Set(reg.drivers.map((d) => d.licenceNo)).size).toBe(320);
    expect(new Set(reg.drivers.map((d) => d.id)).size).toBe(320);
    expect(seedRegistry()).toBe(reg);
    expect(reg.partners.map((p) => p.status)).toContain("probation");
    expect(reg.events.length).toBeGreaterThan(100);
    expect(reg.events.every((e) => daysUntil(e.at) <= 0 && daysUntil(e.at) > -30)).toBe(true);
  });

  it("TC-U-129 every container has a driver and a partner, and a reefer always has a cold chain driver", () => {
    const drivers = new Map(reg.drivers.map((d) => [d.id, d]));
    for (const c of fleet) {
      const d = drivers.get(c.driverId);
      expect(d, c.id).toBeTruthy();
      expect(d!.partnerId).toBe(c.partnerId);
      expect(d!.status).toBe("active");
      if (c.reefer) expect(d!.coldChain, c.id).toBe(true);
    }
    expect(new Set(fleet.map((c) => c.partnerId)).size).toBeGreaterThanOrEqual(6);
  });

  it("TC-U-130 a partner is checked for name, depot, contact, phone, fleet size and dates", () => {
    expect(validatePartner(goodPartner, reg.partners)).toEqual([]);
    expect(validatePartner({ ...goodPartner, name: "ab" }, [])).toContain("name_short");
    expect(validatePartner({ ...goodPartner, name: reg.partners[0].name.toUpperCase() }, reg.partners)).toContain("name_taken");
    expect(validatePartner({ ...goodPartner, city: "atlantis" }, [])).toContain("city_missing");
    expect(validatePartner({ ...goodPartner, contact: "x" }, [])).toContain("contact_short");
    for (const phone of ["", "0412345678", "05123", "05abcdefgh", "+966501234567"]) expect(validatePartner({ ...goodPartner, phone }, [])).toContain("phone_format");
    expect(validatePartner({ ...goodPartner, trucks: 0 }, [])).toContain("trucks_range");
    expect(validatePartner({ ...goodPartner, trucks: 2001 }, [])).toContain("trucks_range");
    expect(validatePartner({ ...goodPartner, trucks: 10.5 }, [])).toContain("trucks_range");
    expect(validatePartner({ ...goodPartner, reeferTrucks: 41 }, [])).toContain("reefer_range");
    expect(validatePartner({ ...goodPartner, reeferTrucks: -1 }, [])).toContain("reefer_range");
    expect(validatePartner({ ...goodPartner, contractEnd: "31/12/2027" }, [])).toContain("contract_date");
    expect(validatePartner({ ...goodPartner, insuranceEnd: "2027-02-30" }, [])).toContain("insurance_date");
  });

  it("TC-U-131 a driver is checked for name, partner, phone, licence number, class, expiry and experience", () => {
    expect(validateDriver(goodDriver, reg.partners, reg.drivers)).toEqual([]);
    expect(validateDriver({ ...goodDriver, name: " a " }, reg.partners, [])).toContain("name_short");
    expect(validateDriver({ ...goodDriver, partnerId: "FP-99" }, reg.partners, [])).toContain("partner_missing");
    const suspended = { ...reg.partners[0], id: "FP-90", status: "suspended" as const };
    expect(validateDriver({ ...goodDriver, partnerId: "FP-90" }, [suspended], [])).toContain("partner_suspended");
    expect(validateDriver({ ...goodDriver, phone: "123" }, reg.partners, [])).toContain("phone_format");
    expect(validateDriver({ ...goodDriver, licenceNo: "12345" }, reg.partners, [])).toContain("licence_format");
    expect(validateDriver({ ...goodDriver, licenceNo: reg.drivers[0].licenceNo }, reg.partners, reg.drivers)).toContain("licence_taken");
    expect(validateDriver({ ...goodDriver, licenceExpiry: "soon" }, reg.partners, [])).toContain("expiry_date");
    expect(validateDriver({ ...goodDriver, years: -1 }, reg.partners, [])).toContain("years_range");
    expect(validateDriver({ ...goodDriver, years: 46 }, reg.partners, [])).toContain("years_range");
  });

  it("TC-U-132 a driver event needs a known driver, a valid type and a date between 90 days ago and today", () => {
    const id = reg.drivers[0].id;
    const ok = { driverId: id, type: "speeding" as const, at: TODAY, note: "" };
    expect(validateEvent(ok, reg.drivers)).toEqual([]);
    expect(validateEvent({ ...ok, driverId: "DR-0000" }, reg.drivers)).toContain("driver_missing");
    expect(validateEvent({ ...ok, type: "parking" as never }, reg.drivers)).toContain("type_invalid");
    expect(validateEvent({ ...ok, at: "yesterday" }, reg.drivers)).toContain("date_invalid");
    expect(validateEvent({ ...ok, at: addDays(TODAY, 1) }, reg.drivers)).toContain("date_future");
    expect(validateEvent({ ...ok, at: addDays(TODAY, -91) }, reg.drivers)).toContain("date_old");
    expect(validateEvent({ ...ok, at: addDays(TODAY, -90) }, reg.drivers)).toEqual([]);
    expect(validateEvent({ ...ok, note: "x".repeat(201) }, reg.drivers)).toContain("note_long");
  });

  it("TC-U-133 an assignment is refused for an expired licence, an inactive driver, a suspended partner or a missing cold chain course", () => {
    const partner = reg.partners[0];
    const d = { ...goodDriver, id: "DR-X", source: "user" as const };
    expect(validateAssignment(d, partner, true)).toEqual([]);
    expect(validateAssignment(undefined, partner, false)).toEqual(["driver_missing"]);
    expect(validateAssignment({ ...d, licenceExpiry: addDays(TODAY, -1) }, partner, false)).toContain("licence_expired");
    expect(validateAssignment({ ...d, licenceExpiry: TODAY }, partner, false)).toEqual([]);
    expect(validateAssignment({ ...d, status: "on_leave" }, partner, false)).toContain("driver_status");
    expect(validateAssignment(d, { ...partner, status: "suspended" }, false)).toContain("partner_suspended");
    expect(validateAssignment({ ...d, coldChain: false }, partner, true)).toContain("cold_chain_missing");
    expect(validateAssignment({ ...d, coldChain: false }, partner, false)).toEqual([]);
    expect(eligibleDrivers(reg, true).every((x) => x.coldChain && x.status === "active")).toBe(true);
    expect(eligibleDrivers(reg, false).length).toBeGreaterThan(eligibleDrivers(reg, true).length);
  });

  it("TC-U-134 licence state and ids follow the demo date", () => {
    expect(licenceState(addDays(TODAY, -1))).toBe("expired");
    expect(licenceState(TODAY)).toBe("d30");
    expect(licenceState(addDays(TODAY, 30))).toBe("d30");
    expect(licenceState(addDays(TODAY, 31))).toBe("d90");
    expect(licenceState(addDays(TODAY, 91))).toBe("ok");
    expect(nextId("DR", reg.drivers)).toBe("DR-1321");
    expect(nextId("FP", reg.partners)).toBe("FP-09");
    expect(nextId("EV", [])).toBe("EV-0001");
  });
});

describe("driver and carrier scores", () => {
  const d = reg.drivers[0];
  const ev = (type: keyof typeof EVENT_POINTS, n = 1) => Array.from({ length: n }, (_, i) => ({ id: `E${i}`, driverId: d.id, type, at: TODAY, note: "", source: "operator" as const }));
  const fine = { ...d, licenceExpiry: addDays(TODAY, 400) };

  it("TC-U-135 a driver starts at 100 and loses points for events, open alerts and a licence that has run out", () => {
    expect(driverScore(fine, [], 0, 0)).toBe(100);
    expect(driverScore(fine, ev("speeding"), 0, 0)).toBe(100 - EVENT_POINTS.speeding);
    expect(driverScore(fine, [...ev("harsh_braking", 2), ...ev("rest_breach")], 0, 0)).toBe(100 - 2 * EVENT_POINTS.harsh_braking - EVENT_POINTS.rest_breach);
    expect(driverScore(fine, [], 1, 2)).toBe(100 - 6 - 4);
    expect(driverScore({ ...fine, licenceExpiry: addDays(TODAY, -2) }, [], 0, 0)).toBe(75);
    expect(driverScore({ ...fine, licenceExpiry: addDays(TODAY, 10) }, [], 0, 0)).toBe(95);
    expect(driverScore(fine, ev("rest_breach", 20), 5, 5)).toBe(0);
  });

  it("TC-U-136 risk bands split at 60 and 80 and grades at 55, 70 and 85", () => {
    expect([59, 60, 79, 80].map(riskBand)).toEqual(["high", "watch", "watch", "good"]);
    expect([54, 55, 69, 70, 84, 85].map(gradeOf)).toEqual(["D", "C", "C", "B", "B", "A"]);
  });

  it("TC-U-137 a carrier score weighs on time 30, cold chain 25, alerts 25 and safety 20, and drops cold chain when there are no reefers", () => {
    expect(partnerScore({ otp: 100, cold: 100, alertsPer100: 0, safety: 100 })).toBe(100);
    expect(partnerScore({ otp: 0, cold: 100, alertsPer100: 0, safety: 100 })).toBe(70);
    expect(partnerScore({ otp: 100, cold: 0, alertsPer100: 0, safety: 100 })).toBe(75);
    expect(partnerScore({ otp: 100, cold: 100, alertsPer100: 25, safety: 100 })).toBe(75);
    expect(partnerScore({ otp: 100, cold: 100, alertsPer100: 0, safety: 0 })).toBe(80);
    expect(partnerScore({ otp: 100, cold: null, alertsPer100: 0, safety: 100 })).toBe(100);
    expect(partnerScore({ otp: 0, cold: null, alertsPer100: 50, safety: 0 })).toBe(0);
  });

  it("TC-U-138 the people view covers every container once and its scores stay between 0 and 100", () => {
    const p = buildPeople(reg, fleet, alerts, journeys);
    expect(p.partners.reduce((s, x) => s + x.containers, 0)).toBe(1000);
    expect(p.drivers.reduce((s, x) => s + x.containers, 0)).toBe(1000);
    for (const x of [...p.partners, ...p.drivers]) { expect(x.score).toBeGreaterThanOrEqual(0); expect(x.score).toBeLessThanOrEqual(100); }
    expect(p.bands.high + p.bands.watch + p.bands.good).toBe(p.drivers.length);
    expect(p.licence.expired + p.licence.d30 + p.licence.d90 + p.licence.ok).toBe(p.drivers.length);
    const grades = new Set(p.partners.map((x) => x.grade));
    expect(grades.size).toBeGreaterThanOrEqual(2);
    expect(p.carrierScore).toBeGreaterThan(0);
    expect(p.partners.map((x) => x.score)).toEqual([...p.partners.map((x) => x.score)].sort((a, b) => b - a));
  });

  it("TC-U-139 reassigning a container moves it to the new driver and carrier in the scorecards", () => {
    const c = fleet.find((x) => !x.reefer)!;
    const other = reg.drivers.find((x) => x.partnerId !== c.partnerId && x.status === "active")!;
    const next = { ...reg, assignments: { [c.id]: other.id } };
    const before = buildPeople(reg, fleet, alerts, journeys);
    const after = buildPeople(next, fleet, alerts, journeys);
    const n = (p: typeof before, id: string) => p.partners.find((x) => x.id === id)?.containers ?? 0;
    expect(n(after, other.partnerId)).toBe(n(before, other.partnerId) + 1);
    expect(n(after, c.partnerId)).toBe(n(before, c.partnerId) - 1);
    expect(after.drivers.find((x) => x.id === other.id)!.containers).toBe((before.drivers.find((x) => x.id === other.id)?.containers ?? 0) + 1);
  });
});

describe("cases, maintenance and lifecycle", () => {
  const cases = buildCases({ alerts, profileOf: (id) => fleet.find((c) => c.id === id)?.profileId ?? "dry", tickets: {}, workOrders: [] });

  it("TC-U-140 alarms group into one case per container, ranked by priority then age", () => {
    const containers = new Set(alerts.map((a) => a.containerId));
    expect(cases).toHaveLength(containers.size);
    expect(cases.length).toBeLessThan(alerts.length);
    expect(cases.reduce((s, c) => s + c.merged, 0)).toBe(alerts.length);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    for (let i = 1; i < cases.length; i++) expect(cases[i - 1].priority <= cases[i].priority).toBe(true);
    const multi = cases.find((c) => c.merged > 1)!;
    expect(multi.alertIds).toHaveLength(multi.merged);
    const worst = Math.min(...alerts.filter((a) => a.containerId === multi.containerId).map((a) => classify(a, fleet.find((c) => c.id === multi.containerId)!.profileId).priority));
    expect(multi.priority).toBe(worst);
  });

  it("TC-U-141 a case that needs a repair can open a work order, which moves it into maintenance", () => {
    const reefer = cases.find((c) => c.mro)!;
    expect(["reefer_setpoint", "temperature_critical", "gas_high"]).toContain(reefer.type);
    const wo: WorkOrder = { id: "WO-2100", containerId: reefer.containerId, reason: reefer.type, params: {}, where: "next_stop", stage: 0, kind: "reactive", openedMin: 5, caseId: reefer.id };
    const withOrder = buildCases({ alerts, profileOf: (id) => fleet.find((c) => c.id === id)?.profileId ?? "dry", tickets: {}, workOrders: [wo] });
    const hit = withOrder.find((c) => c.id === reefer.id)!;
    expect(hit.state).toBe("in_mro");
    expect(hit.woId).toBe("WO-2100");
    expect(caseStats(withOrder).inMro).toBe(1);
    expect(caseStats(cases).inMro).toBe(0);
  });

  it("TC-U-142 case counts report the oldest case nobody owns", () => {
    const s = caseStats(cases);
    expect(s.active).toBe(cases.length);
    expect(s.unowned).toBe(cases.filter((c) => c.state === "open" && !c.owner).length);
    expect(s.oldestUnownedMin).toBe(Math.max(...cases.filter((c) => c.state === "open" && !c.owner).map((c) => c.ageMin)));
    const owned = buildCases({ alerts, profileOf: () => "dry", tickets: Object.fromEntries(alerts.map((a) => [a.id, { log: [], owner: "me" }])), workOrders: [] });
    expect(caseStats(owned).unowned).toBe(0);
    expect(caseStats(owned).oldestUnownedMin).toBe(0);
  });

  it("TC-U-143 work orders move through five stages and ids keep counting up", () => {
    let w: WorkOrder = { id: "WO-2024", containerId: "SC-1001", reason: "compressor", params: {}, where: "depot", stage: 0, kind: "reactive", openedMin: 10 };
    for (let i = 0; i < 6; i++) w = advanceWo(w);
    expect(w.stage).toBe(4);
    expect(nextWoId([])).toBe("WO-2001");
    expect(nextWoId([{ id: "WO-2024" }, { id: "WO-2030" }])).toBe("WO-2031");
    const seeds = seedWorkOrders(fleet, new Set(alerts.map((a) => a.containerId)));
    expect(seeds.length).toBeGreaterThanOrEqual(3);
    expect(new Set(seeds.map((s) => s.stage)).size).toBeGreaterThanOrEqual(3);
    expect(seeds.every((s) => s.example)).toBe(true);
  });

  it("TC-U-144 a tracker needs a visit when it is offline, low on battery, or has a weak signal and a weak battery", () => {
    const base = { id: "SC-1", online: true, batteryPct: 80, signal: 4, lastSeenMin: 0 };
    expect(deviceIssues([base])).toEqual([]);
    expect(deviceIssues([{ ...base, batteryPct: 25 }])[0].reason).toBe("tracker_battery");
    expect(deviceIssues([{ ...base, batteryPct: 26 }])).toEqual([]);
    expect(deviceIssues([{ ...base, online: false, lastSeenMin: 25 }])[0].reason).toBe("tracker_offline");
    expect(deviceIssues([{ ...base, online: false, lastSeenMin: 24 }])).toEqual([]);
    expect(deviceIssues([{ ...base, signal: 1 }])).toEqual([]);
    expect(deviceIssues([{ ...base, signal: 1, batteryPct: 40 }])[0].reason).toBe("tracker_signal");
    expect(deviceIssues([{ ...base, batteryPct: 50 }], { ...DEVICE_LIMITS, batteryPct: 60 })[0].reason).toBe("tracker_battery");
    const all = deviceIssues(fleet);
    expect(all.length).toBeGreaterThan(0);
    expect(all.length).toBeLessThan(150);
  });

  it("TC-U-145 the lifecycle has six stages, delay is a flag, and delivered assets can be unloaded and returned", () => {
    const stages = new Set<string>();
    for (const j of journeys) { const l = lifecycleOf(j); if (l) stages.add(l.stage); }
    expect([...stages]).toEqual(expect.arrayContaining(["in_transit", "at_destination"]));
    const done = journeys.find((j) => lifecycleOf(j)?.stage === "at_destination")!;
    expect(nextPostStep("at_destination")).toBe("unloaded");
    expect(lifecycleOf(done, "unloaded")?.stage).toBe("unloaded_inspected");
    expect(nextPostStep("unloaded_inspected")).toBe("back");
    expect(lifecycleOf(done, "back")?.stage).toBe("back_in_service");
    expect(nextPostStep("back_in_service")).toBeNull();
    expect(nextPostStep("in_transit")).toBeNull();
    expect(lifecycleOf(undefined)).toBeNull();
  });

  it("TC-U-146 minutes out of band are recorded per container, and reefers with an excursion have some", () => {
    expect(fleet.every((c) => Number.isInteger(c.outOfBandMin) && c.outOfBandMin >= 0)).toBe(true);
    expect(fleet.some((c) => c.outOfBandMin > 0)).toBe(true);
    const worst = fleet.find((c) => c.scenario === "temp")!;
    expect(worst.outOfBandMin).toBeGreaterThan(0);
  });
});

describe("analytics for people and the scorecard reports", () => {
  it("TC-U-147 every persona gets the carrier and driver score, and the operator also gets the unowned case age", () => {
    for (const p of ["operator", "quality", "security", "customer"] as const) {
      const scope = scopeOf(p, fleet, "Najd Fresh Foods");
      const a = analyticsFor(p, scope, alertsIn(alerts, scope), journeysIn(journeys, scope), {}, NOW, reg, []);
      for (const id of ["x_carrier", "x_driver"]) { const k = a.kpis.find((x) => x.id === id)!; expect(k.value).toBeGreaterThanOrEqual(0); expect(k.value).toBeLessThanOrEqual(100); expect(k.unit).toBe("score"); }
      expect(a.people.partners.reduce((s, x) => s + x.containers, 0)).toBe(scope.length);
    }
    const op = analyticsFor("operator", fleet, alerts, journeys, {}, NOW);
    expect(op.kpis.find((k) => k.id === "o_unowned")!.unit).toBe("min");
    expect(op.cases.active).toBeGreaterThan(0);
    const q = analyticsFor("quality", fleet, alerts, journeys, {}, NOW);
    expect(q.kpis.find((k) => k.id === "q_oob")!.unit).toBe("min");
  });

  it("TC-U-148 the partner and driver scorecards are offered to the right personas and list real rows", () => {
    expect(REPORTS.operator).toEqual(expect.arrayContaining(["partner_scorecard", "driver_scorecard"]));
    expect(REPORTS.quality).toContain("partner_scorecard");
    expect(REPORTS.security).toContain("driver_scorecard");
    expect(REPORTS.customer).toContain("partner_scorecard");
    expect(REPORTS.customer).not.toContain("driver_scorecard");
    const x = { scope: fleet, alerts, journeys, tickets: {}, nowMs: NOW, registry: reg };
    const pr = buildReport("partner_scorecard", x);
    expect(pr.rows.length).toBe(buildPeople(reg, fleet, alerts, journeys).partners.length);
    expect(pr.cols[0].key).toBe("partner");
    const dr = buildReport("driver_scorecard", x);
    expect(dr.rows.length).toBe(100);
    expect(dr.cols.find((c) => c.key === "risk")!.kind).toBe("risk");
    const scores = dr.rows.map((r) => Number(r[4]));
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
  });
});
