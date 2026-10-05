import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handle, type ApiResponse } from "../src/handlers";
import { nodeHandler } from "../src/node";

const get = (path: string, query: Record<string, string> = {}, method = "GET"): ApiResponse =>
  handle({ method, path, query: new URLSearchParams(query) });
const body = (r: ApiResponse): any => r.body;

describe("API: data endpoints (regression)", () => {
  it("TC-A-001 health returns ok with the service name and version", () => {
    const r = get("/api/v1/health");
    expect(r.status).toBe(200);
    expect(body(r)).toMatchObject({ status: "ok", service: "smart-container-api", version: "1.0.0", fleetSize: 1000 });
  });
  it("TC-A-002 health is never cached", () => { expect(get("/api/v1/health").headers["Cache-Control"]).toBe("no-store"); });
  it("TC-A-003 OpenAPI document describes every route", () => {
    const doc = body(get("/api/v1/openapi"));
    expect(doc.openapi).toMatch(/^3\./);
    expect(Object.keys(doc.paths).sort()).toEqual(["/api/v1/alerts", "/api/v1/containers/{id}", "/api/v1/containers/{id}/series", "/api/v1/fleet", "/api/v1/health", "/api/v1/profiles"]);
  });
  it("TC-A-004 profiles lists the 7 cargo profiles", () => { expect(body(get("/api/v1/profiles")).profiles).toHaveLength(7); });
  it("TC-A-005 fleet returns 1,000 containers with 912 / 61 / 27 and 12 offline", () => {
    const b = body(get("/api/v1/fleet"));
    expect(b.containers).toHaveLength(1000);
    expect(b.counts).toEqual({ total: 1000, normal: 912, warning: 61, critical: 27, offline: 12 });
  });
  it("TC-A-006 fleet status filter returns only that status", () => {
    const b = body(get("/api/v1/fleet", { status: "critical" }));
    expect(b.total).toBe(27);
    expect(b.containers.every((c: { status: string }) => c.status === "critical")).toBe(true);
  });
  it("TC-A-007 fleet cargo and reefer filters combine", () => {
    const dairy = body(get("/api/v1/fleet", { profile: "dairy" }));
    const both = body(get("/api/v1/fleet", { profile: "dairy", reefer: "true" }));
    expect(dairy.total).toBeGreaterThan(0);
    expect(both.total).toBeLessThanOrEqual(dairy.total);
    expect(both.containers.every((c: { profileId: string; reefer: boolean }) => c.profileId === "dairy" && c.reefer)).toBe(true);
  });
  it("TC-A-008 fleet search by container id finds exactly one", () => {
    const b = body(get("/api/v1/fleet", { q: "SC-1043" }));
    expect(b.total).toBe(1);
    expect(b.containers[0].id).toBe("SC-1043");
  });
  it("TC-A-009 fleet pagination returns the requested window", () => {
    const all = body(get("/api/v1/fleet")).containers;
    const page = body(get("/api/v1/fleet", { limit: "5", offset: "10" }));
    expect(page.total).toBe(1000);
    expect(page.containers.map((c: { id: string }) => c.id)).toEqual(all.slice(10, 15).map((c: { id: string }) => c.id));
  });
  it("TC-A-010 container detail carries the analytics the UI needs", () => {
    const b = body(get("/api/v1/containers/SC-1001"));
    for (const k of ["container", "profile", "route", "health", "forecast", "factors", "stops", "deviationKm", "etaMinutes", "withinBand", "excursions", "alerts"]) expect(b).toHaveProperty(k);
    expect(b.withinBand).toBe(true);
  });
  it("TC-A-011 a temperature scenario container is outside its band with a low score", () => {
    const b = body(get("/api/v1/containers/SC-1060"));
    expect(b.withinBand).toBe(false);
    expect(b.health.score).toBeLessThan(80);
    expect(b.alerts.some((a: { type: string }) => a.type === "temperature_critical")).toBe(true);
  });
  it("TC-A-012 a stop scenario container has exactly one unscheduled stop", () => {
    const stops = body(get("/api/v1/containers/SC-1075")).stops as { scheduled: boolean }[];
    expect(stops.filter((s) => !s.scheduled)).toHaveLength(1);
  });
  it("TC-A-013 a forecast scenario container has a predicted breach", () => {
    const b = body(get("/api/v1/containers/SC-1007"));
    expect(b.forecast.etaH).not.toBeNull();
    expect(b.forecast.etaH).toBeLessThanOrEqual(6);
  });
  it("TC-A-014 series has 289 readings, oldest first, five minutes apart", () => {
    const b = body(get("/api/v1/containers/SC-1060/series"));
    expect(b.count).toBe(289);
    expect(b.intervalMinutes).toBe(5);
    expect(b.samples[0].minAgo).toBe(1440);
    expect(b.samples[288].minAgo).toBe(0);
  });
  it("TC-A-015 alerts returns 102 with critical first", () => {
    const b = body(get("/api/v1/alerts"));
    expect(b.total).toBe(102);
    expect(b.alerts[0].severity).toBe("critical");
    const firstWarning = b.alerts.findIndex((a: { severity: string }) => a.severity === "warning");
    expect(b.alerts.slice(firstWarning).every((a: { severity: string }) => a.severity === "warning")).toBe(true);
  });
  it("TC-A-016 alerts severity filter returns only warnings", () => {
    const b = body(get("/api/v1/alerts", { severity: "warning" }));
    expect(b.total).toBe(61);
    expect(b.alerts.every((a: { severity: string }) => a.severity === "warning")).toBe(true);
  });
  it("TC-A-017 alerts customer filter returns only that customer's containers", () => {
    const customer = "Najd Fresh Foods";
    const ids = new Set((body(get("/api/v1/fleet", { customer })).containers as { id: string }[]).map((c) => c.id));
    const b = body(get("/api/v1/alerts", { customer }));
    expect(b.total).toBeGreaterThan(0);
    expect(b.alerts.every((a: { containerId: string }) => ids.has(a.containerId))).toBe(true);
  });
  it("TC-A-018 alerts threshold override recalculates the list @progression", () => {
    const base = body(get("/api/v1/alerts")).total;
    const raised = body(get("/api/v1/alerts", { deviationKm: "50" }));
    expect(raised.total).toBeLessThan(base);
    expect(raised.thresholds.deviationKm).toBe(50);
    expect(body(get("/api/v1/alerts")).total).toBe(base);
  });
  it("TC-A-019 the same request always returns the same data", () => {
    expect(JSON.stringify(get("/api/v1/containers/SC-1014").body)).toBe(JSON.stringify(get("/api/v1/containers/SC-1014").body));
  });
  it("TC-A-020 CORS is open for GET and answers the preflight", () => {
    expect(get("/api/v1/fleet").headers["Access-Control-Allow-Origin"]).toBe("*");
    const pre = get("/api/v1/fleet", {}, "OPTIONS");
    expect(pre.status).toBe(204);
    expect(pre.headers["Access-Control-Allow-Methods"]).toContain("GET");
  });
  it("TC-A-021 data endpoints are cacheable at the edge", () => {
    for (const p of ["/api/v1/fleet", "/api/v1/alerts", "/api/v1/profiles", "/api/v1/containers/SC-1001"]) expect(get(p).headers["Cache-Control"]).toContain("s-maxage");
  });
});

