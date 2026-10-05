import type { Alert, Container } from "./types";
import { journeyStatus, type Journey } from "./journey";
import { PROFILES } from "./profiles";
import {
  EVENT_POINTS, EVENT_TYPES, EVENT_WINDOW_DAYS, daysUntil, licenceState, type Driver, type DriverEvent, type EventType, type LicenceState,
  type Partner, type Registry, type PartnerStatus, type DriverStatus,
} from "./partners";

/**
 * Scorecards for freight partners and their drivers.
 *
 * Driver safety score, 0 to 100: start at 100, take off points for each logged event in the last 30 days
 * (speeding 5, harsh braking 3, rest breach 8, late check-in 2, unsafe stop 6), 6 for each open critical alert
 * and 2 for each open warning on the containers the driver carries, 25 for an expired licence and 5 for a licence
 * that expires within 30 days. The result is clamped to 0..100. Below 60 is high risk, 60 to 79 is watch, 80 and up is good.
 *
 * Partner score, 0 to 100: 30% on-time journeys, 25% cold chain compliance (reefers inside the band, left out when the
 * partner carries no reefers), 25% alert rate (100 minus 4 points per open alert per 100 containers) and 20%
 * the average safety score of its drivers. Grades: A 85 and up, B 70 to 84, C 55 to 69, D below 55.
 */

export type RiskBand = "high" | "watch" | "good";
export type Grade = "A" | "B" | "C" | "D";

export const riskBand = (score: number): RiskBand => (score < 60 ? "high" : score < 80 ? "watch" : "good");
export const gradeOf = (score: number): Grade => (score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : "D");

export interface DriverRow {
  id: string;
  name: string;
  partnerId: string;
  status: DriverStatus;
  containers: number;
  events30: number;
  eventPoints: number;
  openCritical: number;
  openWarning: number;
  licenceDays: number;
  licenceState: LicenceState;
  score: number;
  band: RiskBand;
}

export interface PartnerRow {
  id: string;
  name: string;
  status: PartnerStatus;
  drivers: number;
  containers: number;
  active: number;
  delayed: number;
  otp: number;
  reefers: number;
  inBand: number;
  cold: number | null;
  openAlerts: number;
  alertsPer100: number;
  health: number;
  events30: number;
  safety: number;
  expiredLicences: number;
  score: number;
  grade: Grade;
}

export interface People {
  partners: PartnerRow[];
  drivers: DriverRow[];
  /** Container weighted mean of the partner scores in scope. */
  carrierScore: number;
  /** Mean safety score of the drivers in scope. */
  driverScore: number;
  bands: Record<RiskBand, number>;
  licence: Record<LicenceState, number>;
  events: { type: EventType; n: number }[];
  /** Containers whose driver has an expired licence. */
  onExpiredLicence: number;
}

const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((100 * a) / b));
const mean = (xs: number[]) => (xs.length === 0 ? 0 : Math.round(xs.reduce((s, x) => s + x, 0) / xs.length));
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function inBand(c: Container): boolean {
  const p = PROFILES.find((q) => q.id === c.profileId);
  return !!p && c.tempC >= p.tMin && c.tempC <= p.tMax;
}

export function recentEvents(events: DriverEvent[], today?: string): DriverEvent[] {
  return events.filter((e) => { const d = daysUntil(e.at, today); return d <= 0 && d > -EVENT_WINDOW_DAYS; });
}

export function driverScore(d: Driver, events30: DriverEvent[], openCritical: number, openWarning: number): number {
  const pts = events30.reduce((s, e) => s + EVENT_POINTS[e.type], 0);
  const lic = licenceState(d.licenceExpiry);
  return clamp(100 - pts - openCritical * 6 - openWarning * 2 - (lic === "expired" ? 25 : lic === "d30" ? 5 : 0));
}

export function partnerScore(p: { otp: number; cold: number | null; alertsPer100: number; safety: number }): number {
  const alertScore = Math.max(0, 100 - 4 * p.alertsPer100);
  if (p.cold === null) return clamp((0.3 * p.otp + 0.25 * alertScore + 0.2 * p.safety) / 0.75);
  return clamp(0.3 * p.otp + 0.25 * p.cold + 0.25 * alertScore + 0.2 * p.safety);
}

/** The driver id a container is run by, with operator reassignments applied. */
export function driverIdFor(reg: Registry, c: Pick<Container, "id" | "driverId">): string {
  return reg.assignments[c.id] ?? c.driverId;
}

