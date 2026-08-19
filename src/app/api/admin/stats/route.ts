import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guard";
import { withApiErrors } from "@/lib/api/respond";

export async function GET() {
  return withApiErrors(async () => {
    await requireAdmin();

    const [userCount, projectCount, exportCount, jobsByStatus, costAgg, recentFailedJobs, recentExports] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.export.count(),
      prisma.generationJob.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.usageRecord.aggregate({ _sum: { estimatedCostCents: true, tokensInput: true, tokensOutput: true } }),
      prisma.generationJob.findMany({
        where: { status: "FAILED" },
        orderBy: { updatedAt: "desc" },
        take: 20,
        include: { project: { select: { name: true, userId: true } } },
      }),
      prisma.export.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { project: { select: { name: true } } } }),
    ]);

    return NextResponse.json({
      users: userCount,
      projects: projectCount,
      exports: exportCount,
      jobsByStatus: Object.fromEntries(jobsByStatus.map((j) => [j.status, j._count._all])),
      estimatedAiCostCents: costAgg._sum.estimatedCostCents ?? 0,
      totalTokens: (costAgg._sum.tokensInput ?? 0) + (costAgg._sum.tokensOutput ?? 0),
      recentErrors: recentFailedJobs.map((j) => ({
        id: j.id,
        type: j.type,
        project: j.project.name,
        error: j.error,
        updatedAt: j.updatedAt,
      })),
      recentExports: recentExports.map((e) => ({
        id: e.id,
        type: e.type,
        project: e.project.name,
        fileSizeBytes: e.fileSizeBytes,
        createdAt: e.createdAt,
      })),
    });
  });
}
