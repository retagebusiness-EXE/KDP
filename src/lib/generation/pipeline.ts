import "server-only";
import { prisma } from "@/lib/db";
import { getAIProvider, providerCostKey } from "@/lib/ai";
import type { AIUsage } from "@/lib/ai/types";
import { checkOriginality } from "@/lib/ai/safety";
import { recordAIUsage } from "@/lib/limits/usage";
import { calculateCoverDimensions, type InteriorColor, type PaperType } from "@/lib/pdf/dimensions";
import { renderInteriorPdf, type InteriorPageInput } from "@/lib/pdf/render-interior";
import { renderCoverPdf } from "@/lib/pdf/render-cover";
import { getFileStorage } from "@/lib/storage";
import { validateBook, type ValidationPageInput } from "@/lib/validation";
import { getBookTypeConfig, type BookTypeId } from "./book-types";
import { computeBookStructure } from "./structure";
import {
  generateAnswerKeyPage,
  generatePageContent,
  generateTitlePageContent,
  type AnswerKeyBatchInput,
  type BookContext,
  type GeneratedPage,
} from "./content";
import type { CoverGenerateRequest, ExportRequest } from "./schemas";

const ZERO_USAGE: AIUsage = { inputTokens: 0, outputTokens: 0 };
function addUsage(a: AIUsage, b: AIUsage): AIUsage {
  return { inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens };
}

interface JobUpdate {
  status?: string;
  progress?: number;
  message?: string;
  result?: unknown;
  error?: string;
  finishedAt?: Date;
}

async function updateJob(jobId: string, update: JobUpdate) {
  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      ...update,
      result: update.result !== undefined ? JSON.stringify(update.result) : undefined,
    },
  });
}

/**
 * Single entry point the job queue calls. Dispatches on `job.type` to the
 * right runner below. A future BullMQ worker would import this same
 * function and call it per job pulled off the Redis queue.
 */
export async function runGenerationJob(jobId: string): Promise<void> {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  try {
    switch (job.type) {
      case "BOOK_GENERATE":
        await runBookGenerate(job.id, job.projectId);
        break;
      case "PAGE_REGENERATE":
        await runPageRegenerate(job.id, job.projectId, JSON.parse(job.input ?? "{}"));
        break;
      case "COVER_GENERATE":
        await runCoverGenerate(job.id, job.projectId, JSON.parse(job.input ?? "{}"));
        break;
      case "METADATA_GENERATE":
        await runMetadataGenerate(job.id, job.projectId);
        break;
      case "PDF_EXPORT":
        await runExport(job.id, job.projectId, JSON.parse(job.input ?? "{}"));
        break;
      default:
        await updateJob(jobId, { status: "FAILED", error: `Unknown job type: ${job.type}`, finishedAt: new Date() });
    }
  } catch (err) {
    await updateJob(jobId, {
      status: "FAILED",
      error: err instanceof Error ? err.message : "Unknown error during generation.",
      finishedAt: new Date(),
    });
  }
}

// ---------------------------------------------------------------------------
// BOOK_GENERATE
// ---------------------------------------------------------------------------

