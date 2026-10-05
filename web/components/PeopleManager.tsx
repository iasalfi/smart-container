"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useApp } from "@/app/providers";
import { CITIES } from "@/lib/cities";
import {
  DRIVER_STATUSES, EVENT_TYPES, LICENCE_CLASSES, PARTNER_STATUSES, TODAY, eligibleDrivers, nextId, validateAssignment, validateDriver, validateEvent, validatePartner,
  type Driver, type DriverStatus, type EventType, type LicenceClass, type Partner, type PartnerStatus,
} from "@/lib/partners";
import { buildPeople, driverIdFor, driverScore, idleRow, recentEvents, riskBand, type DriverRow, type PartnerRow } from "@/lib/people";
import type { Key } from "@/lib/i18n";

type Tab = "partners" | "drivers" | "assign";
const PAGE = 25;

interface PForm { name: string; city: string; contact: string; phone: string; trucks: string; reeferTrucks: string; contractEnd: string; insuranceEnd: string; status: PartnerStatus }
interface DForm { name: string; partnerId: string; phone: string; licenceNo: string; licenceClass: LicenceClass; licenceExpiry: string; years: string; coldChain: boolean; status: DriverStatus }

const blankPartner = (): PForm => ({ name: "", city: "riyadh", contact: "", phone: "", trucks: "40", reeferTrucks: "10", contractEnd: "2027-12-31", insuranceEnd: "2027-06-30", status: "active" });
const blankDriver = (partnerId: string): DForm => ({ name: "", partnerId, phone: "", licenceNo: "", licenceClass: "heavy", licenceExpiry: "2028-12-31", years: "5", coldChain: false, status: "active" });

const gradeClass = (g: string) => `grade grade-${g}`;

export function PeopleManager({ admin = false }: { admin?: boolean }) {
  const { t, lang, persona, fleet, alerts, journeys, registry, savePartner, removePartner, saveDriver, removeDriver, logEvent, assignDriver } = useApp();
  const canEdit = persona === "operator";
  const [tab, setTab] = useState<Tab>("partners");
  const [msg, setMsg] = useState<string | null>(null);

  const people = useMemo(() => buildPeople(registry, fleet ?? [], alerts, journeys), [registry, fleet, alerts, journeys]);
  const partnerRows = useMemo(() => {
    const by = new Map(people.partners.map((p) => [p.id, p]));
    return registry.partners.map((p) => by.get(p.id) ?? { ...idleRow(p), drivers: registry.drivers.filter((d) => d.partnerId === p.id).length }).sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  }, [people, registry]);
  const driverRows = useMemo(() => {
    const by = new Map(people.drivers.map((d) => [d.id, d]));
    const ev = recentEvents(registry.events);
    return registry.drivers.map((d): DriverRow => {
      const hit = by.get(d.id);
      if (hit) return hit;
      const mine = ev.filter((e) => e.driverId === d.id);
      const score = driverScore(d, mine, 0, 0);
      return { id: d.id, name: d.name, partnerId: d.partnerId, status: d.status, containers: 0, events30: mine.length, eventPoints: 0, openCritical: 0, openWarning: 0, licenceDays: 0, licenceState: "ok", score, band: riskBand(score) };
    });
  }, [people, registry]);
  const partnerName = (id: string) => registry.partners.find((p) => p.id === id)?.name ?? id;
  const cityName = (id: string) => (lang === "ar" ? CITIES[id]?.ar : CITIES[id]?.en) ?? id;
  const flash = (m: string) => setMsg(m);

  return (
    <div className="people" data-testid="people-manager">
      {!canEdit ? <p className="note" data-testid="pp-readonly">{t("pp_readonly")}</p> : null}
      <div className="seg" role="group" aria-label={t("pp_title")}>
        {(["partners", "drivers", "assign"] as Tab[]).map((k) => (
          <button key={k} type="button" className="btn-sm" aria-pressed={tab === k} onClick={() => { setTab(k); setMsg(null); }} data-testid={`pp-tab-${k}`}>{t(`pp_tab_${k}` as Key)}</button>
        ))}
      </div>
      <p className="muted small" role="status" aria-live="polite" data-testid="pp-msg">{msg ?? ""}</p>
      {tab === "partners" ? <PartnersTab rows={partnerRows} {...{ canEdit, admin, cityName, registry, savePartner, removePartner, flash, t }} /> : null}
      {tab === "drivers" ? <DriversTab rows={driverRows} {...{ canEdit, admin, partnerName, registry, saveDriver, removeDriver, logEvent, flash, t }} /> : null}
      {tab === "assign" ? <AssignTab {...{ canEdit, registry, fleet: fleet ?? [], assignDriver, partnerName, flash, t }} /> : null}
    </div>
  );
}

