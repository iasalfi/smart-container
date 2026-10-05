import type { Alert, AlertState } from "./types";

/**
 * IT service management (ITSM) rules for alerts.
 * Follows the ITIL incident model: priority comes from impact and urgency, each priority carries
 * response and resolution targets, work moves through a fixed lifecycle, and breached targets escalate
 * the ticket to a higher support tier. Recurring alerts are grouped as problem candidates.
 *
 * The demo clock is frozen at the data snapshot, so an alert's age is `minutesAgo` and a clock that is
 * stopped by an action stops at that age.
 */

export type Impact = 1 | 2 | 3;
export type Urgency = 1 | 2 | 3;
export type Priority = 1 | 2 | 3 | 4;
export type Tier = 1 | 2 | 3;
export type ResolutionCode = "fixed" | "cargo_moved" | "false_alarm" | "workaround";
export type SlaState = "running" | "at_risk" | "breached" | "met" | "met_late";

export const RESOLUTION_CODES: ResolutionCode[] = ["fixed", "cargo_moved", "false_alarm", "workaround"];

/** Cargo whose value or shelf life makes an excursion costly. */
const SENSITIVE_CARGO = ["pharma", "seafood", "dairy", "produce"];

/** Priority matrix, rows are impact (high, medium, low), columns are urgency (high, medium, low). */
export const PRIORITY_MATRIX: Priority[][] = [
  [1, 2, 3],
  [2, 3, 4],
  [3, 4, 4],
];

export function priorityOf(impact: Impact, urgency: Urgency): Priority {
  return PRIORITY_MATRIX[impact - 1][urgency - 1];
}

/** Response and resolution targets, in minutes since the alert was raised. */
export const SLA_TARGETS: Record<Priority, { respondMin: number; resolveMin: number }> = {
  1: { respondMin: 10, resolveMin: 120 },
  2: { respondMin: 30, resolveMin: 240 },
  3: { respondMin: 60, resolveMin: 480 },
  4: { respondMin: 120, resolveMin: 1440 },
};

/** A clock counts as at risk once this share of its target has been used. */
export const AT_RISK_SHARE = 0.75;

export function impactOf(a: Pick<Alert, "type" | "severity">, profileId: string): Impact {
  const sensitive = SENSITIVE_CARGO.includes(profileId);
  if (a.type === "gas_high") return 1;
  if (a.severity === "critical") return sensitive ? 1 : 2;
  return sensitive ? 2 : 3;
}

export function urgencyOf(a: Pick<Alert, "type" | "severity" | "minutesAgo">): Urgency {
  if (a.type === "gas_high") return 1;
  if (a.severity === "critical") return a.minutesAgo >= 30 ? 1 : 2;
  return a.minutesAgo >= 30 ? 2 : 3;
}

export interface Classification { impact: Impact; urgency: Urgency; priority: Priority }

export function classify(a: Pick<Alert, "type" | "severity" | "minutesAgo">, profileId: string): Classification {
  const impact = impactOf(a, profileId);
  const urgency = urgencyOf(a);
  return { impact, urgency, priority: priorityOf(impact, urgency) };
}

/** Allowed state changes. Closure needs a resolution first. */
export const TRANSITIONS: Record<AlertState, AlertState[]> = {
  open: ["acknowledged"],
  acknowledged: ["in_progress", "resolved"],
  in_progress: ["resolved"],
  resolved: ["closed", "in_progress"],
  closed: [],
};

export const STATE_ORDER: AlertState[] = ["open", "acknowledged", "in_progress", "resolved", "closed"];

export function canMove(from: AlertState, to: AlertState): boolean {
  return TRANSITIONS[from].includes(to);
}

/** One line of a ticket's history. `text` is a code for state, assign, escalate, major and problem entries and free text for notes. */
export interface LogEntry { n: number; at: number; kind: "state" | "assign" | "escalate" | "major" | "note" | "problem"; text: string; who: string }

