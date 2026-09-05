/** Thrown when an export is requested but the book fails validation. Mapped to HTTP 422 in respond.ts. */
export class ExportBlockedError extends Error {}
