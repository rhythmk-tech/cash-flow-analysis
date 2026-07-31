import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireCompanyId } from "@/lib/session";
import { getAuthorizationUrl, isQuickBooksEnabled } from "@/lib/quickbooks";

const STATE_COOKIE = "qb_oauth_state";

// Starts the QuickBooks OAuth flow — a top-level navigation (not fetch), since it needs to send
// the browser to Intuit's own consent screen. Dormant until QUICKBOOKS_CLIENT_ID/SECRET/
// REDIRECT_URI are set — see lib/quickbooks.ts. No UI links here yet.
export async function GET() {
  if (!isQuickBooksEnabled()) {
    return NextResponse.json({ error: "QuickBooks isn't available yet." }, { status: 503 });
  }

  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isOwner) {
    return NextResponse.json({ error: "Only the account owner can connect QuickBooks." }, { status: 403 });
  }

  const state = crypto.randomBytes(24).toString("hex");
  const authorizeUrl = getAuthorizationUrl(state);
  if (!authorizeUrl) {
    return NextResponse.json({ error: "QuickBooks isn't available yet." }, { status: 503 });
  }

  const response = NextResponse.redirect(authorizeUrl);
  // Short-lived, httpOnly — read back and verified in the callback to guard against CSRF on the
  // redirect Intuit sends the browser back to.
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
