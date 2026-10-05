import type { Alert, AlertType, Container, Persona } from "./types";
import { currentDelayMin, etaMs, journeyStatus, type Journey } from "./journey";
import { PROFILES } from "./profiles";
import { itsmStats, ticketView, type ItsmStats, type TicketRecord } from "./itsm";
import { buildCases, caseStats, deviceIssues, WO_STAGES, type CaseStats, type DeviceIssue, type WorkOrder } from "./cases";
import { seedRegistry, type Registry } from "./partners";
import { buildPeople, type People } from "./people";

/**
 * Persona-aware analytics and reports.
 * Every function takes the data the signed-in persona may see. `scopeOf` is the single place that decides
 * what that is: a customer sees only its own containers, everyone else sees the whole fleet.
 */

export const QUALITY_TYPES: AlertType[] = ["temperature_critical", "reefer_setpoint", "health_forecast", "gas_high"];
export const SECURITY_TYPES: AlertType[] = ["door_in_motion", "unscheduled_stop", "route_deviation"];

export function scopeOf(persona: Persona, fleet: Container[], customerName: string): Container[] {
  return persona === "customer" ? fleet.filter((c) => c.customer === customerName) : fleet;
}

export function alertsIn(alerts: Alert[], scope: Container[]): Alert[] {
  const ids = new Set(scope.map((c) => c.id));
  return alerts.filter((a) => ids.has(a.containerId));
}

export function journeysIn(journeys: Journey[], scope: Container[]): Journey[] {
  const ids = new Set(scope.map((c) => c.id));
  return journeys.filter((j) => ids.has(j.containerId));
}

export interface Slice { key: string; n: number }

export function countBy<T>(items: T[], key: (t: T) => string): Slice[] {
  const m = new Map<string, number>();
  for (const x of items) { const k = key(x); m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].map(([k, n]) => ({ key: k, n })).sort((a, b) => b.n - a.n || (a.key < b.key ? -1 : 1));
}

export type KpiUnit = "count" | "pct" | "score" | "min";
export type Tone = "good" | "warn" | "bad" | "neutral";
export interface Kpi { id: string; value: number; unit: KpiUnit; tone: Tone }

export type WidgetId =
  | "status_mix" | "delay_bands" | "corridor_load" | "alert_types" | "sla"
  | "cargo_health" | "temp_compliance" | "health_bands"
  | "security_types" | "corridor_security" | "lock_state"
  | "eta_buckets" | "cargo_mix"
  | "partner_league" | "partner_share" | "driver_risk" | "driver_events" | "licence_expiry" | "driver_top_risk" | "mro_board" | "device_health";

/** Widgets in display order for each persona. */
export const WIDGETS: Record<Persona, WidgetId[]> = {
  operator: ["status_mix", "delay_bands", "corridor_load", "alert_types", "sla", "partner_league", "driver_risk", "licence_expiry", "mro_board", "device_health"],
  quality: ["temp_compliance", "cargo_health", "health_bands", "alert_types", "partner_league"],
  security: ["security_types", "lock_state", "corridor_security", "sla", "driver_risk", "driver_events", "driver_top_risk"],
  customer: ["eta_buckets", "status_mix", "cargo_mix", "alert_types", "partner_share"],
};

export const DELAY_BANDS = ["on_time", "d6_30", "d31_60", "d60_plus"] as const;
export type DelayBand = (typeof DELAY_BANDS)[number];
export function delayBand(min: number): DelayBand {
  return min <= 5 ? "on_time" : min <= 30 ? "d6_30" : min <= 60 ? "d31_60" : "d60_plus";
}

export const ETA_BUCKETS = ["delivered", "today", "tomorrow", "later"] as const;
export type EtaBucket = (typeof ETA_BUCKETS)[number];

const DAY = 86400000;
/** Day bucket of a journey's estimated arrival, measured from the calendar day of `nowMs` in UTC+3. */
export function etaBucket(j: Journey, nowMs: number): EtaBucket {
  if (journeyStatus(j) === "completed") return "delivered";
  const day = (ms: number) => Math.floor((ms + 3 * 3600000) / DAY);
  const d = day(etaMs(j)) - day(nowMs);
  return d <= 0 ? "today" : d === 1 ? "tomorrow" : "later";
}

