"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";

export default function AcceptInviteClient({
  token,
  companyName,
}: {
  token: string;
  companyName: string;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/team/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setError(data?.error || "Couldn't accept this invite.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const nextParam = encodeURIComponent(`/invite/${token}`);

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1 className="display">Join {companyName}</h1>
        <p className="sub">
          You&apos;ve been invited to collaborate on {companyName}&apos;s cash flow forecast.
        </p>
        {error && <div className="auth-error">{error}</div>}
        {status === "loading" && <p className="sub">Loading…</p>}
        {status === "unauthenticated" && (
          <div className="form-col">
            <Link className="add-btn" href={`/login?next=${nextParam}`}>
              Log in to accept
            </Link>
            <Link className="cancel-btn" href={`/signup?next=${nextParam}`} style={{ textDecoration: "none", textAlign: "center" }}>
              Create an account to accept
            </Link>
          </div>
        )}
        {status === "authenticated" && (
          <div className="form-col">
            <p className="sub">Signed in as {session?.user?.email}.</p>
            <button className="add-btn" onClick={handleAccept} disabled={loading}>
              {loading ? "Joining…" : `Accept & join ${companyName}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
