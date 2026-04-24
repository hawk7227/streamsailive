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
  typescript: { ignoreBuildErrors: true },
};

// eslint config is valid at runtime — cast to avoid type version mismatch
(nextConfig as Record<string, unknown>).eslint = { ignoreDuringBuilds: true };

export default nextConfig;
