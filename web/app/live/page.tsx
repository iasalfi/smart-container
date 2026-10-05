"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp, CUSTOMER_PERSONA_NAME } from "../providers";
import { ApiGate } from "@/components/ui";
import { LiveMap, type LiveCity, type LiveLine, type LivePin, type LivePoint, type LiveTruck } from "@/components/LiveMap";
import { STATUS_COLOR } from "@/components/ui";
import { scopeOf } from "@/lib/analytics";
import { CITIES, ROUTES } from "@/lib/cities";
import { getRoute } from "@/lib/geo";
import { planJourney, validatePlan, type PlanInput } from "@/lib/journey";
import { fmtDuration, fmtTime } from "@/lib/opsfmt";
import { advanceShare, boundsOf, corridorCoords, cumulativeKm, estimateRoad, pointAtShare, roadFromCoords, sliceToShare, type Coord, type Road } from "@/lib/roads";
import { fetchRoads } from "@/lib/roads-client";
import type { Key } from "@/lib/i18n";
import type { Container, Status } from "@/lib/types";

/** One second on screen is one minute on the road. */
const CLOCK_X = 60;
const TICK_MS = 2000;
const KINDS = ["rest", "fuel", "overnight", "waypoint", "customs", "port_gate"];
const KIND_COLOR: Record<string, string> = { rest: "#6fa585", fuel: "#dcae5f", overnight: "#4a56d9", waypoint: "#8794a8", customs: "#c9695d", port_gate: "#2b3a55" };
const ROUTE_COLOR = "#5a66f1";
const AHEAD_COLOR = "#8794a8";
const FILTERS: (Status | "all")[] = ["all", "critical", "warning", "normal"];

