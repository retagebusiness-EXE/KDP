import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { withApiErrors } from "@/lib/api/respond";
import { requireOwnedProject } from "@/lib/api/ownership";

const renameSchema = z.object({ name: z.string().trim().min(1).max(200) });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const { id } = await params;
    const project = await requireOwnedProject(id, user.id, user.role === "ADMIN");
    const pages = project.book
      ? await prisma.page.findMany({ where: { bookId: project.book.id }, orderBy: { index: "asc" } })
      : [];
    return NextResponse.json({ project, pages });
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const { id } = await params;
    await requireOwnedProject(id, user.id, user.role === "ADMIN");
    const body = renameSchema.parse(await req.json());
    const project = await prisma.project.update({ where: { id }, data: { name: body.name } });
    return NextResponse.json({ project });
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const { id } = await params;
    await requireOwnedProject(id, user.id, user.role === "ADMIN");
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
