/**
 * src/lib/connector/runtime.ts
 *
 * Connector runtime — the execution layer that ties everything together.
 *
 * Every connector operation in STREAMS goes through one of these functions:
 *
 *   resolveGitHub(projectId, workspaceId) → GitHubContext | null
 *   resolveVercel(projectId, workspaceId) → VercelContext | null
 *   resolveSupabase(projectId, workspaceId) → SupabaseContext | null
 *   withConnector(opts, operation) → wrapped execution with audit + governance
 *
 * The runtime:
 * 1. Looks up the project bindings to find the account ID
 * 2. Fetches the encrypted credentials (server-only path)
 * 3. Decrypts in memory
 * 4. Checks permission grants for the requesting project
 * 5. Gates destructive operations through approval_gates
 * 6. Executes the operation
 * 7. Writes a connector_action_log record
 * 8. Returns the result — never the token
 */

import { decryptCredentials } from "./encryption";
import {
  getAccountWithCredentials,
  getActiveAccountForProvider,
  getProjectGrant,
  updateAccountStatus,
  logConnectorAction,
} from "./repository";
import { getProjectBindings } from "@/lib/project-context";
import { withAudit, createApprovalGate, resolveApprovalGate } from "@/lib/audit";
import type {
  GitHubContext,
  VercelContext,
  SupabaseContext,
  ConnectorResolutionResult,
  ConnectorActionType,
  ConnectorProvider,
} from "./types";
import type { CreateConnectorLogInput } from "./types";

// ── Resolution ────────────────────────────────────────────────────────────────

/**
 * Resolve GitHub context for a project.
 * Returns null if no GitHub account is connected or bindings are not set.
 */
export async function resolveGitHub(
  projectId: string,
  workspaceId: string
): Promise<ConnectorResolutionResult<GitHubContext>> {
  const bindingsResult = await getProjectBindings(projectId);
  if (bindingsResult.error) {
    return { context: null, accountId: null, error: bindingsResult.error.message };
  }

  const bindings = bindingsResult.data;
  if (!bindings.github_account_id || !bindings.github_repo) {
    return { context: null, accountId: null, error: null }; // not connected — not an error
  }

  const accountResult = await getAccountWithCredentials(bindings.github_account_id);
  if (accountResult.error) {
    return { context: null, accountId: bindings.github_account_id, error: accountResult.error.message };
  }

  const account = accountResult.data;
  if (account.status !== "active") {
    return {
      context: null,
      accountId: account.id,
      error: `GitHub account status is "${account.status}". Reconnect at /settings/connectors.`,
    };
  }

  let creds;
  try {
    creds = decryptCredentials(account.encrypted_credentials);
  } catch (err) {
    return { context: null, accountId: account.id, error: `Credential decryption failed: ${String(err)}` };
  }

  return {
    context: {
      accountId: account.id,
      token: creds.token,
      repo: bindings.github_repo,
      branch: bindings.github_branch ?? "main",
      apiBase: "https://api.github.com",
      scopes: account.scopes,
    },
    accountId: account.id,
    error: null,
  };
}

/**
 * Resolve Vercel context for a project.
 */
export async function resolveVercel(
  projectId: string,
  workspaceId: string
): Promise<ConnectorResolutionResult<VercelContext>> {
  const bindingsResult = await getProjectBindings(projectId);
  if (bindingsResult.error) {
    return { context: null, accountId: null, error: bindingsResult.error.message };
  }

  const bindings = bindingsResult.data;
  if (!bindings.vercel_account_id || !bindings.vercel_project_id) {
    return { context: null, accountId: null, error: null };
  }

  const accountResult = await getAccountWithCredentials(bindings.vercel_account_id);
  if (accountResult.error) {
    return { context: null, accountId: bindings.vercel_account_id, error: accountResult.error.message };
  }

  const account = accountResult.data;
  if (account.status !== "active") {
    return {
      context: null,
      accountId: account.id,
      error: `Vercel account status is "${account.status}". Reconnect at /settings/connectors.`,
    };
  }

  let creds;
  try {
    creds = decryptCredentials(account.encrypted_credentials);
  } catch (err) {
    return { context: null, accountId: account.id, error: `Credential decryption failed: ${String(err)}` };
  }

  return {
    context: {
      accountId: account.id,
      token: creds.token,
      projectId: bindings.vercel_project_id,
      teamId: bindings.vercel_team_id ?? null,
      apiBase: "https://api.vercel.com",
      scopes: account.scopes,
    },
    accountId: account.id,
    error: null,
  };
}

