"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data?.error || "Couldn't reset your password.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 1500);
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1 className="display">Choose a new password</h1>
        <p className="sub">Set a new password for your account.</p>
        {error && <div className="auth-error">{error}</div>}
        {done ? (
          <p className="sub" style={{ color: "var(--income)" }}>
            Password updated — taking you to log in…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="form-col">
            <div>
              <label className="field-label" htmlFor="password">New password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <button className="add-btn" type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}
        <div className="auth-footer">
          <Link href="/login">Back to log in</Link>
        </div>
      </div>
    </div>
  );
}
