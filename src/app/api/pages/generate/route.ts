import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { withApiErrors, NotFoundError } from "@/lib/api/respond";
import { assertGenerationAllowed } from "@/lib/limits/usage";
import { pageRegenerateSchema } from "@/lib/generation/schemas";
import { enqueueGenerationJob } from "@/lib/generation/jobs";

export const maxDuration = 60;

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const body = pageRegenerateSchema.parse(await req.json());

    const page = await prisma.page.findUnique({ where: { id: body.pageId }, include: { book: { include: { project: true } } } });
    if (!page || (page.book.project.userId !== user.id && user.role !== "ADMIN")) {
      throw new NotFoundError("Page not found.");
    }

    await assertGenerationAllowed(user.id, user.plan);

    const jobId = await enqueueGenerationJob(page.book.project.id, "PAGE_REGENERATE", { pageId: page.id });
    return NextResponse.json({ jobId }, { status: 202 });
  });
}
