import { prisma } from "@/lib/prisma";
import { formatDateOnly } from "@/lib/forecast";

// Dormant billing-style scaffolding for a future QuickBooks Online sync. The product works
// exactly as it does today regardless of any of this — nothing reads these functions unless a
// request hits app/api/quickbooks/*, and those routes all 503 until the env vars below are set.
//
// To go live later:
//   1. Create an Intuit Developer account (developer.intuit.com) and an app under it. Note its
//      Client ID and Client Secret, and register a redirect URI pointing at
//      /api/quickbooks/callback on your real domain.
//   2. Set QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, QUICKBOOKS_REDIRECT_URI, and
//      QUICKBOOKS_ENVIRONMENT ("sandbox" while testing, "production" once Intuit approves the
//      app for production use — see Intuit's app review process before real customers connect).
//   3. Build a "Connect QuickBooks" button/page that links to /api/quickbooks/connect.
// Nothing else needs to change — the routes under app/api/quickbooks/ already handle the rest.

const AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
const SCOPE = "com.intuit.quickbooks.accounting";

export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: "sandbox" | "production";
}

export function getQuickBooksConfig(): QuickBooksConfig | null {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  const environment = process.env.QUICKBOOKS_ENVIRONMENT === "production" ? "production" : "sandbox";
  return { clientId, clientSecret, redirectUri, environment };
}

export function isQuickBooksEnabled(): boolean {
  return getQuickBooksConfig() !== null;
}

function apiBaseUrl(environment: QuickBooksConfig["environment"]): string {
  return environment === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

// Builds the URL to send the company owner to so they can approve access in QuickBooks. `state`
// should be a random, unguessable value the caller can verify on the way back (CSRF protection
// for the OAuth redirect) — see app/api/quickbooks/connect and callback.
export function getAuthorizationUrl(state: string): string | null {
  const config = getQuickBooksConfig();
  if (!config) return null;
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: SCOPE,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface QuickBooksTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds — access token lifetime, always 3600 today
  x_refresh_token_expires_in: number; // seconds — refresh token lifetime, ~100 days
  token_type: string;
}

async function requestTokens(body: URLSearchParams): Promise<QuickBooksTokenResponse> {
  const config = getQuickBooksConfig();
  if (!config) throw new Error("QuickBooks isn't configured.");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(config.clientId, config.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`QuickBooks token request failed (${res.status}): ${text}`);
  }
  return res.json();
}

export function exchangeCodeForTokens(code: string): Promise<QuickBooksTokenResponse> {
  const config = getQuickBooksConfig();
  if (!config) throw new Error("QuickBooks isn't configured.");
  return requestTokens(
    new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: config.redirectUri })
  );
}

// QuickBooks rotates the refresh token on every use — callers MUST persist the new
// refresh_token from the response, not reuse the one they refreshed with.
export function refreshAccessToken(refreshToken: string): Promise<QuickBooksTokenResponse> {
  return requestTokens(new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }));
}

export async function revokeToken(token: string): Promise<void> {
  const config = getQuickBooksConfig();
  if (!config) return;
  await fetch(REVOKE_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(config.clientId, config.clientSecret),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ token }),
  }).catch(() => {
    // Best-effort — if Intuit's revoke call fails, disconnecting locally (deleting the stored
    // tokens) still stops us from using them, which is what actually matters.
  });
}

// Returns a currently-valid access token + realmId for a company, transparently refreshing (and
// persisting the rotated refresh token) if the stored access token is expired or about to be.
// Returns null if the company never connected QuickBooks, or if the refresh itself fails (e.g.
// the refresh token expired after ~100 days of inactivity — the owner needs to reconnect).
export async function getValidAccessToken(userId: string): Promise<{ accessToken: string; realmId: string } | null> {
  const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
  if (!connection) return null;

  const REFRESH_BUFFER_MS = 2 * 60 * 1000;
  if (connection.accessTokenExpiresAt.getTime() - REFRESH_BUFFER_MS > Date.now()) {
    return { accessToken: connection.accessToken, realmId: connection.realmId };
  }

  try {
    const tokens = await refreshAccessToken(connection.refreshToken);
    const now = Date.now();
    await prisma.quickBooksConnection.update({
      where: { userId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accessTokenExpiresAt: new Date(now + tokens.expires_in * 1000),
        refreshTokenExpiresAt: new Date(now + tokens.x_refresh_token_expires_in * 1000),
      },
    });
    return { accessToken: tokens.access_token, realmId: connection.realmId };
  } catch (err) {
    console.error("[quickbooks] failed to refresh access token", err);
    return null;
  }
}

// Runs a QuickBooks SOQL-style query (e.g. "SELECT * FROM Purchase WHERE TxnDate >= '2026-01-01'
// MAXRESULTS 1000") against the company's own QuickBooks data.
export async function queryQuickBooks(userId: string, soql: string): Promise<Record<string, unknown>> {
  const config = getQuickBooksConfig();
  if (!config) throw new Error("QuickBooks isn't configured.");
  const auth = await getValidAccessToken(userId);
  if (!auth) throw new Error("This company hasn't connected QuickBooks.");

  const url = `${apiBaseUrl(config.environment)}/v3/company/${auth.realmId}/query?query=${encodeURIComponent(soql)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`QuickBooks query failed (${res.status}): ${text}`);
  }
  return res.json();
}

// ---- pure mapping: QuickBooks transactions -> the shape lib item-create routes expect ----
// Deliberately simple for a first sync: category/name come from the vendor or customer name on
// the transaction, and every row lands as a one-time item on its transaction date — these are
// historical actuals from QuickBooks, not a recurring plan, so "onetime" is the only frequency
// that's actually true of the data. A user can convert any of them to recurring afterward the
// same way they'd edit any other line item. Mapping to QuickBooks' own chart-of-accounts
// categories (rather than vendor/customer name) would be a reasonable next step, not part of
// this pass.

export interface QuickBooksImportRow {
  type: "income" | "expense";
  category: string;
  name: string;
  amount: number;
  frequency: "onetime";
  startDate: string; // "YYYY-MM-DD"
  lineLabel: string;
}

export interface QBOPurchase {
  Id?: string;
  TotalAmt?: number;
  TxnDate?: string;
  EntityRef?: { name?: string };
}

export interface QBOSalesTransaction {
  Id?: string;
  TotalAmt?: number;
  TxnDate?: string;
  CustomerRef?: { name?: string };
}

function parseQboDate(txnDate: string | undefined): string | null {
  if (!txnDate) return null;
  const parsed = new Date(`${txnDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatDateOnly(parsed);
}

export function mapPurchaseToExpenseRow(purchase: QBOPurchase): QuickBooksImportRow | null {
  const amount = purchase.TotalAmt;
  const startDate = parseQboDate(purchase.TxnDate);
  if (!amount || amount <= 0 || !startDate) return null;
  const label = purchase.EntityRef?.name || "QuickBooks expense";
  return { type: "expense", category: label, name: label, amount, frequency: "onetime", startDate, lineLabel: label };
}

export function mapSalesTransactionToIncomeRow(txn: QBOSalesTransaction): QuickBooksImportRow | null {
  const amount = txn.TotalAmt;
  const startDate = parseQboDate(txn.TxnDate);
  if (!amount || amount <= 0 || !startDate) return null;
  const label = txn.CustomerRef?.name || "QuickBooks income";
  return { type: "income", category: label, name: label, amount, frequency: "onetime", startDate, lineLabel: label };
}
