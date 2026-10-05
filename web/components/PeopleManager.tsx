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
