import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { withApiErrors } from "@/lib/api/respond";
import { requireOwnedProject } from "@/lib/api/ownership";
import { validateProjectBook } from "@/lib/generation/pipeline";

const schema = z.object({ projectId: z.string().min(1) });

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const body = schema.parse(await req.json());
    const project = await requireOwnedProject(body.projectId, user.id, user.role === "ADMIN");
    if (!project.book) {
      return NextResponse.json({ error: "Generate the book before validating." }, { status: 422 });
    }
    const report = await validateProjectBook(project.id);
    return NextResponse.json({ report });
  });
}
