"use client";
import Link from "next/link";
import { useApp } from "@/app/providers";
import type { Alert } from "@/lib/types";

export const ESCALATE_AFTER_MIN = 15;

export function AlertRow({ a, link = false }: { a: Alert; link?: boolean }) {
  const { t, setAlertState } = useApp();
  const detailKey = `alert_detail_${a.type}` as const;
  const params: Record<string, string | number> = { ...a.params };
  if (a.type === "health_forecast") params.limit = t(a.params.limit === "lower" ? "limit_lower" : "limit_upper");
  const escalated = a.severity === "critical" && a.state === "open" && a.minutesAgo >= ESCALATE_AFTER_MIN;
  const remaining = Math.max(0, ESCALATE_AFTER_MIN - a.minutesAgo);
  return (
    <li className={`alert alert-${a.severity} state-${a.state}`} data-testid="alert-row" data-state={a.state} data-severity={a.severity} data-type={a.type}>
      <span className={`pill pill-${a.severity}`}>{t(`sev_${a.severity}` as const)}</span>
      <div className="alert-body">
        <strong>{link ? <Link href={`/container/?id=${a.containerId}`}>{a.containerId}</Link> : null} {t(`alert_type_${a.type}` as const)}</strong>
        <span className="muted">{t(detailKey, params)} · {t("minutes_ago", { m: a.minutesAgo })}</span>
        {a.severity === "critical" && a.state === "open" ? <span className="esc" data-testid="escalation">{escalated ? t("escalated") : t("escalates_in", { m: remaining })}</span> : null}
      </div>
      <span className="state-label" data-testid="alert-state">{t(`state_${a.state}` as const)}</span>
      <div className="alert-actions">
        <button type="button" className="btn small" disabled={a.state !== "open"} onClick={() => setAlertState(a.id, "acknowledged")} data-testid="ack-btn">{t("ack")}</button>
        <button type="button" className="btn small ghost" disabled={a.state !== "acknowledged"} onClick={() => setAlertState(a.id, "closed")} data-testid="close-btn">{t("close_alert")}</button>
      </div>
    </li>
  );
}
