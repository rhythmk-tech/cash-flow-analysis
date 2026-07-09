"use client";

import { FREQ_LABELS, LineItem, money } from "@/lib/forecast";

export default function ItemsList({
  items,
  editingItemId,
  onEdit,
  onDelete,
}: {
  items: LineItem[];
  editingItemId?: string | null;
  onEdit: (item: LineItem) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="items-section">
      <div className="items-count">Current items ({items.length})</div>
      <div className="items-list">
        {items.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--inkMuted)" }}>
            No items yet — add your first one above.
          </p>
        ) : (
          items.map((item) => (
            <div
              className={`item-row ${item.type}`}
              key={item.id}
              style={item.id === editingItemId ? { borderColor: "var(--accent)" } : undefined}
            >
              <div className="item-left">
                <span className="dot" />
                <div style={{ minWidth: 0 }}>
                  <div className="item-name">{item.name}</div>
                  <div className="item-meta">
                    {item.category} · {FREQ_LABELS[item.frequency]} · wk {item.startWeek}
                  </div>
                </div>
              </div>
              <div className="item-right">
                <span
                  className="mono"
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: item.type === "income" ? "var(--income)" : "var(--expense)",
                  }}
                >
                  {item.type === "income" ? "+" : "-"}
                  {money(item.amount).replace("-", "")}
                </span>
                <button className="del-btn" title="Edit" onClick={() => onEdit(item)}>
                  ✎
                </button>
                <button className="del-btn" title="Remove" onClick={() => onDelete(item.id)}>
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
