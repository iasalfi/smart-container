"use client";
import { useEffect, useRef, useState } from "react";
import { BASEMAP_STYLE, BASEMAP_TIMEOUT_MS, OFFLINE_STYLE, loadMapLibre, type MlLib, type MlMap, type MlMarker } from "@/lib/maplib";
import type { Coord } from "@/lib/roads";

export interface LivePoint { id: string; lon: number; lat: number; color: string; selected?: boolean; tip?: string }
export interface LiveLine { id: string; coords: Coord[]; color: string; width?: number; dashed?: boolean }
export interface LivePin { id: string; lon: number; lat: number; color: string; label: string }
export interface LiveCity { id: string; lon: number; lat: number; name: string }
export interface LiveTruck { lon: number; lat: number; bearing: number; label: string }

interface Props {
  label: string;
  points?: LivePoint[];
  lines?: LiveLine[];
  pins?: LivePin[];
  cities?: LiveCity[];
  truck?: LiveTruck | null;
  /** Changes when the map should re-fit to the bounds. */
  fitKey: string;
  bounds: [Coord, Coord] | null;
  follow?: boolean;
  onSelect?: (id: string) => void;
  zoomLabels: { in: string; out: string; fit: string };
  credit: string;
  basemapNote: { online: string; offline: string };
}

type Basemap = "loading" | "online" | "offline";

