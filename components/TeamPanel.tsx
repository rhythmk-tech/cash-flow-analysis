"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { X } from "lucide-react";
import {
  ASSIGNABLE_ROLES,
  EffectiveRole,
  MemberRole,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  canEditData,
  canRemoveMember,
} from "@/lib/roles";

interface Member {
  id: string;
  email: string;
  isOwner: boolean;
  role: EffectiveRole;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: MemberRole;
  token: string;
  createdAt: string;
  expiresAt: string;
}

interface TeamData {
  companyName: string;
  isOwner: boolean;
  myRole: EffectiveRole;
  canManageTeam: boolean;
  canChangeRoles: boolean;
  members: Member[];
  pendingInvitations: PendingInvitation[];
}

interface ActivityEntry {
  id: string;
  actorEmail: string;
  summary: string;
  createdAt: string;
}

interface QuickBooksStatus {
  enabled: boolean;
  connected: boolean;
  connectedAt?: string | null;
  lastSyncedAt?: string | null;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function TeamPanel({ quickbooksCallback }: { quickbooksCallback?: "connected" | "error" | null }) {
  const router = useRouter();
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("editor");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [lastInviteUrl, setLastInviteUrl] = useState("");
  const [lastInviteEmailSent, setLastInviteEmailSent] = useState(false);
  const [lastInviteEmail, setLastInviteEmail] = useState("");
  const [actionError, setActionError] = useState("");
  const [changingRoleFor, setChangingRoleFor] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [showDeletePanel, setShowDeletePanel] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [qbStatus, setQbStatus] = useState<QuickBooksStatus | null>(null);
  const [qbSyncing, setQbSyncing] = useState(false);
  const [qbDisconnecting, setQbDisconnecting] = useState(false);
  const [qbError, setQbError] = useState("");
  const [qbSyncResult, setQbSyncResult] = useState<{ imported: number; skipped: number } | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/team");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  async function loadActivity() {
    setLoadingActivity(true);
    const res = await fetch("/api/team/activity");
    if (res.ok) setActivity((await res.json()).entries);
    setLoadingActivity(false);
  }

  async function loadQuickBooksStatus() {
    const res = await fetch("/api/quickbooks/status");
    if (res.ok) setQbStatus(await res.json());
  }

  useEffect(() => {
    load();
    loadQuickBooksStatus();
  }, []);

  useEffect(() => {
    if (data?.canManageTeam) loadActivity();
  }, [data?.canManageTeam]);

  async function handleQuickBooksSync() {
    setQbError("");
    setQbSyncResult(null);
    setQbSyncing(true);
    const res = await fetch("/api/quickbooks/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const result = await res.json().catch(() => ({}));
    setQbSyncing(false);
    if (!res.ok) {
      setQbError(result?.error || "Couldn't sync with QuickBooks.");
      return;
    }
    setQbSyncResult({ imported: result.imported, skipped: result.skipped });
    loadQuickBooksStatus();
  }

  async function handleQuickBooksDisconnect() {
    if (!window.confirm("Disconnect QuickBooks? This won't remove any items already imported.")) return;
    setQbError("");
    setQbDisconnecting(true);
    const res = await fetch("/api/quickbooks/disconnect", { method: "POST" });
    setQbDisconnecting(false);
    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      setQbError(result?.error || "Couldn't disconnect QuickBooks.");
      return;
    }
    setQbSyncResult(null);
    loadQuickBooksStatus();
  }

