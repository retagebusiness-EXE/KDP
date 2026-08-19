# KDP Book Builder

An AI-assisted web app for planning, generating, editing, and exporting **original** Amazon KDP
books — word search, crossword, Sudoku, maze, kids activity, coloring, journal, planner, log book,
and notebook titles. Puzzle correctness is always computed by deterministic engines, never by AI;
AI is used only for themed word lists, clues, cover copy, listing metadata, and illustration
prompts. See [Originality & safeguards](#originality--safeguards) below.

## Project structure

```
prisma/
  schema.prisma            Data model (User, Project, Book, Page, Puzzle, PuzzleSolution,
                            Cover, Metadata, GenerationJob, UsageRecord, Export, Subscription)
  migrations/               SQL migration history

src/
  app/                      Next.js App Router
    (pages) dashboard, projects, projects/[id] (editor), .../cover, .../metadata, .../export,
            settings, admin, login, register
    api/                    Route handlers (see API design below)
  components/                React UI: ui/ (primitives), nav/, wizard/, editor/, jobs/, auth/,
                              projects/, settings/
  lib/
    engines/                 Deterministic puzzle engines: word search, sudoku, maze, crossword
                              (+ rng.ts seeded PRNG, types.ts, __tests__/)
    ai/                       AIProvider interface, MockProvider (default), OpenAIProvider,
                              safety.ts (originality guard), cost.ts (usage-cost estimator)
    generation/               book-types.ts (registry), structure.ts (page-plan layout),
                              content.ts (per-type page generators), pipeline.ts (job runners),
                              jobs.ts (queue), schemas.ts (zod), templates.ts (starter presets)
    pdf/                      dimensions.ts (KDP trim/cover math), layout.ts, render-page.ts,
                              render-interior.ts, render-cover.ts (pdf-lib, vector output)
    validation/               book-validator.ts — the pre-export validation report
    auth/                     session.ts (JWT cookie), password.ts, service.ts, guard.ts, actions.ts
    storage/                  FileStorage interface, LocalFileStorage, S3FileStorage
    limits/                   plans.ts, rate-limiter.ts, usage.ts (quota + burst limiting)
    billing/                  BillingProvider interface, NoopBillingProvider (Stripe-ready seam)
    db.ts                     Prisma client singleton (libSQL driver adapter)
  generated/prisma/           Generated Prisma client (gitignored)

scripts/make-admin.mts       Promote a user to ADMIN (for /admin access)
vitest.config.mts            Test runner config
```

### Adding a new book type

Three steps, all in `src/lib/generation/`: add an entry to `BOOK_TYPES` in `book-types.ts`, add a
`case` in `generatePageContent` in `content.ts`, and add a render branch in
`src/lib/pdf/render-page.ts` / `src/components/editor/page-preview.tsx`. Nothing else needs to
change — the wizard, job pipeline, validation, and export all read from the registry.

## Tech stack

- **Framework:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4
- **Database:** Prisma 7 ORM. **SQLite by default** for zero-setup local dev (via the libSQL
  driver adapter — no native build tools required on Windows). Swap to PostgreSQL by changing
  `datasource.provider` in `prisma/schema.prisma` and `DATABASE_URL`, then re-running migrations —
  the schema avoids native `enum` types specifically so it stays portable across both.
- **Auth:** Custom credentials (email/password, bcrypt + signed JWT session cookie) behind a
  `CredentialsAuthProvider` — structured so an OAuth provider can issue the same session later
  without touching the rest of the app.
- **Storage:** `FileStorage` interface — `LocalFileStorage` (disk, default) or `S3FileStorage`
  (AWS S3 or any S3-compatible endpoint), selected via `STORAGE_PROVIDER`.
- **AI:** `AIProvider` interface — `MockProvider` (default, deterministic, free) or
  `OpenAIProvider` (used automatically when `OPENAI_API_KEY` is set). Add another vendor by
  implementing the same interface and branching in `lib/ai/index.ts`.
- **PDF:** `pdf-lib` — vector text and vector-drawn grids/mazes/tables throughout; only
  coloring-page illustrations are raster (embedded PNG/JPEG, or a vector placeholder frame when
  the configured provider returns something else, e.g. the mock provider's SVG).
- **Jobs:** DB-backed `GenerationJob` rows (QUEUED → PROCESSING → VALIDATING → COMPLETED/FAILED)
  processed by an in-process queue (`InProcessJobQueue`, `queueMicrotask`-based). The processing
  function (`runGenerationJob`) is queue-agnostic — swap in BullMQ/Redis by implementing the same
  `JobQueue.enqueue()` interface and running `runGenerationJob` inside a `Worker` instead.
- **Tests:** Vitest (unit + integration, real SQLite DB for integration tests).

## Installation

Requires **Node.js 20.9+** (Next.js 16 minimum) and npm.

```bash
npm install
```

If npm blocks postinstall scripts on your machine (npm's `allowScripts` security prompt), approve
Prisma's and esbuild's:

```bash
npm approve-scripts "@prisma/engines" prisma unrs-resolver esbuild
```

## Environment variables

Copy `.env.example` to `.env`. **Every value has a working default** — the app runs fully
end-to-end (generation, PDF export, everything) with an empty `.env`.

| Variable | Required? | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | No | `file:./dev.db` | SQLite file path (or a Postgres URL after switching providers) |
| `SESSION_SECRET` | **Yes, in production** | insecure dev fallback | Signs session JWTs |
| `OPENAI_API_KEY` | No | unset → uses `MockProvider` | Enables real AI generation |
| `OPENAI_TEXT_MODEL` / `OPENAI_IMAGE_MODEL` | No | `gpt-4o-mini` / `dall-e-3` | Model overrides |
| `STORAGE_PROVIDER` | No | `local` | Set to `s3` for S3-compatible storage |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_PUBLIC_BASE_URL` | Only if `STORAGE_PROVIDER=s3` | — | S3 config |

The AI API key is only ever read server-side (`lib/ai/openai-provider.ts`, imported from server
actions and route handlers) — it's never bundled into client JavaScript.

## Database setup

```bash
npx prisma migrate dev     # applies migrations, creates prisma/dev.db (already run once for you)
npx prisma studio          # optional: browse the DB in a UI
```

To switch to PostgreSQL: edit `prisma/schema.prisma`'s `datasource db { provider = "postgresql" }`,
set `DATABASE_URL` to your Postgres connection string, install `@prisma/adapter-pg` and update
`src/lib/db.ts` to construct that adapter instead of `PrismaLibSql`, then run
`npx prisma migrate dev`.

## Run locally

```bash
npm run dev
```

Open http://localhost:3000, click **Create account**, then **+ Create New Book**.

To access `/admin`, promote your account:

```bash
npm run make-admin -- you@example.com
```

## Run tests

```bash
npm test          # single run
npm run test:watch
```

51 tests across 10 files: unit tests for each puzzle engine (generation + independent
re-validation), the AI mock provider, KDP cover/trim-size math, PDF rendering (page count + exact
physical dimensions), and the validation engine; integration tests that run the real job pipeline
against a real SQLite database end-to-end (generate → cover → metadata → export) and specifically
exercise the page add/delete/duplicate renumbering logic.

## Generate a sample book (no UI)

The same flow the UI drives, via `curl`, using the mock AI provider (no API key needed):

```bash
npm run dev &
# sign up through the browser first at http://localhost:3000/register, then in devtools
# copy the `kdp_session` cookie value, or just drive it all through the UI wizard directly:
# Dashboard → "+ Create New Book" → pick Word Search → topic "Sports" → audience "Adults"
# → 40 pages → 8.5x11 → Generate.
```

The wizard shows live progress ("Generating content… Building puzzles… Validating pages…
Creating answer keys…") and lands on the book editor when done.

## Export a KDP-ready package

From the book editor, open **Export**: run **Validate** to see the pass/warning/error report,
then **Export Interior PDF**, **Export Cover PDF** (after generating a cover), or **Export Full
Package** for both. Files download from `/api/files/...` (access-controlled per user) and are also
listed under Export History. Cover dimensions are computed from trim size + page count + paper
type + bleed using KDP's standard spine-width formula — **always re-verify the exported files
against Amazon KDP's current print requirements before publishing; this app does not guarantee
KDP validation.**

## Known limitations

- **Database:** SQLite by default (documented tradeoff for zero-setup local dev); Postgres is a
  config change away (see above) but not what's running out of the box.
- **AI provider:** Ships with the free deterministic `MockProvider`. Word lists, clues, and cover
  copy are template-driven rather than genuinely topic-aware without `OPENAI_API_KEY` set. Image
  generation without a real provider draws a vector placeholder frame, not real artwork.
- **Job queue:** In-process (`queueMicrotask`), not a durable external queue — a server restart
  mid-job leaves that job `PROCESSING` forever (the interface is queue-agnostic; see Tech stack).
- **Crossword placement:** Greedy intersection search, not a full backtracking solver — a handful
  of very-similar words can fail to fit and are reported as `unplacedWords` (surfaced as a
  validation warning) rather than forced in.
- **Number Puzzle** book type currently reuses the Sudoku engine (a real, distinct number-logic
  puzzle) rather than a separate original puzzle family.
- **Billing:** `NoopBillingProvider` only — plan switches happen instantly with no payment
  collected, by design (the spec asks not to wire real payments yet). The `BillingProvider`
  interface is ready for a `StripeBillingProvider` implementation.
- **Cover/interior margins:** A single configurable outer/gutter margin, not full odd/even-page
  alternating gutters or per-page margin overrides.
- **Metadata edits** are saved via a direct "Save edits" PATCH, independent from the next AI
  regeneration (which overwrites them) — there's no per-field "don't regenerate this" lock yet.
- Not exercised with a browser end-to-end in this session (no browser tool available) — instead
  verified via the real Next dev server over HTTP: authenticated session cookie, project creation,
  full book generation, cover, metadata, and a full-package export, downloading and validating the
  resulting PDFs (26 pages at exactly 8.5"×11" / 612×792pt; cover at the exact calculated
  17.0586"×11" wraparound size). Recommend a manual click-through before shipping.

## Recommended next development steps

1. Wire a real `StripeBillingProvider` behind the existing `BillingProvider` interface.
2. Swap `InProcessJobQueue` for BullMQ + Redis once running more than one server instance.
3. Add OAuth providers (Google, etc.) alongside `CredentialsAuthProvider`.
4. Strengthen the crossword layout algorithm (proper backtracking / simulated annealing) to reduce
   `unplacedWords`.
5. Add a true browser click-through / Playwright E2E suite for the wizard → editor → export flow.
6. Add per-page margin/font/background overrides in the editor's right sidebar (schema already
   supports storing them; the UI doesn't expose them yet).
7. Rate-limit by IP in addition to per-user, ahead of a public launch.
