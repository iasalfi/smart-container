"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useApp } from "../../providers";
import { ApiGate, NotFoundState } from "@/components/ui";
import { JourneyMap } from "@/components/JourneyMap";
import { MilestoneIcon } from "@/components/OpsArt";
import { CITIES } from "@/lib/cities";
import {
  PORT_CITIES, makeJourney, nextJourneyId, planJourney, validateOnboarding, validatePlan,
  type OnboardError, type OnboardInput, type PlanError, type PlanInput,
} from "@/lib/journey";
import { fmtDuration, fmtTime } from "@/lib/opsfmt";
import { PROFILES, getProfile } from "@/lib/profiles";

const STEPS = ["cargo", "vehicle", "route", "plan", "review"] as const;
const STEP_ERRORS: Record<(typeof STEPS)[number], OnboardError[]> = {
  cargo: ["container_format", "container_taken", "seal_format", "profile_missing", "setpoint_missing", "setpoint_range", "customer_missing"],
  vehicle: ["plate_format", "plate_taken", "driver_missing", "phone_format"],
  route: [], plan: [], review: [],
};

function tomorrowAt6(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T06:00`;
}

export default function NewJourneyPage() {
  const { t, lang, journeys, fleet, alertsReady, apiError, retry, persona, saveJourney } = useApp();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState(false);
  const [o, setO] = useState<OnboardInput>({ containerId: "", plate: "", sealNo: "", profileId: "dairy", setpointC: 4, customer: "", driverName: "", driverPhone: "" });
  const [route, setRoute] = useState<PlanInput>({ originId: "jeddah", destinationId: "riyadh", viaIds: [], departAt: tomorrowAt6(), speedKmh: 80, reefer: true, customs: false, deliverBy: "" });
  const [via, setVia] = useState("");
  const city = (id: string) => (lang === "ar" ? CITIES[id].ar : CITIES[id].en);
  const taken = useMemo(() => ({
    containers: [...(fleet ?? []).map((c) => c.id), ...journeys.map((j) => j.containerId)],
    plates: [...(fleet ?? []).map((c) => c.plate), ...journeys.map((j) => j.plate)],
  }), [fleet, journeys]);
  const customers = useMemo(() => [...new Set([...(fleet ?? []).map((c) => c.customer), ...journeys.map((j) => j.customer)])].sort(), [fleet, journeys]);
  const prof = getProfile(o.profileId);
  const input: PlanInput = { ...route, reefer: !!prof?.reefer, deliverBy: route.deliverBy || undefined };
  const planErrors = validatePlan(input);
  const plan = planErrors.length === 0 ? planJourney(input) : null;
  const formErrors = validateOnboarding(o, taken);
  const stepName = STEPS[step];
  const errsHere: (OnboardError | PlanError)[] = stepName === "route" ? planErrors : STEP_ERRORS[stepName].length ? formErrors.filter((e) => STEP_ERRORS[stepName].includes(e)) : [];
  const blocked = errsHere.length > 0 || (stepName === "plan" && !plan) || (stepName === "review" && (formErrors.length > 0 || !plan));
  const next = () => { if (blocked) { setTouched(true); return; } setTouched(false); setStep((s) => Math.min(STEPS.length - 1, s + 1)); };
  const back = () => { setTouched(false); setStep((s) => Math.max(0, s - 1)); };

  if (!fleet || !alertsReady) return <ApiGate error={apiError} onRetry={retry} />;
  if (persona === "customer") return <NotFoundState title={t("not_allowed_title")} body={t("not_allowed_body")} />;

  const dispatch = () => {
    if (!plan || formErrors.length > 0) return;
    const id = nextJourneyId(journeys);
    saveJourney(makeJourney(id, o, input));
    router.push(`/operations/journey/?id=${id}`);
  };
  const set = <K extends keyof OnboardInput>(k: K, v: OnboardInput[K]) => setO((x) => ({ ...x, [k]: v }));
  const setR = <K extends keyof PlanInput>(k: K, v: PlanInput[K]) => setRoute((x) => ({ ...x, [k]: v }));
  const errBox = (list: (OnboardError | PlanError)[]) => touched && list.length > 0 ? (
    <ul className="err-list" role="alert" data-testid="wiz-errors">{list.map((e) => <li key={e}>{t(`ops_err_${e}` as const)}</li>)}</ul>
  ) : null;
  const available = Object.keys(CITIES).filter((id) => id !== route.originId && id !== route.destinationId && !route.viaIds.includes(id));

  return (
    <div className="page">
      <div className="page-head"><div><h1>{t("wiz_title")}</h1><p className="muted">{t("wiz_sub")}</p></div></div>
      <ol className="steps" data-testid="wizard-steps" aria-label={t("wiz_title")}>
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? "cur" : i < step ? "done" : ""} aria-current={i === step ? "step" : undefined} data-testid={`step-${s}`}><b>{i + 1}</b> {t(`wiz_step_${s}` as const)}</li>
        ))}
      </ol>

      <section className="card wiz" aria-labelledby="wiz-h" data-testid={`panel-${stepName}`}>
        <h2 id="wiz-h">{t(`wiz_step_${stepName}` as const)}</h2>

        {stepName === "cargo" ? (
          <div className="form-grid">
            <label className="stack">{t("ops_f_customer")}
              <input list="customers" value={o.customer} onChange={(e) => set("customer", e.target.value)} data-testid="f-customer" autoComplete="off" />
              <datalist id="customers">{customers.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="stack">{t("ops_f_profile")}
              <select value={o.profileId} onChange={(e) => { const p = getProfile(e.target.value); setO((x) => ({ ...x, profileId: e.target.value, setpointC: p?.reefer ? Math.round(((p.tMin + p.tMax) / 2) * 10) / 10 : null })); }} data-testid="f-profile">
                {PROFILES.map((p) => <option key={p.id} value={p.id}>{lang === "ar" ? p.name.ar : p.name.en}{p.reefer ? ` (${p.tMin} to ${p.tMax} °C)` : ""}</option>)}
              </select>
            </label>
            {prof?.reefer ? (
              <label className="stack">{t("ops_f_setpoint")}
                <input type="number" step="0.5" value={o.setpointC ?? ""} onChange={(e) => set("setpointC", e.target.value === "" ? null : Number(e.target.value))} data-testid="f-setpoint" />
              </label>
            ) : null}
            <label className="stack">{t("ops_f_container")}
              <input value={o.containerId} onChange={(e) => set("containerId", e.target.value.toUpperCase())} placeholder="SC-2001" data-testid="f-container" autoComplete="off" />
            </label>
            <label className="stack">{t("ops_f_seal")}
              <input value={o.sealNo} onChange={(e) => set("sealNo", e.target.value.toUpperCase())} placeholder="SEAL-90210" data-testid="f-seal" autoComplete="off" />
            </label>
          </div>
        ) : null}

        {stepName === "vehicle" ? (
          <div className="form-grid">
            <label className="stack">{t("ops_f_plate")}
              <input value={o.plate} onChange={(e) => set("plate", e.target.value.toUpperCase())} placeholder="ABC 1234" data-testid="f-plate" autoComplete="off" />
            </label>
            <label className="stack">{t("ops_f_driver")}
              <input value={o.driverName} onChange={(e) => set("driverName", e.target.value)} data-testid="f-driver" autoComplete="off" />
            </label>
            <label className="stack">{t("ops_f_phone")}
              <input value={o.driverPhone} inputMode="tel" onChange={(e) => set("driverPhone", e.target.value)} placeholder="05XXXXXXXX" data-testid="f-phone" autoComplete="off" />
            </label>
          </div>
        ) : null}

        {stepName === "route" ? (
          <div className="form-grid">
            <label className="stack">{t("wiz_origin")}
              <select value={route.originId} onChange={(e) => setR("originId", e.target.value)} data-testid="f-origin">{Object.keys(CITIES).map((id) => <option key={id} value={id}>{city(id)}</option>)}</select>
            </label>
            <label className="stack">{t("wiz_destination")}
              <select value={route.destinationId} onChange={(e) => setR("destinationId", e.target.value)} data-testid="f-destination">{Object.keys(CITIES).map((id) => <option key={id} value={id}>{city(id)}</option>)}</select>
            </label>
            <div className="stack">
              <span>{t("wiz_via")}</span>
              <div className="td-row">
                <select value={via} onChange={(e) => setVia(e.target.value)} aria-label={t("wiz_via")} data-testid="f-via-select">
                  <option value="">{t("wiz_via_pick")}</option>
                  {available.map((id) => <option key={id} value={id}>{city(id)}</option>)}
                </select>
                <button type="button" className="btn ghost small" disabled={!via} onClick={() => { setR("viaIds", [...route.viaIds, via]); setVia(""); }} data-testid="f-via-add">{t("wiz_via_add")}</button>
              </div>
              <ul className="via-list">
                {route.viaIds.map((id, i) => (
                  <li key={id} data-testid="via-item">{i + 1}. {city(id)} <button type="button" className="link" onClick={() => setR("viaIds", route.viaIds.filter((x) => x !== id))} aria-label={t("wiz_via_remove", { city: city(id) })}>{t("wiz_via_remove_short")}</button></li>
                ))}
              </ul>
            </div>
            <label className="stack">{t("wiz_depart")}
              <input type="datetime-local" value={route.departAt} onChange={(e) => setR("departAt", e.target.value)} data-testid="f-depart" />
            </label>
            <label className="stack">{t("wiz_deadline")}
              <input type="datetime-local" value={route.deliverBy ?? ""} onChange={(e) => setR("deliverBy", e.target.value)} data-testid="f-deadline" />
            </label>
            <label className="stack">{t("wiz_speed")}
              <input type="number" min={40} max={100} step={5} value={route.speedKmh} onChange={(e) => setR("speedKmh", Number(e.target.value))} data-testid="f-speed" />
            </label>
            {PORT_CITIES.includes(route.destinationId) ? (
              <label className="check"><input type="checkbox" checked={route.customs} onChange={(e) => setR("customs", e.target.checked)} data-testid="f-customs" /> {t("wiz_customs")}</label>
            ) : null}
          </div>
        ) : null}

        {stepName === "plan" && plan ? (
          <div className="plan" data-testid="plan-view">
            <div className="ops-kpis">
              <div className="ik" data-testid="plan-km"><b>{plan.totalKm} km</b><span>{t("ops_k_distance")}</span></div>
              <div className="ik" data-testid="plan-drive"><b>{fmtDuration(plan.driveMin, lang)}</b><span>{t("wiz_drive")}</span></div>
              <div className="ik" data-testid="plan-stops"><b>{fmtDuration(plan.stopMin, lang)}</b><span>{t("wiz_stops")}</span></div>
              <div className="ik" data-testid="plan-eta"><b>{fmtTime(plan.arriveMs, lang)}</b><span>{t("ops_k_planned_arrival")}</span></div>
            </div>
            {plan.warnings.length ? (
              <ul className="warn-list" data-testid="plan-warnings">{plan.warnings.map((w) => <li key={w}>{t(`ops_warn_${w}` as const)}</li>)}</ul>
            ) : <p className="muted small" data-testid="plan-ok">{t("wiz_no_warnings")}</p>}
            <div className="plan-grid">
              <JourneyMap plan={plan} />
              <ol className="mslist" aria-label={t("ops_milestones")}>
                {plan.milestones.map((m) => (
                  <li key={m.id} className="msrow" data-testid="plan-row" data-kind={m.kind}>
                    <span className="msicon"><MilestoneIcon kind={m.kind} /></span>
                    <div className="msbody"><strong>{t(`ms_kind_${m.kind}` as const)}{m.city ? ` · ${city(m.city)}` : ""}</strong><span className="muted small">{m.city ? "" : `km ${m.km} · `}{m.dwellMin > 0 ? t("ops_dwell", { m: fmtDuration(m.dwellMin, lang) }) : t("ops_no_dwell")}</span></div>
                    <div className="mstimes"><span>{fmtTime(m.plannedAt, lang)}</span></div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : null}

        {stepName === "review" && plan ? (
          <dl className="facts review" data-testid="review">
            <div><dt>{t("ops_f_customer")}</dt><dd>{o.customer}</dd></div>
            <div><dt>{t("ops_f_container")}</dt><dd>{o.containerId} · {lang === "ar" ? prof?.name.ar : prof?.name.en}{o.setpointC !== null && prof?.reefer ? ` · ${o.setpointC} °C` : ""}</dd></div>
            <div><dt>{t("ops_f_seal")}</dt><dd>{o.sealNo}</dd></div>
            <div><dt>{t("ops_f_plate")}</dt><dd>{o.plate}</dd></div>
            <div><dt>{t("ops_f_driver")}</dt><dd>{o.driverName} · {o.driverPhone}</dd></div>
            <div><dt>{t("wiz_step_route")}</dt><dd>{plan.points.map(city).join(" → ")} · {plan.totalKm} km</dd></div>
            <div><dt>{t("wiz_depart")}</dt><dd>{fmtTime(plan.departMs, lang)}</dd></div>
            <div><dt>{t("ops_k_planned_arrival")}</dt><dd>{fmtTime(plan.arriveMs, lang)}</dd></div>
            <div><dt>{t("ops_milestones")}</dt><dd>{t("wiz_milestone_count", { n: plan.milestones.length })}</dd></div>
          </dl>
        ) : null}

        {errBox(errsHere)}
        <div className="td-row wiz-nav">
          <button type="button" className="btn ghost" onClick={back} disabled={step === 0} data-testid="wiz-back">{t("tour_back")}</button>
          {stepName !== "review" ? (
            <button type="button" className="btn" onClick={next} data-testid="wiz-next">{t("wiz_next")}</button>
          ) : (
            <button type="button" className="btn" onClick={dispatch} disabled={!plan || formErrors.length > 0} data-testid="dispatch-btn">{t("wiz_dispatch")}</button>
          )}
        </div>
      </section>
    </div>
  );
}
