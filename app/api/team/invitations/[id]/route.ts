import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { logActivity } from "@/lib/activity";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isOwner) {
    return NextResponse.json({ error: "Only the company owner can revoke invitations." }, { status: 403 });
  }

  const { id } = await params;
  const invitation = await prisma.invitation.findUnique({ where: { id } });
  if (!invitation || invitation.companyId !== session.companyId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.invitation.delete({ where: { id } });

  await logActivity(
    session.companyId,
    session.userId,
    session.userEmail,
    "member.invite_revoked",
    `Revoked invite to ${invitation.email}`
  );

  return NextResponse.json({ ok: true });
}
