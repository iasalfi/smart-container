import { test, expect } from "@playwright/test";

// Runs against the live URL after a production deploy (SMOKE_URL).
test("TC-S-001 Production smoke: home page loads with 1,000 containers @regression", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("kpi-total")).toContainText("1,000");
  await expect(page.getByTestId("map-dot")).toHaveCount(1000);
});

test("TC-S-002 Production smoke: a container page and alerts load @regression", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/container/?id=SC-1060");
  await expect(page.getByTestId("container-title")).toHaveText("SC-1060");
  await page.goto("/alerts/?view=alarms");
  await expect(page.getByTestId("alert-row").first()).toBeVisible();
  expect(errors).toEqual([]);
});

// The API service is deployed on its own URL (API_URL), separate from the web UI.
test("TC-S-003 Production smoke: the API service is healthy and serves the fleet @regression", async ({ request }) => {
  const api = (process.env.API_URL || "http://localhost:4100").replace(/\/+$/, "");
  const health = await request.get(`${api}/api/v1/health`);
  expect(health.status()).toBe(200);
  expect((await health.json()).status).toBe("ok");
  const fleet = await request.get(`${api}/api/v1/fleet?limit=1`);
  expect(fleet.status()).toBe(200);
  expect((await fleet.json()).total).toBe(1000);
});
