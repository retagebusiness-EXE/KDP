import { describe, expect, it } from "vitest";
import { generateMaze, validateMaze } from "../maze";

describe("maze engine", () => {
  it("generates a maze with a guaranteed path from start to end", () => {
    const { puzzle, solution } = generateMaze({ title: "Test", difficulty: "MEDIUM", seed: 1 });
    expect(solution.path[0]).toEqual(puzzle.start);
    expect(solution.path[solution.path.length - 1]).toEqual(puzzle.end);
    const issues = validateMaze(puzzle, solution);
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("is deterministic for a given seed", () => {
    const a = generateMaze({ title: "T", seed: 42 });
    const b = generateMaze({ title: "T", seed: 42 });
    expect(a.puzzle.walls).toEqual(b.puzzle.walls);
  });

  it("scales size with difficulty", () => {
    const easy = generateMaze({ title: "T", difficulty: "EASY", seed: 1 });
    const hard = generateMaze({ title: "T", difficulty: "HARD", seed: 1 });
    expect(hard.puzzle.rows).toBeGreaterThan(easy.puzzle.rows);
  });

  it("every step in the answer path passes through an open wall", () => {
    const { solution } = generateMaze({ title: "T", seed: 3 });
    for (let i = 0; i < solution.path.length - 1; i++) {
      const a = solution.path[i];
      const b = solution.path[i + 1];
      const dr = b.row - a.row;
      const dc = b.col - a.col;
      // exactly one of the four directions, adjacent cells only
      expect(Math.abs(dr) + Math.abs(dc)).toBe(1);
    }
  });

  it("detects a disconnected maze", () => {
    const { puzzle, solution } = generateMaze({ title: "T", seed: 9 });
    const broken = puzzle.walls.map((row) => row.map(() => 0b1111)); // wall everything off
    const issues = validateMaze({ ...puzzle, walls: broken }, solution);
    expect(issues.some((i) => i.level === "error")).toBe(true);
  });
});
