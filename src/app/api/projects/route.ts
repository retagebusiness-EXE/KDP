import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { withApiErrors } from "@/lib/api/respond";
import { assertProjectCreationAllowed } from "@/lib/limits/usage";
import { projectCreateSchema } from "@/lib/generation/schemas";
import { checkOriginality } from "@/lib/ai/safety";

export async function GET() {
  return withApiErrors(async () => {
    const user = await requireUser();
    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { book: { select: { title: true, pageCount: true, topic: true } } },
    });
    return NextResponse.json({ projects });
  });
}

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const body = projectCreateSchema.parse(await req.json());

    const originality = checkOriginality(body.name);
    if (originality.flagged) {
      return NextResponse.json({ error: originality.message }, { status: 422 });
    }

    await assertProjectCreationAllowed(user.id, user.plan);
    const project = await prisma.project.create({
      data: { userId: user.id, name: body.name, bookType: body.bookType },
    });
    return NextResponse.json({ project }, { status: 201 });
  });
}
