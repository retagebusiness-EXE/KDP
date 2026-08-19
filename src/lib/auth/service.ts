import "server-only";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "./password";
import { createSessionToken, type SessionPayload } from "./session";

export interface AuthResult {
  user: { id: string; email: string; name: string | null; role: string; plan: string };
  token: string;
}

export class AuthError extends Error {}

/**
 * Credentials (email/password) auth. Structured as one implementation of a
 * broader "auth provider" shape — a future OAuth provider (Google, etc.)
 * would authenticate its own way and then call the same `issueSession`
 * helper below, so the rest of the app (session cookie, `requireUser`)
 * doesn't need to change when OAuth is added.
 */
export class CredentialsAuthProvider {
  async register(email: string, password: string, name?: string): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      throw new AuthError("An account with this email already exists.");
    }
    if (password.length < 8) {
      throw new AuthError("Password must be at least 8 characters.");
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email: normalizedEmail, passwordHash, name: name?.trim() || null },
    });
    await prisma.subscription.create({ data: { userId: user.id, plan: "FREE", status: "ACTIVE" } });
    return issueSession(user);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) throw new AuthError("Invalid email or password.");
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) throw new AuthError("Invalid email or password.");
    return issueSession(user);
  }
}

async function issueSession(user: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  plan: string;
}): Promise<AuthResult> {
  const payload: SessionPayload = { userId: user.id, email: user.email, role: user.role };
  const token = await createSessionToken(payload);
  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan },
    token,
  };
}
