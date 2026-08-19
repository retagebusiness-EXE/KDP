import { describe, expect, it } from "vitest";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { renderInteriorPdf, type InteriorPageInput } from "../render-interior";
import { renderCoverPdf } from "../render-cover";
import { generateWordSearch } from "@/lib/engines/wordsearch";
import { generateSudoku } from "@/lib/engines/sudoku";
import { inToPt } from "../layout";
import { calculateCoverDimensions } from "../dimensions";

describe("interior PDF rendering", () => {
  it("renders the exact number of pages at the exact trim size", async () => {
    const { puzzle } = generateWordSearch({ title: "Sports", words: ["BALL", "HOOP", "COURT"], seed: 1 });
    const { puzzle: sudoku } = generateSudoku({ title: "S", seed: 1 });

    const pages: InteriorPageInput[] = [
      { index: 0, type: "title", content: { title: "My Book", tagline: "Fun for all!" } },
      { index: 1, type: "word_search", content: { rows: puzzle.rows, cols: puzzle.cols, grid: puzzle.grid, words: puzzle.words, title: puzzle.title } },
      { index: 2, type: "sudoku", content: { size: sudoku.size, grid: sudoku.puzzle, title: "Sudoku #1" } },
      { index: 3, type: "blank", content: {} },
    ];

    const bytes = await renderInteriorPdf({ trimWidthIn: 8.5, trimHeightIn: 11 }, pages);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");

    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(4);
    const size = loaded.getPage(0).getSize();
    expect(size.width).toBeCloseTo(inToPt(8.5), 1);
    expect(size.height).toBeCloseTo(inToPt(11), 1);
  });

  it("renders a journal/planner/log_book/notebook page without throwing", async () => {
    const pages: InteriorPageInput[] = [
      { index: 0, type: "journal", content: { prompt: "What made you smile today?", lineCount: 10 } },
      { index: 1, type: "planner", content: { weekLabel: "Week 1", sections: ["Priorities", "Notes"], days: ["Mon", "Tue"] } },
      { index: 2, type: "log_book", content: { columns: ["Date", "Notes"], rowCount: 5, title: "Log" } },
      { index: 3, type: "notebook", content: { style: "dot" } },
    ];
    const bytes = await renderInteriorPdf({ trimWidthIn: 6, trimHeightIn: 9 }, pages);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(4);
  });
});

describe("font embedding", () => {
  it("embeds real font programs instead of referencing the unembedded base-14 fonts (required by KDP)", async () => {
    const pages: InteriorPageInput[] = [{ index: 0, type: "title", content: { title: "Embedded Fonts", tagline: "Check" } }];
    const bytes = await renderInteriorPdf({ trimWidthIn: 8.5, trimHeightIn: 11 }, pages);
    const loaded = await PDFDocument.load(bytes);

    let hasEmbeddedFontProgram = false;
    let hasUnembeddedBase14Font = false;
    for (const [, obj] of loaded.context.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFDict)) continue;
      if (obj.get(PDFName.of("FontFile2"))) hasEmbeddedFontProgram = true;
      const baseFont = obj.get(PDFName.of("BaseFont"));
      if (baseFont && String(baseFont) === "/Helvetica") {
        hasUnembeddedBase14Font = true;
      }
    }

    expect(hasEmbeddedFontProgram).toBe(true);
    expect(hasUnembeddedBase14Font).toBe(false);
  });
});

describe("cover PDF rendering", () => {
  it("renders at exactly the calculated full-cover dimensions", async () => {
    const dimsInput = { trimWidthIn: 6, trimHeightIn: 9, pageCount: 120, paperType: "WHITE" as const, interiorColor: "BW" as const, bleed: true };
    const expected = calculateCoverDimensions(dimsInput);

    const bytes = await renderCoverPdf({
      title: "Ocean Word Search",
      subtitle: "50 Puzzles",
      author: "Jane Author",
      backCoverText: "A relaxing collection of ocean-themed puzzles.",
      colors: ["#1E3A8A", "#F59E0B"],
      dimensions: dimsInput,
    });

    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
    const size = loaded.getPage(0).getSize();
    expect(size.width).toBeCloseTo(inToPt(expected.fullWidthIn), 1);
    expect(size.height).toBeCloseTo(inToPt(expected.fullHeightIn), 1);
  });
});
