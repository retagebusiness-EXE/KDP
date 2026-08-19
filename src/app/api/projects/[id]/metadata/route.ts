import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { withApiErrors } from "@/lib/api/respond";
import { requireOwnedProject } from "@/lib/api/ownership";

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  keywords: z.array(z.string().trim().min(1)).max(7),
  categories: z.array(z.string().trim().min(1)),
  features: z.array(z.string().trim().min(1)),
  backCoverText: z.string().trim().max(2000).optional(),
});

/** Manual edits to already-generated metadata — no AI call, just persists what the user typed. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const { id } = await params;
    const project = await requireOwnedProject(id, user.id, user.role === "ADMIN");
    if (!project.book) {
      return NextResponse.json({ error: "This project has no book yet." }, { status: 422 });
    }
    const body = schema.parse(await req.json());

    const metadata = await prisma.metadata.upsert({
      where: { bookId: project.book.id },
      update: {
        title: body.title,
        subtitle: body.subtitle,
        description: body.description,
        keywords: JSON.stringify(body.keywords),
        categories: JSON.stringify(body.categories),
        features: JSON.stringify(body.features),
        backCoverText: body.backCoverText,
      },
      create: {
        bookId: project.book.id,
        title: body.title,
        subtitle: body.subtitle,
        description: body.description,
        keywords: JSON.stringify(body.keywords),
        categories: JSON.stringify(body.categories),
        audience: project.book.audience,
        features: JSON.stringify(body.features),
        backCoverText: body.backCoverText,
      },
    });

    return NextResponse.json({ metadata });
  });
}
