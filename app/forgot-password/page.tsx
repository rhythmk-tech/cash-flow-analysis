"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resetUrl, setResetUrl] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    setSubmitted(true);
    setEmailSent(Boolean(data?.emailSent));
    if (data?.resetUrl) setResetUrl(data.resetUrl);
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1 className="display">Reset your password</h1>
        <p className="sub">Enter the email on your account and we&apos;ll help you get back in.</p>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="form-col">
            <div>
              <label className="field-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <button className="add-btn" type="submit" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        ) : emailSent ? (
          <div className="tip success" style={{ display: "block" }}>
            <p style={{ fontWeight: 600 }}>Check your email</p>
            <p>If an account exists for that email, a reset link is on its way.</p>
          </div>
        ) : (
          <div className="tip insight" style={{ display: "block" }}>
            <p style={{ fontWeight: 600, marginBottom: 6 }}>
              If an account exists for that email, a reset link was created.
            </p>
            {resetUrl ? (
              <>
                <p style={{ marginBottom: 6 }}>
                  We couldn&apos;t email it right now, so here&apos;s the link directly:
                </p>
                <code style={{ fontSize: 11.5, wordBreak: "break-all" }}>{resetUrl}</code>
              </>
            ) : (
              <p>Check the server logs for the reset link.</p>
            )}
          </div>
        )}

        <div className="auth-footer">
          <Link href="/login">Back to log in</Link>
        </div>
      </div>
    </div>
  );
}