type T = ReturnType<typeof useApp>["t"];
type Registry = ReturnType<typeof useApp>["registry"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="stack">{label}{children}</label>;
}

function Errors({ list, prefix, t }: { list: string[]; prefix: string; t: T }) {
  if (list.length === 0) return null;
  return <ul className="form-errors" role="alert" data-testid="pp-errors">{list.map((e) => <li key={e}>{t(`${prefix}${e}` as Key)}</li>)}</ul>;
}

/* ------------------------------ partners ------------------------------ */

function PartnersTab({ rows, canEdit, admin, cityName, registry, savePartner, removePartner, flash, t }: {
  rows: PartnerRow[]; canEdit: boolean; admin: boolean; cityName: (id: string) => string; registry: Registry;
  savePartner: (p: Partner) => void; removePartner: (id: string) => void; flash: (m: string) => void; t: T;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<PForm>(blankPartner());
  const [errs, setErrs] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [status, setStatus] = useState<PartnerStatus | "all">("all");
  const shown = rows.filter((r) => status === "all" || r.status === status);

  const open = (id: string | "new") => {
    setErrs([]); setEditing(id);
    const p = registry.partners.find((x) => x.id === id);
    setForm(p ? { name: p.name, city: p.city, contact: p.contact, phone: p.phone, trucks: String(p.trucks), reeferTrucks: String(p.reeferTrucks), contractEnd: p.contractEnd, insuranceEnd: p.insuranceEnd, status: p.status } : blankPartner());
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = { ...form, trucks: Number(form.trucks), reeferTrucks: Number(form.reeferTrucks) };
    const others = registry.partners.filter((p) => p.id !== editing);
    const list = validatePartner(input, others);
    setErrs(list);
    if (list.length) return;
    const id = editing === "new" ? nextId("FP", registry.partners) : (editing as string);
    savePartner({ ...input, name: input.name.trim(), contact: input.contact.trim(), phone: input.phone.trim(), id, source: registry.partners.find((p) => p.id === id)?.source ?? "user" });
    flash(t("pp_saved", { name: input.name.trim() }));
    setEditing(null);
  };
  const remove = (r: PartnerRow) => {
    if (r.containers > 0) { flash(t("pp_blocked", { name: r.name, n: r.containers })); setConfirm(null); return; }
    removePartner(r.id); flash(t("pp_removed", { name: r.name })); setConfirm(null);
  };
  const set = <K extends keyof PForm>(k: K, v: PForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <section aria-label={t("pp_tab_partners")}>
      <div className="filters">
        <label>{t("pp_th_status")}
          <select value={status} onChange={(e) => setStatus(e.target.value as PartnerStatus | "all")} data-testid="pp-partner-status-filter">
            <option value="all">{t("all")}</option>
            {PARTNER_STATUSES.map((s) => <option key={s} value={s}>{t(`pp_ps_${s}` as Key)}</option>)}
          </select>
        </label>
        <span className="muted small" data-testid="pp-partner-count">{t("pp_count_partners", { n: shown.length })}</span>
        {canEdit ? <button type="button" className="btn small" onClick={() => open("new")} data-testid="pp-add-partner">{t("pp_add_partner")}</button> : null}
      </div>
      {editing ? (
        <form className="card pform" onSubmit={submit} noValidate data-testid="pp-partner-form" aria-label={editing === "new" ? t("pp_new_partner") : t("pp_edit")}>
          <h3>{editing === "new" ? t("pp_new_partner") : t("pp_edit")}</h3>
          <div className="fgrid">
            <Field label={t("pp_f_name")}><input value={form.name} onChange={(e) => set("name", e.target.value)} data-testid="pf-name" autoComplete="off" /></Field>
            <Field label={t("pp_f_depot")}><select value={form.city} onChange={(e) => set("city", e.target.value)} data-testid="pf-city">{Object.keys(CITIES).map((c) => <option key={c} value={c}>{cityName(c)}</option>)}</select></Field>
            <Field label={t("pp_f_contact")}><input value={form.contact} onChange={(e) => set("contact", e.target.value)} data-testid="pf-contact" autoComplete="off" /></Field>
            <Field label={t("pp_f_phone")}><input value={form.phone} inputMode="numeric" placeholder="05xxxxxxxx" onChange={(e) => set("phone", e.target.value)} data-testid="pf-phone" autoComplete="off" /></Field>
            <Field label={t("pp_f_trucks")}><input value={form.trucks} inputMode="numeric" onChange={(e) => set("trucks", e.target.value)} data-testid="pf-trucks" /></Field>
            <Field label={t("pp_f_reefers")}><input value={form.reeferTrucks} inputMode="numeric" onChange={(e) => set("reeferTrucks", e.target.value)} data-testid="pf-reefers" /></Field>
            <Field label={t("pp_f_contract")}><input type="date" value={form.contractEnd} onChange={(e) => set("contractEnd", e.target.value)} data-testid="pf-contract" /></Field>
            <Field label={t("pp_f_insurance")}><input type="date" value={form.insuranceEnd} onChange={(e) => set("insuranceEnd", e.target.value)} data-testid="pf-insurance" /></Field>
            <Field label={t("pp_f_status")}><select value={form.status} onChange={(e) => set("status", e.target.value as PartnerStatus)} data-testid="pf-status">{PARTNER_STATUSES.map((s) => <option key={s} value={s}>{t(`pp_ps_${s}` as Key)}</option>)}</select></Field>
          </div>
          <Errors list={errs} prefix="pp_pe_" t={t} />
          <div className="td-row"><button type="submit" className="btn" data-testid="pf-save">{t("pp_save_partner")}</button><button type="button" className="btn ghost" onClick={() => setEditing(null)}>{t("pp_cancel")}</button></div>
        </form>
      ) : null}
      <div className="table-wrap" tabIndex={0} role="region" aria-label={t("pp_tab_partners")}>
        <table className="table" data-testid="pp-partner-table">
          <thead><tr>
            <th scope="col">{t("pp_th_partner")}</th><th scope="col">{t("pp_th_depot")}</th><th scope="col">{t("pp_th_status")}</th><th scope="col">{t("pp_th_drivers")}</th><th scope="col">{t("pp_th_containers")}</th>
            <th scope="col">{t("pp_th_score")}</th><th scope="col">{t("pp_th_contract")}</th><th scope="col">{t("pp_th_insurance")}</th>{canEdit ? <th scope="col">{t("pp_th_actions")}</th> : null}
          </tr></thead>
          <tbody>
            {shown.map((r) => {
              const p = registry.partners.find((x) => x.id === r.id);
              if (!p) return null;
              return (
                <tr key={r.id} data-testid="pp-partner-row" data-id={r.id}>
                  <th scope="row">{p.name}</th><td>{cityName(p.city)}</td>
                  <td><span className={`pill pp-${p.status}`}>{t(`pp_ps_${p.status}` as Key)}</span></td>
                  <td>{r.drivers}</td><td>{r.containers}</td>
                  <td>{r.containers > 0 ? <><b>{r.score}</b> <span className={gradeClass(r.grade)} title={t("pp_grade", { g: r.grade })}>{r.grade}</span></> : <span className="muted">{t("pp_none")}</span>}</td>
                  <td>{p.contractEnd}</td><td>{p.insuranceEnd}</td>
                  {canEdit ? (
                    <td className="row-actions">
                      <button type="button" className="btn-sm" onClick={() => open(p.id)} data-testid="pp-edit-partner">{t("pp_edit")}</button>
                      {admin ? (confirm === p.id ? (
                        <>
                          <span className="small">{t("pp_remove_confirm", { name: p.name })}</span>
                          <button type="button" className="btn-sm danger" onClick={() => remove(r)} data-testid="pp-confirm-remove">{t("pp_confirm")}</button>
                          <button type="button" className="btn-sm" onClick={() => setConfirm(null)}>{t("pp_cancel")}</button>
                        </>
                      ) : <button type="button" className="btn-sm" onClick={() => setConfirm(p.id)} data-testid="pp-remove-partner">{t("pp_remove")}</button>) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------ drivers ------------------------------ */

function DriversTab({ rows, canEdit, admin, partnerName, registry, saveDriver, removeDriver, logEvent, flash, t }: {
  rows: DriverRow[]; canEdit: boolean; admin: boolean; partnerName: (id: string) => string; registry: Registry;
  saveDriver: (d: Driver) => void; removeDriver: (id: string) => void; logEvent: (e: { driverId: string; type: EventType; at: string; note: string }) => void; flash: (m: string) => void; t: T;
}) {
  const [partner, setPartner] = useState("all");
  const [risk, setRisk] = useState<"all" | "high" | "watch" | "good">("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<DForm>(blankDriver(registry.partners[0]?.id ?? ""));
  const [errs, setErrs] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [evFor, setEvFor] = useState<string | null>(null);
  const [ev, setEv] = useState<{ type: EventType; at: string; note: string }>({ type: "speeding", at: TODAY, note: "" });
  const [evErrs, setEvErrs] = useState<string[]>([]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => (partner === "all" || r.partnerId === partner) && (risk === "all" || r.band === risk) && (!needle || r.name.toLowerCase().includes(needle) || r.id.toLowerCase().includes(needle)))
      .sort((a, b) => a.score - b.score || (a.id < b.id ? -1 : 1));
  }, [rows, partner, risk, q]);

  const open = (id: string | "new") => {
    setErrs([]); setEditing(id);
    const d = registry.drivers.find((x) => x.id === id);
    setForm(d ? { name: d.name, partnerId: d.partnerId, phone: d.phone, licenceNo: d.licenceNo, licenceClass: d.licenceClass, licenceExpiry: d.licenceExpiry, years: String(d.years), coldChain: d.coldChain, status: d.status } : blankDriver(registry.partners.find((p) => p.status !== "suspended")?.id ?? registry.partners[0]?.id ?? ""));
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = { ...form, years: Number(form.years) };
    const list = validateDriver(input, registry.partners, registry.drivers.filter((d) => d.id !== editing));
    setErrs(list);
    if (list.length) return;
    const id = editing === "new" ? nextId("DR", registry.drivers) : (editing as string);
    saveDriver({ ...input, name: input.name.trim(), phone: input.phone.trim(), licenceNo: input.licenceNo.trim(), id, source: registry.drivers.find((d) => d.id === id)?.source ?? "user" });
    flash(t("pp_saved", { name: input.name.trim() }));
    setEditing(null);
  };
  const remove = (r: DriverRow) => {
    if (r.containers > 0) { flash(t("pp_blocked", { name: r.name, n: r.containers })); setConfirm(null); return; }
    removeDriver(r.id); flash(t("pp_removed", { name: r.name })); setConfirm(null);
  };
  const log = (e: React.FormEvent) => {
    e.preventDefault();
    const list = validateEvent({ driverId: evFor ?? "", ...ev }, registry.drivers);
    setEvErrs(list);
    if (list.length) return;
    logEvent({ driverId: evFor as string, ...ev, note: ev.note.trim() });
    flash(t("pp_ev_logged"));
    setEvFor(null);
  };
  const set = <K extends keyof DForm>(k: K, v: DForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const reset = (fn: () => void) => { fn(); setLimit(PAGE); };

  return (
    <section aria-label={t("pp_tab_drivers")}>
      <div className="filters">
        <label>{t("pp_filter_partner")}
          <select value={partner} onChange={(e) => reset(() => setPartner(e.target.value))} data-testid="pp-driver-partner-filter">
            <option value="all">{t("all")}</option>
            {registry.partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label>{t("pp_filter_risk")}
          <select value={risk} onChange={(e) => reset(() => setRisk(e.target.value as typeof risk))} data-testid="pp-driver-risk-filter">
            <option value="all">{t("all")}</option>
            {(["high", "watch", "good"] as const).map((b) => <option key={b} value={b}>{t(`pp_risk_${b}` as Key)}</option>)}
          </select>
        </label>
        <label>{t("pp_filter_search")}<input type="search" value={q} onChange={(e) => reset(() => setQ(e.target.value))} data-testid="pp-driver-q" /></label>
        <span className="muted small" aria-live="polite" data-testid="pp-driver-count">{t("pp_count_drivers", { n: shown.length })}</span>
        {canEdit ? <button type="button" className="btn small" onClick={() => open("new")} data-testid="pp-add-driver">{t("pp_add_driver")}</button> : null}
      </div>
      {editing ? (
        <form className="card pform" onSubmit={submit} noValidate data-testid="pp-driver-form" aria-label={editing === "new" ? t("pp_new_driver") : t("pp_edit")}>
          <h3>{editing === "new" ? t("pp_new_driver") : t("pp_edit")}</h3>
          <div className="fgrid">
            <Field label={t("pp_d_name")}><input value={form.name} onChange={(e) => set("name", e.target.value)} data-testid="df-name" autoComplete="off" /></Field>
            <Field label={t("pp_d_partner")}><select value={form.partnerId} onChange={(e) => set("partnerId", e.target.value)} data-testid="df-partner">{registry.partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label={t("pp_d_phone")}><input value={form.phone} inputMode="numeric" placeholder="05xxxxxxxx" onChange={(e) => set("phone", e.target.value)} data-testid="df-phone" autoComplete="off" /></Field>
            <Field label={t("pp_d_licence")}><input value={form.licenceNo} inputMode="numeric" onChange={(e) => set("licenceNo", e.target.value)} data-testid="df-licence" autoComplete="off" /></Field>
            <Field label={t("pp_d_class")}><select value={form.licenceClass} onChange={(e) => set("licenceClass", e.target.value as LicenceClass)} data-testid="df-class">{LICENCE_CLASSES.map((c) => <option key={c} value={c}>{t(c === "heavy" ? "pp_lc_heavy" : "pp_lc_heavy_adr")}</option>)}</select></Field>
            <Field label={t("pp_d_expiry")}><input type="date" value={form.licenceExpiry} onChange={(e) => set("licenceExpiry", e.target.value)} data-testid="df-expiry" /></Field>
            <Field label={t("pp_d_years")}><input value={form.years} inputMode="numeric" onChange={(e) => set("years", e.target.value)} data-testid="df-years" /></Field>
            <Field label={t("pp_d_status")}><select value={form.status} onChange={(e) => set("status", e.target.value as DriverStatus)} data-testid="df-status">{DRIVER_STATUSES.map((s) => <option key={s} value={s}>{t(`pp_ds_${s}` as Key)}</option>)}</select></Field>
            <label className="check"><input type="checkbox" checked={form.coldChain} onChange={(e) => set("coldChain", e.target.checked)} data-testid="df-cold" />{t("pp_d_cold")}</label>
          </div>
          <Errors list={errs} prefix="pp_de_" t={t} />
          <div className="td-row"><button type="submit" className="btn" data-testid="df-save">{t("pp_save_driver")}</button><button type="button" className="btn ghost" onClick={() => setEditing(null)}>{t("pp_cancel")}</button></div>
        </form>
      ) : null}
      {evFor ? (
        <form className="card pform" onSubmit={log} noValidate data-testid="pp-event-form" aria-label={t("pp_ev_title")}>
          <h3>{t("pp_ev_title")}: {registry.drivers.find((d) => d.id === evFor)?.name}</h3>
          <p className="muted small">{t("pp_ev_hint")}</p>
          <div className="fgrid">
            <Field label={t("pp_ev_type")}><select value={ev.type} onChange={(e) => setEv((x) => ({ ...x, type: e.target.value as EventType }))} data-testid="ef-type">{EVENT_TYPES.map((k) => <option key={k} value={k}>{t(`pp_evt_${k}` as Key)}</option>)}</select></Field>
            <Field label={t("pp_ev_date")}><input type="date" value={ev.at} onChange={(e) => setEv((x) => ({ ...x, at: e.target.value }))} data-testid="ef-date" /></Field>
            <Field label={t("pp_ev_note")}><input value={ev.note} onChange={(e) => setEv((x) => ({ ...x, note: e.target.value }))} data-testid="ef-note" /></Field>
          </div>
          <Errors list={evErrs} prefix="pp_ee_" t={t} />
          <div className="td-row"><button type="submit" className="btn" data-testid="ef-save">{t("pp_ev_log")}</button><button type="button" className="btn ghost" onClick={() => setEvFor(null)}>{t("pp_cancel")}</button></div>
        </form>
      ) : null}
      <div className="table-wrap" tabIndex={0} role="region" aria-label={t("pp_tab_drivers")}>
        <table className="table" data-testid="pp-driver-table">
          <thead><tr>
            <th scope="col">{t("pp_th_driver")}</th><th scope="col">{t("pp_th_partner")}</th><th scope="col">{t("pp_th_status")}</th><th scope="col">{t("pp_th_containers")}</th>
            <th scope="col">{t("pp_th_events")}</th><th scope="col">{t("pp_th_safety")}</th><th scope="col">{t("pp_th_licence")}</th>{canEdit ? <th scope="col">{t("pp_th_actions")}</th> : null}
          </tr></thead>
          <tbody>
            {shown.slice(0, limit).map((r) => {
              const d = registry.drivers.find((x) => x.id === r.id);
              if (!d) return null;
              const days = Math.round((new Date(d.licenceExpiry + "T00:00:00Z").getTime() - new Date(TODAY + "T00:00:00Z").getTime()) / 86400000);
              return (
                <tr key={r.id} data-testid="pp-driver-row" data-id={r.id}>
                  <th scope="row">{d.name}<small className="muted"> {d.id}</small></th><td>{partnerName(d.partnerId)}</td>
                  <td><span className={`pill pp-${d.status}`}>{t(`pp_ds_${d.status}` as Key)}</span></td>
                  <td>{r.containers}</td><td>{r.events30}</td>
                  <td><span className={`risk risk-${r.band}`}><b>{r.score}</b> {t(`pp_risk_${r.band}` as Key)}</span></td>
                  <td className={days < 0 ? "lic-bad" : days < 30 ? "lic-warn" : ""}>{days < 0 ? t("pp_lic_expired_days", { n: -days }) : t("pp_lic_days", { n: days })}</td>
                  {canEdit ? (
                    <td className="row-actions">
                      <button type="button" className="btn-sm" onClick={() => open(d.id)} data-testid="pp-edit-driver">{t("pp_edit")}</button>
                      <button type="button" className="btn-sm" onClick={() => { setEvFor(d.id); setEvErrs([]); setEv({ type: "speeding", at: TODAY, note: "" }); }} data-testid="pp-log-event">{t("pp_ev_log")}</button>
                      {admin ? (confirm === d.id ? (
                        <>
                          <button type="button" className="btn-sm danger" onClick={() => remove(r)} data-testid="pp-confirm-remove-driver">{t("pp_confirm")}</button>
                          <button type="button" className="btn-sm" onClick={() => setConfirm(null)}>{t("pp_cancel")}</button>
                        </>
                      ) : <button type="button" className="btn-sm" onClick={() => setConfirm(d.id)} data-testid="pp-remove-driver">{t("pp_remove")}</button>) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {shown.length > limit ? <div className="table-foot"><span /><button type="button" className="btn small ghost" onClick={() => setLimit((n) => n + PAGE)} data-testid="pp-driver-more">{t("rep_more")}</button></div> : null}
    </section>
  );
}

/* ------------------------------ assign ------------------------------ */

function AssignTab({ canEdit, registry, fleet, assignDriver, partnerName, flash, t }: {
  canEdit: boolean; registry: Registry; fleet: ReturnType<typeof useApp>["fleet"] & object; assignDriver: (c: string, d: string) => void; partnerName: (id: string) => string; flash: (m: string) => void; t: T;
}) {
  const [cid, setCid] = useState("");
  const [partner, setPartner] = useState("all");
  const [driver, setDriver] = useState("");
  const [errs, setErrs] = useState<string[]>([]);
  const c = fleet.find((x) => x.id.toLowerCase() === cid.trim().toLowerCase());
  const pool = useMemo(() => eligibleDrivers(registry, !!c?.reefer).filter((d) => partner === "all" || d.partnerId === partner).slice(0, 200), [registry, c, partner]);
  const current = c ? registry.drivers.find((d) => d.id === driverIdFor(registry, c)) : undefined;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!c) { setErrs(["unknown"]); return; }
    const d = registry.drivers.find((x) => x.id === driver);
    const list = validateAssignment(d, registry.partners.find((p) => p.id === d?.partnerId), c.reefer);
    setErrs(list);
    if (list.length) return;
    assignDriver(c.id, driver);
    flash(t("pp_as_done", { id: c.id, driver: d?.name ?? driver }));
    setDriver("");
  };
  return (
    <section aria-label={t("pp_tab_assign")}>
      <form className="card pform" onSubmit={submit} noValidate data-testid="pp-assign-form">
        <h3>{t("pp_as_title")}</h3>
        <p className="muted small">{t("pp_as_hint")}</p>
        <div className="fgrid">
          <Field label={t("pp_as_container")}><input list="pp-containers" value={cid} placeholder="SC-1043" onChange={(e) => { setCid(e.target.value); setDriver(""); setErrs([]); }} data-testid="af-container" autoComplete="off" /></Field>
          <Field label={t("pp_filter_partner")}><select value={partner} onChange={(e) => setPartner(e.target.value)} data-testid="af-partner"><option value="all">{t("all")}</option>{registry.partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label={t("pp_as_driver")}><select value={driver} onChange={(e) => setDriver(e.target.value)} data-testid="af-driver"><option value="">{t("pp_f_pick")}</option>{pool.map((d) => <option key={d.id} value={d.id}>{d.name} · {partnerName(d.partnerId)}</option>)}</select></Field>
        </div>
        <datalist id="pp-containers">{fleet.slice(0, 60).map((x) => <option key={x.id} value={x.id} />)}</datalist>
        {c ? <p className="muted small" data-testid="af-current">{t("pp_as_current", { driver: current?.name ?? "–", partner: current ? partnerName(current.partnerId) : "–" })} <Link href={`/container/?id=${c.id}`}>{c.id}</Link></p> : null}
        {errs.length ? <ul className="form-errors" role="alert" data-testid="pp-errors">{errs.map((e) => <li key={e}>{t(e === "unknown" ? "pp_as_unknown" : (`pp_ae_${e}` as Key))}</li>)}</ul> : null}
        <div className="td-row"><button type="submit" className="btn" disabled={!canEdit} data-testid="af-save">{t("pp_as_save")}</button></div>
      </form>
    </section>
  );
}
