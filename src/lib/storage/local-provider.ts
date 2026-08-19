import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FileStorage, PutFileOptions } from "./types";

const ROOT = process.env.LOCAL_STORAGE_DIR
  ? path.resolve(process.env.LOCAL_STORAGE_DIR)
  : path.resolve(process.cwd(), "storage");

function safeResolve(key: string): string {
  const normalized = path.normalize(key).replace(/^([./\\]+)/, "");
  const resolved = path.resolve(ROOT, normalized);
  if (!resolved.startsWith(ROOT)) {
    throw new Error("Invalid storage key.");
  }
  return resolved;
}

/**
 * Filesystem-backed storage for local development. Files are served through
 * the `/api/files/[...key]` route (see that route handler) rather than from
 * Next's `public/` folder, so access can be gated per-user later.
 */
export class LocalFileStorage implements FileStorage {
  readonly name = "local";

  async put(key: string, data: Buffer | Uint8Array, _options?: PutFileOptions) {
    const filePath = safeResolve(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
    return { url: this.urlFor(key) };
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(safeResolve(key));
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(safeResolve(key), { force: true });
  }

  urlFor(key: string): string {
    return `/api/files/${key.replace(/^\/+/, "")}`;
  }
}
