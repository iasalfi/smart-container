"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "../providers";
import { ApiGate, NotFoundState } from "@/components/ui";
import { CITIES } from "@/lib/cities";
import { etaMs, currentDelayMin, journeyStatus, nextMilestone, progressShare, type Journey, type JourneyStatus } from "@/lib/journey";
import { fmtDuration, fmtTime } from "@/lib/opsfmt";
import { getProfile } from "@/lib/profiles";

const COLUMNS: JourneyStatus[] = ["planned", "dispatched", "in_transit", "delayed", "completed"];

export default function OperationsPage() {
  const { t, lang, journeys, fleet, alertsReady, apiError, retry, persona } = useApp();
  const [tab, setTab] = useState<"journeys" | "assets">("journeys");
  const [q, setQ] = useState("");
  const city = (id: string) => (lang === "ar" ? CITIES[id].ar : CITIES[id].en);
  const rows = useMemo(() => journeys.map((j) => ({ j, status: journeyStatus(j) })), [journeys]);
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return rows.filter(({ j }) => !k || [j.id, j.containerId, j.customer, j.driverName, j.plate].some((x) => x.toLowerCase().includes(k)));
  }, [rows, q]);
  const count = (s: JourneyStatus) => rows.filter((r) => r.status === s).length;
  if (!fleet || !alertsReady) return <ApiGate error={apiError} onRetry={retry} />;
  if (persona === "customer") return <NotFoundState title={t("not_allowed_title")} body={t("not_allowed_body")} />;

  const card = (j: Journey, status: JourneyStatus) => {
    const next = nextMilestone(j);
    const delay = currentDelayMin(j);
    return (
      <li key={j.id} className={`jcard jc-${status}`} data-testid="journey-card" data-status={status} data-id={j.id}>
        <div className="jc-top"><Link href={`/operations/journey/?id=${j.id}`} data-testid="journey-link"><b>{j.id}</b></Link><span className="muted">{j.containerId}</span></div>
        <div className="jc-route">{city(j.input.originId)} → {city(j.input.destinationId)}{j.input.viaIds.length ? <span className="muted"> · {t("ops_via_n", { n: j.input.viaIds.length })}</span> : null}</div>
        <div className="muted small">{j.customer} · {lang === "ar" ? getProfile(j.profileId)?.name.ar : getProfile(j.profileId)?.name.en}</div>
        <div className="bar" role="img" aria-label={t("ops_progress_label", { p: Math.round(progressShare(j) * 100) })}><i style={{ width: `${Math.round(progressShare(j) * 100)}%` }} /></div>
        <div className="small">{status === "completed" ? t("ops_delivered_at", { t: fmtTime(j.plan.milestones[j.plan.milestones.length - 1].actualAt ?? j.plan.arriveMs, lang) }) : t("ops_eta", { t: fmtTime(etaMs(j), lang) })}{delay > 0 && status !== "completed" ? <span className="late"> · {t("ops_late_by", { m: fmtDuration(delay, lang) })}</span> : null}</div>
        {next ? <div className="muted small">{t("ops_next", { what: t(`ms_kind_${next.kind}` as const) })}</div> : null}
      </li>
    );
  };

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>{t("ops_title")}</h1><p className="muted">{t("ops_sub")}</p></div>
        <Link href="/operations/new/" className="btn" data-testid="new-journey">{t("ops_new")}</Link>
      </div>
      <section className="ops-kpis" aria-label={t("ops_title")} data-testid="ops-kpis">
        <div className="ik" data-testid="ops-k-planned"><b>{count("planned") + count("dispatched")}</b><span>{t("ops_k_planned")}</span></div>
        <div className="ik" data-testid="ops-k-transit"><b>{count("in_transit")}</b><span>{t("ops_k_transit")}</span></div>
        <div className="ik warn" data-testid="ops-k-delayed"><b>{count("delayed")}</b><span>{t("ops_k_delayed")}</span></div>
        <div className="ik" data-testid="ops-k-done"><b>{count("completed")}</b><span>{t("ops_k_done")}</span></div>
      </section>
      <div className="queues" role="group" aria-label={t("ops_title")}>
        <button type="button" className="queue-tab" aria-pressed={tab === "journeys"} onClick={() => setTab("journeys")} data-testid="tab-journeys">{t("ops_tab_journeys")} <b>{rows.length}</b></button>
        <button type="button" className="queue-tab" aria-pressed={tab === "assets"} onClick={() => setTab("assets")} data-testid="tab-assets">{t("ops_tab_assets")} <b>{rows.length}</b></button>
      </div>
      <div className="filters">
        <label>{t("search")}<input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="J-1001, SC-1043" data-testid="journey-search" /></label>
      </div>
      {shown.length === 0 ? <p className="state-inline" role="status" data-testid="journeys-empty">{t("ops_none")}</p> : tab === "journeys" ? (
        <div className="board" data-testid="journey-board">
          {COLUMNS.map((s) => {
            const col = shown.filter((r) => r.status === s);
            return (
              <section key={s} className={`bcol bc-${s}`} aria-label={t(`ops_status_${s}` as const)} data-testid={`col-${s}`}>
                <h2>{t(`ops_status_${s}` as const)} <span className="muted">{col.length}</span></h2>
                <ul className="jlist">{col.map(({ j }) => card(j, s))}</ul>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="card scroll-x">
          <table className="table" data-testid="assets-table">
            <thead><tr><th>{t("ops_f_container")}</th><th>{t("ops_f_profile")}</th><th>{t("ops_f_plate")}</th><th>{t("ops_f_driver")}</th><th>{t("ops_f_customer")}</th><th>{t("ops_f_seal")}</th><th>{t("ops_tab_journeys")}</th></tr></thead>
            <tbody>
              {shown.map(({ j }) => (
                <tr key={j.id} data-testid="asset-row">
                  <td>{j.containerId}{j.source === "planned" ? <span className="chip new">{t("ops_new_badge")}</span> : null}</td>
                  <td>{lang === "ar" ? getProfile(j.profileId)?.name.ar : getProfile(j.profileId)?.name.en}{j.setpointC !== null ? ` · ${j.setpointC} °C` : ""}</td>
                  <td>{j.plate}</td><td>{j.driverName}<span className="muted"> · {j.driverPhone}</span></td><td>{j.customer}</td><td>{j.sealNo}</td>
                  <td><Link href={`/operations/journey/?id=${j.id}`}>{j.id}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
