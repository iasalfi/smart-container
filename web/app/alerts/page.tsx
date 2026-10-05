"use client";
import { useMemo, useState } from "react";
import { useApp, CUSTOMER_PERSONA_NAME } from "../providers";
import { AlertRow } from "@/components/AlertRow";
import { ApiGate } from "@/components/ui";
import type { AlertState, Severity } from "@/lib/types";

export default function AlertsPage() {
  const { t, alerts, persona, fleet, alertsReady, apiError, retry } = useApp();
  const byId = useMemo(() => new Map((fleet ?? []).map((c) => [c.id, c])), [fleet]);
  const [sev, setSev] = useState<Severity | "all">("all");
  const [st, setSt] = useState<AlertState | "all">("all");
  const [q, setQ] = useState("");
  const list = useMemo(() => alerts.filter((a) => {
    if (persona === "customer" && byId.get(a.containerId)?.customer !== CUSTOMER_PERSONA_NAME) return false;
    if (sev !== "all" && a.severity !== sev) return false;
    if (st !== "all" && a.state !== st) return false;
    if (q.trim() && !a.containerId.toLowerCase().includes(q.trim().toLowerCase())) return false;
    return true;
  }), [alerts, sev, st, q, persona, byId]);
  if (!fleet || !alertsReady) return <ApiGate error={apiError} onRetry={retry} />;
  return (
    <div className="page">
      <div className="page-head"><div><h1>{t("alerts_title")}</h1><p className="muted" data-testid="alerts-count" aria-live="polite">{t("alerts_count", { n: list.length })}</p></div></div>
      <div className="filters">
        <label>{t("search")}<input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="SC-1043" data-testid="alert-search" /></label>
        <label>{t("filter_severity")}
          <select value={sev} onChange={(e) => setSev(e.target.value as Severity | "all")} data-testid="sev-filter">
            <option value="all">{t("all")}</option><option value="critical">{t("sev_critical")}</option><option value="warning">{t("sev_warning")}</option>
          </select>
        </label>
        <label>{t("filter_state")}
          <select value={st} onChange={(e) => setSt(e.target.value as AlertState | "all")} data-testid="state-filter">
            <option value="all">{t("all")}</option><option value="open">{t("state_open")}</option><option value="acknowledged">{t("state_acknowledged")}</option><option value="closed">{t("state_closed")}</option>
          </select>
        </label>
      </div>
      {list.length === 0 ? <p className="state-inline" role="status" data-testid="alerts-empty">{t("alerts_empty")}</p> : (
        <ul className="alert-list">{list.map((a) => <AlertRow key={a.id} a={a} link />)}</ul>
      )}
    </div>
  );
}
