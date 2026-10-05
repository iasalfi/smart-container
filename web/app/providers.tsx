"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translate, type Key } from "@/lib/i18n";
import { DEFAULT_THRESHOLDS, type Thresholds } from "@/lib/alerts";
import { ApiError, fetchAlerts, fetchFleet } from "@/lib/api";
import { canMove, nextProblemId, type LogEntry, type Problem, type ProblemCandidate, type ResolutionCode, type TicketRecord } from "@/lib/itsm";
import { seedJourneys, type Journey } from "@/lib/journey";
import type { Alert, AlertState, Container, Lang, LockState, Persona } from "@/lib/types";
import { nextId, seedRegistry, type Driver, type DriverEvent, type Partner, type Registry } from "@/lib/partners";
import { DEVICE_LIMITS, advanceWo, buildCases, nextWoId, seedWorkOrders, caseWorkOrder, deviceWorkOrder, type Case, type DeviceIssue, type DeviceLimits, type PostDelivery, type WorkOrder } from "@/lib/cases";

export const CUSTOMER_PERSONA_NAME = "Najd Fresh Foods";
const STORE = "scm-demo-v1";

export interface AuditEntry { id: string; action: "lock" | "unlock"; containerId: string; at: number }

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  persona: Persona;
  setPersona: (p: Persona) => void;
  t: (key: Key, params?: Record<string, string | number>) => string;
  thresholds: Thresholds;
  setThresholds: (t: Thresholds) => void;
  alerts: Alert[];
  /** All containers from the API, or null while loading. */
  fleet: Container[] | null;
  /** True once the first alerts response has arrived. */
  alertsReady: boolean;
  /** Set when the API could not be reached or answered with an error. */
  apiError: string | null;
  retry: () => void;
  /** Moves an alert along the ITSM lifecycle. Returns false when the step is not allowed. */
  transition: (id: string, to: AlertState, code?: ResolutionCode) => boolean;
  tickets: Record<string, TicketRecord>;
  assign: (id: string, owner: string | undefined) => void;
  escalate: (id: string, toTier: 2 | 3) => void;
  toggleMajor: (id: string) => void;
  addNote: (id: string, text: string) => void;
  /** Seeded fleet journeys first changed by the user, then the journeys the user planned. */
  journeys: Journey[];
  saveJourney: (j: Journey) => void;
  problems: Problem[];
  raiseProblem: (c: ProblemCandidate, cause: string) => void;
  updateProblem: (id: string, patch: Partial<Pick<Problem, "cause" | "status">>) => void;
  lockOverride: Record<string, LockState>;
  setLock: (containerId: string, lock: LockState, action: "lock" | "unlock") => void;
  audit: AuditEntry[];
  ready: boolean;
  /** Freight partners, drivers, logged driver events and operator driver assignments. */
  registry: Registry;
  savePartner: (p: Partner) => void;
  removePartner: (id: string) => void;
  saveDriver: (d: Driver) => void;
  removeDriver: (id: string) => void;
  logEvent: (e: Omit<DriverEvent, "id" | "source">) => void;
  assignDriver: (containerId: string, driverId: string) => void;
  /** One case per container, built from the alerts. */
  cases: Case[];
  takeCase: (c: Case) => void;
  resolveCase: (c: Case) => void;
  workOrders: WorkOrder[];
  openWorkOrder: (c: Case) => void;
  raiseDeviceOrder: (i: DeviceIssue) => void;
  advanceWorkOrder: (id: string) => void;
  releaseWorkOrder: (id: string) => void;
  released: number;
  deviceLimits: DeviceLimits;
  setDeviceLimits: (l: DeviceLimits) => void;
  postDelivery: Record<string, PostDelivery>;
  recordPost: (containerId: string, step: PostDelivery) => void;
}

const C = createContext<Ctx | null>(null);

interface Saved { lang?: Lang; persona?: Persona; thresholds?: Thresholds; alertStates?: Record<string, AlertState>; lockOverride?: Record<string, LockState>; audit?: AuditEntry[]; tickets?: Record<string, TicketRecord>; problems?: Problem[]; userJourneys?: Journey[]; journeyEdits?: Record<string, Journey>; registry?: Registry; workOrders?: WorkOrder[]; released?: number; deviceLimits?: DeviceLimits; postDelivery?: Record<string, PostDelivery> }

