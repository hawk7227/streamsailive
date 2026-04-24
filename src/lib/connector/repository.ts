/**
 * src/lib/connector/repository.ts
 *
 * Database access layer for the Connector Action Layer.
 *
 * SECURITY RULES:
 * 1. getAccount() returns ConnectedAccount (NO encrypted_credentials)
 * 2. getAccountWithCredentials() returns ConnectedAccountFull — SERVER-ONLY
 * 3. connector_action_logs are append-only — no update/delete
 * 4. encrypted_credentials is never selected in list queries
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { encryptCredentials, rotateCredentials } from "./encryption";
import type {
  ConnectedAccount,
  ConnectedAccountFull,
  ConnectorPermissionGrant,
  ConnectorActionLog,
  CreateAccountInput,
  CreatePermissionGrantInput,
  CreateConnectorLogInput,
  ConnectorStatus,
  ConnectorResult,
} from "./types";
import { connOk, connErr } from "./types";

// ── Safe account select (no credentials) ─────────────────────────────────────

const SAFE_FIELDS = [
  "id", "workspace_id", "user_id",
  "provider", "provider_account_id", "provider_account_name", "provider_account_url",
  "scopes", "status", "last_validated_at", "validation_error",
  "rotated_at", "rotation_count",
  "display_name", "avatar_url", "metadata",
  "created_at", "updated_at",
].join(", ");

// ── Connected Accounts ────────────────────────────────────────────────────────

export async function createConnectedAccount(
  input: CreateAccountInput
): Promise<ConnectorResult<ConnectedAccount>> {
  try {
    const db = createAdminClient();
    const encrypted = encryptCredentials(input.credentials);

    const { data, error } = await db
      .from("connected_accounts")
      .insert({
        workspace_id: input.workspace_id,
        user_id: input.user_id ?? null,
        provider: input.provider,
        provider_account_id: input.provider_account_id ?? null,
        provider_account_name: input.provider_account_name ?? null,
        provider_account_url: input.provider_account_url ?? null,
        scopes: input.scopes,
        encrypted_credentials: encrypted,
        status: "active",
        last_validated_at: new Date().toISOString(),
        display_name: input.display_name ?? null,
        avatar_url: input.avatar_url ?? null,
        metadata: input.metadata ?? {},
      })
      .select(SAFE_FIELDS)
      .single();

    if (error) return connErr("DB_ERROR", error.message, error.code);
    return connOk(data as unknown as ConnectedAccount);
  } catch (err) {
    return connErr("UNEXPECTED", String(err));
  }
}

/**
 * Get account WITHOUT credentials — safe for returning to client.
 */
export async function getAccount(
  accountId: string
): Promise<ConnectorResult<ConnectedAccount>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("connected_accounts")
      .select(SAFE_FIELDS)
      .eq("id", accountId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return connErr("NOT_FOUND", `Account ${accountId} not found`);
      return connErr("DB_ERROR", error.message);
    }
    return connOk(data as unknown as ConnectedAccount);
  } catch (err) {
    return connErr("UNEXPECTED", String(err));
  }
}

/**
 * Get account WITH encrypted credentials — SERVER-ONLY.
 * Call this only inside server-side connector operations.
 * NEVER return the result of this function to a client.
 */
export async function getAccountWithCredentials(
  accountId: string
): Promise<ConnectorResult<ConnectedAccountFull>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("connected_accounts")
      .select("*, encrypted_credentials")
      .eq("id", accountId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return connErr("NOT_FOUND", `Account ${accountId} not found`);
      return connErr("DB_ERROR", error.message);
    }
    if (data.status === "revoked") {
      return connErr("REVOKED", "This account connection has been revoked.");
    }
    return connOk(data as unknown as ConnectedAccountFull);
  } catch (err) {
    return connErr("UNEXPECTED", String(err));
  }
}

/**
 * Get active account by workspace + provider — for auto-resolution.
 * SERVER-ONLY — returns full record with encrypted credentials.
 */
export async function getActiveAccountForProvider(
  workspaceId: string,
  provider: string
): Promise<ConnectorResult<ConnectedAccountFull | null>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("connected_accounts")
      .select("*, encrypted_credentials")
      .eq("workspace_id", workspaceId)
      .eq("provider", provider)
      .eq("status", "active")
      .order("last_validated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return connErr("DB_ERROR", error.message);
    return connOk(data as ConnectedAccountFull | null);
  } catch (err) {
    return connErr("UNEXPECTED", String(err));
  }
}

export async function listAccountsForWorkspace(
  workspaceId: string
): Promise<ConnectorResult<ConnectedAccount[]>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("connected_accounts")
      .select(SAFE_FIELDS)
      .eq("workspace_id", workspaceId)
      .neq("status", "revoked")
      .order("created_at", { ascending: false });

    if (error) return connErr("DB_ERROR", error.message);
    return connOk((data ?? []) as unknown as ConnectedAccount[]);
  } catch (err) {
    return connErr("UNEXPECTED", String(err));
  }
}

export async function updateAccountStatus(
  accountId: string,
  status: ConnectorStatus,
  validationError?: string
): Promise<ConnectorResult<ConnectedAccount>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("connected_accounts")
      .update({
        status,
        last_validated_at: status === "active" ? new Date().toISOString() : undefined,
        validation_error: validationError ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId)
      .select(SAFE_FIELDS)
      .single();

    if (error) return connErr("DB_ERROR", error.message);
    return connOk(data as unknown as ConnectedAccount);
  } catch (err) {
    return connErr("UNEXPECTED", String(err));
  }
}

