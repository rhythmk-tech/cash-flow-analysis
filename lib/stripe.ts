import Stripe from "stripe";

// Dormant billing scaffolding. The product is free for everyone today and nothing in the UI
// links to any of this — no pricing page, no upgrade button, no paywall. It exists so that
// turning on paid plans later is a matter of setting env vars and adding a UI entry point, not
// a new backend. See app/api/billing/{checkout,portal,webhook}/route.ts for the routes this
// powers, and User.stripe* / User.subscription* in prisma/schema.prisma for where the state
// that the webhook writes lives.
//
// To go live later:
//   1. Create a Stripe account (or switch an existing one out of test mode) and a Product/Price.
//   2. Set STRIPE_SECRET_KEY, STRIPE_PRICE_ID, and STRIPE_WEBHOOK_SECRET (from the Stripe
//      Dashboard's webhook endpoint config, pointed at /api/billing/webhook).
//   3. Build a pricing page / upgrade button that POSTs to /api/billing/checkout.
// Nothing else needs to change — the routes below already handle the rest.

let stripeClient: Stripe | null | undefined;

// Returns null (never throws) when STRIPE_SECRET_KEY isn't set, so every caller degrades to
// "billing not available" instead of crashing — same pattern as lib/email.ts's getClient().
export function getStripeClient(): Stripe | null {
  if (stripeClient !== undefined) return stripeClient;
  const apiKey = process.env.STRIPE_SECRET_KEY;
  stripeClient = apiKey ? new Stripe(apiKey, { apiVersion: "2026-06-24.dahlia" }) : null;
  return stripeClient;
}

// The single price a checkout session sells. A bare env var rather than a hardcoded amount —
// deciding actual pricing is a business call for whoever turns this on, not something to bake
// into the code now.
export function getStripePriceId(): string | null {
  return process.env.STRIPE_PRICE_ID || null;
}

export function getStripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET || null;
}

// True only once a secret key AND a price are both configured — the minimum needed to start a
// checkout. isBillingEnabled() is what every billing route checks before doing anything else.
export function isBillingEnabled(): boolean {
  return Boolean(getStripeClient() && getStripePriceId());
}
