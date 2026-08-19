import { describe, expect, it } from "vitest";
import { generateWordSearch, validateWordSearch } from "../wordsearch";

describe("word search engine", () => {
  const words = ["BASKETBALL", "DRIBBLE", "HOOPS", "COURT", "REFEREE", "DEFENSE"];

  it("places every requested word and produces a valid answer key", () => {
    const { puzzle, solution } = generateWordSearch({
      title: "Sports",
      words,
      difficulty: "MEDIUM",
      seed: "test-seed-1",
    });
    expect(puzzle.words.sort()).toEqual([...words].sort());
    const issues = validateWordSearch(puzzle, solution);
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("is deterministic for a given seed", () => {
    const a = generateWordSearch({ title: "Sports", words, seed: 42 });
    const b = generateWordSearch({ title: "Sports", words, seed: 42 });
    expect(a.puzzle.grid).toEqual(b.puzzle.grid);
    expect(a.solution.mask).toEqual(b.solution.mask);
  });

  it("fills the entire grid with letters (no blanks)", () => {
    const { puzzle } = generateWordSearch({ title: "Animals", words: ["CAT", "DOG", "FISH"], seed: 7 });
    for (const row of puzzle.grid) {
      for (const cell of row) {
        expect(cell).toMatch(/^[A-Z]$/);
      }
    }
  });

  it("supports easy difficulty (no diagonals/reverse) without error", () => {
    const { puzzle, solution } = generateWordSearch({
      title: "Kids",
      words: ["SUN", "MOON", "STAR"],
      difficulty: "EASY",
      seed: 3,
    });
    for (const p of puzzle.placements) {
      expect(["E", "S"]).toContain(p.direction);
    }
    expect(validateWordSearch(puzzle, solution).filter((i) => i.level === "error")).toEqual([]);
  });

  it("grows the grid rather than dropping a long word", () => {
    const longWord = "SUPERCALIFRAGILISTIC";
    const { puzzle, solution } = generateWordSearch({
      title: "Long",
      words: [longWord, "CAT"],
      difficulty: "EASY",
      seed: 99,
    });
    expect(puzzle.words).toContain(longWord);
    expect(puzzle.placements.some((p) => p.word === longWord)).toBe(true);
    expect(validateWordSearch(puzzle, solution).filter((i) => i.level === "error")).toEqual([]);
  });

  it("detects a corrupted answer mask", () => {
    const { puzzle, solution } = generateWordSearch({ title: "X", words: ["ALPHA", "BETA"], seed: 5 });
    const corrupted = { ...solution, mask: solution.mask.map((row) => row.map(() => false)) };
    const issues = validateWordSearch(puzzle, corrupted);
    expect(issues.some((i) => i.level === "error")).toBe(true);
  });
});
