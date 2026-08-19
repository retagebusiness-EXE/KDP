import { createRng, randInt, shuffle, seedFromString } from "./rng";
import type { Difficulty, ValidationIssue } from "./types";

export type WordSearchDirection =
  | "E" // left-to-right
  | "S" // top-to-bottom
  | "SE" // diagonal down-right
  | "SW" // diagonal down-left
  | "W" // right-to-left (reverse horizontal)
  | "N" // bottom-to-top (reverse vertical)
  | "NE" // diagonal up-right (reverse)
  | "NW"; // diagonal up-left (reverse)

const VECTORS: Record<WordSearchDirection, [number, number]> = {
  E: [0, 1],
  S: [1, 0],
  SE: [1, 1],
  SW: [1, -1],
  W: [0, -1],
  N: [-1, 0],
  NE: [-1, 1],
  NW: [-1, -1],
};

const DIFFICULTY_DIRECTIONS: Record<Difficulty, WordSearchDirection[]> = {
  EASY: ["E", "S"],
  MEDIUM: ["E", "S", "SE", "SW"],
  HARD: ["E", "S", "SE", "SW", "W", "N", "NE", "NW"],
};

const DIFFICULTY_MIN_SIZE: Record<Difficulty, number> = {
  EASY: 12,
  MEDIUM: 14,
  HARD: 16,
};

export interface WordPlacement {
  word: string;
  row: number;
  col: number;
  direction: WordSearchDirection;
}

export interface WordSearchPuzzle {
  type: "word_search";
  title: string;
  difficulty: Difficulty;
  rows: number;
  cols: number;
  words: string[];
  grid: string[][];
  placements: WordPlacement[];
}

export interface WordSearchSolution {
  /** rows x cols mask: true where a cell belongs to a placed word */
  mask: boolean[][];
  placements: WordPlacement[];
}

export interface GenerateWordSearchOptions {
  title: string;
  words: string[];
  difficulty?: Difficulty;
  size?: number; // optional explicit grid size override (square)
  seed?: number | string;
  maxAttemptsPerWord?: number;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function normalizeWord(word: string): string {
  return word.toUpperCase().replace(/[^A-Z]/g, "");
}

function inBounds(row: number, col: number, rows: number, cols: number): boolean {
  return row >= 0 && row < rows && col >= 0 && col < cols;
}

function canPlace(
  grid: (string | null)[][],
  word: string,
  row: number,
  col: number,
  direction: WordSearchDirection,
  rows: number,
  cols: number
): boolean {
  const [dr, dc] = VECTORS[direction];
  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    if (!inBounds(r, c, rows, cols)) return false;
    const existing = grid[r][c];
    if (existing !== null && existing !== word[i]) return false;
  }
  return true;
}

function place(
  grid: (string | null)[][],
  word: string,
  row: number,
  col: number,
  direction: WordSearchDirection
): void {
  const [dr, dc] = VECTORS[direction];
  for (let i = 0; i < word.length; i++) {
    grid[row + dr * i][col + dc * i] = word[i];
  }
}

/**
 * Generates a word search puzzle and its answer key together. The answer
 * key is derived directly from the placements used to build the grid, so it
 * is structurally impossible for the key to drift from the puzzle.
 */
