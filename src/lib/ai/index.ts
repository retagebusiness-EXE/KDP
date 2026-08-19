import { MockProvider } from "./mock-provider";
import { OpenAIProvider } from "./openai-provider";
import type { AIProvider } from "./types";

export * from "./types";
export * from "./safety";
export * from "./cost";
export { MockProvider } from "./mock-provider";
export { OpenAIProvider } from "./openai-provider";

let cached: AIProvider | null = null;

/**
 * Provider selection lives in exactly one place. Add a new vendor by writing
 * a class that implements `AIProvider` and adding one branch here — nothing
 * else in the app needs to change.
 */
export function getAIProvider(): AIProvider {
  if (cached) return cached;

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    cached = new OpenAIProvider({
      apiKey,
      textModel: process.env.OPENAI_TEXT_MODEL,
      imageModel: process.env.OPENAI_IMAGE_MODEL,
    });
  } else {
    cached = new MockProvider();
  }
  return cached;
}

/** Provider key used for cost-table lookups (see cost.ts). */
export function providerCostKey(provider: AIProvider): string {
  if (provider.name === "openai") return `openai:${process.env.OPENAI_TEXT_MODEL ?? "gpt-4o-mini"}`;
  return "mock";
}
