import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { canEditData } from "@/lib/roles";
import { formatDateOnly, money, parseDateOnly } from "@/lib/forecast";
import { logActivity } from "@/lib/activity";
import { checkAndSendNegativeBalanceAlert } from "@/lib/alerts";

function serialize(user: {
  companyName: string;
  startingBalance: number;
  totalWeeks: number;
  bearPct: number;
  bullPct: number;
  forecastStart: Date;
}) {
  return { ...user, forecastStart: formatDateOnly(user.forecastStart) };
}

export async function GET() {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.companyId },
    select: {
      companyName: true,
      startingBalance: true,
      totalWeeks: true,
      bearPct: true,
      bullPct: true,
      forecastStart: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(serialize(user));
}

export async function PUT(req: Request) {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditData(session.role)) {
    return NextResponse.json({ error: "Viewers can't change settings." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const data: Record<string, number | Date> = {};

  if (body?.startingBalance !== undefined) {
    const v = Number(body.startingBalance);
    if (!Number.isFinite(v)) return NextResponse.json({ error: "Invalid startingBalance." }, { status: 400 });
    data.startingBalance = v;
  }
  if (body?.totalWeeks !== undefined) {
    const v = Math.min(26, Math.max(4, Number(body.totalWeeks) || 12));
    data.totalWeeks = v;
  }
  if (body?.bearPct !== undefined) {
    const v = Number(body.bearPct);
    if (!Number.isFinite(v)) return NextResponse.json({ error: "Invalid bearPct." }, { status: 400 });
    data.bearPct = v;
  }
  if (body?.bullPct !== undefined) {
    const v = Number(body.bullPct);
    if (!Number.isFinite(v)) return NextResponse.json({ error: "Invalid bullPct." }, { status: 400 });
    data.bullPct = v;
  }
  if (body?.forecastStart !== undefined) {
    const parsed = parseDateOnly(String(body.forecastStart));
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid forecastStart." }, { status: 400 });
    }
    data.forecastStart = parsed;
  }

  const user = await prisma.user.update({
    where: { id: session.companyId },
    data,
    select: {
      companyName: true,
      startingBalance: true,
      totalWeeks: true,
      bearPct: true,
      bullPct: true,
      forecastStart: true,
    },
  });

  const changeDescriptions: string[] = [];
  if (data.startingBalance !== undefined) changeDescriptions.push(`starting balance to ${money(data.startingBalance as number)}`);
  if (data.totalWeeks !== undefined) changeDescriptions.push(`forecast length to ${data.totalWeeks} weeks`);
  if (data.bearPct !== undefined) changeDescriptions.push(`bear scenario to ${data.bearPct}%`);
  if (data.bullPct !== undefined) changeDescriptions.push(`bull scenario to ${data.bullPct}%`);
  if (data.forecastStart !== undefined) changeDescriptions.push(`Week 1 start date to ${formatDateOnly(data.forecastStart as Date)}`);
  if (changeDescriptions.length > 0) {
    await logActivity(
      session.companyId,
      session.userId,
      session.userEmail,
      "settings.update",
      `Changed ${changeDescriptions.join(", ")}`
    );
  }
  await checkAndSendNegativeBalanceAlert(session.companyId, new URL(req.url).origin);

  return NextResponse.json(serialize(user));
}
