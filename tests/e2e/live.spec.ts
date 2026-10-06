import { expect, test, type Page } from "@playwright/test";
import { axeSerious, mockMapServices, openLive, setLang, setPersona } from "./helpers";

const API = "http://localhost:4100";
const attr = (page: Page, id: string, name: string) => page.getByTestId(id).getAttribute(name);
const truckLon = async (page: Page) => Number(await attr(page, "live-truck", "data-lon"));

test.describe("Live map: tracking and route planning on MapLibre", () => {
  test("TC-E-181 The live map opens with the whole fleet on a MapLibre map for the operator @regression", async ({ page }) => {
    await openLive(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Live map");
    await expect(page.getByTestId("live-map")).toHaveAttribute("data-basemap", "online");
    await expect(page.getByTestId("live-map")).toHaveAttribute("data-points", "1000");
    await expect(page.locator(".live-map canvas.maplibregl-canvas")).toBeVisible();
    await expect(page.getByTestId("live-count")).toContainText("Showing 1,000 of 1,000 containers");
    await expect(page.getByTestId("live-badge")).toHaveAttribute("data-live", "1");
    await expect(page.getByTestId("live-tab-plan")).toBeVisible();
    await expect(page.getByTestId("live-credit")).toContainText("OpenStreetMap");
    await expect(page.getByTestId("live-city")).toHaveCount(7);
  });

  test("TC-E-182 Selecting a container draws its road, the truck and both ends, with speed and arrival @regression", async ({ page }) => {
    await openLive(page, "?id=SC-1002");
    await expect(page.getByTestId("live-panel")).toHaveAttribute("data-selected", "SC-1002");
    await expect(page.getByTestId("live-road-source")).toHaveAttribute("data-source", "road");
    await expect(page.getByTestId("live-truck")).toBeVisible();
    await expect(page.getByTestId("live-pin")).toHaveCount(2);
    await expect(page.getByTestId("live-map")).toHaveAttribute("data-lines", "2");
    await expect(page.getByTestId("live-sel-speed")).toContainText("km/h");
    await expect(page.getByTestId("live-sel-eta")).toContainText(/\d+ h \d+ min/);
    await expect(page.getByTestId("live-sel-left")).toContainText(/[\d,]+ km/);
    await expect(page.getByTestId("live-open")).toHaveAttribute("href", "/container/?id=SC-1002");
  });

  test("TC-E-183 Moving trucks advance along the road on the live clock @progression", async ({ page }) => {
    test.setTimeout(60000);
    await openLive(page, "?id=SC-1002");
    await expect(page.getByTestId("live-truck")).toBeVisible();
    const lon0 = await truckLon(page);
    const left0 = Number((await page.getByTestId("live-sel-left").innerText()).replace(/[^0-9]/g, ""));
    await expect.poll(async () => Math.abs((await truckLon(page)) - lon0), { timeout: 15000 }).toBeGreaterThan(0.001);
    const left1 = Number((await page.getByTestId("live-sel-left").innerText()).replace(/[^0-9]/g, ""));
    expect(left1).toBeLessThan(left0);
  });

  test("TC-E-184 Pausing the live clock stops the trucks and resuming moves them again @progression", async ({ page }) => {
    test.setTimeout(60000);
    await openLive(page, "?id=SC-1002");
    await expect(page.getByTestId("live-truck")).toBeVisible();
    await page.getByTestId("live-toggle").click();
    await expect(page.getByTestId("live-badge")).toHaveAttribute("data-live", "0");
    await expect(page.getByTestId("live-badge")).toContainText("Paused");
    const frozen = await truckLon(page);
    await page.waitForTimeout(4500);
    expect(await truckLon(page)).toBe(frozen);
    await page.getByTestId("live-toggle").click();
    await expect(page.getByTestId("live-badge")).toHaveAttribute("data-live", "1");
    await expect.poll(async () => Math.abs((await truckLon(page)) - frozen), { timeout: 15000 }).toBeGreaterThan(0.001);
  });

  test("TC-E-185 The status filter and the search narrow the points and the list @regression", async ({ page }) => {
    await openLive(page);
    await page.getByTestId("live-status-critical").click();
    await expect(page.getByTestId("live-count")).toHaveAttribute("data-n", "27");
    await expect(page.getByTestId("live-map")).toHaveAttribute("data-points", "27");
    await expect(page.getByTestId("live-item")).toHaveCount(8);
    await page.getByTestId("live-status-all").click();
    await page.getByTestId("live-search").fill("SC-1002");
    await expect(page.getByTestId("live-item")).toHaveCount(1);
    await expect(page.getByTestId("live-map")).toHaveAttribute("data-points", "1");
    await page.getByTestId("live-search").fill("no such truck");
    await expect(page.getByTestId("live-none")).toBeVisible();
    await expect(page.getByTestId("live-map")).toHaveAttribute("data-points", "0");
  });

  test("TC-E-186 The live map follows the signed-in role: a customer sees only its own containers and no planner @regression", async ({ page }) => {
    await openLive(page);
    await expect(page.getByTestId("live-count")).toHaveAttribute("data-total", "1000");
    await setPersona(page, "customer");
    await expect(page.getByTestId("live-count")).toHaveAttribute("data-total", "127");
    await expect(page.getByTestId("live-map")).toHaveAttribute("data-points", "127");
    await expect(page.getByTestId("live-scope")).toContainText("Najd Fresh Foods");
    await expect(page.getByTestId("live-tab-plan")).toHaveCount(0);
    await expect(page.getByTestId("live-sub")).toContainText("your shipments");
    await setPersona(page, "quality");
    await expect(page.getByTestId("live-count")).toHaveAttribute("data-total", "1000");
    await expect(page.getByTestId("live-tab-plan")).toBeVisible();
  });

  test("TC-E-187 The container and journey pages link to the live map with the container already selected @regression", async ({ page }) => {
    await mockMapServices(page);
    await page.goto("/container/?id=SC-1002");
    await page.getByTestId("track-live").click();
    await expect(page).toHaveURL(/\/live\/\?id=SC-1002/);
    await expect(page.getByTestId("live-map")).toHaveAttribute("data-ready", "1", { timeout: 20000 });
    await expect(page.getByTestId("live-panel")).toHaveAttribute("data-selected", "SC-1002");
    await page.goto("/operations/");
    await page.getByTestId("journey-link").first().click();
    await expect(page.getByTestId("journey-title")).toBeVisible();
    await page.getByTestId("track-live").click();
    await expect(page).toHaveURL(/\/live\/\?id=SC-/);
    await expect(page.getByTestId("live-panel")).not.toHaveAttribute("data-selected", "");
  });

  test("TC-E-188 When the routing service is down the map falls back to the planned corridor and says so @negative", async ({ page }) => {
    await openLive(page, "?id=SC-1002", { osrm: "down" });
    await expect(page.getByTestId("live-road-source")).toHaveAttribute("data-source", "estimate", { timeout: 20000 });
    await expect(page.getByTestId("live-road-source")).toContainText("Estimated road line");
    await expect(page.getByTestId("live-map")).toHaveAttribute("data-lines", "2");
    await expect(page.getByTestId("live-truck")).toBeVisible();
    await expect(page.getByTestId("live-sel-eta")).toContainText(/\d+ h \d+ min/);
  });

  test("TC-E-189 A routing answer with no road is treated like an outage and the page still works @negative", async ({ page }) => {
    await openLive(page, "?id=SC-1002", { osrm: "empty" });
    await expect(page.getByTestId("live-road-source")).toHaveAttribute("data-source", "estimate", { timeout: 20000 });
    await expect(page.getByTestId("live-truck")).toBeVisible();
    await page.getByTestId("live-tab-plan").click();
    await expect(page.getByTestId("plan-summary")).toHaveAttribute("data-source", "estimate", { timeout: 20000 });
    await expect(page.getByTestId("plan-estimate")).toBeVisible();
    await expect(page.getByTestId("plan-km")).toContainText(/[\d,]+ km/);
  });

  test("TC-E-190 When the base map cannot load, routes and trucks are still drawn on a plain background @negative", async ({ page }) => {
    await openLive(page, "?id=SC-1002", { basemap: "down" });
    await expect(page.getByTestId("live-map")).toHaveAttribute("data-basemap", "offline", { timeout: 20000 });
    await expect(page.getByTestId("live-credit")).toContainText("Base map unavailable");
    await expect(page.getByTestId("live-map")).toHaveAttribute("data-points", "1000");
    await expect(page.getByTestId("live-map")).toHaveAttribute("data-lines", "2");
    await expect(page.getByTestId("live-truck")).toBeVisible();
  });

  test("TC-E-191 The route planner shows the road, distance, driving time, arrival, options and stops @progression", async ({ page }) => {
    await openLive(page);
    await page.getByTestId("live-tab-plan").click();
    await expect(page.getByTestId("plan-summary")).toHaveAttribute("data-source", "road", { timeout: 20000 });
    const km = Number((await page.getByTestId("plan-km").innerText()).replace(/[^0-9]/g, ""));
    expect(km).toBeGreaterThan(900);
    expect(km).toBeLessThan(1500);
    await expect(page.getByTestId("plan-drive")).toContainText(/\d+ h/);
    await expect(page.getByTestId("plan-eta")).toContainText(/\d{2}:\d{2}/);
    await expect(page.getByTestId("plan-alt-0")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("plan-alt-1")).toBeVisible();
    const stops = await page.getByTestId("plan-stop").count();
    expect(stops).toBeGreaterThanOrEqual(3);
    await expect(page.getByTestId("live-map")).toHaveAttribute("data-pins", String(stops));
    await expect(page.getByTestId("live-map")).toHaveAttribute("data-lines", "2");
    await expect(page.getByTestId("plan-wizard")).toHaveAttribute("href", "/operations/new/");
  });

  test("TC-E-192 Changing the speed, the option or the stops re-plans the route @progression", async ({ page }) => {
    test.setTimeout(60000);
    await openLive(page);
    await page.getByTestId("live-tab-plan").click();
    await expect(page.getByTestId("plan-summary")).toHaveAttribute("data-source", "road", { timeout: 20000 });
    const mins = async () => { const m = /(?:(\d+) h)?\s*(?:(\d+) min)?/.exec(await page.getByTestId("plan-drive").innerText())!; return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0); };
    const km = async () => Number((await page.getByTestId("plan-km").innerText()).replace(/[^0-9]/g, ""));
    const d80 = await mins(), k0 = await km();
    await page.getByTestId("plan-speed").fill("60");
    await expect.poll(mins).toBeGreaterThan(d80);
    await page.getByTestId("plan-speed").fill("80");
    await page.getByTestId("plan-alt-1").click();
    await expect(page.getByTestId("plan-alt-1")).toHaveAttribute("aria-pressed", "true");
    expect(await km()).toBeGreaterThan(k0);
    await page.getByTestId("plan-via-1").selectOption("madinah");
    await expect(page.getByTestId("plan-summary")).toContainText("Jeddah → Madinah → Riyadh");
    await expect(page.getByTestId("plan-alts")).toHaveCount(0);
    await expect(page.getByTestId("plan-via-2")).toBeVisible();
    await expect(page.getByTestId("live-city")).toHaveCount(3);
    await expect.poll(km).toBeGreaterThan(k0);
  });

  test("TC-E-193 The route planner refuses a trip that cannot be planned and says why @negative", async ({ page }) => {
    await openLive(page);
    await page.getByTestId("live-tab-plan").click();
    await page.getByTestId("plan-dest").selectOption("jeddah");
    await expect(page.getByTestId("plan-errors")).toContainText("cannot be the same city");
    await expect(page.getByTestId("plan-summary")).toContainText("Fix these");
    await expect(page.getByTestId("plan-km")).toHaveCount(0);
    await page.getByTestId("plan-dest").selectOption("riyadh");
    await expect(page.getByTestId("plan-errors")).toHaveCount(0);
    await page.getByTestId("plan-via-1").selectOption("riyadh");
    await expect(page.getByTestId("plan-errors")).toContainText("only once");
    await page.getByTestId("plan-via-1").selectOption("");
    await page.getByTestId("plan-speed").fill("20");
    await expect(page.getByTestId("plan-errors")).toContainText("between 40 and 100");
    await page.getByTestId("plan-speed").fill("80");
    await page.getByTestId("plan-origin").selectOption("");
    await expect(page.getByTestId("plan-errors")).toContainText("where the journey starts");
  });

  test("TC-E-194 A customer who opens the planner link still gets tracking only @negative", async ({ page }) => {
    await mockMapServices(page);
    await page.goto("/live/");
    await setPersona(page, "customer");
    await page.goto("/live/?tab=plan");
    await expect(page.getByTestId("live-page")).toHaveAttribute("data-persona", "customer");
    await expect(page.getByTestId("live-page")).toHaveAttribute("data-tab", "track");
    await expect(page.getByTestId("live-plan")).toHaveCount(0);
    await page.goto("/live/?id=SC-1002");
    await expect(page.getByTestId("live-map")).toHaveAttribute("data-ready", "1", { timeout: 20000 });
    await expect(page.getByTestId("live-panel")).toHaveAttribute("data-selected", "");
    await expect(page.getByTestId("live-hint")).toBeVisible();
  });

  test("TC-E-195 The live map works in Arabic with right to left layout and Arabic city names @regression @ux", async ({ page }) => {
    await openLive(page);
    await setLang(page, "ar");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("الخريطة المباشرة");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("live-tab-plan")).toHaveText("مخطط المسار");
    await expect(page.getByTestId("live-city").filter({ hasText: "الرياض" })).toHaveCount(1);
    await expect(page.getByTestId("live-count")).toContainText("١٬٠٠٠");
    await page.getByTestId("live-tab-plan").click();
    await expect(page.getByTestId("plan-origin")).toContainText("جدة");
    await expect(page.getByTestId("plan-summary")).toHaveAttribute("data-source", "road", { timeout: 20000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test("TC-E-196 The live map and the route planner have no serious accessibility violations @regression @a11y", async ({ page }) => {
    test.setTimeout(90000);
    await openLive(page, "?id=SC-1002");
    await expect(page.getByTestId("live-truck")).toBeVisible();
    for (const p of ["operator", "quality", "security", "customer"] as const) {
      await setPersona(page, p);
      await expect(page.getByTestId("live-page")).toHaveAttribute("data-persona", p);
      expect(await axeSerious(page), `tracking ${p}`).toEqual([]);
    }
    await setPersona(page, "operator");
    await page.getByTestId("live-tab-plan").click();
    await expect(page.getByTestId("plan-summary")).toHaveAttribute("data-source", "road", { timeout: 20000 });
    expect(await axeSerious(page), "planner").toEqual([]);
    await page.getByTestId("plan-dest").selectOption("jeddah");
    await expect(page.getByTestId("plan-errors")).toBeVisible();
    expect(await axeSerious(page), "planner errors").toEqual([]);
  });

  test("TC-E-197 The live map fits desktop, tablet and phone without sideways scrolling and keeps 40 px controls @regression @ui", async ({ page }) => {
    test.setTimeout(90000);
    await mockMapServices(page);
    for (const [w, h] of [[1360, 900], [768, 900], [390, 800]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/live/?id=SC-1002");
      await expect(page.getByTestId("live-map")).toHaveAttribute("data-ready", "1", { timeout: 20000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${w}px`).toBe(true);
      const box = (await page.getByTestId("live-map").boundingBox())!;
      expect(box.height).toBeGreaterThan(300);
      expect(box.width).toBeGreaterThan(Math.min(300, w - 40));
      for (const id of ["live-zoom-in", "live-zoom-out", "live-fit", "live-toggle", "live-tab-track"]) {
        const b = (await page.getByTestId(id).boundingBox())!;
        expect(b.height, `${id} at ${w}px`).toBeGreaterThanOrEqual(39.5);
      }
    }
    await page.getByTestId("live-tab-plan").click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test("TC-E-198 Clicking a container on the map selects it @regression", async ({ page, request }) => {
    test.setTimeout(60000);
    await openLive(page);
    const fleet = (await (await request.get(`${API}/api/v1/fleet?limit=1000`)).json()) as { containers: { id: string; routeId: string }[] };
    expect(fleet.containers.length).toBe(1000);
    await page.getByTestId("live-status-critical").click();
    await expect(page.getByTestId("live-map")).toHaveAttribute("data-points", "27");
    await page.getByTestId("live-toggle").click();
    // find one rendered point and click on it
    const spot = await page.evaluate(() => {
      const map = window.__liveMap as unknown as { project(c: [number, number]): { x: number; y: number }; queryRenderedFeatures(o?: object): { properties: { id: string }; geometry: { coordinates: [number, number] } }[]; getCanvas(): HTMLCanvasElement };
      const f = map.queryRenderedFeatures({ layers: ["scm-points"] })[0];
      if (!f) return null;
      const p = map.project(f.geometry.coordinates);
      const r = map.getCanvas().getBoundingClientRect();
      return { id: f.properties.id, x: r.left + p.x, y: r.top + p.y };
    });
    expect(spot).not.toBeNull();
    await page.mouse.click(spot!.x, spot!.y);
    await expect(page.getByTestId("live-panel")).toHaveAttribute("data-selected", spot!.id);
  });
});
