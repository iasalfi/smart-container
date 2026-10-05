import { describe, expect, it } from "vitest";
import {
  FUEL_RANGE_KM, MAX_DRIVE_MIN, advanceTo, cancelJourney, completeNext, currentDelayMin, etaMs, formatLocal, journeyStatus, makeJourney, milestoneLate,
  nextJourneyId, nextMilestone, parseLocal, planJourney, positionAt, progressShare, skipNext, validateOnboarding, validatePlan,
  type OnboardInput, type PlanInput,
} from "../src/journey";

const base: PlanInput = { originId: "riyadh", destinationId: "buraydah", viaIds: [], departAt: "2026-10-06T06:00", speedKmh: 80, reefer: false, customs: false };
const form: OnboardInput = { containerId: "SC-2001", plate: "ABC 1234", sealNo: "SEAL-90210", profileId: "dairy", setpointC: 4, customer: "Najd Fresh Foods", driverName: "Nasser Al-Shehri", driverPhone: "0551234567" };

describe("journey planner", () => {
  it("TC-U-100 times are read and written as plain local time", () => {
    const ms = parseLocal("2026-10-06T06:30");
    expect(ms).not.toBeNull();
    expect(formatLocal(ms as number)).toBe("2026-10-06T06:30");
    expect(parseLocal("2026-13-06T06:30")).toBeNull();
    expect(parseLocal("06:30")).toBeNull();
    expect(parseLocal("2026-02-30T06:30")).toBeNull();
  });

  it("TC-U-101 a plan is rejected for the same city, repeated stops, a bad time or a bad speed", () => {
    expect(validatePlan(base)).toEqual([]);
    expect(validatePlan({ ...base, destinationId: "riyadh" })).toContain("same_city");
    expect(validatePlan({ ...base, viaIds: ["madinah", "madinah"] })).toContain("via_repeats");
    expect(validatePlan({ ...base, viaIds: ["riyadh"] })).toContain("via_repeats");
    expect(validatePlan({ ...base, originId: "nowhere" })).toContain("missing_origin");
    expect(validatePlan({ ...base, departAt: "tomorrow" })).toContain("bad_departure");
    expect(validatePlan({ ...base, speedKmh: 10 })).toContain("bad_speed");
    expect(validatePlan({ ...base, deliverBy: "soon" })).toContain("bad_deadline");
    expect(() => planJourney({ ...base, destinationId: "riyadh" })).toThrow();
  });

  it("TC-U-102 a short trip has loading, departure, arrival and delivery and no pitstop", () => {
    const p = planJourney({ ...base, speedKmh: 100 });
    expect(p.milestones.map((m) => m.kind)).toEqual(["loaded", "depart", "arrive", "delivered"]);
    expect(p.totalKm).toBeGreaterThan(250);
    expect(p.totalKm).toBeLessThan(450);
    expect(p.arriveMs).toBeGreaterThan(p.departMs);
  });

  it("TC-U-103 long trips get rest stops after 4.5 hours of driving and fuel stops by range", () => {
    const p = planJourney({ ...base, originId: "jeddah", destinationId: "riyadh", departAt: "2026-10-06T05:00" });
    const kinds = p.milestones.map((m) => m.kind);
    expect(kinds).toContain("rest");
    expect(kinds).toContain("fuel");
    const dep = p.milestones.find((m) => m.kind === "depart")!;
    const firstStop = p.milestones.find((m) => m.kind === "rest" || m.kind === "fuel" || m.kind === "overnight")!;
    expect((firstStop.plannedAt - dep.plannedAt) / 60000).toBeLessThanOrEqual(MAX_DRIVE_MIN + 1);
    const fuels = p.milestones.filter((m) => m.kind === "fuel");
    let last = 0;
    for (const f of fuels) { expect(f.km - last).toBeLessThanOrEqual(FUEL_RANGE_KM + 1); last = f.km; }
    expect(p.totalKm - last).toBeLessThanOrEqual(FUEL_RANGE_KM + 1);
  });

  it("TC-U-104 milestones stay in time order with growing distance and a daily driving limit adds an overnight stop", () => {
    const p = planJourney({ ...base, originId: "dammam", destinationId: "jeddah", departAt: "2026-10-06T05:00" });
    const times = p.milestones.map((m) => m.plannedAt);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    const kms = p.milestones.map((m) => m.km);
    expect([...kms].sort((a, b) => a - b)).toEqual(kms);
    expect(p.milestones.some((m) => m.kind === "overnight")).toBe(true);
    expect(p.warnings).toContain("multi_day");
    expect(p.stopMin).toBeGreaterThan(480);
  });

  it("TC-U-105 via cities become waypoints and the road is the sum of the legs", () => {
    const p = planJourney({ ...base, originId: "jeddah", destinationId: "tabuk", viaIds: ["madinah"] });
    expect(p.legs).toHaveLength(2);
    expect(p.legs.reduce((s, l) => s + l.km, 0)).toBe(p.totalKm);
    const wp = p.milestones.filter((m) => m.kind === "waypoint");
    expect(wp).toHaveLength(1);
    expect(wp[0].city).toBe("madinah");
  });

  it("TC-U-106 reefer cargo adds a pre-trip temperature check and port cities add gate and customs steps", () => {
    const p = planJourney({ ...base, originId: "dammam", destinationId: "jeddah", reefer: true, customs: true });
    const kinds = p.milestones.map((m) => m.kind);
    expect(kinds.slice(0, 4)).toEqual(["loaded", "pretrip_check", "port_gate", "depart"]);
    expect(kinds).toContain("customs");
    expect(kinds[kinds.length - 1]).toBe("delivered");
    expect(p.warnings).toContain("reefer_long_haul");
    const noCustoms = planJourney({ ...base, originId: "riyadh", destinationId: "dammam", customs: true });
    expect(noCustoms.milestones.some((m) => m.kind === "customs")).toBe(true);
    expect(planJourney({ ...base, customs: true }).milestones.some((m) => m.kind === "customs")).toBe(false);
  });

  it("TC-U-107 a deadline that the plan cannot meet raises a warning", () => {
    expect(planJourney({ ...base, deliverBy: "2026-10-06T07:00" }).warnings).toContain("misses_deadline");
    expect(planJourney({ ...base, deliverBy: "2026-10-06T20:00" }).warnings).not.toContain("misses_deadline");
    expect(planJourney({ ...base, departAt: "2026-10-06T23:00" }).warnings).toContain("night_departure");
  });
});

