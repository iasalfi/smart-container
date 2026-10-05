"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useApp } from "@/app/providers";
import { AlertGlyph } from "@/components/Art";
import { RESOLUTION_CODES, ROSTER, canMove, formatMinutes, ticketView, type Clock, type ResolutionCode, type TicketView } from "@/lib/itsm";
import type { Alert } from "@/lib/types";

const IMPACT = ["", "high", "medium", "low"] as const;

function clockText(t: ReturnType<typeof useApp>["t"], label: string, c: Clock): string {
  if (c.state === "met") return t("itsm_clock_met", { label, m: formatMinutes(c.elapsedMin) });
  if (c.state === "met_late") return t("itsm_clock_late", { label, m: formatMinutes(c.elapsedMin) });
  if (c.state === "breached") return t("itsm_clock_breached", { label, m: formatMinutes(c.elapsedMin - c.targetMin) });
  return t("itsm_clock_left", { label, m: formatMinutes(c.remainingMin) });
}

export function ticketText(t: ReturnType<typeof useApp>["t"], kind: string, text: string): string {
  if (kind === "state") return t(`itsm_log_state_${text}` as never);
  if (kind === "assign") return text === "none" ? t("itsm_log_unassigned") : t("itsm_log_assigned", { name: ROSTER.find((r) => r.id === text)?.name ?? text });
  if (kind === "escalate") return t("itsm_log_escalated", { n: text });
  if (kind === "major") return t(text === "on" ? "itsm_log_major_on" : "itsm_log_major_off");
  if (kind === "problem") return t("itsm_log_problem", { id: text });
  return text;
}

