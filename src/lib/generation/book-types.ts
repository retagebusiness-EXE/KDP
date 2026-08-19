/**
 * Single registry of every supported book type. Adding a new book type is a
 * three-step change: (1) add an id + config entry here, (2) add a `case` in
 * `content.ts`'s `generatePageContent`, (3) add a PDF renderer branch in
 * `lib/pdf/render-page.ts`. Nothing else in the app needs to know the list
 * of book types.
 */
export type BookTypeId =
  | "word_search"
  | "crossword"
  | "sudoku"
  | "maze"
  | "number_puzzle"
  | "kids_activity"
  | "coloring"
  | "journal"
  | "planner"
  | "log_book"
  | "notebook";

export interface BookTypeConfig {
  id: BookTypeId;
  label: string;
  category: "puzzle" | "activity" | "format";
  description: string;
  /** Puzzle types get an auto-generated "Answer Keys" section; format books don't. */
  hasAnswerKeys: boolean;
  /** How many answers fit per answer-key page when laid out for print. */
  answersPerPage: number;
  defaultDifficulty: "EASY" | "MEDIUM" | "HARD";
}

export const BOOK_TYPES: Record<BookTypeId, BookTypeConfig> = {
  word_search: {
    id: "word_search",
    label: "Word Search",
    category: "puzzle",
    description: "Classic word-find puzzles with a themed word list per page.",
    hasAnswerKeys: true,
    answersPerPage: 4,
    defaultDifficulty: "MEDIUM",
  },
  crossword: {
    id: "crossword",
    label: "Crossword",
    category: "puzzle",
    description: "Algorithmically laid-out crosswords with AI-written clues.",
    hasAnswerKeys: true,
    answersPerPage: 1,
    defaultDifficulty: "MEDIUM",
  },
  sudoku: {
    id: "sudoku",
    label: "Sudoku",
    category: "puzzle",
    description: "9x9 Sudoku with a guaranteed unique solution.",
    hasAnswerKeys: true,
    answersPerPage: 4,
    defaultDifficulty: "MEDIUM",
  },
  maze: {
    id: "maze",
    label: "Maze",
    category: "puzzle",
    description: "Perfect mazes with a guaranteed solvable path.",
    hasAnswerKeys: true,
    answersPerPage: 4,
    defaultDifficulty: "MEDIUM",
  },
  number_puzzle: {
    id: "number_puzzle",
    label: "Number Puzzle",
    category: "puzzle",
    description: "Sudoku-family number-logic puzzles (reuses the Sudoku engine).",
    hasAnswerKeys: true,
    answersPerPage: 4,
    defaultDifficulty: "MEDIUM",
  },
  kids_activity: {
    id: "kids_activity",
    label: "Kids Activity Book",
    category: "activity",
    description: "A mix of easy word searches and mazes for younger readers.",
    hasAnswerKeys: true,
    answersPerPage: 4,
    defaultDifficulty: "EASY",
  },
  coloring: {
    id: "coloring",
    label: "Coloring Book",
    category: "activity",
    description: "One original black-and-white line-art illustration per page.",
    hasAnswerKeys: false,
    answersPerPage: 0,
    defaultDifficulty: "EASY",
  },
  journal: {
    id: "journal",
    label: "Journal",
    category: "format",
    description: "A reflective prompt plus lined writing space per page.",
    hasAnswerKeys: false,
    answersPerPage: 0,
    defaultDifficulty: "EASY",
  },
  planner: {
    id: "planner",
    label: "Planner",
    category: "format",
    description: "Weekly planning spreads with priorities and schedule sections.",
    hasAnswerKeys: false,
    answersPerPage: 0,
    defaultDifficulty: "EASY",
  },
  log_book: {
    id: "log_book",
    label: "Log Book",
    category: "format",
    description: "Tabular tracking pages (date/activity/notes-style columns).",
    hasAnswerKeys: false,
    answersPerPage: 0,
    defaultDifficulty: "EASY",
  },
  notebook: {
    id: "notebook",
    label: "Notebook",
    category: "format",
    description: "Plain lined, grid, or dot-grid pages.",
    hasAnswerKeys: false,
    answersPerPage: 0,
    defaultDifficulty: "EASY",
  },
};

export const BOOK_TYPE_IDS = Object.keys(BOOK_TYPES) as BookTypeId[];

export function getBookTypeConfig(id: string): BookTypeConfig {
  const config = BOOK_TYPES[id as BookTypeId];
  if (!config) throw new Error(`Unknown book type: ${id}`);
  return config;
}
