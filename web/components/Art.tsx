import type { AlertType, Status } from "@/lib/types";

export const STATUS_HEX: Record<Status, string> = { normal: "#3BA55D", warning: "#F2A541", critical: "#D64545" };

/** A 40 ft shipping container seen from the side. Reefers get a cooling unit, dry boxes a plain end frame. */
export function ContainerIcon({ status, reefer, size = 36, led = false }: { status: Status; reefer: boolean; size?: number; led?: boolean }) {
  const body = reefer ? "#e3edf6" : "#35639b";
  const rib = reefer ? "#b3cbe0" : "#274c79";
  return (
    <svg className="cicon" viewBox="0 0 48 28" width={size} height={Math.round(size * 0.58)} aria-hidden="true" focusable="false">
      <rect x="1" y="3" width="46" height="21" rx="2" fill={body} stroke="#1b2f45" strokeWidth="1.2" />
      {[14, 19, 24, 29, 34, 39].map((x) => <line key={x} x1={x} y1="5" x2={x} y2="22" stroke={rib} strokeWidth="1.5" />)}
      <rect x="1" y="3" width="9" height="21" rx="2" fill={reefer ? "#ffffff" : "#27507f"} stroke="#1b2f45" strokeWidth="1.2" />
      {reefer ? <g fill="none" stroke="#3b6fa5" strokeWidth="1.1"><circle cx="5.5" cy="10" r="2.6" /><path d="M5.5 7.4v5.2M2.9 10h5.2" /><path d="M3.5 17h4M3.5 19.5h4" /></g> : <path d="M3.5 8h4M3.5 12h4M3.5 16h4" stroke="#6f95c3" strokeWidth="1" />}
      <rect x="43" y="3" width="4" height="21" fill="#1b2f45" opacity=".35" />
      <path d="M1 24h46" stroke="#1b2f45" strokeWidth="2" />
      {[[2, 4], [45, 4], [2, 23], [45, 23]].map(([x, y], i) => <rect key={i} x={x - 1.5} y={y - 1.5} width="3" height="3" fill="#0f1c2b" />)}
      {led ? <circle cx="40" cy="8" r="3" fill={STATUS_HEX[status]} stroke="#fff" strokeWidth="1.2" /> : null}
    </svg>
  );
}

function TruckShape({ trailer, cab, reefer }: { trailer: string; cab: string; reefer?: boolean }) {
  return (
    <g>
      <rect x="0" y="0" width="72" height="30" rx="3" fill={trailer} stroke="#10243a" strokeWidth="1.5" />
      {[10, 20, 30, 40, 50, 60].map((x) => <line key={x} x1={x} y1="3" x2={x} y2="27" stroke="#000" strokeOpacity=".12" strokeWidth="2" />)}
      {reefer ? <g fill="none" stroke="#3b6fa5" strokeWidth="1.6"><circle cx="9" cy="12" r="4.2" /><path d="M9 7.8v8.4M4.8 12h8.4" /></g> : null}
      <rect x="0" y="30" width="108" height="4" fill="#10243a" />
      <path d="M74 8h20l13 12v10H74z" fill={cab} stroke="#10243a" strokeWidth="1.5" />
      <path d="M79 12h12l8 8H79z" fill="#cfe9f7" />
      <rect x="103" y="24" width="4" height="3" fill="#ffe08a" />
      {[14, 27, 88, 99].map((x) => (<g key={x}><circle cx={x} cy="35" r="6" fill="#0d1620" /><circle cx={x} cy="35" r="2.4" fill="#9fb0bf" /></g>))}
    </g>
  );
}

/** Small truck for icons and stat tiles. */
export function TruckIcon({ size = 40, trailer = "#e3edf6", cab = "#0e8f86", reefer = false }: { size?: number; trailer?: string; cab?: string; reefer?: boolean }) {
  return (
    <svg viewBox="-2 -2 112 46" width={size} height={Math.round((size * 46) / 112)} aria-hidden="true" focusable="false">
      <TruckShape trailer={trailer} cab={cab} reefer={reefer} />
    </svg>
  );
}

