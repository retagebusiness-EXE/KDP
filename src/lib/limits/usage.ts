import "server-only";
import { prisma } from "@/lib/db";
import { getPlanLimits } from "./plans";
import { checkGenerationBurstLimit } from "./rate-limiter";
import { estimateCostCents } from "@/lib/ai/cost";
import type { AIUsage } from "@/lib/ai/types";

export class UsageLimitError extends Error {}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Throws if the user is over their plan's monthly AI-generation quota or is
 * firing requests faster than the burst limiter allows. Call this before
 * kicking off any AI generation job.
 */
export async function assertGenerationAllowed(userId: string, plan: string): Promise<void> {
  const burst = checkGenerationBurstLimit(userId);
  if (!burst.allowed) {
    throw new UsageLimitError(
      `You're generating too quickly. Please wait ${Math.ceil(burst.retryAfterMs / 1000)}s and try again.`
    );
  }

  const limits = getPlanLimits(plan);
  const count = await prisma.usageRecord.count({
    where: { userId, type: "AI_GENERATION", createdAt: { gte: startOfMonth() } },
  });
  if (count >= limits.maxGenerationsPerMonth) {
    throw new UsageLimitError(
      `You've reached your ${limits.label} plan's monthly AI generation limit (${limits.maxGenerationsPerMonth}). Upgrade your plan to continue.`
    );
  }
}

export async function assertExportAllowed(userId: string, plan: string): Promise<void> {
  const limits = getPlanLimits(plan);
  const count = await prisma.export.count({
    where: { project: { userId }, createdAt: { gte: startOfMonth() } },
  });
  if (count >= limits.maxPdfExportsPerMonth) {
    throw new UsageLimitError(
      `You've reached your ${limits.label} plan's monthly export limit (${limits.maxPdfExportsPerMonth}). Upgrade your plan to continue.`
    );
  }
}

export async function assertProjectCreationAllowed(userId: string, plan: string): Promise<void> {
  const limits = getPlanLimits(plan);
  const count = await prisma.project.count({ where: { userId } });
  if (count >= limits.maxProjects) {
    throw new UsageLimitError(
      `You've reached your ${limits.label} plan's project limit (${limits.maxProjects}). Upgrade or delete an existing project.`
    );
  }
}

export async function recordAIUsage(
  userId: string,
  providerName: string,
  providerCostKey: string,
  usage: AIUsage
): Promise<void> {
  await prisma.usageRecord.create({
    data: {
      userId,
      type: "AI_GENERATION",
      tokensInput: usage.inputTokens,
      tokensOutput: usage.outputTokens,
      estimatedCostCents: estimateCostCents(providerCostKey, usage),
      provider: providerName,
    },
  });
}
