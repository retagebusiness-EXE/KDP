import { createRng, seedFromString, shuffle, type Rng } from "./rng";
import type { Difficulty, ValidationIssue } from "./types";

export type SudokuGrid = number[][]; // 0 = empty

export interface SudokuPuzzle {
  type: "sudoku";
  title: string;
  difficulty: Difficulty;
  size: 9;
  puzzle: SudokuGrid; // 0 for blanks the solver must fill in
}

export interface SudokuSolution {
  grid: SudokuGrid; // fully solved grid, matches puzzle's given cells exactly
}

const SIZE = 9;
const BOX = 3;

function emptyGrid(): SudokuGrid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function isSafe(grid: SudokuGrid, row: number, col: number, value: number): boolean {
  for (let i = 0; i < SIZE; i++) {
    if (grid[row][i] === value) return false;
    if (grid[i][col] === value) return false;
  }
  const boxRow = row - (row % BOX);
  const boxCol = col - (col % BOX);
  for (let r = 0; r < BOX; r++) {
    for (let c = 0; c < BOX; c++) {
      if (grid[boxRow + r][boxCol + c] === value) return false;
    }
  }
  return true;
}

function findEmpty(grid: SudokuGrid): [number, number] | null {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) return [r, c];
    }
  }
  return null;
}

/** Backtracking solve. If `countLimit` is set, stops once that many solutions are found. */
function solve(grid: SudokuGrid, rng: Rng | null, countLimit?: number): number {
  let solutions = 0;

  function backtrack(): boolean {
    const spot = findEmpty(grid);
    if (!spot) {
      solutions++;
      return countLimit ? solutions >= countLimit : true;
    }
    const [row, col] = spot;
    const values = rng ? shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9]) : [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (const value of values) {
      if (isSafe(grid, row, col, value)) {
        grid[row][col] = value;
        if (backtrack()) return true;
        grid[row][col] = 0;
      }
    }
    return false;
  }

  backtrack();
  return solutions;
}

function countSolutions(grid: SudokuGrid, limit = 2): number {
  const copy = grid.map((row) => row.slice());
  return solve(copy, null, limit);
}

function generateFullSolution(rng: Rng): SudokuGrid {
  const grid = emptyGrid();
  solve(grid, rng);
  return grid;
}

const DIFFICULTY_CLUES: Record<Difficulty, number> = {
  EASY: 42,
  MEDIUM: 32,
  HARD: 26,
};

export interface GenerateSudokuOptions {
  title: string;
  difficulty?: Difficulty;
  seed?: number | string;
}

/**
 * Generates a Sudoku puzzle deterministically: builds a full valid solution
 * via backtracking, then removes cells one at a time only when the resulting
 * puzzle still has exactly one solution (verified by a limited-count solver).
 * AI is never involved in puzzle correctness.
 */
export function generateSudoku(options: GenerateSudokuOptions): {
  puzzle: SudokuPuzzle;
  solution: SudokuSolution;
} {
  const difficulty = options.difficulty ?? "MEDIUM";
  const seed =
    typeof options.seed === "string"
      ? seedFromString(options.seed)
      : options.seed ?? seedFromString(options.title + difficulty);
  const rng = createRng(seed);

  const solutionGrid = generateFullSolution(rng);
  const puzzleGrid = solutionGrid.map((row) => row.slice());

  const targetClues = DIFFICULTY_CLUES[difficulty];
  const cells = shuffle(
    rng,
    Array.from({ length: SIZE * SIZE }, (_, i) => [Math.floor(i / SIZE), i % SIZE] as const)
  );

  let remainingClues = SIZE * SIZE;
  for (const [row, col] of cells) {
    if (remainingClues <= targetClues) break;
    const backup = puzzleGrid[row][col];
    if (backup === 0) continue;
    puzzleGrid[row][col] = 0;
    if (countSolutions(puzzleGrid, 2) !== 1) {
      puzzleGrid[row][col] = backup; // removing this cell breaks uniqueness
      continue;
    }
    remainingClues--;
  }

  return {
    puzzle: { type: "sudoku", title: options.title, difficulty, size: SIZE, puzzle: puzzleGrid },
    solution: { grid: solutionGrid },
  };
}

export function validateSudoku(puzzle: SudokuPuzzle, solution: SudokuSolution): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const given = puzzle.puzzle[r][c];
      if (given !== 0 && given !== solution.grid[r][c]) {
        issues.push({
          level: "error",
          message: `Given clue at (${r},${c}) does not match the answer key.`,
        });
      }
    }
  }

  // Verify the solution itself is a valid completed Sudoku.
  const check = emptyGrid();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = solution.grid[r][c];
      if (v < 1 || v > 9) {
        issues.push({ level: "error", message: `Solution cell (${r},${c}) is out of range.` });
        continue;
      }
      if (!isSafe(check, r, c, v)) {
        issues.push({ level: "error", message: `Solution violates Sudoku rules at (${r},${c}).` });
      } else {
        check[r][c] = v;
      }
    }
  }

  const solutionCount = countSolutions(puzzle.puzzle, 2);
  if (solutionCount === 0) {
    issues.push({ level: "error", message: "Puzzle has no valid solution." });
  } else if (solutionCount > 1) {
    issues.push({ level: "error", message: "Puzzle does not have a unique solution." });
  }

  const clueCount = puzzle.puzzle.flat().filter((v) => v !== 0).length;
  if (clueCount < 17) {
    issues.push({
      level: "warning",
      message: `Only ${clueCount} clues given; puzzles below 17 clues cannot be uniquely solvable.`,
    });
  }

  return issues;
}
