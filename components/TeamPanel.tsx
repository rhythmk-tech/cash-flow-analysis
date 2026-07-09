"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Member {
  id: string;
  email: string;
  isOwner: boolean;
}

interface PendingInvitation {
  id: string;
  email: string;
  token: string;
  createdAt: string;
  expiresAt: string;
}

interface TeamData {
  companyName: string;
  isOwner: boolean;
  members: Member[];
  pendingInvitations: PendingInvitation[];
}

export default function TeamPanel() {
  const router = useRouter();
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [lastInviteUrl, setLastInviteUrl] = useState("");
  const [actionError, setActionError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/team");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError("");
    setLastInviteUrl("");
    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const result = await res.json().catch(() => ({}));
    setInviting(false);
    if (!res.ok) {
      setInviteError(result?.error || "Couldn't send that invite.");
      return;
    }
    setEmail("");
    setLastInviteUrl(result.inviteUrl);
    load();
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

  return (
    <div className="card">
      <div className="card-head">
        <h2>Team</h2>
        <span className="sub">Everyone here shares the same {data.companyName} forecast.</span>
      </div>

      {actionError && <div className="auth-error">{actionError}</div>}

      {data.isOwner && (
        <>
          <form className="row2" onSubmit={handleInvite} style={{ marginBottom: 14 }}>
            <input
              type="email"
              placeholder="teammate@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button className="add-btn" type="submit" disabled={inviting} style={{ flexShrink: 0, padding: "0 18px" }}>
              {inviting ? "Inviting…" : "Invite"}
            </button>
          </form>
          {inviteError && <p style={{ color: "var(--expense)", fontSize: 12.5, marginTop: -8, marginBottom: 12 }}>{inviteError}</p>}
          {lastInviteUrl && (
            <div className="tip insight" style={{ display: "block", marginBottom: 14 }}>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>
                Invite created — no email was sent, share this link directly:
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

      {data.isOwner && data.pendingInvitations.length > 0 && (
        <div className="items-section">
          <div className="items-count">Pending invitations ({data.pendingInvitations.length})</div>
          <div className="items-list">
            {data.pendingInvitations.map((inv) => (
              <div className="item-row" key={inv.id}>
                <div className="item-left">
                  <span className="dot" style={{ background: "var(--gold)" }} />
                  <div className="item-name">{inv.email}</div>
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
                    ✕
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
          {data.members.map((m) => (
            <div className="item-row" key={m.id}>
              <div className="item-left">
                <span className="dot" style={{ background: "var(--income)" }} />
                <div>
                  <div className="item-name">{m.email}</div>
                  <div className="item-meta">{m.isOwner ? "Owner" : "Member"}</div>
                </div>
              </div>
              <div className="item-right">
                {data.isOwner && !m.isOwner && (
                  <button className="del-btn" title="Remove" onClick={() => handleRemove(m.id)}>
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!data.isOwner && (
        <button type="button" className="cancel-btn" onClick={handleLeave} style={{ marginTop: 4 }}>
          Leave {data.companyName}
        </button>
      )}
    </div>
  );
}
