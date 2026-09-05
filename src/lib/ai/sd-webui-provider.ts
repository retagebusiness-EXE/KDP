import type { AIImageOptions, AIImageResult, AIProvider, AITextOptions, AITextResult, AIUsage } from "./types";
import { MockProvider } from "./mock-provider";

const NEGATIVE_PROMPT =
  "color, colour, shading, gradient, gray, grey, text, watermark, signature, blurry, photo, realistic, " +
  "lowres, extra lines, sketchy, messy lines, cropped, jpeg artifacts";

// ponytail: SD1.5 degrades past ~768px on a 6GB card; longest side clamped here, the
// PDF renderer scales images to fit the page box anyway (see render-page.ts) so native
// pixel size doesn't need to match print DPI.
const MAX_SIDE = 768;

function clampSize(width?: number, height?: number) {
  const w = width || 768;
  const h = height || 768;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const round8 = (n: number) => Math.max(64, Math.round((n * scale) / 8) * 8);
  return { width: round8(w), height: round8(h) };
}

/**
 * Talks to a local AUTOMATIC1111 Stable Diffusion WebUI (`--api` flag) for
 * free, offline image generation. Text generation isn't SD's job, so it
 * delegates to MockProvider's topic-aware placeholder text — good enough for
 * page copy, and swappable independently once a real/local text model is wired up.
 */
export class SDWebUIProvider implements AIProvider {
  readonly name = "sd-webui";
  private baseUrl: string;
  private textDelegate = new MockProvider();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  generateText(prompt: string, options?: AITextOptions): Promise<AITextResult> {
    return this.textDelegate.generateText(prompt, options);
  }

  generateJSON<T>(prompt: string, options?: AITextOptions): Promise<{ data: T; usage: AIUsage }> {
    return this.textDelegate.generateJSON<T>(prompt, options);
  }

  async generateImage(prompt: string, options?: AIImageOptions): Promise<AIImageResult> {
    const { width, height } = clampSize(options?.width, options?.height);
    const res = await fetch(`${this.baseUrl}/sdapi/v1/txt2img`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        negative_prompt: NEGATIVE_PROMPT,
        width,
        height,
        steps: 25,
        cfg_scale: 7,
        sampler_name: "DPM++ 2M",
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Stable Diffusion WebUI request failed (${res.status}): ${body.slice(0, 500)}`);
    }

    const json = (await res.json()) as { images?: string[] };
    const b64 = json.images?.[0];
    if (!b64) throw new Error("Stable Diffusion WebUI response contained no image data.");

    return {
      url: `data:image/png;base64,${b64}`,
      usage: { inputTokens: Math.round(prompt.length / 4), outputTokens: 0 },
    };
  }
}
