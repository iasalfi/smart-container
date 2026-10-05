import type { AlertType, Status } from "@/lib/types";

export const STATUS_HEX: Record<Status, string> = { normal: "#6fa585", warning: "#dcae5f", critical: "#c9695d" };

/** A 40 ft shipping container seen from the side. Reefers get a cooling unit, dry boxes a plain end frame. */
export function ContainerIcon({ status, reefer, size = 36, led = false }: { status: Status; reefer: boolean; size?: number; led?: boolean }) {
  const body = reefer ? "#eef1fb" : "#6f7af3";
  const rib = reefer ? "#c9d0fa" : "#5560d9";
  return (
    <svg className="cicon" viewBox="0 0 48 28" width={size} height={Math.round(size * 0.58)} aria-hidden="true" focusable="false">
      <rect x="1" y="3" width="46" height="21" rx="2" fill={body} stroke="#3f4f75" strokeWidth="1.2" />
      {[14, 19, 24, 29, 34, 39].map((x) => <line key={x} x1={x} y1="5" x2={x} y2="22" stroke={rib} strokeWidth="1.5" />)}
      <rect x="1" y="3" width="9" height="21" rx="2" fill={reefer ? "#ffffff" : "#5560d9"} stroke="#3f4f75" strokeWidth="1.2" />
      {reefer ? <g fill="none" stroke="#8d97f5" strokeWidth="1.1"><circle cx="5.5" cy="10" r="2.6" /><path d="M5.5 7.4v5.2M2.9 10h5.2" /><path d="M3.5 17h4M3.5 19.5h4" /></g> : <path d="M3.5 8h4M3.5 12h4M3.5 16h4" stroke="#aeb6f8" strokeWidth="1" />}
      <rect x="43" y="3" width="4" height="21" fill="#3f4f75" opacity=".35" />
      <path d="M1 24h46" stroke="#3f4f75" strokeWidth="2" />
      {[[2, 4], [45, 4], [2, 23], [45, 23]].map(([x, y], i) => <rect key={i} x={x - 1.5} y={y - 1.5} width="3" height="3" fill="#1e2a40" />)}
      {led ? <circle cx="40" cy="8" r="3" fill={STATUS_HEX[status]} stroke="#fff" strokeWidth="1.2" /> : null}
    </svg>
  );
}

function TruckShape({ trailer, cab, reefer }: { trailer: string; cab: string; reefer?: boolean }) {
  return (
    <g>
      <rect x="0" y="0" width="72" height="30" rx="3" fill={trailer} stroke="#2b3a55" strokeWidth="1.5" />
      {[10, 20, 30, 40, 50, 60].map((x) => <line key={x} x1={x} y1="3" x2={x} y2="27" stroke="#000" strokeOpacity=".12" strokeWidth="2" />)}
      {reefer ? <g fill="none" stroke="#8d97f5" strokeWidth="1.6"><circle cx="9" cy="12" r="4.2" /><path d="M9 7.8v8.4M4.8 12h8.4" /></g> : null}
      <rect x="0" y="30" width="108" height="4" fill="#2b3a55" />
      <path d="M74 8h20l13 12v10H74z" fill={cab} stroke="#2b3a55" strokeWidth="1.5" />
      <path d="M79 12h12l8 8H79z" fill="#dfe3fb" />
      <rect x="103" y="24" width="4" height="3" fill="#f0d9a0" />
      {[14, 27, 88, 99].map((x) => (<g key={x}><circle cx={x} cy="35" r="6" fill="#1e2a40" /><circle cx={x} cy="35" r="2.4" fill="#8794a8" /></g>))}
    </g>
  );
}

/** Small truck for icons and stat tiles. */
export function TruckIcon({ size = 40, trailer = "#eef1fb", cab = "#5a66f1", reefer = false }: { size?: number; trailer?: string; cab?: string; reefer?: boolean }) {
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
      <path d="M0 96 C 160 70 300 100 460 84 S 760 70 900 90 S 1120 76 1200 88 V130 H0Z" fill="rgba(79,143,132,.16)" />
      <g fill="rgba(47,79,70,.14)">
        <rect x="70" y="52" width="26" height="46" /><rect x="102" y="40" width="22" height="58" /><rect x="130" y="62" width="30" height="36" />
        <rect x="430" y="48" width="24" height="50" /><rect x="460" y="30" width="18" height="68" /><path d="M469 12l3 18h-6z" /><rect x="484" y="58" width="30" height="40" />
        <rect x="760" y="56" width="22" height="42" /><rect x="788" y="44" width="26" height="54" /><rect x="820" y="64" width="22" height="34" />
        <path d="M1010 98V66a22 22 0 0 1 44 0v32z" /><rect x="1062" y="40" width="7" height="58" /><path d="M1065.500 30l5 10h-10z" />
      </g>
      <rect x="0" y="96" width="1200" height="34" fill="#25314a" />
      <line className="lane" x1="0" y1="114" x2="1200" y2="114" stroke="#e6c27a" strokeWidth="2.500" strokeDasharray="22 18" />
      <g className="drive d1"><g transform="translate(0 66)"><TruckShape trailer="#eef1fb" cab="#5a66f1" reefer /></g></g>
      <g className="drive d2"><g transform="translate(108 66) scale(-1 1)"><TruckShape trailer="#6f7af3" cab="#c9695d" /></g></g>
      <g className="drive d3"><g transform="translate(0 66)"><TruckShape trailer="#eef1fb" cab="#dcae5f" reefer /></g></g>
    </svg>
  );
}