/** Everything the service desk adds to an alert. */
export interface TicketRecord {
  owner?: string;
  manualTier?: Tier;
  major?: boolean;
  ackAge?: number;
  resolveAge?: number;
  code?: ResolutionCode;
  problemId?: string;
  log: LogEntry[];
}

export const NEW_RECORD: TicketRecord = { log: [] };

export interface Clock { targetMin: number; elapsedMin: number; remainingMin: number; state: SlaState }

function runClock(target: number, elapsed: number): Clock {
  const state: SlaState = elapsed >= target ? "breached" : elapsed >= target * AT_RISK_SHARE ? "at_risk" : "running";
  return { targetMin: target, elapsedMin: elapsed, remainingMin: Math.max(0, target - elapsed), state };
}
function stoppedClock(target: number, at: number): Clock {
  return { targetMin: target, elapsedMin: at, remainingMin: Math.max(0, target - at), state: at <= target ? "met" : "met_late" };
}

export interface Sla { response: Clock; resolution: Clock; worst: SlaState }

/** Response stops at acknowledge, resolution stops at resolve. A clock that is still running can breach. */
export function slaFor(age: number, priority: Priority, rec: TicketRecord | undefined, state: AlertState): Sla {
  const tg = SLA_TARGETS[priority];
  const acked = state !== "open";
  const done = state === "resolved" || state === "closed";
  const response = acked ? stoppedClock(tg.respondMin, rec?.ackAge ?? age) : runClock(tg.respondMin, age);
  const resolution = done ? stoppedClock(tg.resolveMin, rec?.resolveAge ?? age) : runClock(tg.resolveMin, age);
  const rank: Record<SlaState, number> = { breached: 4, at_risk: 3, met_late: 2, running: 1, met: 0 };
  const worst = rank[response.state] >= rank[resolution.state] ? response.state : resolution.state;
  return { response, resolution, worst };
}

/** True when a clock that is still running has breached or is close to it. */
export function slaAtRisk(s: Sla): boolean {
  return s.worst === "breached" || s.worst === "at_risk";
}
export function slaBreached(s: Sla): boolean {
  return s.response.state === "breached" || s.resolution.state === "breached";
}

/** Support tier: L1 service desk, L2 specialist, L3 duty manager. Breaches and major incidents lift the tier. */
export function tierFor(priority: Priority, sla: Sla, rec: TicketRecord | undefined): Tier {
  let tier: Tier = 1;
  if (priority === 1 || sla.response.state === "breached") tier = 2;
  if (sla.resolution.state === "breached" || rec?.major) tier = 3;
  if (rec?.manualTier && rec.manualTier > tier) tier = rec.manualTier;
  return tier;
}

export const ROSTER: { id: string; name: string; tier: Tier }[] = [
  { id: "me", name: "You (service desk)", tier: 1 },
  { id: "l1-a", name: "Huda Al-Qahtani", tier: 1 },
  { id: "l1-b", name: "Omar Al-Zahrani", tier: 1 },
  { id: "l2-a", name: "Sultan Al-Dossari", tier: 2 },
  { id: "l2-b", name: "Reem Al-Ghamdi", tier: 2 },
  { id: "l3-a", name: "Faisal Al-Mutairi", tier: 3 },
];

export interface TicketView {
  alert: Alert;
  state: AlertState;
  rec: TicketRecord;
  cls: Classification;
  sla: Sla;
  tier: Tier;
  /** Warnings are events, alarms are critical alerts that need a person now. */
  kind: "alarm" | "event";
}

export function ticketView(alert: Alert, profileId: string, rec: TicketRecord | undefined): TicketView {
  const cls = classify(alert, profileId);
  const state = alert.state;
  const sla = slaFor(alert.minutesAgo, cls.priority, rec, state);
  return { alert, state, rec: rec ?? NEW_RECORD, cls, sla, tier: tierFor(cls.priority, sla, rec), kind: alert.severity === "critical" ? "alarm" : "event" };
}