async function runBookGenerate(jobId: string, projectId: string): Promise<void> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { book: true, user: true } });
  const book = project.book;
  if (!book) throw new Error("Project has no book configuration yet.");

  const originality = checkOriginality(book.title, book.topic, book.description ?? undefined);
  if (originality.flagged) {
    throw new Error(originality.message);
  }

  await updateJob(jobId, { status: "PROCESSING", progress: 5, message: "Generating content..." });
  await prisma.page.deleteMany({ where: { bookId: book.id } });

  const structure = computeBookStructure(project.bookType as BookTypeId, book.pageCount);
  const ai = getAIProvider();
  const ctx: BookContext = {
    title: book.title,
    topic: book.topic,
    audience: book.audience,
    difficulty: book.difficulty as BookContext["difficulty"],
    description: book.description ?? undefined,
    bookType: project.bookType as BookTypeId,
    trimWidthIn: book.trimWidth,
    trimHeightIn: book.trimHeight,
  };

  let totalUsage: AIUsage = ZERO_USAGE;

  for (const plan of structure.pages) {
    if (plan.kind === "title") {
      const generated = await generateTitlePageContent(ctx, ai);
      await persistPage(book.id, plan.index, generated);
      totalUsage = addUsage(totalUsage, generated.usage);
      continue;
    }
    if (plan.kind === "content") {
      await updateJob(jobId, {
        progress: 5 + Math.round((plan.ordinal / structure.contentPageCount) * 70),
        message: "Building puzzles...",
      });
      const seed = `${book.id}:${plan.index}`;
      const generated = await generatePageContent(ctx, plan.ordinal, seed, ai);
      await persistPage(book.id, plan.index, generated);
      totalUsage = addUsage(totalUsage, generated.usage);
      continue;
    }
    if (plan.kind === "blank") {
      await persistPage(book.id, plan.index, { type: "blank", title: "", content: {}, usage: ZERO_USAGE });
    }
    // answer_key pages are generated together below, once all content pages exist.
  }

  const bookTypeConfig = getBookTypeConfig(project.bookType as BookTypeId);
  if (bookTypeConfig.hasAnswerKeys) {
    await updateJob(jobId, { progress: 80, message: "Creating answer keys..." });
    await rebuildAnswerKeyPages(book.id, project.bookType as BookTypeId);
  }

  if (totalUsage.inputTokens + totalUsage.outputTokens > 0) {
    await recordAIUsage(project.userId, ai.name, providerCostKey(ai), totalUsage);
  }

  await updateJob(jobId, { progress: 90, message: "Validating pages..." });
  const report = await validateProjectBook(project.id);

  await prisma.project.update({ where: { id: project.id }, data: { status: "READY" } });
  await updateJob(jobId, {
    status: "COMPLETED",
    progress: 100,
    message: "Book generated.",
    result: { pageCount: structure.totalPageCount, validation: report },
    finishedAt: new Date(),
  });
}

export async function persistPage(bookId: string, index: number, generated: GeneratedPage): Promise<void> {
  const page = await prisma.page.create({
    data: {
      bookId,
      index,
      type: generated.type,
      title: generated.title,
      content: JSON.stringify(generated.content),
      status: "GENERATED",
    },
  });
  if (generated.puzzle && generated.solution) {
    const puzzle = await prisma.puzzle.create({
      data: {
        pageId: page.id,
        type: generated.puzzle.type,
        difficulty: generated.puzzle.difficulty,
        data: JSON.stringify(generated.puzzle.data),
      },
    });
    await prisma.puzzleSolution.create({
      data: { puzzleId: puzzle.id, data: JSON.stringify(generated.solution.data) },
    });
  }
}

/**
 * Recomputes every answer-key page from the current puzzle/solution rows in
 * the database. Cheap (no AI calls) and deterministic, so it's safe to call
 * after any single page regeneration to keep answer keys in sync — the
 * alternative (patching one stale answer entry) risks drifting from the
 * puzzle it's supposed to match.
 */
/**
 * Fully renormalizes page indices (title=0, content=1..N contiguously, then
 * answer-key pages, then a trailing blank pad if needed) and regenerates the
 * answer-key section from current puzzle/solution rows. Called after any
 * structural change (page add/delete/duplicate/regenerate) so answer keys
 * and page numbering never drift, regardless of what changed upstream.
 */
export async function rebuildAnswerKeyPages(bookId: string, bookType: BookTypeId): Promise<void> {
  const config = getBookTypeConfig(bookType);

  await prisma.page.deleteMany({ where: { bookId, type: { in: ["answer_key", "blank"] } } });

  const [titlePage, contentPages] = await Promise.all([
    prisma.page.findFirst({ where: { bookId, type: "title" } }),
    prisma.page.findMany({
      where: { bookId, type: { notIn: ["title", "answer_key", "blank"] } },
      orderBy: { index: "asc" },
      include: { puzzle: { include: { solution: true } } },
    }),
  ]);

  // Renumber contiguously: title at 0 (if present), then content pages in
  // their existing relative order. Use a temporary offset to avoid unique
  // (bookId, index) collisions while shuffling indices in place.
  const OFFSET = 100000;
  let cursor = 0;
  if (titlePage) {
    await prisma.page.update({ where: { id: titlePage.id }, data: { index: OFFSET + cursor } });
    cursor++;
  }
  for (const page of contentPages) {
    await prisma.page.update({ where: { id: page.id }, data: { index: OFFSET + cursor } });
    cursor++;
  }
  await prisma.page.updateMany({ where: { bookId, index: { gte: OFFSET } }, data: { index: { decrement: OFFSET } } });

  let nextIndex = cursor;
  if (config.hasAnswerKeys && contentPages.length > 0) {
    const perPage = Math.max(1, config.answersPerPage);
    const ctx: BookContext = { title: "", topic: "", audience: "", difficulty: "MEDIUM", bookType };

    for (let batchStart = 0; batchStart < contentPages.length; batchStart += perPage) {
      const batchPages = contentPages.slice(batchStart, batchStart + perPage);
      const batch: AnswerKeyBatchInput = {
        ordinal: batchStart / perPage,
        entries: batchPages
          .map((p, i) => ({ p, pageNumber: batchStart + i + 2 })) // +1 for 0-index, +1 for the title page ahead of it
          .filter((e) => e.p.puzzle && e.p.puzzle.solution)
          .map(({ p, pageNumber }) => ({
            pageNumber,
            title: p.title ?? "",
            puzzleType: p.puzzle!.type,
            puzzleData: JSON.parse(p.puzzle!.data),
            solutionData: JSON.parse(p.puzzle!.solution!.data),
          })),
      };
      const generated = generateAnswerKeyPage(ctx, batch);
      await persistPage(bookId, nextIndex++, generated);
    }
  }

  // Trailing blank page (if needed) so the interior stays an even page count.
  const total = await prisma.page.count({ where: { bookId } });
  if (total % 2 !== 0) {
    await persistPage(bookId, nextIndex, { type: "blank", title: "", content: {}, usage: ZERO_USAGE });
  }
}

