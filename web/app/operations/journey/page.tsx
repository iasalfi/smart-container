"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "../../providers";
import { ApiGate, Card, NotFoundState } from "@/components/ui";
import { JourneyMap } from "@/components/JourneyMap";
import { KIND_COLOR, MilestoneIcon } from "@/components/OpsArt";
import { CITIES } from "@/lib/cities";
import {
  SKIPPABLE, cancelJourney, completeNext, currentDelayMin, delayOf, etaMs, journeyStatus, milestoneLate, nextMilestone, progressShare, skipNext, type Journey,
} from "@/lib/journey";
import { fmtDuration, fmtTime } from "@/lib/opsfmt";
import { getProfile } from "@/lib/profiles";

export default function Page() {
  return <Suspense fallback={<p className="state" aria-busy="true">…</p>}><View /></Suspense>;
}

function View() {
  const id = useSearchParams().get("id") ?? "";
  const { t, journeys, fleet, alertsReady, apiError, retry, persona } = useApp();
  if (!fleet || !alertsReady) return <ApiGate error={apiError} onRetry={retry} />;
  if (persona === "customer") return <NotFoundState title={t("not_allowed_title")} body={t("not_allowed_body")} />;
  const j = journeys.find((x) => x.id === id);
  if (!j) return <NotFoundState title={t("ops_nf_title")} body={t("ops_nf_body")} />;
  return <Detail j={j} live={fleet.some((c) => c.id === j.containerId)} />;
}

