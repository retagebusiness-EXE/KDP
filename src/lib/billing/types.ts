import type { PlanId } from "@/lib/limits/plans";

export interface CheckoutSession {
  url: string;
}

/**
 * Billing is intentionally not wired to a real payment processor yet (the
 * spec asks us not to implement payment processing until the core product
 * works). This interface is the seam: implement `StripeBillingProvider`
 * later and swap it in via `getBillingProvider()` without touching any
 * call site — plan changes already flow through `Subscription` in the DB.
 */
export interface BillingProvider {
  readonly name: string;
  createCheckoutSession(userId: string, plan: PlanId): Promise<CheckoutSession>;
  createBillingPortalSession(userId: string): Promise<CheckoutSession>;
  cancelSubscription(userId: string): Promise<void>;
}
