import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { canEditData } from "@/lib/roles";
import { logActivity } from "@/lib/activity";
import { money } from "@/lib/forecast";
import { checkAndSendNegativeBalanceAlert } from "@/lib/alerts";

export async function GET() {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const overrides = await prisma.override.findMany({ where: { userId: session.companyId } });
  return NextResponse.json(overrides);
}

export async function PUT(req: Request) {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditData(session.role)) {
    return NextResponse.json({ error: "Viewers can't edit forecast values." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const { type, label, week, value } = body || {};

  if (type !== "income" && type !== "expense") {
    return NextResponse.json({ error: "Invalid type." }, { status: 400 });
  }
  if (!label || typeof label !== "string") {
    return NextResponse.json({ error: "Label is required." }, { status: 400 });
  }
  const weekNum = Number(week);
  const val = Number(value);
  if (!Number.isFinite(weekNum) || weekNum < 1) {
    return NextResponse.json({ error: "Invalid week." }, { status: 400 });
  }
  if (!Number.isFinite(val)) {
    return NextResponse.json({ error: "Invalid value." }, { status: 400 });
  }

  const override = await prisma.override.upsert({
    where: {
      userId_type_label_week: {
        userId: session.companyId,
        type,
        label,
        week: weekNum,
      },
    },
    create: { userId: session.companyId, type, label, week: weekNum, value: val },
    update: { value: val },
  });

  await logActivity(
    session.companyId,
    session.userId,
    session.userEmail,
    "override.edit",
    `Set "${label}" for Week ${weekNum} to ${money(val)}`
  );
  await checkAndSendNegativeBalanceAlert(session.companyId, new URL(req.url).origin);

  return NextResponse.json(override);
}
