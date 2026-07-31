import { afterEach, describe, expect, it } from "vitest";
import {
  getAuthorizationUrl,
  getQuickBooksConfig,
  isQuickBooksEnabled,
  mapPurchaseToExpenseRow,
  mapSalesTransactionToIncomeRow,
} from "./quickbooks";

// Unlike lib/stripe.ts's client, getQuickBooksConfig() re-reads process.env on every call (no
// module-level caching), so tests can just mutate process.env directly between cases.
const ENV_KEYS = ["QUICKBOOKS_CLIENT_ID", "QUICKBOOKS_CLIENT_SECRET", "QUICKBOOKS_REDIRECT_URI", "QUICKBOOKS_ENVIRONMENT"] as const;
const savedEnv: Record<string, string | undefined> = {};
ENV_KEYS.forEach((key) => (savedEnv[key] = process.env[key]));

afterEach(() => {
  ENV_KEYS.forEach((key) => {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  });
});

function clearEnv() {
  ENV_KEYS.forEach((key) => delete process.env[key]);
}

describe("QuickBooks scaffolding stays dormant by default", () => {
  it("isQuickBooksEnabled is false with nothing configured", () => {
    clearEnv();
    expect(isQuickBooksEnabled()).toBe(false);
  });

  it("isQuickBooksEnabled is false when only some vars are set", () => {
    clearEnv();
    process.env.QUICKBOOKS_CLIENT_ID = "id";
    process.env.QUICKBOOKS_CLIENT_SECRET = "secret";
    // missing QUICKBOOKS_REDIRECT_URI
    expect(isQuickBooksEnabled()).toBe(false);
  });

  it("isQuickBooksEnabled is true once client id, secret, and redirect uri are all set", () => {
    clearEnv();
    process.env.QUICKBOOKS_CLIENT_ID = "id";
    process.env.QUICKBOOKS_CLIENT_SECRET = "secret";
    process.env.QUICKBOOKS_REDIRECT_URI = "https://example.com/api/quickbooks/callback";
    expect(isQuickBooksEnabled()).toBe(true);
  });

  it("defaults to sandbox when QUICKBOOKS_ENVIRONMENT isn't 'production'", () => {
    clearEnv();
    process.env.QUICKBOOKS_CLIENT_ID = "id";
    process.env.QUICKBOOKS_CLIENT_SECRET = "secret";
    process.env.QUICKBOOKS_REDIRECT_URI = "https://example.com/api/quickbooks/callback";
    expect(getQuickBooksConfig()?.environment).toBe("sandbox");
    process.env.QUICKBOOKS_ENVIRONMENT = "production";
    expect(getQuickBooksConfig()?.environment).toBe("production");
  });

  it("getAuthorizationUrl returns null when unconfigured", () => {
    clearEnv();
    expect(getAuthorizationUrl("some-state")).toBeNull();
  });

  it("getAuthorizationUrl builds a valid Intuit authorize URL once configured", () => {
    clearEnv();
    process.env.QUICKBOOKS_CLIENT_ID = "my-client-id";
    process.env.QUICKBOOKS_CLIENT_SECRET = "secret";
    process.env.QUICKBOOKS_REDIRECT_URI = "https://example.com/api/quickbooks/callback";
    const url = getAuthorizationUrl("csrf-nonce");
    expect(url).not.toBeNull();
    const parsed = new URL(url!);
    expect(parsed.origin + parsed.pathname).toBe("https://appcenter.intuit.com/connect/oauth2");
    expect(parsed.searchParams.get("client_id")).toBe("my-client-id");
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://example.com/api/quickbooks/callback");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("scope")).toBe("com.intuit.quickbooks.accounting");
    expect(parsed.searchParams.get("state")).toBe("csrf-nonce");
  });
});

describe("mapPurchaseToExpenseRow", () => {
  it("maps a vendor purchase to a one-time expense row", () => {
    const row = mapPurchaseToExpenseRow({
      Id: "123",
      TotalAmt: 249.99,
      TxnDate: "2026-07-15",
      EntityRef: { name: "Acme Office Supplies" },
    });
    expect(row).toEqual({
      type: "expense",
      category: "Acme Office Supplies",
      name: "Acme Office Supplies",
      amount: 249.99,
      frequency: "onetime",
      startDate: "2026-07-15",
      lineLabel: "Acme Office Supplies",
    });
  });

  it("falls back to a generic label when there's no vendor", () => {
    const row = mapPurchaseToExpenseRow({ TotalAmt: 50, TxnDate: "2026-07-15" });
    expect(row?.category).toBe("QuickBooks expense");
  });

  it("returns null for a zero or missing amount", () => {
    expect(mapPurchaseToExpenseRow({ TotalAmt: 0, TxnDate: "2026-07-15" })).toBeNull();
    expect(mapPurchaseToExpenseRow({ TxnDate: "2026-07-15" })).toBeNull();
  });

  it("returns null for a missing or invalid date", () => {
    expect(mapPurchaseToExpenseRow({ TotalAmt: 50 })).toBeNull();
    expect(mapPurchaseToExpenseRow({ TotalAmt: 50, TxnDate: "not-a-date" })).toBeNull();
  });
});

describe("mapSalesTransactionToIncomeRow", () => {
  it("maps a customer invoice to a one-time income row", () => {
    const row = mapSalesTransactionToIncomeRow({
      Id: "456",
      TotalAmt: 1800,
      TxnDate: "2026-08-01",
      CustomerRef: { name: "Beta Client LLC" },
    });
    expect(row).toEqual({
      type: "income",
      category: "Beta Client LLC",
      name: "Beta Client LLC",
      amount: 1800,
      frequency: "onetime",
      startDate: "2026-08-01",
      lineLabel: "Beta Client LLC",
    });
  });

  it("falls back to a generic label when there's no customer", () => {
    const row = mapSalesTransactionToIncomeRow({ TotalAmt: 1800, TxnDate: "2026-08-01" });
    expect(row?.category).toBe("QuickBooks income");
  });

  it("returns null for a zero or missing amount", () => {
    expect(mapSalesTransactionToIncomeRow({ TotalAmt: 0, TxnDate: "2026-08-01" })).toBeNull();
    expect(mapSalesTransactionToIncomeRow({ TxnDate: "2026-08-01" })).toBeNull();
  });
});
