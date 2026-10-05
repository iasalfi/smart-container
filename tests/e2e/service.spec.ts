import { test, expect } from "@playwright/test";
import { openFleet } from "./helpers";

const API = "http://localhost:4100";

test.describe("Microservice boundary: web UI and API service", () => {
  test("TC-E-100 Fleet and alerts data come from the API service @regression", async ({ page }) => {
    const urls: string[] = [];
    page.on("request", (r) => { if (r.url().includes("/api/v1/")) urls.push(r.url()); });
    await openFleet(page);
    expect(urls.some((u) => u.startsWith(`${API}/api/v1/fleet`))).toBe(true);
    expect(urls.some((u) => u.startsWith(`${API}/api/v1/alerts`))).toBe(true);
  });

  test("TC-E-101 A container page loads its detail and series from the API @regression", async ({ page }) => {
    const urls: string[] = [];
    page.on("request", (r) => { if (r.url().includes("/api/v1/")) urls.push(r.url()); });
    await page.goto("/container/?id=SC-1060");
    await expect(page.getByTestId("container-title")).toHaveText("SC-1060");
    expect(urls).toContain(`${API}/api/v1/containers/SC-1060`);
    expect(urls).toContain(`${API}/api/v1/containers/SC-1060/series`);
  });

  test("TC-E-102 Fleet shows an error with Retry when the API is down, then recovers @negative", async ({ page }) => {
    await page.route("**/api/v1/**", (r) => r.abort("connectionrefused"));
    await page.goto("/");
    await expect(page.getByTestId("api-error")).toBeVisible();
    await expect(page.getByTestId("kpi-total")).toHaveCount(0);
    await page.unroute("**/api/v1/**");
    await page.getByTestId("api-retry").click();
    await expect(page.getByTestId("kpi-total")).toContainText("1,000");
    await expect(page.getByTestId("api-error")).toHaveCount(0);
  });

  test("TC-E-103 Alerts shows an error state when the API answers 500 @negative", async ({ page }) => {
    await page.route("**/api/v1/alerts**", (r) => r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "internal_error", message: "Unexpected error." } }) }));
    await page.goto("/alerts/");
    await expect(page.getByTestId("api-error")).toBeVisible();
    await expect(page.getByTestId("alert-row")).toHaveCount(0);
  });

  test("TC-E-104 A slow API shows a loading state, then the data @progression", async ({ page }) => {
    await page.route("**/api/v1/fleet**", async (r) => { await new Promise((res) => setTimeout(res, 1200)); await r.continue(); });
    await page.goto("/");
    await expect(page.getByTestId("loading")).toBeVisible();
    await expect(page.getByTestId("kpi-total")).toContainText("1,000", { timeout: 10_000 });
    await expect(page.getByTestId("loading")).toHaveCount(0);
  });

  test("TC-E-105 Changed thresholds are sent to the API as query parameters @progression", async ({ page }) => {
    await page.goto("/admin/");
    await expect(page.getByTestId("alert-total")).toContainText("102");
    const req = page.waitForRequest((r) => r.url().includes("/api/v1/alerts") && r.url().includes("deviationKm=50"));
    await page.getByTestId("thr-deviationKm").fill("50");
    await page.getByTestId("save-thresholds").click();
    await req;
  });

  test("TC-E-106 An API outage on a container page shows an error, not Container not found @negative", async ({ page }) => {
    await page.route("**/api/v1/containers/**", (r) => r.abort("connectionrefused"));
    await page.goto("/container/?id=SC-1060");
    await expect(page.getByTestId("api-error")).toBeVisible();
    await expect(page.getByTestId("not-found")).toHaveCount(0);
  });

  test("TC-E-107 The API sends CORS headers so the UI can run on another origin @regression", async ({ request }) => {
    const r = await request.get(`${API}/api/v1/health`, { headers: { Origin: "https://example.test" } });
    expect(r.status()).toBe(200);
    expect(r.headers()["access-control-allow-origin"]).toBe("*");
  });
});