/** A MapLibre map: base map, road lines, container points, pins and one moving truck. */
export function LiveMap({ label, points = [], lines = [], pins = [], cities = [], truck, fitKey, bounds, follow, onSelect, zoomLabels, credit, basemapNote }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const libRef = useRef<MlLib | null>(null);
  const [ready, setReady] = useState(false);
  const [basemap, setBasemap] = useState<Basemap>("loading");
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const latest = useRef({ points, lines });
  const markers = useRef<{ pins: MlMarker[]; cities: MlMarker[]; truck: MlMarker | null }>({ pins: [], cities: [], truck: null });
  const select = useRef(onSelect);
  const lastFit = useRef("");
  const boundsRef = useRef(bounds);
  // keep the latest props where the map callbacks can read them
  useEffect(() => { latest.current = { points, lines }; select.current = onSelect; boundsRef.current = bounds; });

  const draw = () => {
    const map = mapRef.current;
    if (!map) return;
    const { points: pts, lines: lns } = latest.current;
    const pf = { type: "FeatureCollection", features: pts.map((p) => ({ type: "Feature", geometry: { type: "Point", coordinates: [p.lon, p.lat] }, properties: { id: p.id, color: p.color, sel: p.selected ? 1 : 0, tip: p.tip ?? "" } })) };
    const lf = { type: "FeatureCollection", features: lns.map((l) => ({ type: "Feature", geometry: { type: "LineString", coordinates: l.coords }, properties: { id: l.id, color: l.color, width: l.width ?? 4, dash: l.dashed ? 1 : 0 } })) };
    if (!map.getSource("scm-lines")) {
      map.addSource("scm-lines", { type: "geojson", data: lf });
      map.addLayer({ id: "scm-lines-casing", type: "line", source: "scm-lines", paint: { "line-color": "#ffffff", "line-width": ["+", ["get", "width"], 3], "line-opacity": 0.9 }, layout: { "line-cap": "round", "line-join": "round" } });
      map.addLayer({ id: "scm-lines-solid", type: "line", source: "scm-lines", filter: ["==", ["get", "dash"], 0], paint: { "line-color": ["get", "color"], "line-width": ["get", "width"] }, layout: { "line-cap": "round", "line-join": "round" } });
      map.addLayer({ id: "scm-lines-dash", type: "line", source: "scm-lines", filter: ["==", ["get", "dash"], 1], paint: { "line-color": ["get", "color"], "line-width": ["get", "width"], "line-dasharray": [2, 1.6] }, layout: { "line-cap": "butt", "line-join": "round" } });
    } else map.getSource("scm-lines")!.setData(lf);
    if (!map.getSource("scm-points")) {
      map.addSource("scm-points", { type: "geojson", data: pf });
      map.addLayer({ id: "scm-points", type: "circle", source: "scm-points", paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, ["case", ["==", ["get", "sel"], 1], 7, 3.2], 9, ["case", ["==", ["get", "sel"], 1], 11, 6]],
        "circle-color": ["get", "color"], "circle-stroke-color": ["case", ["==", ["get", "sel"], 1], "#2b3a55", "#ffffff"], "circle-stroke-width": ["case", ["==", ["get", "sel"], 1], 2.5, 1],
      } });
      map.on("click", "scm-points", (e) => { const id = e.features?.[0]?.properties.id; if (typeof id === "string") select.current?.(id); });
      map.on("mousemove", "scm-points", (e) => { map.getCanvas().style.cursor = "pointer"; const f = e.features?.[0]; setHover(f ? { x: e.point.x, y: e.point.y, text: String(f.properties.tip || f.properties.id) } : null); });
      map.on("mouseleave", "scm-points", () => { map.getCanvas().style.cursor = ""; setHover(null); });
    } else map.getSource("scm-points")!.setData(pf);
  };

  // create the map once
  useEffect(() => {
    let dead = false;
    let timer = 0;
    const held = markers.current;
    loadMapLibre().then((lib) => {
      if (dead || !box.current) return;
      libRef.current = lib;
      const map = new lib.Map({ container: box.current, style: BASEMAP_STYLE, center: [44.5, 24.2], zoom: 4.4, attributionControl: false, dragRotate: false, pitchWithRotate: false, touchPitch: false, fadeDuration: 0 });
      mapRef.current = map;
      window.__liveMap = map;
      const goOffline = () => { if (dead) return; setBasemap("offline"); map.setStyle(OFFLINE_STYLE); };
      let styled = false;
      map.on("style.load", () => { if (dead) return; if (!styled) { styled = true; window.clearTimeout(timer); setBasemap((b) => (b === "offline" ? b : "online")); } draw(); });
      map.on("load", () => { if (dead) return; setReady(true); draw(); const b = boundsRef.current; if (b) map.fitBounds(b, { padding: 60, duration: 0, maxZoom: 9 }); });
      map.on("error", (e) => { if (!styled && !dead) { window.clearTimeout(timer); goOffline(); } void e; });
      timer = window.setTimeout(() => { if (!styled) goOffline(); }, BASEMAP_TIMEOUT_MS);
    }).catch(() => { if (!dead) setFailed(true); });
    return () => {
      dead = true; window.clearTimeout(timer);
      [...held.pins, ...held.cities, ...(held.truck ? [held.truck] : [])].forEach((x) => x.remove());
      mapRef.current?.remove(); mapRef.current = null; window.__liveMap = undefined;
    };
  }, []);

  // data layers
  useEffect(() => { if (ready) draw(); }, [ready, points, lines]);

  // pins and city labels are DOM markers so they stay readable without map fonts
  useEffect(() => {
    const map = mapRef.current, lib = libRef.current;
    if (!ready || !map || !lib) return;
    markers.current.pins.forEach((m) => m.remove());
    markers.current.pins = pins.map((p) => {
      const el = document.createElement("div");
      el.className = "live-pin"; el.setAttribute("data-testid", "live-pin"); el.setAttribute("data-id", p.id); el.title = p.label; el.setAttribute("role", "img"); el.setAttribute("aria-label", p.label);
      el.style.setProperty("--pin", p.color);
      return new lib.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(map);
    });
  }, [ready, pins]);

  useEffect(() => {
    const map = mapRef.current, lib = libRef.current;
    if (!ready || !map || !lib) return;
    markers.current.cities.forEach((m) => m.remove());
    markers.current.cities = cities.map((c) => {
      const el = document.createElement("div");
      el.className = "live-city"; el.setAttribute("data-testid", "live-city"); el.textContent = c.name;
      return new lib.Marker({ element: el, anchor: "left", offset: [6, 0] }).setLngLat([c.lon, c.lat]).addTo(map);
    });
  }, [ready, cities]);

  // the truck
  useEffect(() => {
    const map = mapRef.current, lib = libRef.current;
    if (!ready || !map || !lib) return;
    const m = markers.current;
    if (!truck) { m.truck?.remove(); m.truck = null; return; }
    if (!m.truck) {
      const el = document.createElement("div");
      el.className = "live-truck"; el.setAttribute("data-testid", "live-truck"); el.setAttribute("role", "img");
      el.innerHTML = '<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" focusable="false"><circle cx="20" cy="20" r="17" fill="#2b3a55" stroke="#fff" stroke-width="3"/><path d="M20 8l7 15-7-3.500L13 23z" fill="#fff"/></svg>';
      m.truck = new lib.Marker({ element: el, rotationAlignment: "map" }).setLngLat([truck.lon, truck.lat]).addTo(map);
    }
    m.truck.setLngLat([truck.lon, truck.lat]);
    const el = m.truck.getElement();
    el.setAttribute("aria-label", truck.label);
    el.setAttribute("data-lon", truck.lon.toFixed(4)); el.setAttribute("data-lat", truck.lat.toFixed(4));
    const svg = el.querySelector("svg"); if (svg) (svg as SVGElement).style.transform = `rotate(${Math.round(truck.bearing)}deg)`;
    if (follow) map.easeTo({ center: [truck.lon, truck.lat], duration: 900 });
  }, [ready, truck, follow]);

  // fit to the road when the subject changes
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !bounds || lastFit.current === fitKey) return;
    lastFit.current = fitKey;
    map.fitBounds(bounds, { padding: 60, duration: 700, maxZoom: 9 });
  }, [ready, fitKey, bounds]);

  const fit = () => { const map = mapRef.current; if (map && bounds) map.fitBounds(bounds, { padding: 60, duration: 600, maxZoom: 9 }); };

  return (
    <div className="live-wrap">
      <div ref={box} className="live-map" role="region" aria-label={label} data-testid="live-map" data-ready={ready ? "1" : "0"} data-basemap={basemap} data-points={points.length} data-lines={lines.length} data-pins={pins.length} />
      {failed ? <p className="live-fail" role="alert" data-testid="live-fail">{basemapNote.offline}</p> : null}
      {hover ? <div className="map-tip" role="tooltip" style={{ left: hover.x, top: hover.y }} data-testid="live-tip"><strong>{hover.text}</strong></div> : null}
      <div className="map-controls" role="group" aria-label={label}>
        <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label={zoomLabels.in} data-testid="live-zoom-in">+</button>
        <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label={zoomLabels.out} data-testid="live-zoom-out">−</button>
        <button type="button" onClick={fit} aria-label={zoomLabels.fit} data-testid="live-fit">⤢</button>
      </div>
      <p className="live-credit" data-testid="live-credit">{credit}{basemap === "offline" ? <span> · {basemapNote.offline}</span> : null}</p>
    </div>
  );
}
