import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { withApiErrors, NotFoundError } from "@/lib/api/respond";
import { rebuildAnswerKeyPages } from "@/lib/generation/pipeline";
import type { BookTypeId } from "@/lib/generation/book-types";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const { id } = await params;
    const page = await prisma.page.findUnique({
      where: { id },
      include: { book: { include: { project: true } }, puzzle: { include: { solution: true } } },
    });
    if (!page || (page.book.project.userId !== user.id && user.role !== "ADMIN")) {
      throw new NotFoundError("Page not found.");
    }
    if (page.type === "title") {
      return NextResponse.json({ error: "The title page cannot be duplicated." }, { status: 422 });
    }

    const OFFSET = 100000;
    await prisma.$transaction(async (tx) => {
      // Shift into a temporary out-of-range band first, then back down one
      // higher than before — incrementing indices directly can trip the
      // (bookId, index) unique constraint if SQLite applies the UPDATE in
      // ascending index order (row N+1 collides with not-yet-moved row N+2).
      await tx.page.updateMany({ where: { bookId: page.bookId, index: { gt: page.index } }, data: { index: { increment: OFFSET } } });
      await tx.page.updateMany({ where: { bookId: page.bookId, index: { gte: OFFSET } }, data: { index: { decrement: OFFSET - 1 } } });
      const copy = await tx.page.create({
        data: { bookId: page.bookId, index: page.index + 1, type: page.type, title: page.title, content: page.content, status: page.status },
      });
      if (page.puzzle) {
        const puzzle = await tx.puzzle.create({
          data: { pageId: copy.id, type: page.puzzle.type, difficulty: page.puzzle.difficulty, data: page.puzzle.data },
        });
        if (page.puzzle.solution) {
          await tx.puzzleSolution.create({ data: { puzzleId: puzzle.id, data: page.puzzle.solution.data } });
        }
      }
    });

    await rebuildAnswerKeyPages(page.bookId, page.book.project.bookType as BookTypeId);
    return NextResponse.json({ ok: true });
  });
}
