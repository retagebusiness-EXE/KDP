import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { withApiErrors } from "@/lib/api/respond";
import { requireOwnedProject } from "@/lib/api/ownership";
import { assertExportAllowed } from "@/lib/limits/usage";
import { exportInteriorPdf } from "@/lib/generation/pipeline";

const schema = z.object({ projectId: z.string().min(1) });

export const maxDuration = 60;

/**
 * Renders the interior PDF in-memory and streams it straight back as the
 * response body — nothing is written to disk, S3, or the database. This
 * keeps the app from ever retaining a user's generated book.
 */
export async function POST(req: Request) {
  return withApiErrors(async () => {
    const user = await requireUser();
    const body = schema.parse(await req.json());
    const project = await requireOwnedProject(body.projectId, user.id, user.role === "ADMIN");
    if (!project.book) {
      return NextResponse.json({ error: "Generate the book before exporting." }, { status: 422 });
    }

    await assertExportAllowed(user.id, user.plan);
    const { bytes, filename } = await exportInteriorPdf(project.id);

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
