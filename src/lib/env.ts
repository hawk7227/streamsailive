/**
 * src/lib/env.ts
 *
 * Runtime environment validation for the Next.js (Vercel) deployment.
 * Validated on first import — throws before any request is served if
 * required variables are missing. Never silent. Never partial.
 *
 * Usage: import { env } from "@/lib/env" at the top of any server module
 * that needs these values. Do NOT access process.env directly in core paths.
 */

// ── Required vars ─────────────────────────────────────────────────────────
// These must be present. Missing any → hard throw at boot.

const REQUIRED = [
  "OPENAI_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

// ── Required in server-side paths only ───────────────────────────────────
// Supabase admin client needs the service role key. At least one form must
// be present. Validated lazily below.

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE;

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

// ── Validate required vars ────────────────────────────────────────────────

function validate(): void {
  const missing: string[] = [];

  for (const key of REQUIRED) {
    if (!process.env[key]?.trim()) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required environment variables:\n  ${missing.join("\n  ")}\n` +
        `Set these in your deployment environment before starting the server.`,
    );
  }
}

validate();

// ── Exported env object — typed, non-nullable ─────────────────────────────
// Access values from here, not from process.env directly in core paths.

export const env = {
  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY as string,
  OPENAI_MODEL: process.env.OPENAI_MODEL?.trim() || "gpt-4.1",

  // Supabase (public — safe for client + server)
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env
    .NEXT_PUBLIC_SUPABASE_ANON_KEY as string,

  // Supabase (server-only)
  SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_ROLE_KEY ?? "",
  SUPABASE_URL: SUPABASE_URL as string,

  // fal.ai (optional — only required when video generation is called)
  FAL_API_KEY: process.env.FAL_API_KEY ?? "",

  // Workspace (optional — defaults apply)
  STREAMS_PERSISTENT_WORKSPACE_ROOT:
    process.env.STREAMS_PERSISTENT_WORKSPACE_ROOT ?? "",
  STREAMS_ALLOWED_COMMANDS:
    process.env.STREAMS_ALLOWED_COMMANDS ??
    "pnpm,pnpm.cmd,npm,npm.cmd,node,node.exe,tsc,tsc.cmd,next,next.cmd",
  STREAMS_COMMAND_TIMEOUT_MS: Number(
    process.env.STREAMS_COMMAND_TIMEOUT_MS ?? "120000",
  ),
  STREAMS_BUILD_COMMAND:
    process.env.STREAMS_BUILD_COMMAND?.trim() || "pnpm run build",
} as const;

// ── Guard: supabase service role ──────────────────────────────────────────
// Called lazily by any server-side path that needs admin access.
// Not in the boot-time required set because client-side paths don't need it.

export function requireSupabaseServiceRole(): string {
  if (!SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    throw new Error(
      "[env] SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE) is required " +
        "for server-side Supabase admin access. Set it in your deployment environment.",
    );
  }
  return SUPABASE_SERVICE_ROLE_KEY;
}

// ── Guard: fal.ai ─────────────────────────────────────────────────────────
// Called lazily by video generation paths only.

export function requireFalApiKey(): string {
  if (!env.FAL_API_KEY.trim()) {
    throw new Error(
      "[env] FAL_API_KEY is required for video generation. " +
        "Set it in your deployment environment.",
    );
  }
  return env.FAL_API_KEY;
}
