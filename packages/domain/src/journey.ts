import { CITIES, ROUTES } from "./cities";
import { haversineKm, type LonLat } from "./geo";
import { getProfile } from "./profiles";
import type { Container } from "./types";

/**
 * Journey planning for the operations module: route, pitstops and milestones.
 * Times are plain local times for Saudi Arabia (UTC+3, no daylight saving). They are stored as epoch
 * milliseconds read as UTC, so a planned 06:00 always prints as 06:00 whatever the viewer's time zone.
 */

export const ROAD_FACTOR = 1.22;
export const MAX_DRIVE_MIN = 270;
export const REST_MIN = 45;
export const FUEL_RANGE_KM = 650;
export const FUEL_MIN = 20;
export const WAYPOINT_MIN = 20;
export const DAY_DRIVE_MIN = 540;
export const OVERNIGHT_MIN = 480;
export const LOAD_LEAD_MIN = 60;
export const CHECK_LEAD_MIN = 30;
export const UNLOAD_MIN = 45;
export const PORT_GATE_MIN = 40;
export const CUSTOMS_MIN = 90;
export const LATE_AFTER_MIN = 15;
export const DELAYED_AFTER_MIN = 30;
export const PORT_CITIES = ["jeddah", "dammam", "jizan"];

export type MilestoneKind = "loaded" | "pretrip_check" | "port_gate" | "depart" | "rest" | "fuel" | "overnight" | "waypoint" | "customs" | "arrive" | "delivered";
export type MilestoneStatus = "pending" | "done" | "skipped";
export type JourneyStatus = "planned" | "dispatched" | "in_transit" | "delayed" | "completed" | "cancelled";

/** Stop kinds a dispatcher may skip when the driver does not need them. */
export const SKIPPABLE: MilestoneKind[] = ["rest", "fuel"];

export interface Milestone {
  id: string;
  kind: MilestoneKind;
  /** City id for waypoint, port, customs and arrival milestones. */
  city?: string;
  plannedAt: number;
  dwellMin: number;
  /** Kilometres from the origin along the planned road. */
  km: number;
  lon: number;
  lat: number;
  status: MilestoneStatus;
  actualAt?: number;
}

export interface PlanInput {
  originId: string;
  destinationId: string;
  viaIds: string[];
  /** Local departure, "YYYY-MM-DDTHH:MM". */
  departAt: string;
  speedKmh: number;
  reefer: boolean;
  customs: boolean;
  /** Optional delivery deadline in the same format. */
  deliverBy?: string;
}

export type PlanError = "missing_origin" | "missing_destination" | "same_city" | "via_repeats" | "bad_departure" | "bad_speed" | "bad_deadline";
export type PlanWarning = "multi_day" | "reefer_long_haul" | "misses_deadline" | "night_departure";

export interface Leg { fromId: string; toId: string; km: number }

export interface Plan {
  legs: Leg[];
  points: string[];
  totalKm: number;
  driveMin: number;
  stopMin: number;
  departMs: number;
  arriveMs: number;
  milestones: Milestone[];
  warnings: PlanWarning[];
}

export function parseLocal(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const d = new Date(ms);
  if (d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3] || d.getUTCHours() !== +m[4]) return null;
  return ms;
}

