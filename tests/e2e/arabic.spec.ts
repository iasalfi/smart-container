import { test, expect, type Page } from "@playwright/test";
import { setLang } from "./helpers";

const CODE = /\b(?:SC|CS|TR|DR|WO|FP|EV|TK|TKT|PRB|CHG|INC|SR|API|J)-?\d[\d-]*\b|\b[PL][1-4]\b/g;
const ALLOWED = /\b(?:EN|AR|CSV|PDF|ID|OpenStreetMap|OpenFreeMap|OSRM|SC)\b|Q١٠/g;

async function leftovers(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = w.nextNode())) {
      const el = n.parentElement;
      if (!el || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) continue;
      const s = (n.nodeValue ?? "").trim();
      if (s) out.push(s);
    }
    return out;
  });
}

const PAGES = ["/", "/alerts/", "/analytics/", "/reports/", "/operations/", "/maintenance/", "/partners/", "/admin/", "/container/?id=SC-1060", "/health/?id=SC-1060"];

test.describe("Arabic everywhere", () => {
  test("TC-E-232 @regression @ux in Arabic the main pages show no Western digits or English words", async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem("scm-demo-v1", JSON.stringify({ lang: "ar" })); } catch { /* ignore */ } });
    for (const url of PAGES) {
      await page.goto(url);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", "ar");
      await page.waitForTimeout(1500);
      const bad = (await leftovers(page))
        .map((s) => s.replace(CODE, "").replace(ALLOWED, ""))
        .filter((s) => /[A-Za-z0-9]/.test(s));
      expect(bad, `${url} still has: ${bad.slice(0, 5).join(" | ")}`).toEqual([]);
    }
  });

  test("TC-E-233 @regression @ux switching back to English restores digits and names", async ({ page }) => {
    await page.goto("/partners/");
    await expect(page.getByTestId("pp-partner-row").first()).toBeVisible();
    const en = (await page.locator("main").innerText());
    expect(en).toMatch(/[0-9]/);
    await setLang(page, "ar");
    await expect.poll(async () => /[0-9]/.test((await page.locator("main").innerText()).replace(CODE, ""))).toBe(false);
    expect(await page.locator("main").innerText()).toMatch(/[٠-٩]/);
    await setLang(page, "en");
    await expect.poll(async () => /[٠-٩]/.test(await page.locator("main").innerText())).toBe(false);
    expect(await page.locator("main").innerText()).toMatch(/[0-9]/);
    await expect(page.locator("main")).toContainText("Partners");
  });

  test("TC-E-234 @regression @progression text added while in Arabic is also converted", async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem("scm-demo-v1", JSON.stringify({ lang: "ar" })); } catch { /* ignore */ } });
    await page.goto("/partners/");
    await expect(page.getByTestId("pp-partner-row").first()).toBeVisible();
    await page.getByTestId("pp-tab-drivers").click();
    await expect(page.getByTestId("pp-driver-row").first()).toBeVisible();
    await page.getByTestId("pp-add-driver").click();
    await page.getByTestId("df-name").fill("Test Driver");
    await page.getByTestId("df-phone").fill("0551234567");
    await page.getByTestId("df-licence").fill("1234567890");
    await page.getByTestId("df-save").click();
    await expect(page.getByTestId("pp-driver-row").first()).toBeVisible();
    const txt = (await page.locator("main").innerText()).replace(CODE, "");
    expect(txt).not.toMatch(/[0-9]/);
    expect(txt).toMatch(/[٠-٩]/);
  });
});
