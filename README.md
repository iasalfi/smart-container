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

## Run it locally

```bash
npm ci
npm run dev:api      # http://localhost:4100/api/v1/health
npm run dev:web      # http://localhost:3000 (calls the API on 4100)
```

Or both in containers: `docker compose up --build` (web on 8080, API on 4100).

## Tests

The test bank is `tests/bank.json` (readable copy: `TEST_BANK.md`): 186 cases, each with an ID, steps and expected result. `npm run test:bank` fails if a case has no automated test, a test has no bank entry, or a browser test is missing its tags.

| Command | What it runs |
|---|---|
| `npm run test:unit` | Domain unit tests (health score, forecast, rule engine, route maths, filters), translation tests, and 35 API tests (every endpoint, validation, errors, a real HTTP socket) |
| `npm run test:e2e` | 84 browser tests (Playwright, Chromium) against the real web build and the real API, including outage, 500, slow-API and CORS cases |
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

