import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";

export async function GET() {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [company, members, invitations] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.companyId }, select: { companyName: true } }),
    prisma.user.findMany({
      where: { OR: [{ id: session.companyId }, { activeCompanyId: session.companyId }] },
      select: { id: true, email: true },
      orderBy: { createdAt: "asc" },
    }),
    session.isOwner
      ? prisma.invitation.findMany({
          where: { companyId: session.companyId, acceptedAt: null },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  if (!company) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({
    companyName: company.companyName,
    isOwner: session.isOwner,
    members: members.map((m) => ({ id: m.id, email: m.email, isOwner: m.id === session.companyId })),
    pendingInvitations: session.isOwner
      ? invitations.map((i) => ({
          id: i.id,
          email: i.email,
          token: i.token,
          createdAt: i.createdAt,
          expiresAt: i.expiresAt,
        }))
      : [],
  });
}
