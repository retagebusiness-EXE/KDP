import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/nav/app-shell";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { getPlanLimits } from "@/lib/limits/plans";
import { getBookTypeConfig } from "@/lib/generation/book-types";
import { BOOK_TEMPLATES } from "@/lib/generation/templates";

const STATUS_TONE: Record<string, "gray" | "green" | "amber" | "red" | "indigo"> = {
  DRAFT: "gray",
  GENERATING: "amber",
  READY: "green",
  ARCHIVED: "gray",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [projects, generationCount] = await Promise.all([
    prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: { book: { select: { title: true, pageCount: true } } },
    }),
    prisma.usageRecord.count({
      where: {
        userId: user.id,
        type: "AI_GENERATION",
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
  ]);

  const limits = getPlanLimits(user.plan);

  return (
    <AppShell user={user} activePath="/dashboard">
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">Welcome back{user.name ? `, ${user.name}` : ""}.</p>
          </div>
          <Link href="/projects/new">
            <Button size="lg">+ Create New Book</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Recent Projects</CardTitle>
            </CardHeader>
            <CardBody>
              {projects.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  No projects yet. <Link href="/projects/new" className="font-medium text-indigo-600">Create your first book</Link>.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {projects.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-3">
                      <div className="min-w-0">
                        <Link href={`/projects/${p.id}`} className="truncate text-sm font-medium text-slate-900 hover:text-indigo-600">
                          {p.book?.title || p.name}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {getBookTypeConfig(p.bookType).label}
                          {p.book ? ` · ${p.book.pageCount} pages` : ""}
                        </p>
                      </div>
                      <Badge tone={STATUS_TONE[p.status] ?? "gray"}>{p.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage this month</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <div className="mb-1 flex justify-between text-xs text-slate-600">
                  <span>AI generations</span>
                  <span>
                    {generationCount} / {limits.maxGenerationsPerMonth}
                  </span>
                </div>
                <ProgressBar value={(generationCount / limits.maxGenerationsPerMonth) * 100} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs text-slate-600">
                  <span>Projects</span>
                  <span>
                    {projects.length} / {limits.maxProjects}
                  </span>
                </div>
                <ProgressBar value={(projects.length / limits.maxProjects) * 100} />
              </div>
              <p className="text-xs text-slate-500">
                {limits.label} plan.{" "}
                <Link href="/settings" className="font-medium text-indigo-600">
                  Manage plan
                </Link>
              </p>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Templates</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {BOOK_TEMPLATES.map((t) => (
                <Link
                  key={t.id}
                  href={`/projects/new?template=${t.id}`}
                  className="rounded-lg border border-slate-200 px-3 py-3 text-sm font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {t.label}
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