describe("API: negative cases", () => {
  const isError = (r: ApiResponse, status: number, code: string) => {
    expect(r.status).toBe(status);
    expect(body(r).error.code).toBe(code);
    expect(typeof body(r).error.message).toBe("string");
    expect(r.headers["Cache-Control"]).toBe("no-store");
  };
  it("TC-A-030 unknown container returns 404 with the error shape @negative", () => isError(get("/api/v1/containers/SC-9999"), 404, "container_not_found"));
  it("TC-A-031 unknown container series returns 404 @negative", () => isError(get("/api/v1/containers/SC-9999/series"), 404, "container_not_found"));
  it("TC-A-032 unknown route returns 404 @negative", () => isError(get("/api/v1/nope"), 404, "not_found"));
  it("TC-A-033 invalid status is rejected @negative", () => isError(get("/api/v1/fleet", { status: "bogus" }), 400, "invalid_status"));
  it("TC-A-034 invalid limit and offset are rejected @negative", () => {
    for (const limit of ["0", "-1", "abc", "1001", "1.5"]) isError(get("/api/v1/fleet", { limit }), 400, "invalid_limit");
    isError(get("/api/v1/fleet", { offset: "-3" }), 400, "invalid_offset");
  });
  it("TC-A-035 unknown cargo profile and bad reefer flag are rejected @negative", () => {
    isError(get("/api/v1/fleet", { profile: "gold" }), 400, "invalid_profile");
    isError(get("/api/v1/fleet", { reefer: "maybe" }), 400, "invalid_reefer");
  });
  it("TC-A-036 invalid thresholds are rejected @negative", () => {
    for (const v of ["0", "-5", "abc", "", "NaN", "Infinity"]) isError(get("/api/v1/alerts", { tempCriticalC: v }), 400, "invalid_threshold");
  });
  it("TC-A-037 write methods return 405 with an Allow header @negative", () => {
    for (const m of ["POST", "PUT", "PATCH", "DELETE"]) {
      const r = get("/api/v1/fleet", {}, m);
      isError(r, 405, "method_not_allowed");
      expect(r.headers.Allow).toContain("GET");
    }
  });
  it("TC-A-038 invalid severity is rejected @negative", () => isError(get("/api/v1/alerts", { severity: "urgent" }), 400, "invalid_severity"));
  it("TC-A-039 hostile container ids return 404 or 400, never a server error @negative", () => {
    for (const id of ["..%2F..%2Fetc%2Fpasswd", "%3Cscript%3E", "SC-1001%00", "%E0%A4%A", "a".repeat(5000)]) {
      const r = get(`/api/v1/containers/${id}`);
      expect([400, 404]).toContain(r.status);
    }
  });
  it("TC-A-040 garbage paths never produce a server error @negative", () => {
    for (const p of ["//", "/api/v1/containers/", "/api/v1/containers/SC-1001/series/extra", "/api/v1//fleet", "/%00", "/api/v2/fleet"]) expect(get(p).status).toBeLessThan(500);
  });
});

describe("API: over a real HTTP socket", () => {
  let server: Server;
  let base = "";
  beforeAll(async () => {
    server = createServer(nodeHandler);
    await new Promise<void>((r) => server.listen(0, r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("TC-A-050 serves JSON with the right headers and status codes", async () => {
    const ok = await fetch(`${base}/api/v1/health`);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toContain("application/json");
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    const missing = await fetch(`${base}/api/v1/containers/SC-9999`);
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.code).toBe("container_not_found");
  });
  it("TC-A-051 HEAD returns headers and no body @negative", async () => {
    const r = await fetch(`${base}/api/v1/fleet`, { method: "HEAD" });
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("");
  });
  it("TC-A-052 malformed percent-encoding returns 400 instead of crashing @negative", async () => {
    const r = await fetch(`${base}/api/v1/containers/%E0%A4%A`);
    expect(r.status).toBe(400);
    expect((await fetch(`${base}/api/v1/health`)).status).toBe(200);
  });
});
