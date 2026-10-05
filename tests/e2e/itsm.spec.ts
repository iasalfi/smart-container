import { test, expect, type Page } from "@playwright/test";
import { axeSerious, setLang, setPersona } from "./helpers";

const firstRow = (page: Page) => page.getByTestId("alert-row").first();
const manage = async (page: Page, row = firstRow(page)) => { await row.getByTestId("manage-btn").click(); await expect(row.getByTestId("ticket-detail")).toBeVisible(); };

test.describe("Alert and alarm management (ITSM)", () => {
  test("TC-E-129 The service level strip shows breaches, risk, unassigned, major incidents and mean times @regression", async ({ page }) => {
    await page.goto("/alerts/?view=alarms");
    for (const k of ["breached", "at-risk", "unassigned", "major", "mtta", "mttr"]) await expect(page.getByTestId(`itsm-${k}`)).toBeVisible();
    await expect(page.getByTestId("itsm-unassigned")).toContainText("102");
    await expect(page.getByTestId("itsm-major")).toContainText("0");
    await expect(page.getByTestId("itsm-mtta")).toContainText("–");
    const breached = Number((await page.getByTestId("itsm-breached").innerText()).match(/\d+/)![0]);
    expect(breached).toBeGreaterThan(0);
  });

  test("TC-E-130 The priority matrix counts every open alert once and a cell filters the queue @regression", async ({ page }) => {
    await page.goto("/alerts/?view=alarms");
    const cells = page.getByTestId("matrix-cell");
    await expect(cells).toHaveCount(9);
    let total = 0;
    for (const t of await cells.allInnerTexts()) total += Number(t.match(/\d+/)![0]);
    expect(total).toBe(102);
    const p1 = cells.first();
    const n = Number((await p1.innerText()).match(/\d+/)![0]);
    await p1.click();
    await expect(page.getByTestId("alert-row")).toHaveCount(n);
    for (const p of await page.getByTestId("alert-row").evaluateAll((els) => els.map((e) => e.getAttribute("data-priority")))) expect(p).toBe("1");
    await p1.click();
    await expect(page.getByTestId("alert-row")).toHaveCount(102);
  });

  test("TC-E-131 Every alert shows a priority badge, response and resolution clocks, a tier and an owner @regression", async ({ page }) => {
    await page.goto("/alerts/?view=alarms");
    const row = firstRow(page);
    await expect(row.getByTestId("prio")).toHaveText("P1");
    await expect(row.getByTestId("sla-response")).toContainText("Respond:");
    await expect(row.getByTestId("sla-resolution")).toContainText("Resolve:");
    await expect(row.getByTestId("tier")).toHaveText(/^L[123]$/);
    await expect(row.getByTestId("owner")).toHaveText("Unassigned");
    await expect(row.getByTestId("kind")).toHaveText(/Alarm|Event/);
    const rows = page.getByTestId("alert-row");
    await expect(rows.getByTestId("prio")).toHaveCount(102);
    await expect(rows.getByTestId("sla-response")).toHaveCount(102);
  });

  test("TC-E-132 Acknowledging stops the response clock and keeps the resolution clock running @progression", async ({ page }) => {
    await page.goto("/alerts/?view=alarms");
    const row = firstRow(page);
    await expect(row.getByTestId("sla-response")).toContainText("breached");
    await row.getByTestId("ack-btn").click();
    await expect(row.getByTestId("sla-response")).toContainText("met late");
    await expect(row.getByTestId("sla-resolution")).toContainText(/breached|left/);
  });

  test("TC-E-133 A ticket goes through acknowledge, start, resolve with a code and close, and the timeline records each step @progression", async ({ page }) => {
    await page.goto("/alerts/?view=alarms");
    const row = firstRow(page);
    await row.getByTestId("ack-btn").click();
    await manage(page, row);
    await row.getByTestId("start-btn").click();
    await expect(row.getByTestId("alert-state")).toHaveText("In progress");
    await row.getByTestId("resolution-code").selectOption("false_alarm");
    await row.getByTestId("resolve-btn").click();
    await expect(row.getByTestId("alert-state")).toHaveText("Resolved");
    await expect(row.getByTestId("resolution-shown")).toContainText("False alarm");
    await row.getByTestId("close-btn").click();
    await expect(row.getByTestId("alert-state")).toHaveText("Closed");
    await expect(row.getByTestId("ticket-log").locator("li")).toHaveCount(4);
    await expect(row.getByTestId("ticket-log")).toContainText("Work started");
    await expect(page.getByTestId("flow-closed")).toContainText("1");
  });

  test("TC-E-134 Assigning an owner moves the ticket from Unassigned into My queue @progression", async ({ page }) => {
    await page.goto("/alerts/?view=alarms");
    await expect(page.getByTestId("queue-unassigned")).toContainText("102");
    await manage(page);
    await firstRow(page).getByTestId("owner-select").selectOption("me");
    await expect(firstRow(page).getByTestId("owner")).toHaveText("You (service desk)");
    await expect(page.getByTestId("queue-mine")).toContainText("1");
    await expect(page.getByTestId("queue-unassigned")).toContainText("101");
    await page.getByTestId("queue-mine").click();
    await expect(page.getByTestId("alert-row")).toHaveCount(1);
  });

  test("TC-E-135 Escalating lifts the tier and declaring a major incident moves the ticket to the duty manager @progression", async ({ page }) => {
    await page.goto("/alerts/?view=alarms");
    const row = page.locator('[data-testid="alert-row"][data-priority="4"]').first();
    await expect(row.getByTestId("tier")).toHaveText("L1");
    await manage(page, row);
    await row.getByTestId("escalate-btn").click();
    await expect(row.getByTestId("tier")).toHaveText("L2");
    await row.getByTestId("major-btn").click();
    await expect(row.getByTestId("tier")).toHaveText("L3");
    await expect(row.getByTestId("major-flag")).toBeVisible();
    await expect(row.getByTestId("escalate-btn")).toBeDisabled();
    await expect(page.getByTestId("itsm-major")).toContainText("1");
    await page.getByTestId("queue-major").click();
    await expect(page.getByTestId("alert-row")).toHaveCount(1);
  });

  test("TC-E-136 A note added to a ticket appears in its timeline @progression", async ({ page }) => {
    await page.goto("/alerts/?view=alarms");
    const row = firstRow(page);
    await manage(page, row);
    await row.getByTestId("note-input").fill("Driver called, truck is at the depot");
    await row.getByTestId("note-btn").click();
    await expect(row.getByTestId("ticket-log")).toContainText("Driver called, truck is at the depot");
    await expect(row.getByTestId("note-input")).toHaveValue("");
  });

  test("TC-E-137 Recurring alerts become problem candidates and raising one links the alerts to a problem record @progression", async ({ page }) => {
    await page.goto("/alerts/?view=alarms");
    const cands = page.getByTestId("problem-candidate");
    await expect(cands.first()).toBeVisible();
    const before = await cands.count();
    expect(before).toBeGreaterThan(0);
    await cands.first().getByTestId("cause-select").selectOption("sensor_fault");
    await cands.first().getByTestId("raise-problem").click();
    await expect(page.getByTestId("problem-record")).toHaveCount(1);
    await expect(page.getByTestId("problem-record")).toContainText("PRB-001");
    await expect(page.getByTestId("problem-flag").first()).toHaveText("PRB-001");
    await page.reload();
    await expect(page.getByTestId("problem-record")).toHaveCount(1);
    await page.getByTestId("problem-status").selectOption("known_error");
    await expect(page.getByTestId("problem-status")).toHaveValue("known_error");
  });

  test("TC-E-138 Resolve and Close stay disabled until the earlier steps are done @negative", async ({ page }) => {
    await page.goto("/alerts/?view=alarms");
    const row = firstRow(page);
    await manage(page, row);
    await expect(row.getByTestId("close-btn")).toBeDisabled();
    await expect(row.getByTestId("start-btn")).toBeDisabled();
    await expect(row.getByTestId("resolve-btn")).toBeDisabled();
    await row.getByTestId("ack-btn").click();
    await expect(row.getByTestId("close-btn")).toBeDisabled();
    await expect(row.getByTestId("start-btn")).toBeEnabled();
    await expect(row.getByTestId("resolve-btn")).toBeEnabled();
  });

  test("TC-E-139 A blank note cannot be added @negative", async ({ page }) => {
    await page.goto("/alerts/?view=alarms");
    const row = firstRow(page);
    await manage(page, row);
    await expect(row.getByTestId("note-btn")).toBeDisabled();
    await row.getByTestId("note-input").fill("   ");
    await expect(row.getByTestId("note-btn")).toBeDisabled();
    await expect(row.getByTestId("ticket-log")).toContainText("No actions yet");
  });

  test("TC-E-140 The customer view has no service desk panels and no action buttons @negative", async ({ page }) => {
    await page.goto("/alerts/?view=alarms");
    await setPersona(page, "customer");
    await expect(page.getByTestId("alerts-summary")).toBeVisible();
    await expect(page.getByTestId("itsm-kpis")).toHaveCount(0);
    await expect(page.getByTestId("priority-matrix")).toHaveCount(0);
    await expect(page.getByTestId("problems")).toHaveCount(0);
    await expect(page.getByTestId("ack-btn")).toHaveCount(0);
    await expect(page.getByTestId("manage-btn")).toHaveCount(0);
  });

  test("TC-E-141 The lifecycle and tier tiles count the tickets and filter the list @regression", async ({ page }) => {
    await page.goto("/alerts/?view=alarms");
    await expect(page.getByTestId("flow-open")).toContainText("102");
    for (const s of ["acknowledged", "in_progress", "resolved", "closed"]) await expect(page.getByTestId(`flow-${s}`)).toContainText("0");
    const n = Number((await page.getByTestId("tier-3").locator("i").innerText()).trim());
    expect(n).toBeGreaterThan(0);
    await page.getByTestId("tier-3").click();
    await expect(page.getByTestId("alert-row")).toHaveCount(n);
    await page.getByTestId("tier-3").click();
    await page.getByTestId("flow-open").click();
    await expect(page.getByTestId("alert-row")).toHaveCount(102);
    await page.getByTestId("alerts-clear").click();
    await expect(page.getByTestId("alerts-count")).toContainText("102 alerts");
  });

  test("TC-E-142 Owner, notes and state survive a reload @progression", async ({ page }) => {
    await page.goto("/alerts/?view=alarms");
    const id = (await firstRow(page).innerText()).match(/SC-\d{4}/)![0];
    await manage(page);
    await firstRow(page).getByTestId("owner-select").selectOption("l2-a");
    await firstRow(page).getByTestId("ack-btn").click();
    await page.reload();
    await page.getByTestId("alert-search").fill(id);
    const row = page.getByTestId("alert-row").first();
    await expect(row.getByTestId("owner")).toHaveText("Sultan Al-Dossari");
    await expect(row.getByTestId("alert-state")).toHaveText("Acknowledged");
    await manage(page, row);
    await expect(row.getByTestId("ticket-log")).toContainText("Assigned to Sultan Al-Dossari");
  });

  test("TC-E-143 The alert and alarm page with an open ticket has no serious accessibility violations @regression @a11y", async ({ page }) => {
    await page.goto("/alerts/?view=alarms");
    await manage(page);
    expect(await axeSerious(page)).toEqual([]);
  });

  test("TC-E-144 The alert and alarm page works in Arabic with the service level strip and queues @regression", async ({ page }) => {
    await page.goto("/alerts/?view=alarms");
    await setLang(page, "ar");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("إدارة التنبيهات والإنذارات");
    await expect(page.getByTestId("itsm-kpis")).toContainText("غير مسندة");
    await expect(page.getByTestId("queue-mine")).toContainText("طابوري");
    await expect(firstRow(page).getByTestId("sla-response")).toContainText("الاستجابة");
    expect(await axeSerious(page)).toEqual([]);
  });

  test("TC-E-145 The alert and alarm page fits a phone without sideways scrolling @regression @ux", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/alerts/?view=alarms");
    await expect(firstRow(page)).toBeVisible();
    await manage(page);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
  });
});
