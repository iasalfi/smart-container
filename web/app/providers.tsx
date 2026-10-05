"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translate, type Key } from "@/lib/i18n";
import { DEFAULT_THRESHOLDS, type Thresholds } from "@/lib/alerts";
import { ApiError, fetchAlerts, fetchFleet } from "@/lib/api";
import type { Alert, AlertState, Container, Lang, LockState, Persona } from "@/lib/types";

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
  setAlertState: (id: string, s: AlertState) => void;
  lockOverride: Record<string, LockState>;
  setLock: (containerId: string, lock: LockState, action: "lock" | "unlock") => void;
  audit: AuditEntry[];
  ready: boolean;
}

const C = createContext<Ctx | null>(null);

interface Saved { lang?: Lang; persona?: Persona; thresholds?: Thresholds; alertStates?: Record<string, AlertState>; lockOverride?: Record<string, LockState>; audit?: AuditEntry[] }

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
    setReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(STORE, JSON.stringify({ lang, persona, thresholds, alertStates, lockOverride, audit })); } catch { /* storage can be blocked */ }
  }, [ready, lang, persona, thresholds, alertStates, lockOverride, audit]);

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

  const alerts = useMemo(() => (rawAlerts ?? []).map((a) => ({ ...a, state: alertStates[a.id] ?? a.state })), [rawAlerts, alertStates]);

  const value: Ctx = {
    lang, setLang: setLangS, persona, setPersona: setPersonaS, t, thresholds, setThresholds: setThresholdsS, alerts,
    setAlertState: (id, s) => setAlertStates((m) => ({ ...m, [id]: s })),
    lockOverride,
    setLock: (containerId, lock, action) => {
      setLockOverride((m) => ({ ...m, [containerId]: lock }));
      setAudit((a) => [{ id: `${containerId}-${a.length + 1}`, action, containerId, at: Date.now() }, ...a].slice(0, 20));
    },
    audit, ready, fleet, alertsReady: rawAlerts !== null, apiError: fleetError ?? alertsError, retry: () => setAttempt((n) => n + 1),
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useApp(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error("useApp must be used inside Providers");
  return v;
}
