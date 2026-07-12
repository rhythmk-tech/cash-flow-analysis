import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // exceljs and pdfjs-dist do dynamic requires / worker & font-data loading that doesn't
  // survive being bundled through webpack/Turbopack — run them as plain Node deps instead.
  serverExternalPackages: ["exceljs", "pdfjs-dist"],
};

export default nextConfig;
