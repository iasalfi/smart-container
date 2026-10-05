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
    await openPartners(page);
    await tab(page, "assign");
    await page.getByTestId("af-container").fill("SC-9999");
    await page.getByTestId("af-save").click();
    await expect(page.getByTestId("pp-errors")).toContainText(/container/i);
    await page.getByTestId("af-container").fill("SC-1060");
    await page.getByTestId("af-save").click();
    await expect(page.getByTestId("pp-errors")).toBeVisible();
    await expect(page.getByTestId("detail-driver")).toHaveCount(0);
  });

  test("TC-E-210 A customer cannot open the partner and maintenance pages @negative", async ({ page }) => {
    await page.goto("/");
    await setPersona(page, "customer");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Partners and drivers" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Maintenance" })).toHaveCount(0);
    for (const url of ["/partners/", "/maintenance/"]) {
      await page.goto(url);
      await setPersona(page, "customer");
      await expect(page.getByTestId("not-found")).toContainText("Not available");
    }
  });

  test("TC-E-211 Quality and security can read the partner records but cannot change them @negative", async ({ page }) => {
    for (const p of ["quality", "security"] as const) {
      await page.goto("/partners/");
      await setPersona(page, p);
      await expect(page.getByTestId("pp-readonly")).toBeVisible();
      await expect(page.getByTestId("pp-add-partner")).toHaveCount(0);
      await expect(page.getByTestId("pp-edit-partner")).toHaveCount(0);
      await tab(page, "drivers");
      await expect(page.getByTestId("pp-add-driver")).toHaveCount(0);
      await expect(page.getByTestId("pp-log-event")).toHaveCount(0);
      await tab(page, "assign");
      await expect(page.getByTestId("af-save")).toBeDisabled();
    }
  });

  test("TC-E-212 Admin can remove a partner with no containers but not one that still carries them @negative", async ({ page }) => {
    await page.goto("/admin/");
    await expect(page.getByTestId("admin-registry")).toBeVisible();
    const reg = page.getByTestId("admin-registry");
    await expect(reg.getByTestId("pp-partner-row").first()).toBeVisible();
    await reg.getByTestId("pp-remove-partner").first().click();
    await reg.getByTestId("pp-confirm-remove").click();
    await expect(reg.getByTestId("pp-msg")).toContainText(/still carries/i);
    await expect(reg.getByTestId("pp-partner-row")).toHaveCount(8);
    await reg.getByTestId("pp-add-partner").click();
    await reg.getByTestId("pf-name").fill("Gulf Road Haulage");
    await reg.getByTestId("pf-contact").fill("Omar Said");
    await reg.getByTestId("pf-phone").fill("0501234567");
    await reg.getByTestId("pf-save").click();
    await expect(reg.getByTestId("pp-partner-row")).toHaveCount(9);
    await reg.getByTestId("pp-partner-row").filter({ hasText: "Gulf Road Haulage" }).getByTestId("pp-remove-partner").click();
    await reg.getByTestId("pp-confirm-remove").click();
    await expect(reg.getByTestId("pp-msg")).toContainText(/removed/i);
    await expect(reg.getByTestId("pp-partner-row")).toHaveCount(8);
  });
});

