import { describe, expect, it, vi, afterEach } from "vitest";
import { SDWebUIProvider } from "../sd-webui-provider";

describe("SDWebUIProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clamps request size to 768 max side, rounded to multiples of 8", async () => {
    let sentBody: { width: number; height: number } | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        sentBody = JSON.parse(init.body as string);
        return new Response(JSON.stringify({ images: ["AAAA"] }), { status: 200 });
      })
    );

    const provider = new SDWebUIProvider("http://127.0.0.1:7860");
    await provider.generateImage("a fox in a forest", { width: 1700, height: 2200 });

    expect(sentBody).toBeDefined();
    expect(Math.max(sentBody!.width, sentBody!.height)).toBeLessThanOrEqual(768);
    expect(sentBody!.width % 8).toBe(0);
    expect(sentBody!.height % 8).toBe(0);
  });

  it("returns a data: URI built from the response's base64 image", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ images: ["Zm9v"] }), { status: 200 }))
    );
    const provider = new SDWebUIProvider("http://127.0.0.1:7860/");
    const result = await provider.generateImage("a cat");
    expect(result.url).toBe("data:image/png;base64,Zm9v");
  });

  it("throws when the WebUI response has no image data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ images: [] }), { status: 200 }))
    );
    const provider = new SDWebUIProvider("http://127.0.0.1:7860");
    await expect(provider.generateImage("a cat")).rejects.toThrow("no image data");
  });
});
