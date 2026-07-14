import { prisma } from "@/lib/prisma";

// Records one line of team activity for accountability once more than one person can edit a
// company's data. Never throws — a logging failure shouldn't take down the mutation it's
// describing, so callers can fire this after their main write without extra error handling.
export async function logActivity(
  companyId: string,
  actorUserId: string,
  actorEmail: string,
  action: string,
  summary: string
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: { companyId, actorUserId, actorEmail, action, summary },
    });
  } catch (err) {
    console.error("[activity log] failed to record entry", err);
  }
}
