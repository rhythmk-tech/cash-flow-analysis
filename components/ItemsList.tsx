"use client";

import { Inbox, Pencil, X } from "lucide-react";
import { FREQ_LABELS, LineItem, parseDateOnly, money } from "@/lib/forecast";

export default function ItemsList({
  items,
  editingItemId,
  onEdit,
  onDelete,
  canEdit = true,
}: {
  items: LineItem[];
  editingItemId?: string | null;
  onEdit: (item: LineItem) => void;
  onDelete: (id: string) => void;
  canEdit?: boolean;
}) {
  return (
    <div className="items-section">
      <div className="items-count">Current items ({items.length})</div>
      <div className="items-list">
        {items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "22px 8px", color: "var(--inkFaint)" }}>
            <Inbox size={22} style={{ display: "block", margin: "0 auto 8px" }} />
            <p style={{ fontSize: 13, margin: 0 }}>No items yet — add your first one above.</p>
          </div>
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
                    {item.category !== item.name ? `${item.category} · ` : ""}
                    {FREQ_LABELS[item.frequency]} · starts{" "}
                    {parseDateOnly(item.startDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
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
                {canEdit && (
                  <>
                    <button className="del-btn" title="Edit" onClick={() => onEdit(item)}>
                      <Pencil size={14} />
                    </button>
                    <button className="del-btn" title="Remove" onClick={() => onDelete(item.id)}>
                      <X size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