// ---------------------------------------------------------------------------
// PAGE_REGENERATE
// ---------------------------------------------------------------------------

async function runPageRegenerate(jobId: string, projectId: string, input: { pageId: string }): Promise<void> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { book: true, user: true } });
  const book = project.book;
  if (!book) throw new Error("Project has no book configuration yet.");

  const page = await prisma.page.findUniqueOrThrow({ where: { id: input.pageId } });
  if (page.bookId !== book.id) throw new Error("Page does not belong to this project.");
  if (page.type === "title" || page.type === "answer_key" || page.type === "blank") {
    throw new Error(`Page type "${page.type}" cannot be regenerated directly.`);
  }

  await updateJob(jobId, { status: "PROCESSING", progress: 20, message: "Regenerating page..." });

  const ordinal = page.index - 1; // title page always occupies index 0
  const ctx: BookContext = {
    title: book.title,
    topic: book.topic,
    audience: book.audience,
    difficulty: book.difficulty as BookContext["difficulty"],
    description: book.description ?? undefined,
    bookType: project.bookType as BookTypeId,
    trimWidthIn: book.trimWidth,
    trimHeightIn: book.trimHeight,
  };
  const ai = getAIProvider();
  const seed = `${book.id}:${page.index}:regen:${Date.now()}`;
  const generated = await generatePageContent(ctx, ordinal, seed, ai);

  await prisma.puzzleSolution.deleteMany({ where: { puzzle: { pageId: page.id } } });
  await prisma.puzzle.deleteMany({ where: { pageId: page.id } });
  await prisma.page.update({
    where: { id: page.id },
    data: { type: generated.type, title: generated.title, content: JSON.stringify(generated.content), status: "GENERATED" },
  });
  if (generated.puzzle && generated.solution) {
    const puzzle = await prisma.puzzle.create({
      data: { pageId: page.id, type: generated.puzzle.type, difficulty: generated.puzzle.difficulty, data: JSON.stringify(generated.puzzle.data) },
    });
    await prisma.puzzleSolution.create({ data: { puzzleId: puzzle.id, data: JSON.stringify(generated.solution.data) } });
  }

  if (generated.usage.inputTokens + generated.usage.outputTokens > 0) {
    await recordAIUsage(project.userId, ai.name, providerCostKey(ai), generated.usage);
  }

  await updateJob(jobId, { progress: 70, message: "Refreshing answer keys..." });
  await rebuildAnswerKeyPages(book.id, project.bookType as BookTypeId);

  await updateJob(jobId, {
    status: "COMPLETED",
    progress: 100,
    message: "Page regenerated.",
    result: { pageId: page.id },
    finishedAt: new Date(),
  });
}

// ---------------------------------------------------------------------------
// COVER_GENERATE
// ---------------------------------------------------------------------------

const DEFAULT_PALETTE = ["#1E3A8A", "#F59E0B", "#F8FAFC"];

