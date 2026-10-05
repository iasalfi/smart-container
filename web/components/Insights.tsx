"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useApp } from "@/app/providers";
import { PROFILES } from "@/lib/profiles";
import { STATUS_COLOR } from "@/components/ui";
import type { Alert, Container, Status } from "@/lib/types";

const STATUSES: Status[] = ["normal", "warning", "critical"];

interface Props {
  scope: Container[];
  alerts: Alert[];
  status: Status | "all";
  profile: string;
  corridor: string | null;
  onStatus: (s: Status | "all") => void;
  onProfile: (p: string) => void;
  onCorridor: (c: string | null) => void;
}

export function Insights({ scope, alerts, status, profile, corridor, onStatus, onProfile, onCorridor }: Props) {
  const { t, lang } = useApp();
  const data = useMemo(() => {
    const st: Record<Status, number> = { normal: 0, warning: 0, critical: 0 };
    const cargo = new Map<string, number>();
    const cor = new Map<string, number>();
    for (const c of scope) {
      st[c.status]++;
      cargo.set(c.profileId, (cargo.get(c.profileId) ?? 0) + 1);
      const k = `${c.origin} → ${c.destination}`;
      cor.set(k, (cor.get(k) ?? 0) + 1);
    }
    const cargoRows = PROFILES.map((p) => ({ id: p.id, name: p.name[lang], n: cargo.get(p.id) ?? 0 })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n);
    const corRows = [...cor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    return { st, cargoRows, corRows };
  }, [scope, lang]);
  const total = scope.length || 1;
  const R = 52, C = 2 * Math.PI * R;
  const offsets = STATUSES.map((_, i) => STATUSES.slice(0, i).reduce((a, k) => a + (C * data.st[k]) / total, 0));
  const maxCargo = Math.max(1, ...data.cargoRows.map((r) => r.n));
  const maxCor = Math.max(1, ...data.corRows.map((r) => r[1]));
  const ids = useMemo(() => new Set(scope.map((c) => c.id)), [scope]);
  const events = alerts.filter((a) => ids.has(a.containerId) && a.state === "open").sort((a, b) => (a.severity === b.severity ? a.minutesAgo - b.minutesAgo : a.severity === "critical" ? -1 : 1)).slice(0, 6);
  const typeRows = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of alerts) if (ids.has(a.containerId) && a.state === "open") m.set(a.type, (m.get(a.type) ?? 0) + 1);
    return [...m.entries()].sort((x, y) => y[1] - x[1]);
  }, [alerts, ids]);
  const maxType = Math.max(1, ...typeRows.map((r) => r[1]));
  return (
    <div className="insights" data-testid="insights">
      <section className="card ins-card">
        <h2>{t("ins_status")}</h2>
        <div className="donut-row">
          <svg viewBox="0 0 140 140" width="132" height="132" role="img" aria-label={`${t("ins_status")}: ${STATUSES.map((s) => `${t(`status_${s}` as Key2)} ${data.st[s]}`).join(", ")}`} className="donut">
            <circle cx="70" cy="70" r={R} fill="none" stroke="#e6edf3" strokeWidth="18" />
            {STATUSES.map((s, i) => {
              const len = (C * data.st[s]) / total;
              return <circle key={s} cx="70" cy="70" r={R} fill="none" stroke={STATUS_COLOR[s]} strokeWidth={status === s ? 22 : 18} strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`} strokeDashoffset={-offsets[i]} transform="rotate(-90 70 70)" className="seg" />;
            })}
            <text x="70" y="68" textAnchor="middle" className="donut-n">{scope.length.toLocaleString("en-US")}</text>
            <text x="70" y="86" textAnchor="middle" className="donut-l">{t("kpi_total")}</text>
          </svg>
          <ul className="legend-list">
            {STATUSES.map((s) => (
              <li key={s}>
                <button type="button" className="chip" aria-pressed={status === s} onClick={() => onStatus(status === s ? "all" : s)} data-testid={`ins-status-${s}`}>
                  <span className="sw" style={{ background: STATUS_COLOR[s] }} aria-hidden="true" />{t(`status_${s}` as Key2)}<b>{data.st[s].toLocaleString("en-US")}</b><span className="pct">{Math.round((100 * data.st[s]) / total)}%</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <p className="muted small">{t("ins_status_hint")}</p>
      </section>
      <section className="card ins-card">
        <h2>{t("ins_cargo")}</h2>
        <ul className="bars">
          {data.cargoRows.map((r) => (
            <li key={r.id}>
              <button type="button" className="barrow" aria-pressed={profile === r.id} onClick={() => onProfile(profile === r.id ? "all" : r.id)} data-testid={`ins-cargo-${r.id}`}>
                <span className="bl">{r.name}</span>
                <span className="bt"><i style={{ width: `${(100 * r.n) / maxCargo}%` }} /></span>
                <b>{r.n}</b>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="card ins-card">
        <h2>{t("ins_corridor")}</h2>
        <ul className="bars">
          {data.corRows.map(([k, n]) => (
            <li key={k}>
              <button type="button" className="barrow alt" aria-pressed={corridor === k} onClick={() => onCorridor(corridor === k ? null : k)} data-testid="ins-corridor">
                <span className="bl">{k}</span>
                <span className="bt"><i style={{ width: `${(100 * n) / maxCor}%` }} /></span>
                <b>{n}</b>
              </button>
            </li>
          ))}
        </ul>
        <p className="muted small">{t("ins_corridor_hint")}</p>
      </section>
      <section className="card ins-card ins-half">
        <h2>{t("ins_alert_types")}</h2>
        {typeRows.length === 0 ? <p className="muted">{t("ins_events_empty")}</p> : (
          <ul className="bars" data-testid="alert-type-bars">
            {typeRows.map(([k, n]) => (
              <li key={k} className="barrow static">
                <span className="bl">{t(`alert_type_${k}` as Key2)}</span>
                <span className="bt"><i style={{ width: `${(100 * n) / maxType}%` }} /></span>
                <b>{n}</b>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card ins-card ins-half">
        <h2>{t("ins_events")}</h2>
        {events.length === 0 ? <p className="muted">{t("ins_events_empty")}</p> : (
          <ul className="events">
            {events.map((a) => (
              <li key={a.id}>
                <span className={`dot dot-${a.severity}`} aria-hidden="true" />
                <Link href={`/container/?id=${a.containerId}`}><strong>{a.containerId}</strong> {t(`alert_type_${a.type}` as Key2)}</Link>
                <span className="muted small">{t("minutes_ago", { m: a.minutesAgo })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
type Key2 = import("@/lib/i18n").Key;