/** Road strip for the landing hero: skyline, dunes, a lit road and trucks driving both ways. */
export function RoadScene() {
  return (
    <svg className="road-scene" viewBox="0 0 1200 130" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false" data-testid="hero-art">
      <path d="M0 96 C 160 70 300 100 460 84 S 760 70 900 90 S 1120 76 1200 88 V130 H0Z" fill="rgba(94,234,212,.10)" />
      <g fill="rgba(255,255,255,.10)">
        <rect x="70" y="52" width="26" height="46" /><rect x="102" y="40" width="22" height="58" /><rect x="130" y="62" width="30" height="36" />
        <rect x="430" y="48" width="24" height="50" /><rect x="460" y="30" width="18" height="68" /><path d="M469 12l3 18h-6z" /><rect x="484" y="58" width="30" height="40" />
        <rect x="760" y="56" width="22" height="42" /><rect x="788" y="44" width="26" height="54" /><rect x="820" y="64" width="22" height="34" />
        <path d="M1010 98V66a22 22 0 0 1 44 0v32z" /><rect x="1062" y="40" width="7" height="58" /><path d="M1065.500 30l5 10h-10z" />
      </g>
      <rect x="0" y="96" width="1200" height="34" fill="#0a1b33" />
      <line className="lane" x1="0" y1="114" x2="1200" y2="114" stroke="#f2c14e" strokeWidth="2.500" strokeDasharray="22 18" />
      <g className="drive d1"><g transform="translate(0 66)"><TruckShape trailer="#e3edf6" cab="#0e8f86" reefer /></g></g>
      <g className="drive d2"><g transform="translate(108 66) scale(-1 1)"><TruckShape trailer="#35639b" cab="#d64545" /></g></g>
      <g className="drive d3"><g transform="translate(0 66)"><TruckShape trailer="#e3edf6" cab="#f2a541" reefer /></g></g>
    </svg>
  );
}

/** Vertical thermometer with the cargo's safe band, the reading and the set point. */
export function Thermo({ value, lo, hi, set, label }: { value: number; lo: number; hi: number; set: number | null; label: string }) {
  const min = lo - 12, max = hi + 12;
  const y = (v: number) => 8 + (1 - (Math.max(min, Math.min(max, v)) - min) / (max - min)) * 84;
  const ok = value >= lo && value <= hi;
  const color = ok ? "#2b7a46" : "#c23a3a";
  return (
    <svg className="thermo" viewBox="0 0 96 122" width="84" height="106" role="img" aria-label={label} data-testid="thermo">
      <rect x="22" y="6" width="16" height="90" rx="8" fill="#eef3f8" stroke="#8aa0b4" strokeWidth="1.4" />
      <rect x="22" y={y(hi)} width="16" height={Math.max(2, y(lo) - y(hi))} fill="#3ba55d" opacity=".28" />
      <rect x="26" y={y(value)} width="8" height={Math.max(4, 98 - y(value))} fill={color} />
      <circle cx="30" cy="104" r="11" fill={color} stroke="#fff" strokeWidth="2" />
      <g stroke="#33475b" strokeWidth="1.2"><line x1="38" y1={y(hi)} x2="44" y2={y(hi)} /><line x1="38" y1={y(lo)} x2="44" y2={y(lo)} /></g>
      <g fontSize="10" fill="#33475b"><text x="47" y={y(hi) + 3}>{hi}°</text><text x="47" y={y(lo) + 3}>{lo}°</text></g>
      {set !== null ? <path d={`M16 ${y(set)} l-7 -4 v8z`} fill="#0b2545" /> : null}
    </svg>
  );
}

export function HealthRing({ value, size = 76 }: { value: number; size?: number }) {
  const r = 34, c = 2 * Math.PI * r;
  const color = value >= 80 ? "#2b7a46" : value >= 55 ? "#a85f00" : "#b03030";
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e3e9ef" strokeWidth="11" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${(c * value) / 100} ${c}`} transform="rotate(-90 50 50)" />
      <text x="50" y="58" textAnchor="middle" fontSize="26" fontWeight="700" fill={color}>{Math.round(value)}</text>
    </svg>
  );
}

