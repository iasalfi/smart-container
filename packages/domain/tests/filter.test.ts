import { describe, expect, it } from "vitest";
import { getFleet } from "../src/fleet";
import { countByStatus, EMPTY_FILTER, filterFleet, matchesQuery } from "../src/filter";

const fleet = getFleet();
const c0 = fleet.find((c) => c.id === "SC-1043")!;

describe("fleet filters", () => {
  it("TC-U-070 search matches ID, trip, plate, driver and customer", () => {
    for (const q of [c0.id, c0.tripId, c0.plate, c0.driver, c0.customer]) {
      expect(filterFleet(fleet, { ...EMPTY_FILTER, q }).some((c) => c.id === c0.id), q).toBe(true);
    }
  });
  it("TC-U-071 search ignores case and extra spaces", () => {
    expect(filterFleet(fleet, { ...EMPTY_FILTER, q: "  sc-1043 " }).map((c) => c.id)).toEqual(["SC-1043"]);
    expect(matchesQuery(c0, c0.driver.toUpperCase())).toBe(true);
  });
  it("TC-U-072 status filter returns only that status", () => {
    const r = filterFleet(fleet, { ...EMPTY_FILTER, status: "critical" });
    expect(r).toHaveLength(27); expect(r.every((c) => c.status === "critical")).toBe(true);
  });
  it("TC-U-073 filters combine", () => {
    const r = filterFleet(fleet, { ...EMPTY_FILTER, status: "normal", profile: "dairy", reeferOnly: true });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((c) => c.status === "normal" && c.profileId === "dairy" && c.reefer)).toBe(true);
    const cust = filterFleet(fleet, { ...EMPTY_FILTER, customer: "Najd Fresh Foods" });
    expect(cust).toHaveLength(127);
  });
  it("TC-U-074 blank or whitespace query returns everything", () => {
    expect(filterFleet(fleet, { ...EMPTY_FILTER, q: "   " })).toHaveLength(1000);
    expect(filterFleet(fleet, EMPTY_FILTER)).toHaveLength(1000);
  });
  it("TC-U-075 a query with no match returns an empty list", () => { expect(filterFleet(fleet, { ...EMPTY_FILTER, q: "zzzz" })).toEqual([]); });
  it("TC-U-076 regex and markup characters are treated as plain text", () => {
    for (const q of [".*", "(", "[", "\\", "<script>alert(1)</script>", "'; DROP TABLE x;--"]) {
      expect(() => filterFleet(fleet, { ...EMPTY_FILTER, q })).not.toThrow();
      expect(filterFleet(fleet, { ...EMPTY_FILTER, q })).toEqual([]);
    }
  });
  it("TC-U-077 countByStatus totals match", () => {
    expect(countByStatus(fleet)).toEqual({ total: 1000, normal: 912, warning: 61, critical: 27, offline: 12 });
  });
});
