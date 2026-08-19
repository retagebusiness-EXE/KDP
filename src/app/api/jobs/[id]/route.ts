import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { withApiErrors, NotFoundError } from "@/lib/api/respond";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const { id } = await params;
    const job = await prisma.generationJob.findUnique({ where: { id }, include: { project: true } });
    if (!job || (job.project.userId !== user.id && user.role !== "ADMIN")) {
      throw new NotFoundError("Job not found.");
    }
    return NextResponse.json({
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      message: job.message,
      error: job.error,
      result: job.result ? JSON.parse(job.result) : null,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
    });
  });
}
