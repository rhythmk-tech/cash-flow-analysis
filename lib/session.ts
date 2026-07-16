import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EffectiveRole, isAssignableRole } from "@/lib/roles";

export interface SessionCompany {
  userId: string;
  userEmail: string;
  companyId: string;
  isOwner: boolean;
  role: EffectiveRole;
}

// Resolves the signed-in user plus the company (User row) whose forecast data they
// operate on. For an account that owns its own data, userId === companyId. For a
// team member who accepted an invite, companyId points at the owner's row instead.
//
// activeCompanyId/role are looked up fresh on every call rather than cached in the JWT —
// membership can change at runtime (invite accepted, member removed, role changed) and a
// cached claim would go stale until the session cookie itself expired.
export async function requireCompanyId(): Promise<SessionCompany | null> {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, activeCompanyId: true, role: true },
  });
  if (!user) return null;

  const isOwner = !user.activeCompanyId;
  const companyId = user.activeCompanyId ?? userId;
  const role: EffectiveRole = isOwner ? "owner" : isAssignableRole(user.role) ? user.role : "editor";

  return { userId, userEmail: user.email, companyId, isOwner, role };
}

// Gates /admin — cross-company usage analytics for operating the product, unrelated to the
// in-company owner/admin/editor/viewer roles. Re-queried fresh each call (never trusts the
// JWT) so revoking isPlatformAdmin takes effect immediately, matching requireCompanyId above.
export async function requirePlatformAdmin(): Promise<{ userId: string; userEmail: string } | null> {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, isPlatformAdmin: true },
  });
  if (!user?.isPlatformAdmin) return null;

  return { userId, userEmail: user.email };
}
