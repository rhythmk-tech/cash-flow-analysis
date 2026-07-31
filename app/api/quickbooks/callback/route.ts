import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { exchangeCodeForTokens, isQuickBooksEnabled } from "@/lib/quickbooks";
import { logActivity } from "@/lib/activity";

const STATE_COOKIE = "qb_oauth_state";

// Intuit redirects the browser here after the owner approves (or declines) access, with
// ?code=&state=&realmId= (or ?error=...) on the query string. Dormant until QuickBooks is
// configured — see lib/quickbooks.ts.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  if (!isQuickBooksEnabled()) {
    return NextResponse.json({ error: "QuickBooks isn't available yet." }, { status: 503 });
  }

  const session = await requireCompanyId();
  if (!session) return NextResponse.redirect(`${origin}/login`);
  if (!session.isOwner) {
    return NextResponse.redirect(`${origin}/dashboard?quickbooks=error`);
  }

  const params = req.nextUrl.searchParams;
  const error = params.get("error");
  const code = params.get("code");
  const state = params.get("state");
  const realmId = params.get("realmId");
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;

  const response = NextResponse.redirect(
    `${origin}/dashboard?quickbooks=${error || !code || !realmId || !state || state !== cookieState ? "error" : "connected"}`
  );
  response.cookies.delete(STATE_COOKIE);

  if (error || !code || !realmId || !state || state !== cookieState) {
    return response;
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const now = Date.now();
    await prisma.quickBooksConnection.upsert({
      where: { userId: session.companyId },
      create: {
        userId: session.companyId,
        realmId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accessTokenExpiresAt: new Date(now + tokens.expires_in * 1000),
        refreshTokenExpiresAt: new Date(now + tokens.x_refresh_token_expires_in * 1000),
      },
      update: {
        realmId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accessTokenExpiresAt: new Date(now + tokens.expires_in * 1000),
        refreshTokenExpiresAt: new Date(now + tokens.x_refresh_token_expires_in * 1000),
      },
    });
    await logActivity(session.companyId, session.userId, session.userEmail, "quickbooks.connect", "Connected QuickBooks");
  } catch (err) {
    console.error("[quickbooks callback] failed to exchange code for tokens", err);
    return NextResponse.redirect(`${origin}/dashboard?quickbooks=error`);
  }

  return response;
}
