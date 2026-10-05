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
  { name: "Alerts", url: "/alerts/" },
  { name: "Container detail", url: "/container/?id=SC-1060" },
  { name: "Route", url: "/route/?id=SC-1075" },
  { name: "Cargo health", url: "/health/?id=SC-1060" },
  { name: "Replay", url: "/replay/?id=SC-1089" },
  { name: "Modules", url: "/modules/?id=SC-1014" },
  { name: "Report", url: "/report/?id=SC-1060" },
  { name: "Admin", url: "/admin/" },
];
