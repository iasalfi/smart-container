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
| `GET /api/v1/partners` | The 8 freight companies (truck providers) with a scorecard each. Filter: `status` (active, probation, suspended) |
| `GET /api/v1/drivers` | The 320 drivers with a scorecard. Filters: `partner`, `risk` (high, watch, good), `limit`, `offset` |
| `GET /api/v1/alerts` | Alerts, critical first. Filters: `severity`, `q`, `customer`, and any threshold (`deviationKm=5`) |

Errors are JSON: `{"error":{"code":"container_not_found","message":"..."}}` with 400, 404 or 405.

## Screens added in this release

**Theme.** A dashboard shell in the style of the Synto admin template: a dark navy sidebar, a white top bar, a soft grey-blue canvas, cards with header strips and an indigo accent. Status colours stay readable (sage for normal, dusty amber for warning, terracotta for critical) and every pair keeps WCAG AA contrast.

**Alert and alarm management (`/alerts/`).** The alert list follows the ITIL incident model. Priority P1 to P4 comes from impact and urgency (a 3 by 3 matrix). Each priority has response and resolution targets, and a running clock turns red when a target is breached. Work moves through Open, Acknowledged, In progress, Resolved and Closed, and closure needs a resolution code. Breaches and major incidents lift the ticket from L1 service desk to L2 specialist and L3 duty manager. Tickets have owners, notes and a timeline. Alerts that repeat on one corridor become problem candidates and can be raised as problems with a root cause. Queues: all, my queue, unassigned, SLA at risk, major incidents. The rules live in `packages/domain/src/itsm.ts`. Tickets are kept in the browser, because the API is read-only.

**Journey operations (`/operations/`).** A board of journeys by status, a five-step wizard to on-board a load (customer, cargo, container, seal, truck, driver) and plan the route, and a journey page. The planner (`packages/domain/src/journey.ts`) adds pitstops from driving rules: a 45 minute rest after 4.5 hours at the wheel, a fuel stop every 650 km, an overnight rest after 9 hours of driving a day, plus a pre-trip temperature check for reefers, port gate and customs steps for port cities, waypoints for stops on the way, and warnings for a missed deadline, a night departure and long reefer hauls. Each journey has milestones with planned and actual times; logging a milestone with a delay moves the estimated arrival and marks the journey Delayed past 30 minutes. Every one of the 1,000 containers has a journey (926 in transit, 71 delayed, two planned, one completed), so the board always adds up to the fleet. Each column shows 12 cards and a Show all button. Journeys created in the wizard are kept in the browser.

**Analytics (`/analytics/`) and Reports (`/reports/`).** Both follow the "View as" persona, which stands in for the signed-in user (the demo has no real login). The shared logic is `packages/domain/src/analytics.ts`. The operator gets journey delays, corridor load and service desk health; the quality manager gets cold chain compliance, cargo health and temperature alerts; the security officer gets doors, locks, route deviations and unscheduled stops; a customer gets arrivals, status and cargo mix for its own containers only. Each persona has its own four KPIs and its own report catalogue (daily operations, journey on-time, cold chain, health watch list, security incidents, service level, shipment status). A report can be filtered by cargo and text, printed, or exported as CSV (UTF-8 with a byte order mark so Excel reads Arabic). The Fleet dashboard has a persona strip with the same KPIs, and its alert-type chart and side panel follow the persona too.

**Live map (`/live/`).** A MapLibre GL map (loaded from the jsDelivr CDN on first use) with two tabs. *Live tracking* puts every container the signed-in role may see on a real base map (OpenStreetMap vector tiles from OpenFreeMap, no key needed). Each corridor is fetched once from the OSRM routing service, and trucks are placed along that road at their progress, then advance on a demo clock (one second is one minute on the road) that can be paused. Selecting a container draws its whole road with the part already driven, the truck facing its direction of travel, both end cities, speed, distance left and arrival time, and the truck can be followed. Status filters and search narrow the map and the list, and a customer sees only its own containers. *Route planner* (operator, quality and security) takes an origin, up to two stops on the way, a destination, a departure and a speed, draws the road from OSRM with route options, and places the planned rest, fuel and overnight stops on it by distance. The container and journey pages link to the live map. When OSRM cannot be reached the map falls back to the planned corridor and says so; when the base map cannot load it draws routes on a plain background. Road geometry helpers are in `packages/domain/src/roads.ts` and the services are configured in `web/lib/maplib.ts` (`NEXT_PUBLIC_MAP_STYLE` swaps the base map). Browser tests answer the style and routing requests themselves; set `MAPLIBRE_DIST` to a folder holding `maplibre-gl.js` and `.css` to run them without internet.

