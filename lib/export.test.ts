import { describe, expect, it } from "vitest";
import { computeWeekly } from "./forecast";
import { detailedForecastToCsv, weeklyLedgerToCsv } from "./export";
import type { LineItem } from "./forecast";

const items: LineItem[] = [
  {
    id: "1",
    type: "income",
    category: "Sales Revenue",
    name: "Sales",
    amount: 1000,
    frequency: "weekly",
    startWeek: 1,
    lineLabel: "Sales Revenue",
  },
  {
    id: "2",
    type: "expense",
    category: "Rent",
    name: "Rent",
    amount: 400,
    frequency: "weekly",
    startWeek: 1,
    lineLabel: "Rent",
  },
];

const FS = new Date(2026, 6, 13);

describe("weeklyLedgerToCsv", () => {
  it("includes a header row and one row per week", () => {
    const weekly = computeWeekly(items, {}, 0, 3, FS);
    const csv = weeklyLedgerToCsv(weekly);
    const rows = csv.trim().split("\n");
    expect(rows[0]).toBe("Week,Income,Expenses,Net,Balance");
    expect(rows).toHaveLength(4);
    expect(rows[1]).toBe("W1,1000.00,400.00,600.00,600.00");
  });
});

describe("detailedForecastToCsv", () => {
  it("includes category rows and totals", () => {
    const weekly = computeWeekly(items, {}, 0, 2, FS);
    const csv = detailedForecastToCsv(items, {}, weekly, 2, new Date(2026, 6, 13));
    expect(csv).toContain("Sales Revenue");
    expect(csv).toContain("Rent");
    expect(csv).toContain("TOTAL INFLOWS");
    expect(csv).toContain("TOTAL OUTFLOWS");
    expect(csv).toContain("CLOSING CASH BALANCE");
  });

  it("labels each week column with its date range", () => {
    const weekly = computeWeekly(items, {}, 0, 1, FS);
    const csv = detailedForecastToCsv(items, {}, weekly, 1, new Date(2026, 6, 13));
    expect(csv).toContain("W1 (07/13-07/19)");
  });

  it("quotes a category name that itself contains a comma", () => {
    const commaItems: LineItem[] = [
      { ...items[0], category: "Sales, Retail", lineLabel: "Sales, Retail" },
    ];
    const weekly = computeWeekly(commaItems, {}, 0, 1, FS);
    const csv = detailedForecastToCsv(commaItems, {}, weekly, 1, new Date(2026, 6, 13));
    expect(csv).toContain('"Sales, Retail"');
  });
});
