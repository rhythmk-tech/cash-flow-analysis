"use client";

import { WeekRow, money, weekNumberForDate } from "@/lib/forecast";
import { downloadCsv, weeklyLedgerToCsv } from "@/lib/export";

export default function WeeklyLedger({
  weekly,
  actuals,
  forecastStart,
  companyName,
  canEdit,
  onEditActual,
}: {
  weekly: WeekRow[];
  actuals: Record<number, number>;
  forecastStart: Date;
  companyName: string;
  canEdit: boolean;
  onEditActual: (week: number, balance: number) => void;
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
            onClick={() => downloadCsv(`${companyName}-weekly-ledger.csv`, weeklyLedgerToCsv(weekly, actuals))}
          >
            ⬇ Export CSV
          </button>
          <button type="button" className="link-btn" onClick={() => window.print()}>
            🖨 Print / PDF
          </button>
        </div>
      </div>
      <span className="sub" style={{ display: "block", margin: "-6px 0 12px" }}>
        {canEdit
          ? "Once a week has passed, enter what your balance actually ended up at to see how accurate this forecast has been."
          : "Actual balances, once recorded, show how accurate this forecast has been."}
      </span>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th>Income</th>
              <th>Expenses</th>
              <th>Net</th>
              <th>Forecasted Balance</th>
              <th>Actual Balance</th>
              <th>Variance</th>
            </tr>
          </thead>
          <tbody>
            {weekly.map((w) => {
              const isPastOrCurrent = w.week <= currentWeek;
              const actual = actuals[w.week];
              const variance = actual !== undefined ? actual - w.balance : null;
              return (
                <tr key={w.week}>
                  <td className="mono" style={{ color: "var(--inkMuted)" }}>
                    W{w.week}
                  </td>
                  <td className="mono" style={{ color: "var(--income)" }}>
                    {w.income > 0 ? "+" + money(w.income) : "—"}
                  </td>
                  <td className="mono" style={{ color: "var(--expense)" }}>
                    {w.expense > 0 ? "-" + money(w.expense) : "—"}
                  </td>
                  <td className="mono" style={{ fontWeight: 600, color: w.net >= 0 ? "var(--income)" : "var(--expense)" }}>
                    {w.net >= 0 ? "+" : ""}
                    {money(w.net)}
                  </td>
                  <td className="mono" style={{ fontWeight: 700, color: w.balance < 0 ? "var(--expense)" : "var(--ink)" }}>
                    {money(w.balance)}
                  </td>
                  <td className="mono">
                    {isPastOrCurrent ? (
                      <input
                        className="dt-input"
                        type="number"
                        step="0.01"
                        placeholder="—"
                        defaultValue={actual !== undefined ? actual.toFixed(2) : ""}
                        key={`actual-${w.week}-${actual}`}
                        readOnly={!canEdit}
                        title={canEdit ? "Enter what your balance actually was at the end of this week" : ""}
                        onBlur={(e) => {
                          if (!canEdit) return;
                          const v = e.target.value.trim();
                          if (v === "") return;
                          const num = Number(v);
                          if (!isNaN(num)) onEditActual(w.week, num);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                      />
                    ) : (
                      <span style={{ color: "var(--inkFaint)" }}>—</span>
                    )}
                  </td>
                  <td
                    className="mono"
                    style={{
                      fontWeight: 600,
                      color: variance === null ? "var(--inkFaint)" : variance >= 0 ? "var(--income)" : "var(--expense)",
                    }}
                  >
                    {variance === null ? "—" : `${variance >= 0 ? "+" : ""}${money(variance)}`}
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
