export type ItemType = "income" | "expense";
export type Frequency = "onetime" | "weekly" | "biweekly" | "monthly";

export interface LineItem {
  id: string;
  type: ItemType;
  category: string;
  name: string;
  amount: number;
  frequency: Frequency;
  startDate: string; // "YYYY-MM-DD", absolute — see parseDateOnly/formatDateOnly
  lineLabel: string;
}

export type OverrideMap = Record<string, number>;

export interface WeekRow {
  week: number;
  income: number;
  expense: number;
  net: number;
  balance: number;
  incomeByCat: Record<string, number>;
  expenseByCat: Record<string, number>;
}

export const FREQ_LABELS: Record<Frequency, string> = {
  onetime: "One-time",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly (1st of each month)",
};

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Payroll",
  "Cost of Goods Sold",
  "Marketing",
  "Insurance",
  "Loan Payments",
  "Utilities",
  "Software & Subscriptions",
  "Professional Services",
  "Taxes",
  "Equipment",
  "Misc Opex",
];

export const INCOME_CATEGORIES = [
  "Sales Revenue",
  "Service Revenue",
  "AR Collections",
  "Interest Income",
  "Other Income",
];

export function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + "$" + Math.abs(Math.round(n)).toLocaleString();
}

export function overrideKey(type: ItemType, label: string, week: number): string {
  return `${type}::${label}::${week}`;
}

// Recurring items are scheduled by real calendar dates, not a fixed week-count step —
// months are 28-31 days, so "every 4 weeks" drifts away from actual month boundaries
// over a few cycles. occurrencesFor takes forecastStart so it can convert between the
// forecast's week-index grid and real dates.
export function occurrencesFor(item: LineItem, totalWeeks: number, forecastStart: Date): number[] {
  const weeks: number[] = [];
  const itemDate = parseDateOnly(item.startDate);
  const start = Math.max(1, weekNumberForDate(itemDate, forecastStart));
  if (item.frequency === "onetime") {
    if (start <= totalWeeks) weeks.push(start);
    return weeks;
  }
  if (item.frequency === "monthly") {
    let cursor = new Date(itemDate.getFullYear(), itemDate.getMonth(), 1);
    for (let i = 0; i < 36; i++) {
      const wk = weekNumberForDate(cursor, forecastStart);
      if (wk > totalWeeks) break;
      if (wk >= 1) weeks.push(wk);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return weeks;
  }
  const step = item.frequency === "weekly" ? 1 : 2; // biweekly
  for (let w = start; w <= totalWeeks; w += step) weeks.push(w);
  return weeks;
}

function sumItemsForLabelWeek(
  items: LineItem[],
  type: ItemType,
  label: string,
  week: number,
  totalWeeks: number,
  forecastStart: Date
): number {
  let total = 0;
  for (const it of items) {
    if (it.type !== type) continue;
    if ((it.lineLabel || it.category) !== label) continue;
    if (occurrencesFor(it, totalWeeks, forecastStart).includes(week)) total += it.amount;
  }
  return total;
}

export function getRowWeekAmount(
  items: LineItem[],
  overrides: OverrideMap,
  type: ItemType,
  label: string,
  week: number,
  totalWeeks: number,
  forecastStart: Date
): number {
  const key = overrideKey(type, label, week);
  if (Object.prototype.hasOwnProperty.call(overrides, key)) return overrides[key];
  return sumItemsForLabelWeek(items, type, label, week, totalWeeks, forecastStart);
}

export function getRowLabels(items: LineItem[], type: ItemType): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const it of items) {
    if (it.type !== type) continue;
    const label = it.lineLabel || it.category;
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  return labels;
}

// Applies a saved manual row order to a natural (first-seen) label list. Labels present in
// `order` come first, in that order; any label not in `order` (e.g. a brand-new item) is
// appended afterward in its natural order. An empty `order` returns `labels` unchanged, so
// accounts that have never reordered anything see exactly today's behavior.
export function sortLabels(labels: string[], order: string[]): string[] {
  if (order.length === 0) return labels;
  const rank = new Map(order.map((label, i) => [label, i]));
  const known = labels.filter((l) => rank.has(l)).sort((a, b) => rank.get(a)! - rank.get(b)!);
  const unknown = labels.filter((l) => !rank.has(l));
  return [...known, ...unknown];
}

