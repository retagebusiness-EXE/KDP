import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/guard";
import { UsageLimitError } from "@/lib/limits/usage";
import { ExportBlockedError } from "@/lib/generation/errors";

/**
 * Wraps a route handler so every API route gets the same error-to-status
 * mapping without repeating try/catch in each file.
 */
export function withApiErrors(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  return handler().catch((err) => {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request.", issues: err.issues }, { status: 400 });
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof UsageLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    if (err instanceof ExportBlockedError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("[api] unhandled error", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  });
}

export class NotFoundError extends Error {
  constructor(message = "Not found.") {
    super(message);
  }
}
