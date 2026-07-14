import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { logActivity } from "@/lib/activity";

export async function POST() {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.isOwner) {
    return NextResponse.json({ error: "Company owners can't leave their own company." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: session.userId }, data: { activeCompanyId: null, role: "editor" } });

  await logActivity(session.companyId, session.userId, session.userEmail, "member.left", `${session.userEmail} left the team`);

  return NextResponse.json({ ok: true });
}
