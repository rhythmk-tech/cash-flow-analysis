import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { canEditData } from "@/lib/roles";
import { logActivity } from "@/lib/activity";
import { formatDateOnly, money, parseDateOnly } from "@/lib/forecast";
import { checkAndSendNegativeBalanceAlert } from "@/lib/alerts";

function serializeItem<T extends { startDate: Date }>(item: T) {
  return { ...item, startDate: formatDateOnly(item.startDate) };
}

export async function GET() {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.lineItem.findMany({
    where: { userId: session.companyId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(items.map(serializeItem));
}

export async function POST(req: Request) {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditData(session.role)) {
    return NextResponse.json({ error: "Viewers can't add items." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const { type, category, name, amount, frequency, startDate, lineLabel } = body || {};

  if (type !== "income" && type !== "expense") {
    return NextResponse.json({ error: "Invalid type." }, { status: 400 });
  }
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (!category || typeof category !== "string") {
    return NextResponse.json({ error: "Category is required." }, { status: 400 });
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number." }, { status: 400 });
  }
  const allowedFrequencies = ["onetime", "weekly", "biweekly", "monthly"];
  if (!allowedFrequencies.includes(frequency)) {
    return NextResponse.json({ error: "Invalid frequency." }, { status: 400 });
  }
  const parsedStartDate = parseDateOnly(String(startDate));
  if (Number.isNaN(parsedStartDate.getTime())) {
    return NextResponse.json({ error: "Invalid start date." }, { status: 400 });
  }

  const item = await prisma.lineItem.create({
    data: {
      userId: session.companyId,
      type,
      category,
      name,
      amount: amt,
      frequency,
      startDate: parsedStartDate,
      lineLabel: lineLabel || category,
    },
  });

  await logActivity(
    session.companyId,
    session.userId,
    session.userEmail,
    "item.create",
    `Added ${type} "${name}" (${money(amt)}/${frequency})`
  );
  await checkAndSendNegativeBalanceAlert(session.companyId, new URL(req.url).origin);

  return NextResponse.json(serializeItem(item), { status: 201 });
}
