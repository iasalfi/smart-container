import type { Container, Status } from "./types";

export interface FleetFilter {
  q: string;
  status: Status | "all";
  profile: string | "all";
  reeferOnly: boolean;
  customer?: string;
}

export const EMPTY_FILTER: FleetFilter = { q: "", status: "all", profile: "all", reeferOnly: false };

export function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function matchesQuery(c: Container, q: string): boolean {
  const n = normalise(q);
  if (n === "") return true;
  return [c.id, c.tripId, c.plate, c.driver, c.customer].some((f) => f.toLowerCase().includes(n));
}

export function filterFleet(list: Container[], f: FleetFilter): Container[] {
  return list.filter(
    (c) =>
      (f.status === "all" || c.status === f.status) &&
      (f.profile === "all" || c.profileId === f.profile) &&
      (!f.reeferOnly || c.reefer) &&
      (!f.customer || c.customer === f.customer) &&
      matchesQuery(c, f.q),
  );
}

export function countByStatus(list: Container[]): Record<Status | "total" | "offline", number> {
  const r = { total: list.length, normal: 0, warning: 0, critical: 0, offline: 0 };
  for (const c of list) { r[c.status]++; if (!c.online) r.offline++; }
  return r;
}
