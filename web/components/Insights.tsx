"use client";
import { useMemo } from "react";
import { useApp } from "@/app/providers";
import { PROFILES } from "@/lib/profiles";
import { AlertGlyph } from "./Art";
import type { Alert, AlertType, Container } from "@/lib/types";

const BANDS = ["0-19", "20-39", "40-59", "60-79", "80-100"];

interface Props {
  scope: Container[];
  alerts: Alert[];
  profile: string;
  corridor: string | null;
  onProfile: (p: string) => void;
  onCorridor: (c: string | null) => void;
}

export function Insights({ scope, alerts, profile, corridor, onProfile, onCorridor }: Props) {
  const { t, lang } = useApp();
  const data = useMemo(() => {
    const cargo = new Map<string, number>();
    const cor = new Map<string, number>();
    const bands = [0, 0, 0, 0, 0];
    for (const c of scope) {
      cargo.set(c.profileId, (cargo.get(c.profileId) ?? 0) + 1);
      const k = `${c.origin} → ${c.destination}`;
      cor.set(k, (cor.get(k) ?? 0) + 1);
      bands[Math.min(4, Math.floor(c.healthScore / 20))]++;
    }
    const cargoRows = PROFILES.map((p) => ({ id: p.id, name: p.name[lang], n: cargo.get(p.id) ?? 0 })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n);
    const corRows = [...cor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    return { cargoRows, corRows, bands };
  }, [scope, lang]);
  const maxCargo = Math.max(1, ...data.cargoRows.map((r) => r.n));
  const maxCor = Math.max(1, ...data.corRows.map((r) => r[1]));
  const ids = useMemo(() => new Set(scope.map((c) => c.id)), [scope]);
  const typeRows = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of alerts) if (ids.has(a.containerId) && a.state === "open") m.set(a.type, (m.get(a.type) ?? 0) + 1);
    return [...m.entries()].sort((x, y) => y[1] - x[1]);
  }, [alerts, ids]);
  const maxType = Math.max(1, ...typeRows.map((r) => r[1]));
  const maxBand = Math.max(1, ...data.bands);
  return (
    <div className="insights" data-testid="insights">
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
      <section className="card ins-card">
        <h2>{t("ins_health")}</h2>
        <div className="hist" data-testid="health-spread" role="img" aria-label={BANDS.map((b, k) => `${b}: ${data.bands[k]}`).join(", ")}>
          {BANDS.map((b, k) => (
            <div key={b} className="hcol">
              <span className="hn">{data.bands[k]}</span>
              <span className="hbar2"><i className={`b${k}`} style={{ height: `${(100 * data.bands[k]) / maxBand}%` }} /></span>
              <span className="hl">{b}</span>
            </div>
          ))}
        </div>
        <p className="muted small">{t("ins_health_hint")}</p>
      </section>
      <section className="card ins-card ins-wide">
        <h2>{t("ins_alert_types")}</h2>
        {typeRows.length === 0 ? <p className="muted">{t("ins_events_empty")}</p> : (
          <ul className="type-tiles" data-testid="alert-type-bars">
            {typeRows.map(([k, n]) => (
              <li key={k} className="type-tile" data-testid="alert-type-tile">
                <span className="tt-ic"><AlertGlyph type={k as AlertType} /></span>
                <b>{n}</b>
                <span className="tt-l">{t(`alert_type_${k}` as Key2)}</span>
                <span className="tt-bar"><i style={{ width: `${(100 * n) / maxType}%` }} /></span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
type Key2 = import("@/lib/i18n").Key;
