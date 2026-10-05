"use client";
import { useId } from "react";

interface Props {
  title: string;
  values: number[];
  minAgo: number[];
  band?: [number, number];
  unit: string;
  color?: string;
  cursor?: number | null;
  bandLabel?: string;
  yDomain?: [number, number];
}

const W = 640, H = 200, PL = 44, PR = 12, PT = 12, PB = 26;

export function LineChart({ title, values, minAgo, band, unit, color = "#c9695d", cursor = null, bandLabel, yDomain }: Props) {
  const id = useId();
  const lo = Math.min(...values, band ? band[0] : Infinity), hi = Math.max(...values, band ? band[1] : -Infinity);
  const pad = (hi - lo) * 0.12 || 1;
  const y0 = yDomain ? yDomain[0] : lo - pad, y1 = yDomain ? yDomain[1] : hi + pad;
  const x = (i: number) => PL + (i / (values.length - 1)) * (W - PL - PR);
  const y = (v: number) => PT + (1 - (v - y0) / (y1 - y0)) * (H - PT - PB);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  const ticks = [0, 0.5, 1].map((f) => y0 + f * (y1 - y0));
  const hours = [24, 18, 12, 6, 0];
  return (
    <figure className="chart" data-testid="chart">
      <figcaption>{title}{bandLabel ? <span className="muted"> · {bandLabel}</span> : null}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${values.length} readings, latest ${values[values.length - 1]} ${unit}`}>
        <title id={id}>{title}</title>
        {band ? <rect x={PL} y={y(band[1])} width={W - PL - PR} height={Math.max(0, y(band[0]) - y(band[1]))} fill="#6fa585" opacity="0.14" data-testid="chart-band" /> : null}
        {ticks.map((tv, i) => (<g key={i}><line x1={PL} x2={W - PR} y1={y(tv)} y2={y(tv)} stroke="#e5dfd0" /><text x={PL - 6} y={y(tv) + 4} textAnchor="end" fontSize="11" fill="#5c6660">{tv.toFixed(1)}</text></g>))}
        {hours.map((h) => { const idx = Math.round(((24 - h) / 24) * (values.length - 1)); return (<text key={h} x={x(idx)} y={H - 6} textAnchor="middle" fontSize="11" fill="#5c6660">{h === 0 ? "now" : `-${h}h`}</text>); })}
        <path d={d} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" />
        {cursor !== null && cursor >= 0 && cursor < values.length ? (<g data-testid="chart-cursor"><line x1={x(cursor)} x2={x(cursor)} y1={PT} y2={H - PB} stroke="#2f4f46" strokeDasharray="4 3" /><circle cx={x(cursor)} cy={y(values[cursor])} r="4.5" fill="#2f4f46" /></g>) : null}
      </svg>
      <span className="sr-only">{minAgo.length}</span>
    </figure>
  );
}