/** Half-circle speedometer, 0 to 120 km/h. */
export function SpeedDial({ kmh }: { kmh: number }) {
  const a = Math.PI * (1 - Math.min(120, Math.max(0, kmh)) / 120);
  const nx = 50 + 30 * Math.cos(a), ny = 50 - 30 * Math.sin(a);
  return (
    <svg viewBox="0 0 100 62" width="76" height="47" aria-hidden="true" focusable="false">
      <path d="M10 50A40 40 0 0 1 90 50" fill="none" stroke="#e3e9ef" strokeWidth="9" strokeLinecap="round" />
      <path d="M10 50A40 40 0 0 1 50 10" fill="none" stroke="#3ba55d" strokeWidth="9" strokeLinecap="round" opacity=".55" />
      <line x1="50" y1="50" x2={nx} y2={ny} stroke="#0b2545" strokeWidth="3.500" strokeLinecap="round" />
      <circle cx="50" cy="50" r="5" fill="#0b2545" />
    </svg>
  );
}

export function SignalBars({ n }: { n: number }) {
  return (
    <svg viewBox="0 0 30 22" width="30" height="22" aria-hidden="true" focusable="false">
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={i * 6} y={20 - (i + 1) * 4} width="4" height={(i + 1) * 4} rx="1" fill={i < n ? "#0e6b6a" : "#cfd8e0"} />)}
    </svg>
  );
}

export function BatteryIcon({ pct }: { pct: number }) {
  const low = pct < 30;
  return (
    <svg viewBox="0 0 36 18" width="36" height="18" aria-hidden="true" focusable="false">
      <rect x="1" y="2" width="30" height="14" rx="3" fill="none" stroke="#33475b" strokeWidth="1.6" />
      <rect x="31.500" y="6" width="3" height="6" rx="1" fill="#33475b" />
      <rect x="3.500" y="4.500" width={Math.max(1, (25 * pct) / 100)} height="9" rx="1.500" fill={low ? "#c23a3a" : "#2b7a46"} />
    </svg>
  );
}

/** Rear doors of the container, shut or ajar. */
export function DoorIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 34 30" width="34" height="30" aria-hidden="true" focusable="false">
      <rect x="3" y="2" width="28" height="26" rx="2" fill={open ? "#1b2f45" : "#d9e4ee"} stroke="#1b2f45" strokeWidth="1.4" />
      {open ? <g fill="#f2a541" stroke="#1b2f45" strokeWidth="1.2"><path d="M3 2l8 3v20l-8 3z" /><path d="M31 2l-8 3v20l8 3z" /></g> : <g fill="none" stroke="#1b2f45" strokeWidth="1.2"><line x1="17" y1="2" x2="17" y2="28" /><path d="M13 12v6M21 12v6" /></g>}
    </svg>
  );
}

const GLYPH: Record<AlertType, string> = {
  temperature_critical: "M10 4a2 2 0 0 1 4 0v9.200a4 4 0 1 1-4 0z M12 9v6",
  reefer_setpoint: "M12 3v18M4.200 7.500l15.600 9M4.200 16.500l15.600-9M9.500 4.500L12 6.500l2.500-2M9.500 19.500L12 17.500l2.500 2",
  door_in_motion: "M6 3h12v18H6z M14 12h.01 M3 9l-2 3 2 3",
  unscheduled_stop: "M8 3h8l5 5v8l-5 5H8l-5-5V8z M8 12h8",
  route_deviation: "M5 20v-7a4 4 0 0 1 4-4h9 M14 5l4 4-4 4",
  health_forecast: "M12 20s-7-4.400-7-10a4 4 0 0 1 7-2.500A4 4 0 0 1 19 10c0 5.600-7 10-7 10z M8 11h2l1.500-2.500 2 4 1.500-1.500h1",
  gas_high: "M9 3h6 M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3 M8.500 15h7",
};

export function AlertGlyph({ type, size = 26 }: { type: AlertType; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={GLYPH[type]} />
    </svg>
  );
}

export function BellIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z M10 21h4" />
    </svg>
  );
}
