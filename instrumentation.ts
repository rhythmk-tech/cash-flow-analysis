import * as Sentry from "@sentry/nextjs";

// Sentry.init() is a no-op when dsn is undefined, so this works with or without SENTRY_DSN set.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
