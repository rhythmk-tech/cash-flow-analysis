import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { canEditData } from "@/lib/roles";
import { logActivity } from "@/lib/activity";
import { checkAndSendNegativeBalanceAlert } from "@/lib/alerts";
import { formatDateOnly, parseDateOnly } from "@/lib/forecast";

const ALLOWED_TYPES = ["income", "expense"];
const ALLOWED_FREQUENCIES = ["onetime", "weekly", "biweekly", "monthly"];

function serializeItem<T extends { startDate: Date }>(item: T) {
  return { ...item, startDate: formatDateOnly(item.startDate) };
}

export async function POST(req: Request) {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditData(session.role)) {
    return NextResponse.json({ error: "Viewers can't import items." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const rows = body?.items;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No items to import." }, { status: 400 });
  }
  if (rows.length > 2000) {
    return NextResponse.json({ error: "Too many rows in one import (max 2000)." }, { status: 400 });
  }

  const userId = session.companyId;
  const toCreate: {
    userId: string;
    type: string;
    category: string;
    name: string;
    amount: number;
    frequency: string;
    startDate: Date;
    lineLabel: string;
  }[] = [];

  for (const row of rows) {
    const { type, category, name, amount, frequency, startDate, lineLabel } = row || {};
    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: `Invalid type "${type}" in import payload.` }, { status: 400 });
    }
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Every row needs a name." }, { status: 400 });
    }
    if (!category || typeof category !== "string") {
      return NextResponse.json({ error: "Every row needs a category." }, { status: 400 });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: `Invalid amount for "${name}".` }, { status: 400 });
    }
    if (!ALLOWED_FREQUENCIES.includes(frequency)) {
      return NextResponse.json({ error: `Invalid frequency for "${name}".` }, { status: 400 });
    }
    const parsedStartDate = parseDateOnly(String(startDate));
    if (Number.isNaN(parsedStartDate.getTime())) {
      return NextResponse.json({ error: `Invalid start date for "${name}".` }, { status: 400 });
    }
    toCreate.push({
      userId,
      type,
      category,
      name,
      amount: amt,
      frequency,
      startDate: parsedStartDate,
      lineLabel: lineLabel || category,
    });
  }

  const created = await prisma.$transaction(toCreate.map((data) => prisma.lineItem.create({ data })));

  await logActivity(
    session.companyId,
    session.userId,
    session.userEmail,
    "item.bulk_import",
    `Imported ${created.length} item${created.length === 1 ? "" : "s"} from a file`
  );
  await checkAndSendNegativeBalanceAlert(session.companyId, new URL(req.url).origin);

  return NextResponse.json(created.map(serializeItem), { status: 201 });
}
