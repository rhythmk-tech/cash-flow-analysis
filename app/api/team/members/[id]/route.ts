import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isOwner) {
    return NextResponse.json({ error: "Only the company owner can remove teammates." }, { status: 403 });
  }

  const { id } = await params;
  if (id === session.companyId) {
    return NextResponse.json({ error: "The owner can't be removed from their own company." }, { status: 400 });
  }

  const member = await prisma.user.findUnique({ where: { id } });
  if (!member || member.activeCompanyId !== session.companyId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.user.update({ where: { id }, data: { activeCompanyId: null } });
  return NextResponse.json({ ok: true });
}