function load(): Saved {
  try { const raw = window.localStorage.getItem(STORE); return raw ? (JSON.parse(raw) as Saved) : {}; } catch { return {}; }
}

export function Providers({ children }: { children: ReactNode }) {
  const [lang, setLangS] = useState<Lang>("en");
  const [persona, setPersonaS] = useState<Persona>("operator");
  const [thresholds, setThresholdsS] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [alertStates, setAlertStates] = useState<Record<string, AlertState>>({});
  const [lockOverride, setLockOverride] = useState<Record<string, LockState>>({});
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [tickets, setTickets] = useState<Record<string, TicketRecord>>({});
  const [problems, setProblems] = useState<Problem[]>([]);
  const [userJourneys, setUserJourneys] = useState<Journey[]>([]);
  const [journeyEdits, setJourneyEdits] = useState<Record<string, Journey>>({});
  const [registry, setRegistry] = useState<Registry>(() => seedRegistry());
  const [workOrders, setWorkOrders] = useState<WorkOrder[] | null>(null);
  const [released, setReleased] = useState(0);
  const [deviceLimits, setDeviceLimitsS] = useState<DeviceLimits>(DEVICE_LIMITS);
  const [postDelivery, setPostDelivery] = useState<Record<string, PostDelivery>>({});
  const [ready, setReady] = useState(false);
  const [fleet, setFleet] = useState<Container[] | null>(null);
  const [rawAlerts, setRawAlerts] = useState<Alert[] | null>(null);
  const [fleetError, setFleetError] = useState<string | null>(null);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const s = load();
    if (s.lang === "en" || s.lang === "ar") setLangS(s.lang);
    if (s.persona) setPersonaS(s.persona);
    if (s.thresholds) setThresholdsS({ ...DEFAULT_THRESHOLDS, ...s.thresholds });
    if (s.alertStates) setAlertStates(s.alertStates);
    if (s.lockOverride) setLockOverride(s.lockOverride);
    if (s.audit) setAudit(s.audit);
    if (s.tickets) setTickets(s.tickets);
    if (s.problems) setProblems(s.problems);
    if (s.userJourneys) setUserJourneys(s.userJourneys);
    if (s.journeyEdits) setJourneyEdits(s.journeyEdits);
    if (s.registry) setRegistry(s.registry);
    if (s.workOrders) setWorkOrders(s.workOrders);
    if (typeof s.released === "number") setReleased(s.released);
    if (s.deviceLimits) setDeviceLimitsS({ ...DEVICE_LIMITS, ...s.deviceLimits });
    if (s.postDelivery) setPostDelivery(s.postDelivery);
    setReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(STORE, JSON.stringify({ lang, persona, thresholds, alertStates, lockOverride, audit, tickets, problems, userJourneys, journeyEdits, registry, workOrders, released, deviceLimits, postDelivery })); } catch { /* storage can be blocked */ }
  }, [ready, lang, persona, thresholds, alertStates, lockOverride, audit, tickets, problems, userJourneys, journeyEdits, registry, workOrders, released, deviceLimits, postDelivery]);

  const t = useCallback((key: Key, params?: Record<string, string | number>) => translate(lang, key, params), [lang]);
  useEffect(() => {
    let live = true;
    fetchFleet().then((r) => { if (live) { setFleet(r.containers); setFleetError(null); } }).catch((e: unknown) => { if (live) setFleetError(e instanceof ApiError ? e.message : "Cannot reach the API."); });
    return () => { live = false; };
  }, [attempt]);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    fetchAlerts(thresholds, DEFAULT_THRESHOLDS).then((r) => { if (live) { setRawAlerts(r.alerts); setAlertsError(null); } }).catch((e: unknown) => { if (live) setAlertsError(e instanceof ApiError ? e.message : "Cannot reach the API."); });
    return () => { live = false; };
  }, [ready, thresholds, attempt]);

  const seeds = useMemo(() => (fleet ? seedJourneys(fleet) : []), [fleet]);
  const journeys = useMemo(() => [...userJourneys, ...seeds.map((j) => journeyEdits[j.id] ?? j)], [userJourneys, seeds, journeyEdits]);
  const saveJourney = (j: Journey) => {
    if (j.source === "fleet") setJourneyEdits((m) => ({ ...m, [j.id]: j }));
    else setUserJourneys((list) => (list.some((x) => x.id === j.id) ? list.map((x) => (x.id === j.id ? j : x)) : [j, ...list]));
  };

  const alerts = useMemo(() => (rawAlerts ?? []).map((a) => ({ ...a, state: alertStates[a.id] ?? a.state })), [rawAlerts, alertStates]);

  // The work orders that ship with the demo are created once, when the fleet and the alerts have both arrived.
  useEffect(() => {
    if (!ready || workOrders !== null || !fleet || !rawAlerts) return;
    setWorkOrders(seedWorkOrders(fleet, new Set(rawAlerts.map((a) => a.containerId))));
  }, [ready, workOrders, fleet, rawAlerts]);
  const orders = useMemo(() => workOrders ?? [], [workOrders]);
  const profileById = useMemo(() => new Map((fleet ?? []).map((c) => [c.id, c.profileId])), [fleet]);
  const cases = useMemo(() => buildCases({ alerts, profileOf: (id) => profileById.get(id) ?? "dry", tickets, workOrders: orders }), [alerts, profileById, tickets, orders]);

  const logTo = (rec: TicketRecord | undefined, kind: LogEntry["kind"], text: string): TicketRecord => {
    const base: TicketRecord = rec ?? { log: [] };
    return { ...base, log: [...base.log, { n: base.log.length + 1, at: Date.now(), kind, text, who: "me" }] };
  };
  const change = (id: string, fn: (r: TicketRecord) => TicketRecord) => setTickets((m) => ({ ...m, [id]: fn(m[id] ?? { log: [] }) }));

  const transition = (id: string, to: AlertState, code?: ResolutionCode): boolean => {
    const raw = rawAlerts?.find((a) => a.id === id);
    const from = alertStates[id] ?? raw?.state;
    if (!raw || !from || !canMove(from, to)) return false;
    setAlertStates((m) => ({ ...m, [id]: to }));
    change(id, (r) => {
      let next = logTo(r, "state", to);
      if (to === "acknowledged") next = { ...next, ackAge: raw.minutesAgo };
      if (to === "resolved") next = { ...next, resolveAge: raw.minutesAgo, code: code ?? "fixed", ackAge: next.ackAge ?? raw.minutesAgo };
      if (to === "in_progress" && next.ackAge === undefined) next = { ...next, ackAge: raw.minutesAgo };
      return next;
    });
    return true;
  };

  const ackAlerts = (ids: string[], to: "acknowledged" | "resolved", code?: ResolutionCode) => {
    const raws = (rawAlerts ?? []).filter((a) => ids.includes(a.id));
    setAlertStates((m) => { const n = { ...m }; for (const a of raws) { const cur = n[a.id] ?? a.state; if (cur === "closed" || cur === "resolved") continue; if (to === "acknowledged" && cur !== "open") continue; n[a.id] = to; } return n; });
    setTickets((m) => {
      const n = { ...m };
      for (const a of raws) {
        const cur = alertStates[a.id] ?? a.state;
        if (cur === "closed" || cur === "resolved" || (to === "acknowledged" && cur !== "open")) continue;
        let r = logTo({ ...(n[a.id] ?? { log: [] }), owner: n[a.id]?.owner ?? "me" }, "assign", "me");
        r = logTo(r, "state", to);
        r = { ...r, ackAge: r.ackAge ?? a.minutesAgo, ...(to === "resolved" ? { resolveAge: a.minutesAgo, code: code ?? "fixed" } : {}) };
        n[a.id] = r;
      }
      return n;
    });
  };
  const setOrders = (fn: (l: WorkOrder[]) => WorkOrder[]) => setWorkOrders((l) => fn(l ?? []));
  const touch = (fn: (r: Registry) => Registry) => setRegistry((r) => fn(r));

  const value: Ctx = {
    lang, setLang: setLangS, persona, setPersona: setPersonaS, t, thresholds, setThresholds: setThresholdsS, alerts,
    transition, tickets, problems, journeys, saveJourney,
    assign: (id, owner) => change(id, (r) => logTo({ ...r, owner }, "assign", owner ?? "none")),
    escalate: (id, toTier) => change(id, (r) => logTo({ ...r, manualTier: toTier }, "escalate", String(toTier))),
    toggleMajor: (id) => change(id, (r) => logTo({ ...r, major: !r.major }, "major", r.major ? "off" : "on")),
    addNote: (id, text) => { const x = text.trim(); if (x) change(id, (r) => logTo(r, "note", x.slice(0, 280))); },
    raiseProblem: (c, cause) => {
      const pid = nextProblemId(problems);
      setProblems((p) => [...p, { id: pid, key: c.key, type: c.type, routeId: c.routeId, cause, alertIds: c.alertIds, status: "investigating" }]);
      setTickets((m) => { const n = { ...m }; for (const a of c.alertIds) { n[a] = logTo({ ...(n[a] ?? { log: [] }), problemId: pid }, "problem", pid); } return n; });
    },
    updateProblem: (id, patch) => setProblems((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    lockOverride,
    setLock: (containerId, lock, action) => {
      setLockOverride((m) => ({ ...m, [containerId]: lock }));
      setAudit((a) => [{ id: `${containerId}-${a.length + 1}`, action, containerId, at: Date.now() }, ...a].slice(0, 20));
    },
    registry,
    savePartner: (p) => touch((r) => ({ ...r, partners: r.partners.some((x) => x.id === p.id) ? r.partners.map((x) => (x.id === p.id ? p : x)) : [...r.partners, { ...p, id: p.id || nextId("FP", r.partners) }] })),
    removePartner: (id) => touch((r) => { const gone = new Set(r.drivers.filter((d) => d.partnerId === id).map((d) => d.id)); return { ...r, partners: r.partners.filter((p) => p.id !== id), drivers: r.drivers.filter((d) => d.partnerId !== id), events: r.events.filter((e) => !gone.has(e.driverId)), assignments: Object.fromEntries(Object.entries(r.assignments).filter(([, d]) => !gone.has(d))) }; }),
    saveDriver: (d) => touch((r) => ({ ...r, drivers: r.drivers.some((x) => x.id === d.id) ? r.drivers.map((x) => (x.id === d.id ? d : x)) : [...r.drivers, { ...d, id: d.id || nextId("DR", r.drivers) }] })),
    removeDriver: (id) => touch((r) => ({ ...r, drivers: r.drivers.filter((d) => d.id !== id), events: r.events.filter((e) => e.driverId !== id), assignments: Object.fromEntries(Object.entries(r.assignments).filter(([, d]) => d !== id)) })),
    logEvent: (e) => touch((r) => ({ ...r, events: [...r.events, { ...e, id: nextId("EV", r.events), source: "operator" }] })),
    assignDriver: (containerId, driverId) => touch((r) => ({ ...r, assignments: { ...r.assignments, [containerId]: driverId } })),
    cases,
    takeCase: (c) => ackAlerts(c.alertIds, "acknowledged"),
    resolveCase: (c) => ackAlerts(c.alertIds, "resolved"),
    workOrders: orders,
    openWorkOrder: (c) => { ackAlerts(c.alertIds, "acknowledged"); setOrders((l) => (l.some((w) => w.caseId === c.id) ? l : [caseWorkOrder(c, nextWoId(l)), ...l])); },
    raiseDeviceOrder: (i) => setOrders((l) => (l.some((w) => w.containerId === i.containerId && w.kind === "preventive") ? l : [deviceWorkOrder(i, nextWoId(l)), ...l])),
    advanceWorkOrder: (id) => setOrders((l) => l.map((w) => (w.id === id ? advanceWo(w) : w))),
    releaseWorkOrder: (id) => {
      const w = orders.find((x) => x.id === id);
      if (!w) return;
      setOrders((l) => l.filter((x) => x.id !== id));
      setReleased((n) => n + 1);
      const c = cases.find((x) => x.id === w.caseId);
      if (c) ackAlerts(c.alertIds, "resolved", "fixed");
    },
    released, deviceLimits, setDeviceLimits: setDeviceLimitsS, postDelivery,
    recordPost: (containerId, step) => setPostDelivery((m) => ({ ...m, [containerId]: step })),
    audit, ready, fleet, alertsReady: rawAlerts !== null, apiError: fleetError ?? alertsError, retry: () => setAttempt((n) => n + 1),
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useApp(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error("useApp must be used inside Providers");
  return v;
}
