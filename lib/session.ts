import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export interface SessionCompany {
  userId: string;
  companyId: string;
  isOwner: boolean;
}

// Resolves the signed-in user plus the company (User row) whose forecast data they
// operate on. For an account that owns its own data, userId === companyId. For a
// team member who accepted an invite, companyId points at the owner's row instead.
//
// activeCompanyId is looked up fresh on every call rather than cached in the JWT —
// membership can change at runtime (invite accepted, member removed) and a cached
// claim would go stale until the session cookie itself expired.
export async function requireCompanyId(): Promise<SessionCompany | null> {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { activeCompanyId: true } });
  if (!user) return null;

  const companyId = user.activeCompanyId ?? userId;
  return { userId, companyId, isOwner: userId === companyId };
}
