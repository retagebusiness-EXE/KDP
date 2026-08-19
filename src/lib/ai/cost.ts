import type { AIUsage } from "./types";

/**
 * Rough, clearly-labeled cost estimates in USD cents per 1K tokens. These are
 * approximations for budgeting/UI display only — always confirm current
 * pricing with the provider before relying on this for billing.
 */
const PRICING_CENTS_PER_1K: Record<string, { input: number; output: number }> = {
  mock: { input: 0, output: 0 },
  "openai:gpt-4o-mini": { input: 0.015, output: 0.06 },
  "openai:gpt-4o": { input: 0.25, output: 1.0 },
  "openai:dall-e-3": { input: 0, output: 400 }, // flat-ish per image, stored as "output"
};

export function estimateCostCents(providerKey: string, usage: AIUsage): number {
  const pricing = PRICING_CENTS_PER_1K[providerKey] ?? PRICING_CENTS_PER_1K.mock;
  const inputCost = (usage.inputTokens / 1000) * pricing.input;
  const outputCost = (usage.outputTokens / 1000) * pricing.output;
  return Math.round(inputCost + outputCost);
}
