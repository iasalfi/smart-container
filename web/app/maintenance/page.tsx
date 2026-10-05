"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useApp } from "../providers";
import { ApiGate, NotFoundState } from "@/components/ui";
import { WO_STAGES, deviceIssues, type WorkOrder } from "@/lib/cases";
import { formatMinutes } from "@/lib/itsm";
import type { Key } from "@/lib/i18n";

export default function MaintenancePage() {
  const { t, persona, fleet, apiError, retry, workOrders, advanceWorkOrder, releaseWorkOrder, raiseDeviceOrder, released, deviceLimits } = useApp();
  const canAct = persona === "operator";
  const issues = useMemo(() => deviceIssues(fleet ?? [], deviceLimits), [fleet, deviceLimits]);
  if (persona === "customer") return <NotFoundState title={t("not_allowed_title")} body={t("not_allowed_body")} />;
  if (!fleet) return <ApiGate error={apiError} onRetry={retry} />;
  const hasOrder = (cid: string) => workOrders.some((w) => w.containerId === cid);
  const reasonText = (w: WorkOrder) => t(w.reason.startsWith("tracker_") || ["door_seal", "compressor", "sensor_recal"].includes(w.reason) ? (`wo_reason_${w.reason}` as Key) : (`alert_type_${w.reason}` as Key));
  const preventive = workOrders.filter((w) => w.kind === "preventive").length;
  const share = workOrders.length ? Math.round((100 * preventive) / workOrders.length) : 0;
  return (
    <div className="page" data-testid="maintenance-page">
      <div className="page-head"><div><h1>{t("mt_title")}</h1><p className="muted">{t("mt_sub")}</p></div></div>
      {!canAct ? <p className="note" data-testid="mt-readonly">{t("mt_readonly")}</p> : null}
      <div className="itsm-kpis" data-testid="mt-kpis">
        <div className="ik" data-testid="mt-k-open"><b>{workOrders.length}</b><span>{t("mt_k_open")}</span></div>
        <div className="ik" data-testid="mt-k-preventive"><b>{share}%</b><span>{t("mt_k_preventive")}</span></div>
        <div className="ik" data-testid="mt-k-released"><b>{released}</b><span>{t("mt_k_released")}</span></div>
        <div className="ik warn" data-testid="mt-k-devices"><b>{issues.length}</b><span>{t("mt_k_devices")}</span></div>
      </div>
      <div className="board" data-testid="mt-board">
        {WO_STAGES.map((stage, i) => {
          const col = workOrders.filter((w) => w.stage === i);
          return (
            <section key={stage} className="col" aria-label={t(`mt_stage_${stage}` as Key)} data-testid={`mt-col-${stage}`}>
              <h2>{t(`mt_stage_${stage}` as Key)} <b>{col.length}</b></h2>
              {col.length === 0 ? <p className="muted small">{t("mt_empty_col")}</p> : (
                <ul>
                  {col.map((w) => (
                    <li key={w.id} className={`wo wo-${w.kind}`} data-testid="mt-card" data-id={w.id} data-stage={stage}>
                      <div><b>{w.id}</b> <Link href={`/container/?id=${w.containerId}`}>{w.containerId}</Link></div>
                      <div>{reasonText(w)}</div>
                      <div className="chips">
                        <span className="chip">{t(`mt_kind_${w.kind}` as Key)}</span>
                        <span className="chip">{t(`mt_where_${w.where}` as Key)}</span>
                        <span className="chip">{t("mt_open_for", { t: formatMinutes(w.openedMin) })}</span>
                      </div>
                      {canAct ? (
                        i < WO_STAGES.length - 1
                          ? <button type="button" className="btn-sm" onClick={() => advanceWorkOrder(w.id)} data-testid="mt-advance">{t("mt_move_to", { s: t(`mt_stage_${WO_STAGES[i + 1]}` as Key) })}</button>
                          : <button type="button" className="btn-sm" onClick={() => releaseWorkOrder(w.id)} data-testid="mt-release">{t("mt_release")}</button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <p className="muted small">{t("mt_example_note")}</p>
      <section className="card" data-testid="mt-devices">
        <h2>{t("mt_devices_title")}</h2>
        <p className="muted small">{t("mt_devices_sub")}</p>
        {issues.length === 0 ? <p className="muted" data-testid="mt-dev-none">{t("mt_dev_none")}</p> : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label={t("mt_devices_title")}>
            <table className="table">
              <thead><tr><th scope="col">{t("ops_f_container")}</th><th scope="col">{t("mt_th_reason")}</th><th scope="col">{t("battery")}</th><th scope="col">{t("signal")}</th>{canAct ? <th scope="col" /> : null}</tr></thead>
              <tbody>
                {issues.slice(0, 40).map((d) => (
                  <tr key={d.containerId} data-testid="mt-dev-row">
                    <th scope="row"><Link href={`/container/?id=${d.containerId}`}>{d.containerId}</Link></th>
                    <td>{t(`wo_reason_${d.reason}` as Key)}</td><td>{d.batteryPct}%</td><td>{d.signal}/5</td>
                    {canAct ? <td>{hasOrder(d.containerId) ? <span className="muted small">{t("mt_has_order")}</span> : <button type="button" className="btn-sm" onClick={() => raiseDeviceOrder(d)} data-testid="mt-raise">{t("mt_raise")}</button>}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
