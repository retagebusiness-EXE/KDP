import type { BookTypeId } from "./book-types";
import type { Difficulty } from "@/lib/engines/types";

/**
 * Starter templates are just parameter presets for the new-book wizard —
 * not separate code paths or hard-coded book content. Adding a template
 * means adding an entry here; the wizard and generation pipeline handle the
 * rest exactly as they would for a from-scratch book.
 */
export interface BookTemplate {
  id: string;
  label: string;
  bookType: BookTypeId;
  topic: string;
  audience: string;
  difficulty: Difficulty;
  pageCount: number;
  trimWidthIn: number;
  trimHeightIn: number;
}

export const BOOK_TEMPLATES: BookTemplate[] = [
  { id: "sports-word-search", label: "Sports Word Search", bookType: "word_search", topic: "Sports", audience: "Adults", difficulty: "MEDIUM", pageCount: 40, trimWidthIn: 8.5, trimHeightIn: 11 },
  { id: "animals-word-search", label: "Animals Word Search", bookType: "word_search", topic: "Animals", audience: "Adults", difficulty: "MEDIUM", pageCount: 40, trimWidthIn: 8.5, trimHeightIn: 11 },
  { id: "kids-word-search", label: "Kids Word Search", bookType: "word_search", topic: "Animals", audience: "Kids ages 6-10", difficulty: "EASY", pageCount: 30, trimWidthIn: 8.5, trimHeightIn: 11 },
  { id: "general-crossword", label: "General Crossword", bookType: "crossword", topic: "General Knowledge", audience: "Adults", difficulty: "MEDIUM", pageCount: 30, trimWidthIn: 8.5, trimHeightIn: 11 },
  { id: "easy-sudoku", label: "Easy Sudoku", bookType: "sudoku", topic: "Sudoku", audience: "Adults", difficulty: "EASY", pageCount: 50, trimWidthIn: 6, trimHeightIn: 9 },
  { id: "medium-sudoku", label: "Medium Sudoku", bookType: "sudoku", topic: "Sudoku", audience: "Adults", difficulty: "MEDIUM", pageCount: 50, trimWidthIn: 6, trimHeightIn: 9 },
  { id: "kids-maze-book", label: "Kids Maze Book", bookType: "maze", topic: "Adventure", audience: "Kids ages 6-10", difficulty: "EASY", pageCount: 30, trimWidthIn: 8.5, trimHeightIn: 11 },
  { id: "kids-coloring-book", label: "Kids Coloring Book", bookType: "coloring", topic: "Friendly Animals", audience: "Kids ages 3-8", difficulty: "EASY", pageCount: 30, trimWidthIn: 8.5, trimHeightIn: 11 },
  { id: "daily-journal", label: "Daily Journal", bookType: "journal", topic: "Daily Reflection", audience: "Adults", difficulty: "EASY", pageCount: 100, trimWidthIn: 6, trimHeightIn: 9 },
  { id: "fitness-log", label: "Fitness Log", bookType: "log_book", topic: "Fitness", audience: "Adults", difficulty: "EASY", pageCount: 100, trimWidthIn: 6, trimHeightIn: 9 },
  { id: "puzzle-activity-book", label: "Puzzle Activity Book", bookType: "kids_activity", topic: "Everyday Fun", audience: "Kids ages 6-10", difficulty: "EASY", pageCount: 40, trimWidthIn: 8.5, trimHeightIn: 11 },
];

export function getTemplate(id: string): BookTemplate | undefined {
  return BOOK_TEMPLATES.find((t) => t.id === id);
}
