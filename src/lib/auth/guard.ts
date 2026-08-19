import "server-only";
import { prisma } from "@/lib/db";
import { getSession } from "./session";

export class UnauthorizedError extends Error {
  constructor(message = "You must be signed in to do that.") {
    super(message);
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
  }
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.userId } });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ForbiddenError("Admin access required.");
  return user;
}
