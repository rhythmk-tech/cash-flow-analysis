import { prisma } from "@/lib/prisma";
import { computeWeekly, formatDateOnly, Frequency, ItemType, LineItem, OverrideMap, overrideKey } from "@/lib/forecast";
import { negativeBalanceAlertEmail, sendEmail } from "@/lib/email";

// Called after any mutation that can change the forecast (item/override/settings changes).
// Emails the company owner once when the forecast's first negative-balance week changes —
// either it newly appears, or moves to a different week. Editing the same still-negative
// week again doesn't re-send, matching what the email itself tells the recipient.
export async function checkAndSendNegativeBalanceAlert(companyId: string, origin: string): Promise<void> {
  const company = await prisma.user.findUnique({
    where: { id: companyId },
    select: {
      email: true,
      companyName: true,
      startingBalance: true,
      totalWeeks: true,
      forecastStart: true,
      lastNegativeAlertWeek: true,
    },
  });
  if (!company) return;

  const [items, overrides] = await Promise.all([
    prisma.lineItem.findMany({ where: { userId: companyId } }),
    prisma.override.findMany({ where: { userId: companyId } }),
  ]);

  const overrideMap: OverrideMap = {};
  overrides.forEach((o) => {
    overrideMap[overrideKey(o.type as ItemType, o.label, o.week)] = o.value;
  });

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

  const weekly = computeWeekly(mappedItems, overrideMap, company.startingBalance, company.totalWeeks, company.forecastStart);
  const firstNegative = weekly.find((w) => w.balance < 0);

  if (!firstNegative) {
    if (company.lastNegativeAlertWeek !== null) {
      await prisma.user.update({
        where: { id: companyId },
        data: { lastNegativeAlertWeek: null, lastNegativeAlertAt: null },
      });
    }
    return;
  }

  if (company.lastNegativeAlertWeek === firstNegative.week) return;

  const { subject, html } = negativeBalanceAlertEmail(
    company.companyName,
    firstNegative.week,
    firstNegative.balance,
    `${origin}/dashboard`
  );
  await sendEmail(company.email, subject, html);

  await prisma.user.update({
    where: { id: companyId },
    data: { lastNegativeAlertWeek: firstNegative.week, lastNegativeAlertAt: new Date() },
  });
}
