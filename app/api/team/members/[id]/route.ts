import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { canAssignRole, canChangeRoles, canManageTeam, canRemoveMember, isAssignableRole } from "@/lib/roles";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canChangeRoles(session.role)) {
    return NextResponse.json({ error: "Only the Owner can change a teammate's role." }, { status: 403 });
  }

  const { id } = await params;
  if (id === session.companyId) {
    return NextResponse.json({ error: "The Owner's role can't be changed." }, { status: 400 });
  }

  const member = await prisma.user.findUnique({ where: { id } });
  if (!member || member.activeCompanyId !== session.companyId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const role = body?.role;
  if (!isAssignableRole(role)) {
    return NextResponse.json({ error: "Choose a role: Admin, Editor, or Viewer." }, { status: 400 });
  }
  if (!canAssignRole(session.role, role)) {
    return NextResponse.json({ error: "You can't assign that role." }, { status: 403 });
  }

  await prisma.user.update({ where: { id }, data: { role } });
  return NextResponse.json({ ok: true, role });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTeam(session.role)) {
    return NextResponse.json({ error: "Only the Owner or an Admin can remove teammates." }, { status: 403 });
  }

  const { id } = await params;
  if (id === session.companyId) {
    return NextResponse.json({ error: "The owner can't be removed from their own company." }, { status: 400 });
  }

  const member = await prisma.user.findUnique({ where: { id } });
  if (!member || member.activeCompanyId !== session.companyId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const targetRole = isAssignableRole(member.role) ? member.role : "editor";
  if (!canRemoveMember(session.role, targetRole)) {
    return NextResponse.json({ error: "Admins can't remove other Admins." }, { status: 403 });
  }

  await prisma.user.update({ where: { id }, data: { activeCompanyId: null, role: "editor" } });
  return NextResponse.json({ ok: true });
}
