import type { NextConfig } from "next";

// ── Build-time env validation ──────────────────────────────────────────────
// Runs during `next build` and `next start`.
// Crashes immediately if required vars are missing.
const REQUIRED_ENV = [
  "OPENAI_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
] as const;

const missing = REQUIRED_ENV.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  throw new Error(
    `[next.config] Missing required environment variables:\n  ${missing.join("\n  ")}\n` +
      `Set these before running next build or next start.`,
  );
}

const nextConfig: NextConfig = {
  // TypeScript errors are fixed, not ignored
  // ESLint config removed - Next.js 16 no longer supports it
};

export default nextConfig;
