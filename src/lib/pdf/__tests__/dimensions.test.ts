import { describe, expect, it } from "vitest";
import {
  calculateCoverDimensions,
  calculateSpineWidthIn,
  validateInteriorDimensions,
} from "../dimensions";

describe("cover dimension calculations", () => {
  it("computes full cover width as 2x trim + spine + bleed*2", () => {
    const dims = calculateCoverDimensions({
      trimWidthIn: 6,
      trimHeightIn: 9,
      pageCount: 100,
      paperType: "WHITE",
      interiorColor: "BW",
      bleed: true,
    });
    const expectedSpine = calculateSpineWidthIn(100, "WHITE", "BW");
    expect(dims.spineWidthIn).toBeCloseTo(expectedSpine, 4);
    expect(dims.fullWidthIn).toBeCloseTo(6 * 2 + expectedSpine + 0.125 * 2, 4);
    expect(dims.fullHeightIn).toBeCloseTo(9 + 0.125 * 2, 4);
  });

  it("has zero bleed contribution when bleed is off", () => {
    const dims = calculateCoverDimensions({
      trimWidthIn: 8.5,
      trimHeightIn: 11,
      pageCount: 50,
      paperType: "CREAM",
      interiorColor: "BW",
      bleed: false,
    });
    expect(dims.bleedIn).toBe(0);
    expect(dims.fullHeightIn).toBeCloseTo(11, 4);
  });

  it("increases spine width with more pages", () => {
    const small = calculateSpineWidthIn(30, "WHITE", "BW");
    const large = calculateSpineWidthIn(300, "WHITE", "BW");
    expect(large).toBeGreaterThan(small);
  });
});

describe("interior dimension validation", () => {
  it("flags page counts under the KDP paperback minimum", () => {
    const issues = validateInteriorDimensions(6, 9, 10, false);
    expect(issues.some((i) => i.level === "error" && i.message.includes("24"))).toBe(true);
  });

  it("flags odd page counts", () => {
    const issues = validateInteriorDimensions(6, 9, 51, false);
    expect(issues.some((i) => i.level === "error" && i.message.includes("even"))).toBe(true);
  });

  it("passes a standard trim size and even page count without errors", () => {
    const issues = validateInteriorDimensions(6, 9, 100, false);
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("warns (not errors) on a non-standard custom trim size", () => {
    const issues = validateInteriorDimensions(6.3, 9.4, 100, false);
    expect(issues.some((i) => i.level === "warning")).toBe(true);
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("flags black-and-white page counts over the KDP paperback maximum", () => {
    const issues = validateInteriorDimensions(6, 9, 900, false, "BW");
    expect(issues.some((i) => i.level === "error" && i.message.includes("828"))).toBe(true);
  });

  it("does not apply the BW max to color interiors", () => {
    const issues = validateInteriorDimensions(6, 9, 900, false, "COLOR");
    expect(issues.some((i) => i.message.includes("828"))).toBe(false);
  });
});
