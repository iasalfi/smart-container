import { CITIES } from "./cities";
import { mulberry32 } from "./rng";

/**
 * Freight company partners (truck providers) and their drivers.
 * The registry is seeded and deterministic. Admins and operators add and change entries in the web app,
 * so every rule that guards that input lives here, next to the data.
 */

export type PartnerStatus = "active" | "probation" | "suspended";
export type DriverStatus = "active" | "on_leave" | "suspended";
export type LicenceClass = "heavy" | "heavy_adr";
export type EventType = "speeding" | "harsh_braking" | "rest_breach" | "late_checkin" | "unsafe_stop";

export const PARTNER_STATUSES: PartnerStatus[] = ["active", "probation", "suspended"];
export const DRIVER_STATUSES: DriverStatus[] = ["active", "on_leave", "suspended"];
export const LICENCE_CLASSES: LicenceClass[] = ["heavy", "heavy_adr"];
export const EVENT_TYPES: EventType[] = ["speeding", "harsh_braking", "rest_breach", "late_checkin", "unsafe_stop"];
/** Points taken off a driver's safety score for each event in the last 30 days. */
export const EVENT_POINTS: Record<EventType, number> = { speeding: 5, harsh_braking: 3, rest_breach: 8, late_checkin: 2, unsafe_stop: 6 };
export const EVENT_WINDOW_DAYS = 30;

export interface Partner {
  id: string;
  name: string;
  /** City id of the head depot. */
  city: string;
  contact: string;
  phone: string;
  trucks: number;
  reeferTrucks: number;
  /** Calendar dates, "YYYY-MM-DD". */
  contractEnd: string;
  insuranceEnd: string;
  status: PartnerStatus;
  source: "seed" | "user";
}

export interface Driver {
  id: string;
  name: string;
  partnerId: string;
  phone: string;
  licenceNo: string;
  licenceClass: LicenceClass;
  licenceExpiry: string;
  years: number;
  /** Trained to run a reefer unit, required to carry temperature controlled cargo. */
  coldChain: boolean;
  status: DriverStatus;
  source: "seed" | "user";
}

export interface DriverEvent {
  id: string;
  driverId: string;
  type: EventType;
  /** Calendar date, "YYYY-MM-DD". */
  at: string;
  note: string;
  containerId?: string;
  source: "seed" | "operator";
}

export interface Registry {
  partners: Partner[];
  drivers: Driver[];
  events: DriverEvent[];
  /** Operator changes: container id to driver id. Containers not listed keep the seeded driver. */
  assignments: Record<string, string>;
}

/** The registry's "today": the demo clock date, 5 Oct 2026. */
export const TODAY = "2026-10-05";
const DAY_MS = 86400000;

