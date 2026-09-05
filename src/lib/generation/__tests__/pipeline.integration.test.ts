import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { runGenerationJob, exportInteriorPdf, exportCoverPdf } from "../pipeline";

describe("generation job pipeline (integration, mock AI provider)", () => {
  let userId: string;
  let projectId: string;
  let bookId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `pipeline-test-${Date.now()}@example.com`, passwordHash: "x" },
    });
    userId = user.id;
    const project = await prisma.project.create({
      data: { userId, name: "Test Sports Word Search", bookType: "word_search" },
    });
    projectId = project.id;
    const book = await prisma.book.create({
      data: {
        projectId,
        title: "Sports Word Search",
        topic: "Sports",
        audience: "Adults",
        difficulty: "EASY",
        pageCount: 20,
        trimWidth: 8.5,
        trimHeight: 11,
        bleed: false,
        interiorColor: "BW",
        paperType: "WHITE",
        coverFinish: "MATTE",
      },
    });
    bookId = book.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it("generates a full book with title, content, and answer-key pages", async () => {
    const job = await prisma.generationJob.create({
      data: { projectId, type: "BOOK_GENERATE", status: "QUEUED", input: "{}" },
    });
    await runGenerationJob(job.id);

    const finishedJob = await prisma.generationJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(finishedJob.status).toBe("COMPLETED");

    const pages = await prisma.page.findMany({ where: { bookId }, orderBy: { index: "asc" } });
    expect(pages[0].type).toBe("title");
    expect(pages.filter((p) => p.type === "word_search").length).toBe(20);
    expect(pages.some((p) => p.type === "answer_key")).toBe(true);
    expect(pages.length % 2).toBe(0);

    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    expect(project.status).toBe("READY");

    for (const page of pages.filter((p) => p.type === "word_search")) {
      const puzzle = await prisma.puzzle.findUnique({ where: { pageId: page.id }, include: { solution: true } });
      expect(puzzle).not.toBeNull();
      expect(puzzle?.solution).not.toBeNull();
    }
  }, 30000);

  it("generates unique word lists across different pages (mock provider varies by page)", async () => {
    const pages = await prisma.page.findMany({
      where: { bookId, type: "word_search" },
      orderBy: { index: "asc" },
      include: { puzzle: true },
    });
    const wordSets = pages.map((p) => JSON.parse(p.puzzle!.data).words.sort().join(","));
    expect(new Set(wordSets).size).toBeGreaterThan(1);
  });

  it("regenerates a single page without touching the others", async () => {
    const pages = await prisma.page.findMany({ where: { bookId, type: "word_search" }, orderBy: { index: "asc" } });
    const target = pages[0];
    const untouched = pages[1];
    const untouchedContentBefore = untouched.content;

    const job = await prisma.generationJob.create({
      data: { projectId, type: "PAGE_REGENERATE", status: "QUEUED", input: JSON.stringify({ pageId: target.id }) },
    });
    await runGenerationJob(job.id);

    const finishedJob = await prisma.generationJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(finishedJob.status).toBe("COMPLETED");

    const untouchedAfter = await prisma.page.findUniqueOrThrow({ where: { id: untouched.id } });
    expect(untouchedAfter.content).toBe(untouchedContentBefore);
  }, 15000);

  it("generates a cover with correctly calculated dimensions", async () => {
    const job = await prisma.generationJob.create({
      data: { projectId, type: "COVER_GENERATE", status: "QUEUED", input: JSON.stringify({ author: "Jane Author" }) },
    });
    await runGenerationJob(job.id);

    const finishedJob = await prisma.generationJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(finishedJob.status).toBe("COMPLETED");

    const cover = await prisma.cover.findUnique({ where: { bookId } });
    expect(cover).not.toBeNull();
    expect(cover!.fullWidthIn).toBeGreaterThan(8.5 * 2);
  }, 15000);

  it("generates metadata with at most 7 keywords", async () => {
    const job = await prisma.generationJob.create({
      data: { projectId, type: "METADATA_GENERATE", status: "QUEUED", input: "{}" },
    });
    await runGenerationJob(job.id);

    const finishedJob = await prisma.generationJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(finishedJob.status).toBe("COMPLETED");

    const metadata = await prisma.metadata.findUnique({ where: { bookId } });
    expect(metadata).not.toBeNull();
    expect(JSON.parse(metadata!.keywords).length).toBeLessThanOrEqual(7);
  }, 15000);

  it("exports interior and cover PDFs synchronously, in-memory, after validation passes", async () => {
    const interior = await exportInteriorPdf(projectId);
    expect(interior.bytes.byteLength).toBeGreaterThan(0);
    expect(interior.filename).toMatch(/\.pdf$/);

    const cover = await exportCoverPdf(projectId);
    expect(cover.bytes.byteLength).toBeGreaterThan(0);

    const exports = await prisma.export.findMany({ where: { projectId } });
    expect(exports.length).toBe(2);
    expect(exports.map((e) => e.type).sort()).toEqual(["COVER_PDF", "INTERIOR_PDF"]);
    for (const exp of exports) {
      expect(exp.fileSizeBytes).toBeGreaterThan(0);
      const report = JSON.parse(exp.validationReport);
      expect(report.ok).toBe(true);
    }
  }, 30000);
});
