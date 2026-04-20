/**
 * src/lib/env.ts
 *
 * Runtime environment validation for the Next.js application.
 * Validated at module load — throws before any request is processed
 * if required variables are missing or empty.
 *
 * Usage: import "@/lib/env" at the top of any entry-point module
 * that requires validated env vars. The side-effect import is enough —
 * validate() runs once at module evaluation time.
 *
 * Export typed constants from this file instead of accessing
 * process.env directly in application code.
 */

// ── Required — crash immediately if missing ────────────────────────────────

const REQUIRED = [
  "OPENAI_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
] as const;

type RequiredKey = (typeof REQUIRED)[number];

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
        `Set these before starting the server.`,
    );
  }
}

// Runs at module evaluation — throws before any request handler executes.
validate();

// ── Typed exports — use these instead of process.env directly ──────────────

function required(key: RequiredKey): string {
  // Already validated above — cast is safe.
  return process.env[key] as string;
}

function optional(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

function optionalKey(key: string): string | undefined {
  const val = process.env[key]?.trim();
  return val || undefined;
}

// Required
export const OPENAI_API_KEY = required("OPENAI_API_KEY");
export const NEXT_PUBLIC_SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL");

// Supabase — supports two naming conventions
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.SUPABASE_URL?.trim() ||
  "";

export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE?.trim() ||
  "";

// OpenAI
export const OPENAI_MODEL = optional("OPENAI_MODEL", "gpt-4.1");
export const OPENAI_API_KEY_VOICE = optionalKey("OPENAI_API_KEY_VOICE");
export const OPENAI_API_KEY_SORA = optionalKey("OPENAI_API_KEY_SORA");

// Providers — optional, warn in logs if missing when needed
export const FAL_API_KEY = optionalKey("FAL_API_KEY");
export const RUNWAY_API_KEY = optionalKey("RUNWAY_API_KEY");
export const KLING_API_KEY = optionalKey("KLING_API_KEY");
export const ELEVENLABS_API_KEY = optionalKey("ELEVENLABS_API_KEY");
export const ANTHROPIC_API_KEY = optionalKey("ANTHROPIC_API_KEY");

// Workspace
export const STREAMS_PERSISTENT_WORKSPACE_ROOT = optionalKey(
  "STREAMS_PERSISTENT_WORKSPACE_ROOT",
);
export const STREAMS_BUILD_COMMAND = optional(
  "STREAMS_BUILD_COMMAND",
  "pnpm run build",
);
export const STREAMS_COMMAND_TIMEOUT_MS = Number(
  optional("STREAMS_COMMAND_TIMEOUT_MS", "120000"),
);
export const STREAMS_ALLOWED_COMMANDS = optional(
  "STREAMS_ALLOWED_COMMANDS",
  "pnpm,pnpm.cmd,npm,npm.cmd,node,node.exe,tsc,tsc.cmd,next,next.cmd",
);
