import { describe, expect, it } from "vitest";
import { applyClues, entryKey, generateCrosswordLayout, validateCrossword } from "../crossword";

describe("crossword engine", () => {
  const words = ["BASKETBALL", "HOOPS", "COURT", "DRIBBLE", "REFEREE", "DEFENSE", "TEAM", "SCORE"];

  it("places words with valid intersections and a matching answer key", () => {
    const { puzzle, solution } = generateCrosswordLayout({ title: "Sports", words, seed: 1 });
    expect(puzzle.entries.length).toBeGreaterThan(0);
    const issues = validateCrossword(puzzle, solution);
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("is deterministic for a given seed", () => {
    const a = generateCrosswordLayout({ title: "Sports", words, seed: 7 });
    const b = generateCrosswordLayout({ title: "Sports", words, seed: 7 });
    expect(a.puzzle.blocked).toEqual(b.puzzle.blocked);
    expect(a.solution.grid).toEqual(b.solution.grid);
  });

  it("never produces duplicate answers", () => {
    const { puzzle } = generateCrosswordLayout({ title: "T", words: [...words, "hoops"], seed: 2 });
    const answers = puzzle.entries.map((e) => e.word);
    expect(new Set(answers).size).toBe(answers.length);
  });

  it("attaches clues without altering answers", () => {
    const { puzzle, solution } = generateCrosswordLayout({ title: "T", words, seed: 3 });
    const clueMap = new Map<string, string>();
    for (const entry of puzzle.entries) {
      clueMap.set(entryKey(entry), `Clue for ${entry.word}`);
    }
    const withClues = applyClues(puzzle, clueMap);
    for (const entry of withClues.entries) {
      expect(entry.clue).toBe(`Clue for ${entry.word}`);
    }
    // answers/grid untouched
    const issues = validateCrossword(withClues, solution);
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
    expect(issues.filter((i) => i.level === "warning" && i.message.includes("no clue"))).toEqual([]);
  });

  it("flags entries missing clues as warnings, not errors", () => {
    const { puzzle, solution } = generateCrosswordLayout({ title: "T", words, seed: 4 });
    const issues = validateCrossword(puzzle, solution);
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
    expect(issues.some((i) => i.level === "warning" && i.message.includes("no clue"))).toBe(true);
  });
});
