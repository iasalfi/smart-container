import { classify, type Priority, type TicketRecord } from "./itsm";
import type { Journey } from "./journey";
import { journeyStatus } from "./journey";
import type { Alert, AlertType, Container } from "./types";

/**
 * Cases, work orders and the asset lifecycle.
 * An alarm tells you something happened. A case is the thing a person owns: one per container, however many
 * alarms that container has raised. A case that needs a repair turns into a work order, and the work order moves
 * across the maintenance board until the container is released back into service.
 */

export type CaseState = "open" | "acknowledged" | "in_mro" | "resolved";

export interface Case {
  id: string;
  containerId: string;
  alertIds: string[];
  /** The alarm that names the case, the most serious one the container has. */
  type: AlertType;
  /** Alarms folded into this case. */
  merged: number;
  priority: Priority;
  ageMin: number;
  state: CaseState;
  owner?: string;
  /** Needs a repair, so the case can open a work order. */
  mro: boolean;
  woId?: string;
}

/** Most serious first. This decides which alarm names a case that holds several. */
export const TYPE_RANK: AlertType[] = ["gas_high", "reefer_setpoint", "temperature_critical", "door_in_motion", "route_deviation", "unscheduled_stop", "health_forecast"];
export const MRO_TYPES: AlertType[] = ["reefer_setpoint", "temperature_critical", "gas_high"];

export function caseId(containerId: string): string { return `CS-${containerId.replace(/\D/g, "")}`; }

/* ------------------------------ work orders ------------------------------ */

export const WO_STAGES = ["triage", "diagnose", "repair", "test", "ready"] as const;
export type WoStage = (typeof WO_STAGES)[number];
export type WoKind = "reactive" | "preventive";
export type WoWhere = "next_stop" | "depot";
export type WoReason = AlertType | "tracker_battery" | "tracker_signal" | "tracker_offline" | "door_seal" | "compressor" | "sensor_recal";

export interface WorkOrder {
  id: string;
  containerId: string;
  reason: WoReason;
  params: Record<string, number | string>;
  where: WoWhere;
  /** Index into WO_STAGES. */
  stage: number;
  kind: WoKind;
  /** Minutes the order has been open at the demo clock. */
  openedMin: number;
  /** Case that raised it, when it came from an alarm. */
  caseId?: string;
  /** True for the orders that ship with the demo data. */
  example?: boolean;
}

export function nextWoId(existing: { id: string }[]): string {
  const max = existing.reduce((m, w) => Math.max(m, Number(w.id.replace(/\D/g, "")) || 0), 2000);
  return `WO-${max + 1}`;
}

export function advanceWo(w: WorkOrder): WorkOrder {
  return w.stage >= WO_STAGES.length - 1 ? w : { ...w, stage: w.stage + 1 };
}

/* ------------------------------ device health ------------------------------ */

export interface DeviceLimits { batteryPct: number; signal: number; offlineMin: number; weakSignalBatteryPct: number }
/** A tracker at or below these values needs a visit before it fails. A weak signal only counts while the battery is also running down. */
export const DEVICE_LIMITS: DeviceLimits = { batteryPct: 25, signal: 1, offlineMin: 25, weakSignalBatteryPct: 40 };

export interface DeviceIssue {
  containerId: string;
  reason: "tracker_battery" | "tracker_signal" | "tracker_offline";
  batteryPct: number;
  signal: number;
  lastSeenMin: number;
}

export function deviceIssues(fleet: Pick<Container, "id" | "online" | "batteryPct" | "signal" | "lastSeenMin">[], lim: DeviceLimits = DEVICE_LIMITS): DeviceIssue[] {
  const out: DeviceIssue[] = [];
  for (const c of fleet) {
    const reason = !c.online && c.lastSeenMin >= lim.offlineMin ? "tracker_offline" : c.batteryPct <= lim.batteryPct ? "tracker_battery" : c.online && c.signal <= lim.signal && c.batteryPct <= lim.weakSignalBatteryPct ? "tracker_signal" : null;
    if (reason) out.push({ containerId: c.id, reason, batteryPct: c.batteryPct, signal: c.signal, lastSeenMin: c.lastSeenMin });
  }
  const rank = { tracker_offline: 0, tracker_battery: 1, tracker_signal: 2 } as const;
  return out.sort((a, b) => rank[a.reason] - rank[b.reason] || a.batteryPct - b.batteryPct || (a.containerId < b.containerId ? -1 : 1));
}

export function deviceWorkOrder(i: DeviceIssue, id: string): WorkOrder {
  return { id, containerId: i.containerId, reason: i.reason, params: { pct: i.batteryPct, signal: i.signal, min: i.lastSeenMin }, where: "depot", stage: 0, kind: "preventive", openedMin: 5 };
}

export function caseWorkOrder(c: Case, id: string): WorkOrder {
  return { id, containerId: c.containerId, reason: c.type, params: {}, where: "next_stop", stage: 0, kind: "reactive", openedMin: 5, caseId: c.id };
}

