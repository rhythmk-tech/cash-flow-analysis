import * as Sentry from "@sentry/nextjs";

// Sentry.init() is a no-op when dsn is undefined, so this works with or without
// NEXT_PUBLIC_SENTRY_DSN set.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