export interface Analytics {
  kpis: Kpi[];
  widgets: WidgetId[];
  statusMix: Slice[];
  alertTypes: Slice[];
  delayBands: Slice[];
  corridors: { key: string; n: number; delayed: number }[];
  corridorSecurity: Slice[];
  cargoHealth: { id: string; n: number; health: number }[];
  tempCompliance: { id: string; n: number; inBand: number; pct: number }[];
  healthBands: number[];
  securityTypes: Slice[];
  lockState: Slice[];
  etaBuckets: Slice[];
  cargoMix: Slice[];
  itsm: ItsmStats;
  /** Cases: one per container, however many alarms it raised. */
  cases: CaseStats;
  people: People;
  mro: { stages: { key: string; n: number }[]; preventive: number; reactive: number };
  devices: { total: number; byReason: { key: string; n: number }[]; issues: DeviceIssue[] };
  empty: boolean;
}

const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((100 * a) / b));
const avg = (xs: number[]) => (xs.length === 0 ? 0 : Math.round(xs.reduce((s, x) => s + x, 0) / xs.length));

function inBand(c: Container): boolean {
  const p = PROFILES.find((q) => q.id === c.profileId);
  return !!p && c.tempC >= p.tMin && c.tempC <= p.tMax;
}

/** Everything the Analytics page and the dashboard strip draw, for one persona and one scope. */
export function analyticsFor(
  persona: Persona, scope: Container[], alerts: Alert[], journeys: Journey[], tickets: Record<string, TicketRecord>, nowMs: number,
  reg: Registry = seedRegistry(), workOrders: WorkOrder[] = [],
): Analytics {
  const open = alerts.filter((a) => a.state === "open");
  const active = journeys.filter((j) => { const s = journeyStatus(j); return s === "in_transit" || s === "delayed"; });
  const delayed = active.filter((j) => journeyStatus(j) === "delayed");
  const byId = new Map(scope.map((c) => [c.id, c]));
  const typeCount = (types: AlertType[]) => open.filter((a) => types.includes(a.type)).length;
  const reefers = scope.filter((c) => c.reefer);
  const inBandReefers = reefers.filter(inBand).length;
  const doorOpen = scope.filter((c) => c.door === "open").length;
  const lockBreach = scope.filter((c) => c.lock === "unlocked" || c.lock === "cut").length;
  const done = journeys.filter((j) => journeyStatus(j) === "completed").length;
  const onTimePct = active.length === 0 ? 100 : pct(active.length - delayed.length, active.length);
  const health = avg(scope.map((c) => c.healthScore));
  const critical = open.filter((a) => a.severity === "critical").length;
  const profileOf = (id: string) => byId.get(id)?.profileId ?? "dry";
  const cases = caseStats(buildCases({ alerts, profileOf, tickets, workOrders }));
  const people = buildPeople(reg, scope, alerts, journeys);
  const scoped = new Set(scope.map((c) => c.id));
  const wos = workOrders.filter((w) => scoped.has(w.containerId));
  const issues = deviceIssues(scope);
  const oobAvg = (cs: Container[]) => avg(cs.map((c) => c.outOfBandMin));
  const oobReefer = oobAvg(reefers);
  const carrier: Kpi = { id: "x_carrier", value: people.carrierScore, unit: "score", tone: people.carrierScore >= 80 ? "good" : people.carrierScore >= 65 ? "warn" : "bad" };
  const driverK: Kpi = { id: "x_driver", value: people.driverScore, unit: "score", tone: people.driverScore >= 80 ? "good" : people.driverScore >= 65 ? "warn" : "bad" };

  const kpis: Kpi[] = persona === "quality" ? [
    { id: "q_oob", value: oobReefer, unit: "min", tone: oobReefer <= 15 ? "good" : oobReefer <= 60 ? "warn" : "bad" },
    { id: "q_in_band", value: reefers.length ? pct(inBandReefers, reefers.length) : 100, unit: "pct", tone: pct(inBandReefers, reefers.length) >= 95 || reefers.length === 0 ? "good" : "warn" },
    { id: "q_health", value: health, unit: "score", tone: health >= 80 ? "good" : health >= 60 ? "warn" : "bad" },
    { id: "q_excursions", value: typeCount(["temperature_critical", "reefer_setpoint"]), unit: "count", tone: typeCount(["temperature_critical", "reefer_setpoint"]) === 0 ? "good" : "bad" },
    { id: "q_forecast", value: typeCount(["health_forecast", "gas_high"]), unit: "count", tone: typeCount(["health_forecast", "gas_high"]) === 0 ? "good" : "warn" },
    carrier, driverK,
  ] : persona === "security" ? [
    { id: "s_door", value: doorOpen, unit: "count", tone: doorOpen === 0 ? "good" : "bad" },
    { id: "s_lock", value: lockBreach, unit: "count", tone: lockBreach === 0 ? "good" : "bad" },
    { id: "s_deviation", value: typeCount(["route_deviation"]), unit: "count", tone: typeCount(["route_deviation"]) === 0 ? "good" : "warn" },
    { id: "s_stops", value: typeCount(["unscheduled_stop"]), unit: "count", tone: typeCount(["unscheduled_stop"]) === 0 ? "good" : "warn" },
    carrier, driverK,
  ] : persona === "customer" ? [
    { id: "c_total", value: scope.length, unit: "count", tone: "neutral" },
    { id: "c_transit", value: active.length, unit: "count", tone: "neutral" },
    { id: "c_delayed", value: delayed.length, unit: "count", tone: delayed.length === 0 ? "good" : "warn" },
    { id: "c_delivered", value: done, unit: "count", tone: "good" },
    carrier, driverK,
  ] : [
    { id: "o_unowned", value: cases.oldestUnownedMin, unit: "min", tone: cases.oldestUnownedMin === 0 ? "good" : cases.oldestUnownedMin <= 60 ? "warn" : "bad" },
    { id: "o_transit", value: active.length, unit: "count", tone: "neutral" },
    { id: "o_ontime", value: onTimePct, unit: "pct", tone: onTimePct >= 90 ? "good" : onTimePct >= 75 ? "warn" : "bad" },
    { id: "o_delayed", value: delayed.length, unit: "count", tone: delayed.length === 0 ? "good" : "warn" },
    { id: "o_alarms", value: critical, unit: "count", tone: critical === 0 ? "good" : "bad" },
    carrier, driverK,
  ];

  const corridorMap = new Map<string, { n: number; delayed: number }>();
  for (const c of scope) { const k = `${c.origin} → ${c.destination}`; corridorMap.set(k, corridorMap.get(k) ?? { n: 0, delayed: 0 }); (corridorMap.get(k) as { n: number }).n++; }
  for (const j of delayed) { const c = byId.get(j.containerId); if (c) { const e = corridorMap.get(`${c.origin} → ${c.destination}`); if (e) e.delayed++; } }
  const corridors = [...corridorMap.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.n - a.n || (a.key < b.key ? -1 : 1)).slice(0, 8);

  const secOpen = open.filter((a) => SECURITY_TYPES.includes(a.type));
  const corridorSecurity = countBy(secOpen, (a) => { const c = byId.get(a.containerId); return c ? `${c.origin} → ${c.destination}` : "?"; }).slice(0, 8);

  const cargoHealth = PROFILES.map((p) => { const xs = scope.filter((c) => c.profileId === p.id); return { id: p.id, n: xs.length, health: avg(xs.map((c) => c.healthScore)) }; }).filter((r) => r.n > 0).sort((a, b) => a.health - b.health);
  const tempCompliance = PROFILES.filter((p) => p.reefer).map((p) => { const xs = scope.filter((c) => c.profileId === p.id); const ok = xs.filter(inBand).length; return { id: p.id, n: xs.length, inBand: ok, pct: pct(ok, xs.length) }; }).filter((r) => r.n > 0);
  const healthBands = [0, 0, 0, 0, 0];
  for (const c of scope) healthBands[Math.min(4, Math.floor(c.healthScore / 20))]++;

  const views = open.map((a) => ticketView(a, byId.get(a.containerId)?.profileId ?? "dry", tickets[a.id]));
  const visibleTypes = persona === "quality" ? QUALITY_TYPES : persona === "security" ? SECURITY_TYPES : null;
  const alertTypes = countBy(open.filter((a) => !visibleTypes || visibleTypes.includes(a.type)), (a) => a.type);

  return {
    kpis,
    widgets: WIDGETS[persona],
    statusMix: (["normal", "warning", "critical"] as const).map((s) => ({ key: s, n: scope.filter((c) => c.status === s).length })),
    alertTypes,
    delayBands: DELAY_BANDS.map((b) => ({ key: b, n: active.filter((j) => delayBand(Math.max(0, currentDelayMin(j))) === b).length })),
    corridors,
    corridorSecurity,
    cargoHealth,
    tempCompliance,
    healthBands,
    securityTypes: SECURITY_TYPES.map((k) => ({ key: k, n: typeCount([k]) })),
    lockState: [
      { key: "locked", n: scope.filter((c) => c.lock === "locked").length },
      { key: "unlocked", n: scope.filter((c) => c.lock === "unlocked").length },
      { key: "cut", n: scope.filter((c) => c.lock === "cut").length },
      { key: "none", n: scope.filter((c) => c.lock === "none").length },
    ],
    etaBuckets: ETA_BUCKETS.map((b) => ({ key: b, n: journeys.filter((j) => journeyStatus(j) !== "cancelled" && etaBucket(j, nowMs) === b).length })),
    cargoMix: countBy(scope, (c) => c.profileId),
    itsm: itsmStats(views),
    cases,
    people,
    mro: { stages: WO_STAGES.map((k, i) => ({ key: k, n: wos.filter((w) => w.stage === i).length })), preventive: wos.filter((w) => w.kind === "preventive").length, reactive: wos.filter((w) => w.kind === "reactive").length },
    devices: { total: issues.length, byReason: (["tracker_offline", "tracker_battery", "tracker_signal"] as const).map((k) => ({ key: k, n: issues.filter((i) => i.reason === k).length })), issues: issues.slice(0, 8) },
    empty: scope.length === 0,
  };
}

