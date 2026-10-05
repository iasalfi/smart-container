import { test, expect } from "@playwright/test";
import { axeSerious, setLang, PAGES } from "./helpers";


test.describe("Accessibility: WCAG 2 A and AA", () => {
  test("TC-E-090 Fleet has no serious or critical accessibility violations @regression @a11y", async ({ page }) => {
    await page.goto(PAGES[0].url); await expect(page.getByTestId("map-dot").first()).toBeAttached();
    expect(await axeSerious(page)).toEqual([]);
  });
  test("TC-E-091 Alerts has no serious or critical accessibility violations @regression @a11y", async ({ page }) => {
    await page.goto(PAGES[1].url); await expect(page.getByTestId("alert-row").first()).toBeVisible();
    expect(await axeSerious(page)).toEqual([]);
  });
  test("TC-E-092 Container detail has no serious or critical accessibility violations @regression @a11y", async ({ page }) => {
    await page.goto(PAGES[2].url); await expect(page.getByTestId("health-gauge")).toBeVisible();
    expect(await axeSerious(page)).toEqual([]);
  });
  test("TC-E-093 Route has no serious or critical accessibility violations @regression @a11y", async ({ page }) => {
    await page.goto(PAGES[3].url); await expect(page.getByTestId("ksa-map")).toBeVisible();
    expect(await axeSerious(page)).toEqual([]);
  });
  test("TC-E-094 Cargo health has no serious or critical accessibility violations @regression @a11y", async ({ page }) => {
    await page.goto(PAGES[4].url); await expect(page.getByTestId("health-gauge").first()).toBeVisible();
    expect(await axeSerious(page)).toEqual([]);
  });
  test("TC-E-095 Replay has no serious or critical accessibility violations @regression @a11y", async ({ page }) => {
    await page.goto(PAGES[5].url); await expect(page.getByTestId("scrubber")).toBeVisible();
    expect(await axeSerious(page)).toEqual([]);
  });
  test("TC-E-096 Modules has no serious or critical accessibility violations @regression @a11y", async ({ page }) => {
    await page.goto(PAGES[6].url); await expect(page.getByTestId("gas-panel")).toBeVisible();
    expect(await axeSerious(page)).toEqual([]);
  });
  test("TC-E-097 Report has no serious or critical accessibility violations @regression @a11y", async ({ page }) => {
    await page.goto(PAGES[7].url); await expect(page.getByTestId("report")).toBeVisible();
    expect(await axeSerious(page)).toEqual([]);
  });
  test("TC-E-098 Admin has no serious or critical accessibility violations @regression @a11y", async ({ page }) => {
    await page.goto(PAGES[8].url); await expect(page.getByTestId("profile-table")).toBeVisible();
    expect(await axeSerious(page)).toEqual([]);
  });
  test("TC-E-099 Fleet in Arabic has no serious or critical accessibility violations @regression @a11y", async ({ page }) => {
    await page.goto("/"); await setLang(page, "ar"); await expect(page.getByTestId("map-dot").first()).toBeAttached();
    expect(await axeSerious(page)).toEqual([]);
  });
});
