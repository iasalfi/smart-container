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
    await expect(page.getByTestId("mt-card").first()).toBeVisible();
    await expect(page.getByTestId("mt-dev-row").first()).toBeVisible();
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
    await expect(page.getByTestId("mt-card").first()).toBeVisible();
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
    await setPersona(page, "security");
    await expect(page.getByTestId("case-take")).toHaveCount(0);
    await expect(page.getByTestId("case-wo-open")).toHaveCount(0);
  });

  test("TC-E-220 Admin can change the tracker triggers, the maintenance list follows, and bad values are refused @progression", async ({ page }) => {
    await page.goto("/maintenance/");
    await expect(page.getByTestId("mt-card").first()).toBeVisible();
    const before = Number((await page.getByTestId("mt-k-devices").innerText()).match(/\d+/)![0]);
    await page.goto("/admin/");
    await page.getByTestId("lim-battery").fill("0");
    await page.getByTestId("lim-save").click();
    await expect(page.getByTestId("lim-msg")).toContainText(/whole numbers/i);
    await page.getByTestId("lim-battery").fill("60");
    await page.getByTestId("lim-save").click();
    await expect(page.getByTestId("lim-msg")).toContainText(/saved/i);
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Maintenance" }).click();
    const after = await page.getByTestId("mt-k-devices").innerText();
    expect(Number(after.match(/\d+/)![0])).toBeGreaterThan(before);
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Settings" }).click();
    await page.getByTestId("lim-reset").click();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Maintenance" }).click();
    await expect(page.getByTestId("mt-k-devices")).toContainText(String(before));
  });

  test("TC-E-221 The control tower lists the cases that need you now and links to all of them @regression", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("panel-alerts")).toContainText("Needs you now");
    const n = await page.getByTestId("needs-row").count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(6);
    await expect(page.getByTestId("needs-sub")).toContainText("102");
    await page.getByTestId("needs-all").click();
    await expect(page).toHaveURL(/\/alerts\/$/);
    await expect(page.getByTestId("cases-view")).toBeVisible();
  });
});

