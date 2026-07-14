import { Resend } from "resend";

// Resend's shared sandbox sender — works without verifying a custom domain, so email works out
// of the box. Swap for a verified domain address (e.g. "Cash Flow Forecaster <noreply@yourdomain.com>")
// once one is set up; onboarding@resend.dev is meant for getting started, not high-volume sending.
const FROM = "Cash Flow Forecaster <onboarding@resend.dev>";

let resendClient: Resend | null | undefined;

function getClient(): Resend | null {
  if (resendClient !== undefined) return resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  resendClient = apiKey ? new Resend(apiKey) : null;
  return resendClient;
}

export interface SendEmailResult {
  sent: boolean;
  reason?: string;
}

// Sends an email via Resend if RESEND_API_KEY is configured; otherwise no-ops and returns
// { sent: false } so callers can fall back to showing the link on-screen instead. Never throws —
// a broken email provider shouldn't break the underlying action (password reset, invite, etc.).
export async function sendEmail(to: string, subject: string, html: string): Promise<SendEmailResult> {
  const client = getClient();
  if (!client) return { sent: false, reason: "RESEND_API_KEY is not configured" };

  try {
    const { error } = await client.emails.send({ from: FROM, to, subject, html });
    if (error) {
      console.error("[email] Resend returned an error", error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] failed to send", err);
    return { sent: false, reason: err instanceof Error ? err.message : "unknown error" };
  }
}

function layout(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <div style="width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #4F46E5, #7C77F0); color: white; font-family: Georgia, serif; font-weight: 700; font-size: 17px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">CF</div>
      <h1 style="font-size: 20px; margin: 0 0 16px; color: #12151C;">${title}</h1>
      ${bodyHtml}
      <p style="font-size: 12px; color: #9CA3AF; margin-top: 32px;">Cash Flow Forecaster</p>
    </div>
  `;
}

export function passwordResetEmail(resetUrl: string): { subject: string; html: string } {
  return {
    subject: "Reset your Cash Flow Forecaster password",
    html: layout(
      "Reset your password",
      `
        <p style="font-size: 14px; color: #374151; line-height: 1.6;">
          Someone requested a password reset for your account. Click the button below to choose a
          new password. This link expires in 1 hour.
        </p>
        <a href="${resetUrl}" style="display: inline-block; margin: 16px 0; padding: 11px 22px; background: #12151C; color: white; text-decoration: none; border-radius: 9px; font-weight: 600; font-size: 14px;">
          Reset password
        </a>
        <p style="font-size: 12.5px; color: #9CA3AF; line-height: 1.6;">
          If you didn't request this, you can safely ignore this email.
        </p>
      `
    ),
  };
}

export function teamInviteEmail(companyName: string, inviterEmail: string, role: string, inviteUrl: string): {
  subject: string;
  html: string;
} {
  return {
    subject: `${inviterEmail} invited you to ${companyName} on Cash Flow Forecaster`,
    html: layout(
      `Join ${companyName}`,
      `
        <p style="font-size: 14px; color: #374151; line-height: 1.6;">
          ${inviterEmail} invited you to collaborate on ${companyName}'s cash flow forecast as
          <strong>${role}</strong>.
        </p>
        <a href="${inviteUrl}" style="display: inline-block; margin: 16px 0; padding: 11px 22px; background: #12151C; color: white; text-decoration: none; border-radius: 9px; font-weight: 600; font-size: 14px;">
          Accept invite
        </a>
        <p style="font-size: 12.5px; color: #9CA3AF; line-height: 1.6;">
          This invite expires in 7 days. If you weren't expecting this, you can ignore this email.
        </p>
      `
    ),
  };
}

export function negativeBalanceAlertEmail(
  companyName: string,
  week: number,
  balance: number,
  dashboardUrl: string
): { subject: string; html: string } {
  const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString()}`;
  return {
    subject: `⚠ ${companyName}'s cash flow goes negative in Week ${week}`,
    html: layout(
      "Cash flow warning",
      `
        <p style="font-size: 14px; color: #374151; line-height: 1.6;">
          Based on the current forecast, ${companyName}'s balance is projected to go negative in
          <strong>Week ${week}</strong>, reaching <strong style="color: #E2483A;">${money(balance)}</strong>.
        </p>
        <a href="${dashboardUrl}" style="display: inline-block; margin: 16px 0; padding: 11px 22px; background: #12151C; color: white; text-decoration: none; border-radius: 9px; font-weight: 600; font-size: 14px;">
          View forecast
        </a>
        <p style="font-size: 12.5px; color: #9CA3AF; line-height: 1.6;">
          You're getting this because your forecast just changed enough to trigger a new warning.
          You won't be alerted again for the same week unless something changes.
        </p>
      `
    ),
  };
}
