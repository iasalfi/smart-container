"use client";
import { ContainerPage } from "@/components/ContainerPage";
import { Card, Gauge } from "@/components/ui";
import { LineChart } from "@/components/LineChart";
import { AlertRow } from "@/components/AlertRow";
import { useApp } from "../providers";
import { getProfile } from "@/lib/profiles";
import { excursionC } from "@/lib/health";
import { getRoute, routeLengthKm } from "@/lib/geo";
import { etaMinutes } from "@/lib/route";
import { CITIES } from "@/lib/cities";

export default function Page() {
  return (
    <ContainerPage current="container">
      {(c, s) => <Detail c={c} s={s} />}
    </ContainerPage>
  );
}

import type { Container, Sample } from "@/lib/types";
function Detail({ c, s }: { c: Container; s: Sample[] }) {
  const { t, lang, alerts, lockOverride } = useApp();
  const prof = getProfile(c.profileId)!;
  const route = getRoute(c.routeId)!;
  const inBand = excursionC(c.tempC, prof) === 0;
  const mine = alerts.filter((a) => a.containerId === c.id);
  const eta = etaMinutes(c.progress, routeLengthKm(route));
  const lock = lockOverride[c.id] ?? c.lock;
  const tile = (label: string, value: string, sub?: string, testid?: string, tone?: string) => (
    <div className={`tile ${tone ?? ""}`} data-testid={testid}><span className="tile-l">{label}</span><span className="tile-v">{value}</span>{sub ? <span className="tile-s">{sub}</span> : null}</div>
  );
  return (
    <>
      <div className="grid-2">
        <Card title={t("cargo_card")} testid="cargo-card">
          <dl className="dl">
            <dt>{t("cargo")}</dt><dd>{prof.name[lang]}</dd>
            <dt>{t("customer")}</dt><dd>{c.customer}</dd>
            <dt>{t("route")}</dt><dd>{CITIES[route.from][lang]} → {CITIES[route.to][lang]}</dd>
            <dt>{t("driver")}</dt><dd>{c.driver}</dd>
            <dt>{t("plate")}</dt><dd>{c.plate}</dd>
            <dt>{t("eta")}</dt><dd data-testid="eta">{t("eta_value", { h: Math.floor(eta / 60), m: eta % 60 })}</dd>
          </dl>
        </Card>
        <Card title={t("live_readings")} testid="readings">
          <div className="tiles">
            {tile(t("temp"), `${c.tempC} °C`, inBand ? t("within_band") : t("outside_band"), "tile-temp", inBand ? "ok" : "bad")}
            {tile(t("humidity"), `${c.rh} %`, undefined, "tile-rh")}
            {tile(t("door"), t(c.door === "open" ? "door_open" : "door_closed"), undefined, "tile-door", c.door === "open" ? "bad" : "ok")}
            {tile(t("lock"), t(`lock_${lock}` as const), undefined, "tile-lock")}
            {tile(t("speed"), `${Math.round(c.speedKmh)} km/h`, undefined, "tile-speed")}
            {tile(t("battery"), `${c.batteryPct} %`, undefined, "tile-battery", c.batteryPct < 30 ? "bad" : "")}
            {tile(t("signal"), `${c.signal}/5`, c.online ? undefined : t("last_seen", { m: c.lastSeenMin }), "tile-signal")}
            {c.setpointC !== null ? tile(t("setpoint"), `${c.setpointC} °C`, undefined, "tile-setpoint") : null}
            {c.gas ? tile(t("gas"), `${c.gas.nh3} / ${c.gas.h2s} ppm`, "NH3 / H2S", "tile-gas") : null}
          </div>
          <Gauge value={c.healthScore} label={t("health_score")} />
        </Card>
      </div>
      <Card title={t("alerts_for_container")} testid="container-alerts">
        {mine.length === 0 ? <p className="muted">{t("no_alerts")}</p> : <ul className="alert-list">{mine.map((a) => <AlertRow key={a.id} a={a} />)}</ul>}
      </Card>
      <div className="grid-2">
        <LineChart title={t("chart_temp")} values={s.map((x) => x.tempC)} minAgo={s.map((x) => x.minAgo)} band={[prof.tMin, prof.tMax]} unit="°C" bandLabel={t("band", { min: prof.tMin, max: prof.tMax })} />
        <LineChart title={t("chart_rh")} values={s.map((x) => x.rh)} minAgo={s.map((x) => x.minAgo)} band={[prof.rhMin, prof.rhMax]} unit="%" color="#3d7a78" bandLabel={t("band", { min: prof.rhMin, max: prof.rhMax })} />
      </div>
    </>
  );
}
