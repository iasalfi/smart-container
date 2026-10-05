"use client";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/app/providers";
import type { Container } from "@/lib/types";

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
  const tiles: { k: string; v: string; l: string }[] = [
    { k: "moving", v: stats.moving.toLocaleString("en-US"), l: t("hero_stat_moving") },
    { k: "alerts", v: openAlerts.toLocaleString("en-US"), l: t("hero_stat_alerts") },
    { k: "health", v: `${stats.health}`, l: t("hero_stat_health") },
    { k: "reefer", v: `${stats.reeferPct}%`, l: t("hero_stat_reefer") },
  ];
  return (
    <section className="hero" aria-label={t("app_name")} data-testid="hero">
      <svg className="hero-art" viewBox="0 0 800 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="hg" cx="75%" cy="30%" r="70%"><stop offset="0" stopColor="#14b8a6" stopOpacity=".45" /><stop offset="1" stopColor="#0b2545" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="800" height="260" fill="url(#hg)" />
        <g fill="none" strokeLinecap="round">
          <path className="route r1" d="M70 200 C 220 60, 380 230, 560 90 S 740 70, 770 40" />
          <path className="route r2" d="M30 120 C 200 190, 360 40, 520 150 S 700 200, 780 150" />
          <path className="route r3" d="M120 250 C 260 140, 420 170, 600 40" />
        </g>
        {[[70, 200], [560, 90], [770, 40], [30, 120], [520, 150], [780, 150], [120, 250], [600, 40]].map(([x, y], i) => (
          <g key={i}><circle className="node-ring" cx={x} cy={y} r="5" /><circle cx={x} cy={y} r="4" fill="#5eead4" /></g>
        ))}
      </svg>
      <div className="hero-copy">
        <p className="hero-kicker"><span className="live-dot" aria-hidden="true" />{t("hero_live", { s: sec })}</p>
        <p className="hero-title">{t("hero_title")}</p>
        <p className="hero-body">{t("hero_body", { n: scope.length.toLocaleString("en-US") })}</p>
        <div className="hero-cta">
          <button type="button" className="btn hero-primary" onClick={onExplore} data-testid="hero-explore">{t("hero_cta_explore")}</button>
          <button type="button" className="btn hero-secondary" onClick={onCritical} data-testid="hero-critical">{t("hero_cta_critical")}</button>
          <button type="button" className="btn hero-ghost" onClick={onTour} data-testid="hero-tour">{t("hero_cta_tour")}</button>
        </div>
      </div>
      <dl className="hero-stats">
        {tiles.map((x) => (
          <div key={x.k} className="hero-stat" data-testid={`$hero-stat-${x.k}`}><dd>{x.v}</dd><dt>{x.l}</dt></div>
        ))}
      </dl>
    </section>
  );
}
