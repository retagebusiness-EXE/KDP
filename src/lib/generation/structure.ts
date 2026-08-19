import { getBookTypeConfig, type BookTypeId } from "./book-types";

export type PageKind = "title" | "content" | "answer_key" | "blank";

export interface PagePlan {
  index: number; // 0-based, matches Page.index in the DB
  kind: PageKind;
  /** For content pages: which content-page number this is (0-based). For answer_key pages: which batch. */
  ordinal: number;
}

export interface BookStructure {
  pages: PagePlan[];
  contentPageCount: number;
  totalPageCount: number;
  /** true if a trailing blank page was added to make the interior page count even (KDP requirement). */
  paddedForEvenCount: boolean;
}

/**
 * Turns "the user asked for N puzzle pages" into the full interior page
 * plan: a title page, the N content pages, an auto-sized answer-key
 * section (for puzzle book types), and a trailing blank page if needed so
 * the total interior page count is even, as KDP interiors require.
 */
export function computeBookStructure(bookType: BookTypeId, requestedContentPages: number): BookStructure {
  const config = getBookTypeConfig(bookType);
  const contentPageCount = Math.max(1, requestedContentPages);

  const pages: PagePlan[] = [];
  let index = 0;

  pages.push({ index: index++, kind: "title", ordinal: 0 });

  for (let i = 0; i < contentPageCount; i++) {
    pages.push({ index: index++, kind: "content", ordinal: i });
  }

  if (config.hasAnswerKeys) {
    const perPage = Math.max(1, config.answersPerPage);
    const answerPageCount = Math.ceil(contentPageCount / perPage);
    for (let i = 0; i < answerPageCount; i++) {
      pages.push({ index: index++, kind: "answer_key", ordinal: i });
    }
  }

  let paddedForEvenCount = false;
  if (pages.length % 2 !== 0) {
    pages.push({ index: index++, kind: "blank", ordinal: 0 });
    paddedForEvenCount = true;
  }

  return { pages, contentPageCount, totalPageCount: pages.length, paddedForEvenCount };
}
