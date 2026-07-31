import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { isQuickBooksEnabled, revokeToken } from "@/lib/quickbooks";
import { logActivity } from "@/lib/activity";

// Disconnects QuickBooks: revokes the token with Intuit (best-effort) and deletes the stored
// connection either way, so a failed revoke call never leaves stale tokens usable from our side.
export async function POST() {
  if (!isQuickBooksEnabled()) {
    return NextResponse.json({ error: "QuickBooks isn't available yet." }, { status: 503 });
  }

  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isOwner) {
    return NextResponse.json({ error: "Only the account owner can disconnect QuickBooks." }, { status: 403 });
  }

  const connection = await prisma.quickBooksConnection.findUnique({ where: { userId: session.companyId } });
  if (!connection) {
    return NextResponse.json({ error: "QuickBooks isn't connected." }, { status: 404 });
  }

  await revokeToken(connection.refreshToken);
  await prisma.quickBooksConnection.delete({ where: { userId: session.companyId } });
  await logActivity(session.companyId, session.userId, session.userEmail, "quickbooks.disconnect", "Disconnected QuickBooks");

  return NextResponse.json({ ok: true });
}
