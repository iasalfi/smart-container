/** OpenAPI 3.0 description of the Smart Container Monitoring API (served at /api/v1/openapi). */
export const VERSION = "1.0.0";

const err = { description: "Error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
const idParam = { name: "id", in: "path", required: true, schema: { type: "string", example: "SC-1060" } };

export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Smart Container Monitoring API",
    version: VERSION,
    description: "Read-only API over a deterministic synthetic fleet of 1,000 containers on KSA roads. No real shipments or customers.",
  },
  servers: [{ url: "/" }],
  paths: {
    "/api/v1/health": { get: { summary: "Liveness and version", responses: { "200": { description: "Service is up" } } } },
    "/api/v1/profiles": { get: { summary: "Cargo profile library", responses: { "200": { description: "Profiles" } } } },
    "/api/v1/fleet": {
      get: {
        summary: "Fleet snapshot with status counts",
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["normal", "warning", "critical"] } },
          { name: "profile", in: "query", schema: { type: "string" } },
          { name: "reefer", in: "query", schema: { type: "boolean" } },
          { name: "q", in: "query", schema: { type: "string" }, description: "Matches id, trip, plate, driver or customer" },
          { name: "customer", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 1000 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0 } },
        ],
        responses: { "200": { description: "Fleet" }, "400": err },
      },
    },
    "/api/v1/containers/{id}": { get: { summary: "One container with analytics (health, forecast, stops, deviation, excursions, alerts)", parameters: [idParam], responses: { "200": { description: "Container" }, "404": err } } },
    "/api/v1/containers/{id}/series": { get: { summary: "24 hours of readings, one every 5 minutes, oldest first", parameters: [idParam], responses: { "200": { description: "Samples" }, "404": err } } },
    "/api/v1/alerts": {
      get: {
        summary: "Alerts from the rule engine. Thresholds can be overridden per request.",
        parameters: [
          { name: "severity", in: "query", schema: { type: "string", enum: ["critical", "warning"] } },
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "customer", in: "query", schema: { type: "string" } },
          ...["tempCriticalC", "tempCriticalMin", "reeferSetpointC", "reeferMin", "doorSpeedKmh", "unscheduledStopMin", "deviationKm", "nh3Ppm", "h2sPpm"].map((n) => ({ name: n, in: "query", schema: { type: "number", exclusiveMinimum: 0 } })),
        ],
        responses: { "200": { description: "Alerts, critical first" }, "400": err },
      },
    },
    "/api/v1/partners": {
      get: {
        summary: "Freight company partners (truck providers) with their scorecard",
        parameters: [{ name: "status", in: "query", schema: { type: "string", enum: ["active", "probation", "suspended"] } }],
        responses: { "200": { description: "Partners, each with an on-time, cold chain, alert rate, safety and overall score" }, "400": err },
      },
    },
    "/api/v1/drivers": {
      get: {
        summary: "Drivers with their safety scorecard",
        parameters: [
          { name: "partner", in: "query", schema: { type: "string", example: "FP-01" } },
          { name: "risk", in: "query", schema: { type: "string", enum: ["high", "watch", "good"] } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0 } },
        ],
        responses: { "200": { description: "Drivers" }, "400": err },
      },
    },
  },
  components: { schemas: { Error: { type: "object", properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } } } } } } },
} as const;
