import type { AIProvider, AIUsage } from "@/lib/ai/types";
import { ORIGINALITY_INSTRUCTION } from "@/lib/ai/safety";
import {
  generateWordSearch,
  type WordSearchPuzzle,
  type WordSearchSolution,
} from "@/lib/engines/wordsearch";
import {
  applyClues,
  entryKey,
  generateCrosswordLayout,
  type CrosswordPuzzle,
  type CrosswordSolution,
} from "@/lib/engines/crossword";
import { generateSudoku, type SudokuPuzzle, type SudokuSolution } from "@/lib/engines/sudoku";
import { generateMaze, type MazePuzzle, type MazeSolution } from "@/lib/engines/maze";
import type { Difficulty } from "@/lib/engines/types";
import type { BookTypeId } from "./book-types";

export interface BookContext {
  title: string;
  topic: string;
  audience: string;
  difficulty: Difficulty;
  description?: string;
  bookType: BookTypeId;
  trimWidthIn?: number;
  trimHeightIn?: number;
}

export interface GeneratedPage {
  type: string;
  title: string;
  content: unknown;
  puzzle?: { type: string; difficulty: string; data: unknown };
  solution?: { data: unknown };
  usage: AIUsage;
}

const ZERO_USAGE: AIUsage = { inputTokens: 0, outputTokens: 0 };

function wordCountFor(difficulty: Difficulty): number {
  return { EASY: 8, MEDIUM: 12, HARD: 16 }[difficulty];
}

const LOG_COLUMN_BANKS: Record<string, string[]> = {
  fitness: ["Date", "Exercise", "Duration", "Calories", "Notes"],
  workout: ["Date", "Exercise", "Sets x Reps", "Weight", "Notes"],
  water: ["Date", "Time", "Amount (oz)", "Notes"],
  sleep: ["Date", "Bedtime", "Wake Time", "Hours Slept", "Notes"],
  food: ["Date", "Meal", "Description", "Calories", "Notes"],
  mood: ["Date", "Mood", "Energy Level", "Notes"],
  expense: ["Date", "Category", "Amount", "Notes"],
  reading: ["Date", "Book Title", "Pages Read", "Notes"],
};

function pickLogColumns(topic: string): string[] {
  const key = topic.toLowerCase();
  for (const [bank, columns] of Object.entries(LOG_COLUMN_BANKS)) {
    if (key.includes(bank)) return columns;
  }
  return ["Date", "Activity", "Notes", "Details"];
}

export async function generateTitlePageContent(ctx: BookContext, ai: AIProvider): Promise<GeneratedPage> {
  const { data, usage } = await ai.generateJSON<{ tagline: string }>(
    `Write a short, punchy, original tagline for a ${ctx.bookType.replace("_", " ")} book titled ` +
      `"${ctx.title}" about "${ctx.topic}" for ${ctx.audience}. One sentence, no quotes. ${ORIGINALITY_INSTRUCTION}`,
    { mockKind: "cover_copy", mockContext: { topic: ctx.topic } }
  );
  return {
    type: "title",
    title: ctx.title,
    content: { title: ctx.title, tagline: data.tagline, topic: ctx.topic, audience: ctx.audience },
    usage,
  };
}

export async function generatePageContent(
  ctx: BookContext,
  ordinal: number,
  seed: string,
  ai: AIProvider,
  usedColoringSubjects: string[] = [],
  usedWords: string[] = []
): Promise<GeneratedPage> {
  switch (ctx.bookType) {
    case "word_search":
      return generateWordSearchPage(ctx, ordinal, seed, ai, ctx.difficulty, undefined, usedWords);
    case "crossword":
      return generateCrosswordPage(ctx, ordinal, seed, ai);
    case "sudoku":
    case "number_puzzle":
      return generateSudokuPage(ctx, ordinal, seed);
    case "maze":
      return generateMazePage(ctx, ordinal, seed, ctx.difficulty);
    case "kids_activity":
      return ordinal % 2 === 0
        ? generateWordSearchPage(ctx, ordinal, seed, ai, "EASY", 6, usedWords)
        : generateMazePage(ctx, ordinal, seed, "EASY");
    case "coloring":
      return generateColoringPage(ctx, ordinal, seed, ai, usedColoringSubjects);
    case "journal":
      return generateJournalPage(ctx, ordinal, seed, ai);
    case "planner":
      return generatePlannerPage(ctx, ordinal, seed);
    case "log_book":
      return generateLogBookPage(ctx, ordinal, seed);
    case "notebook":
      return generateNotebookPage(ctx, ordinal, seed);
    default:
      throw new Error(`No page generator for book type "${ctx.bookType}"`);
  }
}

