import { test, expect } from "@playwright/test";
import { openFleet, openView, num } from "./helpers";

test.describe("Regression: features", () => {
  test("TC-E-001 Fleet KPIs show 1,000 / 912 / 61 / 27 @regression", async ({ page }) => {
    await openFleet(page);
    await expect(page.getByTestId("kpi-total")).toContainText("1,000");
    await expect(page.getByTestId("kpi-normal")).toContainText("912");
    await expect(page.getByTestId("kpi-warning")).toContainText("61");
    await expect(page.getByTestId("kpi-critical")).toContainText("27");
    await expect(page.getByTestId("offline-note")).toContainText("12");
  });

  test("TC-E-002 Map draws a dot for every container @regression", async ({ page }) => {
    await openFleet(page);
    await expect(page.getByTestId("map-dot")).toHaveCount(1000);
  });

  test("TC-E-003 Clicking a status tile filters map and count @regression", async ({ page }) => {
    await openFleet(page);
    await page.getByTestId("kpi-critical").click();
    await expect(page.getByTestId("showing")).toContainText("27 of 1,000");
    await expect(page.getByTestId("map-dot")).toHaveCount(27);
    await expect(page.getByTestId("kpi-critical")).toHaveAttribute("aria-pressed", "true");
  });

  test("TC-E-004 Search by container ID finds one container @regression", async ({ page }) => {
    await openFleet(page);
    await page.getByTestId("search").fill("SC-1043");
    await expect(page.getByTestId("showing")).toContainText("1 of 1,000");
  });

  test("TC-E-005 Cargo and reefer filters combine @regression", async ({ page }) => {
    await openFleet(page);
    const all = await page.getByTestId("map-dot").count();
    await page.getByTestId("cargo-filter").selectOption("dairy");
    const dairy = await page.getByTestId("map-dot").count();
    expect(dairy).toBeGreaterThan(0);
    expect(dairy).toBeLessThan(all);
    await page.getByTestId("reefer-filter").check();
    const both = await page.getByTestId("map-dot").count();
    expect(both).toBeGreaterThan(0);
    expect(both).toBeLessThanOrEqual(dairy);
    await expect(page.getByTestId("fleet-row").first()).toContainText("Dairy");
  });

  test("TC-E-006 Selecting a dot opens a summary and links to detail @regression", async ({ page }) => {
    await openFleet(page);
    await page.getByTestId("search").fill("SC-1043");
    await page.getByTestId("map-dot").dispatchEvent("click");
    await expect(page.getByTestId("selected-card")).toContainText("SC-1043");
    await page.getByTestId("open-selected").click();
    await expect(page).toHaveURL(/container\/\?id=SC-1043/);
    await expect(page.getByTestId("container-title")).toHaveText("SC-1043");
  });

  test("TC-E-007 Detail shows cargo card, readings, gauge and two charts @regression", async ({ page }) => {
    await openView(page, "container", "SC-1001");
    await expect(page.getByTestId("cargo-card")).toBeVisible();
    await expect(page.getByTestId("readings")).toBeVisible();
    await expect(page.getByTestId("health-gauge")).toBeVisible();
    await expect(page.getByTestId("chart")).toHaveCount(2);
    await expect(page.getByTestId("tile-temp")).toContainText("Within limits");
  });

  test("TC-E-008 Temperature outside the band is flagged @regression", async ({ page }) => {
    await openView(page, "container", "SC-1060");
    await expect(page.getByTestId("tile-temp")).toContainText("Outside limits");
  });

  test("TC-E-009 Gas readings and set point appear when fitted @regression", async ({ page }) => {
    await openView(page, "container", "SC-1014");
    await expect(page.getByTestId("tile-gas")).toBeVisible();
    await openView(page, "container", "SC-1159");
    await expect(page.getByTestId("tile-setpoint")).toBeVisible();
  });

  test("TC-E-010 Route page shows planned and actual paths and stops @regression", async ({ page }) => {
    await openView(page, "route", "SC-1075");
    await expect(page.locator('[data-testid="ksa-map"] path[stroke-dasharray]')).toHaveCount(1);
    await expect(page.getByTestId("map-pin")).toHaveCount(4); // origin hold, two approved stops, one unscheduled
    await expect(page.locator('[data-testid="stop-row"][data-scheduled="false"]')).toHaveCount(1);
  });

  test("TC-E-011 Deviation distance is shown above 2 km @regression", async ({ page }) => {
    await openView(page, "route", "SC-1088");
    const km = parseFloat((await page.getByTestId("deviation").innerText()).replace(" km", ""));
    expect(km).toBeGreaterThan(2);
  });

  test("TC-E-012 Early warning banner appears for a predicted breach @regression", async ({ page }) => {
    await openView(page, "health", "SC-1007");
    await expect(page.getByTestId("forecast-banner")).toBeVisible();
  });

  test("TC-E-013 A temperature excursion lowers the gauge @regression", async ({ page }) => {
    await openView(page, "health", "SC-1060");
    const label = await page.getByTestId("health-gauge").first().getAttribute("aria-label");
    expect(Number(label!.replace(/\D/g, ""))).toBeLessThan(80);
    await expect(page.getByTestId("factors").locator("li").first()).not.toHaveText("—");
  });

  test("TC-E-014 Alerts centre lists 102 alerts, critical first @regression", async ({ page }) => {
    await page.goto("/alerts/?view=alarms");
    await expect(page.getByTestId("alerts-count")).toContainText("102 alerts");
    await expect(page.getByTestId("alert-row")).toHaveCount(102);
    await expect(page.getByTestId("alert-row").first()).toHaveAttribute("data-severity", "critical");
  });

  test("TC-E-015 Severity and state filters narrow the list @regression", async ({ page }) => {
    await page.goto("/alerts/?view=alarms");
    await page.getByTestId("sev-filter").selectOption("warning");
    const rows = page.getByTestId("alert-row");
    await expect(rows).toHaveCount(61);
    for (const sev of await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-severity")))) expect(sev).toBe("warning");
    await page.getByTestId("state-filter").selectOption("closed");
    await expect(page.getByTestId("alerts-empty")).toBeVisible();
  });

  test("TC-E-016 Alert search by container ID @regression", async ({ page }) => {
    await page.goto("/alerts/?view=alarms");
    await page.getByTestId("alert-search").fill("SC-1014");
    const n = await page.getByTestId("alert-row").count();
    expect(n).toBeGreaterThan(0);
    await expect(page.getByTestId("alert-row")).toHaveCount(n);
    for (const t of await page.getByTestId("alert-row").allInnerTexts()) expect(t).toContain("SC-1014");
  });

  test("TC-E-017 Scrubber moves the truck and the readout @regression", async ({ page }) => {
    await openView(page, "replay", "SC-1089");
    const scrub = page.getByTestId("scrubber");
    const last = await page.getByTestId("replay-time").innerText();
    await scrub.fill("0");
    await expect(page.getByTestId("replay-time")).not.toHaveText(last);
    await expect(page.getByTestId("replay-time")).toContainText("1440 min ago");
    await expect(page.getByTestId("map-truck")).toBeVisible();
    await expect(page.getByTestId("replay-readout")).toContainText("°C");
  });

  test("TC-E-018 Report shows summary, chart, excursions and door log @regression", async ({ page }) => {
    await openView(page, "report", "SC-1060");
    await expect(page.getByTestId("report")).toBeVisible();
    await expect(page.getByTestId("excursion-table")).toBeVisible();
    await expect(page.getByTestId("report-score")).toHaveText(/^\d+$/);
    await expect(page.getByTestId("chart")).toHaveCount(1);
  });

  test("TC-E-019 Report for a clean container says no excursions @regression", async ({ page }) => {
    await openView(page, "report", "SC-1001");
    await expect(page.getByTestId("no-excursions")).toBeVisible();
  });

  test("TC-E-020 Admin shows profile library and device list @regression", async ({ page }) => {
    await page.goto("/admin/");
    await expect(page.getByTestId("profile-table").locator("tbody tr")).toHaveCount(7);
    await expect(page.getByTestId("device-table").locator("tbody tr")).toHaveCount(15);
  });

  test("TC-E-021 Container tabs navigate between views @regression", async ({ page }) => {
    await openView(page, "container", "SC-1001");
    const tabs = page.getByRole("navigation", { name: "Container views" }).getByRole("link");
    const n = await tabs.count();
    expect(n).toBe(6);
    for (let i = 0; i < n; i++) {
      await page.getByRole("navigation", { name: "Container views" }).getByRole("link").nth(i).click();
      await expect(page.getByTestId("container-title")).toHaveText("SC-1001");
      await expect(page.getByRole("navigation", { name: "Container views" }).getByRole("link").nth(i)).toHaveAttribute("aria-current", "page");
    }
  });

  test("TC-E-022 Main navigation reaches the control tower, Cases and Settings @regression", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    await nav.getByRole("link", { name: "Cases" }).click();
    await expect(page).toHaveURL(/alerts/);
    await expect(nav.getByRole("link", { name: "Cases" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/admin/);
    await expect(nav.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Control tower" }).click();
    await expect(page.getByTestId("kpi-total")).toBeVisible();
    expect(await num(page, "kpi-total")).toBe(1000);
  });
});
