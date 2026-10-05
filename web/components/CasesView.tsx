"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/app/providers";
import { AlertGlyph } from "./Art";
import { SLA_TARGETS, formatMinutes } from "@/lib/itsm";
import type { Case } from "@/lib/cases";
import type { Key } from "@/lib/i18n";

const rank = (c: Case) => (c.state === "resolved" ? 1 : 0);

export function CaseRow({ c, canAct }: { c: Case; canAct: boolean }) {
  const { t, takeCase, resolveCase, openWorkOrder } = useApp();
  const target = SLA_TARGETS[c.priority];
  const respBreach = c.state === "open" && c.ageMin > target.respondMin ? c.ageMin - target.respondMin : 0;
  const resBreach = c.state !== "resolved" && c.ageMin > target.resolveMin ? c.ageMin - target.resolveMin : 0;
  const stateLabel = c.state === "in_mro" ? t("cs_in_maintenance") : c.state === "resolved" ? t("cs_resolved") : t(`state_${c.state}` as Key);
  return (
    <li className={`case case-${c.state}`} data-testid="case-row" data-state={c.state} data-priority={c.priority} data-id={c.id} data-container={c.containerId}>
      <span className={`prio prio-${c.priority}`} data-testid="case-prio">P{c.priority}</span>
      <span className="atile" aria-hidden="true"><AlertGlyph type={c.type} /></span>
      <div className="alert-body">
        <strong><Link href={`/container/?id=${c.containerId}`}>{c.containerId}</Link> {t(`alert_type_${c.type}` as Key)}</strong>
        <span className="muted">{c.id} · {t("cs_ago", { t: formatMinutes(c.ageMin) })}</span>
        <span className="chips">
          <span className="chip" data-testid="case-state">{stateLabel}</span>
          {c.merged > 1 ? <span className="chip" data-testid="case-merged">{t("cs_merged", { n: c.merged })}</span> : null}
          <span className="chip" data-testid="case-owner">{c.owner ? t("cs_owner_you") : t("cs_unassigned")}</span>
          {respBreach ? <span className="chip sla sla-breached" data-testid="case-resp-breach">{t("cs_resp_breach", { t: formatMinutes(respBreach) })}</span> : null}
          {resBreach ? <span className="chip sla sla-breached" data-testid="case-res-breach">{t("cs_res_breach", { t: formatMinutes(resBreach) })}</span> : null}
          {c.woId ? <Link className="chip" href="/maintenance/" data-testid="case-wo">{c.woId}</Link> : null}
        </span>
      </div>
      {canAct && c.state !== "resolved" ? (
        <div className="row-actions">
          {c.state === "open" ? <button type="button" className="btn-sm" onClick={() => takeCase(c)} data-testid="case-take">{t("cs_take")}</button> : null}
          {c.mro && !c.woId ? <button type="button" className="btn-sm" onClick={() => openWorkOrder(c)} data-testid="case-wo-open">{t("cs_open_wo")}</button> : null}
          {c.woId ? <Link className="btn-sm" href="/maintenance/" data-testid="case-wo-view">{t("cs_view_wo")}</Link> : null}
          <button type="button" className="btn-sm" onClick={() => resolveCase(c)} data-testid="case-resolve">{t("cs_resolve")}</button>
        </div>
      ) : null}
    </li>
  );
}

export function CasesView({ search = true }: { search?: boolean }) {
  const { t, cases, persona } = useApp();
  const [q, setQ] = useState("");
  const [showDone, setShowDone] = useState(false);
  const canAct = persona === "operator";
  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    return cases.filter((c) => (showDone || c.state !== "resolved") && (!k || c.containerId.toLowerCase().includes(k))).sort((a, b) => rank(a) - rank(b));
  }, [cases, q, showDone]);
  const alarms = list.reduce((s, c) => s + c.merged, 0);
  return (
    <section data-testid="cases-view">
      <div className="filters">
        {search ? <label>{t("cs_find")}<input type="search" value={q} placeholder={t("cs_find_ph")} onChange={(e) => setQ(e.target.value)} data-testid="case-search" /></label> : null}
        <label className="check"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} data-testid="case-show-done" />{t("cs_resolved")}</label>
        <span className="muted small" aria-live="polite" data-testid="cases-count">{t("cs_summary", { n: list.length, a: alarms })}</span>
      </div>
      {list.length === 0 ? <p className="state-inline" role="status" data-testid="cases-empty">{t("cs_empty")}</p> : <ul className="alert-list">{list.map((c) => <CaseRow key={c.id} c={c} canAct={canAct} />)}</ul>}
    </section>
  );
}