export function AlertRow({ a, link = false }: { a: Alert; link?: boolean }) {
  const { t, lang, fleet, persona, tickets, transition, assign, escalate, toggleMajor, addNote } = useApp();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<ResolutionCode>("fixed");
  const [note, setNote] = useState("");
  const profileId = useMemo(() => fleet?.find((c) => c.id === a.containerId)?.profileId ?? "dry", [fleet, a.containerId]);
  const v: TicketView = ticketView(a, profileId, tickets[a.id]);
  const rec = v.rec;
  const detailKey = `alert_detail_${a.type}` as const;
  const params: Record<string, string | number> = { ...a.params };
  if (a.type === "health_forecast") params.limit = t(a.params.limit === "lower" ? "limit_lower" : "limit_upper");
  const canWork = persona !== "customer";
  const p = v.cls.priority;
  const responseLeft = Math.max(0, v.sla.response.targetMin - a.minutesAgo);
  const ownerName = rec.owner ? ROSTER.find((r) => r.id === rec.owner)?.name ?? rec.owner : null;
  const dt = useMemo(() => new Intl.DateTimeFormat(lang === "ar" ? "ar-SA" : "en-GB", { hour: "2-digit", minute: "2-digit" }), [lang]);
  return (
    <li className={`alert alert-${a.severity} state-${a.state} ticket`} data-testid="alert-row" data-state={a.state} data-severity={a.severity} data-type={a.type} data-priority={p}>
      <span className={`prio prio-${p}`} data-testid="prio" title={t("itsm_priority_title", { p })}>P{p}</span>
      <span className="atile" aria-hidden="true"><AlertGlyph type={a.type} /></span>
      <div className="alert-body">
        <strong>{link ? <Link href={`/container/?id=${a.containerId}`}>{a.containerId}</Link> : null} {t(`alert_type_${a.type}` as const)}</strong>
        <span className="muted">{t(detailKey, params)} · {t("minutes_ago", { m: a.minutesAgo })}</span>
        <span className="chips">
          <span className={`pill pill-${a.severity}`}>{t(`sev_${a.severity}` as const)}</span>
          <span className="chip" data-testid="kind">{t(v.kind === "alarm" ? "itsm_kind_alarm" : "itsm_kind_event")}</span>
          <span className={`chip sla sla-${v.sla.response.state}`} data-testid="sla-response">{clockText(t, t("itsm_respond"), v.sla.response)}</span>
          <span className={`chip sla sla-${v.sla.resolution.state}`} data-testid="sla-resolution">{clockText(t, t("itsm_resolve"), v.sla.resolution)}</span>
          <span className={`chip tier tier-${v.tier}`} data-testid="tier">L{v.tier}</span>
          <span className="chip" data-testid="owner">{ownerName ?? t("itsm_unassigned")}</span>
          {rec.major ? <span className="chip major" data-testid="major-flag">{t("itsm_major")}</span> : null}
          {rec.problemId ? <span className="chip" data-testid="problem-flag">{rec.problemId}</span> : null}
        </span>
        {a.severity === "critical" && a.state === "open" ? <span className="esc" data-testid="escalation">{v.tier > 1 ? t("itsm_escalated_to", { n: v.tier }) : t("escalates_in", { m: responseLeft })}</span> : null}
      </div>
      <span className="state-label" data-testid="alert-state">{t(`state_${a.state}` as const)}</span>
      {canWork ? (
        <div className="alert-actions">
          <button type="button" className="btn small" disabled={!canMove(a.state, "acknowledged")} onClick={() => transition(a.id, "acknowledged")} data-testid="ack-btn">{t("ack")}</button>
          <button type="button" className="btn small ghost" disabled={!canMove(a.state, "closed")} onClick={() => transition(a.id, "closed")} data-testid="close-btn">{t("close_alert")}</button>
          <button type="button" className="btn small ghost" aria-expanded={open} onClick={() => setOpen((x) => !x)} data-testid="manage-btn">{t(open ? "itsm_hide" : "itsm_manage")}</button>
        </div>
      ) : null}
      {open && canWork ? (
        <div className="ticket-detail" data-testid="ticket-detail">
          <div className="td-col">
            <h4>{t("itsm_classification")}</h4>
            <p className="small" data-testid="classification">{t("itsm_impact")}: {t(`itsm_level_${IMPACT[v.cls.impact]}` as const)} · {t("itsm_urgency")}: {t(`itsm_level_${IMPACT[v.cls.urgency]}` as const)} → P{p}</p>
            <p className="small muted">{t("itsm_targets", { r: formatMinutes(v.sla.response.targetMin), s: formatMinutes(v.sla.resolution.targetMin) })}</p>
            <div className="td-row">
              <button type="button" className="btn small" disabled={!canMove(a.state, "in_progress")} onClick={() => transition(a.id, "in_progress")} data-testid="start-btn">{a.state === "resolved" ? t("itsm_reopen") : t("itsm_start")}</button>
            </div>
            <div className="td-row">
              <label className="stack">{t("itsm_resolution_code")}
                <select value={code} onChange={(e) => setCode(e.target.value as ResolutionCode)} data-testid="resolution-code">
                  {RESOLUTION_CODES.map((c) => <option key={c} value={c}>{t(`itsm_code_${c}` as const)}</option>)}
                </select>
              </label>
              <button type="button" className="btn small" disabled={!canMove(a.state, "resolved")} onClick={() => transition(a.id, "resolved", code)} data-testid="resolve-btn">{t("itsm_resolve_btn")}</button>
            </div>
            {rec.code ? <p className="small" data-testid="resolution-shown">{t("itsm_resolved_as", { code: t(`itsm_code_${rec.code}` as const) })}</p> : null}
          </div>
          <div className="td-col">
            <h4>{t("itsm_ownership")}</h4>
            <label className="stack">{t("itsm_owner")}
              <select value={rec.owner ?? ""} onChange={(e) => assign(a.id, e.target.value || undefined)} disabled={a.state === "closed"} data-testid="owner-select">
                <option value="">{t("itsm_unassigned")}</option>
                {ROSTER.map((r) => <option key={r.id} value={r.id}>{r.name} (L{r.tier})</option>)}
              </select>
            </label>
            <div className="td-row">
              <button type="button" className="btn small ghost" disabled={v.tier >= 3 || a.state === "closed"} onClick={() => escalate(a.id, (v.tier + 1) as 2 | 3)} data-testid="escalate-btn">{t("itsm_escalate", { n: Math.min(3, v.tier + 1) })}</button>
              <button type="button" className="btn small ghost" aria-pressed={!!rec.major} disabled={a.state === "closed"} onClick={() => toggleMajor(a.id)} data-testid="major-btn">{t(rec.major ? "itsm_major_clear" : "itsm_major_declare")}</button>
            </div>
          </div>
          <div className="td-col">
            <h4>{t("itsm_timeline")}</h4>
            <ol className="tlog" data-testid="ticket-log">
              {rec.log.length === 0 ? <li className="muted">{t("itsm_log_empty")}</li> : rec.log.map((l) => (
                <li key={l.n}><time>{dt.format(new Date(l.at))}</time> <span>{ticketText(t, l.kind, l.text)}</span></li>
              ))}
            </ol>
            <form className="td-row" onSubmit={(e) => { e.preventDefault(); addNote(a.id, note); setNote(""); }}>
              <label className="stack grow">{t("itsm_note")}
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} data-testid="note-input" />
              </label>
              <button type="submit" className="btn small ghost" disabled={!note.trim()} data-testid="note-btn">{t("itsm_add_note")}</button>
            </form>
          </div>
        </div>
      ) : null}
    </li>
  );
}