export function buildLabelToCategoryMap(items: LineItem[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const it of items) map[it.lineLabel || it.category] = it.category;
  return map;
}

export function computeWeekly(
  items: LineItem[],
  overrides: OverrideMap,
  startingBalance: number,
  totalWeeks: number,
  forecastStart: Date
): WeekRow[] {
  const incomeLabels = getRowLabels(items, "income");
  const expenseLabels = getRowLabels(items, "expense");
  const labelToCategory = buildLabelToCategoryMap(items);

  let running = startingBalance;
  const weeks: WeekRow[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    let income = 0,
      expense = 0;
    const incomeByCat: Record<string, number> = {};
    const expenseByCat: Record<string, number> = {};

    incomeLabels.forEach((label) => {
      const amt = getRowWeekAmount(items, overrides, "income", label, w, totalWeeks, forecastStart);
      income += amt;
      const cat = labelToCategory[label] || label;
      incomeByCat[cat] = (incomeByCat[cat] || 0) + amt;
    });
    expenseLabels.forEach((label) => {
      const amt = getRowWeekAmount(items, overrides, "expense", label, w, totalWeeks, forecastStart);
      expense += amt;
      const cat = labelToCategory[label] || label;
      expenseByCat[cat] = (expenseByCat[cat] || 0) + amt;
    });

    const net = income - expense;
    running += net;
    weeks.push({ week: w, income, expense, net, balance: running, incomeByCat, expenseByCat });
  }
  return weeks;
}

export interface ScenarioPoint {
  week: number;
  balance: number;
}

export function computeScenario(
  items: LineItem[],
  overrides: OverrideMap,
  startingBalance: number,
  totalWeeks: number,
  pct: number,
  forecastStart: Date
): ScenarioPoint[] {
  const incomeLabels = getRowLabels(items, "income");
  const expenseLabels = getRowLabels(items, "expense");
  const scaleFactor = 1 + pct / 100;

  let running = startingBalance;
  const weeks: ScenarioPoint[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    let income = 0,
      expense = 0;
    incomeLabels.forEach((label) => {
      income += getRowWeekAmount(items, overrides, "income", label, w, totalWeeks, forecastStart) * scaleFactor;
    });
    expenseLabels.forEach((label) => {
      expense += getRowWeekAmount(items, overrides, "expense", label, w, totalWeeks, forecastStart);
    });
    running += income - expense;
    weeks.push({ week: w, balance: running });
  }
  return weeks;
}

export function dateForWeek(weekNum: number, forecastStart: Date): Date {
  return new Date(forecastStart.getTime() + (weekNum - 1) * 7 * 86400000);
}

// Raw (unclamped) week index for a date — can be <1 for dates before forecastStart.
// Callers that need a valid in-range week should clamp with Math.max(1, ...) themselves.
export function weekNumberForDate(date: Date, forecastStart: Date): number {
  const diffDays = Math.round((date.getTime() - forecastStart.getTime()) / 86400000);
  return Math.floor(diffDays / 7) + 1;
}

export function weekDateRange(weekNum: number, forecastStart: Date): string {
  const start = dateForWeek(weekNum, forecastStart);
  const end = new Date(start.getTime() + 6 * 86400000);
  const fmt = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  return `${fmt(start)}-${fmt(end)}`;
}

export const COLORS = {
  ink: "#12151C",
  inkMuted: "#6B7280",
  border: "#E5E7EB",
  income: "#0FA968",
  expense: "#E2483A",
  accent: "#4F46E5",
};

export interface Tip {
  type: "warning" | "insight" | "success";
  text: string;
}