  // Owner can invite as Admin/Editor/Viewer; an Admin can only invite as Editor/Viewer
  // (mirrors the server-side canAssignRole check — see lib/roles.ts).
  const assignableForInvite: MemberRole[] = data?.isOwner ? ASSIGNABLE_ROLES : ["editor", "viewer"];

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError("");
    setLastInviteUrl("");
    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: inviteRole }),
    });
    const result = await res.json().catch(() => ({}));
    setInviting(false);
    if (!res.ok) {
      setInviteError(result?.error || "Couldn't send that invite.");
      return;
    }
    setLastInviteEmail(email);
    setEmail("");
    setLastInviteUrl(result.inviteUrl);
    setLastInviteEmailSent(Boolean(result.emailSent));
    load();
    loadActivity();
  }

  async function handleRevoke(id: string) {
    setActionError("");
    const res = await fetch(`/api/team/invitations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      setActionError(result?.error || "Couldn't revoke that invite.");
      return;
    }
    load();
    loadActivity();
  }

  async function handleRemove(id: string) {
    setActionError("");
    const res = await fetch(`/api/team/members/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      setActionError(result?.error || "Couldn't remove that teammate.");
      return;
    }
    load();
    loadActivity();
  }

  async function handleRoleChange(id: string, role: MemberRole) {
    setActionError("");
    setChangingRoleFor(id);
    const res = await fetch(`/api/team/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setChangingRoleFor(null);
    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      setActionError(result?.error || "Couldn't change that teammate's role.");
      return;
    }
    load();
    loadActivity();
  }

  async function handleLeave() {
    setActionError("");
    const res = await fetch("/api/team/leave", { method: "POST" });
    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      setActionError(result?.error || "Couldn't leave this company.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError("");
    setDeleting(true);
    const res = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: deletePassword }),
    });
    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      setDeleting(false);
      setDeleteError(result?.error || "Couldn't delete your account.");
      return;
    }
    await signOut({ callbackUrl: "/" });
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API can be unavailable (e.g. non-HTTPS) — the link is still shown on screen to copy manually.
    }
  }

  if (loading || !data) {
    return (
      <div className="card">
        <div className="card-head">
          <h2>Team</h2>
        </div>
        <p className="sub">Loading…</p>
      </div>
    );
  }

  const teammateCount = data.members.length - 1;

  return (
    <div className="card">
      <div className="card-head">
        <h2>Team</h2>
        <span className="sub">Everyone here shares the same {data.companyName} forecast.</span>
      </div>

      {actionError && <div className="auth-error">{actionError}</div>}

      {data.canManageTeam && (
        <>
          <form className="form-col" onSubmit={handleInvite} style={{ marginBottom: 14 }}>
            <div className="row2">
              <input
                type="email"
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as MemberRole)} style={{ maxWidth: 130 }}>
                {assignableForInvite.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <p className="sub" style={{ margin: 0 }}>{ROLE_DESCRIPTIONS[inviteRole]}</p>
            <button className="add-btn" type="submit" disabled={inviting}>
              {inviting ? "Inviting…" : "Invite"}
            </button>
          </form>
          {inviteError && <p style={{ color: "var(--expense)", fontSize: 12.5, marginTop: -8, marginBottom: 12 }}>{inviteError}</p>}
          {lastInviteUrl && lastInviteEmailSent && (
            <div className="tip success" style={{ display: "block", marginBottom: 14 }}>
              <p style={{ fontWeight: 600 }}>Invite emailed to {lastInviteEmail}.</p>
            </div>
          )}
          {lastInviteUrl && !lastInviteEmailSent && (
            <div className="tip insight" style={{ display: "block", marginBottom: 14 }}>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>
                Invite created — we couldn&apos;t email it, share this link directly:
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <code style={{ fontSize: 11.5, wordBreak: "break-all" }}>{lastInviteUrl}</code>
                <button type="button" className="link-btn" onClick={() => copyLink(lastInviteUrl)}>
                  Copy
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {data.canManageTeam && data.pendingInvitations.length > 0 && (
        <div className="items-section">
          <div className="items-count">Pending invitations ({data.pendingInvitations.length})</div>
          <div className="items-list">
            {data.pendingInvitations.map((inv) => (
              <div className="item-row" key={inv.id}>
                <div className="item-left">
                  <span className="dot" style={{ background: "var(--gold)" }} />
                  <div>
                    <div className="item-name">{inv.email}</div>
                    <div className="item-meta">{ROLE_LABELS[inv.role]}</div>
                  </div>
                </div>
                <div className="item-right">
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => copyLink(`${window.location.origin}/invite/${inv.token}`)}
                  >
                    Copy link
                  </button>
                  <button className="del-btn" title="Revoke" onClick={() => handleRevoke(inv.id)}>
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="items-section">
        <div className="items-count">Members ({data.members.length})</div>
        <div className="items-list">
          {data.members.map((m) => {
            const canRemoveThis = !m.isOwner && data.canManageTeam && canRemoveMember(data.myRole, m.role);
            const canChangeThis = !m.isOwner && data.canChangeRoles;
            return (
              <div className="item-row" key={m.id}>
                <div className="item-left">
                  <span className="dot" style={{ background: "var(--income)" }} />
                  <div>
                    <div className="item-name">{m.email}</div>
                    {!canChangeThis && <div className="item-meta">{ROLE_LABELS[m.role]}</div>}
                  </div>
                </div>
                <div className="item-right">
                  {canChangeThis && (
                    <select
                      value={m.role}
                      disabled={changingRoleFor === m.id}
                      onChange={(e) => handleRoleChange(m.id, e.target.value as MemberRole)}
                      style={{ width: "auto", padding: "5px 8px", fontSize: 12.5 }}
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  )}
                  {canRemoveThis && (
                    <button className="del-btn" title="Remove" onClick={() => handleRemove(m.id)}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {qbStatus?.enabled && (
        <div className="items-section">
          <div className="items-count">QuickBooks</div>

          {quickbooksCallback === "connected" && (
            <div className="tip success" style={{ display: "block", marginBottom: 12 }}>
              <p style={{ fontWeight: 600 }}>QuickBooks connected.</p>
            </div>
          )}
          {quickbooksCallback === "error" && (
            <div className="tip warning" style={{ display: "block", marginBottom: 12 }}>
              <p style={{ fontWeight: 600 }}>Couldn&apos;t connect QuickBooks — try again.</p>
            </div>
          )}
          {qbError && <p style={{ color: "var(--expense)", fontSize: 12.5, marginBottom: 10 }}>{qbError}</p>}
          {qbSyncResult && (
            <div className="tip success" style={{ display: "block", marginBottom: 12 }}>
              <p style={{ fontWeight: 600 }}>
                Imported {qbSyncResult.imported} item{qbSyncResult.imported === 1 ? "" : "s"} from QuickBooks
                {qbSyncResult.skipped > 0
                  ? ` (${qbSyncResult.skipped} already imported or skipped)`
                  : ""}
                .
              </p>
            </div>
          )}

          {!qbStatus.connected ? (
            data.isOwner ? (
              <>
                <p className="sub" style={{ display: "block", marginBottom: 10 }}>
                  Pull recent income and expenses in directly from QuickBooks instead of entering them by hand.
                </p>
                <a className="add-btn" href="/api/quickbooks/connect" style={{ textDecoration: "none", textAlign: "center" }}>
                  Connect QuickBooks
                </a>
              </>
            ) : (
              <p className="sub">Only the account owner can connect QuickBooks.</p>
            )
          ) : (
            <>
              <div className="item-row">
                <div className="item-left">
                  <span className="dot" style={{ background: "var(--income)" }} />
                  <div>
                    <div className="item-name">Connected</div>
                    <div className="item-meta">
                      {qbStatus.lastSyncedAt ? `Last synced ${relativeTime(qbStatus.lastSyncedAt)}` : "Never synced yet"}
                    </div>
                  </div>
                </div>
              </div>
              <div className="row2" style={{ marginTop: 10 }}>
                {canEditData(data.myRole) && (
                  <button type="button" className="add-btn" onClick={handleQuickBooksSync} disabled={qbSyncing} style={{ flex: 1 }}>
                    {qbSyncing ? "Syncing…" : "Sync now"}
                  </button>
                )}
                {data.isOwner && (
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={handleQuickBooksDisconnect}
                    disabled={qbDisconnecting}
                    style={{ flex: 1 }}
                  >
                    {qbDisconnecting ? "Disconnecting…" : "Disconnect"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {data.canManageTeam && (
        <div className="items-section">
          <div className="items-count">Recent activity</div>
          {loadingActivity && !activity ? (
            <p className="sub">Loading…</p>
          ) : !activity || activity.length === 0 ? (
            <p className="sub">No activity yet.</p>
          ) : (
            <div className="items-list" style={{ maxHeight: 260 }}>
              {activity.map((entry) => (
                <div className="item-row" key={entry.id}>
                  <div className="item-left" style={{ minWidth: 0 }}>
                    <span className="dot" style={{ background: "var(--accent)" }} />
                    <div style={{ minWidth: 0 }}>
                      <div className="item-name" style={{ whiteSpace: "normal" }}>{entry.summary}</div>
                      <div className="item-meta">{entry.actorEmail} · {relativeTime(entry.createdAt)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!data.isOwner && (
        <button type="button" className="cancel-btn" onClick={handleLeave} style={{ marginTop: 4 }}>
          Leave {data.companyName}
        </button>
      )}

      <div className="danger-zone">
        {!showDeletePanel ? (
          <button type="button" className="danger-btn" onClick={() => setShowDeletePanel(true)}>
            Delete my account
          </button>
        ) : (
          <div className="danger-panel">
            {data.isOwner && teammateCount > 0 ? (
              <p>
                <strong>
                  You have {teammateCount} teammate{teammateCount === 1 ? "" : "s"}.
                </strong>{" "}
                Remove them from the team first — deleting your account also permanently deletes {data.companyName}&apos;s forecast data, so we don&apos;t let that happen while others still depend on it.
              </p>
            ) : (
              <form className="form-col" onSubmit={handleDeleteAccount}>
                <p>
                  {data.isOwner ? (
                    <>
                      This permanently deletes <strong>{data.companyName}</strong> and all of its
                      forecast data — line items, overrides, actuals, and activity history. This
                      can&apos;t be undone.
                    </>
                  ) : (
                    <>
                      This permanently deletes your account. You&apos;ll lose access to{" "}
                      {data.companyName}&apos;s data. This can&apos;t be undone.
                    </>
                  )}
                </p>
                <div>
                  <label className="field-label" htmlFor="deletePassword">
                    Confirm your password
                  </label>
                  <input
                    id="deletePassword"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="deleteConfirmText">
                    Type DELETE to confirm
                  </label>
                  <input
                    id="deleteConfirmText"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    required
                  />
                </div>
                {deleteError && <p style={{ color: "var(--expense)", fontWeight: 600 }}>{deleteError}</p>}
                <div className="row2">
                  <button
                    type="submit"
                    className="danger-btn"
                    disabled={deleting || deleteConfirmText !== "DELETE"}
                    style={{ flex: 1 }}
                  >
                    {deleting ? "Deleting…" : "Permanently delete my account"}
                  </button>
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => {
                      setShowDeletePanel(false);
                      setDeletePassword("");
                      setDeleteConfirmText("");
                      setDeleteError("");
                    }}
                    disabled={deleting}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
