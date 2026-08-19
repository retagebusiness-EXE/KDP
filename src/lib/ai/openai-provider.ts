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
    const size = pickSize(options?.width, options?.height);
    const res = await fetch(`${API_BASE}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.imageModel,
        prompt: `${ORIGINALITY_INSTRUCTION}\n\n${prompt}`,
        size,
        n: 1,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI image request failed (${res.status}): ${body.slice(0, 500)}`);
    }

    const json = (await res.json()) as { data: { url?: string; b64_json?: string }[] };
    const first = json.data[0];
    const url = first?.url ?? (first?.b64_json ? `data:image/png;base64,${first.b64_json}` : "");
    if (!url) throw new Error("OpenAI image response contained no image data.");

    return { url, usage: { inputTokens: Math.round(prompt.length / 4), outputTokens: 0 } };
  }
}

function pickSize(width?: number, height?: number): "1024x1024" | "1024x1792" | "1792x1024" {
  if (!width || !height) return "1024x1024";
  if (width === height) return "1024x1024";
  return width > height ? "1792x1024" : "1024x1792";
}