/* ---------- Reports ---------- */

export type ReportId = "daily_ops" | "journey_otp" | "cold_chain" | "health_watch" | "security_incidents" | "sla_perf" | "shipment_status" | "partner_scorecard" | "driver_scorecard";

export const REPORTS: Record<Persona, ReportId[]> = {
  operator: ["daily_ops", "journey_otp", "cold_chain", "sla_perf", "partner_scorecard", "driver_scorecard"],
  quality: ["cold_chain", "health_watch", "partner_scorecard"],
  security: ["security_incidents", "sla_perf", "driver_scorecard"],
  customer: ["shipment_status", "journey_otp", "partner_scorecard"],
};

export type ColKind = "text" | "num" | "status" | "alert" | "cargo" | "jstatus" | "pct" | "min" | "sev" | "risk";
export interface Col { key: string; kind: ColKind }
export type Cell = string | number;
export interface Report { id: ReportId; cols: Col[]; rows: Cell[][]; totals: Cell[] | null }

export interface ReportCtx {
  scope: Container[];
  alerts: Alert[];
  journeys: Journey[];
  tickets: Record<string, TicketRecord>;
  nowMs: number;
  /** Partners and drivers, with any changes made in the app. Defaults to the seeded registry. */
  registry?: Registry;
}

const route = (c: Container) => `${c.origin} → ${c.destination}`;
const sum = (rows: Cell[][], i: number) => rows.reduce((s, r) => s + (r[i] as number), 0);

