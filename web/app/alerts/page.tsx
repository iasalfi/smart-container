"use client";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CasesView } from "@/components/CasesView";
import { useApp, CUSTOMER_PERSONA_NAME } from "../providers";
import { AlertRow } from "@/components/AlertRow";
import { ApiGate } from "@/components/ui";
import {
  ROOT_CAUSES, SLA_TARGETS, STATE_ORDER, formatMinutes, itsmStats, problemCandidates, queueOrder, slaAtRisk, ticketView,
  type Priority, type Tier,
} from "@/lib/itsm";
import { getRoute } from "@/lib/geo";
import { CITIES } from "@/lib/cities";
import type { AlertState, Severity } from "@/lib/types";

type Queue = "all" | "mine" | "unassigned" | "sla" | "major";
const QUEUES: Queue[] = ["all", "mine", "unassigned", "sla", "major"];
const LEVELS = ["high", "medium", "low"] as const;

export default function AlertsPage() {
  return (<Suspense fallback={null}><AlertsInner /></Suspense>);
}

function AlertsInner() {
  const params = useSearchParams();
  const { t, lang, alerts, cases, persona, fleet, alertsReady, apiError, retry, tickets, problems, raiseProblem, updateProblem } = useApp();
  const byId = useMemo(() => new Map((fleet ?? []).map((c) => [c.id, c])), [fleet]);
  const [sev, setSev] = useState<Severity | "all">("all");
  const [st, setSt] = useState<AlertState | "all">("all");
  const [prio, setPrio] = useState<Priority | 0>(0);
  const [tier, setTier] = useState<Tier | 0>(0);
  const [queue, setQueue] = useState<Queue>("all");
  const [q, setQ] = useState("");
  const [cause, setCause] = useState<Record<string, string>>({});
  const customer = persona === "customer";
  const view: "cases" | "alarms" = !customer && params.get("view") !== "alarms" ? "cases" : "alarms";

  const mine = useMemo(() => alerts.filter((a) => !customer || byId.get(a.containerId)?.customer === CUSTOMER_PERSONA_NAME), [alerts, customer, byId]);
  const views = useMemo(() => mine.map((a) => ticketView(a, byId.get(a.containerId)?.profileId ?? "dry", tickets[a.id])).sort(queueOrder), [mine, byId, tickets]);
  const stats = useMemo(() => itsmStats(views), [views]);
  const candidates = useMemo(() => problemCandidates(mine, (id) => byId.get(id)?.routeId), [mine, byId]);
  const raised = new Set(problems.map((p) => p.key));
  const allOpen = candidates.filter((c) => !raised.has(c.key));
  const open = allOpen.slice(0, 4);

  const list = useMemo(() => views.filter((v) => {
    const a = v.alert;
    if (sev !== "all" && a.severity !== sev) return false;
    if (st !== "all" && a.state !== st) return false;
    if (prio && v.cls.priority !== prio) return false;
    if (tier && v.tier !== tier) return false;
    if (queue === "mine" && v.rec.owner !== "me") return false;
    if (queue === "unassigned" && (v.rec.owner || a.state === "closed" || a.state === "resolved")) return false;
    if (queue === "sla" && !(slaAtRisk(v.sla) && a.state !== "closed" && a.state !== "resolved")) return false;
    if (queue === "major" && !v.rec.major) return false;
    if (q.trim() && !a.containerId.toLowerCase().includes(q.trim().toLowerCase())) return false;
    return true;
  }), [views, sev, st, prio, tier, queue, q]);

  const summary = useMemo(() => ({
    open: mine.filter((a) => a.state === "open").length,
    critical: mine.filter((a) => a.severity === "critical" && a.state === "open").length,
    warning: mine.filter((a) => a.severity === "warning" && a.state === "open").length,
    done: mine.filter((a) => a.state !== "open").length,
  }), [mine]);
  const queueCount: Record<Queue, number> = useMemo(() => ({
    all: views.length,
    mine: views.filter((v) => v.rec.owner === "me").length,
    unassigned: views.filter((v) => !v.rec.owner && v.state !== "closed" && v.state !== "resolved").length,
    sla: views.filter((v) => slaAtRisk(v.sla) && v.state !== "closed" && v.state !== "resolved").length,
    major: views.filter((v) => v.rec.major).length,
  }), [views]);

  if (!fleet || !alertsReady) return <ApiGate error={apiError} onRetry={retry} />;
  const cityName = (id: string) => (lang === "ar" ? CITIES[id]?.ar : CITIES[id]?.en) ?? id;
  const routeName = (id: string) => { const r = getRoute(id); return r ? `${cityName(r.from)} → ${cityName(r.to)}` : id; };
  const mm = (m: number | null) => (m === null ? "–" : formatMinutes(m));
  const prioOf = (i: number, j: number) => [[1, 2, 3], [2, 3, 4], [3, 4, 4]][i][j] as Priority;

  const toggle = !customer ? (
    <nav className="seg" aria-label={t("cs_view_label")} data-testid="alerts-view">
      <Link className="btn-sm" href="/alerts/" aria-current={view === "cases" ? "page" : undefined} data-testid="view-cases">{t("cs_view_cases")}</Link>
      <Link className="btn-sm" href="/alerts/?view=alarms" aria-current={view === "alarms" ? "page" : undefined} data-testid="view-alarms">{t("cs_view_alarms")}</Link>
    </nav>
  ) : null;
  if (view === "cases") {
    return (
      <div className="page" data-testid="cases-page">
        <div className="page-head"><div><h1>{t("nav_alerts")}</h1><p className="muted">{t("cs_sub", { n: cases.filter((c) => c.state !== "resolved").length })}</p></div>{toggle}</div>
        <CasesView />
      </div>
    );
  }
  return (
    <div className="page">
      <div className="page-head"><div><h1>{t("alerts_title")}</h1><p className="muted" data-testid="alerts-count" aria-live="polite">{t("alerts_count", { n: list.length })}</p></div>{toggle}</div>
      <div className="sumrow" data-testid="alerts-summary">
        <div className="sum"><b>{summary.open}</b><span>{t("alerts_sum_open")}</span></div>
        <div className="sum c"><b>{summary.critical}</b><span>{t("alerts_sum_critical")}</span></div>
        <div className="sum w"><b>{summary.warning}</b><span>{t("alerts_sum_warning")}</span></div>
        <div className="sum d"><b>{summary.done}</b><span>{t("alerts_sum_done")}</span></div>
      </div>

      {!customer ? (
        <>
          <section aria-label={t("itsm_service_title")} className="itsm-kpis" data-testid="itsm-kpis">
            <div className="ik bad" data-testid="itsm-breached"><b>{stats.breached}</b><span>{t("itsm_k_breached")}</span></div>
            <div className="ik warn" data-testid="itsm-at-risk"><b>{stats.atRisk}</b><span>{t("itsm_k_at_risk")}</span></div>
            <div className="ik" data-testid="itsm-unassigned"><b>{stats.unassigned}</b><span>{t("itsm_k_unassigned")}</span></div>
            <div className="ik" data-testid="itsm-major"><b>{stats.major}</b><span>{t("itsm_k_major")}</span></div>
            <div className="ik" data-testid="itsm-mtta"><b>{mm(stats.mtta)}</b><span>{t("itsm_k_mtta")}</span></div>
            <div className="ik" data-testid="itsm-mttr"><b>{mm(stats.mttr)}</b><span>{t("itsm_k_mttr")}</span></div>
          </section>

          <div className="itsm-grid">
            <section className="card" aria-labelledby="mx-h" data-testid="priority-matrix">
              <h2 id="mx-h">{t("itsm_matrix_title")}</h2>
              <p className="muted small">{t("itsm_matrix_hint")}</p>
              <p className="mx-corner small" aria-hidden="true">{t("itsm_impact")} ↓ / {t("itsm_urgency")} →</p>
              <div className="matrix" role="group" aria-label={t("itsm_matrix_title")}>
                <span aria-hidden="true" />
                {LEVELS.map((l) => <span key={l} className="mx-head">{t(`itsm_level_${l}` as const)}</span>)}
                {LEVELS.map((lv, i) => (
                  <div key={lv} className="mx-row">
                    <span className="mx-head side">{t(`itsm_level_${lv}` as const)}</span>
                    {[0, 1, 2].map((j) => {
                      const p = prioOf(i, j);
                      return (
                        <button key={j} type="button" className={`mx-cell prio-${p}`} aria-pressed={prio === p} onClick={() => setPrio(prio === p ? 0 : p)} data-testid="matrix-cell" data-priority={p}>
                          <b>{stats.matrix[i][j]}</b><span>P{p}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <ul className="sla-legend" data-testid="sla-legend">
                {([1, 2, 3, 4] as Priority[]).map((p) => (
                  <li key={p}><span className={`prio prio-${p}`}>P{p}</span> {t("itsm_targets", { r: formatMinutes(SLA_TARGETS[p].respondMin), s: formatMinutes(SLA_TARGETS[p].resolveMin) })} <b>{stats.byPriority[p]}</b></li>
                ))}
              </ul>
            </section>

            <section className="card" aria-labelledby="lc-h" data-testid="lifecycle">
              <h2 id="lc-h">{t("itsm_lifecycle_title")}</h2>
              <p className="muted small">{t("itsm_lifecycle_hint")}</p>
              <ol className="flow">
                {STATE_ORDER.map((s) => (
                  <li key={s}>
                    <button type="button" className={`flow-step flow-${s}`} aria-pressed={st === s} onClick={() => setSt(st === s ? "all" : s)} data-testid={`flow-${s}`}>
                      <b>{stats.byState[s]}</b><span>{t(`state_${s}` as const)}</span>
                    </button>
                  </li>
                ))}
              </ol>
              <h3>{t("itsm_tiers_title")}</h3>
              <ul className="tiers" data-testid="tier-board">
                {([1, 2, 3] as Tier[]).map((n) => (
                  <li key={n}>
                    <button type="button" className={`tier-btn tier-${n}`} aria-pressed={tier === n} onClick={() => setTier(tier === n ? 0 : n)} data-testid={`tier-${n}`}>
                      <b>L{n}</b><span>{t(`itsm_tier_${n}` as const)}</span><i>{stats.byTier[n]}</i>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card" aria-labelledby="pb-h" data-testid="problems">
              <h2 id="pb-h">{t("itsm_problems_title")}</h2>
              <p className="muted small">{t("itsm_problems_hint")}</p>
              {open.length === 0 && problems.length === 0 ? <p className="muted" data-testid="problems-empty">{t("itsm_problems_none")}</p> : null}
              <ul className="problems">
                {open.map((c) => (
                  <li key={c.key} data-testid="problem-candidate">
                    <div><strong>{t(`alert_type_${c.type}` as const)}</strong><span className="muted"> · {routeName(c.routeId)} · {t("itsm_problem_count", { n: c.count })}</span></div>
                    <div className="td-row">
                      <label className="stack">{t("itsm_root_cause")}
                        <select value={cause[c.key] ?? ROOT_CAUSES[0]} onChange={(e) => setCause((m) => ({ ...m, [c.key]: e.target.value }))} data-testid="cause-select">
                          {ROOT_CAUSES.map((r) => <option key={r} value={r}>{t(`itsm_cause_${r}` as const)}</option>)}
                        </select>
                      </label>
                      <button type="button" className="btn small" onClick={() => raiseProblem(c, cause[c.key] ?? ROOT_CAUSES[0])} data-testid="raise-problem">{t("itsm_raise_problem")}</button>
                    </div>
                  </li>
                ))}
                {allOpen.length > open.length ? <li className="muted small" data-testid="problems-more">{t("itsm_problems_more", { n: allOpen.length - open.length })}</li> : null}
                {problems.map((p) => (
                  <li key={p.id} data-testid="problem-record">
                    <div><b>{p.id}</b> <strong>{t(`alert_type_${p.type}` as const)}</strong><span className="muted"> · {routeName(p.routeId)} · {t("itsm_problem_count", { n: p.alertIds.length })}</span></div>
                    <div className="td-row">
                      <label className="stack">{t("itsm_root_cause")}
                        <select value={p.cause} onChange={(e) => updateProblem(p.id, { cause: e.target.value })}>
                          {ROOT_CAUSES.map((r) => <option key={r} value={r}>{t(`itsm_cause_${r}` as const)}</option>)}
                        </select>
                      </label>
                      <label className="stack">{t("itsm_problem_status")}
                        <select value={p.status} onChange={(e) => updateProblem(p.id, { status: e.target.value as typeof p.status })} data-testid="problem-status">
                          <option value="investigating">{t("itsm_ps_investigating")}</option>
                          <option value="known_error">{t("itsm_ps_known_error")}</option>
                          <option value="resolved">{t("itsm_ps_resolved")}</option>
                        </select>
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="queues" role="group" aria-label={t("itsm_queues")} data-testid="queues">
            {QUEUES.map((k) => (
              <button key={k} type="button" className="queue-tab" aria-pressed={queue === k} onClick={() => setQueue(k)} data-testid={`queue-${k}`}>{t(`itsm_queue_${k}` as const)} <b>{queueCount[k]}</b></button>
            ))}
          </div>
        </>
      ) : null}

      <div className="filters">
        <label>{t("search")}<input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="SC-1043" data-testid="alert-search" /></label>
        <label>{t("filter_severity")}
          <select value={sev} onChange={(e) => setSev(e.target.value as Severity | "all")} data-testid="sev-filter">
            <option value="all">{t("all")}</option><option value="critical">{t("sev_critical")}</option><option value="warning">{t("sev_warning")}</option>
          </select>
        </label>
        <label>{t("filter_state")}
          <select value={st} onChange={(e) => setSt(e.target.value as AlertState | "all")} data-testid="state-filter">
            <option value="all">{t("all")}</option>
            {STATE_ORDER.map((s) => <option key={s} value={s}>{t(`state_${s}` as const)}</option>)}
          </select>
        </label>
        <label>{t("itsm_priority")}
          <select value={prio} onChange={(e) => setPrio(Number(e.target.value) as Priority | 0)} data-testid="prio-filter">
            <option value={0}>{t("all")}</option>
            {[1, 2, 3, 4].map((p) => <option key={p} value={p}>P{p}</option>)}
          </select>
        </label>
        <label>{t("itsm_tier")}
          <select value={tier} onChange={(e) => setTier(Number(e.target.value) as Tier | 0)} data-testid="tier-filter">
            <option value={0}>{t("all")}</option>
            {[1, 2, 3].map((n) => <option key={n} value={n}>L{n}</option>)}
          </select>
        </label>
        <button type="button" className="btn ghost" onClick={() => { setSev("all"); setSt("all"); setPrio(0); setTier(0); setQueue("all"); setQ(""); }} data-testid="alerts-clear">{t("clear_filters")}</button>
      </div>
      {list.length === 0 ? <p className="state-inline" role="status" data-testid="alerts-empty">{t("alerts_empty")}</p> : (
        <ul className="alert-list">{list.map((v) => <AlertRow key={v.alert.id} a={v.alert} link />)}</ul>
      )}
    </div>
  );
}
