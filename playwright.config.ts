import { defineConfig, devices } from "@playwright/test";

// PW_CHROMIUM_PATH lets a sandbox without the Playwright download point at an installed Chromium.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;
const PORT = 3100;
const API_PORT = 4100;

export default defineConfig({
  testDir: "tests/e2e",
  testIgnore: "**/smoke.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }], ["junit", { outputFile: "test-results/e2e-junit.xml" }]] : [["list"]],
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: executablePath ? { executablePath, args: ["--no-sandbox"] } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1360, height: 900 } } }],
  webServer: [
    // The API service, run from the same handlers that Vercel and Docker use.
    { command: "npx tsx services/api/src/server.ts", env: { PORT: String(API_PORT) }, url: `http://localhost:${API_PORT}/api/v1/health`, reuseExistingServer: !process.env.CI, timeout: 60_000 },
    // The web UI, built with NEXT_PUBLIC_API_URL=http://localhost:4100 (npm run build:web).
    { command: `npx serve web/out -l ${PORT} --no-clipboard`, url: `http://localhost:${PORT}`, reuseExistingServer: !process.env.CI, timeout: 60_000 },
  ],
});