async function generateWordSearchPage(
  ctx: BookContext,
  ordinal: number,
  seed: string,
  ai: AIProvider,
  difficulty: Difficulty,
  wordCountOverride?: number,
  usedWords: string[] = []
): Promise<GeneratedPage> {
  const count = wordCountOverride ?? wordCountFor(difficulty);
  const avoidance = usedWords.length
    ? ` Do not repeat any of these words already used elsewhere in this same book: ${usedWords.join(", ")}.`
    : "";
  const { data: words, usage } = await ai.generateJSON<string[]>(
    `Generate ${count} distinct single words or short phrases (3-12 letters, no spaces) related to ` +
      `"${ctx.topic}" for page ${ordinal + 1} of a word search puzzle book aimed at ${ctx.audience}.${avoidance} ` +
      `Return only the words. ${ORIGINALITY_INSTRUCTION}`,
    { mockKind: "word_list", mockContext: { topic: ctx.topic, count, ordinal, usedWords } }
  );

  const title = `${ctx.topic} #${ordinal + 1}`;
  const { puzzle, solution } = generateWordSearch({ title, words, difficulty, seed });

  return {
    type: "word_search",
    title,
    content: puzzleToPrintable(puzzle),
    puzzle: { type: "word_search", difficulty, data: puzzle },
    solution: { data: solution },
    usage,
  };
}

function puzzleToPrintable(puzzle: WordSearchPuzzle) {
  // The printable page never needs the answer mask, only the grid + word list.
  return { rows: puzzle.rows, cols: puzzle.cols, grid: puzzle.grid, words: puzzle.words, title: puzzle.title };
}

async function generateCrosswordPage(
  ctx: BookContext,
  ordinal: number,
  seed: string,
  ai: AIProvider
): Promise<GeneratedPage> {
  const count = { EASY: 10, MEDIUM: 14, HARD: 18 }[ctx.difficulty];
  const { data: words, usage: wordsUsage } = await ai.generateJSON<string[]>(
    `Generate ${count} distinct single words (4-10 letters) related to "${ctx.topic}" suitable as ` +
      `crossword answers for puzzle ${ordinal + 1} aimed at ${ctx.audience}. ${ORIGINALITY_INSTRUCTION}`,
    { mockKind: "crossword_words", mockContext: { topic: ctx.topic, count, ordinal } }
  );

  const title = `${ctx.topic} Crossword #${ordinal + 1}`;
  const { puzzle, solution } = generateCrosswordLayout({ title, words, difficulty: ctx.difficulty, seed });

  const { data: clueMap, usage: cluesUsage } = await ai.generateJSON<Record<string, string>>(
    `Write one short, original crossword-style clue for each of these answers: ` +
      `${puzzle.entries.map((e) => e.word).join(", ")}. Topic: "${ctx.topic}". Return a JSON object mapping ` +
      `each answer word to its clue text. Never restate the answer inside the clue. ${ORIGINALITY_INSTRUCTION}`,
    { mockKind: "crossword_clues", mockContext: { words: puzzle.entries.map((e) => e.word) } }
  );

  const clues = new Map<string, string>();
  for (const entry of puzzle.entries) {
    const clue = clueMap[entry.word];
    if (clue) clues.set(entryKey(entry), clue);
  }
  const withClues = applyClues(puzzle, clues);

  return {
    type: "crossword",
    title,
    content: crosswordToPrintable(withClues),
    puzzle: { type: "crossword", difficulty: ctx.difficulty, data: withClues },
    solution: { data: solution },
    usage: { inputTokens: wordsUsage.inputTokens + cluesUsage.inputTokens, outputTokens: wordsUsage.outputTokens + cluesUsage.outputTokens },
  };
}

