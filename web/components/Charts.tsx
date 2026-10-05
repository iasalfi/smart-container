"use client";
import type { ReactNode } from "react";

export const SERIES = ["#5a66f1", "#7f89f4", "#a2a9f7", "#6fa585", "#dcae5f", "#c9695d", "#8d97ad"];

export interface BarRow { label: string; n: number; sub?: string; color?: string }

/** Horizontal bars. The number is always printed next to the bar, so colour never carries meaning alone. */
export function BarList({ rows, max, testid, suffix = "" }: { rows: BarRow[]; max?: number; testid?: string; suffix?: string }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.n));
  return (
    <ul className="an-bars" data-testid={testid}>
      {rows.map((r) => (
        <li key={r.label} data-testid={testid ? `${testid}-row` : undefined}>
          <span className="an-bl">{r.label}</span>
          <span className="an-bt" aria-hidden="true"><i style={{ width: `${Math.max(2, (100 * r.n) / top)}%`, background: r.color }} /></span>
          <b>{r.n.toLocaleString("en-US")}{suffix}</b>
          {r.sub ? <small className="an-sub">{r.sub}</small> : null}
        </li>
      ))}
    </ul>
  );
}

export interface Slice2 { label: string; n: number; color: string }

export function Donut({ slices, centre, caption, testid }: { slices: Slice2[]; centre: string; caption: string; testid?: string }) {
  const total = slices.reduce((s, x) => s + x.n, 0);
  const R = 42, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div className="an-donut" data-testid={testid}>
      <svg viewBox="0 0 120 120" role="img" aria-label={slices.map((s) => `${s.label}: ${s.n}`).join(", ")}>
        <circle cx="60" cy="60" r={R} fill="none" stroke="#e8edf4" strokeWidth="16" />
        {total > 0 ? slices.filter((s) => s.n > 0).map((s) => {
          const len = (s.n / total) * C;
          const el = <circle key={s.label} cx="60" cy="60" r={R} fill="none" stroke={s.color} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 60 60)" />;
          off += len;
          return el;
        }) : null}
        <text x="60" y="58" textAnchor="middle" fontSize="20" fontWeight="700" fill="#1e2a40">{centre}</text>
        <text x="60" y="74" textAnchor="middle" fontSize="8.5" fill="#3f4d66">{caption}</text>
      </svg>
      <ul className="an-legend">
        {slices.map((s) => (
          <li key={s.label}><i style={{ background: s.color }} aria-hidden="true" /><span>{s.label}</span><b>{s.n.toLocaleString("en-US")}</b></li>
        ))}
      </ul>
    </div>
  );
}

export interface Col2 { label: string; n: number; color?: string }

export function Columns({ cols, testid }: { cols: Col2[]; testid?: string }) {
  const top = Math.max(1, ...cols.map((c) => c.n));
  return (
    <div className="an-cols" data-testid={testid} role="img" aria-label={cols.map((c) => `${c.label}: ${c.n}`).join(", ")}>
      {cols.map((c) => (
        <div key={c.label} className="an-col">
          <span className="an-cn">{c.n.toLocaleString("en-US")}</span>
          <span className="an-cb"><i style={{ height: `${Math.max(2, (100 * c.n) / top)}%`, background: c.color }} /></span>
          <span className="an-cl">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Panel({ title, id, children, wide }: { title: string; id: string; children: ReactNode; wide?: boolean }) {
  return (<section className={`card an-panel${wide ? " wide" : ""}`} data-testid={`an-widget-${id}`}><h2>{title}</h2>{children}</section>);
}
