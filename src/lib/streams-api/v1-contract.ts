export const STREAMS_V1_CORE_ROUTES = [
  "/api/v1/auth",
  "/api/v1/projects",
  "/api/v1/conversations",
  "/api/v1/messages",
  "/api/v1/jobs",
  "/api/v1/job-events",
  "/api/v1/assets",
  "/api/v1/memory",
  "/api/v1/settings",
  "/api/v1/subscriptions",
  "/api/v1/entitlements",
  "/api/v1/usage",
] as const;

export const STREAMS_V1_BUILDER_ROUTES = [
  "/api/v1/builder/workspaces",
  "/api/v1/builder/repositories",
  "/api/v1/builder/files",
  "/api/v1/builder/drafts",
  "/api/v1/builder/patches",
  "/api/v1/builder/checkpoints",
  "/api/v1/builder/previews",
  "/api/v1/builder/verifications",
  "/api/v1/builder/approvals",
  "/api/v1/builder/repository-actions",
  "/api/v1/builder/pull-requests",
  "/api/v1/builder/events",
  "/api/v1/builder/element-mappings",
] as const;

export const STREAMS_V1_ROUTE_INVENTORY = [
  ...STREAMS_V1_CORE_ROUTES,
  ...STREAMS_V1_BUILDER_ROUTES,
] as const;

export type StreamsV1Route = typeof STREAMS_V1_ROUTE_INVENTORY[number];

export type StreamsV1ErrorEnvelope = {
  ok: false;
  apiVersion: "v1";
  error: string;
  code?: string;
  details?: unknown;
};

export type StreamsV1SuccessEnvelope<T extends Record<string, unknown> = Record<string, unknown>> = {
  ok: true;
  apiVersion: "v1";
} & T;

export type StreamsCursorPage<T> = {
  items: T[];
  nextCursor: string | number | null;
  hasMore?: boolean;
};

export function normalizePositiveLimit(value: unknown, fallback = 50, maximum = 200) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(maximum, Math.trunc(parsed)));
}

export function normalizeNonNegativeCursor(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

export function requireIdempotencyKey(value: unknown, maximum = 300) {
  const key = String(value || "").trim();
  if (!key) return null;
  return key.slice(0, maximum);
}
