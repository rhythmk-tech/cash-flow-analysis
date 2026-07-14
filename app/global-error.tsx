"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div style={{ textAlign: "center", maxWidth: 420 }}>
            <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ color: "var(--inkMuted)", marginBottom: 20 }}>
              We&apos;ve been notified and are looking into it.
            </p>
            <button className="add-btn" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
