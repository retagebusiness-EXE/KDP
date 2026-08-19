import { describe, expect, it } from "vitest";
import { coloringImagePixelSize, type BookContext } from "../content";

const baseCtx: BookContext = {
  title: "Ocean Animals",
  topic: "Ocean Animals",
  audience: "Kids ages 3-8",
  difficulty: "EASY",
  bookType: "coloring",
};

describe("coloringImagePixelSize", () => {
  it("targets ~300 DPI at the book's trim size, matching its aspect ratio", () => {
    const size = coloringImagePixelSize({ ...baseCtx, trimWidthIn: 8.5, trimHeightIn: 11 });
    expect(size.width / size.height).toBeCloseTo(8.5 / 11, 2);
    expect(size.width).toBeGreaterThan(1024); // previously hardcoded to a flat 1024x1024
  });

  it("clamps to the provider's max dimension while preserving aspect ratio", () => {
    const size = coloringImagePixelSize({ ...baseCtx, trimWidthIn: 8.5, trimHeightIn: 11 });
    expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(1792);
  });

  it("defaults to 8.5x11 when the context has no trim size", () => {
    const size = coloringImagePixelSize(baseCtx);
    expect(size.width / size.height).toBeCloseTo(8.5 / 11, 2);
  });
});
