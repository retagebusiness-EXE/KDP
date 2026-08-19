import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { runGenerationJob } from "../pipeline";
import { rebuildAnswerKeyPages } from "../pipeline";

describe("rebuildAnswerKeyPages (page add/delete/duplicate renumbering)", () => {
  let userId: string;
  let projectId: string;
  let bookId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: `rebuild-test-${Date.now()}@example.com`, passwordHash: "x" } });
    userId = user.id;
    const project = await prisma.project.create({ data: { userId, name: "Rebuild Test", bookType: "word_search" } });
    projectId = project.id;
    const book = await prisma.book.create({
      data: {
        projectId, title: "Rebuild Test", topic: "Sports", audience: "Adults", difficulty: "EASY",
        pageCount: 20, trimWidth: 8.5, trimHeight: 11, bleed: false, interiorColor: "BW", paperType: "WHITE", coverFinish: "MATTE",
      },
    });
    bookId = book.id;
    const job = await prisma.generationJob.create({ data: { projectId, type: "BOOK_GENERATE", status: "QUEUED", input: "{}" } });
    await runGenerationJob(job.id);
  }, 30000);

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  function assertContiguousAndValid(pages: { index: number; type: string }[]) {
    const sorted = [...pages].sort((a, b) => a.index - b.index);
    sorted.forEach((p, i) => expect(p.index).toBe(i));
    expect(sorted[0].type).toBe("title");
    expect(sorted.length % 2).toBe(0);
    // exactly one blank at most, and only at the very end
    const blanks = sorted.filter((p) => p.type === "blank");
    expect(blanks.length).toBeLessThanOrEqual(1);
    if (blanks.length === 1) expect(blanks[0].index).toBe(sorted.length - 1);
  }

  it("keeps page numbering contiguous and answer keys correct after deleting a content page", async () => {
    const before = await prisma.page.findMany({ where: { bookId, type: "word_search" }, orderBy: { index: "asc" } });
    const target = before[5];

    const DELETE_OFFSET = 100000;
    await prisma.$transaction(async (tx) => {
      await tx.puzzleSolution.deleteMany({ where: { puzzle: { pageId: target.id } } });
      await tx.puzzle.deleteMany({ where: { pageId: target.id } });
      await tx.page.delete({ where: { id: target.id } });
      await tx.page.updateMany({ where: { bookId, index: { gt: target.index } }, data: { index: { increment: DELETE_OFFSET } } });
      await tx.page.updateMany({ where: { bookId, index: { gte: DELETE_OFFSET } }, data: { index: { decrement: DELETE_OFFSET + 1 } } });
    });
    await rebuildAnswerKeyPages(bookId, "word_search");

    const pages = await prisma.page.findMany({ where: { bookId }, orderBy: { index: "asc" } });
    assertContiguousAndValid(pages);
    expect(pages.filter((p) => p.type === "word_search").length).toBe(19);

    // Every answer-key entry's pageNumber must point at a real word_search page at that 1-based index.
    const answerPages = pages.filter((p) => p.type === "answer_key");
    for (const ap of answerPages) {
      const entries = JSON.parse(ap.content).entries as { pageNumber: number }[];
      for (const entry of entries) {
        const referenced = pages.find((p) => p.index === entry.pageNumber - 1);
        expect(referenced?.type).toBe("word_search");
      }
    }
  }, 20000);

  it("keeps page numbering contiguous after duplicating a content page", async () => {
    const before = await prisma.page.findMany({ where: { bookId, type: "word_search" }, orderBy: { index: "asc" }, include: { puzzle: { include: { solution: true } } } });
    const source = before[3];

    const OFFSET = 100000;
    await prisma.$transaction(async (tx) => {
      await tx.page.updateMany({ where: { bookId, index: { gt: source.index } }, data: { index: { increment: OFFSET } } });
      await tx.page.updateMany({ where: { bookId, index: { gte: OFFSET } }, data: { index: { decrement: OFFSET - 1 } } });
      const copy = await tx.page.create({
        data: { bookId, index: source.index + 1, type: source.type, title: source.title, content: source.content, status: source.status },
      });
      if (source.puzzle) {
        const puzzle = await tx.puzzle.create({ data: { pageId: copy.id, type: source.puzzle.type, difficulty: source.puzzle.difficulty, data: source.puzzle.data } });
        if (source.puzzle.solution) await tx.puzzleSolution.create({ data: { puzzleId: puzzle.id, data: source.puzzle.solution.data } });
      }
    });
    await rebuildAnswerKeyPages(bookId, "word_search");

    const pages = await prisma.page.findMany({ where: { bookId }, orderBy: { index: "asc" } });
    assertContiguousAndValid(pages);
    expect(pages.filter((p) => p.type === "word_search").length).toBe(20);
  }, 20000);
});