export function formatLocal(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export function validatePlan(i: PlanInput): PlanError[] {
  const errs: PlanError[] = [];
  if (!CITIES[i.originId]) errs.push("missing_origin");
  if (!CITIES[i.destinationId]) errs.push("missing_destination");
  if (CITIES[i.originId] && i.originId === i.destinationId) errs.push("same_city");
  const stops = [i.originId, ...i.viaIds, i.destinationId];
  const sameEnds = i.originId === i.destinationId;
  if (!sameEnds && (new Set(stops).size !== stops.length || i.viaIds.some((v) => !CITIES[v]))) errs.push("via_repeats");
  if (parseLocal(i.departAt) === null) errs.push("bad_departure");
  if (!(i.speedKmh >= 40 && i.speedKmh <= 100)) errs.push("bad_speed");
  if (i.deliverBy && parseLocal(i.deliverBy) === null) errs.push("bad_deadline");
  return errs;
}

function lerp(a: LonLat, b: LonLat, f: number): LonLat {
  return { lon: a.lon + (b.lon - a.lon) * f, lat: a.lat + (b.lat - a.lat) * f };
}

const EPS = 0.01;

/** Builds the road plan, the pitstops that drivers' hours and fuel range call for, and the milestone list. */
export function planJourney(i: PlanInput): Plan {
  const errs = validatePlan(i);
  if (errs.length) throw new Error(`Invalid plan: ${errs.join(", ")}`);
  const departMs = parseLocal(i.departAt) as number;
  const points = [i.originId, ...i.viaIds, i.destinationId];
  const legs: Leg[] = points.slice(1).map((to, k) => {
    const a = CITIES[points[k]], b = CITIES[to];
    return { fromId: points[k], toId: to, km: Math.round(haversineKm(a, b) * ROAD_FACTOR) };
  });
  const totalKm = legs.reduce((s, l) => s + l.km, 0);
  const min = (n: number) => n * 60000;
  const ms: Milestone[] = [];
  let seq = 0;
  const add = (kind: MilestoneKind, plannedAt: number, dwellMin: number, km: number, at: LonLat, city?: string) => {
    ms.push({ id: `m${++seq}`, kind, city, plannedAt, dwellMin, km, lon: at.lon, lat: at.lat, status: "pending" });
  };
  const origin = CITIES[i.originId];
  const originPort = PORT_CITIES.includes(i.originId);
  let depart = departMs;
  add("loaded", departMs - min(LOAD_LEAD_MIN + (originPort ? PORT_GATE_MIN : 0)), 0, 0, origin, i.originId);
  if (i.reefer) add("pretrip_check", departMs - min(CHECK_LEAD_MIN + (originPort ? PORT_GATE_MIN : 0)), CHECK_LEAD_MIN, 0, origin, i.originId);
  if (originPort) add("port_gate", departMs - min(PORT_GATE_MIN), PORT_GATE_MIN, 0, origin, i.originId);
  add("depart", depart, 0, 0, origin, i.originId);

  const speed = i.speedKmh;
  let t = depart, cum = 0, sinceRest = 0, sinceFuelKm = 0, today = 0, driveMin = 0, stopMin = 0;
  const stopOf = (leg: Leg, pos: number): LonLat => lerp(CITIES[leg.fromId], CITIES[leg.toId], leg.km === 0 ? 0 : pos / leg.km);

  legs.forEach((leg, li) => {
    let remaining = leg.km, pos = 0;
    while (remaining > EPS) {
      const toRest = Math.max(0, ((MAX_DRIVE_MIN - sinceRest) / 60) * speed);
      const toFuel = Math.max(0, FUEL_RANGE_KM - sinceFuelKm);
      const toDay = Math.max(0, ((DAY_DRIVE_MIN - today) / 60) * speed);
      const step = Math.min(remaining, toRest, toFuel, toDay);
      const mins = (step / speed) * 60;
      t += min(mins); driveMin += mins; sinceRest += mins; today += mins; sinceFuelKm += step;
      remaining -= step; pos += step; cum += step;
      if (remaining <= EPS) break;
      const at = stopOf(leg, pos);
      if (step === toDay || today >= DAY_DRIVE_MIN - 1e-6) {
        add("overnight", t, OVERNIGHT_MIN, Math.round(cum), at);
        t += min(OVERNIGHT_MIN); stopMin += OVERNIGHT_MIN; sinceRest = 0; today = 0;
      } else if (step === toFuel) {
        add("fuel", t, FUEL_MIN, Math.round(cum), at);
        t += min(FUEL_MIN); stopMin += FUEL_MIN; sinceFuelKm = 0;
      } else {
        add("rest", t, REST_MIN, Math.round(cum), at);
        t += min(REST_MIN); stopMin += REST_MIN; sinceRest = 0;
      }
    }
    const here = CITIES[leg.toId];
    if (li < legs.length - 1) {
      add("waypoint", t, WAYPOINT_MIN, Math.round(cum), here, leg.toId);
      t += min(WAYPOINT_MIN); stopMin += WAYPOINT_MIN;
    }
  });

  const dest = CITIES[i.destinationId];
  if (i.customs && PORT_CITIES.includes(i.destinationId)) {
    add("customs", t, CUSTOMS_MIN, totalKm, dest, i.destinationId);
    t += min(CUSTOMS_MIN); stopMin += CUSTOMS_MIN;
  }
  add("arrive", t, 0, totalKm, dest, i.destinationId);
  add("delivered", t + min(UNLOAD_MIN), UNLOAD_MIN, totalKm, dest, i.destinationId);
  const arriveMs = t;

  const warnings: PlanWarning[] = [];
  if (Math.floor(arriveMs / 86400000) !== Math.floor(departMs / 86400000)) warnings.push("multi_day");
  if (i.reefer && (arriveMs - departMs) / 3600000 > 12) warnings.push("reefer_long_haul");
  if (i.deliverBy) { const d = parseLocal(i.deliverBy); if (d !== null && arriveMs + min(UNLOAD_MIN) > d) warnings.push("misses_deadline"); }
  const hour = new Date(departMs).getUTCHours();
  if (hour >= 22 || hour < 4) warnings.push("night_departure");

  return { legs, points, totalKm, driveMin: Math.round(driveMin), stopMin, departMs, arriveMs, milestones: ms, warnings };
}

export interface Journey {
  id: string;
  containerId: string;
  customer: string;
  driverName: string;
  driverPhone: string;
  plate: string;
  profileId: string;
  setpointC: number | null;
  sealNo: string;
  input: PlanInput;
  plan: Plan;
  cancelled?: boolean;
  /** Share of the road a live truck has covered, kept for journeys replayed from the fleet. */
  trackShare?: number;
  /** Where the record came from, the live fleet or a dispatcher. */
  source: "fleet" | "planned";
}

export function delayOf(m: Milestone): number | null {
  return m.status === "done" && m.actualAt !== undefined ? Math.round((m.actualAt - m.plannedAt) / 60000) : null;
}

/** Delay carried by the latest completed milestone, in minutes. Positive means late. */
export function currentDelayMin(j: Journey): number {
  for (let k = j.plan.milestones.length - 1; k >= 0; k--) { const d = delayOf(j.plan.milestones[k]); if (d !== null) return d; }
  return 0;
}

export function nextMilestone(j: Journey): Milestone | undefined {
  return j.plan.milestones.find((m) => m.status === "pending");
}

export function journeyStatus(j: Journey): JourneyStatus {
  if (j.cancelled) return "cancelled";
  const ms = j.plan.milestones;
  const done = (k: MilestoneKind) => ms.some((m) => m.kind === k && m.status === "done");
  if (done("delivered")) return "completed";
  if (done("depart")) return currentDelayMin(j) > DELAYED_AFTER_MIN ? "delayed" : "in_transit";
  if (done("loaded")) return "dispatched";
  return "planned";
}

/** Estimated arrival, the plan moved by the delay seen so far. */
export function etaMs(j: Journey): number {
  return j.plan.arriveMs + currentDelayMin(j) * 60000;
}

export function milestoneLate(m: Milestone): boolean {
  const d = delayOf(m);
  return d !== null && d > LATE_AFTER_MIN;
}

/** Completes the next pending milestone. The log time is the plan plus the given delay, so entries are repeatable. */
export function completeNext(j: Journey, delayMin: number): Journey {
  if (j.cancelled) throw new Error("Journey is cancelled");
  const next = nextMilestone(j);
  if (!next) throw new Error("All milestones are done");
  if (!Number.isFinite(delayMin) || Math.abs(delayMin) > 24 * 60) throw new Error("Delay must be within 24 hours");
  const milestones = j.plan.milestones.map((m) => (m.id === next.id ? { ...m, status: "done" as const, actualAt: m.plannedAt + Math.round(delayMin) * 60000 } : m));
  return { ...j, plan: { ...j.plan, milestones } };
}

export function skipNext(j: Journey): Journey {
  const next = nextMilestone(j);
  if (!next || !SKIPPABLE.includes(next.kind)) throw new Error("This milestone cannot be skipped");
  return { ...j, plan: { ...j.plan, milestones: j.plan.milestones.map((m) => (m.id === next.id ? { ...m, status: "skipped" as const } : m)) } };
}

export function cancelJourney(j: Journey): Journey {
  if (journeyStatus(j) === "completed") throw new Error("A completed journey cannot be cancelled");
  return { ...j, cancelled: true };
}

/** Position along the planned road for a share of the total distance. */
export function positionAt(j: Journey, share: number): LonLat {
  const target = Math.min(1, Math.max(0, share)) * j.plan.totalKm;
  let acc = 0;
  for (const leg of j.plan.legs) {
    if (target <= acc + leg.km || leg === j.plan.legs[j.plan.legs.length - 1]) {
      return lerp(CITIES[leg.fromId], CITIES[leg.toId], leg.km === 0 ? 0 : Math.min(1, (target - acc) / leg.km));
    }
    acc += leg.km;
  }
  return CITIES[j.plan.points[0]];
}

/** Share of the road covered, from the latest completed milestone. */
export function progressShare(j: Journey): number {
  let km = 0;
  for (const m of j.plan.milestones) if (m.status === "done") km = Math.max(km, m.km);
  const byMilestone = j.plan.totalKm === 0 ? 0 : km / j.plan.totalKm;
  return Math.max(byMilestone, j.trackShare ?? 0);
}

/* ------------------------------ on-boarding ------------------------------ */

export interface OnboardInput {
  containerId: string;
  plate: string;
  sealNo: string;
  profileId: string;
  setpointC: number | null;
  customer: string;
  driverName: string;
  driverPhone: string;
}

export type OnboardError =
  | "container_format" | "container_taken" | "plate_format" | "plate_taken" | "seal_format"
  | "profile_missing" | "setpoint_missing" | "setpoint_range" | "customer_missing" | "driver_missing" | "phone_format";

export const CONTAINER_RE = /^SC-\d{4}$/;
export const PLATE_RE = /^[A-Z]{3} \d{4}$/;
export const SEAL_RE = /^[A-Z0-9-]{6,14}$/;
export const PHONE_RE = /^05\d{8}$/;

/** Checks an on-boarding form. `taken` holds the container IDs and plates already in use. */
export function validateOnboarding(i: OnboardInput, taken: { containers: string[]; plates: string[] }): OnboardError[] {
  const errs: OnboardError[] = [];
  const id = i.containerId.trim().toUpperCase();
  if (!CONTAINER_RE.test(id)) errs.push("container_format");
  else if (taken.containers.includes(id)) errs.push("container_taken");
  const plate = i.plate.trim().toUpperCase();
  if (!PLATE_RE.test(plate)) errs.push("plate_format");
  else if (taken.plates.includes(plate)) errs.push("plate_taken");
  if (!SEAL_RE.test(i.sealNo.trim().toUpperCase())) errs.push("seal_format");
  const prof = getProfile(i.profileId);
  if (!prof) errs.push("profile_missing");
  else if (prof.reefer) {
    if (i.setpointC === null || !Number.isFinite(i.setpointC)) errs.push("setpoint_missing");
    else if (i.setpointC < prof.tMin || i.setpointC > prof.tMax) errs.push("setpoint_range");
  }
  if (i.customer.trim().length < 3) errs.push("customer_missing");
  if (i.driverName.trim().length < 3) errs.push("driver_missing");
  if (!PHONE_RE.test(i.driverPhone.trim())) errs.push("phone_format");
  return errs;
}

export function nextJourneyId(existing: { id: string }[]): string {
  const max = existing.reduce((m, j) => Math.max(m, Number(j.id.replace(/\D/g, "")) || 0), 1000);
  return `J-${max + 1}`;
}

export function makeJourney(id: string, o: OnboardInput, input: PlanInput, source: Journey["source"] = "planned"): Journey {
  const prof = getProfile(o.profileId);
  const plan = planJourney({ ...input, reefer: !!prof?.reefer });
  return {
    id, containerId: o.containerId.trim().toUpperCase(), customer: o.customer.trim(), driverName: o.driverName.trim(), driverPhone: o.driverPhone.trim(),
    plate: o.plate.trim().toUpperCase(), profileId: o.profileId, setpointC: prof?.reefer ? o.setpointC : null, sealNo: o.sealNo.trim().toUpperCase(),
    input: { ...input, reefer: !!prof?.reefer }, plan, source,
  };
}

/** Marks every milestone up to a share of the road as done, used to replay a live fleet trip as a journey. */
export function advanceTo(j: Journey, share: number, delayMin: number): Journey {
  const limit = share * j.plan.totalKm;
  const milestones = j.plan.milestones.map((m) => {
    const reached = m.kind === "loaded" || m.kind === "pretrip_check" || m.kind === "port_gate" || m.kind === "depart" || m.km <= limit;
    if (!reached || m.kind === "arrive" || m.kind === "delivered" || m.kind === "customs") return m;
    const early = m.kind === "loaded" || m.kind === "pretrip_check" || m.kind === "port_gate";
    return { ...m, status: "done" as const, actualAt: m.plannedAt + (early ? 0 : delayMin) * 60000 };
  });
  return { ...j, trackShare: share, plan: { ...j.plan, milestones } };
}

/* ------------------------------ seed journeys ------------------------------ */

/** The demo clock: 5 Oct 2026, 12:00 local. Seeded journeys are placed around it. */
export const SNAPSHOT_MS = Date.UTC(2026, 9, 5, 12, 0);

function round5(ms: number): number { return Math.round(ms / 300000) * 300000; }

/** Turns live fleet trips into journeys: one in transit per corridor, two still planned and one completed. */
export function seedJourneys(fleet: Pick<Container, "id" | "routeId" | "online" | "progress" | "customer" | "driver" | "plate" | "profileId" | "setpointC" | "scenario">[]): Journey[] {
  const out: Journey[] = [];
  const used = new Set<string>();
  const form = (c: (typeof fleet)[number], n: number): OnboardInput => ({
    containerId: c.id, plate: c.plate, sealNo: `SEAL-${2000 + n}`, profileId: c.profileId, setpointC: c.setpointC, customer: c.customer, driverName: c.driver,
    driverPhone: `05${String(10000000 + ((n * 7919) % 89999999)).padStart(8, "0").slice(0, 8)}`,
  });
  const build = (c: (typeof fleet)[number], n: number, departMs: number) => {
    const route = ROUTES.find((r) => r.id === c.routeId)!;
    const input: PlanInput = { originId: route.from, destinationId: route.to, viaIds: [], departAt: formatLocal(departMs), speedKmh: 80, reefer: false, customs: false };
    return makeJourney(`J-${1001 + n}`, form(c, n), input, "fleet");
  };
  ROUTES.forEach((r, k) => {
    const c = fleet.find((x) => x.routeId === r.id && x.online && !used.has(x.id));
    if (!c) return;
    used.add(c.id);
    const probe = build(c, out.length, SNAPSHOT_MS);
    const driveMs = (probe.plan.arriveMs - probe.plan.departMs) * c.progress;
    let j = build(c, out.length, round5(SNAPSHOT_MS - driveMs));
    const delay = [4, 0, 42, 7, 10, 55, 3, 6][k] ?? 0;
    j = advanceTo(j, c.progress, delay);
    out.push(j);
  });
  const rest = fleet.filter((x) => x.online && !used.has(x.id));
  [0, 1].forEach((k) => {
    const c = rest[k * 40];
    if (!c) return;
    used.add(c.id);
    out.push(build(c, out.length, Date.UTC(2026, 9, 6, k === 0 ? 6 : 14, 0)));
  });
  const done = rest[90];
  if (done) {
    let j = build(done, out.length, Date.UTC(2026, 9, 4, 5, 0));
    while (nextMilestone(j)) j = completeNext(j, 0);
    out.push(j);
    used.add(done.id);
  }
  // Every other container in the fleet is on the road, so each one gets the journey it is travelling now.
  fleet.forEach((c, i) => {
    if (used.has(c.id)) return;
    used.add(c.id);
    const n = out.length;
    const probe = build(c, n, SNAPSHOT_MS);
    const driveMs = (probe.plan.arriveMs - probe.plan.departMs) * c.progress;
    const delay = !c.online ? 60 : i % 17 === 5 ? 35 + (i % 25) : (i % 7) * 2;
    out.push(advanceTo(build(c, n, round5(SNAPSHOT_MS - driveMs)), c.progress, delay));
  });
  return out;
}
