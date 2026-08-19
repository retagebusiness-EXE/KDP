import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { withApiErrors, NotFoundError } from "@/lib/api/respond";
import { rebuildAnswerKeyPages } from "@/lib/generation/pipeline";
import type { BookTypeId } from "@/lib/generation/book-types";

async function loadOwnedPage(pageId: string, userId: string, isAdmin: boolean) {
  const page = await prisma.page.findUnique({ where: { id: pageId }, include: { book: { include: { project: true } } } });
  if (!page || (page.book.project.userId !== userId && !isAdmin)) {
    throw new NotFoundError("Page not found.");
  }
  return page;
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const { id } = await params;
    const page = await loadOwnedPage(id, user.id, user.role === "ADMIN");
    if (page.type === "title") {
      return NextResponse.json({ error: "The title page cannot be deleted." }, { status: 422 });
    }

    const OFFSET = 100000;
    await prisma.$transaction(async (tx) => {
      await tx.puzzleSolution.deleteMany({ where: { puzzle: { pageId: page.id } } });
      await tx.puzzle.deleteMany({ where: { pageId: page.id } });
      await tx.page.delete({ where: { id: page.id } });
      // Offset shift avoids relying on SQLite's row-processing order for the
      // (bookId, index) unique constraint (see the duplicate route for why).
      await tx.page.updateMany({ where: { bookId: page.bookId, index: { gt: page.index } }, data: { index: { increment: OFFSET } } });
      await tx.page.updateMany({ where: { bookId: page.bookId, index: { gte: OFFSET } }, data: { index: { decrement: OFFSET + 1 } } });
    });

    await rebuildAnswerKeyPages(page.bookId, page.book.project.bookType as BookTypeId);
    return NextResponse.json({ ok: true });
  });
}
