import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { withApiErrors } from "@/lib/api/respond";
import { requireOwnedProject } from "@/lib/api/ownership";
import { getFileStorage } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const { id } = await params;
    await requireOwnedProject(id, user.id, user.role === "ADMIN");
    const storage = getFileStorage();
    const rows = await prisma.export.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({
      exports: rows.map((e) => ({
        id: e.id,
        type: e.type,
        fileSizeBytes: e.fileSizeBytes,
        createdAt: e.createdAt,
        downloadUrl: storage.urlFor(e.filePath),
      })),
    });
  });
}
