"use client";
import { useEffect, useState } from "react";
import { ContainerPage } from "@/components/ContainerPage";
import { Card } from "@/components/ui";
import { LineChart } from "@/components/LineChart";
import { KsaMap, type PathLine } from "@/components/KsaMap";
import { useApp } from "../providers";
import { getProfile } from "@/lib/profiles";
import { getRoute, corridorPath } from "@/lib/geo";
import { actualPath } from "@/lib/route";
import type { Container, Sample } from "@/lib/types";

export default function Page() {
  return <ContainerPage current="replay">{(c, s) => <Replay c={c} s={s} />}</ContainerPage>;
}

function Replay({ c, s }: { c: Container; s: Sample[] }) {
  const { t } = useApp();
  const prof = getProfile(c.profileId)!;
  const route = getRoute(c.routeId)!;
  const [i, setI] = useState(s.length - 1);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const h = setInterval(() => setI((x) => (x >= s.length - 1 ? 0 : x + 1)), 120);
    return () => clearInterval(h);
  }, [playing, s.length]);
  const cur = s[i];
  const paths: PathLine[] = [
    { d: corridorPath(route), color: "#a29a86", width: 3, dashed: true },
    { d: actualPath(s.slice(0, i + 1)), color: "#2f4f46", width: 3.4 },
  ];
  const events = s.filter((x, k) => x.door === "open" && (k === 0 || s[k - 1].door === "closed"));
  return (
    <>
      <Card title={t("replay_title")}>
        <KsaMap label={t("map_label")} paths={paths} truck={{ lon: cur.lon, lat: cur.lat }} zoomLabels={{ in: t("zoom_in"), out: t("zoom_out"), reset: t("zoom_reset") }} />
        <div className="scrub">
          <button type="button" className="btn" onClick={() => setPlaying((p) => !p)} data-testid="play-btn">{playing ? t("replay_pause") : t("replay_play")}</button>
          <input type="range" min={0} max={s.length - 1} value={i} onChange={(e) => { setPlaying(false); setI(Number(e.target.value)); }} aria-label={t("replay_slider")} aria-valuetext={t("replay_at", { m: cur.minAgo })} data-testid="scrubber" />
          <output data-testid="replay-time">{t("replay_at", { m: cur.minAgo })}</output>
        </div>
        <p className="muted small" data-testid="replay-readout">{cur.tempC} °C · {cur.rh} % · {Math.round(cur.speedKmh)} km/h · {t(cur.door === "open" ? "door_open" : "door_closed")}</p>
      </Card>
      <div className="grid-2">
        <LineChart title={t("chart_temp")} values={s.map((x) => x.tempC)} minAgo={s.map((x) => x.minAgo)} band={[prof.tMin, prof.tMax]} unit="°C" cursor={i} />
        <Card title={t("replay_events")} testid="door-events">
          {events.length === 0 ? <p className="muted">{t("no_door_events")}</p> : <ul className="list">{events.map((e) => <li key={e.minAgo}>{t("door_event_open", { m: e.minAgo })}</li>)}</ul>}
        </Card>
      </div>
    </>
  );
}
