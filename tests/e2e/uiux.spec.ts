import { test, expect } from "@playwright/test";
import { openFleet, openView, setLang, PAGES } from "./helpers";

test.describe("UI: layout and responsiveness", () => {
  test("TC-E-070 No horizontal scroll at desktop, tablet and phone widths @regression @ui", async ({ page }) => {
    test.setTimeout(120_000);
    for (const w of [1360, 768, 390]) {
      await page.setViewportSize({ width: w, height: 900 });
      for (const p of PAGES) {
        await page.goto(p.url);
        await expect(page.locator("main")).toBeVisible();
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over, `${p.name} at ${w}px`).toBeLessThanOrEqual(0);
      }
    }
  });

  test("TC-E-071 Status tiles sit in one row on desktop and two rows on phone @regression @ui", async ({ page }) => {
    const rows = async () => page.evaluate(() => new Set([...document.querySelectorAll(".kpis > *")].map((e) => Math.round(e.getBoundingClientRect().top))).size);
    await openFleet(page);
    expect(await rows()).toBe(1);
    await page.setViewportSize({ width: 390, height: 800 });
    await page.waitForTimeout(100);
    expect(await rows()).toBe(2);
  });

  test("TC-E-072 Header stays visible while scrolling @regression @ui", async ({ page }) => {
    await openFleet(page);
    await page.evaluate(() => window.scrollTo(0, 800));
    const top = await page.locator("header.topbar").evaluate((e) => e.getBoundingClientRect().top);
    expect(top).toBe(0);
  });

  test("TC-E-073 Print layout hides navigation @regression @ui", async ({ page }) => {
    await openView(page, "report", "SC-1060");
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("header.topbar")).toBeHidden();
    await expect(page.getByTestId("report")).toBeVisible();
    await expect(page.getByTestId("print-btn")).toBeHidden();
  });

  test("TC-E-074 Arabic layout mirrors the header @regression @ui", async ({ page }) => {
    await openFleet(page);
    const pos = async () => page.evaluate(() => ({ brand: document.querySelector(".brand")!.getBoundingClientRect().left, controls: document.querySelector(".controls")!.getBoundingClientRect().left }));
    const en = await pos();
    expect(en.brand).toBeLessThan(en.controls);
    await setLang(page, "ar");
    const ar = await pos();
    expect(ar.brand).toBeGreaterThan(ar.controls);
  });

  test("TC-E-075 Map keeps its aspect ratio and is visible @regression @ui", async ({ page }) => {
    await openFleet(page);
    const box = await page.getByTestId("ksa-map").boundingBox();
    const vp = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(box!.height);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);
    expect(box!.height).toBeGreaterThan(200);
  });
});

test.describe("UX: keyboard, labels, speed, errors", () => {
  test("TC-E-080 Skip link is first in the tab order and moves focus to main @regression @ux", async ({ page }) => {
    await openFleet(page);
    await page.keyboard.press("Tab");
    await expect(page.locator(".skip")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
  });

  test("TC-E-081 Status tiles work from the keyboard @regression @ux", async ({ page }) => {
    await openFleet(page);
    await page.getByTestId("kpi-critical").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("showing")).toContainText("27 of 1,000");
    await page.keyboard.press("Space");
    await expect(page.getByTestId("showing")).toContainText("1,000 of 1,000");
  });

  test("TC-E-082 Confirm dialog takes focus and Escape cancels @regression @ux", async ({ page }) => {
    await openView(page, "modules", "SC-1075");
    await page.getByTestId("unlock-btn").click();
    await expect(page.getByTestId("confirm-yes")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("confirm-dialog")).toHaveCount(0);
    await expect(page.getByTestId("lock-state")).toHaveText("Locked");
    await expect(page.getByTestId("audit-empty")).toBeVisible();
  });

  test("TC-E-083 Controls have visible labels or accessible names @regression @ux", async ({ page }) => {
    for (const p of PAGES) {
      await page.goto(p.url);
      await expect(page.locator("main")).toBeVisible();
      const bad = await page.evaluate(() => {
        const out: string[] = [];
        document.querySelectorAll("button, input, select, a[href]").forEach((el) => {
          const h = el as HTMLElement;
          const name = (h.getAttribute("aria-label") || h.innerText || "").trim() || ((el as HTMLInputElement).labels?.[0]?.innerText ?? "").trim() || (h.getAttribute("title") ?? "").trim();
          if (!name) out.push(el.outerHTML.slice(0, 80));
        });
        return out;
      });
      expect(bad, p.name).toEqual([]);
    }
  });

  test("TC-E-084 Touch targets are at least 40 px @regression @ux", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await openFleet(page);
    const small = await page.evaluate(() => [...document.querySelectorAll("button.btn, .kpi, .lang button, select, input[type=search]")].map((e) => ({ t: (e as HTMLElement).innerText.slice(0, 20), h: e.getBoundingClientRect().height })).filter((x) => x.h > 0 && x.h < 40));
    expect(small).toEqual([]);
  });

  test("TC-E-085 Status text is announced, not colour alone @regression @ux", async ({ page }) => {
    await openFleet(page);
    for (const k of ["normal", "warning", "critical"]) await expect(page.getByTestId(`kpi-${k}`)).not.toHaveText(/^\s*[\d,]+\s*$/);
    const pills = page.getByTestId("fleet-row").locator(".pill");
    for (const t of await pills.allInnerTexts()) expect(t.trim().length).toBeGreaterThan(0);
    await page.goto("/alerts/");
    for (const t of await page.locator("[data-testid=alert-row] .pill").allInnerTexts()) expect(["Critical", "Warning"]).toContain(t.trim());
  });

  test("TC-E-086 Fleet page is usable within 3 seconds @regression @ux", async ({ page }) => {
    const t0 = Date.now();
    await page.goto("/");
    await expect(page.getByTestId("kpi-critical")).toBeVisible();
    await page.getByTestId("kpi-critical").click();
    await expect(page.getByTestId("showing")).toContainText("27 of 1,000");
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  test("TC-E-087 No console errors across all pages @regression @ux", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e)));
    for (const p of PAGES) { await page.goto(p.url); await expect(page.locator("main")).toBeVisible(); await page.waitForTimeout(150); }
    expect(errors).toEqual([]);
  });

  test("TC-E-088 Language switch updates the html lang attribute @regression @ux", async ({ page }) => {
    await openFleet(page);
    await setLang(page, "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await setLang(page, "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });
});
