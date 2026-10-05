"use client";
import { useMemo } from "react";
import { useApp, CUSTOMER_PERSONA_NAME } from "../providers";
import { ApiGate } from "@/components/ui";
import { KpiTile, Widget } from "@/components/AnalyticsWidgets";
import { alertsIn, analyticsFor, journeysIn, scopeOf } from "@/lib/analytics";
import { SNAPSHOT_MS } from "@/lib/journey";
import type { Key } from "@/lib/i18n";

export default function AnalyticsPage() {
  const { t, persona, fleet, alerts, journeys, tickets, apiError, retry } = useApp();
  const scope = useMemo(() => scopeOf(persona, fleet ?? [], CUSTOMER_PERSONA_NAME), [persona, fleet]);
  const a = useMemo(() => analyticsFor(persona, scope, alertsIn(alerts, scope), journeysIn(journeys, scope), tickets, SNAPSHOT_MS), [persona, scope, alerts, journeys, tickets]);
  if (!fleet) return <ApiGate error={apiError} onRetry={retry} />;
  const n = scope.length.toLocaleString("en-US");
  return (
    <div className="page" data-testid="analytics" data-persona={persona}>
      <div className="page-head">
        <div>
          <h1>{t("an_title")}</h1>
          <p className="muted" data-testid="an-sub">{t(`an_sub_${persona}` as Key)}</p>
          <p className="muted small" data-testid="an-scope">{persona === "customer" ? t("an_scope_customer", { n, c: CUSTOMER_PERSONA_NAME }) : t("an_scope_all", { n })}</p>
        </div>
        <span className="an-role" data-testid="an-role">{t(`persona_${persona}` as Key)}</span>
      </div>
      {a.empty ? <p className="state-inline" role="status">{t("an_empty")}</p> : (
        <>
          <div className="an-kpis" role="group" aria-label={t("an_title")}>{a.kpis.map((k) => <KpiTile key={k.id} k={k} />)}</div>
          <div className="an-grid">{a.widgets.map((w) => <Widget key={w} id={w} a={a} />)}</div>
        </>
      )}
    </div>
  );
}
