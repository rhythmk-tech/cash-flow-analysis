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
    select: { week: true, balance: true },
  });
  return NextResponse.json(actuals);
}

export async function PUT(req: Request) {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditData(session.role)) {
    return NextResponse.json({ error: "Viewers can't record actuals." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const week = Number(body?.week);
  const balance = Number(body?.balance);
  if (!Number.isFinite(week) || week < 1) {
    return NextResponse.json({ error: "Invalid week." }, { status: 400 });
  }
  if (!Number.isFinite(balance)) {
    return NextResponse.json({ error: "Invalid balance." }, { status: 400 });
  }

  const actual = await prisma.actual.upsert({
    where: { userId_week: { userId: session.companyId, week } },
    create: { userId: session.companyId, week, balance },
    update: { balance },
  });

  await logActivity(
    session.companyId,
    session.userId,
    session.userEmail,
    "actual.record",
    `Recorded actual balance for Week ${week}: ${money(balance)}`
  );

  return NextResponse.json({ week: actual.week, balance: actual.balance });
}
