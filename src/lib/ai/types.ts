export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AITextResult {
  text: string;
  usage: AIUsage;
}

export interface AIImageResult {
  /** data: URI or absolute URL to the generated image */
  url: string;
  usage: AIUsage;
}

/**
 * Known structured-generation tasks. Real providers ignore `mockKind`/
 * `mockContext` entirely (they only see `prompt`); the mock provider uses
 * them instead of natural-language understanding to return useful,
 * topic-aware placeholder data without calling out to a real model.
 */
export type MockKind =
  | "word_list"
  | "crossword_words"
  | "crossword_clues"
  | "metadata"
  | "cover_copy"
  | "coloring_prompt"
  | "page_text";

export interface AITextOptions {
  /** Higher = more creative. 0-1. */
  temperature?: number;
  maxOutputTokens?: number;
  mockKind?: MockKind;
  mockContext?: Record<string, unknown>;
}

export interface AIImageOptions {
  width?: number;
  height?: number;
  style?: string;
}

/**
 * Provider-agnostic interface for all AI calls in the app. Nothing outside
 * this file (and the concrete provider implementations) should know or care
 * which vendor is actually generating content — that keeps us from ever
 * hard-coding a single AI vendor into the product.
 */
export interface AIProvider {
  readonly name: string;

  generateText(prompt: string, options?: AITextOptions): Promise<AITextResult>;

  /**
   * Convenience wrapper around generateText that asks the model for JSON and
   * parses it. Throws a descriptive error (caller decides whether to retry)
   * if the response is not valid JSON.
   */
  generateJSON<T>(prompt: string, options?: AITextOptions): Promise<{ data: T; usage: AIUsage }>;

  generateImage(prompt: string, options?: AIImageOptions): Promise<AIImageResult>;
}
