import { test, expect } from "@playwright/test";
import { openFleet, openView, setLang, setPersona, num } from "./helpers";

test.describe("Progression: new behaviour and state changes", () => {
  test("TC-E-030 An alert moves through acknowledge, in progress, resolved and closed @progression", async ({ page }) => {
    await page.goto("/alerts/?view=alarms");
    const row = page.getByTestId("alert-row").first();
    await expect(row.getByTestId("alert-state")).toHaveText("Open");
    await row.getByTestId("ack-btn").click();
    await expect(row.getByTestId("alert-state")).toHaveText("Acknowledged");
    await row.getByTestId("manage-btn").click();
    await row.getByTestId("start-btn").click();
    await expect(row.getByTestId("alert-state")).toHaveText("In progress");
    await row.getByTestId("resolve-btn").click();
    await expect(row.getByTestId("alert-state")).toHaveText("Resolved");
    await row.getByTestId("close-btn").click();
    await expect(row.getByTestId("alert-state")).toHaveText("Closed");
  });

  test("TC-E-031 Escalation timer shows for critical open alerts @progression", async ({ page }) => {
    await page.goto("/alerts/?view=alarms");
    await page.getByTestId("sev-filter").selectOption("critical");
    const esc = page.getByTestId("escalation");
    await expect(esc.first()).toBeVisible();
    for (const t of await esc.allInnerTexts()) expect(t).toMatch(/Escalated|Escalates in \d+ min/);
  });

  test("TC-E-032 Alert state survives a reload @progression", async ({ page }) => {
    await page.goto("/alerts/?view=alarms");
    const first = page.getByTestId("alert-row").first();
    const id = (await first.innerText()).match(/SC-\d{4}/)![0];
    await first.getByTestId("ack-btn").click();
    await page.reload();
    await page.getByTestId("alert-search").fill(id);
    await expect(page.getByTestId("alert-row").first().getByTestId("alert-state")).toHaveText("Acknowledged");
  });

  test("TC-E-033 Play advances the replay @progression", async ({ page }) => {
    await openView(page, "replay", "SC-1089");
    const before = await page.getByTestId("replay-time").innerText();
    await page.getByTestId("play-btn").click();
    await expect(page.getByTestId("replay-time")).not.toHaveText(before, { timeout: 5000 });
    await page.getByTestId("play-btn").click();
  });

  test("TC-E-034 Padlock lock and unlock with confirmation and audit entry @progression", async ({ page }) => {
    await openView(page, "modules", "SC-1075");
    await expect(page.getByTestId("lock-state")).toHaveText("Locked");
    await page.getByTestId("unlock-btn").click();
    await expect(page.getByTestId("confirm-dialog")).toBeVisible();
    await page.getByTestId("confirm-yes").click();
    await expect(page.getByTestId("lock-state")).toHaveText("Unlocked");
    await expect(page.getByTestId("audit-list").locator("li")).toHaveCount(1);
    await page.getByTestId("lock-btn").click();
    await page.getByTestId("confirm-yes").click();
    await expect(page.getByTestId("lock-state")).toHaveText("Locked");
    await expect(page.getByTestId("audit-list").locator("li")).toHaveCount(2);
  });

  test("TC-E-035 Gas panel flags high NH3 and H2S @progression", async ({ page }) => {
    await openView(page, "modules", "SC-1014");
    await expect(page.getByTestId("gas-NH3")).toHaveAttribute("data-high", "true");
    await expect(page.getByTestId("gas-H2S")).toHaveAttribute("data-high", "true");
  });

  test("TC-E-036 Raising a threshold recalculates alerts @progression", async ({ page }) => {
    await page.goto("/admin/");
    await expect(page.getByTestId("alert-total")).toContainText("102");
    await page.getByTestId("thr-deviationKm").fill("50");
    await page.getByTestId("save-thresholds").click();
    await expect(page.getByTestId("threshold-msg")).toBeVisible();
    await expect.poll(() => num(page, "alert-total")).toBeLessThan(102);
    await page.getByTestId("reset-thresholds").click();
    await expect(page.getByTestId("alert-total")).toContainText("102");
  });

  test("TC-E-037 Customer view shows only that customer's 127 containers and hides Admin @progression", async ({ page }) => {
    await openFleet(page);
    await setPersona(page, "customer");
    await expect(page.getByTestId("kpi-total")).toContainText("127");
    await expect(page.getByTestId("fleet-sub")).toContainText("127");
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Settings" })).toHaveCount(0);
  });

  test("TC-E-038 Quality view shows lowest cargo health panel @progression", async ({ page }) => {
    await openFleet(page);
    await setPersona(page, "quality");
    await expect(page.getByTestId("panel-health")).toBeVisible();
    await expect(page.getByTestId("panel-alerts")).toHaveCount(0);
  });

  test("TC-E-039 Security view shows door and lock watch @progression", async ({ page }) => {
    await openFleet(page);
    await setPersona(page, "security");
    await expect(page.getByTestId("panel-door")).toBeVisible();
    await expect(page.getByTestId("panel-door").locator("li").first()).toBeVisible();
  });

  test("TC-E-040 Arabic switches text and sets right-to-left @progression", async ({ page }) => {
    await openFleet(page);
    await page.getByTestId("lang-ar").click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("نظرة عامة على الأسطول");
  });

  test("TC-E-041 Language choice persists after reload @progression", async ({ page }) => {
    await openFleet(page);
    await setLang(page, "ar");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("نظرة عامة على الأسطول");
  });

  test("TC-E-042 Map zoom buttons change the view @progression", async ({ page }) => {
    await openFleet(page);
    const map = page.getByTestId("ksa-map");
    await expect(map).toHaveAttribute("data-zoom", "1");
    await page.getByTestId("zoom-in").click();
    await expect(map).toHaveAttribute("data-zoom", "2");
    await page.getByTestId("zoom-out").click();
    await expect(map).toHaveAttribute("data-zoom", "1");
    await page.getByTestId("zoom-in").click();
    await page.getByTestId("zoom-reset").click();
    await expect(map).toHaveAttribute("data-zoom", "1");
  });

  test("TC-E-043 Print button calls the browser print @progression", async ({ page }) => {
    await page.addInitScript(() => { (window as unknown as { __prints: number }).__prints = 0; window.print = () => { (window as unknown as { __prints: number }).__prints++; }; });
    await openView(page, "report", "SC-1060");
    await page.getByTestId("print-btn").click();
    expect(await page.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBe(1);
  });
});
