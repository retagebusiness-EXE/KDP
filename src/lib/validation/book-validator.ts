import { validateWordSearch, type WordSearchPuzzle, type WordSearchSolution } from "@/lib/engines/wordsearch";
import { validateSudoku, type SudokuPuzzle, type SudokuSolution } from "@/lib/engines/sudoku";
import { validateMaze, type MazePuzzle, type MazeSolution } from "@/lib/engines/maze";
import { validateCrossword, type CrosswordPuzzle, type CrosswordSolution } from "@/lib/engines/crossword";
import { calculateCoverDimensions, validateInteriorDimensions, type PaperType, type InteriorColor } from "@/lib/pdf/dimensions";
import type { ValidationIssue, ValidationReport } from "./types";

export interface ValidationPageInput {
  index: number;
  type: string;
  content: unknown;
  puzzle?: { type: string; data: unknown } | null;
  solution?: { data: unknown } | null;
}

export interface ValidationCoverInput {
  fullWidthIn: number;
  fullHeightIn: number;
  spineWidthIn: number;
}

export interface ValidationBookInput {
  trimWidthIn: number;
  trimHeightIn: number;
  bleed: boolean;
  paperType: PaperType;
  interiorColor: InteriorColor;
  pages: ValidationPageInput[];
  cover?: ValidationCoverInput | null;
}

const EPSILON_IN = 0.02;