export function computeTips(weekly: WeekRow[], startingBalance: number): Tip[] {
  if (weekly.length === 0) return [];

  const totalExpense = weekly.reduce((s, w) => s + w.expense, 0);
  const catTotals: Record<string, number> = {};
  weekly.forEach((w) => {
    Object.entries(w.expenseByCat).forEach(([c, a]) => {
      catTotals[c] = (catTotals[c] || 0) + a;
    });
  });
  const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const minWeek = weekly.reduce((min, w) => (w.balance < min.balance ? w : min), weekly[0]);
  const negativeWeeks = weekly.filter((w) => w.balance < 0);
  const endingBalance = weekly[weekly.length - 1].balance;
  const avgWeeklyExpense = totalExpense / weekly.length;

  const tips: Tip[] = [];

  if (negativeWeeks.length > 0) {
    const first = negativeWeeks[0];
    const worst = Object.entries(first.expenseByCat).sort((a, b) => b[1] - a[1])[0];
    tips.push({
      type: "warning",
      text:
        `Cash goes negative starting Week ${first.week} (balance ${money(first.balance)}), bottoming out at ${money(minWeek.balance)} in Week ${minWeek.week}.` +
        (worst ? ` "${worst[0]}" (${money(worst[1])}) is the biggest hit that week — see if it can shift a week or two.` : ""),
    });
    tips.push({
      type: "warning",
      text: `You'd need about ${money(Math.abs(minWeek.balance) + avgWeeklyExpense)} more in reserve before Week ${minWeek.week} to stay positive through the dip.`,
    });
  } else if (minWeek.balance < avgWeeklyExpense * 2) {
    tips.push({
      type: "insight",
      text: `Your lowest point is Week ${minWeek.week} at ${money(minWeek.balance)} — thinner than 2 weeks of average expenses (${money(avgWeeklyExpense * 2)}). A small buffer would give you more breathing room.`,
    });
  } else {
    tips.push({
      type: "success",
      text: `Balance stays positive across all ${weekly.length} weeks, never dropping below ${money(minWeek.balance)} in Week ${minWeek.week}.`,
    });
  }

  if (sortedCats.length > 0 && totalExpense > 0) {
    const [topCat, topAmt] = sortedCats[0];
    const share = (topAmt / totalExpense) * 100;
    if (share >= 30) {
      tips.push({
        type: "insight",
        text: `"${topCat}" makes up ${share.toFixed(0)}% of total outflow (${money(topAmt)}). It's your biggest lever — worth a closer look for negotiation or timing changes.`,
      });
    }
  }

  const payroll = sortedCats.find(([c]) => c === "Payroll");
  if (payroll && totalExpense > 0 && payroll[1] / totalExpense >= 0.35) {
    tips.push({
      type: "insight",
      text: `Payroll is ${((payroll[1] / totalExpense) * 100).toFixed(0)}% of expenses — your largest fixed cost. Aligning pay dates with your biggest income weeks can smooth out dips.`,
    });
  }

  const spikeWeek = weekly.find((w) => w.expense > avgWeeklyExpense * 1.6 && avgWeeklyExpense > 0);
  if (spikeWeek) {
    const cats = Object.keys(spikeWeek.expenseByCat);
    if (cats.length > 1) {
      tips.push({
        type: "insight",
        text: `Week ${spikeWeek.week} stacks up ${cats.length} expense categories at once (${money(spikeWeek.expense)} total). Staggering start dates would even out the load.`,
      });
    }
  }

  if (endingBalance < startingBalance && negativeWeeks.length === 0) {
    tips.push({
      type: "insight",
      text: `Balance is trending down overall — from ${money(startingBalance)} to ${money(endingBalance)} over ${weekly.length} weeks. Fine short-term, but worth watching if it continues past this window.`,
    });
  }

  if (negativeWeeks.length === 0 && minWeek.balance > avgWeeklyExpense * 4) {
    tips.push({
      type: "success",
      text: `You're holding more than 4 weeks of average expenses in reserve at all times. Once that buffer feels comfortable, surplus could go toward growth or a savings account.`,
    });
  }

  return tips.slice(0, 6);
}

export function upcomingMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = (8 - day) % 7 || 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (day === 1 ? 0 : daysUntilMonday));
  return monday;
}

// Parses a "YYYY-MM-DD" string (as produced by <input type="date">) into a local-midnight Date,
// avoiding the UTC-parsing off-by-one that `new Date("YYYY-MM-DD")` can produce.
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

export function formatDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