export const PHONE_RE = /^05\d{8}$/;
export const LICENCE_RE = /^\d{10}$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDate(s: string): number | null {
  if (!DATE_RE.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const x = new Date(ms);
  return x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === d ? ms : null;
}

/** Whole days from today until a date. Negative once the date has passed. */
export function daysUntil(date: string, today: string = TODAY): number {
  const a = parseDate(date), b = parseDate(today);
  return a === null || b === null ? 0 : Math.round((a - b) / DAY_MS);
}

export function addDays(date: string, n: number): string {
  const ms = (parseDate(date) ?? 0) + n * DAY_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

export type LicenceState = "expired" | "d30" | "d90" | "ok";
export function licenceState(expiry: string, today: string = TODAY): LicenceState {
  const d = daysUntil(expiry, today);
  return d < 0 ? "expired" : d <= 30 ? "d30" : d <= 90 ? "d90" : "ok";
}

/* ------------------------------ seed data ------------------------------ */

const PARTNER_SEED: { name: string; city: string; reliability: number; status: PartnerStatus }[] = [
  { name: "Najd Haulage Co", city: "riyadh", reliability: 0.95, status: "active" },
  { name: "Hail Cold Chain Carriers", city: "buraydah", reliability: 0.5, status: "probation" },
  { name: "Dammam Freight Partners", city: "dammam", reliability: 0.85, status: "active" },
  { name: "Jeddah Reefer Lines", city: "jeddah", reliability: 0.62, status: "active" },
  { name: "Red Coast Transport", city: "jizan", reliability: 0.9, status: "active" },
  { name: "Tabuk Road Carriers", city: "tabuk", reliability: 0.42, status: "probation" },
  { name: "Qassim Fleet Services", city: "buraydah", reliability: 0.8, status: "active" },
  { name: "Madinah Cargo Movers", city: "madinah", reliability: 0.75, status: "active" },
];
export const DRIVERS_PER_PARTNER = 40;

const FIRST = ["Ahmed", "Khalid", "Fahad", "Saud", "Omar", "Yousef", "Nasser", "Majed", "Salman", "Faisal", "Turki", "Abdullah", "Mansour", "Rashid", "Bandar", "Sultan", "Hamad", "Talal", "Waleed", "Ibrahim", "Mishal", "Badr", "Saleh", "Mohammed"];
const FAMILY = ["Al-Harbi", "Al-Otaibi", "Al-Qahtani", "Al-Dosari", "Al-Ghamdi", "Al-Zahrani", "Al-Shehri", "Al-Mutairi", "Al-Anazi", "Al-Subaie", "Al-Juhani", "Al-Malki", "Al-Shammari", "Al-Rashidi", "Al-Yami", "Al-Balawi", "Al-Enezi", "Al-Harthi", "Al-Asmari", "Al-Bishi", "Al-Thaqafi", "Al-Sulami", "Al-Khaldi", "Al-Maliki"];

let seeded: Registry | null = null;
const PARTNER_RELIABILITY: number[] = PARTNER_SEED.map((p) => p.reliability);
export const partnerReliability = (index: number): number => PARTNER_RELIABILITY[index] ?? 0.8;

function pad(n: number, w: number): string { return String(n).padStart(w, "0"); }

/** The seeded registry: 8 partners, 320 drivers and a month of logged driver events. Deterministic. */
export function seedRegistry(): Registry {
  if (seeded) return seeded;
  const rnd = mulberry32(7351);
  const partners: Partner[] = PARTNER_SEED.map((p, i) => {
    const trucks = 60 + Math.floor(rnd() * 90);
    return {
      id: `FP-${pad(i + 1, 2)}`, name: p.name, city: p.city, contact: `${FIRST[(i * 5 + 3) % FIRST.length]} ${FAMILY[(i * 7 + 1) % FAMILY.length]}`,
      phone: `05${pad(10000000 + Math.floor(rnd() * 89999999), 8)}`, trucks, reeferTrucks: Math.floor(trucks * (0.35 + rnd() * 0.3)),
      contractEnd: addDays(TODAY, i === 5 ? 21 : 120 + Math.floor(rnd() * 600)), insuranceEnd: addDays(TODAY, i === 1 ? 12 : 60 + Math.floor(rnd() * 300)),
      status: p.status, source: "seed",
    };
  });
  const drivers: Driver[] = [];
  const names = new Set<string>();
  const licences = new Set<string>();
  let n = 0;
  partners.forEach((p, pi) => {
    for (let k = 0; k < DRIVERS_PER_PARTNER; k++) {
      let name = "";
      do { name = `${FIRST[Math.floor(rnd() * FIRST.length)]} ${FAMILY[Math.floor(rnd() * FAMILY.length)]}`; } while (names.has(name));
      names.add(name);
      let lic = "";
      do { lic = `1${pad(Math.floor(rnd() * 999999999), 9)}`; } while (licences.has(lic));
      licences.add(lic);
      const roll = rnd();
      // A few licences are expired or close to it, so the compliance views have something to show.
      const expiry = roll < 0.02 ? addDays(TODAY, -(3 + Math.floor(rnd() * 60))) : roll < 0.06 ? addDays(TODAY, 2 + Math.floor(rnd() * 27)) : roll < 0.14 ? addDays(TODAY, 31 + Math.floor(rnd() * 58)) : addDays(TODAY, 91 + Math.floor(rnd() * 1300));
      const sRoll = rnd();
      drivers.push({
        id: `DR-${pad(1001 + n++, 4)}`, name, partnerId: p.id, phone: `05${pad(10000000 + Math.floor(rnd() * 89999999), 8)}`, licenceNo: lic,
        licenceClass: rnd() < 0.25 ? "heavy_adr" : "heavy", licenceExpiry: expiry, years: 1 + Math.floor(rnd() * 24), coldChain: rnd() < 0.6,
        status: sRoll < 0.03 ? "on_leave" : sRoll < 0.045 ? "suspended" : "active", source: "seed",
      });
      void pi;
    }
  });
  const events: DriverEvent[] = [];
  let ev = 0;
  const weights: [EventType, number][] = [["speeding", 0.34], ["harsh_braking", 0.26], ["late_checkin", 0.2], ["rest_breach", 0.1], ["unsafe_stop", 0.1]];
  drivers.forEach((d) => {
    const rel = PARTNER_RELIABILITY[partners.findIndex((p) => p.id === d.partnerId)] ?? 0.8;
    const count = Math.round(rnd() * rnd() * 11 * (1.75 - rel));
    for (let k = 0; k < count; k++) {
      let x = rnd(), type: EventType = "speeding";
      for (const [t, w] of weights) { if (x < w) { type = t; break; } x -= w; type = t; }
      events.push({ id: `EV-${pad(++ev, 4)}`, driverId: d.id, type, at: addDays(TODAY, -Math.floor(rnd() * EVENT_WINDOW_DAYS)), note: "", source: "seed" });
    }
  });
  seeded = { partners, drivers, events, assignments: {} };
  return seeded;
}

export function emptyRegistry(): Registry { return { partners: [], drivers: [], events: [], assignments: {} }; }

/* ------------------------------ lookups ------------------------------ */

export function driverOf(reg: Registry, containerDriverId: string, containerId: string): Driver | undefined {
  const id = reg.assignments[containerId] ?? containerDriverId;
  return reg.drivers.find((d) => d.id === id);
}

export function nextId(prefix: "FP" | "DR" | "EV", existing: { id: string }[]): string {
  const width = prefix === "FP" ? 2 : 4;
  const base = prefix === "FP" ? 0 : prefix === "DR" ? 1000 : 0;
  const max = existing.reduce((m, x) => Math.max(m, Number(x.id.replace(/\D/g, "")) || 0), base);
  return `${prefix}-${pad(max + 1, width)}`;
}

/* ------------------------------ validation ------------------------------ */

export interface PartnerInput { name: string; city: string; contact: string; phone: string; trucks: number; reeferTrucks: number; contractEnd: string; insuranceEnd: string; status: PartnerStatus }
export type PartnerError = "name_short" | "name_taken" | "city_missing" | "contact_short" | "phone_format" | "trucks_range" | "reefer_range" | "contract_date" | "insurance_date";

export function validatePartner(i: PartnerInput, others: Partner[]): PartnerError[] {
  const errs: PartnerError[] = [];
  const name = i.name.trim();
  if (name.length < 3) errs.push("name_short");
  else if (others.some((p) => p.name.toLowerCase() === name.toLowerCase())) errs.push("name_taken");
  if (!CITIES[i.city]) errs.push("city_missing");
  if (i.contact.trim().length < 3) errs.push("contact_short");
  if (!PHONE_RE.test(i.phone.trim())) errs.push("phone_format");
  if (!Number.isInteger(i.trucks) || i.trucks < 1 || i.trucks > 2000) errs.push("trucks_range");
  if (!Number.isInteger(i.reeferTrucks) || i.reeferTrucks < 0 || i.reeferTrucks > i.trucks) errs.push("reefer_range");
  if (parseDate(i.contractEnd) === null) errs.push("contract_date");
  if (parseDate(i.insuranceEnd) === null) errs.push("insurance_date");
  return errs;
}

export interface DriverInput { name: string; partnerId: string; phone: string; licenceNo: string; licenceClass: LicenceClass; licenceExpiry: string; years: number; coldChain: boolean; status: DriverStatus }
export type DriverError = "name_short" | "partner_missing" | "partner_suspended" | "phone_format" | "licence_format" | "licence_taken" | "licence_class" | "expiry_date" | "years_range";

export function validateDriver(i: DriverInput, partners: Partner[], others: Driver[]): DriverError[] {
  const errs: DriverError[] = [];
  if (i.name.trim().length < 3) errs.push("name_short");
  const p = partners.find((x) => x.id === i.partnerId);
  if (!p) errs.push("partner_missing");
  else if (p.status === "suspended") errs.push("partner_suspended");
  if (!PHONE_RE.test(i.phone.trim())) errs.push("phone_format");
  if (!LICENCE_RE.test(i.licenceNo.trim())) errs.push("licence_format");
  else if (others.some((d) => d.licenceNo === i.licenceNo.trim())) errs.push("licence_taken");
  if (!LICENCE_CLASSES.includes(i.licenceClass)) errs.push("licence_class");
  if (parseDate(i.licenceExpiry) === null) errs.push("expiry_date");
  if (!Number.isInteger(i.years) || i.years < 0 || i.years > 45) errs.push("years_range");
  return errs;
}

export interface EventInput { driverId: string; type: EventType; at: string; note: string }
export type EventError = "driver_missing" | "type_invalid" | "date_invalid" | "date_future" | "date_old" | "note_long";

export function validateEvent(i: EventInput, drivers: Driver[], today: string = TODAY): EventError[] {
  const errs: EventError[] = [];
  if (!drivers.some((d) => d.id === i.driverId)) errs.push("driver_missing");
  if (!EVENT_TYPES.includes(i.type)) errs.push("type_invalid");
  const ms = parseDate(i.at);
  if (ms === null) errs.push("date_invalid");
  else if (daysUntil(i.at, today) > 0) errs.push("date_future");
  else if (daysUntil(i.at, today) < -90) errs.push("date_old");
  if (i.note.length > 200) errs.push("note_long");
  return errs;
}

export type AssignError = "driver_missing" | "driver_status" | "licence_expired" | "partner_suspended" | "cold_chain_missing";

/** Whether a driver may take a container. Reefer cargo needs a cold chain trained driver. */
export function validateAssignment(driver: Driver | undefined, partner: Partner | undefined, reefer: boolean, today: string = TODAY): AssignError[] {
  if (!driver) return ["driver_missing"];
  const errs: AssignError[] = [];
  if (driver.status !== "active") errs.push("driver_status");
  if (daysUntil(driver.licenceExpiry, today) < 0) errs.push("licence_expired");
  if (!partner || partner.status === "suspended") errs.push("partner_suspended");
  if (reefer && !driver.coldChain) errs.push("cold_chain_missing");
  return errs;
}

/** Drivers who may be assigned to cargo of the given kind, seeded assignment pool. */
export function eligibleDrivers(reg: Registry, reefer: boolean): Driver[] {
  return reg.drivers.filter((d) => validateAssignment(d, reg.partners.find((p) => p.id === d.partnerId), reefer).length === 0);
}
