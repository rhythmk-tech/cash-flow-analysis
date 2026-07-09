"use client";

import {
  ItemType,
  LineItem,
  OverrideMap,
  WeekRow,
  formatDateOnly,
  getRowLabels,
  getRowWeekAmount,
  money,
  overrideKey,
  weekDateRange,
} from "@/lib/forecast";
import { detailedForecastToCsv, downloadCsv } from "@/lib/export";

function ReadRow({
  className,
  label,
  values,
}: {
  className: string;
  label: string;
  values: number[];
}) {
  return (
    <tr className={className}>
      <td>{label}</td>
      {values.map((v, i) => (
        <td key={i}>{money(v)}</td>
      ))}
    </tr>
  );
}

function EditableRow({
  type,
  label,
  items,
  overrides,
  totalWeeks,
  weekHeaders,
  onEditOverride,
}: {
  type: ItemType;
  label: string;
  items: LineItem[];
  overrides: OverrideMap;
  totalWeeks: number;
  weekHeaders: number[];
  onEditOverride: (type: ItemType, label: string, week: number, value: number) => void;
}) {
  return (
    <tr className="dt-line">
      <td>{label}</td>
      {weekHeaders.map((w) => {
        const value = getRowWeekAmount(items, overrides, type, label, w, totalWeeks);
        const isEdited = Object.prototype.hasOwnProperty.call(overrides, overrideKey(type, label, w));
        return (
          <td key={w}>
            <input
              className={`dt-input${isEdited ? " dt-edited" : ""}`}
              type="number"
              step="0.01"
              defaultValue={value.toFixed(2)}
              key={`${label}-${w}-${value}`}
              title={isEdited ? "Manually edited" : ""}
              onBlur={(e) => {
                const v = Number(e.target.value);
                onEditOverride(type, label, w, isNaN(v) ? 0 : v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
          </td>
        );
      })}
    </tr>
  );
}

export default function DetailTable({
  items,
  overrides,
  weekly,
  totalWeeks,
  forecastStart,
  onEditOverride,
  onForecastStartChange,
}: {
  items: LineItem[];
  overrides: OverrideMap;
  weekly: WeekRow[];
  totalWeeks: number;
  forecastStart: Date;
  onEditOverride: (type: ItemType, label: string, week: number, value: number) => void;
  onForecastStartChange: (dateStr: string) => void;
}) {
  const weekHeaders = Array.from({ length: totalWeeks }, (_, i) => i + 1);
  const incomeLabels = getRowLabels(items, "income");
  const expenseLabels = getRowLabels(items, "expense");

  return (
    <div className="card">
      <div className="card-head">
        <h2>Detailed cash forecast</h2>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="button"
            className="link-btn"
            onClick={() =>
              downloadCsv(
                "detailed-cash-forecast.csv",
                detailedForecastToCsv(items, overrides, weekly, totalWeeks, forecastStart)
              )
            }
          >
            ⬇ Export CSV
          </button>
          <button type="button" className="link-btn" onClick={() => window.print()}>
            🖨 Print / PDF
          </button>
        </div>
      </div>
      <span className="sub" style={{ display: "block", margin: "-6px 0 12px" }}>
        Full category breakdown from your line items — click any number to edit it. Set Week 1&apos;s
        start date below and the rest of the weeks recalculate automatically.
      </span>
      <div className="table-scroll">
        <table className="detail-table">
          <thead>
            <tr>
              <th>Category</th>
              {weekHeaders.map((w) =>
                w === 1 ? (
                  <th key={w}>
                    W1
                    <br />
                    <input
                      type="date"
                      className="dt-date-input"
                      value={formatDateOnly(forecastStart)}
                      onChange={(e) => e.target.value && onForecastStartChange(e.target.value)}
                    />
                  </th>
                ) : (
                  <th key={w}>
                    W{w}
                    <br />
                    <span style={{ fontWeight: 400, textTransform: "none", fontSize: 10 }}>
                      {weekDateRange(w, forecastStart)}
                    </span>
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            <tr className="dt-section-title">
              <td colSpan={totalWeeks + 1}>OPENING CASH BALANCE</td>
            </tr>
            <ReadRow className="dt-line" label="Total Opening Balance" values={weekly.map((w) => w.balance - w.net)} />

            <tr className="dt-spacer">
              <td colSpan={totalWeeks + 1} />
            </tr>
            <tr className="dt-section-title">
              <td colSpan={totalWeeks + 1}>INFLOWS</td>
            </tr>
            {incomeLabels.length === 0 && (
              <tr className="dt-line">
                <td colSpan={totalWeeks + 1} style={{ color: "var(--inkFaint)" }}>
                  No income line items yet.
                </td>
              </tr>
            )}
            {incomeLabels.map((label) => (
              <EditableRow
                key={label}
                type="income"
                label={label}
                items={items}
                overrides={overrides}
                totalWeeks={totalWeeks}
                weekHeaders={weekHeaders}
                onEditOverride={onEditOverride}
              />
            ))}
            <ReadRow className="dt-total dt-income" label="TOTAL INFLOWS" values={weekly.map((w) => w.income)} />

            <tr className="dt-spacer">
              <td colSpan={totalWeeks + 1} />
            </tr>
            <tr className="dt-section-title">
              <td colSpan={totalWeeks + 1}>OUTFLOWS</td>
            </tr>
            {expenseLabels.length === 0 && (
              <tr className="dt-line">
                <td colSpan={totalWeeks + 1} style={{ color: "var(--inkFaint)" }}>
                  No expense line items yet.
                </td>
              </tr>
            )}
            {expenseLabels.map((label) => (
              <EditableRow
                key={label}
                type="expense"
                label={label}
                items={items}
                overrides={overrides}
                totalWeeks={totalWeeks}
                weekHeaders={weekHeaders}
                onEditOverride={onEditOverride}
              />
            ))}
            <ReadRow className="dt-total dt-expense" label="TOTAL OUTFLOWS" values={weekly.map((w) => w.expense)} />

            <tr className="dt-spacer">
              <td colSpan={totalWeeks + 1} />
            </tr>
            <ReadRow className="dt-net" label="NET CASH FLOW" values={weekly.map((w) => w.net)} />
            <ReadRow className="dt-balance" label="CLOSING CASH BALANCE" values={weekly.map((w) => w.balance)} />
          </tbody>
        </table>
      </div>
    </div>
  );
}
