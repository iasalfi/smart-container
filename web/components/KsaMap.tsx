"use client";
import { useEffect, useRef, useState } from "react";
import { KSA_PATH, NEIGHBOUR_PATH, VIEW } from "@/lib/geo-data";
import { project } from "@/lib/geo";

export interface Dot { id: string; lon: number; lat: number; color: string; r?: number; selected?: boolean; hollow?: boolean; label?: string; pulse?: boolean; tip?: string[] }
export interface PathLine { d: string; color: string; width?: number; dashed?: boolean; label?: string }
export interface Pin { id: string; lon: number; lat: number; color: string; label: string }

interface Props {
  label: string;
  dots?: Dot[];
  paths?: PathLine[];
  pins?: Pin[];
  truck?: { lon: number; lat: number } | null;
  onSelect?: (id: string) => void;
  zoomLabels: { in: string; out: string; reset: string };
  height?: number;
  focus?: { lon: number; lat: number; zoom: number } | null;
  /** Optional key shown on the map (dashboard only). */
  legend?: { title: string; items: { color: string; text: string; hollow?: boolean; pulse?: boolean }[] } | null;
  hint?: string;
}

export function KsaMap({ label, dots = [], paths = [], pins = [], truck, onSelect, zoomLabels, focus, legend, hint }: Props) {
  const [zoom, setZoom] = useState(focus?.zoom ?? 1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ sx: number; sy: number; px: number; py: number; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const centre = focus ? project(focus) : { x: VIEW.w / 2, y: VIEW.h / 2 };
  const w = VIEW.w / zoom, h = VIEW.h / zoom;
  const cx = zoom === 1 && !focus ? VIEW.w / 2 : centre.x;
  const cy = zoom === 1 && !focus ? VIEW.h / 2 : centre.y;
  const x0 = Math.min(Math.max(0, cx - w / 2 + pan.x), VIEW.w - w);
  const y0 = Math.min(Math.max(0, cy - h / 2 + pan.y), VIEW.h - h);
  const unit = 1 / zoom;

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current; const el = svgRef.current;
      if (!d || !el) return;
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (!d.moved && Math.hypot(dx, dy) < 4) return;
      d.moved = true; dragged.current = true; setHover(null);
      const rect = el.getBoundingClientRect();
      setPan({ x: d.px - (dx / rect.width) * w, y: d.py - (dy / rect.height) * h });
    };
    const up = () => { drag.current = null; window.setTimeout(() => { dragged.current = false; }, 0); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [w, h]);

  const zoomTo = (z: number) => { setZoom(z); if (z === 1) setPan({ x: 0, y: 0 }); };
  const hovered = hover ? dots.find((d) => d.id === hover.id) : undefined;

  return (
    <div className="map-wrap" ref={wrap}>
      <svg ref={svgRef} role="img" aria-label={label} viewBox={`${x0} ${y0} ${w} ${h}`} className={`map${zoom > 1 ? " pannable" : ""}`} data-testid="ksa-map" data-zoom={zoom}
        onPointerDown={(e) => { if (zoom > 1) drag.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y, moved: false }; void e; }}
        onPointerLeave={() => setHover(null)}>
        <rect x="0" y="0" width={VIEW.w} height={VIEW.h} fill="var(--sea)" />
        <path d={NEIGHBOUR_PATH} fill="#EEF1F4" stroke="#fff" strokeWidth={1.5 * unit} />
        <path d={KSA_PATH} fill="#D4ECE9" stroke="#0E8F86" strokeWidth={2.2 * unit} strokeLinejoin="round" />
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill="none" stroke={p.color} strokeWidth={(p.width ?? 3) * unit} strokeDasharray={p.dashed ? `${8 * unit} ${6 * unit}` : undefined} strokeLinecap="round" strokeLinejoin="round">
            {p.label ? <title>{p.label}</title> : null}
          </path>
        ))}
        {dots.filter((d) => d.pulse).map((d) => {
          const p = project(d);
          return <circle key={`ring-${d.id}`} className="pulse-ring" cx={p.x} cy={p.y} r={5 * unit} fill="none" stroke={d.color} strokeWidth={1.6 * unit} pointerEvents="none" style={{ ["--pr" as string]: `${15 * unit}px` }} />;
        })}
        {dots.map((d) => {
          const p = project(d);
          const r = (d.r ?? 4) * unit * (d.selected ? 1.8 : 1);
          return (
            <circle key={d.id} cx={p.x} cy={p.y} r={r} fill={d.hollow ? "#fff" : d.color} stroke={d.selected ? "#0B2545" : d.hollow ? d.color : "#fff"} strokeWidth={(d.selected ? 2.5 : d.hollow ? 1.8 : 0.8) * unit}
              data-testid="map-dot" data-id={d.id} className="dotc"
              onClick={onSelect ? () => { if (!dragged.current) onSelect(d.id); } : undefined}
              onPointerEnter={d.tip ? (e) => { const b = wrap.current?.getBoundingClientRect(); if (b && !drag.current) setHover({ id: d.id, x: e.clientX - b.left, y: e.clientY - b.top }); } : undefined}
              onPointerMove={d.tip ? (e) => { const b = wrap.current?.getBoundingClientRect(); if (b && !drag.current) setHover({ id: d.id, x: e.clientX - b.left, y: e.clientY - b.top }); } : undefined}
              onPointerLeave={d.tip ? () => setHover(null) : undefined}
              style={onSelect ? { cursor: "pointer" } : undefined}>
              {d.label && !d.tip ? <title>{d.label}</title> : null}
            </circle>
          );
        })}
        {pins.map((pn) => {
          const p = project(pn);
          return (
            <g key={pn.id} transform={`translate(${p.x} ${p.y}) scale(${unit})`} data-testid="map-pin" data-id={pn.id}>
              <path d="M0 0C-8-11 -11-16 -11-22A11 11 0 1 1 11-22C11-16 8-11 0 0Z" fill={pn.color} stroke="#fff" strokeWidth="2" />
              <circle cy="-22" r="4" fill="#fff" />
              <title>{pn.label}</title>
            </g>
          );
        })}
        {truck ? (() => { const p = project(truck); return (<g transform={`translate(${p.x} ${p.y}) scale(${unit})`} data-testid="map-truck"><circle r="13" fill="#0B2545" stroke="#fff" strokeWidth="3" /><path d="M-6 -4h8v7h-8zM2 -2h5l2 3v4h-7z" fill="#fff" /></g>); })() : null}
      </svg>
      {hovered && hover && hovered.tip ? (
        <div className="map-tip" role="tooltip" style={{ left: hover.x, top: hover.y }} data-testid="map-tip">
          <strong>{hovered.tip[0]}</strong>
          {hovered.tip.slice(1).map((l, i) => <span key={i}>{l}</span>)}
        </div>
      ) : null}
      <div className="map-controls" role="group" aria-label="Map controls">
        <button type="button" onClick={() => zoomTo(Math.min(8, zoom * 2))} aria-label={zoomLabels.in} data-testid="zoom-in">+</button>
        <button type="button" onClick={() => zoomTo(Math.max(1, zoom / 2))} aria-label={zoomLabels.out} data-testid="zoom-out">−</button>
        <button type="button" onClick={() => zoomTo(1)} aria-label={zoomLabels.reset} data-testid="zoom-reset">⟲</button>
      </div>
      {legend ? (
        <div className="map-legend" role="group" aria-label={legend.title}>
          {legend.items.map((it) => (
            <span key={it.text} className="lg"><i className={`lg-dot${it.hollow ? " hollow" : ""}${it.pulse ? " pulse" : ""}`} style={{ ["--c" as string]: it.color }} aria-hidden="true" />{it.text}</span>
          ))}
        </div>
      ) : null}
      {hint ? <p className="map-hint">{hint}</p> : null}
    </div>
  );
}
"use client";
import { useState } from "react";
import { KSA_PATH, NEIGHBOUR_PATH, VIEW } from "@/lib/geo-data";
import { project } from "@/lib/geo";

