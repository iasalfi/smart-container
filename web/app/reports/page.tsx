"use client";
import { useMemo, useState } from "react";
import { useApp, CUSTOMER_PERSONA_NAME } from "../providers";
import { ApiGate } from "@/components/ui";
import { REPORTS, alertsIn, buildReport, journeysIn, scopeOf, toCsv, type Cell, type Col, type ReportId } from "@/lib/analytics";
import { SNAPSHOT_MS } from "@/lib/journey";
import { formatMinutes } from "@/lib/itsm";
import { PROFILES } from "@/lib/profiles";
import type { Key } from "@/lib/i18n";

const PAGE = 25;

export default function ReportsPage() {
  const { t, lang, persona, fleet, alerts, journeys, tickets, apiError, retry } = useApp();
  const list = REPORTS[persona];
  const [pick, setPick] = useState<ReportId | null>(null);
  const [cargo, setCargo] = useState("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const id: ReportId = pick && list.includes(pick) ? pick : list[0];
  const base = useMemo(() => scopeOf(persona, fleet ?? [], CUSTOMER_PERSONA_NAME), [persona, fleet]);
  const scope = useMemo(() => (cargo === "all" ? base : base.filter((c) => c.profileId === cargo)), [base, cargo]);
  const report = useMemo(() => buildReport(id, { scope, alerts: alertsIn(alerts, scope), journeys: journeysIn(journeys, scope), tickets, nowMs: SNAPSHOT_MS }), [id, scope, alerts, journeys, tickets]);
  const cargoName = (pid: string) => PROFILES.find((p) => p.id === pid)?.name[lang] ?? pid;
  const show = (v: Cell, c: Col): string => {
    switch (c.kind) {
      case "num": return Number(v).toLocaleString("en-US");
      case "pct": return `${v}%`;
      case "min": return v === "" ? "" : formatMinutes(Number(v));
      case "status": case "sev": return t(`status_${v}` as Key);
      case "alert": return t(`alert_type_${v}` as Key);
      case "cargo": return cargoName(String(v));
      case "jstatus": return t(`ops_status_${v}` as Key);
      default: return String(v);
    }
  };
  const label = (c: Col) => t(`repc_${c.key}` as Key);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return report.rows;
    return report.rows.filter((r) => r.some((v, k) => show(v, report.cols[k]).toLowerCase().includes(needle)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, q, lang]);
  if (!fleet) return <ApiGate error={apiError} onRetry={retry} />;
  const reset = (fn: () => void) => { fn(); setLimit(PAGE); };
  const exportCsv = () => {
    const raw = (v: Cell, c: Col): Cell => (c.kind === "num" || c.kind === "pct" || c.kind === "min" ? (v === "" ? "" : Number(v)) : show(v, c));
    const csv = toCsv(report.cols.map(label), [...rows.map((r) => r.map((v, k) => raw(v, report.cols[k]))), ...(report.totals && !q.trim() ? [report.totals.map((v, k) => (k === 0 ? t("rep_total") : raw(v, report.cols[k])))] : [])]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${id}-${persona}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="page" data-testid="reports" data-persona={persona}>
      <div className="page-head no-print">
        <div><h1>{t("rep_title")}</h1><p className="muted">{t("rep_sub")}</p></div>
        <span className="an-role" data-testid="rep-role">{t(`persona_${persona}` as Key)}</span>
      </div>
      <div className="rep-layout">
        <nav className="card rep-list no-print" aria-label={t("rep_list")}>
          <h2>{t("rep_list")}</h2>
          <ul>
            {list.map((r) => (
              <li key={r}><button type="button" aria-pressed={r === id} onClick={() => reset(() => { setPick(r); setQ(""); })} data-testid={`rep-pick-${r}`}>
                <strong>{t(`rep_name_${r}` as Key)}</strong><span>{t(`rep_desc_${r}` as Key)}</span>
              </button></li>
            ))}
          </ul>
        </nav>
        <section className="card rep-view" data-testid="rep-view" data-report={id}>
          <h2 data-testid="rep-name">{t(`rep_name_${id}` as Key)}</h2>
          <p className="muted small print-only-note">{t("rep_generated", { p: t(`persona_${persona}` as Key) })}</p>
          <div className="filters no-print">
            <label>{t("cargo")}
              <select value={cargo} onChange={(e) => reset(() => setCargo(e.target.value))} data-testid="rep-cargo">
                <option value="all">{t("all_cargo")}</option>
                {PROFILES.map((p) => (<option key={p.id} value={p.id}>{p.name[lang]}</option>))}
              </select>
            </label>
            <label>{t("rep_filter")}<input type="search" value={q} placeholder={t("rep_filter_ph")} onChange={(e) => reset(() => setQ(e.target.value))} data-testid="rep-q" /></label>
            <button type="button" className="btn" onClick={exportCsv} data-testid="rep-export">{t("rep_export")}</button>
            <button type="button" className="btn ghost" onClick={() => window.print()} data-testid="rep-print">{t("rep_print")}</button>
          </div>
          <p className="muted small" aria-live="polite" data-testid="rep-count">{rows.length > PAGE ? t("rep_showing", { s: Math.min(limit, rows.length), n: rows.length.toLocaleString("en-US") }) : t("rep_rows", { n: rows.length })}</p>
          {rows.length === 0 ? <p className="state-inline" role="status" data-testid="rep-empty">{t("rep_empty")}</p> : (
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Report table"><table className="table" data-testid="rep-table">
              <thead><tr>{report.cols.map((c) => <th key={c.key} scope="col">{label(c)}</th>)}</tr></thead>
              <tbody>
                {rows.slice(0, limit).map((r, i) => (<tr key={i} data-testid="rep-row">{r.map((v, k) => <td key={k}>{show(v, report.cols[k])}</td>)}</tr>))}
              </tbody>
              {report.totals && !q.trim() ? (<tfoot><tr data-testid="rep-total">{report.totals.map((v, k) => <th key={k} scope={k === 0 ? "row" : undefined}>{k === 0 ? t("rep_total") : v === "" ? "" : show(v, report.cols[k])}</th>)}</tr></tfoot>) : null}
            </table></div>
          )}
          {rows.length > limit ? <div className="table-foot"><span /><button type="button" className="btn small ghost no-print" onClick={() => setLimit((n) => n + PAGE)} data-testid="rep-more">{t("rep_more")}</button></div> : null}
        </section>
      </div>
    </div>
  );
}
