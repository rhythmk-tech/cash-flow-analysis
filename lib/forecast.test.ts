import { describe, expect, it } from "vitest";
import {
  LineItem,
  buildLabelToCategoryMap,
  computeScenario,
  computeTips,
  computeWeekly,
  formatDateOnly,
  getRowLabels,
  getRowWeekAmount,
  money,
  occurrencesFor,
  overrideKey,
  parseDateOnly,
  weekDateRange,
} from "./forecast";

function item(overrides: Partial<LineItem> = {}): LineItem {
  return {
    id: "id1",
    type: "expense",
    category: "Rent",
    name: "Rent",
    amount: 1000,
    frequency: "monthly",
    startWeek: 1,
    lineLabel: "Rent",
    ...overrides,
  };
}

describe("money", () => {
  it("formats positive numbers with a dollar sign and thousands separators", () => {
    expect(money(1234)).toBe("$1,234");
  });
  it("rounds to the nearest whole dollar", () => {
    expect(money(1234.6)).toBe("$1,235");
  });
  it("formats negative numbers with a leading minus", () => {
    expect(money(-500)).toBe("-$500");
  });
  it("formats zero without a sign", () => {
    expect(money(0)).toBe("$0");
  });
});

describe("occurrencesFor", () => {
  it("returns a single week for one-time items within range", () => {
    expect(occurrencesFor(item({ frequency: "onetime", startWeek: 3 }), 12)).toEqual([3]);
  });
  it("returns no weeks for one-time items past the forecast window", () => {
    expect(occurrencesFor(item({ frequency: "onetime", startWeek: 20 }), 12)).toEqual([]);
  });
  it("returns every week for weekly items", () => {
    expect(occurrencesFor(item({ frequency: "weekly", startWeek: 1 }), 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it("steps by 2 for biweekly items", () => {
    expect(occurrencesFor(item({ frequency: "biweekly", startWeek: 2 }), 8)).toEqual([2, 4, 6, 8]);
  });
  it("steps by 4 for monthly items", () => {
    expect(occurrencesFor(item({ frequency: "monthly", startWeek: 1 }), 10)).toEqual([1, 5, 9]);
  });
  it("clamps a startWeek below 1 to week 1", () => {
    expect(occurrencesFor(item({ frequency: "onetime", startWeek: 0 }), 12)).toEqual([1]);
  });
});

describe("getRowLabels", () => {
  it("returns unique labels in first-seen order, filtered by type", () => {
    const items = [
      item({ type: "expense", lineLabel: "Rent" }),
      item({ type: "income", lineLabel: "Sales" }),
      item({ type: "expense", lineLabel: "Rent" }),
      item({ type: "expense", lineLabel: "Payroll" }),
    ];
    expect(getRowLabels(items, "expense")).toEqual(["Rent", "Payroll"]);
    expect(getRowLabels(items, "income")).toEqual(["Sales"]);
  });

  it("falls back to category when lineLabel is empty", () => {
    const items = [item({ lineLabel: "", category: "Misc Opex" })];
    expect(getRowLabels(items, "expense")).toEqual(["Misc Opex"]);
  });
});

describe("buildLabelToCategoryMap", () => {
  it("maps each label to its category", () => {
    const items = [item({ lineLabel: "Twenty Ten Ventures", category: "Consulting & Training" })];
    expect(buildLabelToCategoryMap(items)).toEqual({ "Twenty Ten Ventures": "Consulting & Training" });
  });
});

describe("getRowWeekAmount", () => {
  it("sums all items sharing a label for a given week", () => {
    const items = [
      item({ type: "expense", lineLabel: "Payroll", amount: 4000, frequency: "weekly", startWeek: 1 }),
      item({ type: "expense", lineLabel: "Payroll", amount: 800, frequency: "weekly", startWeek: 1 }),
    ];
    expect(getRowWeekAmount(items, {}, "expense", "Payroll", 1, 12)).toBe(4800);
  });

  it("returns 0 for a week the item doesn't occur in", () => {
    const items = [item({ frequency: "monthly", startWeek: 1 })];
    expect(getRowWeekAmount(items, {}, "expense", "Rent", 2, 12)).toBe(0);
  });

  it("prefers a manual override over the computed sum", () => {
    const items = [item({ lineLabel: "Rent", amount: 1000, frequency: "monthly", startWeek: 1 })];
    const overrides = { [overrideKey("expense", "Rent", 1)]: 1500 };
    expect(getRowWeekAmount(items, overrides, "expense", "Rent", 1, 12)).toBe(1500);
  });
});

describe("computeWeekly", () => {
  it("carries the starting balance forward with no items", () => {
    const weeks = computeWeekly([], {}, 1000, 4);
    expect(weeks).toHaveLength(4);
    expect(weeks.every((w) => w.balance === 1000 && w.net === 0)).toBe(true);
  });

  it("accumulates income and expenses into a running balance", () => {
    const items = [
      item({ type: "income", lineLabel: "Sales", amount: 500, frequency: "weekly", startWeek: 1 }),
      item({ type: "expense", lineLabel: "Rent", amount: 200, frequency: "weekly", startWeek: 1 }),
    ];
    const weeks = computeWeekly(items, {}, 0, 3);
    expect(weeks.map((w) => w.balance)).toEqual([300, 600, 900]);
    expect(weeks[0].income).toBe(500);
    expect(weeks[0].expense).toBe(200);
    expect(weeks[0].net).toBe(300);
  });

  it("goes negative when expenses exceed income and starting balance", () => {
    const items = [item({ type: "expense", lineLabel: "Rent", amount: 5000, frequency: "onetime", startWeek: 2 })];
    const weeks = computeWeekly(items, {}, 1000, 3);
    expect(weeks[0].balance).toBe(1000);
    expect(weeks[1].balance).toBe(-4000);
    expect(weeks[2].balance).toBe(-4000);
  });

  it("groups amounts by category for insights", () => {
    const items = [
      item({ type: "expense", lineLabel: "Rent A", category: "Rent", amount: 100, frequency: "weekly", startWeek: 1 }),
      item({ type: "expense", lineLabel: "Rent B", category: "Rent", amount: 50, frequency: "weekly", startWeek: 1 }),
    ];
    const weeks = computeWeekly(items, {}, 0, 1);
    expect(weeks[0].expenseByCat).toEqual({ Rent: 150 });
  });

  it("respects overrides when computing weekly totals", () => {
    const items = [item({ type: "income", lineLabel: "Sales", amount: 500, frequency: "weekly", startWeek: 1 })];
    const overrides = { [overrideKey("income", "Sales", 1)]: 900 };
    const weeks = computeWeekly(items, overrides, 0, 2);
    expect(weeks[0].income).toBe(900);
    expect(weeks[1].income).toBe(500);
  });
});

describe("computeScenario", () => {
  const items = [
    item({ type: "income", lineLabel: "Sales", amount: 1000, frequency: "weekly", startWeek: 1 }),
    item({ type: "expense", lineLabel: "Rent", amount: 400, frequency: "weekly", startWeek: 1 }),
  ];

  it("matches the base weekly forecast at 0%", () => {
    const scenario = computeScenario(items, {}, 0, 3, 0);
    const weekly = computeWeekly(items, {}, 0, 3);
    expect(scenario.map((s) => s.balance)).toEqual(weekly.map((w) => w.balance));
  });

  it("scales income up for a bull scenario without touching expenses", () => {
    const scenario = computeScenario(items, {}, 0, 1, 10);
    // income 1000 * 1.10 = 1100, minus 400 expense = 700
    expect(scenario[0].balance).toBe(700);
  });

  it("scales income down for a bear scenario", () => {
    const scenario = computeScenario(items, {}, 0, 1, -10);
    // income 1000 * 0.90 = 900, minus 400 expense = 500
    expect(scenario[0].balance).toBe(500);
  });
});

describe("weekDateRange", () => {
  it("returns a 7-day range starting from forecastStart for week 1", () => {
    const start = new Date(2026, 6, 13); // Mon, Jul 13 2026
    expect(weekDateRange(1, start)).toBe("07/13-07/19");
  });

  it("offsets by 7 days per subsequent week", () => {
    const start = new Date(2026, 6, 13);
    expect(weekDateRange(2, start)).toBe("07/20-07/26");
    expect(weekDateRange(3, start)).toBe("07/27-08/02");
  });
});

describe("parseDateOnly / formatDateOnly", () => {
  it("round-trips a YYYY-MM-DD string", () => {
    expect(formatDateOnly(parseDateOnly("2026-08-03"))).toBe("2026-08-03");
  });

  it("parses using local time, not UTC, avoiding off-by-one shifts", () => {
    const d = parseDateOnly("2026-01-01");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });

  it("pads single-digit months and days when formatting", () => {
    expect(formatDateOnly(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("computeTips", () => {
  it("returns no tips for an empty forecast", () => {
    expect(computeTips([], 1000)).toEqual([]);
  });

  it("warns when the balance goes negative", () => {
    const items = [item({ type: "expense", lineLabel: "Rent", amount: 5000, frequency: "onetime", startWeek: 1 })];
    const weekly = computeWeekly(items, {}, 0, 3);
    const tips = computeTips(weekly, 0);
    expect(tips[0].type).toBe("warning");
    expect(tips[0].text).toContain("Week 1");
  });

  it("reports success when the balance never dips low", () => {
    const items = [
      item({ type: "income", lineLabel: "Sales", amount: 10000, frequency: "weekly", startWeek: 1 }),
      item({ type: "expense", lineLabel: "Rent", amount: 100, frequency: "weekly", startWeek: 1 }),
    ];
    const weekly = computeWeekly(items, {}, 50000, 4);
    const tips = computeTips(weekly, 50000);
    expect(tips.some((t) => t.type === "success")).toBe(true);
  });

  it("caps the number of tips at 6", () => {
    const items = [
      item({ type: "expense", lineLabel: "Rent", category: "Rent", amount: 5000, frequency: "onetime", startWeek: 1 }),
      item({ type: "expense", lineLabel: "Payroll", category: "Payroll", amount: 4000, frequency: "weekly", startWeek: 1 }),
    ];
    const weekly = computeWeekly(items, {}, 0, 6);
    expect(computeTips(weekly, 0).length).toBeLessThanOrEqual(6);
  });
});
