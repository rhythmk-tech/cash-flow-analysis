import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { canChangeRoles, canManageTeam, isAssignableRole } from "@/lib/roles";

export async function GET() {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage = canManageTeam(session.role);

  const [company, members, invitations] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.companyId }, select: { companyName: true } }),
    prisma.user.findMany({
      where: { OR: [{ id: session.companyId }, { activeCompanyId: session.companyId }] },
      select: { id: true, email: true, role: true },
      orderBy: { createdAt: "asc" },
    }),
    canManage
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
    myRole: session.role,
    canManageTeam: canManage,
    canChangeRoles: canChangeRoles(session.role),
    members: members.map((m) => ({
      id: m.id,
      email: m.email,
      isOwner: m.id === session.companyId,
      role: m.id === session.companyId ? "owner" : isAssignableRole(m.role) ? m.role : "editor",
    })),
    pendingInvitations: canManage
      ? invitations.map((i) => ({
          id: i.id,
          email: i.email,
          role: isAssignableRole(i.role) ? i.role : "editor",
          token: i.token,
          createdAt: i.createdAt,
          expiresAt: i.expiresAt,
        }))
      : [],
  });
}
