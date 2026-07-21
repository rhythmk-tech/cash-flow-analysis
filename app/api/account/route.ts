import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const DELETE_LIMIT = 5;
const DELETE_WINDOW_MS = 15 * 60 * 1000;

// Deletes the signed-in user's own account. For a company owner (activeCompanyId is null),
// this is blocked while teammates still exist — see the check below — so nobody's access
// vanishes as an unannounced side effect of the owner deleting themselves. LineItem/Override/
// Actual/PasswordResetToken rows cascade-delete via the schema's onDelete: Cascade; pending
// Invitations don't have a real FK (see schema comment) so they're cleaned up explicitly.
// ActivityLog entries deliberately outlive the account (denormalized actorEmail, see schema).
export async function DELETE(req: Request) {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!checkRateLimit(`account-delete:${userId}`, DELETE_LIMIT, DELETE_WINDOW_MS).allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const password = String(body?.password || "");
  if (!password) {
    return NextResponse.json({ error: "Enter your password to confirm." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, activeCompanyId: true, _count: { select: { members: true } } },
  });
  if (!user) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const isOwner = !user.activeCompanyId;
  if (isOwner && user._count.members > 0) {
    return NextResponse.json(
      {
        error: `Remove all ${user._count.members} teammate${user._count.members === 1 ? "" : "s"} before deleting your account.`,
      },
      { status: 400 }
    );
  }

  if (isOwner) {
    await prisma.invitation.deleteMany({ where: { companyId: userId } });
  }

  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ ok: true });
}
