import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { axeSerious, setLang, setPersona } from "./helpers";

type P = "operator" | "quality" | "security" | "customer";
const PERSONAS: P[] = ["operator", "quality", "security", "customer"];
const KPIS: Record<P, string[]> = {
  operator: ["o_transit", "o_ontime", "o_delayed", "o_alarms"],
  quality: ["q_in_band", "q_health", "q_excursions", "q_forecast"],
  security: ["s_door", "s_lock", "s_deviation", "s_stops"],
  customer: ["c_total", "c_transit", "c_delayed", "c_delivered"],
};
const num = async (page: import("@playwright/test").Page, id: string) => Number((await page.getByTestId(id).locator(".an-kpi-n").innerText()).replace(/[^0-9]/g, ""));

test.describe("Analytics, reports and persona dashboards", () => {
  test("TC-E-168 Analytics opens for the operator with journey, corridor and service desk widgets @regression", async ({ page }) => {
    await page.goto("/analytics/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Analytics");
    await expect(page.getByTestId("an-scope")).toContainText("1,000 containers");
    for (const id of KPIS.operator) await expect(page.getByTestId(`an-kpi-${id}`)).toBeVisible();
    for (const w of ["status_mix", "delay_bands", "corridor_load", "alert_types", "sla"]) await expect(page.getByTestId(`an-widget-${w}`)).toBeVisible();
    expect(await num(page, "an-kpi-o_transit")).toBe(997);
    expect(await num(page, "an-kpi-o_delayed")).toBe(71);
  });

  test("TC-E-169 Analytics changes its KPIs and widgets with the persona @regression", async ({ page }) => {
    await page.goto("/analytics/");
    const widgets: Record<P, string[]> = { operator: ["delay_bands"], quality: ["temp_compliance", "cargo_health"], security: ["security_types", "lock_state"], customer: ["eta_buckets", "cargo_mix"] };
    for (const p of PERSONAS) {
      await setPersona(page, p);
      await expect(page.getByTestId("analytics")).toHaveAttribute("data-persona", p);
      for (const id of KPIS[p]) await expect(page.getByTestId(`an-kpi-${id}`)).toBeVisible();
      for (const w of widgets[p]) await expect(page.getByTestId(`an-widget-${w}`)).toBeVisible();
      for (const o of PERSONAS.filter((x) => x !== p)) await expect(page.getByTestId(`an-kpi-${KPIS[o][0]}`)).toHaveCount(0);
    }
  });

  test("TC-E-170 A customer sees only its own containers in analytics and reports @regression", async ({ page }) => {
    await page.goto("/analytics/");
    await setPersona(page, "customer");
    await expect(page.getByTestId("an-scope")).toContainText("Najd Fresh Foods");
    const mine = await num(page, "an-kpi-c_total");
    expect(mine).toBeGreaterThan(0);
    expect(mine).toBeLessThan(1000);
    await expect(page.getByTestId("an-widget-sla")).toHaveCount(0);
    await page.goto("/reports/");
    await expect(page.getByTestId("rep-pick-shipment_status")).toBeVisible();
    await expect(page.getByTestId("rep-pick-daily_ops")).toHaveCount(0);
    await expect(page.getByTestId("rep-pick-security_incidents")).toHaveCount(0);
    await expect(page.getByTestId("rep-count")).toContainText(`${mine}`);
    await expect(page.getByTestId("rep-table")).not.toContainText("SC-1002");
  });

  test("TC-E-171 The dashboard strip adapts to the persona and links to analytics and reports @regression", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("persona-strip")).toHaveAttribute("data-persona", "operator");
    await expect(page.getByTestId("persona-strip")).toContainText("Operator view");
    for (const p of PERSONAS) {
      await setPersona(page, p);
      await expect(page.getByTestId("persona-strip")).toHaveAttribute("data-persona", p);
      for (const id of KPIS[p]) await expect(page.getByTestId("persona-strip").getByTestId(`an-kpi-${id}`)).toBeVisible();
    }
    await setPersona(page, "quality");
    await expect(page.getByTestId("panel-health")).toBeVisible();
    await expect(page.getByTestId("alert-type-bars")).not.toContainText("Door open in motion");
    await setPersona(page, "security");
    await expect(page.getByTestId("panel-door")).toBeVisible();
    await expect(page.getByTestId("alert-type-bars")).not.toContainText("Cargo health early warning");
    await page.getByTestId("ps-analytics").click();
    await expect(page).toHaveURL(/\/analytics\/$/);
    await expect(page.getByTestId("analytics")).toHaveAttribute("data-persona", "security");
  });

  test("TC-E-172 The sidebar lists Analytics and Reports for every persona and marks the current one @regression @ux", async ({ page }) => {
    await page.goto("/");
    for (const p of PERSONAS) {
      await setPersona(page, p);
      await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Analytics" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Reports" })).toBeVisible();
    }
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Reports" }).click();
    await expect(page).toHaveURL(/\/reports\/$/);
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Reports" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Fleet" })).not.toHaveAttribute("aria-current", "page");
  });

  test("TC-E-173 Each persona gets its own report catalogue and the report body follows the pick @regression", async ({ page }) => {
    await page.goto("/reports/");
    const cat: Record<P, string[]> = { operator: ["daily_ops", "journey_otp", "cold_chain", "sla_perf"], quality: ["cold_chain", "health_watch"], security: ["security_incidents", "sla_perf"], customer: ["shipment_status", "journey_otp"] };
    for (const p of PERSONAS) {
      await setPersona(page, p);
      await expect(page.getByTestId("reports")).toHaveAttribute("data-persona", p);
      for (const r of cat[p]) await expect(page.getByTestId(`rep-pick-${r}`)).toBeVisible();
      await expect(page.locator('[data-testid^="rep-pick-"]')).toHaveCount(cat[p].length);
      await expect(page.getByTestId("rep-view")).toHaveAttribute("data-report", cat[p][0]);
    }
    await setPersona(page, "operator");
    await page.getByTestId("rep-pick-cold_chain").click();
    await expect(page.getByTestId("rep-view")).toHaveAttribute("data-report", "cold_chain");
    await expect(page.getByTestId("rep-table")).toContainText("Compliance");
    await expect(page.getByTestId("rep-total")).toBeVisible();
  });

  test("TC-E-174 The daily operations report totals match the fleet and can be filtered by cargo and text @regression", async ({ page }) => {
    await page.goto("/reports/");
    await expect(page.getByTestId("rep-row")).toHaveCount(8);
    await expect(page.getByTestId("rep-total")).toContainText("1,000");
    await page.getByTestId("rep-q").fill("tabuk");
    await expect(page.getByTestId("rep-row")).toHaveCount(2);
    await expect(page.getByTestId("rep-total")).toHaveCount(0);
    await page.getByTestId("rep-q").fill("");
    await page.getByTestId("rep-cargo").selectOption("dairy");
    await expect(page.getByTestId("rep-total")).toContainText("158");
  });

  test("TC-E-175 A report exports to a CSV file that matches the table @regression", async ({ page }) => {
    await page.goto("/reports/");
    await expect(page.getByTestId("rep-row")).toHaveCount(8);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("rep-export").click()]);
    expect(dl.suggestedFilename()).toBe("daily_ops-operator.csv");
    const text = readFileSync((await dl.path()) as string, "utf8");
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const lines = text.replace(/\r\n$/, "").split("\r\n");
    expect(lines[0]).toBe("﻿Route,Containers,On the road,Delayed,Average delay,Open alerts");
    expect(lines.length).toBe(1 + 8 + 1);
    expect(lines[lines.length - 1].startsWith("Total,1000,997,71")).toBe(true);
  });

  test("TC-E-176 A report with no matching rows says so, and long reports page in steps @progression", async ({ page }) => {
    await page.goto("/reports/");
    await page.getByTestId("rep-pick-journey_otp").click();
    await expect(page.getByTestId("rep-row")).toHaveCount(25);
    await page.getByTestId("rep-more").click();
    await expect(page.getByTestId("rep-row")).toHaveCount(50);
    await page.getByTestId("rep-q").fill("zzzz-nothing");
    await expect(page.getByTestId("rep-empty")).toBeVisible();
    await expect(page.getByTestId("rep-more")).toHaveCount(0);
  });

  test("TC-E-177 Analytics and reports have no serious accessibility violations for any persona @regression @a11y", async ({ page }) => {
    test.setTimeout(90000);
    for (const url of ["/analytics/", "/reports/"]) {
      await page.goto(url);
      for (const p of PERSONAS) {
        await setPersona(page, p);
        await expect(page.locator("main h1")).toBeVisible();
        expect(await axeSerious(page), `${url} ${p}`).toEqual([]);
      }
    }
    await page.goto("/");
    for (const p of PERSONAS) {
      await setPersona(page, p);
      await expect(page.getByTestId("persona-strip")).toBeVisible();
      expect(await axeSerious(page), `dashboard ${p}`).toEqual([]);
    }
  });

  test("TC-E-178 Analytics and reports work in Arabic with right to left layout @regression", async ({ page }) => {
    await page.goto("/analytics/");
    await setLang(page, "ar");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("التحليلات");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("an-widget-status_mix")).toContainText("حالة الحاويات");
    await page.goto("/reports/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("التقارير");
    await expect(page.getByTestId("rep-table")).toContainText("الحاويات");
    await page.goto("/");
    await expect(page.getByTestId("persona-strip")).toContainText("عرض المشغّل");
  });

  test("TC-E-179 Analytics, reports and every persona dashboard fit a phone without sideways scrolling @regression @ux", async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 390, height: 800 });
    for (const url of ["/analytics/", "/reports/", "/"]) {
      await page.goto(url);
      for (const p of PERSONAS) {
        await setPersona(page, p);
        await expect(page.locator("main h1")).toBeVisible();
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over, `${url} ${p}`).toBeLessThanOrEqual(0);
      }
    }
  });

  test("TC-E-180 Switching persona on a page never leaves another persona's report or widgets behind @negative", async ({ page }) => {
    await page.goto("/reports/");
    await page.getByTestId("rep-pick-sla_perf").click();
    await setPersona(page, "customer");
    await expect(page.getByTestId("rep-view")).toHaveAttribute("data-report", "shipment_status");
    await expect(page.getByTestId("rep-view")).not.toContainText("Priority");
    await page.goto("/analytics/");
    await expect(page.getByTestId("an-widget-sla")).toHaveCount(0);
    await expect(page.getByTestId("an-widget-corridor_load")).toHaveCount(0);
  });
});
