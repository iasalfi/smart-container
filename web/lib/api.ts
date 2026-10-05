import type { Alert, Container, Sample } from "./types";
import type { Thresholds } from "./alerts";

/** Base URL of the API service. Empty means same origin. Set NEXT_PUBLIC_API_URL when building the web app. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

const cache = new Map<string, Promise<unknown>>();

/** GET JSON from the API. Successful responses are cached for the session; failures are not. */
export function apiGet<T>(path: string): Promise<T> {
  const hit = cache.get(path);
  if (hit) return hit as Promise<T>;
  const p = (async () => {
    let res: Response;
    try { res = await fetch(`${API_URL}${path}`, { headers: { Accept: "application/json" } }); }
    catch { throw new ApiError(0, "network", "Cannot reach the API."); }
    if (!res.ok) {
      let code = "http_" + res.status, message = res.statusText;
      try { const b = await res.json(); code = b.error?.code ?? code; message = b.error?.message ?? message; } catch { /* not JSON */ }
      throw new ApiError(res.status, code, message);
    }
    return (await res.json()) as T;
  })();
  cache.set(path, p);
  p.catch(() => cache.delete(path));
  return p;
}

export interface FleetResponse { total: number; fleetSize: number; containers: Container[] }
export interface ContainerResponse { container: Container }
export interface SeriesResponse { id: string; samples: Sample[] }
export interface AlertsResponse { total: number; alerts: Alert[] }

export const fetchFleet = () => apiGet<FleetResponse>("/api/v1/fleet");
export const fetchContainer = (id: string) => apiGet<ContainerResponse>(`/api/v1/containers/${encodeURIComponent(id)}`);
export const fetchSeries = (id: string) => apiGet<SeriesResponse>(`/api/v1/containers/${encodeURIComponent(id)}/series`);

export function fetchAlerts(th: Thresholds, defaults: Thresholds) {
  const q = new URLSearchParams();
  for (const k of Object.keys(th) as (keyof Thresholds)[]) if (th[k] !== defaults[k]) q.set(k, String(th[k]));
  const s = q.toString();
  return apiGet<AlertsResponse>(`/api/v1/alerts${s ? "?" + s : ""}`);
}
