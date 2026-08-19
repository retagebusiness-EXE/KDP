import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { withApiErrors } from "@/lib/api/respond";
import { requireOwnedProject } from "@/lib/api/ownership";
import { assertGenerationAllowed, recordAIUsage } from "@/lib/limits/usage";
import { getAIProvider, providerCostKey } from "@/lib/ai";
import { generatePageContent, type BookContext } from "@/lib/generation/content";
import { persistPage, rebuildAnswerKeyPages } from "@/lib/generation/pipeline";
import type { BookTypeId } from "@/lib/generation/book-types";

/** Appends one new content page at the end of the book (before the answer-key section). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const { id } = await params;
    const project = await requireOwnedProject(id, user.id, user.role === "ADMIN");
    const book = project.book;
    if (!book) {
      return NextResponse.json({ error: "Generate the book before adding pages." }, { status: 422 });
    }

    await assertGenerationAllowed(user.id, user.plan);

    const contentPageCount = await prisma.page.count({ where: { bookId: book.id, type: { notIn: ["title", "answer_key", "blank"] } } });
    const maxIndex = await prisma.page.aggregate({ where: { bookId: book.id }, _max: { index: true } });

    const ctx: BookContext = {
      title: book.title,
      topic: book.topic,
      audience: book.audience,
      difficulty: book.difficulty as BookContext["difficulty"],
      description: book.description ?? undefined,
      bookType: project.bookType as BookTypeId,
    };
    const ai = getAIProvider();
    const seed = `${book.id}:add:${Date.now()}`;
    const generated = await generatePageContent(ctx, contentPageCount, seed, ai);
    await persistPage(book.id, (maxIndex._max.index ?? 0) + 1, generated);

    if (generated.usage.inputTokens + generated.usage.outputTokens > 0) {
      await recordAIUsage(project.userId, ai.name, providerCostKey(ai), generated.usage);
    }

    await rebuildAnswerKeyPages(book.id, project.bookType as BookTypeId);
    await prisma.book.update({ where: { id: book.id }, data: { pageCount: contentPageCount + 1 } });

    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
