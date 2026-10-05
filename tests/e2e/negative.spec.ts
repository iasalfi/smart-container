import { test, expect } from "@playwright/test";
import { openFleet, openView, setPersona, num } from "./helpers";

test.describe("Negative: bad input, missing data, blocked actions", () => {
  test("TC-E-050 Unknown container ID shows a not-found state @negative", async ({ page }) => {
    await page.goto("/container/?id=SC-9999");
    await expect(page.getByTestId("not-found")).toBeVisible();
    await expect(page.getByTestId("not-found").getByRole("link")).toHaveAttribute("href", "/");
  });

  test("TC-E-051 Missing ID shows not found on every container view @negative", async ({ page }) => {
    for (const v of ["container", "route", "health", "replay", "modules", "report"]) {
      await page.goto(`/${v}/`);
      await expect(page.getByTestId("not-found"), v).toBeVisible();
    }
  });

  test("TC-E-052 No-match search shows an empty state and Clear recovers @negative", async ({ page }) => {
    await openFleet(page);
    await page.getByTestId("search").fill("zzzz");
    await expect(page.getByTestId("empty-state")).toBeVisible();
    await expect(page.getByTestId("map-dot")).toHaveCount(0);
    await page.getByTestId("clear-filters").click();
    await expect(page.getByTestId("showing")).toContainText("1,000 of 1,000");
    await expect(page.getByTestId("empty-state")).toHaveCount(0);
  });

  test("TC-E-053 Special characters in search do not break the page @negative", async ({ page }) => {
    await openFleet(page);
    for (const q of ["<script>alert(1)</script>", ".*", "(", "' OR 1=1 --"]) {
      await page.getByTestId("search").fill(q);
      await expect(page.getByTestId("empty-state")).toBeVisible();
    }
    await page.getByTestId("clear-filters").click();
    await expect(page.getByTestId("kpi-total")).toContainText("1,000");
  });

  test("TC-E-054 Unlock is blocked while the truck is moving @negative", async ({ page }) => {
    await openView(page, "modules", "SC-1089");
    // SC-1089 starts unlocked and moving: lock it first, then try to unlock it again.
    await page.getByTestId("lock-btn").click();
    await page.getByTestId("confirm-yes").click();
    await expect(page.getByTestId("lock-state")).toHaveText("Locked");
    await page.getByTestId("unlock-btn").click();
    await expect(page.getByTestId("lock-error")).toContainText("blocked while the truck is moving");
    await expect(page.getByTestId("confirm-dialog")).toHaveCount(0);
    await expect(page.getByTestId("lock-state")).toHaveText("Locked");
  });

  test("TC-E-055 Cancel in the confirm dialog changes nothing @negative", async ({ page }) => {
    await openView(page, "modules", "SC-1075");
    await page.getByTestId("unlock-btn").click();
    await page.getByTestId("confirm-no").click();
    await expect(page.getByTestId("confirm-dialog")).toHaveCount(0);
    await expect(page.getByTestId("lock-state")).toHaveText("Locked");
    await expect(page.getByTestId("audit-empty")).toBeVisible();
  });

  test("TC-E-056 Containers without modules show not fitted @negative", async ({ page }) => {
    await openView(page, "modules", "SC-1001");
    await expect(page.getByTestId("gas-none")).toContainText("No gas module");
    await expect(page.getByTestId("padlock-none")).toContainText("No smart padlock");
  });

  test("TC-E-057 Invalid thresholds are rejected @negative", async ({ page }) => {
    await page.goto("/admin/");
    const total = await num(page, "alert-total");
    for (const bad of ["0", "-5", "abc", ""]) {
      await page.getByTestId("thr-tempCriticalC").fill(bad);
      await page.getByTestId("save-thresholds").click();
      await expect(page.getByTestId("threshold-msg")).toContainText("greater than zero");
      expect(await num(page, "alert-total")).toBe(total);
    }
  });

  test("TC-E-058 Customer cannot open another customer's container or Admin @negative", async ({ page }) => {
    await openFleet(page);
    await setPersona(page, "customer");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Alerts" }).click();
    await page.goto("/container/?id=SC-1043");
    await setPersona(page, "customer");
    await expect(page.getByTestId("not-found")).toBeVisible();
    await page.goto("/admin/");
    await expect(page.getByTestId("not-found")).toContainText("Not available");
  });

  test("TC-E-059 Close is disabled before acknowledge, Acknowledge disabled after @negative", async ({ page }) => {
    await page.goto("/alerts/");
    const row = page.getByTestId("alert-row").first();
    await expect(row.getByTestId("close-btn")).toBeDisabled();
    await expect(row.getByTestId("ack-btn")).toBeEnabled();
    await row.getByTestId("ack-btn").click();
    await expect(row.getByTestId("ack-btn")).toBeDisabled();
    await expect(row.getByTestId("close-btn")).toBeEnabled();
  });

  test("TC-E-060 Corrupted saved state does not break the app @negative", async ({ page }) => {
    await page.addInitScript(() => { window.localStorage.setItem("scm-demo-v1", "{not json"); });
    await openFleet(page);
    await expect(page.getByTestId("kpi-total")).toContainText("1,000");
  });

  test("TC-E-061 Unknown URL shows the 404 page @negative", async ({ page }) => {
    const res = await page.goto("/does-not-exist/");
    expect(res?.status()).toBe(404);
    await expect(page.getByTestId("not-found")).toBeVisible();
  });

  test("TC-E-062 Alert search with no match shows an empty state @negative", async ({ page }) => {
    await page.goto("/alerts/");
    await page.getByTestId("alert-search").fill("SC-0000");
    await expect(page.getByTestId("alerts-empty")).toBeVisible();
    await expect(page.getByTestId("alert-row")).toHaveCount(0);
  });
});
