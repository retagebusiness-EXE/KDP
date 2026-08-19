import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { withApiErrors, NotFoundError } from "@/lib/api/respond";
import { requireOwnedProject } from "@/lib/api/ownership";
import { assertGenerationAllowed } from "@/lib/limits/usage";
import { checkOriginality } from "@/lib/ai/safety";
import { bookGenerateSchema } from "@/lib/generation/schemas";
import { enqueueGenerationJob } from "@/lib/generation/jobs";

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const body = bookGenerateSchema.parse(await req.json());
    const project = await requireOwnedProject(body.projectId, user.id, user.role === "ADMIN");
    if (!project) throw new NotFoundError("Project not found.");

    const originality = checkOriginality(body.title, body.topic, body.description, body.subtitle);
    if (originality.flagged) {
      return NextResponse.json({ error: originality.message }, { status: 422 });
    }

    await assertGenerationAllowed(user.id, user.plan);

    const book = await prisma.book.upsert({
      where: { projectId: project.id },
      update: {
        title: body.title,
        subtitle: body.subtitle,
        topic: body.topic,
        audience: body.audience,
        difficulty: body.difficulty,
        pageCount: body.pageCount,
        trimWidth: body.trimWidthIn,
        trimHeight: body.trimHeightIn,
        bleed: body.bleed,
        interiorColor: body.interiorColor,
        paperType: body.paperType,
        coverFinish: body.coverFinish,
        description: body.description,
      },
      create: {
        projectId: project.id,
        title: body.title,
        subtitle: body.subtitle,
        topic: body.topic,
        audience: body.audience,
        difficulty: body.difficulty,
        pageCount: body.pageCount,
        trimWidth: body.trimWidthIn,
        trimHeight: body.trimHeightIn,
        bleed: body.bleed,
        interiorColor: body.interiorColor,
        paperType: body.paperType,
        coverFinish: body.coverFinish,
        description: body.description,
      },
    });

    await prisma.project.update({ where: { id: project.id }, data: { status: "GENERATING", bookType: body.bookType } });

    const jobId = await enqueueGenerationJob(project.id, "BOOK_GENERATE", {});
    return NextResponse.json({ jobId, bookId: book.id }, { status: 202 });
  });
}
