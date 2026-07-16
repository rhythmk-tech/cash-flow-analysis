import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/session";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  const admin = await requirePlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const now = Date.now();
  const since7d = new Date(now - 7 * DAY_MS);
  const since30d = new Date(now - 30 * DAY_MS);

  const [
    totalAccounts,
    totalUsers,
    onboardedAccounts,
    active7dRows,
    active30dRows,
    accounts,
    lastActiveRows,
  ] = await Promise.all([
    prisma.user.count({ where: { activeCompanyId: null } }),
    prisma.user.count(),
    prisma.user.count({ where: { activeCompanyId: null, items: { some: {} } } }),
    prisma.activityLog.findMany({ where: { createdAt: { gte: since7d } }, distinct: ["companyId"], select: { companyId: true } }),
    prisma.activityLog.findMany({ where: { createdAt: { gte: since30d } }, distinct: ["companyId"], select: { companyId: true } }),
    prisma.user.findMany({
      where: { activeCompanyId: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        companyName: true,
        createdAt: true,
        _count: { select: { items: true, members: true } },
      },
    }),
    prisma.activityLog.groupBy({ by: ["companyId"], _max: { createdAt: true } }),
  ]);

  // ActivityLog.companyId isn't a foreign key (entries deliberately outlive a removed team
  // member — see the model comment in schema.prisma), so a row can reference a company that
  // no longer exists at all. Intersect with currently-existing accounts so a stale/orphaned
  // log entry can never inflate the active-account counts above the actual account count.
  const currentAccountIds = new Set(accounts.map((a) => a.id));
  const active7d = active7dRows.filter((r) => currentAccountIds.has(r.companyId)).length;
  const active30d = active30dRows.filter((r) => currentAccountIds.has(r.companyId)).length;

  const lastActiveByCompany = new Map(lastActiveRows.map((r) => [r.companyId, r._max.createdAt]));

  const signupsByDay = new Map<string, number>();
  for (const a of accounts) {
    if (a.createdAt.getTime() < since30d.getTime()) continue;
    const key = a.createdAt.toISOString().slice(0, 10);
    signupsByDay.set(key, (signupsByDay.get(key) || 0) + 1);
  }
  const signupTrend = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now - (29 - i) * DAY_MS);
    const key = d.toISOString().slice(0, 10);
    return { date: key, count: signupsByDay.get(key) || 0 };
  });

  const soloAccounts = accounts.filter((a) => a._count.members === 0).length;
  const teamAccounts = accounts.length - soloAccounts;

  return NextResponse.json({
    totalAccounts,
    totalUsers,
    onboardedAccounts,
    unonboardedAccounts: totalAccounts - onboardedAccounts,
    active7d,
    active30d,
    soloAccounts,
    teamAccounts,
    signupTrend,
    accounts: accounts.map((a) => ({
      id: a.id,
      email: a.email,
      companyName: a.companyName,
      createdAt: a.createdAt,
      itemCount: a._count.items,
      teamSize: a._count.members + 1,
      lastActiveAt: lastActiveByCompany.get(a.id) || null,
    })),
  });
}
