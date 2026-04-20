/**
 * services/assistant-realtime/src/env.ts
 *
 * Runtime environment validation for the DO realtime service.
 * Validated at module load — throws before the HTTP server binds
 * if required variables are missing.
 *
 * Usage: import { realtimeEnv } from "./env" at the top of server.ts.
 */

const REQUIRED = ["UPSTREAM_ASSISTANT_URL"] as const;

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
        `Set these in the DO App Platform environment before deploying.`,
    );
  }
}

validate();

export const realtimeEnv = {
  UPSTREAM_ASSISTANT_URL: process.env.UPSTREAM_ASSISTANT_URL as string,
  HOST: process.env.ASSISTANT_REALTIME_HOST ?? process.env.HOST ?? "0.0.0.0",
  PORT: Number(process.env.ASSISTANT_REALTIME_PORT ?? process.env.PORT ?? "8080"),
  WS_PATH:
    process.env.ASSISTANT_REALTIME_PATH ?? "/api/assistant/realtime",
  HEALTH_PATH:
    process.env.ASSISTANT_REALTIME_HEALTH_PATH ?? "/healthz",
} as const;