export function buildReport(id: ReportId, x: ReportCtx): Report {
  const byId = new Map(x.scope.map((c) => [c.id, c]));
  const open = x.alerts.filter((a) => a.state === "open");
  if (id === "daily_ops") {
    const cols: Col[] = [{ key: "route", kind: "text" }, { key: "containers", kind: "num" }, { key: "in_transit", kind: "num" }, { key: "delayed", kind: "num" }, { key: "avg_delay", kind: "min" }, { key: "open_alerts", kind: "num" }];
    const rows: Cell[][] = [];
    const keys = [...new Set(x.scope.map(route))].sort();
    for (const k of keys) {
      const cs = x.scope.filter((c) => route(c) === k); const ids = new Set(cs.map((c) => c.id));
      const js = x.journeys.filter((j) => ids.has(j.containerId));
      const act = js.filter((j) => { const s = journeyStatus(j); return s === "in_transit" || s === "delayed"; });
      const dl = act.filter((j) => journeyStatus(j) === "delayed");
      rows.push([k, cs.length, act.length, dl.length, avg(act.map((j) => Math.max(0, currentDelayMin(j)))), open.filter((a) => ids.has(a.containerId)).length]);
    }
    rows.sort((a, b) => (b[1] as number) - (a[1] as number) || (a[0] < b[0] ? -1 : 1));
    return { id, cols, rows, totals: ["", sum(rows, 1), sum(rows, 2), sum(rows, 3), "", sum(rows, 5)].map((v, i) => (i === 4 ? "" : v)) };
  }
  if (id === "journey_otp") {
    const cols: Col[] = [{ key: "journey", kind: "text" }, { key: "container", kind: "text" }, { key: "route", kind: "text" }, { key: "status", kind: "jstatus" }, { key: "delay", kind: "min" }, { key: "eta", kind: "text" }];
    const rows: Cell[][] = x.journeys.filter((j) => journeyStatus(j) !== "cancelled").map((j) => {
      const c = byId.get(j.containerId);
      return [j.id, j.containerId, c ? route(c) : "", journeyStatus(j), Math.max(0, currentDelayMin(j)), new Date(etaMs(j) + 3 * 3600000).toISOString().slice(0, 16).replace("T", " ")];
    });
    rows.sort((a, b) => (b[4] as number) - (a[4] as number) || (a[0] < b[0] ? -1 : 1));
    return { id, cols, rows, totals: null };
  }
  if (id === "cold_chain") {
    const cols: Col[] = [{ key: "cargo", kind: "cargo" }, { key: "containers", kind: "num" }, { key: "in_band", kind: "num" }, { key: "compliance", kind: "pct" }, { key: "avg_health", kind: "num" }, { key: "excursions", kind: "num" }];
    const rows: Cell[][] = PROFILES.filter((p) => p.reefer).map((p) => {
      const cs = x.scope.filter((c) => c.profileId === p.id); const ids = new Set(cs.map((c) => c.id)); const ok = cs.filter(inBand).length;
      return [p.id, cs.length, ok, pct(ok, cs.length), avg(cs.map((c) => c.healthScore)), open.filter((a) => ids.has(a.containerId) && (a.type === "temperature_critical" || a.type === "reefer_setpoint")).length];
    }).filter((r) => (r[1] as number) > 0);
    const n = sum(rows, 1), ok = sum(rows, 2);
    return { id, cols, rows, totals: ["", n, ok, pct(ok, n), "", sum(rows, 5)] };
  }
  if (id === "health_watch") {
    const cols: Col[] = [{ key: "container", kind: "text" }, { key: "cargo", kind: "cargo" }, { key: "route", kind: "text" }, { key: "temp", kind: "num" }, { key: "health", kind: "num" }, { key: "status", kind: "status" }];
    const rows: Cell[][] = [...x.scope].sort((a, b) => a.healthScore - b.healthScore || (a.id < b.id ? -1 : 1)).slice(0, 50).map((c) => [c.id, c.profileId, route(c), c.tempC, Math.round(c.healthScore), c.status]);
    return { id, cols, rows, totals: null };
  }
  if (id === "security_incidents") {
    const cols: Col[] = [{ key: "container", kind: "text" }, { key: "incident", kind: "alert" }, { key: "severity", kind: "sev" }, { key: "age", kind: "min" }, { key: "route", kind: "text" }, { key: "customer", kind: "text" }];
    const rows: Cell[][] = open.filter((a) => SECURITY_TYPES.includes(a.type)).sort((a, b) => (a.severity === b.severity ? a.minutesAgo - b.minutesAgo : a.severity === "critical" ? -1 : 1)).map((a) => {
      const c = byId.get(a.containerId);
      return [a.containerId, a.type, a.severity, a.minutesAgo, c ? route(c) : "", c?.customer ?? ""];
    });
    return { id, cols, rows, totals: null };
  }
  if (id === "sla_perf") {
    const cols: Col[] = [{ key: "priority", kind: "text" }, { key: "active", kind: "num" }, { key: "breached", kind: "num" }, { key: "at_risk", kind: "num" }, { key: "compliance", kind: "pct" }];
    const views = open.map((a) => ticketView(a, byId.get(a.containerId)?.profileId ?? "dry", x.tickets[a.id]));
    const rows: Cell[][] = ([1, 2, 3, 4] as const).map((p) => {
      const vs = views.filter((v) => v.cls.priority === p);
      const br = vs.filter((v) => v.sla.worst === "breached").length;
      const ar = vs.filter((v) => v.sla.worst === "at_risk").length;
      return [`P${p}`, vs.length, br, ar, pct(vs.length - br, vs.length)];
    });
    const n = sum(rows, 1), br = sum(rows, 2);
    return { id, cols, rows, totals: ["", n, br, sum(rows, 3), pct(n - br, n)] };
  }
  if (id === "partner_scorecard") {
    const cols: Col[] = [{ key: "partner", kind: "text" }, { key: "grade", kind: "text" }, { key: "score", kind: "num" }, { key: "containers", kind: "num" }, { key: "on_time", kind: "pct" }, { key: "compliance", kind: "text" }, { key: "alerts_100", kind: "num" }, { key: "safety", kind: "num" }, { key: "expired", kind: "num" }];
    const pe = buildPeople(x.registry ?? seedRegistry(), x.scope, x.alerts, x.journeys);
    const rows: Cell[][] = pe.partners.map((p) => [p.name, p.grade, p.score, p.containers, p.otp, p.cold === null ? "–" : `${p.cold}%`, p.alertsPer100, p.safety, p.expiredLicences]);
    return { id, cols, rows, totals: null };
  }
  if (id === "driver_scorecard") {
    const cols: Col[] = [{ key: "driver", kind: "text" }, { key: "partner", kind: "text" }, { key: "containers", kind: "num" }, { key: "events", kind: "num" }, { key: "score", kind: "num" }, { key: "risk", kind: "risk" }, { key: "licence_days", kind: "num" }];
    const reg = x.registry ?? seedRegistry();
    const pe = buildPeople(reg, x.scope, x.alerts, x.journeys);
    const pname = new Map(reg.partners.map((p) => [p.id, p.name]));
    const rows: Cell[][] = pe.drivers.slice(0, 100).map((d) => [d.name, pname.get(d.partnerId) ?? "", d.containers, d.events30, d.score, d.band, d.licenceDays]);
    return { id, cols, rows, totals: null };
  }
  const cols: Col[] = [{ key: "container", kind: "text" }, { key: "cargo", kind: "cargo" }, { key: "route", kind: "text" }, { key: "temp", kind: "num" }, { key: "status", kind: "status" }, { key: "eta", kind: "text" }];
  const jm = new Map(x.journeys.map((j) => [j.containerId, j]));
  const rows: Cell[][] = x.scope.map((c) => { const j = jm.get(c.id); return [c.id, c.profileId, route(c), c.tempC, c.status, j ? new Date(etaMs(j) + 3 * 3600000).toISOString().slice(0, 16).replace("T", " ") : ""]; });
  rows.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return { id, cols, rows, totals: null };
}

/** CSV with a byte order mark so Excel reads Arabic. Cells that start like a formula are neutralised. */
export function toCsv(header: string[], rows: Cell[][]): string {
  const esc = (v: Cell) => {
    let s = String(v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}
