import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { withApiErrors } from "@/lib/api/respond";
import { requireOwnedProject } from "@/lib/api/ownership";
import { assertExportAllowed } from "@/lib/limits/usage";
import { exportCoverPdf } from "@/lib/generation/pipeline";

const schema = z.object({ projectId: z.string().min(1) });

export const maxDuration = 60;

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const body = schema.parse(await req.json());
    const project = await requireOwnedProject(body.projectId, user.id, user.role === "ADMIN");
    if (!project.book?.cover) {
      return NextResponse.json({ error: "Generate a cover before exporting it." }, { status: 422 });
    }

    await assertExportAllowed(user.id, user.plan);
    const { bytes, filename } = await exportCoverPdf(project.id);

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