export interface Dot { id: string; lon: number; lat: number; color: string; r?: number; selected?: boolean; hollow?: boolean; label?: string }
export interface PathLine { d: string; color: string; width?: number; dashed?: boolean; label?: string }
export interface Pin { id: string; lon: number; lat: number; color: string; label: string }

interface Props {
  label: string;
  dots?: Dot[];
  paths?: PathLine[];
  pins?: Pin[];
  truck?: { lon: number; lat: number } | null;
  onSelect?: (id: string) => void;
  zoomLabels: { in: string; out: string; reset: string };
  height?: number;
  focus?: { lon: number; lat: number; zoom: number } | null;
}

export function KsaMap({ label, dots = [], paths = [], pins = [], truck, onSelect, zoomLabels, focus }: Props) {
  const [zoom, setZoom] = useState(focus?.zoom ?? 1);
  const centre = focus ? project(focus) : { x: VIEW.w / 2, y: VIEW.h / 2 };
  const w = VIEW.w / zoom, h = VIEW.h / zoom;
  const cx = zoom === 1 && !focus ? VIEW.w / 2 : centre.x;
  const cy = zoom === 1 && !focus ? VIEW.h / 2 : centre.y;
  const x0 = Math.min(Math.max(0, cx - w / 2), VIEW.w - w);
  const y0 = Math.min(Math.max(0, cy - h / 2), VIEW.h - h);
  const unit = 1 / zoom;
  return (
    <div className="map-wrap">
      <svg role="img" aria-label={label} viewBox={`${x0} ${y0} ${w} ${h}`} className="map" data-testid="ksa-map" data-zoom={zoom}>
        <rect x="0" y="0" width={VIEW.w} height={VIEW.h} fill="var(--sea)" />
        <path d={NEIGHBOUR_PATH} fill="#EEF1F4" stroke="#fff" strokeWidth={1.5 * unit} />
        <path d={KSA_PATH} fill="#D4ECE9" stroke="#0E8F86" strokeWidth={2.2 * unit} strokeLinejoin="round" />
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill="none" stroke={p.color} strokeWidth={(p.width ?? 3) * unit} strokeDasharray={p.dashed ? `${8 * unit} ${6 * unit}` : undefined} strokeLinecap="round" strokeLinejoin="round">
            {p.label ? <title>{p.label}</title> : null}
          </path>
        ))}
        {dots.map((d) => {
          const p = project(d);
          const r = (d.r ?? 4) * unit * (d.selected ? 1.8 : 1);
          return (
            <circle key={d.id} cx={p.x} cy={p.y} r={r} fill={d.hollow ? "#fff" : d.color} stroke={d.selected ? "#0B2545" : d.hollow ? d.color : "#fff"} strokeWidth={(d.selected ? 2.5 : d.hollow ? 1.8 : 0.8) * unit}
              data-testid="map-dot" data-id={d.id} onClick={onSelect ? () => onSelect(d.id) : undefined} style={onSelect ? { cursor: "pointer" } : undefined}>
              {d.label ? <title>{d.label}</title> : null}
            </circle>
          );
        })}
        {pins.map((pn) => {
          const p = project(pn);
          return (
            <g key={pn.id} transform={`translate(${p.x} ${p.y}) scale(${unit})`} data-testid="map-pin" data-id={pn.id}>
              <path d="M0 0C-8-11 -11-16 -11-22A11 11 0 1 1 11-22C11-16 8-11 0 0Z" fill={pn.color} stroke="#fff" strokeWidth="2" />
              <circle cy="-22" r="4" fill="#fff" />
              <title>{pn.label}</title>
            </g>
          );
        })}
        {truck ? (() => { const p = project(truck); return (<g transform={`translate(${p.x} ${p.y}) scale(${unit})`} data-testid="map-truck"><circle r="13" fill="#0B2545" stroke="#fff" strokeWidth="3" /><path d="M-6 -4h8v7h-8zM2 -2h5l2 3v4h-7z" fill="#fff" /></g>); })() : null}
      </svg>
      <div className="map-controls" role="group" aria-label="Map controls">
        <button type="button" onClick={() => setZoom((z) => Math.min(8, z * 2))} aria-label={zoomLabels.in} data-testid="zoom-in">+</button>
        <button type="button" onClick={() => setZoom((z) => Math.max(1, z / 2))} aria-label={zoomLabels.out} data-testid="zoom-out">−</button>
        <button type="button" onClick={() => setZoom(1)} aria-label={zoomLabels.reset} data-testid="zoom-reset">⟲</button>
      </div>
    </div>
  );
}
