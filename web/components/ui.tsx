"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useApp } from "@/app/providers";
import type { Container, Status } from "@/lib/types";
import { ContainerIcon } from "./Art";

export const STATUS_COLOR: Record<Status, string> = { normal: "#3BA55D", warning: "#F2A541", critical: "#D64545" };

export function StatusPill({ status }: { status: Status }) {
  const { t } = useApp();
  return <span className={`pill pill-${status}`} data-status={status}>{t(`status_${status}` as const)}</span>;
}

export function Gauge({ value, label }: { value: number; label: string }) {
  const r = 38, c = 2 * Math.PI * r;
  const color = value >= 80 ? "#3BA55D" : value >= 55 ? "#F2A541" : "#D64545";
  return (
    <div className="gauge" role="img" aria-label={`${label} ${Math.round(value)}`} data-testid="health-gauge">
      <svg viewBox="0 0 100 100" width="120" height="120">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#E3E9EF" strokeWidth="11" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${(c * value) / 100} ${c}`} transform="rotate(-90 50 50)" />
        <text x="50" y="58" textAnchor="middle" fontSize="26" fontWeight="700" fill={color}>{Math.round(value)}</text>
      </svg>
      <span>{label}</span>
    </div>
  );
}

export function NotFoundState({ title, body }: { title: string; body: string }) {
  const { t } = useApp();
  return (
    <section className="state" role="alert" data-testid="not-found">
      <h1>{title}</h1>
      <p>{body}</p>
      <Link className="btn" href="/">{t("back_to_fleet")}</Link>
    </section>
  );
}

/** Loading and error states for data that comes from the API service. */
export function ApiGate({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  const { t } = useApp();
  if (error) {
    return (
      <section className="state" role="alert" data-testid="api-error">
        <h1>{t("api_error_title")}</h1>
        <p>{t("api_error_body")}</p>
        <button type="button" className="btn" onClick={onRetry} data-testid="api-retry">{t("retry")}</button>
      </section>
    );
  }
  return <p className="state" role="status" aria-busy="true" data-testid="loading">{t("loading")}…</p>;
}

export function Tabs({ id, current }: { id: string; current: string }) {
  const { t } = useApp();
  const tabs = [
    ["container", "tab_detail"], ["route", "tab_route"], ["health", "tab_health"], ["replay", "tab_replay"], ["modules", "tab_modules"], ["report", "tab_report"],
  ] as const;
  return (
    <nav className="tabs" aria-label="Container views">
      {tabs.map(([p, k]) => (
        <Link key={p} href={`/${p}/?id=${encodeURIComponent(id)}`} aria-current={current === p ? "page" : undefined}>{t(k)}</Link>
      ))}
    </nav>
  );
}

export function ContainerHead({ c }: { c: Container }) {
  const { t } = useApp();
  return (
    <div className="chead">
      <ContainerIcon status={c.status} reefer={c.reefer} size={72} led />
      <div>
        <h1 data-testid="container-title">{c.id}</h1>
        <p className="muted">{c.origin} → {c.destination} · {c.tripId}</p>
      </div>
      <StatusPill status={c.status} />
      {!c.online ? <span className="pill pill-offline">{t("status_offline")}</span> : null}
    </div>
  );
}

export function Card({ title, children, testid }: { title?: string; children: ReactNode; testid?: string }) {
  return (<section className="card" data-testid={testid}>{title ? <h2>{title}</h2> : null}{children}</section>);
}
