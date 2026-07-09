import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { generateToken } from "@/lib/tokens";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isOwner) {
    return NextResponse.json({ error: "Only the company owner can invite teammates." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const existingMember = await prisma.user.findFirst({
    where: { email, OR: [{ id: session.companyId }, { activeCompanyId: session.companyId }] },
  });
  if (existingMember) {
    return NextResponse.json({ error: "That email is already part of this team." }, { status: 409 });
  }

  const invitation = await prisma.invitation.create({
    data: {
      companyId: session.companyId,
      email,
      token: generateToken(),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  const inviteUrl = `${new URL(req.url).origin}/invite/${invitation.token}`;
  // No email provider is configured yet — surface the link here so the owner can share it manually.
  console.log(`[invite] ${email} invited to company ${session.companyId}: ${inviteUrl}`);

  return NextResponse.json({
    invitation: {
      id: invitation.id,
      email: invitation.email,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
    },
    inviteUrl,
  });
}
