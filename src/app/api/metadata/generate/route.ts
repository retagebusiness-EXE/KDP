import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { withApiErrors } from "@/lib/api/respond";
import { requireOwnedProject } from "@/lib/api/ownership";
import { assertGenerationAllowed } from "@/lib/limits/usage";
import { metadataGenerateSchema } from "@/lib/generation/schemas";
import { enqueueGenerationJob } from "@/lib/generation/jobs";

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const body = metadataGenerateSchema.parse(await req.json());
    const project = await requireOwnedProject(body.projectId, user.id, user.role === "ADMIN");
    if (!project.book) {
      return NextResponse.json({ error: "Generate the book before generating metadata." }, { status: 422 });
    }

    await assertGenerationAllowed(user.id, user.plan);
    const jobId = await enqueueGenerationJob(project.id, "METADATA_GENERATE", {});
    return NextResponse.json({ jobId }, { status: 202 });
  });
}
