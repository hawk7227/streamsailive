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
export const OPENAI_MINI_MODEL = optional("OPENAI_MINI_MODEL", "gpt-4o-mini");
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

// AI Providers — extended
export const OPENAI_API_KEY_IMAGES = optionalKey("OPENAI_API_KEY_IMAGES");
export const ANTHROPIC_API_KEY_EXPORT = optionalKey("ANTHROPIC_API_KEY"); // alias re-export
export const GOOGLE_API_KEY = optionalKey("GOOGLE_API_KEY");
export const GOOGLE_PROJECT_ID = optionalKey("GOOGLE_PROJECT_ID");
export const SUNO_API_KEY = optionalKey("SUNO_API_KEY");
export const UDIO_API_KEY = optionalKey("UDIO_API_KEY");
export const VOCAL_EXTRACTOR_URL = optionalKey("VOCAL_EXTRACTOR_URL");
export const KLING_ASSESS_API_KEY = optionalKey("KLING_ASSESS_API_KEY");

// Video
export const VIDEO_PROVIDER = optionalKey("VIDEO_PROVIDER");
export const VIDEO_MAX_SECONDS = optionalKey("VIDEO_MAX_SECONDS");

// Email / SMS
export const SMTP_HOST = optionalKey("SMTP_HOST");

// Stripe
export const STRIPE_SECRET_KEY = optionalKey("STRIPE_SECRET_KEY");
export const STRIPE_WEBHOOK_SECRET = optionalKey("STRIPE_WEBHOOK_SECRET");
export const STRIPE_PRICE_STARTER_MONTHLY = optionalKey("STRIPE_PRICE_STARTER_MONTHLY");
export const STRIPE_PRICE_STARTER_YEARLY = optionalKey("STRIPE_PRICE_STARTER_YEARLY");
export const STRIPE_PRICE_PROFESSIONAL_MONTHLY = optionalKey("STRIPE_PRICE_PROFESSIONAL_MONTHLY");
export const STRIPE_PRICE_PROFESSIONAL_YEARLY = optionalKey("STRIPE_PRICE_PROFESSIONAL_YEARLY");

// Ops
export const ADMIN_SECRET_KEY = optionalKey("ADMIN_SECRET_KEY");
export const CRON_SECRET = optionalKey("CRON_SECRET");
export const UPSTREAM_ASSISTANT_URL = optionalKey("UPSTREAM_ASSISTANT_URL");
export const STREAMS_TOOL_TIMEOUT_MS = optionalKey("STREAMS_TOOL_TIMEOUT_MS");

// Vercel
export const VERCEL_TOKEN = optionalKey("VERCEL_TOKEN");
export const VERCEL_PROJECT_ID = optionalKey("VERCEL_PROJECT_ID");
export const VERCEL_EDITOR_PROJECT_ID = optionalKey("VERCEL_EDITOR_PROJECT_ID");

// Adobe
export const ADOBE_CLIENT_ID = optionalKey("ADOBE_CLIENT_ID");
export const ADOBE_CLIENT_SECRET = optionalKey("ADOBE_CLIENT_SECRET");
export const ADOBE_ORG_ID = optionalKey("ADOBE_ORG_ID");
export const ADOBE_FIREFLY_API_KEY = optionalKey("ADOBE_FIREFLY_API_KEY");
export const ADOBE_EXPRESS_CLIENT_ID = optionalKey("ADOBE_EXPRESS_CLIENT_ID");

// AI provider selection
export const AI_PROVIDER_SCRIPT = optionalKey("AI_PROVIDER_SCRIPT");
export const AI_PROVIDER_IMAGE = optionalKey("AI_PROVIDER_IMAGE");
export const AI_PROVIDER_VIDEO = optionalKey("AI_PROVIDER_VIDEO");
export const AI_PROVIDER_VOICE = optionalKey("AI_PROVIDER_VOICE");
export const AI_PROVIDER_I2V = optionalKey("AI_PROVIDER_I2V");

// Image generation config
export const OPENAI_IMAGE_MODEL = optional("OPENAI_IMAGE_MODEL", "gpt-image-1");
export const OPENAI_API_BASE_URL = optionalKey("OPENAI_API_BASE_URL");
export const IMAGE_MODEL = optional("IMAGE_MODEL", "gpt-image-1");
export const IMAGE_QUALITY = optional("IMAGE_QUALITY", "medium");
export const IMAGE_CANDIDATES = optional("IMAGE_CANDIDATES", "4");
export const IMAGE_MAX_ATTEMPTS = optional("IMAGE_MAX_ATTEMPTS", "3");

// SMTP
export const SMTP_SECURE = optionalKey("SMTP_SECURE");
export const SMTP_USER = optionalKey("SMTP_USER");
export const SMTP_PASS = optionalKey("SMTP_PASS");
export const SMTP_FROM = optionalKey("SMTP_FROM");

// SMS — ClickSend
export const CLICKSEND_USERNAME = optionalKey("CLICKSEND_USERNAME");
export const CLICKSEND_PASSWORD = optionalKey("CLICKSEND_PASSWORD");
export const CLICKSEND_API_KEY = optionalKey("CLICKSEND_API_KEY");
export const CLICKSEND_FROM_NUMBER = optionalKey("CLICKSEND_FROM_NUMBER");
export const CLICKSEND_SENDER_ID = optionalKey("CLICKSEND_SENDER_ID");

// Voice
export const ELEVENLABS_VOICE_ID = optionalKey("ELEVENLABS_VOICE_ID");

// External integrations
export const JSON2VIDEO_API_KEY = optionalKey("JSON2VIDEO_API_KEY");
export const RESEND_API_KEY = optionalKey("RESEND_API_KEY");
export const KLING_ACCESS_KEY = optionalKey("KLING_ACCESS_KEY");
export const KLING_SECRET_KEY = optionalKey("KLING_SECRET_KEY");
export const FAL_KEY = optionalKey("FAL_KEY");

// Infra / ops
export const GITHUB_TOKEN = optionalKey("GITHUB_TOKEN");
export const DO_API_TOKEN = optionalKey("DO_API_TOKEN");
export const DO_APP_ID = optionalKey("DO_APP_ID");
export const ADMIN_SECRET = optionalKey("ADMIN_SECRET");
