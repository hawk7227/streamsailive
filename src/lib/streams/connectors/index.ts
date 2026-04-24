/**
 * src/lib/streams/connectors/index.ts
 *
 * Phase 7 — Connector runtime auto-resolution.
 *
 * resolveConnector() is the single entry point for all connector usage.
 * Every runtime action that needs an external provider calls this.
 * It loads the account, decrypts credentials, and returns the provider client.
 *
 * Never returns raw credentials to callers.
 * Never logs credential values.
 * Validates account status before use.
 * Logs every action to connector_action_logs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptCredential, toSafeAccountInfo, type SafeAccountInfo } from "../credentials";
import { validateGitHubToken, type GitHubValidation } from "./github";
import { validateVercelToken, type VercelValidation } from "./vercel";
import {
  validateSupabaseCredentials,
  parseSupabaseCredentials,
  type SupabaseValidation,
  type SupabaseConnectorCredentials,
} from "./supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Provider = "github" | "vercel" | "supabase";

export interface ResolvedConnector {
  accountId:   string;
  provider:    Provider;
  // Decrypted token — server-side only, never serialised
  token:       string;
  // For Supabase, structured credentials
  supabaseCreds?: SupabaseConnectorCredentials;
  account:     SafeAccountInfo;
}

export interface ConnectorActionLogEntry {
  accountId:      string;
  workspaceId:    string;
  projectId?:     string | null;
  sessionId?:     string;
  provider:       Provider;
  actionName:     string;
  isDestructive:  boolean;
  target?:        string;
  success:        boolean;
  responseStatus?: number;
  errorMessage?:  string;
  initiatedBy?:   string;
}

// ── Resolve connector ─────────────────────────────────────────────────────────

export async function resolveConnector(
  admin: SupabaseClient,
  workspaceId: string,
  provider: Provider,
  projectId?: string | null,
): Promise<ResolvedConnector> {
  // Load account — project-scoped first, then workspace-level fallback
  const { data: rows, error } = await admin
    .from("connected_accounts")
    .select("id, provider, encrypted_credentials, status, provider_account_id, scopes, project_id, last_validated_at, validation_error, rotation_due_at, connected_at")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .in("status", ["active"])
    .limit(2);

  if (error) throw new Error(`Connector lookup failed: ${error.message}`);

  if (!rows || rows.length === 0) {
    throw new Error(
      `No active ${provider} connection found for this workspace. ` +
      `Connect via Settings → Connectors.`
    );
  }

  // Prefer project-scoped connection if available
  const row = (rows.find((r: Record<string, unknown>) => r.project_id === projectId) ?? rows[0]) as Record<string, unknown>;

  if (row.status !== "active") {
    throw new Error(
      `${provider} connection is ${row.status as string}. ` +
      `Reconnect via Settings → Connectors.`
    );
  }

  // Decrypt credentials — server-side only
  let token: string;
  let supabaseCreds: SupabaseConnectorCredentials | undefined;

  try {
    const decrypted = await decryptCredential(row.encrypted_credentials as string);

    if (provider === "supabase") {
      supabaseCreds = parseSupabaseCredentials(decrypted);
      // For Supabase, token = service role key for convenience
      token = supabaseCreds.serviceRoleKey;
    } else {
      token = decrypted;
    }
  } catch (err) {
    throw new Error(
      `Failed to decrypt ${provider} credentials: ${err instanceof Error ? err.message : "Unknown error"}`
    );
  }

  return {
    accountId:     row.id as string,
    provider,
    token,
    supabaseCreds,
    account:       toSafeAccountInfo(row),
  };
}

// ── Log connector action ──────────────────────────────────────────────────────

export async function logConnectorAction(
  admin: SupabaseClient,
  entry: ConnectorActionLogEntry,
): Promise<void> {
  await admin.from("connector_action_logs").insert({
    workspace_id:    entry.workspaceId,
    account_id:      entry.accountId,
    project_id:      entry.projectId ?? null,
    session_id:      entry.sessionId ?? null,
    provider:        entry.provider,
    action_name:     entry.actionName,
    is_destructive:  entry.isDestructive,
    target:          entry.target ?? null,
    success:         entry.success,
    response_status: entry.responseStatus ?? null,
    error_message:   entry.errorMessage ?? null,
    initiated_by:    entry.initiatedBy ?? null,
    initiated_at:    new Date().toISOString(),
    completed_at:    new Date().toISOString(),
  });
}

// ── Validate and refresh account ──────────────────────────────────────────────

export async function validateAndRefreshAccount(
  admin: SupabaseClient,
  workspaceId: string,
  provider: Provider,
): Promise<{
  valid: boolean;
  result: GitHubValidation | VercelValidation | SupabaseValidation;
}> {
  const connector = await resolveConnector(admin, workspaceId, provider);
  const now = new Date().toISOString();

  let result: GitHubValidation | VercelValidation | SupabaseValidation;

  switch (provider) {
    case "github":
      result = await validateGitHubToken(connector.token);
      break;
    case "vercel":
      result = await validateVercelToken(connector.token);
      break;
    case "supabase":
      result = await validateSupabaseCredentials(connector.supabaseCreds!);
      break;
  }

  // Update last_validated_at and status
  const newStatus = result.valid ? "active" : "invalid";
  await admin
    .from("connected_accounts")
    .update({
      status:            newStatus,
      last_validated_at: now,
      validation_error:  result.valid ? null : (result.error ?? "Validation failed"),
    })
    .eq("id", connector.accountId)
    .eq("workspace_id", workspaceId);

  return { valid: result.valid, result };
}

// ── List connected accounts (safe — no credentials) ───────────────────────────

export async function listConnectedAccounts(
  admin: SupabaseClient,
  workspaceId: string,
): Promise<SafeAccountInfo[]> {
  const { data, error } = await admin
    .from("connected_accounts")
    .select("id, provider, provider_account_id, scopes, status, project_id, last_validated_at, validation_error, rotation_due_at, connected_at")
    .eq("workspace_id", workspaceId)
    .neq("status", "revoked")
    .order("connected_at", { ascending: false });

  if (error) throw new Error(`List connectors failed: ${error.message}`);

  return (data ?? []).map((r: Record<string, unknown>) => toSafeAccountInfo(r));
}

// ── Revoke account ────────────────────────────────────────────────────────────

export async function revokeConnectedAccount(
  admin: SupabaseClient,
  workspaceId: string,
  accountId: string,
  revokedBy: string,
): Promise<void> {
  const { error } = await admin
    .from("connected_accounts")
    .update({
      status:       "revoked",
      revoked_by:   revokedBy,
      revoked_at:   new Date().toISOString(),
    })
    .eq("id", accountId)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(`Revoke failed: ${error.message}`);
}
