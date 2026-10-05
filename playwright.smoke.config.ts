import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

// Runs against a live URL (SMOKE_URL), no local server.
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/smoke.spec.ts",
  retries: 2,
  reporter: [["list"]],
  timeout: 45_000,
  use: {
    baseURL: process.env.SMOKE_URL || "http://localhost:3100",
    launchOptions: executablePath ? { executablePath, args: ["--no-sandbox"] } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