function tomorrowAt6(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T06:00`;
}

const corridorFallback = (routeId: string): Road => { const r = getRoute(routeId)!; return roadFromCoords(corridorCoords(r), "estimate"); };

export default function LivePage() {
  const { t, persona, fleet, apiError, retry } = useApp();
  const [tab, setTab] = useState<"track" | "plan">("track");
  const [wantId, setWantId] = useState<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setWantId(q.get("id"));
    if (q.get("tab") === "plan") setTab("plan");
  }, []);
  useEffect(() => { if (persona === "customer") setTab("track"); }, [persona]);
  if (!fleet) return <ApiGate error={apiError} onRetry={retry} />;
  const planAllowed = persona !== "customer";
  return (
    <div className="page" data-testid="live-page" data-persona={persona} data-tab={tab}>
      <div className="page-head">
        <div>
          <h1>{t("lv_title")}</h1>
          <p className="muted" data-testid="live-sub">{t(`lv_sub_${persona}` as Key)}</p>
        </div>
        <div className="live-tabs" role="group" aria-label={t("lv_title")}>
          <button type="button" aria-pressed={tab === "track"} onClick={() => setTab("track")} data-testid="live-tab-track">{t("lv_tab_track")}</button>
          {planAllowed ? <button type="button" aria-pressed={tab === "plan"} onClick={() => setTab("plan")} data-testid="live-tab-plan">{t("lv_tab_plan")}</button> : null}
        </div>
      </div>
      {tab === "track" ? <Tracking fleet={fleet} wantId={wantId} /> : <Planner />}
    </div>
  );
}

function Tracking({ fleet, wantId }: { fleet: Container[]; wantId: string | null }) {
  const { t, lang, persona } = useApp();
  const scope = useMemo(() => scopeOf(persona, fleet, CUSTOMER_PERSONA_NAME), [persona, fleet]);
  const [status, setStatus] = useState<Status | "all">("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [follow, setFollow] = useState(false);
  const [live, setLive] = useState(true);
  const [roads, setRoads] = useState<Record<string, Road>>({});
  const [selRoad, setSelRoad] = useState<Road | null>(null);
  /** How far each truck has driven since the page opened, as a share of its road. Missing means the fleet snapshot value. */
  const [adv, setAdv] = useState<Record<string, number>>({});
  const [stamp, setStamp] = useState(() => Date.now());
  const taken = useRef(false);

  // the corridors the visible fleet drives on, as real roads
  const routeIds = useMemo(() => [...new Set(scope.map((c) => c.routeId))], [scope]);
  useEffect(() => {
    let dead = false;
    for (const id of routeIds) {
      const r = getRoute(id)!;
      fetchRoads([CITIES[r.from], CITIES[r.to]], () => corridorFallback(id)).then((rs) => { if (!dead) setRoads((old) => (old[id] === rs[0] ? old : { ...old, [id]: rs[0] })); });
    }
    return () => { dead = true; };
  }, [routeIds]);
  const cums = useMemo(() => { const o: Record<string, number[]> = {}; for (const [k, r] of Object.entries(roads)) o[k] = cumulativeKm(r.coords); return o; }, [roads]);

  // a link from another page can name a container
  useEffect(() => { if (wantId && !taken.current && scope.some((c) => c.id === wantId)) { taken.current = true; setSelected(wantId); } }, [wantId, scope]);
  // a persona change can take the selected container out of scope
  useEffect(() => { if (selected && !scope.some((c) => c.id === selected)) { setSelected(null); setFollow(false); } }, [scope, selected]);

  const sel = useMemo(() => scope.find((c) => c.id === selected) ?? null, [scope, selected]);
  useEffect(() => {
    setSelRoad(null);
    if (!sel) return;
    let dead = false;
    const r = getRoute(sel.routeId)!;
    fetchRoads([CITIES[r.from], CITIES[r.to]], () => corridorFallback(sel.routeId), { full: true }).then((rs) => { if (!dead) setSelRoad(rs[0]); });
    return () => { dead = true; };
  }, [sel]);
  const selCum = useMemo(() => (selRoad ? cumulativeKm(selRoad.coords) : null), [selRoad]);

  // the live clock: moving trucks advance along their road
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => {
      setAdv((prev) => {
        const next = { ...prev };
        for (const c of scope) {
          if (!c.online || c.speedKmh <= 0) continue;
          const road = roads[c.routeId];
          if (!road) continue;
          next[c.id] = advanceShare(prev[c.id] ?? c.progress, c.speedKmh, road.km, (TICK_MS / 1000) * CLOCK_X);
        }
        return next;
      });
      setStamp(Date.now());
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [live, scope, roads]);

  const where = (c: Container) => {
    const share = adv[c.id] ?? c.progress;
    if (c.id === selected && selRoad && selCum) { const p = pointAtShare(selRoad.coords, share, selCum); return { lon: p.lon, lat: p.lat, bearing: p.bearing, share }; }
    const road = roads[c.routeId];
    if (road && cums[c.routeId]) { const p = pointAtShare(road.coords, share, cums[c.routeId]); return { lon: p.lon, lat: p.lat, bearing: p.bearing, share }; }
    return { lon: c.lon, lat: c.lat, bearing: c.headingDeg, share };
  };

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return scope.filter((c) => (status === "all" || c.status === status) && (!k || [c.id, c.plate, c.driver].some((x) => x.toLowerCase().includes(k))));
  }, [scope, status, q]);
  const list = useMemo(() => [...shown].sort((a, b) => ["critical", "warning", "normal"].indexOf(a.status) - ["critical", "warning", "normal"].indexOf(b.status) || a.id.localeCompare(b.id)).slice(0, 8), [shown]);

  const points: LivePoint[] = useMemo(() => shown.map((c) => { const w = where(c); return { id: c.id, lon: w.lon, lat: w.lat, color: c.online ? STATUS_COLOR[c.status] : "#8794a8", selected: c.id === selected, tip: `${c.id} · ${t(`status_${c.status}` as const)} · ${Math.round(c.speedKmh)} km/h` }; }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shown, selected, roads, cums, selRoad, selCum, adv, t]);

  const sw = sel ? where(sel) : null;
  const roadForSel = selRoad ?? (sel ? roads[sel.routeId] ?? null : null);
  const lines: LiveLine[] = useMemo(() => {
    if (!sel || !roadForSel || !sw) return [];
    const done = sliceToShare(roadForSel.coords, sw.share);
    return [{ id: "ahead", coords: roadForSel.coords, color: AHEAD_COLOR, width: 4, dashed: true }, { id: "done", coords: done.length > 1 ? done : roadForSel.coords.slice(0, 2), color: ROUTE_COLOR, width: 5 }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, roadForSel, adv]);

  const truck: LiveTruck | null = sel && sw ? { lon: sw.lon, lat: sw.lat, bearing: sw.bearing, label: t("lv_truck_label", { id: sel.id, p: Math.round(sw.share * 100) }) } : null;
  const cities: LiveCity[] = useMemo(() => Object.values(CITIES).map((c) => ({ id: c.id, lon: c.lon, lat: c.lat, name: c[lang] })), [lang]);
  const pins: LivePin[] = useMemo(() => (sel ? [CITIES[getRoute(sel.routeId)!.from], CITIES[getRoute(sel.routeId)!.to]].map((c, i) => ({ id: `end-${i}`, lon: c.lon, lat: c.lat, color: i === 0 ? "#6fa585" : "#c9695d", label: `${i === 0 ? t("lv_plan_origin") : t("lv_plan_dest")} ${c[lang]}` })) : []), [sel, lang, t]);
  const bounds = useMemo(() => (roadForSel ? boundsOf(roadForSel.coords) : boundsOf(Object.values(CITIES).map((c) => [c.lon, c.lat] as Coord))), [roadForSel]);
  const fitKey = sel ? `sel-${sel.id}-${roadForSel?.source ?? "none"}` : "fleet";

  const remainingKm = sel && roadForSel && sw ? roadForSel.km * (1 - sw.share) : 0;
  const etaMin = sel && sel.speedKmh > 0 ? Math.round((remainingKm / sel.speedKmh) * 60) : 0;
  const time = new Date(stamp).toLocaleTimeString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="live-grid" data-testid="live-track">
      <aside className="live-side card">
        <h2>{t("lv_list_title")}</h2>
        {persona === "customer" ? <p className="muted small" data-testid="live-scope">{t("lv_scope_customer", { c: CUSTOMER_PERSONA_NAME })}</p> : null}
        <label className="live-search"><span className="sr-only">{t("lv_search")}</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("lv_search")} data-testid="live-search" />
        </label>
        <div className="live-filters" role="group" aria-label={t("lv_filter_label")}>
          {FILTERS.map((f) => <button key={f} type="button" aria-pressed={status === f} onClick={() => setStatus(f)} data-testid={`live-status-${f}`}>{f === "all" ? t("lv_filter_all") : t(`status_${f}` as const)}</button>)}
        </div>
        <p className="muted small" data-testid="live-count" data-n={shown.length} data-total={scope.length}>{t("lv_showing", { n: shown.length.toLocaleString("en-US"), m: scope.length.toLocaleString("en-US") })}</p>
        {list.length === 0 ? <p className="state-inline" role="status" data-testid="live-none">{t("lv_none")}</p> : (
          <ul className="live-list" data-testid="live-list">
            {list.map((c) => (
              <li key={c.id}>
                <button type="button" className="live-item" aria-pressed={c.id === selected} onClick={() => { setSelected(c.id); setFollow(false); }} data-testid="live-item" data-id={c.id}>
                  <span className={`pill pill-${c.status}`}>{t(`status_${c.status}` as const)}</span>
                  <b>{c.id}</b>
                  <span className="muted small">{c.origin} → {c.destination}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <section className="live-main">
        <div className="live-bar">
          <span className={`live-badge${live ? " on" : ""}`} data-testid="live-badge" data-live={live ? "1" : "0"}><i aria-hidden="true" />{live ? t("lv_live") : t("lv_paused")}</span>
          <span className="muted small" data-testid="live-updated">{t("lv_updated", { t: time })}</span>
          <button type="button" className="btn-sm" onClick={() => setLive((v) => !v)} data-testid="live-toggle">{live ? t("lv_pause") : t("lv_resume")}</button>
          <span className="muted small live-note">{t("lv_clock_note")}</span>
        </div>
        <LiveMap label={t("lv_map_label")} points={points} lines={lines} pins={pins} cities={cities} truck={truck} fitKey={fitKey} bounds={bounds} follow={follow}
          onSelect={(id) => { setSelected(id); setFollow(false); }} zoomLabels={{ in: t("zoom_in"), out: t("zoom_out"), fit: t("lv_fit") }} credit={t("lv_credit")} basemapNote={{ online: "", offline: t("lv_basemap_offline") }} />
        <div className="card live-panel" data-testid="live-panel" data-selected={sel ? sel.id : ""}>
          {!sel ? <p className="muted" data-testid="live-hint">{t("lv_select_hint")}</p> : (
            <>
              <div className="live-panel-head">
                <h2 data-testid="live-sel-id">{sel.id}</h2>
                <span className={`pill pill-${sel.status}`}>{t(`status_${sel.status}` as const)}</span>
                <span className="muted small" data-testid="live-road-source" data-source={roadForSel?.source ?? "loading"}>{roadForSel ? t(roadForSel.source === "road" ? "lv_road_road" : "lv_road_estimate") : t("lv_loading_road")}</span>
              </div>
              <dl className="dl live-dl">
                <dt>{t("lv_sel_route")}</dt><dd>{sel.origin} → {sel.destination}</dd>
                <dt>{t("lv_sel_speed")}</dt><dd data-testid="live-sel-speed">{sel.speedKmh > 0 ? t("tip_speed", { v: Math.round(sel.speedKmh) }) : t("lv_stopped")}</dd>
                <dt>{t("lv_sel_temp")}</dt><dd>{sel.tempC} °C</dd>
                <dt>{t("lv_sel_progress")}</dt><dd data-testid="live-sel-progress">{Math.round((sw?.share ?? sel.progress) * 100)}%</dd>
                <dt>{t("lv_sel_left")}</dt><dd data-testid="live-sel-left">{roadForSel ? t("lv_km", { n: Math.round(remainingKm).toLocaleString("en-US") }) : "…"}</dd>
                <dt>{t("lv_sel_eta")}</dt><dd data-testid="live-sel-eta">{sel.speedKmh > 0 && roadForSel ? t("lv_eta_value", { h: Math.floor(etaMin / 60), m: etaMin % 60 }) : "…"}</dd>
              </dl>
              <div className="live-actions">
                <button type="button" className="btn-sm" aria-pressed={follow} onClick={() => setFollow((v) => !v)} data-testid="live-follow">{follow ? t("lv_following") : t("lv_follow")}</button>
                <Link className="btn-sm" href={`/container/?id=${sel.id}`} data-testid="live-open">{t("lv_open")}</Link>
                <Link className="btn-sm" href={`/route/?id=${sel.id}`}>{t("lv_open_route")}</Link>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function Planner() {
  const { t, lang } = useApp();
  const cityName = (id: string) => CITIES[id][lang];
  const [input, setInput] = useState<PlanInput>({ originId: "jeddah", destinationId: "riyadh", viaIds: [], departAt: tomorrowAt6(), speedKmh: 80, reefer: true, customs: false, deliverBy: "" });
  const [roads, setRoads] = useState<Road[] | null>(null);
  const [alt, setAlt] = useState(0);
  const errors = useMemo(() => validatePlan(input), [input]);
  const plan = useMemo(() => (errors.length === 0 ? planJourney(input) : null), [input, errors]);
  const stops = useMemo(() => [input.originId, ...input.viaIds, input.destinationId].filter(Boolean), [input]);
  const stopsKey = stops.join(">");

  useEffect(() => {
    setAlt(0);
    if (errors.length > 0) { setRoads(null); return; }
    let dead = false;
    setRoads(null);
    const pts = stops.map((id) => CITIES[id]);
    fetchRoads(pts, () => estimateRoad(pts), { alternatives: pts.length === 2, full: true }).then((rs) => { if (!dead) setRoads(rs); });
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopsKey, errors.length]);

  const road = roads ? roads[Math.min(alt, roads.length - 1)] : null;
  const set = (patch: Partial<PlanInput>) => setInput((o) => ({ ...o, ...patch }));
  const setVia = (i: number, id: string) => { const v = [...input.viaIds]; if (id) v[i] = id; else v.splice(i, 1); set({ viaIds: v.filter(Boolean) }); };

  const cum = useMemo(() => (road ? cumulativeKm(road.coords) : null), [road]);
  const pins: LivePin[] = useMemo(() => {
    if (!plan || !road || !cum) return [];
    return plan.milestones.filter((m) => KINDS.includes(m.kind)).map((m) => {
      const p = pointAtShare(road.coords, plan.totalKm > 0 ? m.km / plan.totalKm : 0, cum);
      return { id: m.id, lon: p.lon, lat: p.lat, color: KIND_COLOR[m.kind], label: `${t(`ms_kind_${m.kind}` as Key)} · km ${Math.round(road.km * (plan.totalKm > 0 ? m.km / plan.totalKm : 0))}` };
    });
  }, [plan, road, cum, t]);
  const lines: LiveLine[] = useMemo(() => {
    if (!roads) return [];
    const out: LiveLine[] = roads.map((r, i) => ({ id: `alt-${i}`, coords: r.coords, color: i === alt ? ROUTE_COLOR : AHEAD_COLOR, width: i === alt ? 6 : 4, dashed: i !== alt }));
    return [...out.filter((l) => l.id !== `alt-${alt}`), ...out.filter((l) => l.id === `alt-${alt}`)];
  }, [roads, alt]);
  const cities: LiveCity[] = useMemo(() => stops.map((id) => ({ id, lon: CITIES[id].lon, lat: CITIES[id].lat, name: cityName(id) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stopsKey, lang]);
  const bounds = useMemo(() => (road ? boundsOf(road.coords) : boundsOf(Object.values(CITIES).map((c) => [c.lon, c.lat] as Coord))), [road]);

  const driveMin = road ? Math.round((road.km / input.speedKmh) * 60) : 0;
  const arriveMs = plan && road ? plan.departMs + (driveMin + plan.stopMin) * 60000 : 0;
  const cityOptions = Object.values(CITIES);
  const viaSlots = Math.min(2, input.viaIds.length + 1);

  return (
    <div className="live-grid" data-testid="live-plan">
      <aside className="live-side card">
        <h2>{t("lv_plan_title")}</h2>
        <p className="muted small">{t("lv_plan_sub")}</p>
        <div className="live-form">
          <label>{t("lv_plan_origin")}
            <select value={input.originId} onChange={(e) => set({ originId: e.target.value })} data-testid="plan-origin">
              <option value="">{t("lv_plan_choose")}</option>
              {cityOptions.map((c) => <option key={c.id} value={c.id}>{c[lang]}</option>)}
            </select>
          </label>
          {Array.from({ length: viaSlots }, (_, i) => (
            <label key={i}>{t("lv_plan_via", { n: i + 1 })}
              <select value={input.viaIds[i] ?? ""} onChange={(e) => setVia(i, e.target.value)} data-testid={`plan-via-${i + 1}`}>
                <option value="">{t("lv_plan_none")}</option>
                {cityOptions.map((c) => <option key={c.id} value={c.id}>{c[lang]}</option>)}
              </select>
            </label>
          ))}
          <label>{t("lv_plan_dest")}
            <select value={input.destinationId} onChange={(e) => set({ destinationId: e.target.value })} data-testid="plan-dest">
              <option value="">{t("lv_plan_choose")}</option>
              {cityOptions.map((c) => <option key={c.id} value={c.id}>{c[lang]}</option>)}
            </select>
          </label>
          <label>{t("lv_plan_depart")}
            <input type="datetime-local" value={input.departAt} onChange={(e) => set({ departAt: e.target.value })} data-testid="plan-depart" />
          </label>
          <label>{t("lv_plan_speed")}
            <input type="number" min={40} max={100} value={input.speedKmh} onChange={(e) => set({ speedKmh: Number(e.target.value) })} data-testid="plan-speed" />
          </label>
          <label className="check"><input type="checkbox" checked={input.reefer} onChange={(e) => set({ reefer: e.target.checked })} />{t("lv_plan_reefer")}</label>
          <label className="check"><input type="checkbox" checked={input.customs} onChange={(e) => set({ customs: e.target.checked })} />{t("lv_plan_customs")}</label>
        </div>
        {errors.length > 0 ? (
          <div className="state-inline" role="alert" data-testid="plan-errors"><b>{t("lv_plan_fix")}</b>
            <ul>{errors.map((e) => <li key={e}>{t(`ops_err_${e}` as Key)}</li>)}</ul>
          </div>
        ) : null}
        <Link className="btn-sm" href="/operations/new/" data-testid="plan-wizard">{t("lv_plan_wizard")}</Link>
      </aside>
      <section className="live-main">
        <LiveMap label={t("lv_map_label")} lines={lines} pins={pins} cities={cities} fitKey={`plan-${stopsKey}-${road?.source ?? "none"}`} bounds={bounds}
          zoomLabels={{ in: t("zoom_in"), out: t("zoom_out"), fit: t("lv_fit") }} credit={t("lv_credit")} basemapNote={{ online: "", offline: t("lv_basemap_offline") }} />
        <div className="card live-panel" data-testid="plan-summary" data-source={road?.source ?? "none"}>
          {errors.length > 0 || !plan ? <p className="muted">{t("lv_plan_fix")}</p> : !road ? <p className="muted" role="status">{t("lv_loading_road")}</p> : (
            <>
              <h2>{t("lv_plan_summary")}</h2>
              <p className="muted small">{stops.map(cityName).join(" → ")}</p>
              <dl className="dl live-dl">
                <dt>{t("lv_plan_km")}</dt><dd data-testid="plan-km">{t("lv_km", { n: Math.round(road.km).toLocaleString("en-US") })}</dd>
                <dt>{t("lv_plan_drive")}</dt><dd data-testid="plan-drive">{fmtDuration(driveMin, lang)}</dd>
                <dt>{t("lv_plan_stops")}</dt><dd data-testid="plan-stoptime">{fmtDuration(plan.stopMin, lang)}</dd>
                <dt>{t("lv_plan_eta")}</dt><dd data-testid="plan-eta">{fmtTime(arriveMs, lang)}</dd>
              </dl>
              {road.source === "estimate" ? <p className="muted small" data-testid="plan-estimate">{t("lv_plan_estimate")}</p> : null}
              {plan.warnings.length > 0 ? <ul className="plan-warn" data-testid="plan-warnings">{plan.warnings.map((w) => <li key={w}>{t(`ops_warn_${w}` as Key)}</li>)}</ul> : null}
              {roads && roads.length > 1 ? (
                <div role="group" aria-label={t("lv_plan_alts")} className="live-alts" data-testid="plan-alts">
                  <b>{t("lv_plan_alts")}</b>
                  {roads.map((r, i) => <button key={i} type="button" aria-pressed={i === alt} onClick={() => setAlt(i)} data-testid={`plan-alt-${i}`}>{t("lv_plan_alt", { n: i + 1, km: Math.round(r.km).toLocaleString("en-US"), d: fmtDuration(Math.round((r.km / input.speedKmh) * 60), lang) })}</button>)}
                </div>
              ) : null}
              <h3>{t("lv_plan_pitstops")}</h3>
              <ol className="plan-stops" data-testid="plan-stops">
                {pins.map((p) => <li key={p.id} data-testid="plan-stop">{p.label}</li>)}
              </ol>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