export function isOpenWork(v: TicketView): boolean {
  return v.state !== "closed" && v.state !== "resolved";
}

export interface ItsmStats {
  active: number;
  breached: number;
  atRisk: number;
  unassigned: number;
  major: number;
  /** Mean minutes to acknowledge, over tickets acknowledged so far. Null when there are none. */
  mtta: number | null;
  mttr: number | null;
  byPriority: Record<Priority, number>;
  byState: Record<AlertState, number>;
  byTier: Record<Tier, number>;
  matrix: number[][];
}

function mean(xs: number[]): number | null {
  return xs.length === 0 ? null : Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);
}

export function itsmStats(views: TicketView[]): ItsmStats {
  const byState = Object.fromEntries(STATE_ORDER.map((s) => [s, 0])) as Record<AlertState, number>;
  const byPriority: Record<Priority, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const byTier: Record<Tier, number> = { 1: 0, 2: 0, 3: 0 };
  const matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const acks: number[] = [], res: number[] = [];
  let active = 0, breached = 0, atRisk = 0, unassigned = 0, major = 0;
  for (const v of views) {
    byState[v.state]++;
    if (v.rec.ackAge !== undefined) acks.push(v.rec.ackAge);
    if (v.rec.resolveAge !== undefined) res.push(v.rec.resolveAge);
    if (!isOpenWork(v)) continue;
    active++;
    byPriority[v.cls.priority]++;
    byTier[v.tier]++;
    matrix[v.cls.impact - 1][v.cls.urgency - 1]++;
    if (slaBreached(v.sla)) breached++;
    else if (v.sla.worst === "at_risk") atRisk++;
    if (!v.rec.owner) unassigned++;
    if (v.rec.major) major++;
  }
  return { active, breached, atRisk, unassigned, major, mtta: mean(acks), mttr: mean(res), byPriority, byState, byTier, matrix };
}

export interface ProblemCandidate { key: string; type: Alert["type"]; routeId: string; count: number; alertIds: string[] }

/** Recurring alerts of one type on one corridor point to a shared cause, so they become a problem candidate. */
export const PROBLEM_MIN_ALERTS = 4;

export function problemCandidates(alerts: Alert[], routeOf: (containerId: string) => string | undefined): ProblemCandidate[] {
  const groups = new Map<string, ProblemCandidate>();
  for (const a of alerts) {
    if (a.state === "closed") continue;
    const routeId = routeOf(a.containerId);
    if (!routeId) continue;
    const key = `${a.type}|${routeId}`;
    const g = groups.get(key) ?? { key, type: a.type, routeId, count: 0, alertIds: [] };
    g.count++;
    g.alertIds.push(a.id);
    groups.set(key, g);
  }
  return [...groups.values()].filter((g) => g.count >= PROBLEM_MIN_ALERTS).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export interface Problem { id: string; key: string; type: Alert["type"]; routeId: string; cause: string; alertIds: string[]; status: "investigating" | "known_error" | "resolved" }

export const ROOT_CAUSES = ["reefer_fault", "driver_practice", "route_congestion", "sensor_fault", "process_gap"] as const;
export type RootCause = (typeof ROOT_CAUSES)[number];

export function nextProblemId(existing: Problem[]): string {
  const max = existing.reduce((m, p) => Math.max(m, Number(p.id.replace(/\D/g, "")) || 0), 0);
  return `PRB-${String(max + 1).padStart(3, "0")}`;
}

/** Sort for work queues: priority first, then the oldest alert. Neither changes when a ticket moves state, so rows stay put while people work. */
export function queueOrder(a: TicketView, b: TicketView): number {
  if (a.cls.priority !== b.cls.priority) return a.cls.priority - b.cls.priority;
  if (a.alert.minutesAgo !== b.alert.minutesAgo) return b.alert.minutesAgo - a.alert.minutesAgo;
  return a.alert.id.localeCompare(b.alert.id);
}

export function formatMinutes(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}
