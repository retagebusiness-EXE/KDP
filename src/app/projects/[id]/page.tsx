import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { BookEditor, type EditorPage } from "@/components/editor/book-editor";

export default async function ProjectEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id }, include: { book: true } });
  if (!project || (project.userId !== user.id && user.role !== "ADMIN")) notFound();

  if (!project.book) {
    redirect(`/projects/new`);
  }

  const pages = await prisma.page.findMany({ where: { bookId: project.book.id }, orderBy: { index: "asc" } });
  const editorPages: EditorPage[] = pages.map((p) => ({
    id: p.id,
    index: p.index,
    type: p.type,
    title: p.title,
    status: p.status,
    content: JSON.parse(p.content),
  }));

  return <BookEditor projectId={project.id} projectName={project.book.title} pages={editorPages} />;
}