function crosswordToPrintable(puzzle: CrosswordPuzzle) {
  return {
    rows: puzzle.rows,
    cols: puzzle.cols,
    blocked: puzzle.blocked,
    title: puzzle.title,
    across: puzzle.entries.filter((e) => e.direction === "across").map((e) => ({ number: e.number, clue: e.clue, length: e.word.length })),
    down: puzzle.entries.filter((e) => e.direction === "down").map((e) => ({ number: e.number, clue: e.clue, length: e.word.length })),
    numbering: puzzle.entries.map((e) => ({ number: e.number, row: e.row, col: e.col })),
  };
}

function generateSudokuPage(ctx: BookContext, ordinal: number, seed: string): GeneratedPage {
  const title = `Sudoku #${ordinal + 1}`;
  const { puzzle, solution } = generateSudoku({ title, difficulty: ctx.difficulty, seed });
  return {
    type: ctx.bookType,
    title,
    content: { size: puzzle.size, grid: puzzle.puzzle, title },
    puzzle: { type: "sudoku", difficulty: ctx.difficulty, data: puzzle },
    solution: { data: solution },
    usage: ZERO_USAGE,
  };
}

function generateMazePage(ctx: BookContext, ordinal: number, seed: string, difficulty: Difficulty): GeneratedPage {
  const title = `Maze #${ordinal + 1}`;
  const { puzzle, solution } = generateMaze({ title, difficulty, seed });
  return {
    type: "maze",
    title,
    content: { rows: puzzle.rows, cols: puzzle.cols, walls: puzzle.walls, start: puzzle.start, end: puzzle.end, title },
    puzzle: { type: "maze", difficulty, data: puzzle },
    solution: { data: solution },
    usage: ZERO_USAGE,
  };
}

/** Print-quality target; KDP recommends >=300 DPI for interior images. */
const COLORING_IMAGE_DPI = 300;
/** Largest single dimension most image providers (e.g. DALL-E 3) accept. */
const COLORING_IMAGE_MAX_PX = 1792;

export function coloringImagePixelSize(ctx: BookContext): { width: number; height: number } {
  const trimWidthIn = ctx.trimWidthIn ?? 8.5;
  const trimHeightIn = ctx.trimHeightIn ?? 11;
  const rawWidth = trimWidthIn * COLORING_IMAGE_DPI;
  const rawHeight = trimHeightIn * COLORING_IMAGE_DPI;
  const scale = Math.min(1, COLORING_IMAGE_MAX_PX / Math.max(rawWidth, rawHeight));
  return { width: Math.round(rawWidth * scale), height: Math.round(rawHeight * scale) };
}

/**
 * Kids' coloring books need line complexity matched to the reader's age — a
 * toddler can't stay inside thin, detailed lines. Audience strings are free
 * text ("Kids ages 3-8"), so this is a best-effort heuristic, not a parser.
 */
function coloringAgeBand(audience: string): { styleInstruction: string } {
  const nums = audience.match(/\d+/g)?.map(Number) ?? [];
  const maxAge = nums.length ? Math.max(...nums) : 8;
  const key = audience.toLowerCase();
  if (/(toddler|preschool)/.test(key) || maxAge <= 4) {
    return {
      styleInstruction:
        "Use extra-thick, very simple outlines with one single large, chunky object filling most of the page " +
        "and almost no small details — easy for a toddler to color inside the lines.",
    };
  }
  if (maxAge <= 9) {
    return {
      styleInstruction:
        "Use thick, bold outlines with a simple, uncluttered composition and moderate detail — easy for a " +
        "young child to color inside the lines.",
    };
  }
  return {
    styleInstruction:
      "Use clean medium-weight outlines with richer scene detail and a few background elements — engaging " +
      "for an older child to color.",
  };
}

