import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { MetadataEditor, type MetadataData } from "@/components/editor/metadata-editor";

export default async function MetadataPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id }, include: { book: { include: { metadata: true } } } });
  if (!project || (project.userId !== user.id && user.role !== "ADMIN")) notFound();
  if (!project.book) redirect(`/projects/${id}`);

  const metadata: MetadataData | null = project.book.metadata
    ? {
        title: project.book.metadata.title,
        subtitle: project.book.metadata.subtitle,
        description: project.book.metadata.description,
        keywords: JSON.parse(project.book.metadata.keywords),
        categories: JSON.parse(project.book.metadata.categories),
        features: JSON.parse(project.book.metadata.features),
        backCoverText: project.book.metadata.backCoverText,
      }
    : null;

  return <MetadataEditor projectId={project.id} initial={metadata} />;
}