function Detail({ j, live }: { j: Journey; live: boolean }) {
  const { t, lang, saveJourney } = useApp();
  const [delay, setDelay] = useState("0");
  const [err, setErr] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const city = (id: string) => (lang === "ar" ? CITIES[id].ar : CITIES[id].en);
  const status = journeyStatus(j);
  const next = nextMilestone(j);
  const d = currentDelayMin(j);
  const profile = getProfile(j.profileId);
  const share = Math.round(progressShare(j) * 100);
  const active = status !== "completed" && status !== "cancelled";
  const doLog = () => {
    const n = Number(delay);
    if (delay.trim() === "" || !Number.isFinite(n) || Math.abs(n) > 1440) { setErr(t("ops_err_delay")); return; }
    setErr(null);
    try { saveJourney(completeNext(j, n)); } catch { setErr(t("ops_err_delay")); }
  };
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="muted small"><Link href="/operations/">{t("ops_back")}</Link></p>
          <h1 data-testid="journey-title">{j.id}</h1>
          <p className="muted">{city(j.input.originId)} → {city(j.input.destinationId)} · {j.customer}</p>
        </div>
        <span className={`pill pjs-${status}`} data-testid="journey-status">{t(`ops_status_${status}` as const)}</span>
      </div>

      <section className="ops-kpis" aria-label={t("ops_summary")}>
        <div className="ik" data-testid="journey-distance"><b>{j.plan.totalKm} km</b><span>{t("ops_k_distance")}</span></div>
        <div className="ik" data-testid="journey-planned"><b>{fmtTime(j.plan.arriveMs, lang)}</b><span>{t("ops_k_planned_arrival")}</span></div>
        <div className={`ik ${d > 15 ? "warn" : ""}`} data-testid="journey-eta"><b>{fmtTime(etaMs(j), lang)}</b><span>{t("ops_k_eta")}</span></div>
        <div className={`ik ${d > 15 ? "warn" : ""}`} data-testid="journey-delay"><b>{d === 0 ? t("ops_on_time") : d > 0 ? `+${fmtDuration(d, lang)}` : `−${fmtDuration(-d, lang)}`}</b><span>{t("ops_k_delay")}</span></div>
        <div className="ik" data-testid="journey-progress"><b>{share}%</b><span>{t("ops_k_progress")}</span></div>
      </section>

      <div className="grid-main">
        <Card title={t("ops_plan_map")} testid="journey-map">
          <JourneyMap plan={j.plan} journey={j} />
          <ul className="pin-key small" aria-label={t("ops_pin_key")}>
            {(["rest", "fuel", "overnight", "waypoint", "customs", "port_gate"] as const).map((k) => (
              <li key={k}><i style={{ background: KIND_COLOR[k] }} /> {t(`ms_kind_${k}` as const)}</li>
            ))}
          </ul>
        </Card>
        <div className="side">
          <Card title={t("ops_details")} testid="journey-details">
            <dl className="facts">
              <div><dt>{t("ops_f_container")}</dt><dd>{live ? <Link href={`/container/?id=${j.containerId}`}>{j.containerId}</Link> : j.containerId}</dd></div>
              <div><dt>{t("ops_f_profile")}</dt><dd>{lang === "ar" ? profile?.name.ar : profile?.name.en}{j.setpointC !== null ? ` · ${j.setpointC} °C` : ""}</dd></div>
              <div><dt>{t("ops_f_plate")}</dt><dd>{j.plate}</dd></div>
              <div><dt>{t("ops_f_driver")}</dt><dd>{j.driverName} · {j.driverPhone}</dd></div>
              <div><dt>{t("ops_f_seal")}</dt><dd>{j.sealNo}</dd></div>
              <div><dt>{t("ops_f_speed")}</dt><dd>{j.input.speedKmh} km/h</dd></div>
            </dl>
          </Card>
          {active ? (
            <Card title={t("ops_log_title")} testid="log-card">
              {next ? <p data-testid="next-milestone">{t("ops_next", { what: t(`ms_kind_${next.kind}` as const) })} · {fmtTime(next.plannedAt, lang)}</p> : null}
              <label className="stack">{t("ops_delay_label")}
                <input type="number" inputMode="numeric" value={delay} onChange={(e) => setDelay(e.target.value)} min={-1440} max={1440} data-testid="delay-input" />
              </label>
              {err ? <p className="err" role="alert" data-testid="log-error">{err}</p> : null}
              <div className="td-row">
                <button type="button" className="btn" onClick={doLog} disabled={!next} data-testid="log-next-btn">{t("ops_log_btn")}</button>
                {next && SKIPPABLE.includes(next.kind) ? <button type="button" className="btn ghost" onClick={() => saveJourney(skipNext(j))} data-testid="skip-btn">{t("ops_skip_btn")}</button> : null}
                {!confirmCancel ? <button type="button" className="btn ghost" onClick={() => setConfirmCancel(true)} data-testid="cancel-btn">{t("ops_cancel_btn")}</button> : (
                  <span className="td-row" data-testid="cancel-confirm">
                    <span>{t("ops_cancel_ask")}</span>
                    <button type="button" className="btn danger" onClick={() => { saveJourney(cancelJourney(j)); setConfirmCancel(false); }} data-testid="cancel-yes">{t("ops_cancel_yes")}</button>
                    <button type="button" className="btn ghost" onClick={() => setConfirmCancel(false)}>{t("ops_cancel_no")}</button>
                  </span>
                )}
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      <Card title={t("ops_milestones")} testid="milestones">
        <ol className="mslist">
          {j.plan.milestones.map((m) => {
            const dl = delayOf(m);
            return (
              <li key={m.id} className={`msrow ms-${m.status}${milestoneLate(m) ? " ms-late" : ""}`} data-testid="ms-row" data-kind={m.kind} data-status={m.status}>
                <span className="msicon" style={{ color: KIND_COLOR[m.kind] }}><MilestoneIcon kind={m.kind} /></span>
                <div className="msbody">
                  <strong>{t(`ms_kind_${m.kind}` as const)}{m.city ? ` · ${city(m.city)}` : ""}</strong>
                  <span className="muted small">{m.city ? "" : `km ${m.km} · `}{m.dwellMin > 0 ? t("ops_dwell", { m: fmtDuration(m.dwellMin, lang) }) : t("ops_no_dwell")}</span>
                </div>
                <div className="mstimes">
                  <span>{t("ops_planned")} {fmtTime(m.plannedAt, lang)}</span>
                  {m.status === "done" && m.actualAt !== undefined ? <span>{t("ops_actual")} {fmtTime(m.actualAt, lang)}{dl !== null && dl !== 0 ? <b className={dl > 15 ? "late" : "early"}> {dl > 0 ? `+${dl}` : dl} min</b> : null}</span> : null}
                </div>
                <span className={`mstate ms-s-${m.status}`} data-testid="ms-status">{t(`ms_status_${m.status}` as const)}</span>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