export async function revokeAccount(
  accountId: string
): Promise<ConnectorResult<ConnectedAccount>> {
  try {
    const db = createAdminClient();

    // Revoke permission grants
    await db
      .from("connector_permission_grants")
      .update({ revoked_at: new Date().toISOString() })
      .eq("account_id", accountId)
      .is("revoked_at", null);

    // Update account status
    const { data, error } = await db
      .from("connected_accounts")
      .update({
        status: "revoked",
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId)
      .select(SAFE_FIELDS)
      .single();

    if (error) return connErr("DB_ERROR", error.message);
    return connOk(data as unknown as ConnectedAccount);
  } catch (err) {
    return connErr("UNEXPECTED", String(err));
  }
}

/**
 * Rotate credentials — re-encrypt with fresh IV.
 * The plaintext token is unchanged; only the stored blob changes.
 */
export async function rotateAccountCredentials(
  accountId: string
): Promise<ConnectorResult<ConnectedAccount>> {
  try {
    const db = createAdminClient();

    // Get current encrypted credentials
    const { data: current, error: fetchErr } = await db
      .from("connected_accounts")
      .select("encrypted_credentials, rotation_count")
      .eq("id", accountId)
      .single();

    if (fetchErr || !current) return connErr("NOT_FOUND", `Account ${accountId} not found`);

    // Re-encrypt with fresh IV
    const rotated = rotateCredentials(current.encrypted_credentials);

    const { data, error } = await db
      .from("connected_accounts")
      .update({
        encrypted_credentials: rotated,
        rotated_at: new Date().toISOString(),
        rotation_count: (current.rotation_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId)
      .select(SAFE_FIELDS)
      .single();

    if (error) return connErr("DB_ERROR", error.message);
    return connOk(data as unknown as ConnectedAccount);
  } catch (err) {
    return connErr("UNEXPECTED", String(err));
  }
}

// ── Permission Grants ─────────────────────────────────────────────────────────

export async function grantProjectAccess(
  input: CreatePermissionGrantInput
): Promise<ConnectorResult<ConnectorPermissionGrant>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("connector_permission_grants")
      .upsert({
        account_id: input.account_id,
        project_id: input.project_id,
        workspace_id: input.workspace_id,
        granted_scopes: input.granted_scopes,
        allow_destructive: input.allow_destructive ?? false,
        granted_by: input.granted_by ?? null,
        revoked_at: null,
      }, { onConflict: "account_id,project_id" })
      .select()
      .single();

    if (error) return connErr("DB_ERROR", error.message);
    return connOk(data as ConnectorPermissionGrant);
  } catch (err) {
    return connErr("UNEXPECTED", String(err));
  }
}

export async function getProjectGrant(
  accountId: string,
  projectId: string
): Promise<ConnectorResult<ConnectorPermissionGrant | null>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("connector_permission_grants")
      .select()
      .eq("account_id", accountId)
      .eq("project_id", projectId)
      .is("revoked_at", null)
      .maybeSingle();

    if (error) return connErr("DB_ERROR", error.message);
    return connOk(data as ConnectorPermissionGrant | null);
  } catch (err) {
    return connErr("UNEXPECTED", String(err));
  }
}

// ── Connector Action Logs ─────────────────────────────────────────────────────

export async function logConnectorAction(
  input: CreateConnectorLogInput,
  outcome: "success" | "failure" | "blocked",
  durationMs: number,
  outputSummary?: Record<string, unknown>,
  errorMsg?: string
): Promise<ConnectorResult<ConnectorActionLog>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("connector_action_logs")
      .insert({
        account_id: input.account_id ?? null,
        project_id: input.project_id ?? null,
        workspace_id: input.workspace_id,
        session_id: input.session_id ?? null,
        provider: input.provider,
        action_type: input.action_type,
        operation: input.operation,
        actor: input.actor ?? "system",
        resource_type: input.resource_type ?? null,
        resource_ref: input.resource_ref ?? null,
        input_summary: input.input_summary ?? {},
        outcome,
        error: errorMsg ?? null,
        output_summary: outputSummary ?? {},
        duration_ms: durationMs,
        approval_gate_id: input.approval_gate_id ?? null,
        was_gated: input.was_gated ?? false,
        action_log_id: input.action_log_id ?? null,
      })
      .select()
      .single();

    if (error) return connErr("DB_ERROR", error.message);
    return connOk(data as ConnectorActionLog);
  } catch (err) {
    return connErr("UNEXPECTED", String(err));
  }
}

export async function getRecentConnectorLogs(
  workspaceId: string,
  projectId?: string,
  limit = 20
): Promise<ConnectorResult<ConnectorActionLog[]>> {
  try {
    const db = createAdminClient();
    let q = db
      .from("connector_action_logs")
      .select()
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (projectId) q = q.eq("project_id", projectId);

    const { data, error } = await q;
    if (error) return connErr("DB_ERROR", error.message);
    return connOk((data ?? []) as ConnectorActionLog[]);
  } catch (err) {
    return connErr("UNEXPECTED", String(err));
  }
}
