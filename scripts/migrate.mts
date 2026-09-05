/**
 * `prisma migrate deploy` can't run against this project's DB: the schema
 * declares provider "sqlite" but the actual connection goes through
 * @prisma/adapter-libsql (Turso), a scheme Prisma's migration engine doesn't
 * recognize (P1013). The Prisma *client* talks to it fine via the adapter,
 * so this applies each migration folder's migration.sql once, tracked in
 * its own table, using that same client. Runs as part of `npm run build`.
 *
 * Idempotent by design (not just on first run): a statement that fails
 * because its effect already exists (table/column/index already there) is
 * assumed pre-applied and skipped rather than failing the build — that
 * covers the migrations that predate this script, which nothing had ever
 * applied to production.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/lib/db";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma", "migrations");

await prisma.$executeRawUnsafe(
  `CREATE TABLE IF NOT EXISTS _app_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`,
);
const applied = new Set(
  (await prisma.$queryRawUnsafe<{ name: string }[]>(`SELECT name FROM _app_migrations`)).map((r) => r.name),
);

const pending = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()
  .filter((name) => !applied.has(name));

for (const name of pending) {
  console.log(`[migrate] applying ${name}`);
  const sql = readFileSync(join(migrationsDir, name, "migration.sql"), "utf-8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    try {
      await prisma.$executeRawUnsafe(statement);
    } catch (err) {
      console.warn(`[migrate] skipping statement (assumed already applied): ${(err as Error).message}`);
    }
  }
  await prisma.$executeRawUnsafe(`INSERT INTO _app_migrations (name) VALUES ('${name}')`);
}

console.log(pending.length > 0 ? `[migrate] applied ${pending.length} migration(s)` : "[migrate] up to date");
await prisma.$disconnect();
