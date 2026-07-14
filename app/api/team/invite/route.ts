import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { generateToken } from "@/lib/tokens";
import { canAssignRole, canManageTeam, isAssignableRole, ROLE_LABELS } from "@/lib/roles";
import { logActivity } from "@/lib/activity";
import { sendEmail, teamInviteEmail } from "@/lib/email";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTeam(session.role)) {
    return NextResponse.json({ error: "Only the Owner or an Admin can invite teammates." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const role = body?.role;
  if (!isAssignableRole(role)) {
    return NextResponse.json({ error: "Choose a role: Admin, Editor, or Viewer." }, { status: 400 });
  }
  if (!canAssignRole(session.role, role)) {
    return NextResponse.json({ error: "Only the Owner can invite someone as Admin." }, { status: 403 });
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
      role,
      token: generateToken(),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  const inviteUrl = `${new URL(req.url).origin}/invite/${invitation.token}`;

  const company = await prisma.user.findUnique({
    where: { id: session.companyId },
    select: { companyName: true },
  });
  const { subject, html } = teamInviteEmail(
    company?.companyName ?? "your team",
    session.userEmail,
    ROLE_LABELS[role],
    inviteUrl
  );
  const emailResult = await sendEmail(email, subject, html);
  if (!emailResult.sent) {
    console.log(`[invite] ${email} invited to company ${session.companyId} as ${role}: ${inviteUrl} (email not sent: ${emailResult.reason})`);
  }

  await logActivity(
    session.companyId,
    session.userId,
    session.userEmail,
    "member.invited",
    `Invited ${email} as ${ROLE_LABELS[role]}`
  );

  return NextResponse.json({
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
    },
    inviteUrl,
    emailSent: emailResult.sent,
  });
}
