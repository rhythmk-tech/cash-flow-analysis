"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, ShieldCheck } from "lucide-react";
import { COLORS } from "@/lib/forecast";

interface Account {
  id: string;
  email: string;
  companyName: string;
  createdAt: string;
  itemCount: number;
  teamSize: number;
  lastActiveAt: string | null;
}

interface Stats {
  totalAccounts: number;
  totalUsers: number;
  onboardedAccounts: number;
  unonboardedAccounts: number;
  active7d: number;
  active30d: number;
  soloAccounts: number;
  teamAccounts: number;
  signupTrend: { date: string; count: number }[];
  accounts: Account[];
}

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function SignupTrend({ trend }: { trend: { date: string; count: number }[] }) {
  const W = 900, H = 140, padL = 10, padR = 10, padT = 10, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = trend.length || 1;
  const bw = plotW / n;
  const maxCount = Math.max(...trend.map((t) => t.count), 1);

  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Signups per day over the last 30 days">
      {trend.map((t, i) => {
        const barH = (t.count / maxCount) * plotH;
        const x = padL + i * bw;
        const showLabel = i === 0 || i === n - 1 || i % 5 === 0;
        return (
          <g key={t.date}>
            <rect
              x={x + bw * 0.15}
              y={padT + plotH - barH}
              width={bw * 0.7}
              height={Math.max(barH, t.count > 0 ? 2 : 0)}
              fill={COLORS.accent}
              rx={2}
            />
            {showLabel && (
              <text x={x + bw / 2} y={H - 6} fontSize={9} fill={COLORS.inkMuted} textAnchor="middle">
                {t.date.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function AdminClient({ adminEmail }: { adminEmail: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/stats");
    if (res.ok) {
      setStats(await res.json());
    } else {
      setError("Couldn't load admin stats.");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">
              <ShieldCheck size={18} />
            </div>
            <div className="brand-text">
              <h1>Usage analytics</h1>
              <p>Signed in as {adminEmail} — account-level only, no forecast data</p>
            </div>
          </div>
          <div className="settings">
            <Link href="/dashboard" className="link-btn">
              <ArrowLeft size={14} />
              Back to dashboard
            </Link>
            <button type="button" className="link-btn" onClick={load} disabled={loading}>
              <RefreshCw size={14} />
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <div className="wrap">
        {error && <div className="auth-error">{error}</div>}

        {!stats ? (
          <p className="sub">Loading…</p>
        ) : (
          <>
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-label">Total accounts</span>
                </div>
                <div className="kpi-value">{stats.totalAccounts}</div>
                <span className="kpi-value-sub">{stats.totalUsers} total users incl. teammates</span>
              </div>
              <div className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-label">Active — 7 days</span>
                </div>
                <div className="kpi-value">{stats.active7d}</div>
                <span className="kpi-value-sub">accounts with any activity</span>
              </div>
              <div className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-label">Active — 30 days</span>
                </div>
                <div className="kpi-value">{stats.active30d}</div>
                <span className="kpi-value-sub">accounts with any activity</span>
              </div>
              <div className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-label">Onboarded</span>
                </div>
                <div className="kpi-value">{stats.onboardedAccounts}</div>
                <span className="kpi-value-sub">
                  of {stats.totalAccounts} have added at least one item — {stats.unonboardedAccounts} signed up but never used it
                </span>
              </div>
            </div>

            <div className="card" style={{ marginTop: 20 }}>
              <div className="card-head">
                <h2>Signups — last 30 days</h2>
                <span className="sub">
                  {stats.soloAccounts} solo · {stats.teamAccounts} with a team
                </span>
              </div>
              <SignupTrend trend={stats.signupTrend} />
            </div>

            <div className="card" style={{ marginTop: 20 }}>
              <div className="card-head">
                <h2>Accounts ({stats.accounts.length})</h2>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Company</th>
                      <th style={{ textAlign: "left" }}>Email</th>
                      <th>Created</th>
                      <th>Items</th>
                      <th>Team size</th>
                      <th>Last active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.accounts.map((a) => (
                      <tr key={a.id}>
                        <td style={{ textAlign: "left" }}>{a.companyName}</td>
                        <td style={{ textAlign: "left" }} className="mono">
                          {a.email}
                        </td>
                        <td className="mono">{new Date(a.createdAt).toLocaleDateString()}</td>
                        <td className="mono">{a.itemCount}</td>
                        <td className="mono">{a.teamSize}</td>
                        <td className="mono">{relativeTime(a.lastActiveAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
