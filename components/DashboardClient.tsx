"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import AddItemForm, { NewItemPayload } from "./AddItemForm";
import ItemsList from "./ItemsList";
import ImportPanel from "./ImportPanel";
import DetailTable from "./DetailTable";
import WeeklyLedger from "./WeeklyLedger";
import TeamPanel from "./TeamPanel";
import TrajectoryChart from "./charts/TrajectoryChart";
import NetChart from "./charts/NetChart";
import FlowChart from "./charts/FlowChart";
import ScenarioChart from "./charts/ScenarioChart";
import {
  ItemType,
  LineItem,
  OverrideMap,
  computeScenario,
  computeTips,
  computeWeekly,
  formatDateOnly,
  money,
  overrideKey,
  parseDateOnly,
  weekDateRange,
} from "@/lib/forecast";

interface OverrideRecord {
  type: ItemType;
  label: string;
  week: number;
  value: number;
}

interface ActualRecord {
  week: number;
  balance: number;
}

interface Settings {
  companyName: string;
  startingBalance: number;
  totalWeeks: number;
  bearPct: number;
  bullPct: number;
  forecastStart: string;
  incomeRowOrder: string[];
  expenseRowOrder: string[];
}

type Tab = "overview" | "scenarios" | "ledger" | "detail" | "insights" | "team";

const TIP_ICONS = { warning: "⚠️", insight: "📊", success: "✅" };

function companyInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "CF";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function DashboardClient({
  initialItems,
  initialOverrides,
  initialActuals,
  initialSettings,
  canEdit,
  isPlatformAdmin,
}: {
  initialItems: LineItem[];
  initialOverrides: OverrideRecord[];
  initialActuals: ActualRecord[];
  initialSettings: Settings;
  canEdit: boolean;
  isPlatformAdmin: boolean;
}) {
  const [items, setItems] = useState<LineItem[]>(initialItems);
  const [overridesArr, setOverridesArr] = useState<OverrideRecord[]>(initialOverrides);
  const [actualsArr, setActualsArr] = useState<ActualRecord[]>(initialActuals);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const forecastStart = useMemo(() => parseDateOnly(settings.forecastStart), [settings.forecastStart]);
  const settingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const overridesMap: OverrideMap = useMemo(() => {
    const map: OverrideMap = {};
    overridesArr.forEach((o) => {
      map[overrideKey(o.type, o.label, o.week)] = o.value;
    });
    return map;
  }, [overridesArr]);

  const actualsMap: Record<number, number> = useMemo(() => {
    const map: Record<number, number> = {};
    actualsArr.forEach((a) => {
      map[a.week] = a.balance;
    });
    return map;
  }, [actualsArr]);

  const weekly = useMemo(
    () => computeWeekly(items, overridesMap, settings.startingBalance, settings.totalWeeks, forecastStart),
    [items, overridesMap, settings.startingBalance, settings.totalWeeks, forecastStart]
  );

  const bear = useMemo(
    () => computeScenario(items, overridesMap, settings.startingBalance, settings.totalWeeks, settings.bearPct, forecastStart),
    [items, overridesMap, settings.startingBalance, settings.totalWeeks, settings.bearPct, forecastStart]
  );
  const base = useMemo(
    () => computeScenario(items, overridesMap, settings.startingBalance, settings.totalWeeks, 0, forecastStart),
    [items, overridesMap, settings.startingBalance, settings.totalWeeks, forecastStart]
  );
  const bull = useMemo(
    () => computeScenario(items, overridesMap, settings.startingBalance, settings.totalWeeks, settings.bullPct, forecastStart),
    [items, overridesMap, settings.startingBalance, settings.totalWeeks, settings.bullPct, forecastStart]
  );

  const tips = useMemo(() => computeTips(weekly, settings.startingBalance), [weekly, settings.startingBalance]);

  const isEmpty = items.length === 0;
  const totalIncome = weekly.reduce((s, w) => s + w.income, 0);
  const totalExpense = weekly.reduce((s, w) => s + w.expense, 0);
  const endingBalance = weekly.length ? weekly[weekly.length - 1].balance : settings.startingBalance;
  const minWeek = weekly.reduce(
    (min, w) => (w.balance < min.balance ? w : min),
    weekly[0] || { balance: settings.startingBalance, week: 0 }
  );

  async function handleAddItem(payload: NewItemPayload) {
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const created = await res.json();
      setItems((prev) => [...prev, created]);
    }
  }

  async function handleDeleteItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (editingItemId === id) setEditingItemId(null);
    await fetch(`/api/items/${id}`, { method: "DELETE" });
  }

  async function handleSaveItem(id: string, payload: NewItemPayload) {
    const res = await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    }
  }

  function handleImported(newItems: LineItem[]) {
    setItems((prev) => [...prev, ...newItems]);
  }

  async function handleEditOverride(type: ItemType, label: string, week: number, value: number) {
    setOverridesArr((prev) => {
      const idx = prev.findIndex((o) => o.type === type && o.label === label && o.week === week);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], value };
        return copy;
      }
      return [...prev, { type, label, week, value }];
    });
    await fetch("/api/overrides", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, label, week, value }),
    });
  }

  async function handleEditActual(week: number, balance: number) {
    setActualsArr((prev) => {
      const idx = prev.findIndex((a) => a.week === week);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], balance };
        return copy;
      }
      return [...prev, { week, balance }];
    });
    await fetch("/api/actuals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week, balance }),
    });
  }

  function handleReorderRows(type: ItemType, order: string[]) {
    setSettings((prev) =>
      type === "income" ? { ...prev, incomeRowOrder: order } : { ...prev, expenseRowOrder: order }
    );
    fetch("/api/row-order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, order }),
    });
  }

  function handleForecastStartChange(dateStr: string) {
    setSettings((prev) => ({ ...prev, forecastStart: dateStr }));
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forecastStart: dateStr }),
    });
  }

  function saveSettingsDebounced(patch: Partial<Settings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
    if (settingsTimer.current) clearTimeout(settingsTimer.current);
    settingsTimer.current = setTimeout(() => {
      fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    }, 500);
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "📈 Overview" },
    { key: "scenarios", label: "🎯 Scenarios" },
    { key: "ledger", label: "📋 Weekly Ledger" },
    { key: "detail", label: "🧾 Detailed Forecast" },
    { key: "insights", label: "💡 Insights" },
    { key: "team", label: "👥 Team" },
  ];

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">{companyInitials(settings.companyName)}</div>
            <div className="brand-text">
              <h1>{settings.companyName} — Cash Flow</h1>
              <p>
                Weekly forecast starting{" "}
                {forecastStart.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })}
              </p>
            </div>
          </div>
          <div className="settings">
            <label className="pill">
              <span className="label">Starting balance</span>
              <input
                type="number"
                className="mono"
                defaultValue={settings.startingBalance}
                disabled={!canEdit}
                onChange={(e) => saveSettingsDebounced({ startingBalance: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="pill">
              <span className="label">Weeks</span>
              <input
                type="number"
                min={4}
                max={26}
                style={{ width: 44 }}
                defaultValue={settings.totalWeeks}
                disabled={!canEdit}
                onChange={(e) =>
                  saveSettingsDebounced({ totalWeeks: Math.min(26, Math.max(4, Number(e.target.value) || 12)) })
                }
              />
            </label>
            {isPlatformAdmin && (
              <Link href="/admin" className="link-btn">
                Admin
              </Link>
            )}
            <button className="signout-btn" onClick={() => signOut({ callbackUrl: "/" })}>
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="wrap">
        <div className="kpi-grid">
          <div className="kpi-card" style={{ ["--bar-color" as string]: "var(--income)" }}>
            <div className="kpi-top">
              <span className="kpi-label">Total income</span>
              <span className="kpi-icon" style={{ color: "var(--income)" }}>↑</span>
            </div>
            <div className="kpi-value" style={{ color: "var(--income)" }}>
              {money(totalIncome)}
              <span className="kpi-value-sub">(Weeks 1–{settings.totalWeeks})</span>
            </div>
          </div>
          <div className="kpi-card" style={{ ["--bar-color" as string]: "var(--expense)" }}>
            <div className="kpi-top">
              <span className="kpi-label">Total expenses</span>
              <span className="kpi-icon" style={{ color: "var(--expense)" }}>↓</span>
            </div>
            <div className="kpi-value" style={{ color: "var(--expense)" }}>{money(totalExpense)}</div>
          </div>
          <div className="kpi-card" style={{ ["--bar-color" as string]: "var(--ink)" }}>
            <div className="kpi-top">
              <span className="kpi-label">Ending balance</span>
              <span className="kpi-icon">◆</span>
            </div>
            <div className="kpi-value">
              {money(endingBalance)}
              <span className="kpi-value-sub">
                ({weekDateRange(weekly.length ? weekly[weekly.length - 1].week : settings.totalWeeks, forecastStart)})
              </span>
            </div>
          </div>
          <div
            className="kpi-card"
            style={{ ["--bar-color" as string]: minWeek.balance < 0 ? "var(--expense)" : "var(--gold)" }}
          >
            <div className="kpi-top">
              <span className="kpi-label">Lowest balance</span>
              <span className="kpi-icon" style={{ color: minWeek.balance < 0 ? "var(--expense)" : "var(--gold)" }}>▽</span>
            </div>
            <div className="kpi-value" style={{ color: minWeek.balance < 0 ? "var(--expense)" : "var(--gold)" }}>
              {money(minWeek.balance)}
              <span className="kpi-value-sub">({weekDateRange(minWeek.week, forecastStart)})</span>
            </div>
          </div>
        </div>

        <div className="layout">
          <div className="sidebar">
            {canEdit && (
              <AddItemForm
                items={items}
                onAdd={handleAddItem}
                editingItem={items.find((i) => i.id === editingItemId) || null}
                onSave={handleSaveItem}
                onCancelEdit={() => setEditingItemId(null)}
                forecastStart={forecastStart}
              />
            )}
            <div className="card">
              <ItemsList
                items={items}
                editingItemId={editingItemId}
                onEdit={(item) => setEditingItemId(item.id)}
                onDelete={handleDeleteItem}
                canEdit={canEdit}
              />
            </div>
            {canEdit && (
              <ImportPanel onImported={handleImported} autoOpen={isEmpty} forecastStart={forecastStart} />
            )}
          </div>

          <div className="main-col">
            {isEmpty ? (
              <div className="card onboarding-card">
                <h2 className="display">Let&apos;s set up {settings.companyName}&apos;s cash flow</h2>
                <span className="sub">
                  Your forecast is built entirely from the numbers you add — nothing here is
                  pre-filled, so charts and insights will appear as soon as you have at least
                  one income or expense item.
                </span>
                {canEdit ? (
                  <div className="onboarding-steps onboarding-steps-3">
                    <div className="onboarding-step">
                      <h3>➕ Add items one at a time</h3>
                      <p>
                        Use the &quot;Add a line item&quot; form on the left for individual income
                        sources or expenses — rent, payroll, recurring revenue, loan payments, and
                        so on.
                      </p>
                    </div>
                    <div className="onboarding-step">
                      <h3>📝 Start from a template</h3>
                      <p>
                        Don&apos;t have anything to upload yet? Download a starter spreadsheet with
                        the exact columns the forecast needs, fill in your real numbers, and upload
                        it back.
                      </p>
                      <a
                        className="link-btn"
                        style={{ marginTop: 6, display: "inline-block" }}
                        href={`/api/items/template?forecastStart=${encodeURIComponent(formatDateOnly(forecastStart))}`}
                        download="cash-flow-starter-template.xlsx"
                      >
                        ⬇ Download Excel template
                      </a>
                    </div>
                    <div className="onboarding-step">
                      <h3>📄 Import a file in bulk</h3>
                      <p>
                        Already have your income and expenses in a spreadsheet, bank export, or
                        PDF? Open &quot;Bulk import&quot; on the left and upload it directly to
                        populate everything at once.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="sub" style={{ marginTop: 4 }}>
                    You have view-only access — ask an Owner or Admin on this team to add income
                    and expense data.
                  </p>
                )}
              </div>
            ) : (
              <>
            <div className="tab-nav">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  className={`tab-btn${activeTab === t.key ? " active" : ""}`}
                  onClick={() => setActiveTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {activeTab === "overview" && (
              <div className="tab-panel active">
                <div className="charts-grid">
                  <div className="card span2">
                    <div className="card-head">
                      <h2>Cash Trajectory (Closing Balance)</h2>
                      <span className="sub">Running balance week over week</span>
                    </div>
                    <TrajectoryChart weekly={weekly} forecastStart={forecastStart} />
                  </div>
                  <div className="card">
                    <div className="card-head">
                      <h2>Weekly Inflows vs Outflows</h2>
                    </div>
                    <FlowChart weekly={weekly} forecastStart={forecastStart} />
                    <div className="legend">
                      <span className="legend-item">
                        <span className="legend-swatch" style={{ background: "var(--income)" }} />
                        Inflows
                      </span>
                      <span className="legend-item">
                        <span className="legend-swatch" style={{ background: "var(--expense)" }} />
                        Outflows
                      </span>
                    </div>
                  </div>
                  <div className="card">
                    <div className="card-head">
                      <h2>Balance & net change</h2>
                    </div>
                    <NetChart weekly={weekly} forecastStart={forecastStart} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "scenarios" && (
              <div className="tab-panel active">
                <div className="card">
                  <div className="card-head">
                    <h2>Scenario Comparison — Closing Balance</h2>
                  </div>
                  <div className="scenario-controls">
                    <span className="scenario-pill">
                      <strong style={{ color: "var(--expense)" }}>Bear</strong>
                      <input
                        type="number"
                        className="mono"
                        defaultValue={settings.bearPct}
                        disabled={!canEdit}
                        onChange={(e) => saveSettingsDebounced({ bearPct: Number(e.target.value) || 0 })}
                      />
                      % revenue
                    </span>
                    <span className="scenario-pill">
                      <strong style={{ color: "var(--ink)" }}>Base</strong> your current numbers
                    </span>
                    <span className="scenario-pill">
                      <strong style={{ color: "var(--income)" }}>Bull</strong>
                      <input
                        type="number"
                        className="mono"
                        defaultValue={settings.bullPct}
                        disabled={!canEdit}
                        onChange={(e) => saveSettingsDebounced({ bullPct: Number(e.target.value) || 0 })}
                      />
                      % revenue
                    </span>
                  </div>
                  <ScenarioChart bear={bear} base={base} bull={bull} forecastStart={forecastStart} />
                  <div className="legend">
                    <span className="legend-item">
                      <span className="legend-swatch" style={{ background: "var(--expense)" }} />
                      Bear ({settings.bearPct}% income)
                    </span>
                    <span className="legend-item">
                      <span className="legend-swatch" style={{ background: "var(--ink)" }} />
                      Base
                    </span>
                    <span className="legend-item">
                      <span className="legend-swatch" style={{ background: "var(--income)" }} />
                      Bull ({settings.bullPct > 0 ? "+" : ""}
                      {settings.bullPct}% income)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "ledger" && (
              <div className="tab-panel active">
                <WeeklyLedger
                  weekly={weekly}
                  actuals={actualsMap}
                  forecastStart={forecastStart}
                  companyName={settings.companyName}
                  canEdit={canEdit}
                  onEditActual={handleEditActual}
                />
              </div>
            )}

            {activeTab === "detail" && (
              <div className="tab-panel active">
                <DetailTable
                  items={items}
                  overrides={overridesMap}
                  weekly={weekly}
                  totalWeeks={settings.totalWeeks}
                  forecastStart={forecastStart}
                  startingBalance={settings.startingBalance}
                  onEditOverride={handleEditOverride}
                  onForecastStartChange={handleForecastStartChange}
                  onStartingBalanceChange={(v) => saveSettingsDebounced({ startingBalance: v })}
                  incomeOrder={settings.incomeRowOrder}
                  expenseOrder={settings.expenseRowOrder}
                  onReorder={handleReorderRows}
                  canEdit={canEdit}
                />
              </div>
            )}

            {activeTab === "insights" && (
              <div className="tab-panel active">
                <div className="card">
                  <div className="card-head">
                    <h2>Optimization tips</h2>
                  </div>
                  <div className="tips-grid">
                    {tips.length === 0 ? (
                      <p style={{ fontSize: 13, color: "var(--inkMuted)" }}>
                        Add income and expense line items to see tailored tips here.
                      </p>
                    ) : (
                      tips.map((tip, i) => (
                        <div className={`tip ${tip.type}`} key={i}>
                          <span className="tip-icon">{TIP_ICONS[tip.type]}</span>
                          <p>{tip.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "team" && (
              <div className="tab-panel active">
                <TeamPanel />
              </div>
            )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
