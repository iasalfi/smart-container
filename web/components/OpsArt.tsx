import type { ReactNode } from "react";
import type { MilestoneKind } from "@/lib/journey";

const GLYPH: Record<MilestoneKind, ReactNode> = {
  loaded: <><path d="M3 8l9-4 9 4v9l-9 4-9-4z" /><path d="M3 8l9 4 9-4M12 12v9" /></>,
  pretrip_check: <><path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z" /><path d="M12 9v7" /></>,
  port_gate: <><circle cx="12" cy="5" r="2" /><path d="M12 7v13M7 11h10M5 15a7 7 0 0 0 14 0" /></>,
  depart: <><path d="M3 15V8h11v7M14 11h4l3 3v1h-7" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /></>,
  rest: <><path d="M5 10h11v4a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" /><path d="M16 11h2a2 2 0 0 1 0 4h-2M8 4v3M12 4v3" /></>,
  fuel: <><path d="M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15M4 20h11" /><path d="M14 9h2l2 2v6a1.5 1.5 0 0 0 3 0V8l-3-3" /><path d="M7 8h5" /></>,
  overnight: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />,
  waypoint: <><path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.800-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></>,
  customs: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h6M9 16h4" /></>,
  arrive: <><path d="M6 21V4" /><path d="M6 5h11l-2 4 2 4H6" /></>,
  delivered: <><circle cx="12" cy="12" r="9" /><path d="M8 12.500l3 3 5-6" /></>,
};

export function MilestoneIcon({ kind, size = 22 }: { kind: MilestoneKind; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {GLYPH[kind]}
    </svg>
  );
}

export const KIND_COLOR: Record<MilestoneKind, string> = {
  loaded: "#5a66f1", pretrip_check: "#5a66f1", port_gate: "#8d97f5", depart: "#2b3a55", rest: "#dcae5f", fuel: "#c9855a",
  overnight: "#8a7fb0", waypoint: "#8d97f5", customs: "#8794a8", arrive: "#2f6a48", delivered: "#2f6a48",
};
