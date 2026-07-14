import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { canEditData } from "@/lib/roles";
import { logActivity } from "@/lib/activity";
import { checkAndSendNegativeBalanceAlert } from "@/lib/alerts";
import { formatDateOnly, parseDateOnly } from "@/lib/forecast";

const ALLOWED_FREQUENCIES = ["onetime", "weekly", "biweekly", "monthly"];

function serializeItem<T extends { startDate: Date }>(item: T) {
  return { ...item, startDate: formatDateOnly(item.startDate) };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditData(session.role)) {
    return NextResponse.json({ error: "Viewers can't edit items." }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.lineItem.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.companyId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const { name, category, amount, frequency, startDate, lineLabel } = body || {};
  const data: Record<string, string | number | Date> = {};

  if (name !== undefined) {
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    data.name = name;
  }
  if (category !== undefined) {
    if (!category || typeof category !== "string") {
      return NextResponse.json({ error: "Category is required." }, { status: 400 });
    }
    data.category = category;
    data.lineLabel = lineLabel || category;
  }
  if (amount !== undefined) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number." }, { status: 400 });
    }
    data.amount = amt;
  }
  if (frequency !== undefined) {
    if (!ALLOWED_FREQUENCIES.includes(frequency)) {
      return NextResponse.json({ error: "Invalid frequency." }, { status: 400 });
    }
    data.frequency = frequency;
  }
  if (startDate !== undefined) {
    const parsed = parseDateOnly(String(startDate));
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid start date." }, { status: 400 });
    }
    data.startDate = parsed;
  }

  const item = await prisma.lineItem.update({ where: { id }, data });

  await logActivity(
    session.companyId,
    session.userId,
    session.userEmail,
    "item.update",
    `Edited "${existing.name}"`
  );
  await checkAndSendNegativeBalanceAlert(session.companyId, new URL(req.url).origin);

  return NextResponse.json(serializeItem(item));
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditData(session.role)) {
    return NextResponse.json({ error: "Viewers can't delete items." }, { status: 403 });
  }

  const { id } = await params;
  const item = await prisma.lineItem.findUnique({ where: { id } });
  if (!item || item.userId !== session.companyId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.lineItem.delete({ where: { id } });

  await logActivity(
    session.companyId,
    session.userId,
    session.userEmail,
    "item.delete",
    `Removed "${item.name}"`
  );
  await checkAndSendNegativeBalanceAlert(session.companyId, new URL(req.url).origin);

  return NextResponse.json({ ok: true });
}
