import { OSRM_BASE, osrmUrl, parseOsrm, type Road } from "@/lib/roads";
import type { LonLat } from "@/lib/geo";

const memory = new Map<string, Promise<Road[]>>();
const TIMEOUT_MS = 8000;

function readStore(key: string): Road[] | null {
  try { const raw = window.sessionStorage.getItem(`scm-road:${key}`); return raw ? (JSON.parse(raw) as Road[]) : null; } catch { return null; }
}
function writeStore(key: string, roads: Road[]) {
  try { window.sessionStorage.setItem(`scm-road:${key}`, JSON.stringify(roads)); } catch { /* storage full or blocked: the memory cache still works */ }
}

/**
 * Road routes between stops from the OSRM routing service, kept for the session.
 * When the service cannot be reached or finds no road, the fallback line is returned, flagged as an estimate.
 */
export function fetchRoads(points: LonLat[], fallback: () => Road, opts: { alternatives?: boolean; full?: boolean } = {}): Promise<Road[]> {
  const url = osrmUrl(points, !!opts.alternatives, !!opts.full);
  const key = url.replace(OSRM_BASE, "");
  const hit = memory.get(key);
  if (hit) return hit;
  const stored = typeof window !== "undefined" ? readStore(key) : null;
  if (stored && stored.length) { const p = Promise.resolve(stored); memory.set(key, p); return p; }
  const p = (async () => {
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (!res.ok) throw new Error(`routing ${res.status}`);
      const roads = parseOsrm(await res.json());
      if (roads.length === 0) throw new Error("no route");
      writeStore(key, roads);
      return roads;
    } catch {
      memory.delete(key);
      return [fallback()];
    } finally { window.clearTimeout(timer); }
  })();
  memory.set(key, p);
  return p;
}
