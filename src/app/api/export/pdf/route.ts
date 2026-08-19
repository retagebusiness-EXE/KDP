import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { withApiErrors } from "@/lib/api/respond";
import { requireOwnedProject } from "@/lib/api/ownership";
import { assertExportAllowed } from "@/lib/limits/usage";
import { enqueueGenerationJob } from "@/lib/generation/jobs";

const schema = z.object({
  projectId: z.string().min(1),
  type: z.enum(["INTERIOR_PDF", "FULL_PACKAGE"]).default("INTERIOR_PDF"),
});

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const body = schema.parse(await req.json());
    const project = await requireOwnedProject(body.projectId, user.id, user.role === "ADMIN");
    if (!project.book) {
      return NextResponse.json({ error: "Generate the book before exporting." }, { status: 422 });
    }

    await assertExportAllowed(user.id, user.plan);
    const jobId = await enqueueGenerationJob(project.id, "PDF_EXPORT", { projectId: project.id, type: body.type });
    return NextResponse.json({ jobId }, { status: 202 });
  });
}