/**
 * Resolve Supabase context for a project.
 */
export async function resolveSupabase(
  projectId: string,
  workspaceId: string
): Promise<ConnectorResolutionResult<SupabaseContext>> {
  const bindingsResult = await getProjectBindings(projectId);
  if (bindingsResult.error) {
    return { context: null, accountId: null, error: bindingsResult.error.message };
  }

  const bindings = bindingsResult.data;
  if (!bindings.supabase_account_id || !bindings.supabase_project_ref) {
    return { context: null, accountId: null, error: null };
  }

  const accountResult = await getAccountWithCredentials(bindings.supabase_account_id);
  if (accountResult.error) {
    return { context: null, accountId: bindings.supabase_account_id, error: accountResult.error.message };
  }

  const account = accountResult.data;
  if (account.status !== "active") {
    return {
      context: null,
      accountId: account.id,
      error: `Supabase account status is "${account.status}". Reconnect at /settings/connectors.`,
    };
  }

  let creds;
  try {
    creds = decryptCredentials(account.encrypted_credentials);
  } catch (err) {
    return { context: null, accountId: account.id, error: `Credential decryption failed: ${String(err)}` };
  }

  return {
    context: {
      accountId: account.id,
      token: creds.token,
      projectRef: bindings.supabase_project_ref,
      projectUrl: bindings.supabase_project_url ?? `https://${bindings.supabase_project_ref}.supabase.co`,
      scopes: account.scopes,
    },
    accountId: account.id,
    error: null,
  };
}

// ── withConnector — governed execution wrapper ────────────────────────────────

interface WithConnectorOptions {
  provider: ConnectorProvider;
  actionType: ConnectorActionType;
  operation: string;
  projectId?: string;
  workspaceId: string;
  sessionId?: string;
  actor?: string;
  resourceType?: string;
  resourceRef?: string;
  inputSummary?: Record<string, unknown>;
  accountId?: string;
  requiresDestructiveApproval?: boolean;
}

interface WithConnectorResult<T> {
  data: T | null;
  error: string | null;
  blocked: boolean;
  logId: string | null;
  durationMs: number;
}

/**
 * Wrap any connector operation with:
 * 1. Destructive action gate (requires explicit approval if action is destructive)
 * 2. Permission scope check
 * 3. Execution with timing
 * 4. connector_action_log write
 * 5. Phase 1 audit_record write
 *
 * @example
 * const { data, error } = await withConnector({
 *   provider: 'vercel',
 *   actionType: 'deploy',
 *   operation: 'vercel.pollDeployment',
 *   workspaceId,
 *   projectId,
 *   inputSummary: { deploymentId },
 * }, () => pollDeployment(ctx.token, deploymentId, ctx.teamId));
 */
