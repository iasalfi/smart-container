# Smart Container Monitoring demo

A demo of real-time container tracking and cargo health monitoring on KSA roads. Everything on screen is synthetic: 1,000 containers (912 normal, 61 warning, 27 critical, 12 of them offline), 102 alerts, eight routes between seven cities. It covers use cases DM-01 to DM-10 of the BRD.

## Architecture: two independent services

```
 browser ──►  web   (Next.js static export, own Vercel project / nginx image)
    │
    └──────►  api   (REST, serverless functions or Node/Docker, own Vercel project)
                 └─ packages/domain  (fleet generator, health model, rule engine, route maths)
```

| Part | Folder | Deploys as |
|---|---|---|
| API service | `services/api` | Vercel project 1 (functions), or the Docker image in `services/api/Dockerfile` |
| Web UI | `web` | Vercel project 2 (static), or the nginx image in `web/Dockerfile` |
| Shared domain code | `packages/domain` | Not deployed. Copied into each service at build time by `scripts/vendor-domain.mjs`, so each service builds on its own |

The web UI holds no fleet data. It calls the API for the fleet, each container, its 24-hour readings, and the alert list. Alert thresholds edited in Admin are sent to the API as query parameters. If the API is down the UI shows an error with a Retry button.

### API (read-only, versioned, CORS open)

| Endpoint | Returns |
|---|---|
| `GET /api/v1/health` | Liveness, version, fleet size |
| `GET /api/v1/openapi` | OpenAPI 3 description |
| `GET /api/v1/profiles` | Cargo profile library |
| `GET /api/v1/fleet` | Fleet with status counts. Filters: `status`, `profile`, `reefer`, `q`, `customer`, `limit`, `offset` |
| `GET /api/v1/containers/{id}` | One container with health, forecast, stops, deviation, excursions, alerts |
| `GET /api/v1/containers/{id}/series` | 289 readings, five minutes apart, oldest first |
| `GET /api/v1/alerts` | Alerts, critical first. Filters: `severity`, `q`, `customer`, and any threshold (`deviationKm=5`) |

Errors are JSON: `{"error":{"code":"container_not_found","message":"..."}}` with 400, 404 or 405.

## Screens added in this release

**Theme.** A dull pastel palette of sand, sage and dusty teal, with a light top bar. Status colours stay readable (sage for normal, dusty amber for warning, terracotta for critical) and every pair keeps WCAG AA contrast.

**Alert and alarm management (`/alerts/`).** The alert list follows the ITIL incident model. Priority P1 to P4 comes from impact and urgency (a 3 by 3 matrix). Each priority has response and resolution targets, and a running clock turns red when a target is breached. Work moves through Open, Acknowledged, In progress, Resolved and Closed, and closure needs a resolution code. Breaches and major incidents lift the ticket from L1 service desk to L2 specialist and L3 duty manager. Tickets have owners, notes and a timeline. Alerts that repeat on one corridor become problem candidates and can be raised as problems with a root cause. Queues: all, my queue, unassigned, SLA at risk, major incidents. The rules live in `packages/domain/src/itsm.ts`. Tickets are kept in the browser, because the API is read-only.

**Journey operations (`/operations/`).** A board of journeys by status, a five-step wizard to on-board a load (customer, cargo, container, seal, truck, driver) and plan the route, and a journey page. The planner (`packages/domain/src/journey.ts`) adds pitstops from driving rules: a 45 minute rest after 4.5 hours at the wheel, a fuel stop every 650 km, an overnight rest after 9 hours of driving a day, plus a pre-trip temperature check for reefers, port gate and customs steps for port cities, waypoints for stops on the way, and warnings for a missed deadline, a night departure and long reefer hauls. Each journey has milestones with planned and actual times; logging a milestone with a delay moves the estimated arrival and marks the journey Delayed past 30 minutes. Eleven journeys are seeded from the live fleet. Journeys created in the wizard are kept in the browser.

## Run it locally

```bash
npm ci
npm run dev:api      # http://localhost:4100/api/v1/health
npm run dev:web      # http://localhost:3000 (calls the API on 4100)
```

Or both in containers: `docker compose up --build` (web on 8080, API on 4100).

## Tests

The test bank is `tests/bank.json` (readable copy: `TEST_BANK.md`): 273 cases, each with an ID, steps and expected result. `npm run test:bank` fails if a case has no automated test, a test has no bank entry, or a browser test is missing its tags.

| Command | What it runs |
|---|---|
| `npm run test:unit` | Domain unit tests (health score, forecast, rule engine, route maths, filters), translation tests, and 35 API tests (every endpoint, validation, errors, a real HTTP socket) |
| `npm run test:e2e` | 142 browser tests (Playwright, Chromium) against the real web build and the real API, including outage, 500, slow-API and CORS cases |
| `npm run test:regression` / `test:progression` / `test:negative` / `test:a11y` | One suite at a time, by tag |
| `npm run test:smoke` | 3 checks against live URLs (`SMOKE_URL`, `API_URL`) |
| `npm test` | bank check + unit + browser |

If Playwright cannot download its own browser, point it at an installed one: `PW_CHROMIUM_PATH=/path/to/chromium npm run test:e2e`.

## CI/CD (`.github/workflows/ci.yml`)

Every push and pull request to `main`:

1. Lint, type check and test-bank check; unit and API tests; API container image builds and answers (in parallel).
2. Browser tests against the production web build and the local API.
3. Pull requests only: preview deploy of both services, with links posted as a comment.
4. Push to `main` only, and only when every step above is green: production deploy of the API, then of the web UI built against the API's URL.
5. Smoke tests on both live URLs. If they fail, both services roll back to their previous deployment.

### One-time setup

Repository secrets (Settings > Secrets and variables > Actions):

| Secret | Value |
|---|---|
| `VERCEL_TOKEN` | A token from vercel.com/account/tokens |
| `VERCEL_ORG_ID` | `team_TJFkXUsfG9wqVXC6Cr9B1QZy` |
| `VERCEL_PROJECT_ID_WEB` | `prj_cxdkMl7RvDilredmGqoD6mCFyfvf` (project `smart-container-demo`) |
| `VERCEL_PROJECT_ID_API` | `prj_jMgKHSdl7FrS2MhXDZlc1CAAYbyx` (project `smart-container-api`) |

Repository variables: `API_URL` (the API's public domain, for example `https://smart-container-api.vercel.app`) and `WEB_URL`. The browser calls the API directly, so it needs the stable domain, not a protected per-deployment URL. Both Vercel projects have deployment protection switched off.

Also create two GitHub environments, `production-api` and `production-web`. Add required reviewers only if you want a manual approval before shipping.

Both Vercel projects must keep an empty Root Directory: the pipeline runs the Vercel CLI from inside `services/api` and `web`.
