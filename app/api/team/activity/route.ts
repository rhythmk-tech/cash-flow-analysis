import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { canManageTeam } from "@/lib/roles";

export async function GET() {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTeam(session.role)) {
    return NextResponse.json({ error: "Only the Owner or an Admin can view team activity." }, { status: 403 });
  }

  const entries = await prisma.activityLog.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      actorEmail: e.actorEmail,
      summary: e.summary,
      createdAt: e.createdAt,
    })),
  });
}
