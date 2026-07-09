"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  FREQ_LABELS,
  Frequency,
  ItemType,
  LineItem,
} from "@/lib/forecast";

const NEW_CATEGORY_VALUE = "__new__";

export interface NewItemPayload {
  type: ItemType;
  category: string;
  name: string;
  amount: number;
  frequency: Frequency;
  startWeek: number;
  lineLabel: string;
}

export default function AddItemForm({
  items,
  onAdd,
  editingItem,
  onSave,
  onCancelEdit,
}: {
  items: LineItem[];
  onAdd: (payload: NewItemPayload) => Promise<void>;
  editingItem?: LineItem | null;
  onSave?: (id: string, payload: NewItemPayload) => Promise<void>;
  onCancelEdit?: () => void;
}) {
  const [formType, setFormType] = useState<ItemType>("expense");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [startWeek, setStartWeek] = useState("1");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [submitting, setSubmitting] = useState(false);

  const isEditing = Boolean(editingItem);

  useEffect(() => {
    if (!editingItem) return;
    setFormType(editingItem.type);
    setName(editingItem.name);
    setCategory(editingItem.category);
    setNewCategory("");
    setAmount(String(editingItem.amount));
    setStartWeek(String(editingItem.startWeek));
    setFrequency(editingItem.frequency);
  }, [editingItem]);

  const categories = useMemo(() => {
    const base = formType === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    const fromItems = items.filter((i) => i.type === formType).map((i) => i.category);
    return Array.from(new Set([...base, ...fromItems]));
  }, [formType, items]);

  const selectedCategory = category || categories[0] || "";

  function resetForm() {
    setName("");
    setAmount("");
    setNewCategory("");
    setStartWeek("1");
    setFrequency("monthly");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let finalCategory = selectedCategory;
    if (finalCategory === NEW_CATEGORY_VALUE) {
      finalCategory = newCategory.trim();
      if (!finalCategory) return;
    }
    const amt = Number(amount);
    if (!name.trim() || !Number.isFinite(amt) || amt <= 0 || !finalCategory) return;

    const payload: NewItemPayload = {
      type: formType,
      category: finalCategory,
      name: name.trim(),
      amount: amt,
      frequency,
      startWeek: Math.max(1, Number(startWeek) || 1),
      lineLabel: finalCategory,
    };

    setSubmitting(true);
    if (isEditing && editingItem && onSave) {
      await onSave(editingItem.id, payload);
      setSubmitting(false);
      onCancelEdit?.();
      return;
    }
    await onAdd(payload);
    setSubmitting(false);
    setCategory(finalCategory);
    resetForm();
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>{isEditing ? "Edit line item" : "Add a line item"}</h2>
      </div>
      <div className="type-toggle">
        <button
          type="button"
          className={`type-btn${formType === "expense" ? " active-expense" : ""}`}
          onClick={() => {
            setFormType("expense");
            if (!isEditing) setCategory("");
          }}
          disabled={isEditing}
        >
          Expense
        </button>
        <button
          type="button"
          className={`type-btn${formType === "income" ? " active-income" : ""}`}
          onClick={() => {
            setFormType("income");
            if (!isEditing) setCategory("");
          }}
          disabled={isEditing}
        >
          Income
        </button>
      </div>
      <form className="form-col" onSubmit={handleSubmit}>
        <input
          placeholder="Name (e.g. Electricity bill)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select value={selectedCategory} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value={NEW_CATEGORY_VALUE}>+ New category / bucket…</option>
        </select>
        {selectedCategory === NEW_CATEGORY_VALUE && (
          <input
            placeholder="New category / bucket name"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
        )}
        <div className="row2">
          <input
            type="number"
            className="mono"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <input
            type="number"
            className="mono"
            placeholder="Start wk"
            min={1}
            style={{ width: 90 }}
            value={startWeek}
            onChange={(e) => setStartWeek(e.target.value)}
          />
        </div>
        <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
          {Object.entries(FREQ_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {isEditing ? (
          <div className="row2">
            <button className="add-btn" type="submit" disabled={submitting} style={{ flex: 1 }}>
              {submitting ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              className="cancel-btn"
              onClick={onCancelEdit}
              disabled={submitting}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button className="add-btn" type="submit" disabled={submitting}>
            + Add line item
          </button>
        )}
      </form>
    </div>
  );
}