async function generateColoringPage(
  ctx: BookContext,
  ordinal: number,
  seed: string,
  ai: AIProvider,
  usedSubjects: string[]
): Promise<GeneratedPage> {
  const ageBand = coloringAgeBand(ctx.audience);
  const avoidance = usedSubjects.length
    ? ` Do not repeat any of these subjects/scenes already used elsewhere in this same book: ` +
      `${usedSubjects.slice(-8).join("; ")}. The scene must be clearly different from all of them.`
    : "";

  const { data, usage: promptUsage } = await ai.generateJSON<{ subject: string; prompt: string }>(
    `Invent one original, specific scene for page ${ordinal + 1} of a kids coloring book about "${ctx.topic}", ` +
      `suitable for ${ctx.audience}.${avoidance} Then write it as an image-generation prompt for a ` +
      `black-and-white line-art coloring page: ${ageBand.styleInstruction} Bold clean pure-black outlines on a ` +
      `white background, no shading, no gray tones, no color fills, no text or lettering, leave a small white ` +
      `margin around the artwork so nothing touches the edge. Return a JSON object with "subject" (a short ` +
      `3-6 word label for the scene, e.g. "fox flying a kite") and "prompt" (the full illustration description). ` +
      `${ORIGINALITY_INSTRUCTION}`,
    {
      mockKind: "coloring_prompt",
      mockContext: { topic: ctx.topic, audience: ctx.audience, ordinal, usedSubjects },
      temperature: 0.9,
    }
  );
  const subject = (data.subject || `${ctx.topic} scene`).trim();
  const title = subject.charAt(0).toUpperCase() + subject.slice(1);
  const image = await ai.generateImage(data.prompt, coloringImagePixelSize(ctx));
  return {
    type: "coloring",
    title,
    content: { imageUrl: image.url, title, prompt: data.prompt, subject },
    usage: { inputTokens: promptUsage.inputTokens + image.usage.inputTokens, outputTokens: promptUsage.outputTokens + image.usage.outputTokens },
  };
}

async function generateJournalPage(
  ctx: BookContext,
  ordinal: number,
  _seed: string,
  ai: AIProvider
): Promise<GeneratedPage> {
  const { text, usage } = await ai.generateText(
    `Write one short, original, reflective journaling prompt about "${ctx.topic}" for ${ctx.audience}. ` +
      `One sentence, no quotes. ${ORIGINALITY_INSTRUCTION}`
  );
  const title = `Journal Entry #${ordinal + 1}`;
  return {
    type: "journal",
    title,
    content: { prompt: text.replace(/^\[mock output for:.*?\]\s*token=\d+\s*/, "").trim() || `Reflect on ${ctx.topic}.`, lineCount: 22 },
    usage,
  };
}

function generatePlannerPage(ctx: BookContext, ordinal: number, _seed: string): GeneratedPage {
  const title = `Planner — Week ${ordinal + 1}`;
  return {
    type: "planner",
    title,
    content: {
      weekLabel: `Week ${ordinal + 1}`,
      sections: ["Top Priorities", "Schedule", "Notes"],
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    },
    usage: ZERO_USAGE,
  };
}

function generateLogBookPage(ctx: BookContext, ordinal: number, _seed: string): GeneratedPage {
  const title = `${ctx.topic} Log — Page ${ordinal + 1}`;
  return {
    type: "log_book",
    title,
    content: { columns: pickLogColumns(ctx.topic), rowCount: 22, title },
    usage: ZERO_USAGE,
  };
}

function generateNotebookPage(ctx: BookContext, ordinal: number, _seed: string): GeneratedPage {
  const styles = ["lined", "grid", "dot"] as const;
  const style = styles[ordinal % styles.length];
  return {
    type: "notebook",
    title: `Page ${ordinal + 1}`,
    content: { style },
    usage: ZERO_USAGE,
  };
}

export interface AnswerKeyBatchInput {
  ordinal: number;
  entries: { pageNumber: number; title: string; puzzleType: string; puzzleData: unknown; solutionData: unknown }[];
}

export function generateAnswerKeyPage(ctx: BookContext, batch: AnswerKeyBatchInput): GeneratedPage {
  return {
    type: "answer_key",
    title: `Answer Key ${batch.ordinal + 1}`,
    content: { entries: batch.entries },
    usage: ZERO_USAGE,
  };
}

export type {
  WordSearchPuzzle,
  WordSearchSolution,
  CrosswordPuzzle,
  CrosswordSolution,
  SudokuPuzzle,
  SudokuSolution,
  MazePuzzle,
  MazeSolution,
};