/** Scorecards for every partner and driver that has at least one container in scope. */
export function buildPeople(reg: Registry, scope: Container[], alerts: Alert[], journeys: Journey[]): People {
  const driverById = new Map(reg.drivers.map((d) => [d.id, d]));
  const partnerById = new Map(reg.partners.map((p) => [p.id, p]));
  const jByContainer = new Map(journeys.map((j) => [j.containerId, j]));
  const openByContainer = new Map<string, Alert[]>();
  for (const a of alerts) if (a.state === "open") openByContainer.set(a.containerId, [...(openByContainer.get(a.containerId) ?? []), a]);
  const events = recentEvents(reg.events);
  const eventsByDriver = new Map<string, DriverEvent[]>();
  for (const e of events) eventsByDriver.set(e.driverId, [...(eventsByDriver.get(e.driverId) ?? []), e]);

  const byDriver = new Map<string, Container[]>();
  for (const c of scope) { const id = driverIdFor(reg, c); byDriver.set(id, [...(byDriver.get(id) ?? []), c]); }

  const drivers: DriverRow[] = [];
  for (const [id, cs] of byDriver) {
    const d = driverById.get(id);
    if (!d) continue;
    const open = cs.flatMap((c) => openByContainer.get(c.id) ?? []);
    const crit = open.filter((a) => a.severity === "critical").length, warn = open.length - crit;
    const ev = eventsByDriver.get(id) ?? [];
    const score = driverScore(d, ev, crit, warn);
    drivers.push({
      id, name: d.name, partnerId: d.partnerId, status: d.status, containers: cs.length, events30: ev.length, eventPoints: ev.reduce((s, e) => s + EVENT_POINTS[e.type], 0),
      openCritical: crit, openWarning: warn, licenceDays: daysUntil(d.licenceExpiry), licenceState: licenceState(d.licenceExpiry), score, band: riskBand(score),
    });
  }
  drivers.sort((a, b) => a.score - b.score || (a.id < b.id ? -1 : 1));

  const partners: PartnerRow[] = [];
  const byPartner = new Map<string, Container[]>();
  for (const c of scope) { const d = driverById.get(driverIdFor(reg, c)); const pid = d?.partnerId ?? c.partnerId; byPartner.set(pid, [...(byPartner.get(pid) ?? []), c]); }
  for (const [id, cs] of byPartner) {
    const p = partnerById.get(id);
    if (!p) continue;
    const js = cs.map((c) => jByContainer.get(c.id)).filter((j): j is Journey => !!j);
    const act = js.filter((j) => { const s = journeyStatus(j); return s === "in_transit" || s === "delayed"; });
    const dl = act.filter((j) => journeyStatus(j) === "delayed").length;
    const reefers = cs.filter((c) => c.reefer);
    const ok = reefers.filter(inBand).length;
    const openAlerts = cs.reduce((s, c) => s + (openByContainer.get(c.id)?.length ?? 0), 0);
    const mine = drivers.filter((d) => d.partnerId === id);
    const safety = mine.length ? Math.round(mine.reduce((s, d) => s + d.score * d.containers, 0) / mine.reduce((s, d) => s + d.containers, 0)) : 100;
    const row = {
      otp: act.length === 0 ? 100 : pct(act.length - dl, act.length), cold: reefers.length ? pct(ok, reefers.length) : null,
      alertsPer100: Math.round((100 * openAlerts) / cs.length * 10) / 10, safety,
    };
    const score = partnerScore(row);
    partners.push({
      id, name: p.name, status: p.status, drivers: mine.length, containers: cs.length, active: act.length, delayed: dl, otp: row.otp, reefers: reefers.length, inBand: ok, cold: row.cold,
      openAlerts, alertsPer100: row.alertsPer100, health: mean(cs.map((c) => c.healthScore)), events30: mine.reduce((s, d) => s + d.events30, 0), safety,
      expiredLicences: mine.filter((d) => d.licenceState === "expired").length, score, grade: gradeOf(score),
    });
  }
  partners.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));

  const totalC = partners.reduce((s, p) => s + p.containers, 0);
  const totalDc = drivers.reduce((s, d) => s + d.containers, 0);
  const bands: Record<RiskBand, number> = { high: 0, watch: 0, good: 0 };
  const licence: Record<LicenceState, number> = { expired: 0, d30: 0, d90: 0, ok: 0 };
  for (const d of drivers) { bands[d.band]++; licence[d.licenceState]++; }
  const scoped = new Set(drivers.map((d) => d.id));
  return {
    partners, drivers,
    carrierScore: totalC ? Math.round(partners.reduce((s, p) => s + p.score * p.containers, 0) / totalC) : 0,
    driverScore: totalDc ? Math.round(drivers.reduce((s, d) => s + d.score * d.containers, 0) / totalDc) : 0,
    bands, licence,
    events: EVENT_TYPES.map((t) => ({ type: t, n: events.filter((e) => e.type === t && scoped.has(e.driverId)).length })),
    onExpiredLicence: drivers.filter((d) => d.licenceState === "expired").reduce((s, d) => s + d.containers, 0),
  };
}

/** A partner row for the registry tables when the partner has no containers in scope. */
export function idleRow(p: Partner): PartnerRow {
  return { id: p.id, name: p.name, status: p.status, drivers: 0, containers: 0, active: 0, delayed: 0, otp: 100, reefers: 0, inBand: 0, cold: null, openAlerts: 0, alertsPer100: 0, health: 0, events30: 0, safety: 100, expiredLicences: 0, score: 0, grade: "D" };
}

