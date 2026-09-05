import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { ExportPanel } from "@/components/editor/export-panel";

export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id }, include: { book: { include: { cover: true } } } });
  if (!project || (project.userId !== user.id && user.role !== "ADMIN")) notFound();
  if (!project.book) redirect(`/projects/${id}`);

  return <ExportPanel projectId={project.id} hasCover={Boolean(project.book.cover)} />;
}
