import { test, expect, type Page } from "@playwright/test";
import { axeSerious, setLang, setPersona } from "./helpers";

async function fillCargo(page: Page, over: Partial<Record<"customer" | "container" | "seal", string>> = {}) {
  await page.getByTestId("f-customer").fill(over.customer ?? "Najd Fresh Foods");
  await page.getByTestId("f-profile").selectOption("dairy");
  await page.getByTestId("f-container").fill(over.container ?? "SC-2001");
  await page.getByTestId("f-seal").fill(over.seal ?? "SEAL-90210");
}
async function fillTruck(page: Page, plate = "ABC 1234") {
  await page.getByTestId("f-plate").fill(plate);
  await page.getByTestId("f-driver").fill("Khalid Al-Anazi");
  await page.getByTestId("f-phone").fill("0551234567");
}
const next = (page: Page) => page.getByTestId("wiz-next").click();

async function planTo(page: Page, from: string, to: string, via: string[] = [], depart = "2026-10-06T05:00") {
  await page.goto("/operations/new/");
  await fillCargo(page); await next(page);
  await fillTruck(page); await next(page);
  await page.getByTestId("f-origin").selectOption(from);
  await page.getByTestId("f-destination").selectOption(to);
  for (const v of via) { await page.getByTestId("f-via-select").selectOption(v); await page.getByTestId("f-via-add").click(); }
  await page.getByTestId("f-depart").fill(depart);
  await next(page);
  await expect(page.getByTestId("plan-view")).toBeVisible();
}

