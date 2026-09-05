import { NextResponse, after } from "next/server";
import { getInternalJobSecret, runGenerationJob } from "@/lib/generation/pipeline";

export const maxDuration = 60;

/**
 * Internal, server-to-server-only endpoint: hands a job that ran out of time
 * in one serverless invocation off to a new one with a fresh maxDuration
 * budget. Never called by the browser — see scheduleContinuation in pipeline.ts.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const secret = req.headers.get("x-internal-job-secret");
  if (!secret || secret !== getInternalJobSecret()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  after(() =>
    runGenerationJob(id).catch((err) => {
      console.error("[job] continuation run failed", err);
    }),
  );
  return NextResponse.json({ ok: true }, { status: 202 });
}