/** Work orders that ship with the demo, so the board is not empty on the first visit. */
export function seedWorkOrders(fleet: Container[], alerting: Set<string>): WorkOrder[] {
  const issues = deviceIssues(fleet).filter((i) => !alerting.has(i.containerId));
  const out: WorkOrder[] = [];
  let n = 2023;
  const add = (w: Omit<WorkOrder, "id" | "example">) => out.push({ ...w, id: `WO-${n++}`, example: true });
  issues.slice(0, 2).forEach((i, k) => add({ ...deviceWorkOrder(i, ""), stage: k, openedMin: 300 + k * 600 }));
  const quiet = fleet.filter((c) => c.scenario === "none" && !alerting.has(c.id)).sort((a, b) => a.healthScore - b.healthScore || (a.id < b.id ? -1 : 1));
  const reasons: [WoReason, number][] = [["door_seal", 2], ["compressor", 3], ["sensor_recal", 4]];
  reasons.forEach(([reason, stage], k) => { const c = quiet[k]; if (c) add({ containerId: c.id, reason, params: {}, where: "depot", stage, kind: k === 2 ? "preventive" : "reactive", openedMin: 900 + k * 800 }); });
  return out;
}

/* ------------------------------ cases ------------------------------ */

export interface CaseInput {
  alerts: Alert[];
  profileOf: (containerId: string) => string;
  tickets: Record<string, TicketRecord>;
  workOrders: WorkOrder[];
}

const done = (a: Alert) => a.state === "resolved" || a.state === "closed";

/** One case per container that has alarms, most urgent first. */
export function buildCases(i: CaseInput): Case[] {
  const groups = new Map<string, Alert[]>();
  for (const a of i.alerts) groups.set(a.containerId, [...(groups.get(a.containerId) ?? []), a]);
  const woBy = new Map(i.workOrders.filter((w) => w.kind === "reactive" && w.caseId).map((w) => [w.caseId as string, w]));
  const out: Case[] = [];
  for (const [containerId, list] of groups) {
    const active = list.filter((a) => !done(a));
    const basis = active.length ? active : list;
    const type = [...basis].sort((a, b) => TYPE_RANK.indexOf(a.type) - TYPE_RANK.indexOf(b.type))[0].type;
    const prof = i.profileOf(containerId);
    const priority = Math.min(...basis.map((a) => classify(a, prof).priority)) as Priority;
    const owner = basis.map((a) => i.tickets[a.id]?.owner).find((o) => !!o);
    const id = caseId(containerId);
    const wo = woBy.get(id);
    const acked = basis.some((a) => a.state === "acknowledged" || a.state === "in_progress");
    const state: CaseState = active.length === 0 ? "resolved" : wo ? "in_mro" : acked || owner ? "acknowledged" : "open";
    out.push({ id, containerId, alertIds: list.map((a) => a.id), type, merged: list.length, priority, ageMin: Math.max(...basis.map((a) => a.minutesAgo)), state, owner, mro: basis.some((a) => MRO_TYPES.includes(a.type)), woId: wo?.id });
  }
  return out.sort((a, b) => a.priority - b.priority || b.ageMin - a.ageMin || (a.id < b.id ? -1 : 1));
}

export interface CaseStats { active: number; unowned: number; oldestUnownedMin: number; inMro: number; merged: number }

export function caseStats(cases: Case[]): CaseStats {
  const active = cases.filter((c) => c.state !== "resolved");
  const unowned = active.filter((c) => c.state === "open" && !c.owner);
  return { active: active.length, unowned: unowned.length, oldestUnownedMin: unowned.reduce((m, c) => Math.max(m, c.ageMin), 0), inMro: active.filter((c) => c.state === "in_mro").length, merged: cases.reduce((s, c) => s + c.merged, 0) };
}

/* ------------------------------ lifecycle ------------------------------ */

export const LIFECYCLE = ["booked", "loaded_sealed", "in_transit", "at_destination", "unloaded_inspected", "back_in_service"] as const;
export type LifecycleStage = (typeof LIFECYCLE)[number];
export type PostDelivery = "unloaded" | "back";

/** The stage an asset is at. Delay is a flag on top of a stage, not a stage of its own. */
export function lifecycleOf(j: Journey | undefined, post?: PostDelivery): { stage: LifecycleStage; delayed: boolean } | null {
  if (!j) return null;
  const s = journeyStatus(j);
  if (s === "cancelled") return null;
  if (s === "planned") return { stage: "booked", delayed: false };
  if (s === "dispatched") return { stage: "loaded_sealed", delayed: false };
  if (s === "in_transit" || s === "delayed") return { stage: "in_transit", delayed: s === "delayed" };
  return { stage: post === "back" ? "back_in_service" : post === "unloaded" ? "unloaded_inspected" : "at_destination", delayed: false };
}

/** The next post-delivery step an operator can record, or null when the asset is not delivered or already back. */
export function nextPostStep(stage: LifecycleStage): PostDelivery | null {
  return stage === "at_destination" ? "unloaded" : stage === "unloaded_inspected" ? "back" : null;
}
