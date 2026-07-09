import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";

const ALLOWED_FREQUENCIES = ["onetime", "weekly", "biweekly", "monthly"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.lineItem.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.companyId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const { name, category, amount, frequency, startWeek, lineLabel } = body || {};
  const data: Record<string, string | number> = {};

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
  if (startWeek !== undefined) {
    data.startWeek = Math.max(1, Number(startWeek) || 1);
  }

  const item = await prisma.lineItem.update({ where: { id }, data });
  return NextResponse.json(item);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const item = await prisma.lineItem.findUnique({ where: { id } });
  if (!item || item.userId !== session.companyId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.lineItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
