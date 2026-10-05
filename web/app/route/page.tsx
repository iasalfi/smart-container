"use client";
import { ContainerPage } from "@/components/ContainerPage";
import { Card } from "@/components/ui";
import { KsaMap, type PathLine, type Pin } from "@/components/KsaMap";
import { useApp } from "../providers";
import { corridorPath, getRoute, routeLengthKm } from "@/lib/geo";
import { actualPath, deviationKm, etaMinutes, findStops } from "@/lib/route";
import type { Container, Sample } from "@/lib/types";

export default function Page() {
  return <ContainerPage current="route">{(c, s) => <RouteView c={c} s={s} />}</ContainerPage>;
}

function RouteView({ c, s }: { c: Container; s: Sample[] }) {
  const { t } = useApp();
  const route = getRoute(c.routeId)!;
  const stops = findStops(s, route);
  const dev = deviationKm(s, route);
  const eta = etaMinutes(c.progress, routeLengthKm(route));
  const paths: PathLine[] = [
    { d: corridorPath(route), color: "#7F95AA", width: 3, dashed: true, label: t("planned") },
    { d: actualPath(s), color: "#0B2545", width: 3.4, label: t("actual") },
  ];
  const pins: Pin[] = stops.map((st, i) => ({ id: `stop-${i}`, lon: st.lon, lat: st.lat, color: st.scheduled ? "#3BA55D" : "#D64545", label: `${st.scheduled ? t("stop_scheduled") : t("stop_unscheduled")} · ${t("minutes_short", { m: st.durationMin })}` }));
  return (
    <>
      <div className="grid-main">
        <Card title={t("route_title")}>
          <KsaMap label={t("map_label")} paths={paths} pins={pins} truck={{ lon: c.lon, lat: c.lat }} zoomLabels={{ in: t("zoom_in"), out: t("zoom_out"), reset: t("zoom_reset") }} />
          <p className="legend small"><span className="swatch dashed" />{t("planned")} <span className="swatch solid" />{t("actual")} <span className="dot dot-ok" />{t("stop_scheduled")} <span className="dot dot-critical" />{t("stop_unscheduled")}</p>
        </Card>
        <aside className="side">
          <Card testid="route-stats">
            <dl className="dl">
              <dt>{t("deviation")}</dt><dd data-testid="deviation">{dev.toFixed(1)} km</dd>
              <dt>{t("eta")}</dt><dd>{t("eta_value", { h: Math.floor(eta / 60), m: eta % 60 })}</dd>
            </dl>
          </Card>
        </aside>
      </div>
      <Card title={t("stops")} testid="stops-card">
        {stops.length === 0 ? <p className="muted">{t("no_stops")}</p> : (
          <table className="table" data-testid="stops-table">
            <thead><tr><th>{t("stop_kind")}</th><th>{t("stop_from")}</th><th>{t("stop_duration")}</th></tr></thead>
            <tbody>{stops.map((st, i) => (
              <tr key={i} data-testid="stop-row" data-scheduled={st.scheduled}>
                <td><span className={`pill ${st.scheduled ? "pill-normal" : "pill-critical"}`}>{st.scheduled ? t("stop_scheduled") : t("stop_unscheduled")}</span></td>
                <td>{t("minutes_ago", { m: st.startMinAgo })}</td><td>{t("minutes_short", { m: st.durationMin })}</td>
              </tr>))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