async function runCoverGenerate(jobId: string, projectId: string, input: CoverGenerateRequest): Promise<void> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { book: true, user: true } });
  const book = project.book;
  if (!book) throw new Error("Project has no book configuration yet.");

  const originality = checkOriginality(input.title ?? book.title, book.topic, input.style);
  if (originality.flagged) throw new Error(originality.message);

  await updateJob(jobId, { status: "PROCESSING", progress: 30, message: "Generating cover..." });

  const ai = getAIProvider();
  const { data, usage } = await ai.generateJSON<{ tagline: string }>(
    `One short original back-cover blurb sentence for a book titled "${input.title ?? book.title}" about "${book.topic}".`,
    { mockKind: "cover_copy", mockContext: { topic: book.topic } }
  );
  if (usage.inputTokens + usage.outputTokens > 0) {
    await recordAIUsage(project.userId, ai.name, providerCostKey(ai), usage);
  }

  const dims = calculateCoverDimensions({
    trimWidthIn: book.trimWidth,
    trimHeightIn: book.trimHeight,
    pageCount: await prisma.page.count({ where: { bookId: book.id } }) || book.pageCount,
    paperType: book.paperType as PaperType,
    interiorColor: book.interiorColor as InteriorColor,
    bleed: book.bleed,
  });

  await prisma.cover.upsert({
    where: { bookId: book.id },
    update: {
      title: input.title ?? book.title,
      subtitle: input.subtitle,
      author: input.author,
      spineWidthIn: dims.spineWidthIn,
      fullWidthIn: dims.fullWidthIn,
      fullHeightIn: dims.fullHeightIn,
      colors: JSON.stringify(input.colors ?? DEFAULT_PALETTE),
      layout: JSON.stringify({ style: input.style ?? "centered" }),
      status: "GENERATED",
    },
    create: {
      bookId: book.id,
      title: input.title ?? book.title,
      subtitle: input.subtitle,
      author: input.author,
      spineWidthIn: dims.spineWidthIn,
      fullWidthIn: dims.fullWidthIn,
      fullHeightIn: dims.fullHeightIn,
      colors: JSON.stringify(input.colors ?? DEFAULT_PALETTE),
      layout: JSON.stringify({ style: input.style ?? "centered" }),
      status: "GENERATED",
    },
  });

  await updateJob(jobId, {
    status: "COMPLETED",
    progress: 100,
    message: "Cover generated.",
    result: { tagline: data.tagline, dimensions: dims },
    finishedAt: new Date(),
  });
}

// ---------------------------------------------------------------------------
// METADATA_GENERATE
// ---------------------------------------------------------------------------

async function runMetadataGenerate(jobId: string, projectId: string): Promise<void> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { book: true, user: true } });
  const book = project.book;
  if (!book) throw new Error("Project has no book configuration yet.");

  await updateJob(jobId, { status: "PROCESSING", progress: 30, message: "Generating metadata..." });

  const ai = getAIProvider();
  const { data, usage } = await ai.generateJSON<{
    title: string;
    subtitle: string;
    description: string;
    keywords: string[];
    categories: string[];
    features: string[];
    backCoverText: string;
  }>(
    `Generate KDP listing metadata (title, subtitle, description, 7 keywords, BISAC category suggestions, ` +
      `feature bullets, back-cover blurb) for a ${project.bookType.replace("_", " ")} book titled "${book.title}" about ` +
      `"${book.topic}" for ${book.audience}.`,
    { mockKind: "metadata", mockContext: { title: book.title, topic: book.topic, audience: book.audience } }
  );
  if (usage.inputTokens + usage.outputTokens > 0) {
    await recordAIUsage(project.userId, ai.name, providerCostKey(ai), usage);
  }

  await prisma.metadata.upsert({
    where: { bookId: book.id },
    update: {
      title: data.title,
      subtitle: data.subtitle,
      description: data.description,
      keywords: JSON.stringify(data.keywords.slice(0, 7)),
      categories: JSON.stringify(data.categories),
      audience: book.audience,
      features: JSON.stringify(data.features),
      backCoverText: data.backCoverText,
    },
    create: {
      bookId: book.id,
      title: data.title,
      subtitle: data.subtitle,
      description: data.description,
      keywords: JSON.stringify(data.keywords.slice(0, 7)),
      categories: JSON.stringify(data.categories),
      audience: book.audience,
      features: JSON.stringify(data.features),
      backCoverText: data.backCoverText,
    },
  });

  await updateJob(jobId, {
    status: "COMPLETED",
    progress: 100,
    message: "Metadata generated.",
    result: { title: data.title },
    finishedAt: new Date(),
  });
}

// ---------------------------------------------------------------------------
// PDF_EXPORT
// ---------------------------------------------------------------------------

