export type PlanId = "FREE" | "CREATOR" | "PRO";

export interface PlanLimits {
  label: string;
  maxProjects: number;
  maxGenerationsPerMonth: number;
  maxPdfExportsPerMonth: number;
  watermarkPreviews: boolean;
  bulkGeneration: boolean;
  priorityGeneration: boolean;
}

/**
 * Central place that defines what each plan is allowed to do. Nothing here
 * talks to a payment processor — this is the entitlement table a future
 * Stripe integration would keep in sync via webhooks (see `lib/billing`).
 */
export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  FREE: {
    label: "Free",
    maxProjects: 2,
    maxGenerationsPerMonth: 20,
    maxPdfExportsPerMonth: 3,
    watermarkPreviews: true,
    bulkGeneration: false,
    priorityGeneration: false,
  },
  CREATOR: {
    label: "Creator",
    maxProjects: 20,
    maxGenerationsPerMonth: 300,
    maxPdfExportsPerMonth: 50,
    watermarkPreviews: false,
    bulkGeneration: false,
    priorityGeneration: false,
  },
  PRO: {
    label: "Pro",
    maxProjects: 200,
    maxGenerationsPerMonth: 2000,
    maxPdfExportsPerMonth: 500,
    watermarkPreviews: false,
    bulkGeneration: true,
    priorityGeneration: true,
  },
};

export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan as PlanId] ?? PLAN_LIMITS.FREE;
}
