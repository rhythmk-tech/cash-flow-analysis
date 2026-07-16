import {
  ActualValues,
  ItemType,
  LineItem,
  OverrideMap,
  WeekRow,
  getRowLabels,
  getRowWeekAmount,
  weekDateRange,
} from "./forecast";

function csvField(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function csvRow(fields: (string | number)[]): string {
  return fields.map(csvField).join(",");
}

export function weeklyLedgerToCsv(weekly: WeekRow[], actuals: Record<number, ActualValues> = {}, forecastStart?: Date): string {
  const hasActuals = Object.keys(actuals).length > 0;
  const header = ["Week", "Income", "Actual Income", "Expenses", "Actual Expenses", "Net", "Forecasted Balance"];
  if (hasActuals) header.push("Actual Balance", "Variance");
  const lines = [csvRow(header)];
  weekly.forEach((w) => {
    const a = actuals[w.week] || {};
    const weekLabel = forecastStart ? weekDateRange(w.week, forecastStart) : `W${w.week}`;
    const row = [
      weekLabel,
      w.income.toFixed(2),
      a.income !== undefined ? a.income.toFixed(2) : "",
      w.expense.toFixed(2),
      a.expense !== undefined ? a.expense.toFixed(2) : "",
      w.net.toFixed(2),
      w.balance.toFixed(2),
    ];
    if (hasActuals) {
      row.push(a.balance !== undefined ? a.balance.toFixed(2) : "", a.balance !== undefined ? (a.balance - w.balance).toFixed(2) : "");
    }
    lines.push(csvRow(row));
  });
  return lines.join("\n") + "\n";
}

export function detailedForecastToCsv(
  items: LineItem[],
  overrides: OverrideMap,
  weekly: WeekRow[],
  totalWeeks: number,
  forecastStart: Date
): string {
  const weekHeaders = Array.from({ length: totalWeeks }, (_, i) => i + 1);
  const incomeLabels = getRowLabels(items, "income");
  const expenseLabels = getRowLabels(items, "expense");

  const lines: string[] = [];
  const headerRow = ["Category", ...weekHeaders.map((w) => `W${w} (${weekDateRange(w, forecastStart)})`)];
  lines.push(csvRow(headerRow));

  const rowFor = (label: string, values: number[]) => csvRow([label, ...values.map((v) => v.toFixed(2))]);
  const amountsFor = (type: ItemType, label: string) =>
    weekHeaders.map((w) => getRowWeekAmount(items, overrides, type, label, w, totalWeeks, forecastStart));

  lines.push(rowFor("OPENING CASH BALANCE", weekly.map((w) => w.balance - w.net)));
  lines.push("");

  lines.push(csvRow(["INFLOWS"]));
  incomeLabels.forEach((label) => lines.push(rowFor(label, amountsFor("income", label))));
  lines.push(rowFor("TOTAL INFLOWS", weekly.map((w) => w.income)));
  lines.push("");

  lines.push(csvRow(["OUTFLOWS"]));
  expenseLabels.forEach((label) => lines.push(rowFor(label, amountsFor("expense", label))));
  lines.push(rowFor("TOTAL OUTFLOWS", weekly.map((w) => w.expense)));
  lines.push("");

  lines.push(rowFor("NET CASH FLOW", weekly.map((w) => w.net)));
  lines.push(rowFor("CLOSING CASH BALANCE", weekly.map((w) => w.balance)));

  return lines.join("\n") + "\n";
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
