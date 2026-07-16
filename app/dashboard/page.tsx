import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { canEditData } from "@/lib/roles";
import DashboardClient from "@/components/DashboardClient";
import { formatDateOnly, type Frequency, type ItemType, type LineItem } from "@/lib/forecast";

export default async function DashboardPage() {
  const session = await requireCompanyId();
  if (!session) redirect("/login");
  const { companyId } = session;

  const [user, items, overrides, actuals, viewer] = await Promise.all([
    prisma.user.findUnique({
      where: { id: companyId },
      select: {
        companyName: true,
        startingBalance: true,
        totalWeeks: true,
        bearPct: true,
        bullPct: true,
        forecastStart: true,
        incomeRowOrder: true,
        expenseRowOrder: true,
      },
    }),
    prisma.lineItem.findMany({ where: { userId: companyId }, orderBy: { createdAt: "asc" } }),
    prisma.override.findMany({ where: { userId: companyId } }),
    prisma.actual.findMany({ where: { userId: companyId } }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { isPlatformAdmin: true } }),
  ]);

  if (!user) redirect("/login");

  const mappedItems: LineItem[] = items.map((it) => ({
    id: it.id,
    type: it.type as ItemType,
    category: it.category,
    name: it.name,
    amount: it.amount,
    frequency: it.frequency as Frequency,
    startDate: formatDateOnly(it.startDate),
    lineLabel: it.lineLabel,
  }));

  const mappedOverrides = overrides.map((o) => ({
    type: o.type as ItemType,
    label: o.label,
    week: o.week,
    value: o.value,
  }));

  const mappedActuals = actuals.map((a) => ({ week: a.week, balance: a.balance }));

  return (
    <DashboardClient
      canEdit={canEditData(session.role)}
      isPlatformAdmin={Boolean(viewer?.isPlatformAdmin)}
      initialItems={mappedItems}
      initialOverrides={mappedOverrides}
      initialActuals={mappedActuals}
      initialSettings={{
        companyName: user.companyName,
        startingBalance: user.startingBalance,
        totalWeeks: user.totalWeeks,
        bearPct: user.bearPct,
        bullPct: user.bullPct,
        forecastStart: formatDateOnly(user.forecastStart),
        incomeRowOrder: user.incomeRowOrder,
        expenseRowOrder: user.expenseRowOrder,
      }}
    />
  );
}