test.describe("Journey operations module", () => {
  test("TC-E-146 The Operations page lists 11 journeys on a board with a count for each status @regression", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Operations" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Journey operations");
    await expect(page.getByTestId("journey-card")).toHaveCount(11);
    await expect(page.getByTestId("col-planned").getByTestId("journey-card")).toHaveCount(2);
    await expect(page.getByTestId("col-in_transit").getByTestId("journey-card")).toHaveCount(6);
    await expect(page.getByTestId("col-delayed").getByTestId("journey-card")).toHaveCount(2);
    await expect(page.getByTestId("col-completed").getByTestId("journey-card")).toHaveCount(1);
    await expect(page.getByTestId("ops-k-transit")).toContainText("6");
    await expect(page.getByTestId("ops-k-delayed")).toContainText("2");
  });

  test("TC-E-147 Searching the board by container, journey or customer narrows the cards @regression", async ({ page }) => {
    await page.goto("/operations/");
    await page.getByTestId("journey-search").fill("J-1003");
    await expect(page.getByTestId("journey-card")).toHaveCount(1);
    await page.getByTestId("journey-search").fill("Gulf Pharma");
    expect(await page.getByTestId("journey-card").count()).toBeGreaterThan(0);
    await page.getByTestId("journey-search").fill("zzz");
    await expect(page.getByTestId("journeys-empty")).toBeVisible();
  });

  test("TC-E-148 A journey page shows the road, load details, key figures and the milestone list @regression", async ({ page }) => {
    await page.goto("/operations/");
    await page.getByTestId("journey-link").first().click();
    await expect(page.getByTestId("journey-title")).toHaveText(/J-\d{4}/);
    await expect(page.getByTestId("journey-distance")).toContainText("km");
    await expect(page.getByTestId("journey-map").getByTestId("ksa-map")).toBeVisible();
    await expect(page.getByTestId("journey-details")).toContainText("Truck plate");
    expect(await page.getByTestId("ms-row").count()).toBeGreaterThanOrEqual(4);
    await expect(page.getByTestId("ms-row").first()).toHaveAttribute("data-kind", "loaded");
    await expect(page.getByTestId("ms-row").last()).toHaveAttribute("data-kind", "delivered");
  });

  test("TC-E-149 Logging the next milestone with a delay updates the delay, the estimated arrival and the row @progression", async ({ page }) => {
    await page.goto("/operations/journey/?id=J-1009");
    await expect(page.getByTestId("journey-status")).toHaveText("Planned");
    await expect(page.getByTestId("journey-delay")).toContainText("On time");
    await page.getByTestId("log-next-btn").click();
    await expect(page.getByTestId("journey-status")).toHaveText("Loaded");
    await expect(page.getByTestId("ms-row").first()).toHaveAttribute("data-status", "done");
    await page.getByTestId("delay-input").fill("20");
    await page.getByTestId("log-next-btn").click();
    await expect(page.getByTestId("journey-delay")).toContainText("+20 min");
    await expect(page.getByTestId("journey-eta")).not.toHaveText(await page.getByTestId("journey-planned").innerText());
    await page.reload();
    await expect(page.getByTestId("journey-delay")).toContainText("+20 min");
  });

  test("TC-E-150 A delay of more than 30 minutes marks the journey Delayed and it moves to the Delayed column @progression", async ({ page }) => {
    await page.goto("/operations/journey/?id=J-1009");
    await page.getByTestId("log-next-btn").click();
    for (let i = 0; i < 2; i++) { await page.getByTestId("delay-input").fill("0"); await page.getByTestId("log-next-btn").click(); }
    await page.getByTestId("delay-input").fill("45");
    await page.getByTestId("log-next-btn").click();
    await expect(page.getByTestId("journey-status")).toHaveText("Delayed");
    await page.goto("/operations/");
    await expect(page.getByTestId("col-delayed").getByTestId("journey-card")).toHaveCount(3);
  });

  test("TC-E-151 A rest or fuel stop can be skipped and is shown as skipped @progression", async ({ page }) => {
    await page.goto("/operations/journey/?id=J-1001");
    await expect(page.getByTestId("next-milestone")).toContainText("Fuel stop");
    await page.getByTestId("skip-btn").click();
    await expect(page.locator('[data-testid="ms-row"][data-status="skipped"]')).toHaveCount(1);
    await expect(page.getByTestId("next-milestone")).not.toContainText("Fuel stop");
  });

  test("TC-E-152 Cancelling a journey asks first and then marks it cancelled @progression", async ({ page }) => {
    await page.goto("/operations/journey/?id=J-1010");
    await page.getByTestId("cancel-btn").click();
    await expect(page.getByTestId("cancel-confirm")).toBeVisible();
    await page.getByRole("button", { name: "Keep it" }).click();
    await expect(page.getByTestId("journey-status")).toHaveText("Planned");
    await page.getByTestId("cancel-btn").click();
    await page.getByTestId("cancel-yes").click();
    await expect(page.getByTestId("journey-status")).toHaveText("Cancelled");
    await expect(page.getByTestId("log-next-btn")).toHaveCount(0);
  });

  test("TC-E-153 A new load can be on-boarded, planned and dispatched in five steps, and it stays after a reload @progression", async ({ page }) => {
    await planTo(page, "jeddah", "riyadh");
    await expect(page.getByTestId("plan-km")).toContainText("km");
    await expect(page.getByTestId("plan-eta")).toBeVisible();
    await next(page);
    await expect(page.getByTestId("review")).toContainText("SC-2001");
    await expect(page.getByTestId("review")).toContainText("Jeddah → Riyadh");
    await page.getByTestId("dispatch-btn").click();
    await expect(page).toHaveURL(/operations\/journey\/\?id=J-1012/);
    await expect(page.getByTestId("journey-title")).toHaveText("J-1012");
    await expect(page.getByTestId("journey-status")).toHaveText("Planned");
    await page.goto("/operations/");
    await expect(page.getByTestId("journey-card")).toHaveCount(12);
    await page.getByTestId("tab-assets").click();
    await expect(page.getByTestId("asset-row").first()).toContainText("SC-2001");
    await expect(page.getByTestId("asset-row").first()).toContainText("ABC 1234");
    await page.reload();
    await expect(page.getByTestId("journey-card")).toHaveCount(12);
  });

  test("TC-E-154 The first step names what is missing and does not move on @negative", async ({ page }) => {
    await page.goto("/operations/new/");
    await next(page);
    await expect(page.getByTestId("panel-cargo")).toBeVisible();
    const errs = page.getByTestId("wiz-errors");
    await expect(errs).toContainText("Container ID must look like SC-2001");
    await expect(errs).toContainText("Enter the customer name");
    await expect(errs).toContainText("Seal number needs");
    await expect(page.getByTestId("step-cargo")).toHaveAttribute("aria-current", "step");
  });

  test("TC-E-155 A container ID or plate that is already in use is refused @negative", async ({ page }) => {
    await page.goto("/operations/new/");
    await fillCargo(page, { container: "SC-1001" });
    await next(page);
    await expect(page.getByTestId("wiz-errors")).toContainText("already in use");
    await page.getByTestId("f-container").fill("SC-2001");
    await next(page);
    await expect(page.getByTestId("panel-vehicle")).toBeVisible();
    await page.getByTestId("f-plate").fill("ENS 2893");
    await page.getByTestId("f-driver").fill("Khalid Al-Anazi");
    await page.getByTestId("f-phone").fill("0551234567");
    await next(page);
    await expect(page.getByTestId("wiz-errors")).toContainText("already on a truck");
  });

  test("TC-E-156 A set point outside the cargo's safe band is refused @negative", async ({ page }) => {
    await page.goto("/operations/new/");
    await fillCargo(page);
    await page.getByTestId("f-setpoint").fill("14");
    await next(page);
    await expect(page.getByTestId("wiz-errors")).toContainText("outside this cargo's safe band");
    await page.getByTestId("f-setpoint").fill("4");
    await next(page);
    await expect(page.getByTestId("panel-vehicle")).toBeVisible();
  });

  test("TC-E-157 A route with the same start and end, or a bad speed, is refused @negative", async ({ page }) => {
    await page.goto("/operations/new/");
    await fillCargo(page); await next(page);
    await fillTruck(page); await next(page);
    await page.getByTestId("f-origin").selectOption("riyadh");
    await page.getByTestId("f-destination").selectOption("riyadh");
    await next(page);
    await expect(page.getByTestId("wiz-errors")).toContainText("cannot be the same city");
    await page.getByTestId("f-destination").selectOption("jeddah");
    await page.getByTestId("f-speed").fill("20");
    await next(page);
    await expect(page.getByTestId("wiz-errors")).toContainText("between 40 and 100");
    await expect(page.getByTestId("panel-route")).toBeVisible();
  });

  test("TC-E-158 A delay that is not a number logs nothing and shows an error @negative", async ({ page }) => {
    await page.goto("/operations/journey/?id=J-1009");
    await page.getByTestId("delay-input").fill("");
    await page.getByTestId("log-next-btn").click();
    await expect(page.getByTestId("log-error")).toBeVisible();
    await page.getByTestId("delay-input").fill("5000");
    await page.getByTestId("log-next-btn").click();
    await expect(page.getByTestId("log-error")).toBeVisible();
    await expect(page.getByTestId("journey-status")).toHaveText("Planned");
  });

  test("TC-E-159 An unknown journey ID and the customer view both get a clear block @negative", async ({ page }) => {
    await page.goto("/operations/journey/?id=J-9999");
    await expect(page.getByTestId("not-found")).toContainText("Journey not found");
    await page.goto("/operations/");
    await setPersona(page, "customer");
    await expect(page.getByTestId("not-found")).toContainText("Not available");
    await expect(page.getByRole("link", { name: "Operations" })).toHaveCount(0);
  });

  test("TC-E-160 A long haul gets rest, fuel and overnight stops and a multi-day warning @regression", async ({ page }) => {
    await planTo(page, "dammam", "jeddah");
    const kinds = await page.getByTestId("plan-row").evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")));
    expect(kinds[0]).toBe("loaded");
    expect(kinds).toContain("rest");
    expect(kinds).toContain("fuel");
    expect(kinds).toContain("overnight");
    expect(kinds[kinds.length - 1]).toBe("delivered");
    await expect(page.getByTestId("plan-warnings")).toContainText("overnight rest");
    await expect(page.getByTestId("plan-view").getByTestId("map-pin").first()).toBeAttached();
  });

  test("TC-E-161 Stops on the way become waypoints in order and can be removed @regression", async ({ page }) => {
    await page.goto("/operations/new/");
    await fillCargo(page); await next(page);
    await fillTruck(page); await next(page);
    await page.getByTestId("f-origin").selectOption("jeddah");
    await page.getByTestId("f-destination").selectOption("tabuk");
    await page.getByTestId("f-via-select").selectOption("madinah");
    await page.getByTestId("f-via-add").click();
    await expect(page.getByTestId("via-item")).toHaveCount(1);
    await page.getByTestId("f-via-select").selectOption("buraydah");
    await page.getByTestId("f-via-add").click();
    await expect(page.getByTestId("via-item")).toHaveText([/1\. Madinah/, /2\. Buraydah/]);
    await page.getByRole("button", { name: "Remove Buraydah" }).click();
    await expect(page.getByTestId("via-item")).toHaveCount(1);
    await page.getByTestId("f-depart").fill("2026-10-06T06:00");
    await next(page);
    const wp = page.locator('[data-testid="plan-row"][data-kind="waypoint"]');
    await expect(wp).toHaveCount(1);
    await expect(wp).toContainText("Madinah");
  });

  test("TC-E-162 A port destination offers customs clearance and adds that milestone @regression", async ({ page }) => {
    await page.goto("/operations/new/");
    await fillCargo(page); await next(page);
    await fillTruck(page); await next(page);
    await expect(page.getByTestId("f-customs")).toHaveCount(0);
    await page.getByTestId("f-origin").selectOption("riyadh");
    await page.getByTestId("f-destination").selectOption("dammam");
    await page.getByTestId("f-customs").check();
    await page.getByTestId("f-depart").fill("2026-10-06T07:00");
    await next(page);
    await expect(page.locator('[data-testid="plan-row"][data-kind="customs"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="plan-row"][data-kind="pretrip_check"]')).toHaveCount(1);
  });

  test("TC-E-163 A delivery deadline that the plan misses raises a warning @regression", async ({ page }) => {
    await page.goto("/operations/new/");
    await fillCargo(page); await next(page);
    await fillTruck(page); await next(page);
    await page.getByTestId("f-depart").fill("2026-10-06T06:00");
    await page.getByTestId("f-deadline").fill("2026-10-06T08:00");
    await next(page);
    await expect(page.getByTestId("plan-warnings")).toContainText("after the delivery deadline");
  });

  test("TC-E-164 Operations pages have no serious accessibility violations @regression @a11y", async ({ page }) => {
    await page.goto("/operations/");
    await expect(page.getByTestId("journey-card").first()).toBeVisible();
    expect(await axeSerious(page)).toEqual([]);
    await page.getByTestId("tab-assets").click();
    expect(await axeSerious(page)).toEqual([]);
    await page.goto("/operations/journey/?id=J-1001");
    await expect(page.getByTestId("ms-row").first()).toBeVisible();
    expect(await axeSerious(page)).toEqual([]);
    await planTo(page, "jeddah", "madinah");
    expect(await axeSerious(page)).toEqual([]);
  });

  test("TC-E-165 Operations work in Arabic with right to left layout @regression", async ({ page }) => {
    await page.goto("/operations/");
    await setLang(page, "ar");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("عمليات الرحلات");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("col-in_transit")).toContainText("في الطريق");
    await page.getByTestId("new-journey").click();
    await expect(page.getByTestId("wizard-steps")).toContainText("العميل والحمولة");
    await page.getByTestId("wiz-next").click();
    await expect(page.getByTestId("wiz-errors")).toContainText("رقم الحاوية");
  });

  test("TC-E-166 Operations pages fit a phone without sideways scrolling @regression @ux", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    for (const url of ["/operations/", "/operations/journey/?id=J-1001", "/operations/new/"]) {
      await page.goto(url);
      await expect(page.locator("main h1")).toBeVisible();
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, url).toBeLessThanOrEqual(0);
    }
  });
});
