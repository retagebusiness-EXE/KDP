import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/nav/app-shell";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectList, type ProjectRow } from "@/components/projects/project-list";

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { book: { select: { title: true } } },
  });

  const rows: ProjectRow[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    bookType: p.bookType,
    status: p.status,
    updatedAt: p.updatedAt.toISOString(),
    bookTitle: p.book?.title ?? null,
  }));

  return (
    <AppShell user={user} activePath="/projects">
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Projects</h1>
          <Link href="/projects/new">
            <Button>+ Create New Book</Button>
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>All projects</CardTitle>
          </CardHeader>
          <CardBody>
            <ProjectList initial={rows} />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
