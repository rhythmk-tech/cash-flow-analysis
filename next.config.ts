import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // exceljs and pdfjs-dist do dynamic requires / worker & font-data loading that doesn't
  // survive being bundled through webpack/Turbopack — run them as plain Node deps instead.
  serverExternalPackages: ["exceljs", "pdfjs-dist"],
};

export default withSentryConfig(nextConfig, {
  // No org/project/authToken set — source map upload is skipped until those are configured.
  silent: true,
});
