import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";

export async function GET() {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.lineItem.findMany({
    where: { userId: session.companyId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { type, category, name, amount, frequency, startWeek, lineLabel } = body || {};

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
  const week = Math.max(1, Number(startWeek) || 1);

  const item = await prisma.lineItem.create({
    data: {
      userId: session.companyId,
      type,
      category,
      name,
      amount: amt,
      frequency,
      startWeek: week,
      lineLabel: lineLabel || category,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
