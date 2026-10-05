"use client";
import { useMemo } from "react";
import { KsaMap, type CityMark, type Pin } from "@/components/KsaMap";
import { KIND_COLOR } from "@/components/OpsArt";
import { CITIES } from "@/lib/cities";
import { project } from "@/lib/geo";
import { positionAt, progressShare, type Journey, type Plan, type Milestone } from "@/lib/journey";
import { useApp } from "@/app/providers";

type Shown = { plan: Plan; truckShare?: number };

/** Planned road, the pitstops and milestones as pins, and the truck where the last logged milestone puts it. */
export function JourneyMap({ plan, journey, height }: { plan: Plan; journey?: Journey; height?: number }) {
  const { t, lang } = useApp();
  const shown: Shown = { plan, truckShare: journey ? progressShare(journey) : undefined };
  const path = useMemo(() => shown.plan.points.map((id, i) => { const p = project(CITIES[id]); return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }).join(""), [shown.plan.points]);
  const pins: Pin[] = useMemo(() => shown.plan.milestones.filter((m: Milestone) => ["rest", "fuel", "overnight", "waypoint", "customs", "port_gate"].includes(m.kind)).map((m) => ({
    id: m.id, lon: m.lon, lat: m.lat, color: KIND_COLOR[m.kind], label: `${t(`ms_kind_${m.kind}` as const)}${m.city ? ` · ${lang === "ar" ? CITIES[m.city].ar : CITIES[m.city].en}` : ` · km ${m.km}`}`,
  })), [shown.plan.milestones, t, lang]);
  const cities: CityMark[] = shown.plan.points.map((id) => ({ id, lon: CITIES[id].lon, lat: CITIES[id].lat, name: lang === "ar" ? CITIES[id].ar : CITIES[id].en }));
  const a = CITIES[shown.plan.points[0]], b = CITIES[shown.plan.points[shown.plan.points.length - 1]];
  const lons = shown.plan.points.map((id) => CITIES[id].lon), lats = shown.plan.points.map((id) => CITIES[id].lat);
  const span = Math.max(Math.max(...lons) - Math.min(...lons), (Math.max(...lats) - Math.min(...lats)) * 1.2, 1);
  const zoom = Math.max(1, Math.min(2.4, 14 / span));
  const focus = { lon: (Math.min(...lons) + Math.max(...lons)) / 2, lat: (Math.min(...lats) + Math.max(...lats)) / 2, zoom };
  const truck = journey && shown.truckShare !== undefined && shown.truckShare > 0 && shown.truckShare < 1 ? positionAt(journey, shown.truckShare) : null;
  return (
    <KsaMap key={shown.plan.points.join(">")}
      label={t("ops_map_label", { from: lang === "ar" ? a.ar : a.en, to: lang === "ar" ? b.ar : b.en })}
      paths={[{ d: path, color: "#2f4f46", width: 3.5, dashed: true, label: t("ops_planned_road") }]}
      pins={pins} cities={cities} truck={truck} focus={focus}
      zoomLabels={{ in: t("zoom_in"), out: t("zoom_out"), reset: t("zoom_reset") }} height={height}
    />
  );
}