test.describe("Cases and maintenance", () => {
  test("TC-E-213 The alerts page opens on cases, which are fewer than the alarms behind them, and the toggle shows every alarm @regression", async ({ page }) => {
    await page.goto("/alerts/");
    await expect(page.getByTestId("cases-view")).toBeVisible();
    const cases = await page.getByTestId("case-row").count();
    expect(cases).toBeGreaterThan(0);
    expect(cases).toBeLessThan(102);
    await expect(page.getByTestId("cases-count")).toContainText("102");
    expect(await page.getByTestId("case-merged").count()).toBeGreaterThan(0);
    await expect(page.getByTestId("case-row").first().getByTestId("case-prio")).toHaveText(/P[12]/);
    await page.getByTestId("view-alarms").click();
    await expect(page.getByTestId("alert-row")).toHaveCount(102);
    await page.getByTestId("view-cases").click();
    await expect(page.getByTestId("cases-view")).toBeVisible();
  });

  test("TC-E-214 Cases can be searched by container and each one shows how late the response and fix are @regression", async ({ page }) => {
    await page.goto("/alerts/");
    const first = page.getByTestId("case-row").first();
    const cid = (await first.getAttribute("data-container"))!;
    await page.getByTestId("case-search").fill(cid);
    await expect(page.getByTestId("case-row")).toHaveCount(1);
    await page.getByTestId("case-search").fill("SC-0000");
    await expect(page.getByTestId("cases-empty")).toBeVisible();
    await page.getByTestId("case-search").fill("");
    expect(await page.getByTestId("case-resp-breach").count()).toBeGreaterThan(0);
    expect(await page.getByTestId("case-res-breach").count()).toBeGreaterThan(0);
  });

  test("TC-E-215 Taking a case makes you its owner and moves it off the unassigned list, and resolving it closes it @progression", async ({ page }) => {
    await page.goto("/alerts/");
    const row = page.getByTestId("case-row").first();
    const id = (await row.getAttribute("data-id"))!;
    await row.getByTestId("case-take").click();
    const mine = page.locator(`[data-testid="case-row"][data-id="${id}"]`);
    await expect(mine.getByTestId("case-owner")).toContainText("you");
    await expect(mine.getByTestId("case-take")).toHaveCount(0);
    await mine.getByTestId("case-resolve").click();
    await expect(mine).toHaveCount(0);
    await page.getByTestId("case-show-done").check();
    await expect(page.locator(`[data-testid="case-row"][data-id="${id}"]`)).toHaveAttribute("data-state", "resolved");
    await page.getByTestId("view-alarms").click();
    await expect(page.getByTestId("itsm-unassigned")).not.toContainText("102");
  });

  test("TC-E-216 A case that needs a repair opens a work order, which moves across the board and releases the container @progression", async ({ page }) => {
    await page.goto("/alerts/");
    const row = page.getByTestId("case-row").filter({ has: page.getByTestId("case-wo-open") }).first();
    const id = (await row.getAttribute("data-id"))!;
    const cid = (await row.getAttribute("data-container"))!;
    await row.getByTestId("case-wo-open").click();
    const same = page.locator(`[data-testid="case-row"][data-id="${id}"]`);
    await expect(same).toHaveAttribute("data-state", "in_mro");
    await expect(same.getByTestId("case-wo")).toBeVisible();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Maintenance" }).click();
    const card = page.locator(`[data-testid="mt-card"]`).filter({ hasText: cid });
    await expect(card).toHaveCount(1);
    await expect(page.getByTestId("mt-col-triage")).toContainText(cid);
    const stages = ["diagnose", "repair", "test", "ready"];
    for (const s of stages) {
      await card.getByTestId("mt-advance").click();
      await expect(page.getByTestId(`mt-col-${s}`)).toContainText(cid);
    }
    await card.getByTestId("mt-release").click();
    await expect(card).toHaveCount(0);
    await expect(page.getByTestId("mt-k-released")).toContainText("1");
    await page.goto("/alerts/");
    await page.getByTestId("case-show-done").check();
    await expect(page.locator(`[data-testid="case-row"][data-id="${id}"]`)).toHaveAttribute("data-state", "resolved");
  });

  test("TC-E-217 The maintenance board shows example orders in several stages and a list of trackers that need a visit @regression", async ({ page }) => {
    await page.goto("/maintenance/");
    await expect(page.getByTestId("mt-board")).toBeVisible();
    const total = await page.getByTestId("mt-card").count();
    expect(total).toBeGreaterThanOrEqual(3);
    let filled = 0;
    for (const s of ["triage", "diagnose", "repair", "test", "ready"]) if ((await page.getByTestId(`mt-col-${s}`).getByTestId("mt-card").count()) > 0) filled++;
    expect(filled).toBeGreaterThanOrEqual(3);
    await expect(page.getByTestId("mt-k-open")).toContainText(String(total));
    expect(await page.getByTestId("mt-dev-row").count()).toBeGreaterThan(0);
    await expect(page.getByTestId("mt-k-preventive")).toContainText("%");
  });

  test("TC-E-218 A tracker that needs a visit gets a preventive work order once, and the share of preventive work goes up @progression", async ({ page }) => {
    await page.goto("/maintenance/");
    const open = Number((await page.getByTestId("mt-k-open").innerText()).match(/\d+/)![0]);
    const row = page.getByTestId("mt-dev-row").filter({ has: page.getByTestId("mt-raise") }).first();
    const cid = (await row.locator("th a").innerText()).trim();
    await row.getByTestId("mt-raise").click();
    await expect(page.getByTestId("mt-k-open")).toContainText(String(open + 1));
    await expect(page.getByTestId("mt-col-triage").locator(`[data-testid="mt-card"]`).filter({ hasText: cid })).toHaveCount(1);
    await expect(page.getByTestId("mt-dev-row").filter({ hasText: cid }).getByTestId("mt-raise")).toHaveCount(0);
    await expect(page.getByTestId("mt-dev-row").filter({ hasText: cid })).toContainText(/open/i);
  });

  test("TC-E-219 Quality and security can see the board but cannot move orders or raise new ones @negative", async ({ page }) => {
    await page.goto("/maintenance/");
    await setPersona(page, "quality");
    await expect(page.getByTestId("mt-readonly")).toBeVisible();
    await expect(page.getByTestId("mt-advance")).toHaveCount(0);
    await expect(page.getByTestId("mt-raise")).toHaveCount(0);
    await page.goto("/alerts/");
