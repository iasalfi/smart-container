"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/app/providers";
import type { Key } from "@/lib/i18n";

const STEPS: { n: 1 | 2 | 3 | 4 | 5; href: string; icon: string }[] = [
  { n: 1, href: "/", icon: "M12 2 3 7v10l9 5 9-5V7zM12 12 3 7m9 5 9-5m-9 5v10" },
  { n: 2, href: "/alerts/", icon: "M12 3a6 6 0 0 0-6 6c0 5-2 6-2 6h16s-2-1-2-6a6 6 0 0 0-6-6zM10 19a2 2 0 0 0 4 0" },
  { n: 3, href: "/health/?id=SC-1060", icon: "M3 12h4l2-6 4 12 2-6h6" },
  { n: 4, href: "/replay/?id=SC-1089", icon: "M12 4a8 8 0 1 0 8 8M12 4V1m0 3 3 2m-3 1v5l3 2" },
  { n: 5, href: "/modules/?id=SC-1014", icon: "M4 6h16M4 12h16M4 18h16" },
];

export function Tour({ onClose }: { onClose: () => void }) {
  const { t } = useApp();
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [onClose]);
  const s = STEPS[i];
  const last = i === STEPS.length - 1;
  return (
    <div className="modal-back" onClick={onClose} data-testid="tour-backdrop">
      <div className="modal tour" role="dialog" aria-modal="true" aria-labelledby="tour-h" tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()} data-testid="tour">
        <div className="tour-top">
          <span className="tour-step">{t("tour_step", { i: i + 1, n: STEPS.length })}</span>
          <button type="button" className="tour-x" onClick={onClose} aria-label={t("tour_close")}>×</button>
        </div>
        <svg className="tour-icon" viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={s.icon} /></svg>
        <h2 id="tour-h">{t(`tour_${s.n}_t` as Key)}</h2>
        <p>{t(`tour_${s.n}_b` as Key)}</p>
        <div className="tour-dots" aria-hidden="true">{STEPS.map((_, k) => <span key={k} className={k === i ? "on" : ""} />)}</div>
        <div className="row tour-actions">
          <button type="button" className="btn ghost" onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0}>{t("tour_back")}</button>
          {s.n === 1 ? null : <Link className="btn ghost" href={s.href} onClick={onClose}>{t("tour_go")}</Link>}
          {last ? <button type="button" className="btn" onClick={onClose}>{t("tour_done")}</button> : <button type="button" className="btn" onClick={() => setI((v) => v + 1)}>{t("tour_next")}</button>}
        </div>
      </div>
    </div>
  );
}
