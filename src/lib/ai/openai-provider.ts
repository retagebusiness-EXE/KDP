import type {
  AIImageOptions,
  AIImageResult,
  AIProvider,
  AITextOptions,
  AITextResult,
  AIUsage,
} from "./types";
import { ORIGINALITY_INSTRUCTION } from "./safety";

const API_BASE = "https://api.openai.com/v1";

// A hung fetch (no response, ever) would block the generation loop forever —
// worse than an error, since nothing downstream (the per-invocation time
// budget in pipeline.ts included) gets a chance to run. Image generation is
// the slow call; give it more room than text.
export const TEXT_TIMEOUT_MS = 15_000;
export const IMAGE_TIMEOUT_MS = 35_000;

export interface OpenAIProviderConfig {
  apiKey: string;
  textModel?: string;
  imageModel?: string;
}

/**
 * Thin wrapper around the OpenAI REST API. This file only ever runs on the
 * server (imported from server actions / route handlers / the job worker) —
 * the API key must never reach a client bundle.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private apiKey: string;
  private textModel: string;
  private imageModel: string;

  constructor(config: OpenAIProviderConfig) {
    if (!config.apiKey) {
      throw new Error("OpenAIProvider requires an API key.");
    }
    this.apiKey = config.apiKey;
    this.textModel = config.textModel ?? "gpt-4o-mini";
    this.imageModel = config.imageModel ?? "dall-e-3";
  }

  private async chat(prompt: string, options?: AITextOptions, jsonMode = false): Promise<AITextResult> {
    const res = await fetch(`${API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.textModel,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxOutputTokens ?? 1000,
        response_format: jsonMode ? { type: "json_object" } : undefined,
        messages: [
          { role: "system", content: ORIGINALITY_INSTRUCTION },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(TEXT_TIMEOUT_MS),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI request failed (${res.status}): ${body.slice(0, 500)}`);
    }

    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    const text = json.choices[0]?.message?.content ?? "";
    const usage: AIUsage = {
      inputTokens: json.usage?.prompt_tokens ?? Math.round(prompt.length / 4),
      outputTokens: json.usage?.completion_tokens ?? Math.round(text.length / 4),
    };
    return { text, usage };
  }

  async generateText(prompt: string, options?: AITextOptions): Promise<AITextResult> {
    return this.chat(prompt, options, false);
  }

  async generateJSON<T>(
    prompt: string,
    options?: AITextOptions
  ): Promise<{ data: T; usage: AIUsage }> {
    const { text, usage } = await this.chat(
      `${prompt}\n\nRespond with a single valid JSON object/array only. No prose, no markdown fences.`,
      options,
      true
    );
    try {
      return { data: JSON.parse(text) as T, usage };
    } catch {
      throw new Error(`OpenAI response was not valid JSON: ${text.slice(0, 300)}`);
    }
  }

  async generateImage(prompt: string, options?: AIImageOptions): Promise<AIImageResult> {
    const isGptImage = this.imageModel.startsWith("gpt-image");
    const size = pickSize(this.imageModel, options?.width, options?.height);
    const body: Record<string, unknown> = {
      model: this.imageModel,
      prompt: `${ORIGINALITY_INSTRUCTION}\n\n${prompt}`,
      size,
      n: 1,
    };
    // gpt-image-1 always returns base64 and rejects an explicit response_format;
    // dall-e-2/3 default to a temporary hosted URL unless told otherwise. Coloring
    // pages are saved permanently (no server-side file storage — see pipeline.ts),
    // so the image bytes must be embedded as a data URI up front; a hosted URL
    // would expire within the hour and silently break the page later.
    if (!isGptImage) body.response_format = "b64_json";
    // gpt-image-1 defaults to "auto" quality, which measured 35s+ (occasionally
    // aborting IMAGE_TIMEOUT_MS below) — incompatible with the serverless
    // per-invocation time budget in pipeline.ts. "medium" measured ~14s and is
    // plenty for line-art coloring pages, which don't need photographic detail.
    if (isGptImage) body.quality = "medium";

    const res = await fetch(`${API_BASE}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    });

    if (!res.ok) {
      const responseBody = await res.text().catch(() => "");
      throw new Error(`OpenAI image request failed (${res.status}): ${responseBody.slice(0, 500)}`);
    }

    const json = (await res.json()) as { data: { url?: string; b64_json?: string }[] };
    const first = json.data[0];
    const url = first?.b64_json ? `data:image/png;base64,${first.b64_json}` : (first?.url ?? "");
    if (!url) throw new Error("OpenAI image response contained no image data.");

    return { url, usage: { inputTokens: Math.round(prompt.length / 4), outputTokens: 0 } };
  }
}

function pickSize(model: string, width?: number, height?: number) {
  if (model.startsWith("gpt-image")) {
    if (!width || !height || width === height) return "1024x1024" as const;
    return width > height ? "1536x1024" as const : "1024x1536" as const;
  }
  if (!width || !height || width === height) return "1024x1024" as const;
  return width > height ? "1792x1024" as const : "1024x1792" as const;
}
