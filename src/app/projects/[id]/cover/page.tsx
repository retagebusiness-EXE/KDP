import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { CoverEditor, type CoverData } from "@/components/editor/cover-editor";

export default async function CoverPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id }, include: { book: { include: { cover: true } } } });
  if (!project || (project.userId !== user.id && user.role !== "ADMIN")) notFound();
  if (!project.book) redirect(`/projects/${id}`);

  const cover: CoverData | null = project.book.cover
    ? {
        title: project.book.cover.title,
        subtitle: project.book.cover.subtitle,
        author: project.book.cover.author,
        spineWidthIn: project.book.cover.spineWidthIn,
        fullWidthIn: project.book.cover.fullWidthIn,
        fullHeightIn: project.book.cover.fullHeightIn,
        colors: JSON.parse(project.book.cover.colors),
      }
    : null;

  return <CoverEditor projectId={project.id} initialCover={cover} />;
}
