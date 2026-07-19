"use client";

import { Download, Printer } from "lucide-react";
import { ActualValues, WeekRow, money, weekDateRange, weekNumberForDate } from "@/lib/forecast";
import { downloadCsv, weeklyLedgerToCsv } from "@/lib/export";

function ActualCell({
  value,
  forecastValue,
  favorable,
  canEdit,
  isPastOrCurrent,
  title,
  onSave,
}: {
  value: number | undefined;
  forecastValue: number;
  favorable: "higher" | "lower";
  canEdit: boolean;
  isPastOrCurrent: boolean;
  title: string;
  onSave: (value: number) => void;
}) {
  if (!isPastOrCurrent) {
    return <span style={{ color: "var(--inkFaint)" }}>—</span>;
  }
  const diff = value !== undefined ? value - forecastValue : null;
  const isGood = diff === null ? null : favorable === "higher" ? diff >= 0 : diff <= 0;
  return (
    <input
      className="dt-input"
      type="number"
      step="0.01"
      placeholder="—"
      defaultValue={value !== undefined ? value.toFixed(2) : ""}
      key={`${title}-${value}`}
      readOnly={!canEdit}
      title={canEdit ? title : ""}
      style={diff === null ? undefined : { color: isGood ? "var(--income)" : "var(--expense)" }}
      onBlur={(e) => {
        if (!canEdit) return;
        const v = e.target.value.trim();
        if (v === "") return;
        const num = Number(v);
        if (!isNaN(num)) onSave(num);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export default function WeeklyLedger({
  weekly,
  actuals,
  forecastStart,
  companyName,
  canEdit,
  onEditActual,
}: {
  weekly: WeekRow[];
  actuals: Record<number, ActualValues>;
  forecastStart: Date;
  companyName: string;
  canEdit: boolean;
  onEditActual: (week: number, field: keyof ActualValues, value: number) => void;
}) {
  const currentWeek = weekNumberForDate(new Date(), forecastStart);

  return (
    <div className="card">
      <div className="card-head">
        <h2>Weekly ledger</h2>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="button"
            className="link-btn"
            onClick={() => downloadCsv(`${companyName}-weekly-ledger.csv`, weeklyLedgerToCsv(weekly, actuals, forecastStart))}
          >
            <Download size={14} />
            Export CSV
          </button>
          <button type="button" className="link-btn" onClick={() => window.print()}>
            <Printer size={14} />
            Print / PDF
          </button>
        </div>
      </div>
      <span className="sub" style={{ display: "block", margin: "-6px 0 12px" }}>
        {canEdit
          ? "Once a week has passed, record what actually happened — income, expenses, and closing balance are each stored independently, so variances stay accurate even if you only have some of the numbers yet."
          : "Actual figures, once recorded, show how accurate this forecast has been."}
      </span>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th>Income</th>
              <th>Actual Income</th>
              <th>Expenses</th>
              <th>Actual Expenses</th>
              <th>Net</th>
              <th>Forecasted Balance</th>
              <th>Actual Balance</th>
              <th>Variance</th>
            </tr>
          </thead>
          <tbody>
            {weekly.map((w) => {
              const isPastOrCurrent = w.week <= currentWeek;
              const a = actuals[w.week] || {};
              const balanceVariance = a.balance !== undefined ? a.balance - w.balance : null;
              return (
                <tr key={w.week}>
                  <td className="mono" style={{ color: "var(--inkMuted)" }}>
                    {weekDateRange(w.week, forecastStart)}
                  </td>
                  <td className="mono" style={{ color: "var(--income)" }}>
                    {w.income > 0 ? "+" + money(w.income) : "—"}
                  </td>
                  <td className="mono">
                    <ActualCell
                      value={a.income}
                      forecastValue={w.income}
                      favorable="higher"
                      canEdit={canEdit}
                      isPastOrCurrent={isPastOrCurrent}
                      title="Enter what your actual income was for this week"
                      onSave={(v) => onEditActual(w.week, "income", v)}
                    />
                  </td>
                  <td className="mono" style={{ color: "var(--expense)" }}>
                    {w.expense > 0 ? "-" + money(w.expense) : "—"}
                  </td>
                  <td className="mono">
                    <ActualCell
                      value={a.expense}
                      forecastValue={w.expense}
                      favorable="lower"
                      canEdit={canEdit}
                      isPastOrCurrent={isPastOrCurrent}
                      title="Enter what your actual expenses were for this week"
                      onSave={(v) => onEditActual(w.week, "expense", v)}
                    />
                  </td>
                  <td className="mono" style={{ fontWeight: 600, color: w.net >= 0 ? "var(--income)" : "var(--expense)" }}>
                    {w.net >= 0 ? "+" : ""}
                    {money(w.net)}
                  </td>
                  <td className="mono" style={{ fontWeight: 700, color: w.balance < 0 ? "var(--expense)" : "var(--ink)" }}>
                    {money(w.balance)}
                  </td>
                  <td className="mono">
                    <ActualCell
                      value={a.balance}
                      forecastValue={w.balance}
                      favorable="higher"
                      canEdit={canEdit}
                      isPastOrCurrent={isPastOrCurrent}
                      title="Enter what your balance actually was at the end of this week"
                      onSave={(v) => onEditActual(w.week, "balance", v)}
                    />
                  </td>
                  <td
                    className="mono"
                    style={{
                      fontWeight: 600,
                      color: balanceVariance === null ? "var(--inkFaint)" : balanceVariance >= 0 ? "var(--income)" : "var(--expense)",
                    }}
                  >
                    {balanceVariance === null ? "—" : `${balanceVariance >= 0 ? "+" : ""}${money(balanceVariance)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
