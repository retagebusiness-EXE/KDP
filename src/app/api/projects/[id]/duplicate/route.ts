import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { withApiErrors } from "@/lib/api/respond";
import { requireOwnedProject } from "@/lib/api/ownership";
import { assertProjectCreationAllowed } from "@/lib/limits/usage";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const { id } = await params;
    const source = await requireOwnedProject(id, user.id, user.role === "ADMIN");
    await assertProjectCreationAllowed(user.id, user.plan);

    const pages = source.book
      ? await prisma.page.findMany({ where: { bookId: source.book.id }, orderBy: { index: "asc" }, include: { puzzle: { include: { solution: true } } } })
      : [];

    const duplicate = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: { userId: user.id, name: `${source.name} (Copy)`, bookType: source.bookType, status: source.status },
      });

      if (source.book) {
        const book = await tx.book.create({
          data: {
            projectId: project.id,
            title: source.book.title,
            subtitle: source.book.subtitle,
            topic: source.book.topic,
            audience: source.book.audience,
            difficulty: source.book.difficulty,
            description: source.book.description,
            trimWidth: source.book.trimWidth,
            trimHeight: source.book.trimHeight,
            pageCount: source.book.pageCount,
            bleed: source.book.bleed,
            interiorColor: source.book.interiorColor,
            paperType: source.book.paperType,
            coverFinish: source.book.coverFinish,
          },
        });

        for (const page of pages) {
          const newPage = await tx.page.create({
            data: { bookId: book.id, index: page.index, type: page.type, title: page.title, content: page.content, status: page.status },
          });
          if (page.puzzle) {
            const puzzle = await tx.puzzle.create({
              data: { pageId: newPage.id, type: page.puzzle.type, difficulty: page.puzzle.difficulty, data: page.puzzle.data },
            });
            if (page.puzzle.solution) {
              await tx.puzzleSolution.create({ data: { puzzleId: puzzle.id, data: page.puzzle.solution.data } });
            }
          }
        }

        if (source.book.cover) {
          await tx.cover.create({
            data: {
              bookId: book.id,
              title: source.book.cover.title,
              subtitle: source.book.cover.subtitle,
              author: source.book.cover.author,
              frontImagePath: source.book.cover.frontImagePath,
              backImagePath: source.book.cover.backImagePath,
              spineWidthIn: source.book.cover.spineWidthIn,
              fullWidthIn: source.book.cover.fullWidthIn,
              fullHeightIn: source.book.cover.fullHeightIn,
              colors: source.book.cover.colors,
              layout: source.book.cover.layout,
              status: source.book.cover.status,
            },
          });
        }

        if (source.book.metadata) {
          await tx.metadata.create({
            data: {
              bookId: book.id,
              title: source.book.metadata.title,
              subtitle: source.book.metadata.subtitle,
              description: source.book.metadata.description,
              keywords: source.book.metadata.keywords,
              categories: source.book.metadata.categories,
              audience: source.book.metadata.audience,
              features: source.book.metadata.features,
              backCoverText: source.book.metadata.backCoverText,
            },
          });
        }
      }

      return project;
    });

    return NextResponse.json({ project: duplicate }, { status: 201 });
  });
}
