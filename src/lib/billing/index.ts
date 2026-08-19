import { NoopBillingProvider } from "./noop-provider";
import type { BillingProvider } from "./types";

export * from "./types";
export { NoopBillingProvider } from "./noop-provider";

let cached: BillingProvider | null = null;

export function getBillingProvider(): BillingProvider {
  // When a StripeBillingProvider is added, branch on process.env.STRIPE_SECRET_KEY here.
  if (!cached) cached = new NoopBillingProvider();
  return cached;
}
