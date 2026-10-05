"use client";
import { ContainerPage } from "@/components/ContainerPage";
import { Card, Gauge } from "@/components/ui";
import { LineChart } from "@/components/LineChart";
import { useApp } from "../providers";
import { computeHealth, forecastBreach, topFactors } from "@/lib/health";
import { getProfile } from "@/lib/profiles";
import type { Container, Sample } from "@/lib/types";

export default function Page() {
  return <ContainerPage current="health">{(c, s) => <HealthView c={c} s={s} />}</ContainerPage>;
}

function HealthView({ c, s }: { c: Container; s: Sample[] }) {
  const { t } = useApp();
  const prof = getProfile(c.profileId)!;
  const h = computeHealth(s, prof);
  const f = forecastBreach(s, prof);
  const factors = topFactors(s, prof).filter((x) => x.value > 0).slice(0, 3);
  const idx: number[] = [];
  for (let i = 12; i < s.length; i += 12) idx.push(i);
  idx.push(s.length - 1);
  const trend = idx.map((i) => computeHealth(s.slice(0, i + 1), prof).score);
  const shelf = h.remainingShelfLifeH >= 48 ? t("health_days", { d: Math.round(h.remainingShelfLifeH / 24) }) : t("health_hours", { h: h.remainingShelfLifeH });
  return (
    <>
      {f.etaH !== null ? (
        <div className="banner banner-warning" role="status" data-testid="forecast-banner">{t("forecast_banner", { limit: t(f.limit === "lower" ? "limit_lower" : "limit_upper"), etaH: (Math.round(f.etaH * 10) / 10).toString() })}</div>
      ) : (
        <div className="banner banner-ok" role="status" data-testid="forecast-ok">{t("forecast_ok")}</div>
      )}
      <div className="grid-2">
        <Card title={t("health_title")}>
          <Gauge value={h.score} label={t("health_score")} />
          <p><strong>{t("health_remaining")}:</strong> <span data-testid="shelf-life">{shelf}</span></p>
        </Card>
        <Card title={t("health_factors")} testid="factors">
          <ol className="plain">
            {factors.length === 0 ? <li className="muted">—</li> : factors.map((x) => (<li key={x.key}>{t(`factor_${x.key}` as const, { v: x.value })}</li>))}
          </ol>
          <p className="muted small">{t("health_model")}</p>
        </Card>
      </div>
      <LineChart title={t("health_trend")} values={trend} minAgo={idx.map((i) => s[i].minAgo)} unit="" color="#4f8f84" yDomain={[0, 100]} />
    </>
  );
}
