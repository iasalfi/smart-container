"use client";
import { useApp } from "@/app/providers";
import type { Analytics, Kpi, WidgetId } from "@/lib/analytics";
import { PROFILES } from "@/lib/profiles";
import { formatMinutes } from "@/lib/itsm";
import { STATUS_COLOR } from "./ui";
import { BarList, Columns, Donut, Panel, SERIES } from "./Charts";
import type { Key } from "@/lib/i18n";

const TONE_KEY = { good: "an_tone_good", warn: "an_tone_warn", bad: "an_tone_bad" } as const;
const BAND_COLORS = ["#6fa585", "#a9b86f", "#dcae5f", "#c9695d"];
const HEALTH_COLORS = ["#c9695d", "#d98a6a", "#dcae5f", "#a9b86f", "#6fa585"];
const LOCK_COLORS: Record<string, string> = { locked: "#6fa585", unlocked: "#dcae5f", cut: "#c9695d", none: "#8d97ad" };
const health = (n: number) => (n >= 80 ? "#6fa585" : n >= 60 ? "#dcae5f" : "#c9695d");

export function KpiTile({ k }: { k: Kpi }) {
  const { t } = useApp();
  return (
    <div className={`an-kpi tone-${k.tone}`} data-testid={`an-kpi-${k.id}`}>
      <span className="an-kpi-n">{k.value.toLocaleString("en-US")}{k.unit === "pct" ? "%" : ""}</span>
      <span className="an-kpi-l">{t(`ank_${k.id}` as Key)}</span>
      {k.tone !== "neutral" ? <span className="sr-only">{t(TONE_KEY[k.tone])}</span> : null}
    </div>
  );
}

export function Widget({ id, a }: { id: WidgetId; a: Analytics }) {
  const { t, lang } = useApp();
  const title = t(`anw_${id}` as Key);
  const none = <p className="muted">{t("an_none")}</p>;
  const cargoName = (pid: string) => PROFILES.find((p) => p.id === pid)?.name[lang] ?? pid;
  const typeRows = (rows: { key: string; n: number }[]) => rows.map((r) => ({ label: t(`alert_type_${r.key}` as Key), n: r.n }));
  switch (id) {
    case "status_mix": {
      const total = a.statusMix.reduce((s, x) => s + x.n, 0);
      return <Panel id={id} title={title}><Donut testid="an-status" centre={total.toLocaleString("en-US")} caption={t("kpi_total")} slices={a.statusMix.map((s) => ({ label: t(`status_${s.key}` as Key), n: s.n, color: STATUS_COLOR[s.key as "normal" | "warning" | "critical"] }))} /></Panel>;
    }
    case "delay_bands":
      return <Panel id={id} title={title}><Columns cols={a.delayBands.map((b, k) => ({ label: t(`and_${b.key}` as Key), n: b.n, color: BAND_COLORS[k] }))} /></Panel>;
    case "corridor_load":
      return <Panel id={id} title={title}>{a.corridors.length ? <BarList rows={a.corridors.map((c) => ({ label: c.key, n: c.n, sub: c.delayed ? `${c.delayed} ${t("repc_delayed").toLowerCase()}` : undefined }))} /> : none}</Panel>;
    case "alert_types":
      return <Panel id={id} title={title}>{a.alertTypes.length ? <BarList rows={typeRows(a.alertTypes)} /> : none}</Panel>;
    case "sla": {
      const s = a.itsm;
      const rows: [string, string][] = [
        [t("an_sla_active"), String(s.active)], [t("an_sla_breached"), String(s.breached)], [t("an_sla_at_risk"), String(s.atRisk)],
        [t("an_sla_unassigned"), String(s.unassigned)], [t("an_sla_mtta"), s.mtta === null ? t("an_sla_na") : formatMinutes(s.mtta)], [t("an_sla_mttr"), s.mttr === null ? t("an_sla_na") : formatMinutes(s.mttr)],
      ];
      return <Panel id={id} title={title}><dl className="an-dl">{rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}</dl></Panel>;
    }
    case "cargo_health":
      return <Panel id={id} title={title}>{a.cargoHealth.length ? <BarList max={100} rows={a.cargoHealth.map((r) => ({ label: cargoName(r.id), n: r.health, color: health(r.health), sub: `${r.n}` }))} /> : none}</Panel>;
    case "temp_compliance":
      return <Panel id={id} title={title}>{a.tempCompliance.length ? <BarList max={100} suffix="%" rows={a.tempCompliance.map((r) => ({ label: cargoName(r.id), n: r.pct, color: r.pct >= 95 ? "#6fa585" : r.pct >= 85 ? "#dcae5f" : "#c9695d", sub: t("an_in_band_of", { a: r.inBand, b: r.n }) }))} /> : none}</Panel>;
    case "health_bands":
      return <Panel id={id} title={title}><Columns testid="an-health-bands" cols={["0-19", "20-39", "40-59", "60-79", "80-100"].map((l, k) => ({ label: l, n: a.healthBands[k], color: HEALTH_COLORS[k] }))} /></Panel>;
    case "security_types":
      return <Panel id={id} title={title}><BarList rows={typeRows(a.securityTypes)} /></Panel>;
    case "corridor_security":
      return <Panel id={id} title={title}>{a.corridorSecurity.length ? <BarList rows={a.corridorSecurity.map((r) => ({ label: r.key, n: r.n }))} /> : none}</Panel>;
    case "lock_state":
      return <Panel id={id} title={title}><Donut testid="an-locks" centre={a.lockState.reduce((s, x) => s + x.n, 0).toLocaleString("en-US")} caption={t("kpi_total")} slices={a.lockState.map((s) => ({ label: t(`lock_${s.key}` as Key), n: s.n, color: LOCK_COLORS[s.key] }))} /></Panel>;
    case "eta_buckets":
      return <Panel id={id} title={title}><BarList rows={a.etaBuckets.map((b, k) => ({ label: t(`ane_${b.key}` as Key), n: b.n, color: SERIES[k] }))} /></Panel>;
    case "cargo_mix":
      return <Panel id={id} title={title}>{a.cargoMix.length ? <Donut testid="an-cargo-mix" centre={a.cargoMix.reduce((s, x) => s + x.n, 0).toLocaleString("en-US")} caption={t("kpi_total")} slices={a.cargoMix.map((r, k) => ({ label: cargoName(r.key), n: r.n, color: SERIES[k % SERIES.length] }))} /> : none}</Panel>;
  }
}
