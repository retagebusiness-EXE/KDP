import { createRng, seedFromString, shuffle } from "./rng";
import type { Difficulty, ValidationIssue } from "./types";

export type CrosswordDirection = "across" | "down";

export interface CrosswordEntry {
  number: number;
  direction: CrosswordDirection;
  word: string;
  row: number;
  col: number;
  clue: string;
}

export interface CrosswordPuzzle {
  type: "crossword";
  title: string;
  difficulty: Difficulty;
  rows: number;
  cols: number;
  /** true = blocked/black cell, false = playable cell */
  blocked: boolean[][];
  entries: CrosswordEntry[];
  /** words that could not be fit into the grid; caller should either drop or retry with a different word list */
  unplacedWords: string[];
}

export interface CrosswordSolution {
  /** letters for playable cells, null for blocked cells; the single source of truth for entry.word values */
  grid: (string | null)[][];
}

interface Placement {
  word: string;
  row: number;
  col: number;
  direction: CrosswordDirection;
}

const DIFFICULTY_SIZE: Record<Difficulty, number> = {
  EASY: 13,
  MEDIUM: 15,
  HARD: 17,
};

function normalizeWord(word: string): string {
  return word.toUpperCase().replace(/[^A-Z]/g, "");
}

function inBounds(row: number, col: number, size: number): boolean {
  return row >= 0 && row < size && col >= 0 && col < size;
}

function canPlace(
  cells: (string | null)[][],
  word: string,
  row: number,
  col: number,
  direction: CrosswordDirection,
  size: number
): boolean {
  const dr = direction === "down" ? 1 : 0;
  const dc = direction === "across" ? 1 : 0;

  const beforeR = row - dr;
  const beforeC = col - dc;
  if (inBounds(beforeR, beforeC, size) && cells[beforeR][beforeC] !== null) return false;
  const afterR = row + dr * word.length;
  const afterC = col + dc * word.length;
  if (inBounds(afterR, afterC, size) && cells[afterR][afterC] !== null) return false;

  let hasIntersection = false;
  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    if (!inBounds(r, c, size)) return false;
    const existing = cells[r][c];
    if (existing !== null) {
      if (existing !== word[i]) return false;
      hasIntersection = true;
    } else {
      // New cell: perpendicular neighbors must be empty so we don't fuse into an unintended word.
      const perpR = direction === "across" ? r - 1 : r;
      const perpC = direction === "across" ? c : c - 1;
      const perpR2 = direction === "across" ? r + 1 : r;
      const perpC2 = direction === "across" ? c : c + 1;
      if (inBounds(perpR, perpC, size) && cells[perpR][perpC] !== null) return false;
      if (inBounds(perpR2, perpC2, size) && cells[perpR2][perpC2] !== null) return false;
    }
  }
  return hasIntersection;
}

export interface GenerateCrosswordOptions {
  title: string;
  words: string[];
  difficulty?: Difficulty;
  seed?: number | string;
}

/**
 * Builds a crossword grid purely algorithmically (greedy intersection search,
 * multiple passes, deterministic via seeded RNG). Clue text is attached later
 * via `applyClues` — the AI never touches the grid or the answers themselves,
 * only the human-readable clue strings.
 */