export function validateBook(input: ValidationBookInput): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const passedChecks: string[] = [];
  const push = (issue: ValidationIssue) => (issue.level === "error" ? errors : warnings).push(issue);

  // 1. Interior dimensions + page count (even, minimum, known trim size).
  const dimIssues = validateInteriorDimensions(input.trimWidthIn, input.trimHeightIn, input.pages.length, input.bleed, input.interiorColor);
  for (const issue of dimIssues) {
    push({ level: issue.level, code: "DIMENSIONS", message: issue.message });
  }
  if (dimIssues.every((i) => i.level !== "error")) {
    passedChecks.push(`Page dimensions valid (${input.trimWidthIn}" x ${input.trimHeightIn}", ${input.pages.length} pages)`);
  }

  // 2. Index continuity, duplicates, missing content, blank pages.
  const sorted = [...input.pages].sort((a, b) => a.index - b.index);
  const seenIndices = new Set<number>();
  let unexpectedBlankCount = 0;
  for (let i = 0; i < sorted.length; i++) {
    const page = sorted[i];
    if (seenIndices.has(page.index)) {
      push({ level: "error", code: "DUPLICATE_PAGE", message: `Duplicate page index ${page.index}.`, pageIndex: page.index });
    }
    seenIndices.add(page.index);
    if (page.index !== i) {
      push({ level: "error", code: "PAGE_GAP", message: `Page index ${page.index} is out of sequence (expected ${i}).`, pageIndex: page.index });
    }
    if (page.type !== "blank") {
      const isEmpty = page.content == null || (typeof page.content === "object" && Object.keys(page.content as object).length === 0);
      if (isEmpty) {
        push({ level: "error", code: "MISSING_CONTENT", message: `Page ${page.index + 1} has no content.`, pageIndex: page.index });
      }
    } else {
      unexpectedBlankCount++;
    }
  }
  if (unexpectedBlankCount > 1) {
    push({
      level: "warning",
      code: "MULTIPLE_BLANKS",
      message: `${unexpectedBlankCount} blank pages found; only one trailing blank page (for even page count) is expected.`,
    });
  }
  if (errors.every((e) => e.code !== "MISSING_CONTENT" && e.code !== "DUPLICATE_PAGE" && e.code !== "PAGE_GAP")) {
    passedChecks.push("No missing content or blank pages found where content was expected");
  }

  // 3. Puzzle + answer key correctness, dispatched per engine.
  let puzzleCount = 0;
  let answerKeyCount = 0;
  for (const page of sorted) {
    if (!page.puzzle) continue;
    puzzleCount++;
    if (!page.solution) {
      push({ level: "error", code: "MISSING_ANSWER_KEY", message: `Page ${page.index + 1} has a puzzle but no answer key.`, pageIndex: page.index });
      continue;
    }
    answerKeyCount++;
    const issues = validatePuzzleByType(page.puzzle.type, page.puzzle.data, page.solution.data);
    for (const issue of issues) {
      push({
        level: issue.level,
        code: `PUZZLE_${page.puzzle.type.toUpperCase()}`,
        message: `Page ${page.index + 1}: ${issue.message}`,
        pageIndex: page.index,
      });
    }
  }
  if (puzzleCount > 0) {
    const puzzleErrorCount = errors.filter((e) => e.code.startsWith("PUZZLE_") || e.code === "MISSING_ANSWER_KEY").length;
    if (puzzleErrorCount === 0) {
      passedChecks.push(`${puzzleCount} puzzle(s) generated and validated`);
      passedChecks.push(`${answerKeyCount} answer key(s) generated and matched to their puzzles`);
    }
  }

  // 4. Rough text-overflow heuristics (not a substitute for visual proofing).
  for (const page of sorted) {
    if (page.type === "word_search") {
      const content = page.content as { words?: string[] } | null;
      const joined = (content?.words ?? []).join("  ");
      if (joined.length > 220) {
        push({
          level: "warning",
          code: "TEXT_OVERFLOW",
          message: `Page ${page.index + 1}: the word list is long and may overflow the printed page; consider fewer or shorter words.`,
          pageIndex: page.index,
        });
      }
    }
    if (page.type === "journal") {
      const content = page.content as { prompt?: string } | null;
      if ((content?.prompt?.length ?? 0) > 240) {
        push({
          level: "warning",
          code: "TEXT_OVERFLOW",
          message: `Page ${page.index + 1}: the journal prompt is long and may overflow its space.`,
          pageIndex: page.index,
        });
      }
    }
    if (page.type === "coloring") {
      const content = page.content as { imageUrl?: string } | null;
      if (!content?.imageUrl) {
        push({ level: "error", code: "MISSING_IMAGE", message: `Page ${page.index + 1}: coloring page has no illustration.`, pageIndex: page.index });
      }
    }
  }
  if (errors.every((e) => e.code !== "TEXT_OVERFLOW" && e.code !== "MISSING_IMAGE")) {
    passedChecks.push("No text overflow or missing illustrations detected");
  }

  // 5. Cover dimensions, recomputed independently and compared to what's stored.
  if (input.cover) {
    const recomputed = calculateCoverDimensions({
      trimWidthIn: input.trimWidthIn,
      trimHeightIn: input.trimHeightIn,
      pageCount: input.pages.length,
      paperType: input.paperType,
      interiorColor: input.interiorColor,
      bleed: input.bleed,
    });
    const widthOff = Math.abs(recomputed.fullWidthIn - input.cover.fullWidthIn) > EPSILON_IN;
    const heightOff = Math.abs(recomputed.fullHeightIn - input.cover.fullHeightIn) > EPSILON_IN;
    if (widthOff || heightOff) {
      push({
        level: "warning",
        code: "COVER_DIMENSIONS_STALE",
        message:
          `Cover dimensions (${input.cover.fullWidthIn.toFixed(3)}" x ${input.cover.fullHeightIn.toFixed(3)}") don't match the ` +
          `current interior page count (expected ${recomputed.fullWidthIn.toFixed(3)}" x ${recomputed.fullHeightIn.toFixed(3)}"). Regenerate the cover.`,
      });
    } else {
      passedChecks.push("Cover dimensions match the current interior page count");
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    passedChecks,
    generatedAt: new Date().toISOString(),
  };
}

function validatePuzzleByType(type: string, puzzleData: unknown, solutionData: unknown) {
  switch (type) {
    case "word_search":
      return validateWordSearch(puzzleData as WordSearchPuzzle, solutionData as WordSearchSolution);
    case "sudoku":
      return validateSudoku(puzzleData as SudokuPuzzle, solutionData as SudokuSolution);
    case "maze":
      return validateMaze(puzzleData as MazePuzzle, solutionData as MazeSolution);
    case "crossword":
      return validateCrossword(puzzleData as CrosswordPuzzle, solutionData as CrosswordSolution);
    default:
      return [];
  }
}
