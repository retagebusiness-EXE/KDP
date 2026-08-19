import "server-only";
import { prisma } from "@/lib/db";
import type { PlanId } from "@/lib/limits/plans";
import type { BillingProvider, CheckoutSession } from "./types";

/**
 * Default provider while Stripe isn't wired up: directly sets the plan on
 * the user's Subscription row so the rest of the app (limits, admin
 * dashboard) works end-to-end during development and demos.
 */
export class NoopBillingProvider implements BillingProvider {
  readonly name = "noop";

  async createCheckoutSession(userId: string, plan: PlanId): Promise<CheckoutSession> {
    await prisma.user.update({ where: { id: userId }, data: { plan } });
    await prisma.subscription.upsert({
      where: { userId },
      update: { plan, status: "ACTIVE" },
      create: { userId, plan, status: "ACTIVE" },
    });
    return { url: "/settings/billing?upgraded=1" };
  }

  async createBillingPortalSession(): Promise<CheckoutSession> {
    return { url: "/settings/billing" };
  }

  async cancelSubscription(userId: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { plan: "FREE" } });
    await prisma.subscription.updateMany({ where: { userId }, data: { plan: "FREE", status: "CANCELED" } });
  }
}
