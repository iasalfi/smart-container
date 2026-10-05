import { test, expect } from "@playwright/test";
import { openFleet, setLang, setPersona, axeSerious } from "./helpers";

test.describe("Landing page and dashboard", () => {
  test("TC-E-108 Landing hero shows the headline, four live figures and three actions @progression", async ({ page }) => {
    await openFleet(page);
    const hero = page.getByTestId("hero");
    await expect(hero).toContainText("See every container, every kilometre, every degree.");
    for (const k of ["moving", "alerts", "health", "reefer"]) await expect(page.getByTestId(`hero-stat-${k}`)).toBeVisible();
    await expect(page.getByTestId("hero-explore")).toBeVisible();
    await expect(page.getByTestId("hero-critical")).toBeVisible();
    await expect(page.getByTestId("hero-tour")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test("TC-E-109 Review critical containers filters the fleet to the 27 critical ones @progression", async ({ page }) => {
    await openFleet(page);
    await page.getByTestId("hero-critical").click();
    await expect(page.getByTestId("showing")).toContainText("27 of 1,000");
    await expect(page.getByTestId("kpi-critical")).toHaveAttribute("aria-pressed", "true");
  });

  test("TC-E-110 The quick tour steps through five screens and finishes @progression", async ({ page }) => {
    await openFleet(page);
    await page.getByTestId("hero-tour").click();
    const tour = page.getByTestId("tour");
    await expect(tour).toBeVisible();
    await expect(tour).toContainText("Step 1 of 5");
    for (let i = 2; i <= 5; i++) { await tour.getByRole("button", { name: "Next" }).click(); await expect(tour).toContainText(`Step ${i} of 5`); }
    await tour.getByRole("button", { name: "Finish" }).click();
    await expect(tour).toHaveCount(0);
  });

  test("TC-E-111 Closing the tour with Escape or the backdrop leaves the dashboard unchanged @negative", async ({ page }) => {
    await openFleet(page);
    await page.getByTestId("hero-tour").click();
    await expect(page.getByTestId("tour")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("tour")).toHaveCount(0);
    await page.getByTestId("hero-tour").click();
    await page.getByTestId("tour-backdrop").click({ position: { x: 5, y: 5 } });
    await expect(page.getByTestId("tour")).toHaveCount(0);
    await expect(page.getByTestId("showing")).toContainText("1,000 of 1,000");
  });

  test("TC-E-112 The status tiles filter the fleet and toggle back @progression", async ({ page }) => {
    await openFleet(page);
    await page.getByTestId("kpi-critical").click();
    await expect(page.getByTestId("showing")).toContainText("27 of 1,000");
    await page.getByTestId("kpi-critical").click();
    await expect(page.getByTestId("showing")).toContainText("1,000 of 1,000");
  });

  test("TC-E-113 The cargo chart filters by cargo type @progression", async ({ page }) => {
    await openFleet(page);
    await page.getByTestId("ins-cargo-dairy").click();
    await expect(page.getByTestId("showing")).toContainText("158 of 1,000");
    await expect(page.getByTestId("cargo-filter")).toHaveValue("dairy");
  });

  test("TC-E-114 A corridor bar filters the fleet and its chip clears the filter @progression", async ({ page }) => {
    await openFleet(page);
    await page.getByTestId("ins-corridor").first().click();
    await expect(page.getByTestId("corridor-chip")).toBeVisible();
    const text = (await page.getByTestId("showing").innerText()).match(/(\d[\d,]*) of 1,000/)!;
    expect(Number(text[1].replace(/,/g, ""))).toBeLessThan(1000);
    await page.getByTestId("corridor-chip").click();
    await expect(page.getByTestId("corridor-chip")).toHaveCount(0);
    await expect(page.getByTestId("showing")).toContainText("1,000 of 1,000");
  });

  test("TC-E-115 Table headers sort ascending, descending, then back to the original order @progression", async ({ page }) => {
    await openFleet(page);
    const health = async () => (await page.getByTestId("fleet-row").evaluateAll((rows) => rows.map((r) => Number((r.querySelectorAll("td")[4] as HTMLElement).innerText.trim().split(/\s+/)[0]))));
    const original = await health();
    await page.getByTestId("sort-health").click();
    const asc = await health();
    expect([...asc].sort((a, b) => a - b)).toEqual(asc);
    await page.getByTestId("sort-health").click();
    const desc = await health();
    expect([...desc].sort((a, b) => b - a)).toEqual(desc);
    await page.getByTestId("sort-health").click();
    expect(await health()).toEqual(original);
  });

  test("TC-E-116 Show 12 more extends the table and Show fewer returns to 12 rows @progression", async ({ page }) => {
    await openFleet(page);
    await expect(page.getByTestId("fleet-row")).toHaveCount(12);
    await page.getByTestId("show-more").click();
    await expect(page.getByTestId("fleet-row")).toHaveCount(24);
    await page.getByTestId("show-fewer").click();
    await expect(page.getByTestId("fleet-row")).toHaveCount(12);
  });

  test("TC-E-117 Hovering a map dot shows a tooltip with the container ID @progression", async ({ page }) => {
    await openFleet(page);
    await page.getByTestId("kpi-critical").click();
    await page.getByTestId("map-dot").first().hover({ force: true });
    await expect(page.getByTestId("map-tip")).toBeVisible();
    await expect(page.getByTestId("map-tip")).toContainText(/SC-\d{4}/);
  });

  test("TC-E-118 Critical containers pulse on the map @progression", async ({ page }) => {
    await openFleet(page);
    const rings = await page.locator(".pulse-ring").count();
    expect(rings).toBeGreaterThan(0);
    expect(rings).toBeLessThanOrEqual(27);
    await page.getByTestId("kpi-normal").click();
    await expect(page.locator(".pulse-ring")).toHaveCount(0);
  });

  test("TC-E-119 The alerts page opens with a summary of open, critical, warning and handled alerts @progression", async ({ page }) => {
    await page.goto("/alerts/");
    const sum = page.getByTestId("alerts-summary");
    await expect(sum).toBeVisible();
    await expect(sum).toContainText("102");
    await expect(sum.locator(".sum")).toHaveCount(4);
  });

  test("TC-E-120 Landing page and the quick tour have no serious accessibility violations @regression @a11y", async ({ page }) => {
    await openFleet(page);
    expect(await axeSerious(page)).toEqual([]);
    await page.getByTestId("hero-tour").click();
    await expect(page.getByTestId("tour")).toBeVisible();
    expect(await axeSerious(page)).toEqual([]);
  });

  test("TC-E-121 The landing hero switches to Arabic and right to left @progression", async ({ page }) => {
    await openFleet(page);
    await setLang(page, "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("hero")).toContainText("شاهد كل حاوية");
    await expect(page.getByTestId("hero-tour")).toContainText("جولة");
  });

  test("TC-E-122 The hero stacks into one column on a phone @regression @ui", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await openFleet(page);
    const [copy, stats] = await Promise.all([page.locator(".hero-copy").boundingBox(), page.locator(".hero-stats").boundingBox()]);
    expect(stats!.y).toBeGreaterThanOrEqual(copy!.y + copy!.height - 1);
  });

  test("TC-E-123 The customer view scopes the hero figures to that customer @negative", async ({ page }) => {
    await openFleet(page);
    await setPersona(page, "customer");
    await expect(page.getByTestId("hero")).not.toContainText("1,000 containers");
    await expect(page.getByTestId("showing")).not.toContainText("of 1,000");
  });
  test("TC-E-124 The hero shows a road scene with three trucks and an icon on each figure @progression @ui", async ({ page }) => {
    await openFleet(page);
    await expect(page.getByTestId("hero-art")).toBeVisible();
    await expect(page.locator(".road-scene .drive")).toHaveCount(3);
    await expect(page.locator(".hero-stat .hs-icon")).toHaveCount(4);
  });

  test("TC-E-125 Selecting a container opens its live twin with a thermometer, gauges and a truck on the map @progression", async ({ page }) => {
    await openFleet(page);
    await expect(page.getByTestId("map-truck")).toHaveCount(0);
    await page.getByTestId("map-dot").first().click({ force: true });
    const card = page.getByTestId("selected-card");
    await expect(card).toBeVisible();
    await expect(card.getByTestId("thermo")).toBeVisible();
    await expect(card.locator(".twin-stats > div")).toHaveCount(5);
    await expect(page.getByTestId("map-truck")).toBeVisible();
  });

  test("TC-E-126 Alert types appear as icon tiles whose counts add up to the open alerts @progression", async ({ page }) => {
    await openFleet(page);
    const tiles = page.getByTestId("alert-type-tile");
    await expect(tiles).toHaveCount(7);
    const counts = await tiles.locator("b").allInnerTexts();
    const sum = counts.reduce((a, n) => a + Number(n), 0);
    expect(sum).toBe(102);
    await expect(page.getByTestId("hero-stat-alerts")).toContainText("102");
  });

  test("TC-E-127 Each table row shows a container icon and the map labels the seven cities @progression @ui", async ({ page }) => {
    await openFleet(page);
    await expect(page.getByTestId("fleet-row").first().locator(".cicon")).toHaveCount(1);
    await expect(page.getByTestId("map-city")).toHaveCount(7);
    await expect(page.getByTestId("map-city").first()).toBeVisible();
  });

  test("TC-E-128 The landing page states each fact once, with no repeated status chart or event list @regression", async ({ page }) => {
    await openFleet(page);
    await expect(page.getByTestId("ins-status-critical")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Latest events" })).toHaveCount(0);
    await expect(page.getByTestId("hero")).not.toContainText("Follow");
    await expect(page.getByTestId("panel-alerts")).toBeVisible();
  });

  test("TC-E-167 The theme is a dull pastel palette of sand, sage and dusty teal with a light top bar @regression @ui", async ({ page }) => {
    await openFleet(page);
    const t = await page.evaluate(() => {
      const css = getComputedStyle(document.documentElement);
      const lum = (c: string) => { const m = c.match(/\d+/g)!.slice(0, 3).map(Number); return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
      const bar = getComputedStyle(document.querySelector(".topbar")!).backgroundColor;
      const hero = getComputedStyle(document.querySelector("[data-testid=hero]")!).backgroundImage;
      return { bg: css.getPropertyValue("--bg").trim(), teal: css.getPropertyValue("--teal").trim(), barLum: lum(bar), hero };
    });
    expect(t.bg).toBe("#f5f1e8");
    expect(t.teal).toBe("#4f8f84");
    expect(t.barLum).toBeGreaterThan(0.8);
    expect(t.hero).toContain("linear-gradient");
    for (const old of ["#0b2545", "#1b5fd1"]) expect(await page.content()).not.toContain(old);
  });
});