describe("journey tracking", () => {
  const journey = () => makeJourney("J-1001", form, { ...base, originId: "jeddah", destinationId: "riyadh" });

  it("TC-U-108 a new journey is planned and completing milestones moves it to dispatched, in transit and completed", () => {
    let j = journey();
    expect(journeyStatus(j)).toBe("planned");
    j = completeNext(j, 0);
    expect(journeyStatus(j)).toBe("dispatched");
    while (nextMilestone(j)?.kind !== "depart") j = completeNext(j, 0);
    j = completeNext(j, 0);
    expect(journeyStatus(j)).toBe("in_transit");
    while (nextMilestone(j)) j = completeNext(j, 0);
    expect(journeyStatus(j)).toBe("completed");
    expect(() => completeNext(j, 0)).toThrow();
  });

  it("TC-U-109 delays are measured against the plan and move the estimated arrival", () => {
    let j = journey();
    while (nextMilestone(j)?.kind !== "depart") j = completeNext(j, 0);
    j = completeNext(j, 0);
    const stop = nextMilestone(j)!;
    j = completeNext(j, 20);
    expect(currentDelayMin(j)).toBe(20);
    expect(etaMs(j)).toBe(j.plan.arriveMs + 20 * 60000);
    expect(milestoneLate(j.plan.milestones.find((m) => m.id === stop.id)!)).toBe(true);
    expect(journeyStatus(j)).toBe("in_transit");
    j = completeNext(j, 45);
    expect(journeyStatus(j)).toBe("delayed");
    expect(() => completeNext(j, 5000)).toThrow();
  });

  it("TC-U-110 only rest and fuel stops can be skipped and a completed journey cannot be cancelled", () => {
    let j = journey();
    expect(() => skipNext(j)).toThrow();
    while (nextMilestone(j) && !["rest", "fuel"].includes(nextMilestone(j)!.kind)) j = completeNext(j, 0);
    j = skipNext(j);
    expect(j.plan.milestones.some((m) => m.status === "skipped")).toBe(true);
    expect(cancelJourney(j).cancelled).toBe(true);
    expect(journeyStatus(cancelJourney(j))).toBe("cancelled");
    while (nextMilestone(j)) j = completeNext(j, 0);
    expect(() => cancelJourney(j)).toThrow();
  });

  it("TC-U-111 a fleet trip can be replayed up to its progress and the position follows the road", () => {
    const j = advanceTo(journey(), 0.5, 10);
    expect(journeyStatus(j)).toBe("in_transit");
    expect(progressShare(j)).toBeGreaterThan(0.2);
    expect(progressShare(j)).toBeLessThanOrEqual(0.5);
    const start = positionAt(j, 0), mid = positionAt(j, 0.5), end = positionAt(j, 1);
    expect(start.lon).toBeCloseTo(39.17, 1);
    expect(end.lon).toBeCloseTo(46.68, 1);
    expect(mid.lon).toBeGreaterThan(start.lon);
    expect(mid.lon).toBeLessThan(end.lon);
  });
});

