import { afterEach, describe, expect, it, vi } from "vitest";

// getStripeClient() caches its result at module scope on first call (same pattern as
// lib/email.ts), so each case needs a fresh module instance via resetModules() + a fresh
// dynamic import — otherwise a later test would see an earlier test's cached client/null.
async function freshStripeModule() {
  vi.resetModules();
  return import("./stripe");
}

const ENV_KEYS = ["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID", "STRIPE_WEBHOOK_SECRET"] as const;
const savedEnv: Record<string, string | undefined> = {};
ENV_KEYS.forEach((key) => (savedEnv[key] = process.env[key]));

afterEach(() => {
  ENV_KEYS.forEach((key) => {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  });
});

describe("billing scaffolding stays dormant by default", () => {
  it("getStripeClient returns null with no STRIPE_SECRET_KEY", async () => {
    ENV_KEYS.forEach((key) => delete process.env[key]);
    const { getStripeClient } = await freshStripeModule();
    expect(getStripeClient()).toBeNull();
  });

  it("getStripePriceId / getStripeWebhookSecret return null when unset", async () => {
    ENV_KEYS.forEach((key) => delete process.env[key]);
    const { getStripePriceId, getStripeWebhookSecret } = await freshStripeModule();
    expect(getStripePriceId()).toBeNull();
    expect(getStripeWebhookSecret()).toBeNull();
  });

  it("isBillingEnabled is false when nothing is configured", async () => {
    ENV_KEYS.forEach((key) => delete process.env[key]);
    const { isBillingEnabled } = await freshStripeModule();
    expect(isBillingEnabled()).toBe(false);
  });

  it("isBillingEnabled is false with only a secret key and no price", async () => {
    ENV_KEYS.forEach((key) => delete process.env[key]);
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    const { isBillingEnabled } = await freshStripeModule();
    expect(isBillingEnabled()).toBe(false);
  });

  it("isBillingEnabled is false with only a price and no secret key", async () => {
    ENV_KEYS.forEach((key) => delete process.env[key]);
    process.env.STRIPE_PRICE_ID = "price_fake";
    const { isBillingEnabled } = await freshStripeModule();
    expect(isBillingEnabled()).toBe(false);
  });

  it("isBillingEnabled is true once both a secret key and a price are set", async () => {
    ENV_KEYS.forEach((key) => delete process.env[key]);
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.STRIPE_PRICE_ID = "price_fake";
    const { isBillingEnabled, getStripeClient } = await freshStripeModule();
    expect(getStripeClient()).not.toBeNull();
    expect(isBillingEnabled()).toBe(true);
  });
});
