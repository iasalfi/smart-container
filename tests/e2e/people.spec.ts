import { test, expect, type Page } from "@playwright/test";
import { axeSerious, setLang, setPersona } from "./helpers";

const openPartners = async (page: Page) => { await page.goto("/partners/"); await expect(page.getByTestId("people-manager")).toBeVisible(); await expect(page.getByTestId("pp-partner-row").first()).toBeVisible(); };
const tab = async (page: Page, k: "partners" | "drivers" | "assign") => { await page.getByTestId(`pp-tab-${k}`).click(); };

async function addPartner(page: Page, o: { name: string; contact?: string; phone?: string; trucks?: string; reefers?: string }) {
  await page.getByTestId("pp-add-partner").click();
  await page.getByTestId("pf-name").fill(o.name);
  await page.getByTestId("pf-contact").fill(o.contact ?? "Omar Said");
  await page.getByTestId("pf-phone").fill(o.phone ?? "0501234567");
  if (o.trucks !== undefined) await page.getByTestId("pf-trucks").fill(o.trucks);
  if (o.reefers !== undefined) await page.getByTestId("pf-reefers").fill(o.reefers);
  await page.getByTestId("pf-save").click();
}

async function addDriver(page: Page, o: { name: string; licence: string; phone?: string; partner?: string }) {
  await page.getByTestId("pp-add-driver").click();
  await page.getByTestId("df-name").fill(o.name);
  if (o.partner) await page.getByTestId("df-partner").selectOption({ label: o.partner });
  await page.getByTestId("df-phone").fill(o.phone ?? "0551234567");
  await page.getByTestId("df-licence").fill(o.licence);
  await page.getByTestId("df-save").click();
}