test.describe("Lifecycle, analytics and reports for people", () => {
  test("TC-E-222 A container shows six lifecycle stages with the current one marked, and its driver and carrier @regression", async ({ page }) => {
    await page.goto("/container/?id=SC-1060");
    const spine = page.getByTestId("lifecycle-spine");
    await expect(spine).toBeVisible();
    await expect(spine.locator("li")).toHaveCount(6);
    await expect(spine).toHaveAttribute("data-stage", "in_transit");
    await expect(spine.locator('li[aria-current="step"]')).toHaveCount(1);
    await expect(page.getByTestId("lc-in_transit")).toHaveAttribute("aria-current", "step");
    await expect(page.getByTestId("detail-driver")).toHaveText("Abdullah Al-Asmari");
    await expect(page.getByTestId("detail-partner")).toHaveText("Hail Cold Chain Carriers");
    await expect(page.getByTestId("lc-next")).toHaveCount(0);
  });

  test("TC-E-223 A delivered container can be marked unloaded and returned to service, and the stage follows @progression", async ({ page }) => {
    await page.goto("/container/?id=SC-1100");
    await expect(page.getByTestId("lifecycle-spine")).toHaveAttribute("data-stage", "at_destination");
    await page.getByTestId("lc-next").click();
    await expect(page.getByTestId("lifecycle-spine")).toHaveAttribute("data-stage", "unloaded_inspected");
    await page.getByTestId("lc-next").click();
    await expect(page.getByTestId("lifecycle-spine")).toHaveAttribute("data-stage", "back_in_service");
    await expect(page.getByTestId("lc-next")).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("lifecycle-spine")).toHaveAttribute("data-stage", "back_in_service");
  });

  test("TC-E-224 A container in repair shows the maintenance branch on its lifecycle @regression", async ({ page }) => {
    await page.goto("/maintenance/");
    const cid = (await page.getByTestId("mt-card").first().locator("a").innerText()).trim();
    await page.goto(`/container/?id=${cid}`);
    await expect(page.getByTestId("lc-branch")).toContainText("WO-");
  });

  test("TC-E-225 Every persona sees the carrier and driver scores, and each gets its own people widgets @regression", async ({ page }) => {
    await page.goto("/analytics/");
    const widgets: Record<string, string[]> = {
      operator: ["partner_league", "driver_risk", "licence_expiry", "mro_board", "device_health"],
      quality: ["partner_league"],
      security: ["driver_risk", "driver_events", "driver_top_risk"],
      customer: ["partner_share"],
    };
    for (const p of ["operator", "quality", "security", "customer"] as const) {
      await setPersona(page, p);
      await expect(page.getByTestId("an-kpi-x_carrier")).toBeVisible();
      await expect(page.getByTestId("an-kpi-x_driver")).toBeVisible();
      for (const w of widgets[p]) await expect(page.getByTestId(`an-widget-${w}`)).toBeVisible();
    }
    await setPersona(page, "operator");
    await expect(page.getByTestId("an-kpi-o_unowned")).toContainText("min");
    await expect(page.getByTestId("an-widget-partner_league")).toContainText("Najd Haulage Co");
    await setPersona(page, "quality");
    await expect(page.getByTestId("an-kpi-q_oob")).toContainText("min");
  });

  test("TC-E-226 The value table lists six levers and reads its baselines from the live data @regression", async ({ page }) => {
    await page.goto("/analytics/");
    await expect(page.getByTestId("value-row")).toHaveCount(6);
    await expect(page.getByTestId("value-base-1")).toContainText(/\d+ of \d+ cases have no owner/);
    const levers = await page.getByTestId("value-base-6").innerText();
    const carrier = Number(levers.match(/Carrier score (\d+)/)![1]);
    expect(Number((await page.getByTestId("an-kpi-x_carrier").innerText()).match(/\d+/)![0])).toBe(carrier);
    await expect(page.getByTestId("value-row").first()).toContainText("P1 within 10 min");
    await setPersona(page, "customer");
    await expect(page.getByTestId("value-levers")).toHaveCount(0);
  });

  test("TC-E-227 The partner and driver scorecard reports list real rows and the risk column is translated @regression", async ({ page }) => {
    await page.goto("/reports/");
    await page.getByTestId("rep-pick-partner_scorecard").click();
    await expect(page.getByTestId("rep-row")).toHaveCount(8);
    await expect(page.getByTestId("rep-table")).toContainText("Najd Haulage Co");
    await page.getByTestId("rep-pick-driver_scorecard").click();
    await expect(page.getByTestId("rep-count")).toContainText("100");
    await expect(page.getByTestId("rep-row")).toHaveCount(25);
    await expect(page.getByTestId("rep-table")).toContainText(/High risk|Watch|Good/);
    await setPersona(page, "customer");
    await expect(page.getByTestId("rep-pick-driver_scorecard")).toHaveCount(0);
    await expect(page.getByTestId("rep-pick-partner_scorecard")).toBeVisible();
  });

  test("TC-E-228 A driver added by an operator shows up in the driver scorecard totals of the registry @progression", async ({ page }) => {
    await openPartners(page);
    await addPartner(page, { name: "Gulf Road Haulage" });
    await tab(page, "drivers");
    await addDriver(page, { name: "Faisal Otaibi", licence: "1999999999", partner: "Gulf Road Haulage" });
    await page.goto("/analytics/");
    await expect(page.getByTestId("an-widget-partner_league")).toBeVisible();
    await page.goto("/partners/");
    await expect(page.getByTestId("pp-partner-row").filter({ hasText: "Gulf Road Haulage" })).toContainText("1");
  });

  test("TC-E-229 The people pages, cases and the board work in Arabic and read right to left @regression", async ({ page }) => {
    await page.goto("/partners/");
    await setLang(page, "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("pp-partner-table")).toContainText("الشريك");
    await tab(page, "drivers");
    await expect(page.getByTestId("pp-driver-table")).toContainText("السائق");
    await page.goto("/alerts/");
    await expect(page.getByTestId("cases-view")).toContainText("حالة");
    await page.goto("/maintenance/");
    await expect(page.getByTestId("mt-board")).toContainText("الفرز");
    await page.goto("/container/?id=SC-1060");
    await expect(page.getByTestId("lifecycle-spine")).toContainText("في الطريق");
  });

  test("TC-E-230 The new pages have no serious or critical accessibility violations @regression @a11y", async ({ page }) => {
    for (const url of ["/partners/", "/maintenance/", "/alerts/", "/analytics/", "/container/?id=SC-1060"]) {
      await page.goto(url);
      await expect(page.locator("main")).toBeVisible();
      await page.waitForTimeout(500);
      expect(await axeSerious(page), url).toEqual([]);
    }
    await page.goto("/partners/");
    await tab(page, "drivers");
    await page.getByTestId("pp-add-driver").click();
    expect(await axeSerious(page)).toEqual([]);
  });

  test("TC-E-231 The new pages fit a phone without sideways scrolling @regression @ux", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    for (const url of ["/partners/", "/maintenance/", "/alerts/", "/analytics/", "/container/?id=SC-1060"]) {
      await page.goto(url);
      await expect(page.locator("main")).toBeVisible();
      await page.waitForTimeout(400);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, url).toBeLessThanOrEqual(1);
    }
  });
});
