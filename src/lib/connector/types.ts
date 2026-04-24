/**
 * src/lib/connector/types.ts
 *
 * TypeScript contracts for the STREAMS Connector Action Layer (Phase 7).
 *
 * Security invariants enforced by these types:
 * 1. DecryptedCredentials NEVER appears in API responses (server-only type)
 * 2. ConnectedAccount strips encrypted_credentials before returning to client
 * 3. ConnectorActionLog input_summary/output_summary are sanitised — no tokens
 */

// ── Provider and status enums ─────────────────────────────────────────────────

export type ConnectorProvider = "github" | "vercel" | "supabase";

export type ConnectorStatus =
  | "active"
  | "expired"
  | "revoked"
  | "invalid"
  | "pending";

export type ConnectorActionType =
  | "connect"
  | "validate"
  | "rotate"
  | "revoke"
  | "read"
  | "write"
  | "deploy"
  | "destructive";

// ── Connected account ─────────────────────────────────────────────────────────

/**
 * Safe public record — encrypted_credentials is excluded.
 * This is what API routes return to clients.
 */
export interface ConnectedAccount {
  id: string;
  workspace_id: string;
  user_id: string | null;

  provider: ConnectorProvider;
  provider_account_id: string | null;
  provider_account_name: string | null;
  provider_account_url: string | null;

  scopes: string[];
  status: ConnectorStatus;
  last_validated_at: string | null;
  validation_error: string | null;

  rotated_at: string | null;
  rotation_count: number;

  display_name: string | null;
  avatar_url: string | null;
  metadata: Record<string, unknown>;

  created_at: string;
  updated_at: string;
  // encrypted_credentials is deliberately absent
}

/**
 * Full DB record including the encrypted blob.
 * SERVER-ONLY — never sent to client.
 */
export interface ConnectedAccountFull extends ConnectedAccount {
  encrypted_credentials: string;
}

/**
 * Decrypted credentials — plaintext token.
 * SERVER-ONLY — lives in memory only during a single request.
 * Never persisted, never logged, never serialised.
 */
export interface DecryptedCredentials {
  token: string;
  refreshToken?: string;
  expiresAt?: string;
  extra?: Record<string, unknown>;
}

export interface CreateAccountInput {
  workspace_id: string;
  user_id?: string;
  provider: ConnectorProvider;
  provider_account_id?: string;
  provider_account_name?: string;
  provider_account_url?: string;
  scopes: string[];
  credentials: DecryptedCredentials;
  display_name?: string;
  avatar_url?: string;
  metadata?: Record<string, unknown>;
}

// ── Permission grants ─────────────────────────────────────────────────────────

export interface ConnectorPermissionGrant {
  id: string;
  account_id: string;
  project_id: string;
  workspace_id: string;
  granted_scopes: string[];
  allow_destructive: boolean;
  granted_by: string | null;
  granted_at: string;
  revoked_at: string | null;
}

export interface CreatePermissionGrantInput {
  account_id: string;
  project_id: string;
  workspace_id: string;
  granted_scopes: string[];
  allow_destructive?: boolean;
  granted_by?: string;
}

// ── Connector action logs ─────────────────────────────────────────────────────

export interface ConnectorActionLog {
  id: string;
  account_id: string | null;
  project_id: string | null;
  workspace_id: string;
  session_id: string | null;

  provider: ConnectorProvider;
  action_type: ConnectorActionType;
  operation: string;
  actor: string;

  resource_type: string | null;
  resource_ref: string | null;

  input_summary: Record<string, unknown>;

  outcome: "success" | "failure" | "blocked";
  error: string | null;
  output_summary: Record<string, unknown>;
  duration_ms: number | null;

  approval_gate_id: string | null;
  was_gated: boolean;
  gate_outcome: string | null;

  action_log_id: string | null;
  created_at: string;
}

export interface CreateConnectorLogInput {
  account_id?: string;
  project_id?: string;
  workspace_id: string;
  session_id?: string;
  provider: ConnectorProvider;
  action_type: ConnectorActionType;
  operation: string;
  actor?: string;
  resource_type?: string;
  resource_ref?: string;
  input_summary?: Record<string, unknown>;
  approval_gate_id?: string;
  was_gated?: boolean;
  action_log_id?: string;
}

// ── Provider-specific resolved types ─────────────────────────────────────────

export interface GitHubContext {
  accountId: string;
  token: string;
  repo: string;           // e.g. "hawk7227/streamsailive"
  branch: string;         // e.g. "main"
  apiBase: string;        // "https://api.github.com"
  scopes: string[];
}

export interface VercelContext {
  accountId: string;
  token: string;
  projectId: string;      // e.g. "prj_xxxx"
  teamId: string | null;  // null = personal account
  apiBase: string;        // "https://api.vercel.com"
  scopes: string[];
}

export interface SupabaseContext {
  accountId: string;
  token: string;          // service role key for this project
  projectRef: string;     // e.g. "xyzxyzxyz"
  projectUrl: string;     // e.g. "https://xyzxyzxyz.supabase.co"
  scopes: string[];
}

// ── Runtime resolution result ─────────────────────────────────────────────────

export interface ConnectorResolutionResult<T> {
  context: T | null;
  accountId: string | null;
  error: string | null;
}

// ── Required scopes per operation ─────────────────────────────────────────────

export const GITHUB_SCOPES = {
  read:        ["repo:read", "contents:read"],
  write:       ["repo", "contents:write"],
  push:        ["repo", "contents:write", "pull_requests:write"],
  deploy:      ["repo", "contents:write"],
  destructive: ["repo", "delete_repo"],
} as const;

export const VERCEL_SCOPES = {
  read:        ["deployments:read", "projects:read"],
  deploy:      ["deployments:write", "projects:read"],
  env_write:   ["projects:write"],
  destructive: ["deployments:delete", "projects:delete"],
} as const;

export const SUPABASE_SCOPES = {
  read:        ["database:read"],
  write:       ["database:write"],
  migrate:     ["database:write", "schema:write"],
  destructive: ["database:delete"],
} as const;

// ── Repository result ─────────────────────────────────────────────────────────

export type ConnectorResult<T> =
  | { data: T; error: null }
  | { data: null; error: { code: string; message: string; detail?: string } };

export function connOk<T>(data: T): ConnectorResult<T> {
  return { data, error: null };
}

export function connErr(code: string, message: string, detail?: string): ConnectorResult<never> {
  return { data: null, error: { code, message, detail } };
}
