import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const SEL = { dot: '[data-testid="map-dot"]' };

export async function openFleet(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("kpi-total")).toBeVisible();
  await expect(page.locator(SEL.dot).first()).toBeAttached();
}

export async function openView(page: Page, view: string, id: string) {
  await page.goto(`/${view}/?id=${id}`);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByTestId("container-title")).toHaveText(id);
}

export async function setLang(page: Page, lang: "en" | "ar") {
  await page.getByTestId(`lang-${lang}`).click();
  await expect(page.locator("html")).toHaveAttribute("lang", lang);
}

export async function setPersona(page: Page, persona: "operator" | "quality" | "security" | "customer") {
  await page.getByTestId("persona-select").selectOption(persona);
}

export async function num(page: Page, testid: string) {
  const text = (await page.getByTestId(testid).innerText()).replace(/,/g, "").replace(/[^0-9]/g, " ").trim().split(/\s+/)[0];
  return Number(text);
}

export async function axeSerious(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes) ${v.nodes[0]?.target?.join(" ")}`);
}

export const PAGES: { name: string; url: string }[] = [
  { name: "Fleet", url: "/" },
  { name: "Alerts", url: "/alerts/?view=alarms" },
  { name: "Container detail", url: "/container/?id=SC-1060" },
  { name: "Route", url: "/route/?id=SC-1075" },
  { name: "Cargo health", url: "/health/?id=SC-1060" },
  { name: "Replay", url: "/replay/?id=SC-1089" },
  { name: "Modules", url: "/modules/?id=SC-1014" },
  { name: "Report", url: "/report/?id=SC-1060" },
  { name: "Admin", url: "/admin/" },
];

// ---- map services -------------------------------------------------------------------------------
// The live map loads MapLibre from a CDN, a base map style from OpenFreeMap and roads from OSRM.
// Tests answer the last two themselves so they are fast and never depend on a third party.
// MAPLIBRE_DIST (a folder holding maplibre-gl.js and .css) also serves the library locally for sandboxes without internet.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type MapMock = { osrm?: "ok" | "down" | "empty"; basemap?: "ok" | "down" };
export const MOCK_STYLE = { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#dfe7f3" } }] };

const hav = (a: number[], b: number[]) => {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b[1] - a[1]) / 2) ** 2 + Math.cos(r(a[1])) * Math.cos(r(b[1])) * Math.sin(r(b[0] - a[0]) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

/** A believable road between stops: a gentle curve through each leg. */
export function fakeOsrm(url: string) {
  const m = /driving\/([^?]+)\?/.exec(url);
  const stops = (m ? m[1] : "").split(";").map((s) => s.split(",").map(Number));
  const alts = /alternatives=true/.test(url);
  const build = (bend: number) => {
    const coords: number[][] = [];
    let km = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i], b = stops[i + 1];
      for (let k = 0; k <= 30; k++) {
        const f = k / 30, off = Math.sin(Math.PI * f) * bend;
        coords.push([a[0] + (b[0] - a[0]) * f + (b[1] - a[1]) * off, a[1] + (b[1] - a[1]) * f - (b[0] - a[0]) * off]);
      }
      km += hav(a, b) * 1.18;
    }
    return { geometry: { type: "LineString", coordinates: coords }, distance: km * 1000 * (1 + bend), duration: (km / 82) * 3600 };
  };
  return { code: "Ok", routes: alts ? [build(0.03), build(0.09)] : [build(0.03)] };
}

export async function mockMapServices(page: Page, o: MapMock = {}) {
  const dist = process.env.MAPLIBRE_DIST;
  await page.route("**/cdn.jsdelivr.net/npm/maplibre-gl@*/dist/**", async (route) => {
    const file = route.request().url().endsWith(".css") ? "maplibre-gl.css" : "maplibre-gl.js";
    if (dist && existsSync(join(dist, file))) return route.fulfill({ body: readFileSync(join(dist, file)), contentType: file.endsWith(".css") ? "text/css" : "application/javascript" });
    return route.continue();
  });
  await page.route("https://tiles.openfreemap.org/**", (route) => (o.basemap === "down" ? route.abort() : route.fulfill({ json: MOCK_STYLE })));
  await page.route("https://router.project-osrm.org/**", (route) => {
    if (o.osrm === "down") return route.abort();
    if (o.osrm === "empty") return route.fulfill({ json: { code: "NoRoute", routes: [] } });
    return route.fulfill({ json: fakeOsrm(route.request().url()), headers: { "access-control-allow-origin": "*" } });
  });
}

export async function openLive(page: Page, query = "", o: MapMock = {}) {
  await mockMapServices(page, o);
  await page.goto(`/live/${query}`);
  await expect(page.getByTestId("live-page")).toBeVisible();
  await expect(page.getByTestId("live-map")).toHaveAttribute("data-ready", "1", { timeout: 20_000 });
}
