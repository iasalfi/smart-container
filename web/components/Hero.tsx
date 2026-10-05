"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useApp } from "@/app/providers";
import type { Container } from "@/lib/types";
import { BellIcon, RoadScene, TruckIcon } from "./Art";
import { HealthRing } from "./Art";

interface Props { scope: Container[]; openAlerts: number; onExplore: () => void; onCritical: () => void; onTour: () => void }

export function Hero({ scope, openAlerts, onExplore, onCritical, onTour }: Props) {
  const { t } = useApp();
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setSec((s) => (s + 1) % 60), 1000);
    return () => window.clearInterval(id);
  }, []);
  const stats = useMemo(() => {
    const moving = scope.filter((c) => c.online && c.speedKmh > 5).length;
    const health = scope.length ? Math.round(scope.reduce((a, c) => a + c.healthScore, 0) / scope.length) : 0;
    const reefers = scope.filter((c) => c.reefer && c.setpointC !== null);
    const onPoint = reefers.filter((c) => Math.abs(c.tempC - (c.setpointC as number)) <= 2).length;
    const reeferPct = reefers.length ? Math.round((100 * onPoint) / reefers.length) : 0;
    return { moving, health, reeferPct };
  }, [scope]);
  const tiles: { k: string; v: string; l: string; icon: ReactNode }[] = [
    { k: "moving", v: stats.moving.toLocaleString("en-US"), l: t("hero_stat_moving"), icon: <TruckIcon size={44} /> },
    { k: "alerts", v: openAlerts.toLocaleString("en-US"), l: t("hero_stat_alerts"), icon: <BellIcon size={30} /> },
    { k: "health", v: `${stats.health}`, l: t("hero_stat_health"), icon: <HealthRing value={stats.health} size={40} /> },
    { k: "reefer", v: `${stats.reeferPct}%`, l: t("hero_stat_reefer"), icon: <TruckIcon size={44} reefer /> },
  ];
  return (
    <section className="hero" aria-label={t("app_name")} data-testid="hero">
      <div className="hero-copy">
        <p className="hero-kicker"><span className="live-dot" aria-hidden="true" />{t("hero_live", { s: sec })}</p>
        <p className="hero-title">{t("hero_title")}</p>
        <div className="hero-cta">
          <button type="button" className="btn hero-primary" onClick={onExplore} data-testid="hero-explore">{t("hero_cta_explore")}</button>
          <button type="button" className="btn hero-secondary" onClick={onCritical} data-testid="hero-critical">{t("hero_cta_critical")}</button>
          <button type="button" className="btn hero-ghost" onClick={onTour} data-testid="hero-tour">{t("hero_cta_tour")}</button>
        </div>
      </div>
      <dl className="hero-stats">
        {tiles.map((x) => (
          <div key={x.k} className="hero-stat" data-testid={`hero-stat-${x.k}`}><dd><span className="hs-icon" aria-hidden="true">{x.icon}</span><span className="hs-val">{x.v}</span></dd><dt>{x.l}</dt></div>
        ))}
      </dl>
      <RoadScene />
    </section>
  );
}
