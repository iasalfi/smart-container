export type Status = "normal" | "warning" | "critical";
export type Severity = "critical" | "warning";
export type DoorState = "closed" | "open";
export type LockState = "locked" | "unlocked" | "cut" | "none";
export type AlertState = "open" | "acknowledged" | "in_progress" | "resolved" | "closed";
export type Persona = "operator" | "quality" | "security" | "customer";
export type Lang = "en" | "ar";

export interface CargoProfile {
  id: string;
  name: { en: string; ar: string };
  tMin: number;
  tMax: number;
  rhMin: number;
  rhMax: number;
  reefer: boolean;
  /** Shelf life at ideal conditions, in hours. */
  shelfLifeH: number;
  gasRelevant: boolean;
}

export interface Container {
  id: string;
  profileId: string;
  reefer: boolean;
  plate: string;
  driver: string;
  customer: string;
  tripId: string;
  routeId: string;
  origin: string;
  destination: string;
  status: Status;
  online: boolean;
  /** Progress along the planned corridor, 0 to 1. */
  progress: number;
  lat: number;
  lon: number;
  speedKmh: number;
  headingDeg: number;
  tempC: number;
  rh: number;
  setpointC: number | null;
  door: DoorState;
  lock: LockState;
  padlock: boolean;
  gas: { nh3: number; h2s: number } | null;
  batteryPct: number;
  signal: number;
  healthScore: number;
  /** Scenario flag used by the generator and the tests. */
  scenario: "none" | "temp" | "reefer" | "door" | "stop" | "deviation" | "forecast" | "gas";
  lastSeenMin: number;
}

export interface Alert {
  id: string;
  containerId: string;
  type: AlertType;
  severity: Severity;
  minutesAgo: number;
  state: AlertState;
  params: Record<string, number | string>;
}

export type AlertType =
  | "temperature_critical"
  | "reefer_setpoint"
  | "door_in_motion"
  | "unscheduled_stop"
  | "route_deviation"
  | "health_forecast"
  | "gas_high";

export interface Sample {
  /** Minutes before now, 0 is now. */
  minAgo: number;
  tempC: number;
  rh: number;
  speedKmh: number;
  door: DoorState;
  lat: number;
  lon: number;
  nh3: number | null;
  h2s: number | null;
}
