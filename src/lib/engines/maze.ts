import { createRng, seedFromString, shuffle } from "./rng";
import type { Difficulty, ValidationIssue } from "./types";

export interface MazeCell {
  row: number;
  col: number;
}

export interface MazePuzzle {
  type: "maze";
  title: string;
  difficulty: Difficulty;
  rows: number;
  cols: number;
  /** wall bitmask per cell: bit 0=N,1=E,2=S,3=W set means a wall is present */
  walls: number[][];
  start: MazeCell;
  end: MazeCell;
}

export interface MazeSolution {
  path: MazeCell[]; // ordered cells from start to end
}

const N = 1;
const E = 2;
const S = 4;
const W = 8;
const OPPOSITE: Record<number, number> = { [N]: S, [S]: N, [E]: W, [W]: E };
const DELTA: Record<number, [number, number]> = {
  [N]: [-1, 0],
  [S]: [1, 0],
  [E]: [0, 1],
  [W]: [0, -1],
};

const DIFFICULTY_SIZE: Record<Difficulty, number> = {
  EASY: 10,
  MEDIUM: 16,
  HARD: 22,
};

/** Fraction of interior walls randomly knocked down after carving, to add loops (harder to solve visually). */
const DIFFICULTY_BRAID: Record<Difficulty, number> = {
  EASY: 0,
  MEDIUM: 0.03,
  HARD: 0.08,
};

export interface GenerateMazeOptions {
  title: string;
  difficulty?: Difficulty;
  size?: number;
  seed?: number | string;
}

/**
 * Carves a perfect maze with recursive backtracking (every cell reachable
 * from every other cell via exactly one path), then optionally removes a
 * few extra walls ("braiding") for harder difficulties. A perfect maze is
 * solvable by construction; braiding only adds alternate routes, so
 * solvability is preserved and re-verified by validateMaze via BFS.
 */
export function generateMaze(options: GenerateMazeOptions): {
  puzzle: MazePuzzle;
  solution: MazeSolution;
} {
  const difficulty = options.difficulty ?? "MEDIUM";
  const size = options.size ?? DIFFICULTY_SIZE[difficulty];
  const seed =
    typeof options.seed === "string"
      ? seedFromString(options.seed)
      : options.seed ?? seedFromString(options.title + difficulty);
  const rng = createRng(seed);

  const rows = size;
  const cols = size;
  const walls: number[][] = Array.from({ length: rows }, () => Array(cols).fill(N | E | S | W));
  const visited: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));

  function carve(row: number, col: number) {
    visited[row][col] = true;
    const dirs = shuffle(rng, [N, E, S, W]);
    for (const dir of dirs) {
      const [dr, dc] = DELTA[dir];
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || visited[nr][nc]) continue;
      walls[row][col] &= ~dir;
      walls[nr][nc] &= ~OPPOSITE[dir];
      carve(nr, nc);
    }
  }

  carve(0, 0);

  const braidChance = DIFFICULTY_BRAID[difficulty];
  if (braidChance > 0) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        for (const dir of [N, E, S, W]) {
          if (!(walls[r][c] & dir)) continue; // already open
          const [dr, dc] = DELTA[dir];
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          if (rng() < braidChance) {
            walls[r][c] &= ~dir;
            walls[nr][nc] &= ~OPPOSITE[dir];
          }
        }
      }
    }
  }

  const start: MazeCell = { row: 0, col: 0 };
  const end: MazeCell = { row: rows - 1, col: cols - 1 };
  const path = solveMaze(walls, rows, cols, start, end);
  if (!path) {
    throw new Error("Generated maze has no path from start to end (this should never happen).");
  }

  return {
    puzzle: { type: "maze", title: options.title, difficulty, rows, cols, walls, start, end },
    solution: { path },
  };
}

function solveMaze(
  walls: number[][],
  rows: number,
  cols: number,
  start: MazeCell,
  end: MazeCell
): MazeCell[] | null {
  const key = (r: number, c: number) => r * cols + c;
  const prev = new Map<number, number>();
  const queue: MazeCell[] = [start];
  const seen = new Set<number>([key(start.row, start.col)]);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.row === end.row && cur.col === end.col) {
      const path: MazeCell[] = [cur];
      let k = key(cur.row, cur.col);
      while (prev.has(k)) {
        k = prev.get(k)!;
        path.push({ row: Math.floor(k / cols), col: k % cols });
      }
      return path.reverse();
    }
    const cellWalls = walls[cur.row][cur.col];
    for (const dir of [N, E, S, W]) {
      if (cellWalls & dir) continue;
      const [dr, dc] = DELTA[dir];
      const nr = cur.row + dr;
      const nc = cur.col + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const nk = key(nr, nc);
      if (seen.has(nk)) continue;
      seen.add(nk);
      prev.set(nk, key(cur.row, cur.col));
      queue.push({ row: nr, col: nc });
    }
  }
  return null;
}

export function validateMaze(puzzle: MazePuzzle, solution: MazeSolution): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { rows, cols, walls, start, end } = puzzle;

  if (walls.length !== rows || walls.some((row) => row.length !== cols)) {
    issues.push({ level: "error", message: "Wall grid dimensions do not match rows/cols." });
  }

  const recomputed = solveMaze(walls, rows, cols, start, end);
  if (!recomputed) {
    issues.push({ level: "error", message: "No path exists between start and end." });
    return issues;
  }

  if (recomputed.length !== solution.path.length) {
    issues.push({
      level: "warning",
      message: "Stored answer path is not the shortest path (cosmetic only, still valid if connected).",
    });
  }

  for (let i = 0; i < solution.path.length - 1; i++) {
    const a = solution.path[i];
    const b = solution.path[i + 1];
    const dr = b.row - a.row;
    const dc = b.col - a.col;
    const dir = Object.entries(DELTA).find(([, [ddr, ddc]]) => ddr === dr && ddc === dc)?.[0];
    if (!dir || walls[a.row][a.col] & Number(dir)) {
      issues.push({
        level: "error",
        message: `Answer path step ${i} moves through a wall.`,
      });
      break;
    }
  }

  const last = solution.path[solution.path.length - 1];
  if (!last || last.row !== end.row || last.col !== end.col) {
    issues.push({ level: "error", message: "Answer path does not end at the maze exit." });
  }
  const first = solution.path[0];
  if (!first || first.row !== start.row || first.col !== start.col) {
    issues.push({ level: "error", message: "Answer path does not start at the maze entrance." });
  }

  return issues;
}
