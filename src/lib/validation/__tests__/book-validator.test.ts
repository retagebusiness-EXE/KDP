import { describe, expect, it } from "vitest";
import { validateBook, type ValidationPageInput } from "../book-validator";
import { generateWordSearch } from "@/lib/engines/wordsearch";
import { calculateCoverDimensions } from "@/lib/pdf/dimensions";

function buildValidBook(pageCount = 24) {
  const pages: ValidationPageInput[] = [
    { index: 0, type: "title", content: { title: "T" } },
  ];
  for (let i = 1; i < pageCount - 1; i++) {
    const { puzzle, solution } = generateWordSearch({ title: `P${i}`, words: ["CAT", "DOG", "FISH"], seed: i });
    pages.push({
      index: i,
      type: "word_search",
      content: { rows: puzzle.rows, cols: puzzle.cols, grid: puzzle.grid, words: puzzle.words, title: puzzle.title },
      puzzle: { type: "word_search", data: puzzle },
      solution: { data: solution },
    });
  }
  pages.push({ index: pageCount - 1, type: "blank", content: {} });
  return pages;
}

describe("validateBook", () => {
  it("passes a well-formed book with no errors", () => {
    const pages = buildValidBook(24);
    const report = validateBook({
      trimWidthIn: 8.5,
      trimHeightIn: 11,
      bleed: false,
      paperType: "WHITE",
      interiorColor: "BW",
      pages,
    });
    expect(report.ok).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.passedChecks.length).toBeGreaterThan(0);
  });

  it("errors on odd page counts", () => {
    const pages = buildValidBook(24).slice(0, 23);
    const report = validateBook({
      trimWidthIn: 8.5,
      trimHeightIn: 11,
      bleed: false,
      paperType: "WHITE",
      interiorColor: "BW",
      pages,
    });
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.code === "DIMENSIONS")).toBe(true);
  });

  it("errors when a puzzle page is missing its answer key", () => {
    const pages = buildValidBook(24);
    pages[1] = { ...pages[1], solution: null };
    const report = validateBook({
      trimWidthIn: 8.5,
      trimHeightIn: 11,
      bleed: false,
      paperType: "WHITE",
      interiorColor: "BW",
      pages,
    });
    expect(report.errors.some((e) => e.code === "MISSING_ANSWER_KEY")).toBe(true);
  });

  it("errors when the answer key is corrupted (mask cleared)", () => {
    const pages = buildValidBook(24);
    const target = pages[1];
    const solutionData = target.solution!.data as { mask: boolean[][] };
    target.solution = { data: { ...solutionData, mask: solutionData.mask.map((row) => row.map(() => false)) } };
    const report = validateBook({
      trimWidthIn: 8.5,
      trimHeightIn: 11,
      bleed: false,
      paperType: "WHITE",
      interiorColor: "BW",
      pages,
    });
    expect(report.errors.some((e) => e.code === "PUZZLE_WORD_SEARCH")).toBe(true);
  });

  it("warns (not errors) when cover dimensions are stale", () => {
    const pages = buildValidBook(24);
    const staleCover = calculateCoverDimensions({
      trimWidthIn: 8.5,
      trimHeightIn: 11,
      pageCount: 500, // wrong page count on purpose
      paperType: "WHITE",
      interiorColor: "BW",
      bleed: false,
    });
    const report = validateBook({
      trimWidthIn: 8.5,
      trimHeightIn: 11,
      bleed: false,
      paperType: "WHITE",
      interiorColor: "BW",
      pages,
      cover: staleCover,
    });
    expect(report.errors).toEqual([]);
    expect(report.warnings.some((w) => w.code === "COVER_DIMENSIONS_STALE")).toBe(true);
  });

  it("keeps warnings and errors clearly separated", () => {
    const pages = buildValidBook(24).slice(0, 23); // triggers an error
    const report = validateBook({
      trimWidthIn: 6.3,
      trimHeightIn: 9.4, // non-standard trim => warning
      bleed: false,
      paperType: "WHITE",
      interiorColor: "BW",
      pages,
    });
    expect(report.errors.every((e) => e.level === "error")).toBe(true);
    expect(report.warnings.every((w) => w.level === "warning")).toBe(true);
  });
});