test.describe("Freight partners and drivers", () => {
  test("TC-E-199 The partners page lists the 8 freight companies with a grade and the containers each carries @regression", async ({ page }) => {
    await openPartners(page);
    await expect(page.getByTestId("pp-partner-row")).toHaveCount(8);
    await expect(page.getByTestId("pp-partner-count")).toContainText("8");
    const rows = await page.getByTestId("pp-partner-row").allInnerTexts();
    expect(rows.some((r) => /Hail Cold Chain Carriers/.test(r) && /Probation/i.test(r))).toBe(true);
    const grades = await page.locator(".grade").allInnerTexts();
    expect(grades.length).toBe(8);
    expect(new Set(grades).size).toBeGreaterThanOrEqual(2);
    await page.getByTestId("pp-partner-status-filter").selectOption("probation");
    await expect(page.getByTestId("pp-partner-row")).toHaveCount(2);
  });

  test("TC-E-200 An operator adds a partner, sees it in the table, and it is still there after a reload @progression", async ({ page }) => {
    await openPartners(page);
    await addPartner(page, { name: "Gulf Road Haulage" });
    await expect(page.getByTestId("pp-msg")).toContainText("Gulf Road Haulage");
    await expect(page.getByTestId("pp-partner-row")).toHaveCount(9);
    await expect(page.getByTestId("pp-partner-form")).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("pp-partner-row")).toHaveCount(9);
    await expect(page.getByTestId("pp-partner-table")).toContainText("Gulf Road Haulage");
  });

  test("TC-E-201 A partner with bad details is refused with a message for each problem and nothing is saved @negative", async ({ page }) => {
    await openPartners(page);
    await addPartner(page, { name: "ab", contact: "x", phone: "12345", trucks: "0", reefers: "9" });
    const errs = page.getByTestId("pp-errors");
    await expect(errs).toBeVisible();
    await expect(errs.locator("li")).toHaveCount(5);
    await expect(errs).toContainText("Phone");
    await expect(page.getByTestId("pp-partner-row")).toHaveCount(8);
    await page.getByTestId("pf-name").fill("Gulf Road Haulage");
    await page.getByTestId("pf-contact").fill("Omar Said");
    await page.getByTestId("pf-phone").fill("0501234567");
    await page.getByTestId("pf-trucks").fill("20");
    await page.getByTestId("pf-reefers").fill("21");
    await page.getByTestId("pf-save").click();
    await expect(errs.locator("li")).toHaveCount(1);
    await expect(page.getByTestId("pp-partner-row")).toHaveCount(8);
  });

  test("TC-E-202 A partner name that already exists is refused, whatever the letter case @negative", async ({ page }) => {
    await openPartners(page);
    await addPartner(page, { name: "najd haulage co" });
    await expect(page.getByTestId("pp-errors")).toContainText(/already/i);
    await expect(page.getByTestId("pp-partner-row")).toHaveCount(8);
  });

  test("TC-E-203 An operator edits a partner and the change shows at once @progression", async ({ page }) => {
    await openPartners(page);
    await page.getByTestId("pp-partner-row").first().getByTestId("pp-edit-partner").click();
    await page.getByTestId("pf-status").selectOption("suspended");
    await page.getByTestId("pf-save").click();
    await expect(page.getByTestId("pp-partner-row").filter({ hasText: "Suspended" })).toHaveCount(1);
    await page.getByTestId("pp-partner-status-filter").selectOption("suspended");
    await expect(page.getByTestId("pp-partner-row")).toHaveCount(1);
  });

  test("TC-E-204 The drivers tab lists 320 drivers, filters by partner and risk, and pages through them @regression", async ({ page }) => {
    await openPartners(page);
    await tab(page, "drivers");
    await expect(page.getByTestId("pp-driver-count")).toContainText("320");
    await expect(page.getByTestId("pp-driver-row")).toHaveCount(25);
    await page.getByTestId("pp-driver-more").click();
    await expect(page.getByTestId("pp-driver-row")).toHaveCount(50);
    await page.getByTestId("pp-driver-partner-filter").selectOption({ label: "Tabuk Road Carriers" });
    await expect(page.getByTestId("pp-driver-count")).toContainText("40");
    await page.getByTestId("pp-driver-risk-filter").selectOption("high");
    const n = Number((await page.getByTestId("pp-driver-count").innerText()).match(/\d+/)![0]);
    expect(n).toBeLessThan(40);
    const rows = await page.getByTestId("pp-driver-row").allInnerTexts();
    expect(rows.every((r) => /High risk/i.test(r))).toBe(true);
  });

  test("TC-E-205 An operator adds a driver and the licence number must be new @progression", async ({ page }) => {
    await openPartners(page);
    await tab(page, "drivers");
    await addDriver(page, { name: "Faisal Otaibi", licence: "1999999999", partner: "Najd Haulage Co" });
    await expect(page.getByTestId("pp-msg")).toContainText("Faisal Otaibi");
    await expect(page.getByTestId("pp-driver-count")).toContainText("321");
    await page.getByTestId("pp-driver-q").fill("Faisal Otaibi");
    await expect(page.getByTestId("pp-driver-row")).toHaveCount(1);
    await expect(page.getByTestId("pp-driver-row")).toContainText("100");
  });

  test("TC-E-206 A driver with a bad phone, a short licence number or a taken licence number is refused @negative", async ({ page }) => {
    await openPartners(page);
    await tab(page, "drivers");
    await addDriver(page, { name: "Ma", licence: "123", phone: "999" });
    await expect(page.getByTestId("pp-errors").locator("li")).toHaveCount(3);
    await expect(page.getByTestId("pp-driver-count")).toContainText("320");
    await addDriver(page, { name: "Faisal Otaibi", licence: "1999999999" });
    await expect(page.getByTestId("pp-driver-count")).toContainText("321");
    await addDriver(page, { name: "Khalid Harbi", licence: "1999999999" });
    await expect(page.getByTestId("pp-errors")).toContainText(/already/i);
    await expect(page.getByTestId("pp-driver-count")).toContainText("321");
  });

  test("TC-E-207 Logging a driver event lowers the safety score by the event's points and a future date is refused @progression", async ({ page }) => {
    await openPartners(page);
    await tab(page, "drivers");
    await page.getByTestId("pp-driver-q").fill("DR-1001");
    const row = page.getByTestId("pp-driver-row").first();
    const before = Number((await row.locator(".risk b").innerText()).trim());
    await row.getByTestId("pp-log-event").click();
    await page.getByTestId("ef-type").selectOption("rest_breach");
    await page.getByTestId("ef-date").fill("2026-12-01");
    await page.getByTestId("ef-save").click();
    await expect(page.getByTestId("pp-errors")).toContainText(/future/i);
    await page.getByTestId("ef-date").fill("2026-10-05");
    await page.getByTestId("ef-save").click();
    await expect(page.getByTestId("pp-event-form")).toHaveCount(0);
    await page.getByTestId("pp-driver-q").fill("DR-1001");
    const after = Number((await page.getByTestId("pp-driver-row").first().locator(".risk b").innerText()).trim());
    expect(after).toBe(Math.max(0, before - 8));
  });

  test("TC-E-208 Assigning a driver to a container shows the new driver on the container page @progression", async ({ page }) => {
    await openPartners(page);
    await tab(page, "assign");
    await page.getByTestId("af-container").fill("SC-1060");
    await expect(page.getByTestId("af-current")).toContainText("Abdullah Al-Asmari");
    await page.getByTestId("af-partner").selectOption({ label: "Madinah Cargo Movers" });
    await page.getByTestId("af-driver").selectOption({ index: 1 });
    const name = (await page.getByTestId("af-driver").locator("option:checked").innerText()).split(" · ")[0];
    await page.getByTestId("af-save").click();
    await expect(page.getByTestId("pp-msg")).toContainText("SC-1060");
    await page.goto("/container/?id=SC-1060");
    await expect(page.getByTestId("detail-driver")).toHaveText(name);
    await expect(page.getByTestId("detail-partner")).toHaveText("Madinah Cargo Movers");
    await expect(page.getByTestId("head-people")).toContainText(name);
  });

  test("TC-E-209 Assigning to a container that does not exist, or with no driver chosen, is refused @negative", async ({ page }) => {
