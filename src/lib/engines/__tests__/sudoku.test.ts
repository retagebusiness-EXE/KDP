import { describe, expect, it } from "vitest";
import { generateSudoku, validateSudoku } from "../sudoku";

describe("sudoku engine", () => {
  it("generates a puzzle with a unique, valid solution", () => {
    const { puzzle, solution } = generateSudoku({ title: "Test", difficulty: "MEDIUM", seed: 1 });
    const issues = validateSudoku(puzzle, solution);
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("is deterministic for a given seed", () => {
    const a = generateSudoku({ title: "T", seed: 123 });
    const b = generateSudoku({ title: "T", seed: 123 });
    expect(a.puzzle.puzzle).toEqual(b.puzzle.puzzle);
    expect(a.solution.grid).toEqual(b.solution.grid);
  });

  it("respects difficulty clue-count ordering", () => {
    const easy = generateSudoku({ title: "T", difficulty: "EASY", seed: 10 });
    const hard = generateSudoku({ title: "T", difficulty: "HARD", seed: 10 });
    const clues = (g: number[][]) => g.flat().filter((v) => v !== 0).length;
    expect(clues(easy.puzzle.puzzle)).toBeGreaterThan(clues(hard.puzzle.puzzle));
  });

  it("every given clue matches the answer key", () => {
    const { puzzle, solution } = generateSudoku({ title: "T", seed: 55 });
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const given = puzzle.puzzle[r][c];
        if (given !== 0) expect(given).toBe(solution.grid[r][c]);
      }
    }
  });

  it("detects a solution that breaks Sudoku rules", () => {
    const { puzzle, solution } = generateSudoku({ title: "T", seed: 8 });
    const broken = { grid: solution.grid.map((row) => row.slice()) };
    broken.grid[0][0] = broken.grid[0][1]; // duplicate in same row
    const issues = validateSudoku(puzzle, broken);
    expect(issues.some((i) => i.level === "error")).toBe(true);
  });
});