export function generateCrosswordLayout(options: GenerateCrosswordOptions): {
  puzzle: CrosswordPuzzle;
  solution: CrosswordSolution;
} {
  const difficulty = options.difficulty ?? "MEDIUM";
  const words = Array.from(
    new Set(options.words.map(normalizeWord).filter((w) => w.length >= 3))
  );
  if (words.length === 0) {
    throw new Error("At least one word (3+ letters) is required to generate a crossword.");
  }

  const seed =
    typeof options.seed === "string"
      ? seedFromString(options.seed)
      : options.seed ?? seedFromString(options.title + words.join(","));
  const rng = createRng(seed);

  const longest = Math.max(...words.map((w) => w.length));
  const size = Math.max(DIFFICULTY_SIZE[difficulty], longest + 4);

  const cells: (string | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  const placements: Placement[] = [];
  const unplaced: string[] = [];

  const sorted = [...words].sort((a, b) => b.length - a.length);
  const first = sorted[0];
  const firstRow = Math.floor(size / 2);
  const firstCol = Math.floor((size - first.length) / 2);
  for (let i = 0; i < first.length; i++) cells[firstRow][firstCol + i] = first[i];
  placements.push({ word: first, row: firstRow, col: firstCol, direction: "across" });

  let remaining = sorted.slice(1);

  for (let pass = 0; pass < 3 && remaining.length > 0; pass++) {
    const stillRemaining: string[] = [];
    for (const word of shuffle(rng, remaining)) {
      const candidates: Placement[] = [];
      for (const existing of placements) {
        const crossDirection: CrosswordDirection = existing.direction === "across" ? "down" : "across";
        for (let wi = 0; wi < word.length; wi++) {
          for (let ei = 0; ei < existing.word.length; ei++) {
            if (word[wi] !== existing.word[ei]) continue;
            const intersectRow = existing.direction === "across" ? existing.row : existing.row + ei;
            const intersectCol = existing.direction === "across" ? existing.col + ei : existing.col;
            const row = crossDirection === "down" ? intersectRow - wi : intersectRow;
            const col = crossDirection === "across" ? intersectCol - wi : intersectCol;
            if (canPlace(cells, word, row, col, crossDirection, size)) {
              candidates.push({ word, row, col, direction: crossDirection });
            }
          }
        }
      }
      if (candidates.length > 0) {
        const chosen = candidates[Math.floor(rng() * candidates.length)];
        const dr = chosen.direction === "down" ? 1 : 0;
        const dc = chosen.direction === "across" ? 1 : 0;
        for (let i = 0; i < word.length; i++) {
          cells[chosen.row + dr * i][chosen.col + dc * i] = word[i];
        }
        placements.push(chosen);
      } else {
        stillRemaining.push(word);
      }
    }
    remaining = stillRemaining;
  }
  unplaced.push(...remaining);

  // Number entries per standard crossword numbering (row-major scan).
  const startsAcross = new Set<string>();
  const startsDown = new Set<string>();
  for (const p of placements) {
    const key = `${p.row},${p.col}`;
    if (p.direction === "across") startsAcross.add(key);
    else startsDown.add(key);
  }

  const entries: CrosswordEntry[] = [];
  let number = 1;
  const numbering = new Map<string, number>();
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const key = `${r},${c}`;
      if (startsAcross.has(key) || startsDown.has(key)) {
        numbering.set(key, number);
        number++;
      }
    }
  }
  for (const p of placements) {
    const key = `${p.row},${p.col}`;
    entries.push({
      number: numbering.get(key)!,
      direction: p.direction,
      word: p.word,
      row: p.row,
      col: p.col,
      clue: "",
    });
  }
  entries.sort((a, b) => a.number - b.number || (a.direction === "across" ? -1 : 1));

  const blocked: boolean[][] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => cells[r][c] === null)
  );

  const puzzle: CrosswordPuzzle = {
    type: "crossword",
    title: options.title,
    difficulty,
    rows: size,
    cols: size,
    blocked,
    entries,
    unplacedWords: unplaced,
  };
  const solution: CrosswordSolution = { grid: cells };

  return { puzzle, solution };
}

/**
 * Attaches AI-generated clue text to entries. Clues are matched by
 * `word+row+col+direction` identity, and the function never changes the
 * answer grid — only clue strings — so answers can't drift from clues.
 */
export function applyClues(
  puzzle: CrosswordPuzzle,
  clues: Map<string, string>
): CrosswordPuzzle {
  const entries = puzzle.entries.map((entry) => {
    const key = entryKey(entry);
    const clue = clues.get(key);
    if (!clue) return entry;
    return { ...entry, clue };
  });
  return { ...puzzle, entries };
}

export function entryKey(entry: Pick<CrosswordEntry, "word" | "row" | "col" | "direction">): string {
  return `${entry.word}:${entry.row}:${entry.col}:${entry.direction}`;
}

export function validateCrossword(
  puzzle: CrosswordPuzzle,
  solution: CrosswordSolution
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { rows, cols, blocked, entries } = puzzle;

  if (solution.grid.length !== rows || solution.grid.some((row) => row.length !== cols)) {
    issues.push({ level: "error", message: "Solution grid dimensions do not match puzzle." });
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const letter = solution.grid[r]?.[c];
      if (blocked[r][c] && letter !== null) {
        issues.push({ level: "error", message: `Blocked cell (${r},${c}) has a letter in the answer key.` });
      }
      if (!blocked[r][c] && (letter === null || letter === undefined)) {
        issues.push({ level: "error", message: `Playable cell (${r},${c}) is missing a letter in the answer key.` });
      }
    }
  }

  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.word)) {
      issues.push({ level: "error", message: `Duplicate answer "${entry.word}" appears more than once.` });
    }
    seen.add(entry.word);

    const dr = entry.direction === "down" ? 1 : 0;
    const dc = entry.direction === "across" ? 1 : 0;
    for (let i = 0; i < entry.word.length; i++) {
      const r = entry.row + dr * i;
      const c = entry.col + dc * i;
      if (solution.grid[r]?.[c] !== entry.word[i]) {
        issues.push({
          level: "error",
          message: `Entry ${entry.number}-${entry.direction} ("${entry.word}") does not match the answer key at (${r},${c}).`,
        });
        break;
      }
    }

    if (!entry.clue || entry.clue.trim().length === 0) {
      issues.push({ level: "warning", message: `Entry ${entry.number}-${entry.direction} has no clue text yet.` });
    }
  }

  if (puzzle.unplacedWords.length > 0) {
    issues.push({
      level: "warning",
      message: `${puzzle.unplacedWords.length} word(s) could not be placed in the grid: ${puzzle.unplacedWords.join(", ")}.`,
    });
  }

  return issues;
}