export function generateWordSearch(options: GenerateWordSearchOptions): {
  puzzle: WordSearchPuzzle;
  solution: WordSearchSolution;
} {
  const difficulty = options.difficulty ?? "MEDIUM";
  const words = Array.from(
    new Set(options.words.map(normalizeWord).filter((w) => w.length >= 3))
  );
  if (words.length === 0) {
    throw new Error("At least one word (3+ letters) is required to generate a word search.");
  }

  const seed =
    typeof options.seed === "string"
      ? seedFromString(options.seed)
      : options.seed ?? seedFromString(options.title + words.join(","));
  const rng = createRng(seed);

  const longest = Math.max(...words.map((w) => w.length));
  let size = Math.max(options.size ?? 0, DIFFICULTY_MIN_SIZE[difficulty], longest + 1);

  const directions = DIFFICULTY_DIRECTIONS[difficulty];
  const maxAttemptsPerWord = options.maxAttemptsPerWord ?? 200;

  // Grow the grid until every word fits (guarantees "every requested word exists").
  let grid: (string | null)[][];
  let placements: WordPlacement[];

  for (let growth = 0; growth < 8; growth++) {
    grid = Array.from({ length: size }, () => Array<string | null>(size).fill(null));
    placements = [];
    const ordered = [...words].sort((a, b) => b.length - a.length);
    let allPlaced = true;

    for (const word of ordered) {
      let placed = false;
      for (let attempt = 0; attempt < maxAttemptsPerWord; attempt++) {
        const direction = directions[randInt(rng, 0, directions.length)];
        const row = randInt(rng, 0, size);
        const col = randInt(rng, 0, size);
        if (canPlace(grid, word, row, col, direction, size, size)) {
          place(grid, word, row, col, direction);
          placements.push({ word, row, col, direction });
          placed = true;
          break;
        }
      }
      if (!placed) {
        allPlaced = false;
        break;
      }
    }

    if (allPlaced) break;
    size += 2;
  }

  // @ts-expect-error assigned in loop above, always set after loop runs at least once
  const finalGrid: (string | null)[][] = grid;
  // @ts-expect-error same as above
  const finalPlacements: WordPlacement[] = placements;

  if (finalPlacements.length !== words.length) {
    throw new Error(
      `Could not place all words even after growing the grid to ${size}x${size}. ` +
        `Remove very long or overlapping words and try again.`
    );
  }

  // Fill remaining cells with random letters.
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (finalGrid[r][c] === null) {
        finalGrid[r][c] = ALPHABET[randInt(rng, 0, ALPHABET.length)];
      }
    }
  }

  const mask: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  for (const p of finalPlacements) {
    const [dr, dc] = VECTORS[p.direction];
    for (let i = 0; i < p.word.length; i++) {
      mask[p.row + dr * i][p.col + dc * i] = true;
    }
  }

  const puzzle: WordSearchPuzzle = {
    type: "word_search",
    title: options.title,
    difficulty,
    rows: size,
    cols: size,
    words: shuffle(rng, words),
    grid: finalGrid as string[][],
    placements: finalPlacements,
  };

  const solution: WordSearchSolution = { mask, placements: finalPlacements };

  return { puzzle, solution };
}

/**
 * Independently re-derives placement correctness from the grid so a corrupted
 * or hand-edited puzzle can be caught before export.
 */
export function validateWordSearch(
  puzzle: WordSearchPuzzle,
  solution: WordSearchSolution
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { rows, cols, grid, words, placements } = puzzle;

  if (grid.length !== rows || grid.some((row) => row.length !== cols)) {
    issues.push({ level: "error", message: "Grid dimensions do not match declared rows/cols." });
  }
  for (const row of grid) {
    for (const cell of row) {
      if (!cell || cell.length !== 1) {
        issues.push({ level: "error", message: "Grid contains a blank or invalid cell." });
        break;
      }
    }
  }

  const placedWords = new Set(placements.map((p) => p.word));
  for (const word of words) {
    if (!placedWords.has(word)) {
      issues.push({ level: "error", message: `Word "${word}" has no placement.` });
    }
  }
  if (placements.length !== words.length) {
    issues.push({
      level: "error",
      message: `Placement count (${placements.length}) does not match word count (${words.length}).`,
    });
  }

  for (const p of placements) {
    const [dr, dc] = VECTORS[p.direction];
    for (let i = 0; i < p.word.length; i++) {
      const r = p.row + dr * i;
      const c = p.col + dc * i;
      if (!inBounds(r, c, rows, cols)) {
        issues.push({ level: "error", message: `Placement for "${p.word}" goes out of bounds.` });
        break;
      }
      if (grid[r]?.[c] !== p.word[i]) {
        issues.push({
          level: "error",
          message: `Grid letter mismatch for "${p.word}" at (${r},${c}).`,
        });
        break;
      }
      if (!solution.mask[r]?.[c]) {
        issues.push({
          level: "error",
          message: `Answer key mask missing cell (${r},${c}) claimed by "${p.word}".`,
        });
        break;
      }
    }
  }

  const maskCount = solution.mask.flat().filter(Boolean).length;
  const placementCellCount = placements.reduce((sum, p) => sum + p.word.length, 0);
  if (maskCount > placementCellCount) {
    issues.push({
      level: "warning",
      message: "Answer key marks more cells than the placements account for (possible overlap).",
    });
  }

  return issues;
}
