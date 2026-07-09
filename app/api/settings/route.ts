import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyId } from "@/lib/session";
import { formatDateOnly, parseDateOnly } from "@/lib/forecast";

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
  return NextResponse.json(serialize(user));
}
