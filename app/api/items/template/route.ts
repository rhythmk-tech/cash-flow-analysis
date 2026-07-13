import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { requireCompanyId } from "@/lib/session";
import { formatDateOnly, parseDateOnly, upcomingMonday } from "@/lib/forecast";

// A blank starter workbook for users who don't have an existing file to upload — fill in the
// "Cash Flow Data" sheet with real numbers, save, and upload it back through the import panel.
export async function GET(req: Request) {
  const session = await requireCompanyId();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const fsParam = url.searchParams.get("forecastStart");
  const forecastStart = fsParam ? parseDateOnly(fsParam) : upcomingMonday();
  const anchor = Number.isNaN(forecastStart.getTime()) ? upcomingMonday() : forecastStart;
  const nextMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Cash Flow Forecaster";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Cash Flow Data");
  sheet.columns = [
    { header: "Type", key: "type", width: 12 },
    { header: "Category", key: "category", width: 24 },
    { header: "Name", key: "name", width: 30 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Frequency", key: "frequency", width: 16 },
    { header: "Date", key: "date", width: 14 },
  ];
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FF12151C" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF0FF" } };

  // Example rows cover every type × frequency combination so the shape of the data is
  // unambiguous — replace these with real numbers, delete any rows you don't need.
  const exampleRows: Record<string, string | number>[] = [
    { type: "income", category: "Sales Revenue", name: "Weekly product sales", amount: 12000, frequency: "weekly", date: formatDateOnly(anchor) },
    { type: "income", category: "AR Collections", name: "Outstanding invoice from ClientCo", amount: 4500, frequency: "onetime", date: formatDateOnly(new Date(anchor.getTime() + 7 * 86400000)) },
    { type: "income", category: "Service Revenue", name: "Retainer client", amount: 3000, frequency: "monthly", date: formatDateOnly(nextMonth) },
    { type: "expense", category: "Payroll", name: "Biweekly payroll run", amount: 8200, frequency: "biweekly", date: formatDateOnly(anchor) },
    { type: "expense", category: "Rent", name: "Office rent", amount: 3200, frequency: "monthly", date: formatDateOnly(nextMonth) },
    { type: "expense", category: "Software & Subscriptions", name: "Accounting software", amount: 89, frequency: "monthly", date: formatDateOnly(nextMonth) },
  ];
  exampleRows.forEach((row) => {
    const r = sheet.addRow(row);
    r.font = { color: { argb: "FF9CA3AF" }, italic: true };
  });
  sheet.getCell(`A${sheet.rowCount + 2}`).value =
    "↑ Replace the rows above with your real numbers, or delete them and add your own.";
  sheet.getCell(`A${sheet.rowCount}`).font = { italic: true, color: { argb: "FF9CA3AF" }, size: 10 };

  const infoSheet = workbook.addWorksheet("Instructions");
  infoSheet.columns = [{ width: 100 }];
  const lines = [
    "How to use this template",
    "",
    "1. On the \"Cash Flow Data\" sheet, replace the example rows with your own income and expenses (or delete them and add your own from scratch).",
    "2. Type — must be exactly \"income\" or \"expense\".",
    "3. Category — a bucket like Rent, Payroll, or Sales Revenue. Use whatever makes sense for your business; new categories are created automatically.",
    "4. Name — a short label for this line item, e.g. \"Office rent\".",
    "5. Amount — a positive number, no dollar sign or commas needed (e.g. 3200, not $3,200).",
    "6. Frequency — one of: onetime, weekly, biweekly, monthly. Monthly items recur on the 1st of each calendar month.",
    "7. Date — the date (YYYY-MM-DD) this item first occurs. For monthly items, any date in the starting month works — it will be anchored to the 1st.",
    "",
    "Once filled in, save this file and upload it on the \"Bulk import from a file\" panel in your dashboard.",
  ];
  lines.forEach((line, i) => {
    const cell = infoSheet.getCell(`A${i + 1}`);
    cell.value = line;
    if (i === 0) cell.font = { bold: true, size: 13 };
    cell.alignment = { wrapText: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="cash-flow-starter-template.xlsx"',
    },
  });
}
