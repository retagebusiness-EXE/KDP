import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { withApiErrors, NotFoundError } from "@/lib/api/respond";
import { runGenerationJob } from "@/lib/generation/pipeline";

export const maxDuration = 60;

const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED"]);

/**
 * User-facing manual retry for a job stuck by a failed scheduleContinuation
 * hop (e.g. Vercel's self-fetch infinite-loop guard rejecting the internal
 * /continue call). Runs the same runGenerationJob resume path in-process
 * instead of self-fetching, so it doesn't trip that guard again.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const { id } = await params;
    const job = await prisma.generationJob.findUnique({ where: { id }, include: { project: true } });
    if (!job || (job.project.userId !== user.id && user.role !== "ADMIN")) {
      throw new NotFoundError("Job not found.");
    }
    if (TERMINAL_STATUSES.has(job.status)) {
      return NextResponse.json({ error: "Job already finished." }, { status: 409 });
    }

    after(() =>
      runGenerationJob(id).catch((err) => {
        console.error("[job] manual resume failed", err);
      }),
    );
    return NextResponse.json({ ok: true }, { status: 202 });
  });
}
