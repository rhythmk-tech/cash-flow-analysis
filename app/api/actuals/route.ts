import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { canEditData } from "@/lib/roles";
import { logActivity } from "@/lib/activity";
import { money } from "@/lib/forecast";

export async function GET() {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actuals = await prisma.actual.findMany({
    where: { userId: session.companyId },
    select: { week: true, income: true, expense: true, balance: true },
  });
  return NextResponse.json(actuals);
}

const ACTUAL_FIELDS = ["income", "expense", "balance"] as const;
type ActualField = (typeof ACTUAL_FIELDS)[number];
const FIELD_LABELS: Record<ActualField, string> = { income: "income", expense: "expenses", balance: "balance" };

// Each field (income, expense, balance) can be recorded independently — a week might have its
// actual income confirmed before its closing balance is checked, for instance. Only the fields
// present in the request are written; anything already recorded for the other fields stays put.
export async function PUT(req: Request) {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditData(session.role)) {
    return NextResponse.json({ error: "Viewers can't record actuals." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const week = Number(body?.week);
  if (!Number.isFinite(week) || week < 1) {
    return NextResponse.json({ error: "Invalid week." }, { status: 400 });
  }

  const data: Partial<Record<ActualField, number>> = {};
  for (const field of ACTUAL_FIELDS) {
    if (body?.[field] === undefined || body[field] === null) continue;
    const v = Number(body[field]);
    if (!Number.isFinite(v)) {
      return NextResponse.json({ error: `Invalid ${FIELD_LABELS[field]}.` }, { status: 400 });
    }
    data[field] = v;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }

  const actual = await prisma.actual.upsert({
    where: { userId_week: { userId: session.companyId, week } },
    create: { userId: session.companyId, week, ...data },
    update: data,
  });

  const changeSummary = ACTUAL_FIELDS.filter((f) => data[f] !== undefined)
    .map((f) => `${FIELD_LABELS[f]} ${money(data[f]!)}`)
    .join(", ");
  await logActivity(
    session.companyId,
    session.userId,
    session.userEmail,
    "actual.record",
    `Recorded actual ${changeSummary} for Week ${week}`
  );

  return NextResponse.json({ week: actual.week, income: actual.income, expense: actual.expense, balance: actual.balance });
}