export async function withConnector<T>(
  opts: WithConnectorOptions,
  operation: () => Promise<T>
): Promise<WithConnectorResult<T>> {
  const startedAt = Date.now();

  // 1. Check if destructive operation needs approval
  if (opts.requiresDestructiveApproval || opts.actionType === "destructive") {
    // Create an approval gate
    const gateResult = await createApprovalGate({
      workspace_id: opts.workspaceId,
      project_id: opts.projectId,
      gate_name: "destructive_connector_action",
      action_name: opts.operation,
      requires_human: true,
      action_payload: {
        provider: opts.provider,
        operation: opts.operation,
        resourceRef: opts.resourceRef,
        inputSummary: opts.inputSummary,
      },
    });

    if (gateResult.data?.outcome !== "approved" && gateResult.data?.outcome !== "bypassed") {
      const durationMs = Date.now() - startedAt;
      await logConnectorAction(
        {
          account_id: opts.accountId,
          project_id: opts.projectId,
          workspace_id: opts.workspaceId,
          session_id: opts.sessionId,
          provider: opts.provider,
          action_type: opts.actionType,
          operation: opts.operation,
          actor: opts.actor ?? "system",
          resource_type: opts.resourceType,
          resource_ref: opts.resourceRef,
          input_summary: opts.inputSummary ?? {},
          approval_gate_id: gateResult.data?.id,
          was_gated: true,
        },
        "blocked",
        durationMs,
        {},
        "Blocked pending approval"
      );
      return {
        data: null,
        error: `Operation blocked: "${opts.operation}" requires approval before executing.`,
        blocked: true,
        logId: null,
        durationMs,
      };
    }
  }

  // 2. Permission scope check for project
  if (opts.projectId && opts.accountId) {
    const grantResult = await getProjectGrant(opts.accountId, opts.projectId);
    if (!grantResult.error && grantResult.data) {
      const grant = grantResult.data;
      // Check destructive flag
      if (opts.actionType === "destructive" && !grant.allow_destructive) {
        const durationMs = Date.now() - startedAt;
        await logConnectorAction(
          {
            account_id: opts.accountId,
            project_id: opts.projectId,
            workspace_id: opts.workspaceId,
            provider: opts.provider,
            action_type: opts.actionType,
            operation: opts.operation,
            actor: opts.actor ?? "system",
            resource_type: opts.resourceType,
            resource_ref: opts.resourceRef,
            input_summary: opts.inputSummary ?? {},
          },
          "blocked",
          durationMs,
          {},
          "Destructive actions not permitted for this project"
        );
        return {
          data: null,
          error: "Destructive connector actions are not enabled for this project.",
          blocked: true,
          logId: null,
          durationMs,
        };
      }
    }
  }

  // 3. Execute through Phase 1 audit layer
  const auditResult = await withAudit(
    {
      actionName: `connector.${opts.provider}.${opts.operation}`,
      actor: opts.actor ?? "system",
      workspaceId: opts.workspaceId,
      projectId: opts.projectId,
      sessionId: opts.sessionId,
      input: opts.inputSummary ?? {},
    },
    async () => operation()
  );

  const durationMs = Date.now() - startedAt;

  // 4. Write connector action log
  const logResult = await logConnectorAction(
    {
      account_id: opts.accountId,
      project_id: opts.projectId,
      workspace_id: opts.workspaceId,
      session_id: opts.sessionId,
      provider: opts.provider,
      action_type: opts.actionType,
      operation: opts.operation,
      actor: opts.actor ?? "system",
      resource_type: opts.resourceType,
      resource_ref: opts.resourceRef,
      input_summary: opts.inputSummary ?? {},
      was_gated: false,
      action_log_id: auditResult.actionLog?.id,
    },
    auditResult.error ? "failure" : "success",
    durationMs,
    auditResult.data
      ? (typeof auditResult.data === "object" ? auditResult.data as Record<string, unknown> : { result: auditResult.data })
      : {},
    auditResult.error ?? undefined
  );

  return {
    data: auditResult.data as T | null,
    error: auditResult.error,
    blocked: false,
    logId: logResult.data?.id ?? null,
    durationMs,
  };
}

// ── Validation helper — refreshes account status ──────────────────────────────

export async function validateAndRefreshAccount(
  accountId: string,
  provider: ConnectorProvider
): Promise<{ valid: boolean; error: string | null }> {
  const accountResult = await getAccountWithCredentials(accountId);
  if (accountResult.error) {
    return { valid: false, error: accountResult.error.message };
  }

  let creds;
  try {
    creds = decryptCredentials(accountResult.data.encrypted_credentials);
  } catch (err) {
    await updateAccountStatus(accountId, "invalid", `Decryption failed: ${String(err)}`);
    return { valid: false, error: `Credential decryption failed` };
  }

  try {
    if (provider === "github") {
      const { validateGitHubToken } = await import("./adapters");
      await validateGitHubToken(creds.token);
    } else if (provider === "vercel") {
      const { validateVercelToken } = await import("./adapters");
      await validateVercelToken(creds.token);
    } else if (provider === "supabase") {
      const bindings = accountResult.data.metadata as Record<string, string>;
      if (bindings.projectUrl) {
        const { validateSupabaseKey } = await import("./adapters");
        await validateSupabaseKey(bindings.projectUrl, creds.token);
      }
    }

    await updateAccountStatus(accountId, "active");
    return { valid: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateAccountStatus(accountId, "invalid", msg);
    return { valid: false, error: msg };
  }
}
