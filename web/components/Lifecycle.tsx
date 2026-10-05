"use client";
import Link from "next/link";
import { useApp } from "@/app/providers";
import { LIFECYCLE, WO_STAGES, lifecycleOf, nextPostStep } from "@/lib/cases";
import type { Container } from "@/lib/types";
import type { Key } from "@/lib/i18n";

/** Six stages from booking to back in service, with the maintenance branch when the container has a work order. */
export function Lifecycle({ c }: { c: Container }) {
  const { t, journeys, postDelivery, recordPost, persona, workOrders } = useApp();
  const j = journeys.find((x) => x.containerId === c.id);
  const info = lifecycleOf(j, postDelivery[c.id]);
  const wo = workOrders.find((w) => w.containerId === c.id);
  if (!info) return (<section className="card" data-testid="lifecycle-spine"><h2>{t("lc_title")}</h2><p className="muted" data-testid="lc-none">{t("lc_none")}</p></section>);
  const at = LIFECYCLE.indexOf(info.stage);
  const step = nextPostStep(info.stage);
  return (
    <section className="card" data-testid="lifecycle-spine" data-stage={info.stage}>
      <h2>{t("lc_title")}</h2>
      <ol className="spine">
        {LIFECYCLE.map((s, i) => (
          <li key={s} className={i < at ? "done" : i === at ? "now" : ""} aria-current={i === at ? "step" : undefined} data-testid={`lc-${s}`}>
            <span className="dotm" aria-hidden="true">{i < at ? "✓" : i + 1}</span>
            <span className="lbl">{t(`lc_${s}` as Key)}</span>
            {i === at ? <span className="sr-only"> ({t("lc_now")})</span> : null}
            {i === at && info.delayed ? <span className="chip sla sla-breached" data-testid="lc-late">{t("lc_late")}</span> : null}
          </li>
        ))}
      </ol>
      {wo ? (
        <p className="branch" data-testid="lc-branch"><b>{t("lc_branch")}</b>: <Link href="/maintenance/">{wo.id}</Link> · {t(`mt_stage_${WO_STAGES[wo.stage]}` as Key)}</p>
      ) : null}
      <p className="muted small">{t("lc_note")}</p>
      {step && persona === "operator" ? (
        <button type="button" className="btn small" onClick={() => recordPost(c.id, step)} data-testid="lc-next">{t(step === "unloaded" ? "lc_mark_unloaded" : "lc_mark_back")}</button>
      ) : null}
    </section>
  );
}
