import "server-only";
import { prisma } from "@/lib/db";
import { NotFoundError } from "./respond";

/** Loads a project and throws NotFoundError unless it belongs to `userId` (admins may bypass with `allowAdmin`). */
export async function requireOwnedProject(projectId: string, userId: string, isAdmin = false) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { book: { include: { cover: true, metadata: true } } } });
  if (!project || (project.userId !== userId && !isAdmin)) {
    throw new NotFoundError("Project not found.");
  }
  return project;
}