describe("on-boarding", () => {
  const taken = { containers: ["SC-1001"], plates: ["AAA 1111"] };

  it("TC-U-112 a complete form passes", () => { expect(validateOnboarding(form, taken)).toEqual([]); });

  it("TC-U-113 bad container IDs, plates, seals and phone numbers are named", () => {
    const errs = validateOnboarding({ ...form, containerId: "X1", plate: "12", sealNo: "a", driverPhone: "123" }, taken);
    expect(errs).toEqual(expect.arrayContaining(["container_format", "plate_format", "seal_format", "phone_format"]));
    expect(validateOnboarding({ ...form, containerId: "sc-1001" }, taken)).toContain("container_taken");
    expect(validateOnboarding({ ...form, plate: "aaa 1111" }, taken)).toContain("plate_taken");
    expect(validateOnboarding({ ...form, customer: "", driverName: "" }, taken)).toEqual(expect.arrayContaining(["customer_missing", "driver_missing"]));
  });

  it("TC-U-114 reefer cargo needs a set point inside its band and dry cargo does not", () => {
    expect(validateOnboarding({ ...form, setpointC: null }, taken)).toContain("setpoint_missing");
    expect(validateOnboarding({ ...form, setpointC: 12 }, taken)).toContain("setpoint_range");
    expect(validateOnboarding({ ...form, profileId: "dry", setpointC: null }, taken)).toEqual([]);
    expect(validateOnboarding({ ...form, profileId: "nope" }, taken)).toContain("profile_missing");
  });

  it("TC-U-115 journey IDs continue from the highest one in use", () => {
    expect(nextJourneyId([])).toBe("J-1001");
    expect(nextJourneyId([{ id: "J-1004" }, { id: "J-1002" }])).toBe("J-1005");
    const j = makeJourney("J-1001", { ...form, containerId: "sc-2002", profileId: "dry", setpointC: 4 }, base);
    expect(j.containerId).toBe("SC-2002");
    expect(j.setpointC).toBeNull();
    expect(j.input.reefer).toBe(false);
  });
});

describe("seed journeys", () => {
  it("TC-U-116 live fleet trips become journeys with a matching status and progress", async () => {
    const { getFleet } = await import("../src/fleet");
    const { seedJourneys } = await import("../src/journey");
    const js = seedJourneys(getFleet());
    expect(js.length).toBeGreaterThanOrEqual(10);
    expect(new Set(js.map((j) => j.id)).size).toBe(js.length);
    expect(new Set(js.map((j) => j.containerId)).size).toBe(js.length);
    const statuses = js.map(journeyStatus);
    expect(statuses).toContain("planned");
    expect(statuses).toContain("completed");
    expect(statuses.filter((s) => s === "in_transit" || s === "delayed").length).toBe(8);
    for (const j of js) {
      expect(validateOnboarding({ containerId: "SC-9999", plate: j.plate, sealNo: j.sealNo, profileId: j.profileId, setpointC: j.setpointC, customer: j.customer, driverName: j.driverName, driverPhone: j.driverPhone }, { containers: [], plates: [] })).toEqual([]);
    }
  });
});
