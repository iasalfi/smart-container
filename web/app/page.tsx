"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp, CUSTOMER_PERSONA_NAME } from "./providers";
import { KsaMap, type Dot } from "@/components/KsaMap";
import { ApiGate, StatusPill, STATUS_COLOR } from "@/components/ui";
import { PROFILES } from "@/lib/profiles";
import { countByStatus, EMPTY_FILTER, filterFleet, type FleetFilter } from "@/lib/filter";
import type { Status } from "@/lib/types";

export default function FleetPage() {
  const { t, lang, persona, alerts, fleet, apiError, retry } = useApp();
  const [f, setF] = useState<FleetFilter>(EMPTY_FILTER);
  const [selected, setSelected] = useState<string | null>(null);
  const all = useMemo(() => fleet ?? [], [fleet]);
  const scope = useMemo(() => (persona === "customer" ? all.filter((c) => c.customer === CUSTOMER_PERSONA_NAME) : all), [all, persona]);
  const counts = useMemo(() => countByStatus(scope), [scope]);
  const filtered = useMemo(() => filterFleet(scope, f), [scope, f]);
  const dots: Dot[] = useMemo(() => filtered.map((c) => ({ id: c.id, lon: c.lon, lat: c.lat, color: STATUS_COLOR[c.status], hollow: !c.online, selected: c.id === selected, r: c.status === "normal" ? 3.6 : 5, label: `${c.id} · ${t(`status_${c.status}` as const)}` })), [filtered, selected, t]);
  const sel = selected ? scope.find((c) => c.id === selected) : undefined;
  const ids = useMemo(() => new Set(scope.map((c) => c.id)), [scope]);
  const scopedAlerts = alerts.filter((a) => ids.has(a.containerId) && a.state === "open");
  const panel =
    persona === "quality" ? "health" : persona === "security" ? "door" : "alerts";
  const lowHealth = useMemo(() => [...scope].sort((a, b) => a.healthScore - b.healthScore).slice(0, 8), [scope]);
  const doorWatch = useMemo(() => scope.filter((c) => c.door === "open" || c.lock === "unlocked" || c.lock === "cut").slice(0, 8), [scope]);
  const clear = () => setF(EMPTY_FILTER);
  const filtersActive = f.q !== "" || f.status !== "all" || f.profile !== "all" || f.reeferOnly;
  const tile = (key: Status | "all", n: number, label: string, cls: string) => (
    <button type="button" className={`kpi ${cls}`} aria-pressed={f.status === key} onClick={() => setF({ ...f, status: f.status === key ? "all" : key })} data-testid={`kpi-${key}`}>
      <span className="kpi-n">{n.toLocaleString("en-US")}</span><span className="kpi-l">{label}</span>
    </button>
  );
  if (!fleet) return <ApiGate error={apiError} onRetry={retry} />;
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>{t("fleet_title")}</h1><p className="muted" data-testid="fleet-sub">{t("fleet_sub", { n: scope.length.toLocaleString("en-US") })}</p></div>
      </div>
      <div className="kpis" role="group" aria-label="Status filter">
        <div className="kpi static kpi-total" data-testid="kpi-total"><span className="kpi-n">{counts.total.toLocaleString("en-US")}</span><span className="kpi-l">{t("kpi_total")}</span></div>
        {tile("normal", counts.normal, t("kpi_normal"), "kpi-normal")}
        {tile("warning", counts.warning, t("kpi_warning"), "kpi-warning")}
        {tile("critical", counts.critical, t("kpi_critical"), "kpi-critical")}
      </div>
      <p className="muted small" data-testid="offline-note">{t("kpi_offline", { n: counts.offline })}</p>
      <div className="filters">
        <label>{t("search")}<input type="search" value={f.q} placeholder={t("search_ph")} onChange={(e) => setF({ ...f, q: e.target.value })} data-testid="search" /></label>
        <label>{t("cargo")}
          <select value={f.profile} onChange={(e) => setF({ ...f, profile: e.target.value })} data-testid="cargo-filter">
            <option value="all">{t("all_cargo")}</option>
            {PROFILES.map((p) => (<option key={p.id} value={p.id}>{p.name[lang]}</option>))}
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={f.reeferOnly} onChange={(e) => setF({ ...f, reeferOnly: e.target.checked })} data-testid="reefer-filter" />{t("reefer_only")}</label>
        <button type="button" className="btn ghost" onClick={clear} disabled={!filtersActive} data-testid="clear-filters">{t("clear_filters")}</button>
      </div>
      <div className="grid-main">
        <section className="card map-card">
          <KsaMap label={t("map_label")} dots={dots} onSelect={setSelected} zoomLabels={{ in: t("zoom_in"), out: t("zoom_out"), reset: t("zoom_reset") }} />
          <p className="muted small" aria-live="polite" data-testid="showing">{t("showing", { shown: filtered.length.toLocaleString("en-US"), total: scope.length.toLocaleString("en-US") })}</p>
        </section>
        <aside className="side">
          {sel ? (
            <section className="card" data-testid="selected-card">
              <h2>{sel.id}</h2>
              <p className="muted">{sel.origin} → {sel.destination}</p>
              <p><StatusPill status={sel.status} /> {sel.tempC} °C · {sel.rh}% RH</p>
              <Link className="btn" href={`/container/?id=${sel.id}`} data-testid="open-selected">{t("open_container")}</Link>
            </section>
          ) : null}
          <section className="card" data-testid={`panel-${panel}`}>
            <h2>{panel === "alerts" ? t("panel_alerts") : panel === "health" ? t("panel_health") : t("panel_door")}</h2>
            {panel === "alerts" ? (scopedAlerts.length === 0 ? <p className="muted">{t("no_alerts")}</p> : (
              <ul className="list">{scopedAlerts.slice(0, 8).map((a) => (
                <li key={a.id}><span className={`dot dot-${a.severity}`} aria-hidden="true" /><Link href={`/container/?id=${a.containerId}`}><strong>{a.containerId}</strong> {t(`alert_type_${a.type}` as const)}</Link></li>))}</ul>)) : null}
            {panel === "health" ? (<ul className="list">{lowHealth.map((c) => (<li key={c.id}><Link href={`/health/?id=${c.id}`}><strong>{c.id}</strong> {Math.round(c.healthScore)}</Link></li>))}</ul>) : null}
            {panel === "door" ? (doorWatch.length === 0 ? <p className="muted">{t("no_alerts")}</p> : (<ul className="list">{doorWatch.map((c) => (<li key={c.id}><Link href={`/modules/?id=${c.id}`}><strong>{c.id}</strong> {t(`door_${c.door}` as const)} · {t(`lock_${c.lock}` as const)}</Link></li>))}</ul>)) : null}
          </section>
        </aside>
      </div>
      <section className="card" aria-label={t("showing", { shown: Math.min(12, filtered.length), total: filtered.length })}>
        {filtered.length === 0 ? (
          <p className="state-inline" role="status" data-testid="empty-state">{t("no_results")} <button type="button" className="link" onClick={clear}>{t("clear_filters")}</button></p>
        ) : (
          <table className="table" data-testid="fleet-table">
            <thead><tr><th>ID</th><th>{t("cargo")}</th><th>{t("route")}</th><th>{t("temp")}</th><th>{t("health_score")}</th><th></th></tr></thead>
            <tbody>
              {filtered.slice(0, 12).map((c) => (
                <tr key={c.id} data-testid="fleet-row">
                  <td><Link href={`/container/?id=${c.id}`}>{c.id}</Link></td>
                  <td>{PROFILES.find((p) => p.id === c.profileId)?.name[lang]}</td>
                  <td>{c.origin} → {c.destination}</td>
                  <td>{c.tempC} °C</td>
                  <td>{Math.round(c.healthScore)}</td>
                  <td><StatusPill status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
