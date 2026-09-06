import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { withApiErrors, NotFoundError } from "@/lib/api/respond";
import { runGenerationJob } from "@/lib/generation/pipeline";

export const maxDuration = 60;

const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED"]);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const { id } = await params;
    const job = await prisma.generationJob.findUnique({ where: { id }, include: { project: true } });
    if (!job || (job.project.userId !== user.id && user.role !== "ADMIN")) {
      throw new NotFoundError("Job not found.");
    }

    // The frontend polls this route while a job runs, so it doubles as a
    // continuation nudge: if scheduleContinuation's self-fetch hop got
    // dropped (e.g. Vercel's infinite-loop guard rejecting a self-call to
    // our own /continue endpoint), the very next poll resumes the job here
    // instead, in-process — no self-fetch, so it can't hit that guard.
    // runGenerationJob's own lock makes this a harmless no-op whenever the
    // job is already being worked by another invocation.
    if (!TERMINAL_STATUSES.has(job.status)) {
      after(() =>
        runGenerationJob(id).catch((err) => {
          console.error("[job] poll-triggered resume failed", err);
        }),
      );
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