/** Vertical thermometer with the cargo's safe band, the reading and the set point. */
export function Thermo({ value, lo, hi, set, label }: { value: number; lo: number; hi: number; set: number | null; label: string }) {
  const min = lo - 12, max = hi + 12;
  const y = (v: number) => 8 + (1 - (Math.max(min, Math.min(max, v)) - min) / (max - min)) * 84;
  const ok = value >= lo && value <= hi;
  const color = ok ? "#4a8a63" : "#b85a50";
  return (
    <svg className="thermo" viewBox="0 0 96 122" width="84" height="106" role="img" aria-label={label} data-testid="thermo">
      <rect x="22" y="6" width="16" height="90" rx="8" fill="#eef2f7" stroke="#8794a8" strokeWidth="1.4" />
      <rect x="22" y={y(hi)} width="16" height={Math.max(2, y(lo) - y(hi))} fill="#6fa585" opacity=".28" />
      <rect x="26" y={y(value)} width="8" height={Math.max(4, 98 - y(value))} fill={color} />
      <circle cx="30" cy="104" r="11" fill={color} stroke="#fff" strokeWidth="2" />
      <g stroke="#4a5a80" strokeWidth="1.2"><line x1="38" y1={y(hi)} x2="44" y2={y(hi)} /><line x1="38" y1={y(lo)} x2="44" y2={y(lo)} /></g>
      <g fontSize="10" fill="#4a5a80"><text x="47" y={y(hi) + 3}>{hi}°</text><text x="47" y={y(lo) + 3}>{lo}°</text></g>
      {set !== null ? <path d={`M16 ${y(set)} l-7 -4 v8z`} fill="#2b3a55" /> : null}
    </svg>
  );
}

export function HealthRing({ value, size = 76 }: { value: number; size?: number }) {
  const r = 34, c = 2 * Math.PI * r;
  const color = value >= 80 ? "#4a8a63" : value >= 55 ? "#8a5a1c" : "#8a3f37";
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e3e9f0" strokeWidth="11" />
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
      <path d="M10 50A40 40 0 0 1 90 50" fill="none" stroke="#e3e9f0" strokeWidth="9" strokeLinecap="round" />
      <path d="M10 50A40 40 0 0 1 50 10" fill="none" stroke="#6fa585" strokeWidth="9" strokeLinecap="round" opacity=".55" />
      <line x1="50" y1="50" x2={nx} y2={ny} stroke="#2b3a55" strokeWidth="3.500" strokeLinecap="round" />
      <circle cx="50" cy="50" r="5" fill="#2b3a55" />
    </svg>
  );
}

export function SignalBars({ n }: { n: number }) {
  return (
    <svg viewBox="0 0 30 22" width="30" height="22" aria-hidden="true" focusable="false">
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={i * 6} y={20 - (i + 1) * 4} width="4" height={(i + 1) * 4} rx="1" fill={i < n ? "#4a56d9" : "#d6deea"} />)}
    </svg>
  );
}

export function BatteryIcon({ pct }: { pct: number }) {
  const low = pct < 30;
  return (
    <svg viewBox="0 0 36 18" width="36" height="18" aria-hidden="true" focusable="false">
      <rect x="1" y="2" width="30" height="14" rx="3" fill="none" stroke="#4a5a80" strokeWidth="1.6" />
      <rect x="31.500" y="6" width="3" height="6" rx="1" fill="#4a5a80" />
      <rect x="3.500" y="4.500" width={Math.max(1, (25 * pct) / 100)} height="9" rx="1.500" fill={low ? "#b85a50" : "#4a8a63"} />
    </svg>
  );
}

/** Rear doors of the container, shut or ajar. */
export function DoorIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 34 30" width="34" height="30" aria-hidden="true" focusable="false">
      <rect x="3" y="2" width="28" height="26" rx="2" fill={open ? "#3f4f75" : "#e6ebf5"} stroke="#3f4f75" strokeWidth="1.4" />
      {open ? <g fill="#dcae5f" stroke="#3f4f75" strokeWidth="1.2"><path d="M3 2l8 3v20l-8 3z" /><path d="M31 2l-8 3v20l8 3z" /></g> : <g fill="none" stroke="#3f4f75" strokeWidth="1.2"><line x1="17" y1="2" x2="17" y2="28" /><path d="M13 12v6M21 12v6" /></g>}
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
