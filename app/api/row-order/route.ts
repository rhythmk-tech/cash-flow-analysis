import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { canEditData } from "@/lib/roles";
import { logActivity } from "@/lib/activity";

export async function PUT(req: Request) {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditData(session.role)) {
    return NextResponse.json({ error: "Viewers can't reorder rows." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const type = body?.type;
  const order = body?.order;
  if (type !== "income" && type !== "expense") {
    return NextResponse.json({ error: "Invalid type." }, { status: 400 });
  }
  if (!Array.isArray(order) || !order.every((v) => typeof v === "string")) {
    return NextResponse.json({ error: "order must be an array of strings." }, { status: 400 });
  }

  const field = type === "income" ? "incomeRowOrder" : "expenseRowOrder";
  await prisma.user.update({
    where: { id: session.companyId },
    data: { [field]: order },
  });

  await logActivity(
    session.companyId,
    session.userId,
    session.userEmail,
    "rows.reorder",
    `Reordered ${type} rows in the Detailed Forecast`
  );

  return NextResponse.json({ ok: true });
}
