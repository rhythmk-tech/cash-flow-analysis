import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/session";
import { parseFinancialFile } from "@/lib/import-parser";
import { parseDateOnly } from "@/lib/forecast";

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB — generous for a spreadsheet/CSV/short PDF, not a DoS vector

// Parses an uploaded file into a preview of importable line items — does not write to the
// database. The client shows this preview and, if it looks right, confirms via /api/items/bulk.
export async function POST(req: Request) {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid upload." }, { status: 400 });

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File is too large (max 8MB)." }, { status: 400 });
  }

  const forecastStartRaw = formData.get("forecastStart");
  const forecastStart = typeof forecastStartRaw === "string" ? parseDateOnly(forecastStartRaw) : new Date();
  if (Number.isNaN(forecastStart.getTime())) {
    return NextResponse.json({ error: "Invalid forecastStart." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await parseFinancialFile(file.name, buffer, forecastStart);

  return NextResponse.json(result);
}