async function runExport(jobId: string, projectId: string, input: ExportRequest): Promise<void> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { book: { include: { cover: true } }, user: true } });
  const book = project.book;
  if (!book) throw new Error("Project has no book configuration yet.");

  await updateJob(jobId, { status: "VALIDATING", progress: 10, message: "Validating pages..." });
  const report = await validateProjectBook(projectId);
  if (!report.ok) {
    throw new Error(`Export blocked by validation errors: ${report.errors.map((e) => e.message).join(" | ")}`);
  }

  await updateJob(jobId, { status: "PROCESSING", progress: 40, message: "Rendering PDF..." });
  const storage = getFileStorage();
  const timestamp = Date.now();
  const exportIds: Record<string, string> = {};
  const urls: Record<string, string> = {};

  if (input.type === "INTERIOR_PDF" || input.type === "FULL_PACKAGE") {
    const pages = await prisma.page.findMany({ where: { bookId: book.id }, orderBy: { index: "asc" } });
    const interiorPages: InteriorPageInput[] = pages.map((p) => ({ index: p.index, type: p.type, content: JSON.parse(p.content) }));
    const bytes = await renderInteriorPdf({ trimWidthIn: book.trimWidth, trimHeightIn: book.trimHeight }, interiorPages);
    const key = `${project.userId}/exports/${projectId}/interior-${timestamp}.pdf`;
    await storage.put(key, Buffer.from(bytes), { contentType: "application/pdf" });
    const rec = await prisma.export.create({
      data: { projectId, type: "INTERIOR_PDF", filePath: key, fileSizeBytes: bytes.byteLength, validationReport: JSON.stringify(report) },
    });
    exportIds.interior = rec.id;
    urls.interior = storage.urlFor(key);
  }

  if (input.type === "COVER_PDF" || input.type === "FULL_PACKAGE") {
    if (!book.cover) throw new Error("Generate a cover before exporting it.");
    await updateJob(jobId, { progress: 70, message: "Rendering cover..." });
    const colors = JSON.parse(book.cover.colors) as string[];
    const bytes = await renderCoverPdf({
      title: book.cover.title,
      subtitle: book.cover.subtitle ?? undefined,
      author: book.cover.author,
      backCoverText: undefined,
      colors,
      dimensions: {
        trimWidthIn: book.trimWidth,
        trimHeightIn: book.trimHeight,
        pageCount: await prisma.page.count({ where: { bookId: book.id } }),
        paperType: book.paperType as PaperType,
        interiorColor: book.interiorColor as InteriorColor,
        bleed: book.bleed,
      },
    });
    const key = `${project.userId}/exports/${projectId}/cover-${timestamp}.pdf`;
    await storage.put(key, Buffer.from(bytes), { contentType: "application/pdf" });
    const rec = await prisma.export.create({
      data: { projectId, type: "COVER_PDF", filePath: key, fileSizeBytes: bytes.byteLength, validationReport: JSON.stringify(report) },
    });
    exportIds.cover = rec.id;
    urls.cover = storage.urlFor(key);
  }

  await updateJob(jobId, {
    status: "COMPLETED",
    progress: 100,
    message: "Export ready.",
    result: { exportIds, urls, validation: report },
    finishedAt: new Date(),
  });
}

// ---------------------------------------------------------------------------
// Shared validation loader
// ---------------------------------------------------------------------------

export async function validateProjectBook(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { book: { include: { cover: true } } } });
  const book = project.book;
  if (!book) throw new Error("Project has no book configuration yet.");

  const pages = await prisma.page.findMany({
    where: { bookId: book.id },
    orderBy: { index: "asc" },
    include: { puzzle: { include: { solution: true } } },
  });

  const input: ValidationPageInput[] = pages.map((p) => ({
    index: p.index,
    type: p.type,
    content: JSON.parse(p.content),
    puzzle: p.puzzle ? { type: p.puzzle.type, data: JSON.parse(p.puzzle.data) } : null,
    solution: p.puzzle?.solution ? { data: JSON.parse(p.puzzle.solution.data) } : null,
  }));

  return validateBook({
    trimWidthIn: book.trimWidth,
    trimHeightIn: book.trimHeight,
    bleed: book.bleed,
    paperType: book.paperType as PaperType,
    interiorColor: book.interiorColor as InteriorColor,
    pages: input,
    cover: book.cover
      ? { fullWidthIn: book.cover.fullWidthIn, fullHeightIn: book.cover.fullHeightIn, spineWidthIn: book.cover.spineWidthIn }
      : null,
  });
}
