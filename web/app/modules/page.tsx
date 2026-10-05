"use client";
import { useEffect, useState } from "react";
import { ContainerPage } from "@/components/ContainerPage";
import { Card } from "@/components/ui";
import { useApp } from "../providers";
import { DEFAULT_THRESHOLDS } from "@/lib/alerts";
import type { Container, LockState } from "@/lib/types";

export default function Page() {
  return <ContainerPage current="modules">{(c) => <Modules c={c} />}</ContainerPage>;
}

function GasBar({ label, value, limit, max }: { label: string; value: number; limit: number; max: number }) {
  const { t } = useApp();
  const high = value >= limit;
  return (
    <div className="gasbar" data-testid={`gas-${label}`} data-high={high}>
      <div className="gasbar-head"><strong>{label}</strong><span>{value} ppm · {high ? t("gas_high") : t("gas_ok")}</span></div>
      <div className="gasbar-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <div className="gasbar-fill" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: high ? "#D64545" : "#3BA55D" }} />
        <div className="gasbar-limit" style={{ left: `${(limit / max) * 100}%` }} />
      </div>
    </div>
  );
}

function Modules({ c }: { c: Container }) {
  const { t, thresholds, lockOverride, setLock, audit } = useApp();
  const [pending, setPending] = useState<null | "lock" | "unlock">(null);
  const [err, setErr] = useState<string | null>(null);
  const lock: LockState = lockOverride[c.id] ?? c.lock;
  const moving = c.speedKmh > thresholds.doorSpeedKmh || c.speedKmh > DEFAULT_THRESHOLDS.doorSpeedKmh;
  const action = (a: "lock" | "unlock") => {
    if (a === "unlock" && moving) { setErr(t("unlock_blocked")); return; }
    setErr(null);
    setPending(a);
  };
  const confirm = () => {
    if (!pending) return;
    setLock(c.id, pending === "lock" ? "locked" : "unlocked", pending);
    setPending(null);
  };
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPending(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);
  const mine = audit.filter((a) => a.containerId === c.id);
  const actionLabel = pending ? t(pending === "lock" ? "btn_lock" : "btn_unlock") : "";
  return (
    <div className="grid-2">
      <Card title={t("gas_panel")} testid="gas-panel">
        {c.gas ? (<><GasBar label="NH3" value={c.gas.nh3} limit={thresholds.nh3Ppm} max={100} /><GasBar label="H2S" value={c.gas.h2s} limit={thresholds.h2sPpm} max={50} /></>) : <p className="muted" data-testid="gas-none">{t("gas_not_fitted")}</p>}
      </Card>
      <Card title={t("padlock_panel")} testid="padlock-panel">
        {c.padlock ? (
          <>
            <p>{t("padlock_state")}: <strong data-testid="lock-state">{t(`lock_${lock}` as const)}</strong></p>
            <div className="row">
              <button type="button" className="btn" onClick={() => action("lock")} disabled={lock === "locked"} data-testid="lock-btn">{t("btn_lock")}</button>
              <button type="button" className="btn ghost" onClick={() => action("unlock")} disabled={lock === "unlocked"} data-testid="unlock-btn">{t("btn_unlock")}</button>
            </div>
            {err ? <p className="error" role="alert" data-testid="lock-error">{err}</p> : null}
            <h3>{t("audit_log")}</h3>
            {mine.length === 0 ? <p className="muted" data-testid="audit-empty">{t("audit_empty")}</p> : <ul className="list" data-testid="audit-list">{mine.map((a) => <li key={a.id}>{t("audit_entry", { action: t(a.action === "lock" ? "btn_lock" : "btn_unlock"), id: a.containerId })}</li>)}</ul>}
          </>
        ) : <p className="muted" data-testid="padlock-none">{t("padlock_not_fitted")}</p>}
      </Card>
      {pending ? (
        <div className="modal-back">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="dlg-t" data-testid="confirm-dialog">
            <h2 id="dlg-t">{t("confirm_title", { action: actionLabel })}</h2>
            <p>{t("confirm_body", { action: actionLabel, id: c.id })}</p>
            <div className="row">
              <button type="button" className="btn" onClick={confirm} data-testid="confirm-yes" autoFocus>{t("confirm_yes")}</button>
              <button type="button" className="btn ghost" onClick={() => setPending(null)} data-testid="confirm-no">{t("confirm_no")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
