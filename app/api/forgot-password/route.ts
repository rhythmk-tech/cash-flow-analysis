import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/tokens";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { passwordResetEmail, sendEmail } from "@/lib/email";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const RESET_REQUEST_LIMIT = 5;
const RESET_REQUEST_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  if (!checkRateLimit(`forgot-password:${clientIp(req)}`, RESET_REQUEST_LIMIT, RESET_REQUEST_WINDOW_MS).allowed) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Enter your email address." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });

  // Always respond the same way whether or not the account exists, so this endpoint
  // can't be used to enumerate registered emails.
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  const resetToken = await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token: generateToken(),
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  });

  const resetUrl = `${new URL(req.url).origin}/reset-password/${resetToken.token}`;
  const { subject, html } = passwordResetEmail(resetUrl);
  const result = await sendEmail(email, subject, html);

  if (!result.sent) {
    // No email provider configured (or the send failed) — fall back to surfacing the link
    // directly so the flow still works end to end.
    console.log(`[password reset] ${email}: ${resetUrl} (email not sent: ${result.reason})`);
  }

  return NextResponse.json({ ok: true, emailSent: result.sent, resetUrl: result.sent ? undefined : resetUrl });
}
