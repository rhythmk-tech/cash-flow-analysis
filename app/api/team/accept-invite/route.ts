import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";

export async function POST(req: Request) {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const token = String(body?.token || "");
  if (!token) return NextResponse.json({ error: "Missing invite token." }, { status: 400 });

  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation) return NextResponse.json({ error: "This invite link is invalid." }, { status: 404 });
  if (invitation.acceptedAt) {
    return NextResponse.json({ error: "This invite has already been used." }, { status: 409 });
  }
  if (invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invite link has expired." }, { status: 410 });
  }
  if (invitation.companyId === session.userId) {
    return NextResponse.json({ error: "You can't join your own company." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: session.userId }, data: { activeCompanyId: invitation.companyId } }),
    prisma.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
  ]);

  const company = await prisma.user.findUnique({
    where: { id: invitation.companyId },
    select: { companyName: true },
  });

  return NextResponse.json({ ok: true, companyName: company?.companyName ?? "" });
}
