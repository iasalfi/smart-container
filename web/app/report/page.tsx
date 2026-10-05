"use client";
import { ContainerPage } from "@/components/ContainerPage";
import { LineChart } from "@/components/LineChart";
import { useApp } from "../providers";
import { computeHealth, excursionC } from "@/lib/health";
import { excursions } from "@/lib/route";
import { getProfile } from "@/lib/profiles";
import type { Container, Sample } from "@/lib/types";

export default function Page() {
  return <ContainerPage current="report">{(c, s) => <Report c={c} s={s} />}</ContainerPage>;
}

function Report({ c, s }: { c: Container; s: Sample[] }) {
  const { t, lang } = useApp();
  const prof = getProfile(c.profileId)!;
  const h = computeHealth(s, prof);
  const ex = excursions(s, prof.tMin, prof.tMax);
  const doorEvents = s.filter((x, k) => x.door === "open" && (k === 0 || s[k - 1].door === "closed"));
  return (
    <article className="report" data-testid="report">
      <div className="page-head no-print"><button type="button" className="btn" onClick={() => window.print()} data-testid="print-btn">{t("report_print")}</button></div>
      <h1 className="print-title">{t("report_title")}: {c.id}</h1>
      <h2>{t("report_summary")}</h2>
      <dl className="dl">
        <dt>{t("cargo")}</dt><dd>{prof.name[lang]}</dd>
        <dt>{t("customer")}</dt><dd>{c.customer}</dd>
        <dt>{t("route")}</dt><dd>{c.origin} → {c.destination}</dd>
        <dt>{t("health_score")}</dt><dd data-testid="report-score">{Math.round(h.score)}</dd>
        <dt>{t("band", { min: prof.tMin, max: prof.tMax })}</dt><dd>{t("minutes_short", { m: h.minutesOutside })}</dd>
      </dl>
      <LineChart title={t("chart_temp")} values={s.map((x) => x.tempC)} minAgo={s.map((x) => x.minAgo)} band={[prof.tMin, prof.tMax]} unit="°C" />
      <h2>{t("report_excursions")}</h2>
      {ex.length === 0 ? <p data-testid="no-excursions">{t("report_none")}</p> : (
        <table className="table" data-testid="excursion-table"><thead><tr><th>{t("report_from")}</th><th>{t("report_to")}</th><th>{t("report_peak")}</th></tr></thead>
          <tbody>{ex.map((e, i) => (<tr key={i}><td>{t("minutes_ago", { m: e.from })}</td><td>{t("minutes_ago", { m: e.to })}</td><td>{e.peak} °C ({(Math.round(excursionC(e.peak, prof) * 10) / 10)} °C)</td></tr>))}</tbody></table>
      )}
      <h2>{t("report_door_log")}</h2>
      {doorEvents.length === 0 ? <p>{t("no_door_events")}</p> : <ul className="list">{doorEvents.map((e) => <li key={e.minAgo}>{t("door_event_open", { m: e.minAgo })}</li>)}</ul>}
      <p className="muted small">{t("print_footer")}</p>
    </article>
  );
}
