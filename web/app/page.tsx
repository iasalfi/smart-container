"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Hero } from "@/components/Hero";
import { Insights } from "@/components/Insights";
import { Tour } from "@/components/Tour";
import { useApp, CUSTOMER_PERSONA_NAME } from "./providers";
import { KsaMap, type Dot } from "@/components/KsaMap";
import { BatteryIcon, ContainerIcon, DoorIcon, HealthRing, SignalBars, SpeedDial, Thermo } from "@/components/Art";
import { CITIES } from "@/lib/cities";
import { ApiGate, StatusPill, STATUS_COLOR } from "@/components/ui";
import { PROFILES } from "@/lib/profiles";
import { countByStatus, EMPTY_FILTER, filterFleet, type FleetFilter } from "@/lib/filter";
import type { Container, Status } from "@/lib/types";

type SortKey = "id" | "cargo" | "route" | "temp" | "health";

export default function FleetPage() {
  const { t, lang, persona, alerts, fleet, apiError, retry } = useApp();
  const [f, setF] = useState<FleetFilter>(EMPTY_FILTER);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [corridor, setCorridor] = useState<string | null>(null);
  const [tour, setTour] = useState(false);
  const [limit, setLimit] = useState(12);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const all = useMemo(() => fleet ?? [], [fleet]);
  const scope = useMemo(() => (persona === "customer" ? all.filter((c) => c.customer === CUSTOMER_PERSONA_NAME) : all), [all, persona]);
  const counts = useMemo(() => countByStatus(scope), [scope]);
  const filtered = useMemo(() => {
    const base = filterFleet(scope, f);
    return corridor ? base.filter((c) => `${c.origin} → ${c.destination}` === corridor) : base;
  }, [scope, f, corridor]);
  const cargoName = (c: Container) => PROFILES.find((p) => p.id === c.profileId)?.name[lang] ?? "";
  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const val = (c: Container): string | number => sort.key === "id" ? c.id : sort.key === "cargo" ? (PROFILES.find((p) => p.id === c.profileId)?.name[lang] ?? "") : sort.key === "route" ? `${c.origin} → ${c.destination}` : sort.key === "temp" ? c.tempC : c.healthScore;
    return [...filtered].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  }, [filtered, sort, lang]);
  const dots: Dot[] = useMemo(() => filtered.map((c) => ({ id: c.id, lon: c.lon, lat: c.lat, color: STATUS_COLOR[c.status], hollow: !c.online, selected: c.id === selected || c.id === hovered, r: c.status === "normal" ? 3.6 : 5, pulse: c.status === "critical" && c.online, label: `${c.id} · ${t(`status_${c.status}` as const)}`, tip: [`${c.id} · ${t(`status_${c.status}` as const)}`, `${c.origin} → ${c.destination}`, `${c.tempC} °C · ${t("tip_speed", { v: Math.round(c.speedKmh) })}`, t("tip_open")] })), [filtered, selected, hovered, t]);
  const sel = selected ? scope.find((c) => c.id === selected) : undefined;
  const selProfile = sel ? PROFILES.find((q) => q.id === sel.profileId) : undefined;
  const ids = useMemo(() => new Set(scope.map((c) => c.id)), [scope]);
  const scopedAlerts = alerts.filter((a) => ids.has(a.containerId) && a.state === "open");
  const panel =
    persona === "quality" ? "health" : persona === "security" ? "door" : "alerts";
  const lowHealth = useMemo(() => [...scope].sort((a, b) => a.healthScore - b.healthScore).slice(0, 8), [scope]);
  const doorWatch = useMemo(() => scope.filter((c) => c.door === "open" || c.lock === "unlocked" || c.lock === "cut").slice(0, 8), [scope]);
  const clear = () => { setF(EMPTY_FILTER); setCorridor(null); setLimit(12); };
  const filtersActive = f.q !== "" || f.status !== "all" || f.profile !== "all" || f.reeferOnly || corridor !== null;
  const scrollTo = (id: string) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); };
  const sortBy = (key: SortKey) => setSort((s0) => (s0 && s0.key === key ? (s0.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 }));
  const th = (key: SortKey, label: string) => (
    <th aria-sort={sort?.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" className="th-btn" onClick={() => sortBy(key)} aria-label={t("sort_by", { c: label })} data-testid={`sort-${key}`}>{label}<span aria-hidden="true">{sort?.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : " ↕"}</span></button>
    </th>
  );
  const tile = (key: Status | "all", n: number, label: string, cls: string) => (
    <button type="button" className={`kpi ${cls}`} aria-pressed={f.status === key} onClick={() => setF({ ...f, status: f.status === key ? "all" : key })} data-testid={`kpi-${key}`}>
      <span className="kpi-n">{n.toLocaleString("en-US")}</span><span className="kpi-l">{label}</span>
    </button>
  );
  if (!fleet) return <ApiGate error={apiError} onRetry={retry} />;
  return (
    <div className="page">
      <Hero scope={scope} openAlerts={scopedAlerts.length} onExplore={() => scrollTo("dashboard")} onCritical={() => { setF({ ...f, status: "critical" }); window.setTimeout(() => scrollTo("fleet-map"), 50); }} onTour={() => setTour(true)} />
      {tour ? <Tour onClose={() => setTour(false)} /> : null}
      <div className="page-head" id="dashboard">
        <div><h1>{t("fleet_title")}</h1><p className="muted" data-testid="fleet-sub">{t("fleet_sub", { n: scope.length.toLocaleString("en-US") })}</p></div>
      </div>
      <div className="kpis" role="group" aria-label="Status filter">
        <div className="kpi static kpi-total" data-testid="kpi-total"><span className="kpi-n">{counts.total.toLocaleString("en-US")}</span><span className="kpi-l">{t("kpi_total")}</span></div>
        {tile("normal", counts.normal, t("kpi_normal"), "kpi-normal")}
        {tile("warning", counts.warning, t("kpi_warning"), "kpi-warning")}
        {tile("critical", counts.critical, t("kpi_critical"), "kpi-critical")}
      </div>
      <p className="muted small" data-testid="offline-note">{t("kpi_offline", { n: counts.offline })}</p>
      <Insights scope={scope} alerts={alerts} profile={f.profile} corridor={corridor}
        onProfile={(p) => setF({ ...f, profile: p })} onCorridor={setCorridor} />
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
      {corridor ? <p className="chips"><button type="button" className="chip on" onClick={() => setCorridor(null)} data-testid="corridor-chip">{t("corridor_chip", { c: corridor })} <span aria-hidden="true">×</span><span className="sr-only">{t("clear_filters")}</span></button></p> : null}
      <div className="grid-main" id="fleet-map">
        <section className="card map-card">
          <KsaMap label={t("map_label")} dots={dots} onSelect={setSelected} zoomLabels={{ in: t("zoom_in"), out: t("zoom_out"), reset: t("zoom_reset") }}
            legend={{ title: t("legend_title"), items: [{ color: STATUS_COLOR.normal, text: t("status_normal") }, { color: STATUS_COLOR.warning, text: t("status_warning") }, { color: STATUS_COLOR.critical, text: t("legend_critical_pulse"), pulse: true }, { color: "#5f6b80", text: t("legend_offline"), hollow: true }] }} hint={t("map_hint")} truck={sel ? { lon: sel.lon, lat: sel.lat } : null}
            cities={Object.values(CITIES).map((c) => ({ id: c.id, lon: c.lon, lat: c.lat, name: c[lang] }))} />
          <p className="muted small" aria-live="polite" data-testid="showing">{t("showing", { shown: filtered.length.toLocaleString("en-US"), total: scope.length.toLocaleString("en-US") })}</p>
        </section>
        <aside className="side">
          {sel ? (
            <section className="card twin" data-testid="selected-card">
              <div className="twin-head">
                <ContainerIcon status={sel.status} reefer={sel.reefer} size={64} led />
                <div><h2>{sel.id}</h2><p className="muted small">{sel.origin} → {sel.destination}</p></div>
                <StatusPill status={sel.status} />
              </div>
              <div className="twin-body">
                <div className="twin-temp">
                  <Thermo value={sel.tempC} lo={selProfile?.tMin ?? 0} hi={selProfile?.tMax ?? 8} set={sel.setpointC} label={`${sel.tempC} °C`} />
                  <span className="twin-read">{sel.tempC} °C</span>
                  <span className="muted small">{sel.rh}% RH</span>
                </div>
                <dl className="twin-stats">
                  <div><dt>{t("stat_speed")}</dt><dd><SpeedDial kmh={sel.speedKmh} /><span>{Math.round(sel.speedKmh)} km/h</span></dd></div>
                  <div><dt>{t("health_score")}</dt><dd><HealthRing value={sel.healthScore} size={56} /></dd></div>
                  <div><dt>{t("stat_battery")}</dt><dd><BatteryIcon pct={sel.batteryPct} /><span>{Math.round(sel.batteryPct)}%</span></dd></div>
                  <div><dt>{t("stat_signal")}</dt><dd><SignalBars n={sel.signal} /><span>{sel.signal}/5</span></dd></div>
                  <div><dt>{t("stat_door")}</dt><dd><DoorIcon open={sel.door === "open"} /><span>{t(`door_${sel.door}` as const)}</span></dd></div>
                </dl>
              </div>
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
          <div className="table-wrap"><table className="table" data-testid="fleet-table">
            <thead><tr>{th("id", "ID")}{th("cargo", t("cargo"))}{th("route", t("route"))}{th("temp", t("temp"))}{th("health", t("health_score"))}<th><span className="sr-only">{t("kpi_total")}</span></th></tr></thead>
            <tbody>
              {sorted.slice(0, limit).map((c) => (
                <tr key={c.id} data-testid="fleet-row" className={c.id === selected ? "row-sel" : undefined} onMouseEnter={() => setHovered(c.id)} onMouseLeave={() => setHovered(null)}>
                  <td><span className="idcell"><ContainerIcon status={c.status} reefer={c.reefer} size={34} /><Link href={`/container/?id=${c.id}`}>{c.id}</Link></span></td>
                  <td>{cargoName(c)}</td>
                  <td>{c.origin} → {c.destination}</td>
                  <td>{c.tempC} °C</td>
                  <td><span className="hcell">{Math.round(c.healthScore)}<span className="hbar" aria-hidden="true"><i className={c.healthScore >= 80 ? "g" : c.healthScore >= 55 ? "a" : "r"} style={{ width: `${Math.round(c.healthScore)}%` }} /></span></span></td>
                  <td><StatusPill status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        {filtered.length > 12 ? (
          <div className="table-foot">
            <span />
            {limit < filtered.length ? <button type="button" className="btn small ghost" onClick={() => setLimit((n) => n + 12)} data-testid="show-more">{t("show_more")}</button> : null}
            {limit > 12 ? <button type="button" className="btn small ghost" onClick={() => setLimit(12)} data-testid="show-fewer">{t("show_fewer")}</button> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
