"use client";

import { Download, Printer } from "lucide-react";
import { ItemType, LineItem, MonthRow, getRowLabels, getRowMonthAmount, money } from "@/lib/forecast";
import { downloadCsv, monthlySummaryToCsv } from "@/lib/export";

function ReadRow({ className, label, values }: { className: string; label: string; values: number[] }) {
  return (
    <tr className={className}>
      <td>{label}</td>
      {values.map((v, i) => (
        <td key={i}>{money(v)}</td>
      ))}
    </tr>
  );
}

export default function MonthlySummaryTable({
  items,
  monthly,
  totalMonths,
  forecastStart,
  onMonthsChange,
  canEdit = true,
}: {
  items: LineItem[];
  monthly: MonthRow[];
  totalMonths: number;
  forecastStart: Date;
  onMonthsChange: (value: number) => void;
  canEdit?: boolean;
}) {
  const incomeLabels = getRowLabels(items, "income");
  const expenseLabels = getRowLabels(items, "expense");

  function rowFor(type: ItemType, label: string) {
    return monthly.map((m) => getRowMonthAmount(items, type, label, m.month, totalMonths, forecastStart));
  }

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-head">
        <h2>Monthly cash flow summary</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <label className="pill" style={{ display: "inline-flex" }}>
            <span className="label">Months</span>
            <input
              type="number"
              min={1}
              max={24}
              style={{ width: 44 }}
              defaultValue={totalMonths}
              disabled={!canEdit}
              key={`months-${totalMonths}`}
              onBlur={(e) => onMonthsChange(Math.min(24, Math.max(1, Number(e.target.value) || 12)))}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
          </label>
          <button
            type="button"
            className="link-btn"
            onClick={() => downloadCsv("monthly-cash-flow-summary.csv", monthlySummaryToCsv(items, monthly, totalMonths, forecastStart))}
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
        A longer-range, read-only roll-up of the same line items shown above — adjustable from 1 to 24 months,
        independent of the weekly forecast length. Manual weekly overrides aren&apos;t reflected here, since a
        week doesn&apos;t map cleanly onto a single calendar month.
      </span>
      <div className="table-scroll">
        <table className="detail-table">
          <thead>
            <tr>
              <th>Category</th>
              {monthly.map((m) => (
                <th key={m.month}>{m.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="dt-section-title">
              <td colSpan={monthly.length + 1}>OPENING CASH BALANCE</td>
            </tr>
            <ReadRow className="dt-line" label="Total Opening Balance" values={monthly.map((m) => m.balance - m.net)} />

            <tr className="dt-spacer">
              <td colSpan={monthly.length + 1} />
            </tr>
            <tr className="dt-section-title">
              <td colSpan={monthly.length + 1}>INFLOWS</td>
            </tr>
            {incomeLabels.length === 0 && (
              <tr className="dt-line">
                <td colSpan={monthly.length + 1} style={{ color: "var(--inkFaint)" }}>
                  No income line items yet.
                </td>
              </tr>
            )}
            {incomeLabels.map((label) => (
              <ReadRow key={label} className="dt-line" label={label} values={rowFor("income", label)} />
            ))}
            <ReadRow className="dt-total dt-income" label="TOTAL INFLOWS" values={monthly.map((m) => m.income)} />

            <tr className="dt-spacer">
              <td colSpan={monthly.length + 1} />
            </tr>
            <tr className="dt-section-title">
              <td colSpan={monthly.length + 1}>OUTFLOWS</td>
            </tr>
            {expenseLabels.length === 0 && (
              <tr className="dt-line">
                <td colSpan={monthly.length + 1} style={{ color: "var(--inkFaint)" }}>
                  No expense line items yet.
                </td>
              </tr>
            )}
            {expenseLabels.map((label) => (
              <ReadRow key={label} className="dt-line" label={label} values={rowFor("expense", label)} />
            ))}
            <ReadRow className="dt-total dt-expense" label="TOTAL OUTFLOWS" values={monthly.map((m) => m.expense)} />

            <tr className="dt-spacer">
              <td colSpan={monthly.length + 1} />
            </tr>
            <ReadRow className="dt-net" label="NET CASH FLOW" values={monthly.map((m) => m.net)} />
            <ReadRow className="dt-balance" label="CLOSING CASH BALANCE" values={monthly.map((m) => m.balance)} />
          </tbody>
        </table>
      </div>
    </div>
  );
}
