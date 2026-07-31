import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { isQuickBooksEnabled } from "@/lib/quickbooks";

// Read-only status for the Team tab's QuickBooks section — no tokens here, just enough for the
// UI to decide what to show. `enabled` reflects whether QUICKBOOKS_* env vars are configured at
// all; when they aren't, the client hides the whole section instead of showing a dead button.
export async function GET() {
  if (!isQuickBooksEnabled()) {
    return NextResponse.json({ enabled: false, connected: false });
  }

  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connection = await prisma.quickBooksConnection.findUnique({
    where: { userId: session.companyId },
    select: { createdAt: true, lastSyncedAt: true },
  });

  return NextResponse.json({
    enabled: true,
    connected: !!connection,
    connectedAt: connection?.createdAt ?? null,
    lastSyncedAt: connection?.lastSyncedAt ?? null,
  });
}
