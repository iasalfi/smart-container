"use client";
import { useMemo, useState } from "react";
import { useApp } from "../providers";
import { ApiGate, NotFoundState } from "@/components/ui";
import { DEFAULT_THRESHOLDS, type Thresholds } from "@/lib/alerts";
import { PROFILES } from "@/lib/profiles";
import Link from "next/link";

const FIELDS = Object.keys(DEFAULT_THRESHOLDS) as (keyof Thresholds)[];

export default function AdminPage() {
  const { t, lang, persona, thresholds, setThresholds, alerts, fleet, alertsReady, apiError, retry } = useApp();
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(FIELDS.map((k) => [k, String(thresholds[k])])));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const lowBattery = useMemo(() => [...(fleet ?? [])].sort((a, b) => a.batteryPct - b.batteryPct).slice(0, 15), [fleet]);
  if (persona === "customer") return <NotFoundState title={t("not_allowed_title")} body={t("not_allowed_body")} />;
  if (!fleet || !alertsReady) return <ApiGate error={apiError} onRetry={retry} />;
  const save = () => {
    const next: Partial<Thresholds> = {};
    for (const k of FIELDS) {
      const raw = draft[k]?.trim();
      const n = Number(raw);
      if (!raw || !Number.isFinite(n) || n <= 0) { setMsg({ ok: false, text: t("invalid_number") }); return; }
      next[k] = n;
    }
    setThresholds(next as Thresholds);
    setMsg({ ok: true, text: t("saved", { n: "…" }) });
  };
  const reset = () => { setDraft(Object.fromEntries(FIELDS.map((k) => [k, String(DEFAULT_THRESHOLDS[k])]))); setThresholds({ ...DEFAULT_THRESHOLDS }); setMsg(null); };
  return (
    <div className="page">
      <div className="page-head"><h1>{t("admin_title")}</h1></div>
      <section className="card">
        <h2>{t("admin_thresholds")}</h2>
        <form className="form" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
          {FIELDS.map((k) => (
            <label key={k}>{t(`thr_${k}` as const)}
              <input inputMode="decimal" value={draft[k] ?? ""} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} data-testid={`thr-${k}`} aria-invalid={msg && !msg.ok ? true : undefined} />
            </label>
          ))}
          <div className="row">
            <button type="submit" className="btn" data-testid="save-thresholds">{t("save")}</button>
            <button type="button" className="btn ghost" onClick={reset} data-testid="reset-thresholds">{t("reset_defaults")}</button>
          </div>
        </form>
        {msg ? <p className={msg.ok ? "ok-msg" : "error"} role={msg.ok ? "status" : "alert"} data-testid="threshold-msg">{msg.ok ? t("saved", { n: alerts.length }) : msg.text}</p> : null}
        <p className="muted small" data-testid="alert-total">{t("alerts_count", { n: alerts.length })}</p>
      </section>
      <section className="card">
        <h2>{t("admin_profiles")}</h2>
        <table className="table" data-testid="profile-table">
          <thead><tr><th>{t("th_name")}</th><th>{t("th_temp")}</th><th>{t("th_rh")}</th><th>{t("th_shelf")}</th><th>{t("th_reefer")}</th></tr></thead>
          <tbody>{PROFILES.map((p) => (<tr key={p.id}><td>{p.name[lang]}</td><td>{p.tMin} to {p.tMax} °C</td><td>{p.rhMin} to {p.rhMax} %</td><td>{p.shelfLifeH}</td><td>{p.reefer ? t("yes") : t("no")}</td></tr>))}</tbody>
        </table>
      </section>
      <section className="card">
        <h2>{t("admin_devices")}</h2>
        <table className="table" data-testid="device-table">
          <thead><tr><th>{t("device")}</th><th>{t("battery")}</th><th>{t("signal")}</th></tr></thead>
          <tbody>{lowBattery.map((c) => (<tr key={c.id}><td><Link href={`/container/?id=${c.id}`}>{c.id}</Link></td><td>{c.batteryPct} %</td><td>{c.signal}/5</td></tr>))}</tbody>
        </table>
      </section>
    </div>
  );
}
