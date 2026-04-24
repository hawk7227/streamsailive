/**
 * GET  /api/connectors          — list connected accounts for workspace
 * POST /api/connectors          — connect a new provider account
 *
 * Auth: session cookie → user → workspace.
 *
 * POST body:
 * {
 *   provider: 'github' | 'vercel' | 'supabase'
 *   token: string           — raw token (encrypted immediately, never stored plain)
 *   refreshToken?: string
 *   expiresAt?: string
 *   displayName?: string
 *   projectId?: string      — if provided, also creates a permission grant
 *   grantedScopes?: string[]
 * }
 *
 * The raw token is encrypted in this handler before any DB write.
 * It is NEVER logged, NEVER echoed back in the response.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import {
  createConnectedAccount,
  listAccountsForWorkspace,
  grantProjectAccess,
  validateAndRefreshAccount,
} from "@/lib/connector";
import { createAuditRecord } from "@/lib/audit";
import type { ConnectorProvider } from "@/lib/connector";
import {
  validateGitHubToken,
  validateVercelToken,
  validateSupabaseKey,
} from "@/lib/connector";

async function resolveWorkspace() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, workspaceId: null };
  const admin = createAdminClient();
  try {
    const sel = await getCurrentWorkspaceSelection(admin, user);
    return { user, workspaceId: sel.current.workspace.id };
  } catch {
    return { user, workspaceId: null };
  }
}

export async function GET() {
  const { workspaceId } = await resolveWorkspace();
  if (!workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await listAccountsForWorkspace(workspaceId);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });

  // Group by provider for easier UI consumption
  const grouped = {
    github: result.data.filter((a) => a.provider === "github"),
    vercel: result.data.filter((a) => a.provider === "vercel"),
    supabase: result.data.filter((a) => a.provider === "supabase"),
  };

  return NextResponse.json({ data: result.data, grouped });
}

export async function POST(req: NextRequest) {
  const { user, workspaceId } = await resolveWorkspace();
  if (!workspaceId || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    provider: ConnectorProvider;
    token: string;
    refreshToken?: string;
    expiresAt?: string;
    displayName?: string;
    projectId?: string;
    grantedScopes?: string[];
    allowDestructive?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { provider, token, refreshToken, expiresAt, displayName, projectId, grantedScopes } = body;

  if (!provider || !token) {
    return NextResponse.json({ error: "provider and token are required" }, { status: 400 });
  }

  // 1. Validate token before storing
  let providerAccountId: string | undefined;
  let providerAccountName: string | undefined;
  let providerAccountUrl: string | undefined;
  let scopes: string[] = [];

  try {
    if (provider === "github") {
      const validation = await validateGitHubToken(token);
      providerAccountId = String(validation.id);
      providerAccountName = validation.login;
      providerAccountUrl = `https://github.com/${validation.login}`;
      scopes = validation.scopes;
    } else if (provider === "vercel") {
      const validation = await validateVercelToken(token);
      providerAccountId = validation.id;
      providerAccountName = validation.username;
      providerAccountUrl = `https://vercel.com/${validation.username}`;
      scopes = ["deployments:read", "deployments:write", "projects:read", "projects:write"];
    } else if (provider === "supabase") {
      // For Supabase, token is the service role key + project URL in metadata
      const projectUrl = (body as Record<string, unknown>).projectUrl as string;
      if (!projectUrl) {
        return NextResponse.json({ error: "projectUrl is required for Supabase connections" }, { status: 400 });
      }
      const validation = await validateSupabaseKey(projectUrl, token);
      providerAccountId = validation.projectRef;
      providerAccountName = validation.projectRef;
      providerAccountUrl = projectUrl;
      scopes = ["database:read", "database:write", "schema:write"];
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Token validation failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 422 }
    );
  }

  // 2. Store encrypted account
  const result = await createConnectedAccount({
    workspace_id: workspaceId,
    user_id: user.id,
    provider,
    provider_account_id: providerAccountId,
    provider_account_name: providerAccountName,
    provider_account_url: providerAccountUrl,
    scopes,
    credentials: { token, refreshToken, expiresAt },
    display_name: displayName,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  // 3. Grant project access if projectId provided
  if (projectId && result.data) {
    await grantProjectAccess({
      account_id: result.data.id,
      project_id: projectId,
      workspace_id: workspaceId,
      granted_scopes: grantedScopes ?? scopes,
      allow_destructive: body.allowDestructive ?? false,
      granted_by: user.id,
    });
  }

  // 4. Audit record
  await createAuditRecord({
    workspace_id: workspaceId,
    event_type: "connector.connected",
    event_category: "connect",
    actor: `user:${user.id}`,
    subject_type: "connected_account",
    subject_ref: result.data?.id,
    summary: `${provider} account "${providerAccountName}" connected for workspace`,
    detail: {
      provider,
      providerAccountName,
      scopes,
      projectId: projectId ?? null,
    },
    outcome: "success",
  });

  // Return safe account (no credentials)
  return NextResponse.json({ data: result.data }, { status: 201 });
}
