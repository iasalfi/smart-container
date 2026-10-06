import { describe, expect, it } from "vitest";
import { arDigits, arNum, arText } from "@/lib/arlocal";

describe("arabic conversion", () => {
  it("TC-U-149 digits, separators, percent and units become Arabic", () => {
    expect(arDigits("0123456789")).toBe("٠١٢٣٤٥٦٧٨٩");
    expect(arText("1,000")).toBe("١٬٠٠٠");
    expect(arText("98%")).toBe("٩٨٪");
    expect(arText("9.83 °C 83 km/h")).toBe("٩٫٨٣ °م ٨٣ كم/س");
    expect(arNum(1234.5, 1)).toBe("١٬٢٣٤٫٥");
  });
  it("TC-U-150 names, cities and plates are written in Arabic", () => {
    expect(arText("Abdullah Al-Asmari")).toBe("عبدالله العسيري");
    expect(arText("Jeddah → Riyadh")).toBe("جدة → الرياض");
    expect(arText("NTU 9688")).toBe("ن ط و ٩٦٨٨");
  });
  it("TC-U-151 identifiers stay Latin and plain text is returned unchanged", () => {
    expect(arText("SC-1060")).toBe("SC-1060");
    expect(arText("WO-12 P1")).toBe("WO-12 P1");
    expect(arText("مرحبا")).toBe("مرحبا");
    expect(arText("")).toBe("");
  });
});