**Freight partners and drivers (`/partners/`, and the registry in Settings).** Every container has a driver and a freight company (truck provider). The registry holds 8 partners and 320 drivers, seeded and deterministic (`packages/domain/src/partners.ts`). Operators add and edit partners and drivers, log driver events (speeding, harsh braking, rest breach, late check-in, unsafe stop) and assign a driver to a container. Every input is validated in the domain package, so the same rules guard the form and any later API: names, Saudi mobile numbers (`05` plus 8 digits), 10 digit licence numbers that must be unique, dates, truck counts, a reefer needing a cold chain driver, and no assignment of an expired licence, an inactive driver or a suspended partner. Quality and security can read the registry. Customers cannot open it. In Settings an operator can also remove a partner or driver, but not while they still carry containers. Changes live in the browser (`scm-demo-v1`), as the rest of the demo state does.

**Carrier and driver scores (`packages/domain/src/people.ts`).** Driver safety score: 100, less the points of every logged event in the last 30 days (speeding 5, harsh braking 3, rest breach 8, late check-in 2, unsafe stop 6), less 6 per open critical alert and 2 per open warning on their containers, less 25 for an expired licence and 5 for one that runs out within 30 days, never below 0. Under 60 is high risk, 60 to 79 is watch, 80 and over is good. Carrier score: 30% on-time journeys, 25% cold chain (share of reefers inside their band, left out when the partner has no reefers), 25% alert rate (100 less 4 per 100 containers) and 20% driver safety. Grade A from 85, B from 70, C from 55, D below. Two KPIs from this, the carrier score and the driver score, now sit on every persona's dashboard strip and Value page, next to widgets for the partner league, driver risk, licence expiry, event mix and the drivers to look at first. Two new reports list the partner and driver scorecards.

**Cases (`/alerts/`).** The alerts page opens on cases: one per container, however many alarms it raised, ranked by priority and age. A case shows how many alarms it holds, its owner, and how far past the response and resolution targets it is. An operator can take a case, open a work order for a repair case (reefer set point, temperature critical, gas) or mark it resolved. The full alarm list and the service desk tools are one click away (`/alerts/?view=alarms`). The control tower lists the cases that need you now.

**Maintenance (`/maintenance/`).** A board with five columns (triage, diagnose, repair, test, ready) for work orders raised from cases or from the tracker list. A work order that reaches ready can be released, which resolves its case. The device list shows trackers that need a visit before they fail (battery 25% or lower, offline 25 minutes or more, or a weak signal with the battery at 40% or lower). Settings holds the trigger values. Example orders ship with the demo so the board is not empty.

**Lifecycle.** A container page shows six stages (booked, loaded and sealed, in transit, at destination, unloaded and inspected, back in service) with the current one marked, a running-late flag, and the maintenance branch when an order is open. An operator records the two post-delivery steps.

**Value.** The Analytics page is named Value in the menu. For the operator it ends with a table of six levers (every exception has an owner, an alarm leads to repair, tracking after delivery, cargo value, preventive repair, carrier and driver accountability) with baselines read live from the data on screen. Targets are proposals for the customer to confirm. Reports now open from the Value page.

## Run it locally

```bash
npm ci
npm run dev:api      # http://localhost:4100/api/v1/health
npm run dev:web      # http://localhost:3000 (calls the API on 4100)
```

Or both in containers: `docker compose up --build` (web on 8080, API on 4100).

## Tests

The test bank is `tests/bank.json` (readable copy: `TEST_BANK.md`): 375 cases, each with an ID, steps and expected result. `npm run test:bank` fails if a case has no automated test, a test has no bank entry, or a browser test is missing its tags.

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
