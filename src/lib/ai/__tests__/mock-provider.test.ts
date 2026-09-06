import { describe, expect, it } from "vitest";
import { MockProvider } from "../mock-provider";
import { estimateCostCents } from "../cost";
import { checkOriginality } from "../safety";

describe("MockProvider", () => {
  const provider = new MockProvider();

  it("returns topic-relevant words for a known topic", async () => {
    const { data } = await provider.generateJSON<{ words: string[] }>("give me words", {
      mockKind: "word_list",
      mockContext: { topic: "Sports", count: 10 },
    });
    expect(data.words.length).toBe(10);
    expect(data.words.every((w) => /^[A-Z]+$/.test(w))).toBe(true);
  });

  it("is deterministic for identical prompt+context", async () => {
    const a = await provider.generateJSON<{ words: string[] }>("p", {
      mockKind: "word_list",
      mockContext: { topic: "Animals", count: 8 },
    });
    const b = await provider.generateJSON<{ words: string[] }>("p", {
      mockKind: "word_list",
      mockContext: { topic: "Animals", count: 8 },
    });
    expect(a.data).toEqual(b.data);
  });

  it("generates a data: URI image with zero cost", async () => {
    const result = await provider.generateImage("a friendly forest scene");
    expect(result.url.startsWith("data:image/svg+xml;base64,")).toBe(true);
    expect(estimateCostCents("mock", result.usage)).toBe(0);
  });

  it("produces metadata with at most 7 keywords", async () => {
    const { data } = await provider.generateJSON<{ keywords: string[] }>("meta", {
      mockKind: "metadata",
      mockContext: { title: "Ocean Word Search", topic: "ocean", audience: "Adults" },
    });
    expect(data.keywords.length).toBeLessThanOrEqual(7);
  });
});

describe("originality guard", () => {
  it("flags well-known trademarked terms", () => {
    const result = checkOriginality("A Pokemon themed coloring book");
    expect(result.flagged).toBe(true);
    expect(result.matchedTerms).toContain("pokemon");
  });

  it("does not flag generic themes", () => {
    const result = checkOriginality("A sports themed word search about basketball");
    expect(result.flagged).toBe(false);
  });
});
