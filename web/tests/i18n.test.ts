import { describe, expect, it } from "vitest";
import { ar, en, translate, type Key } from "@/lib/i18n";

const keys = Object.keys(en) as Key[];
const tokens = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");

describe("language", () => {
  it("TC-U-080 English and Arabic have identical keys", () => { expect(Object.keys(ar).sort()).toEqual([...keys].sort()); });
  it("TC-U-081 no empty translations", () => {
    for (const k of keys) { expect(en[k].trim().length, `en ${k}`).toBeGreaterThan(0); expect(ar[k].trim().length, `ar ${k}`).toBeGreaterThan(0); }
  });
  it("TC-U-082 placeholders match across languages", () => { for (const k of keys) expect(tokens(ar[k]), k).toBe(tokens(en[k])); });
  it("TC-U-083 translate substitutes parameters", () => {
    expect(translate("en", "showing", { shown: 5, total: 1000 })).toBe("Showing 5 of 1000 containers");
    expect(translate("ar", "showing", { shown: 5, total: 1000 })).toContain("1000");
  });
  it("TC-U-084 a missing parameter leaves the token visible", () => {
    expect(translate("en", "showing")).toContain("{shown}");
    expect(translate("en", "showing", { shown: 1 })).toContain("{total}");
  });
});
