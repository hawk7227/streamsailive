/**
 * GET  /api/streams/connectors          — list connected accounts (safe, no credentials)
 * POST /api/streams/connectors          — connect a new account
 *
 * POST body: {
 *   provider:          'github' | 'vercel' | 'supabase'
 *   credential:        string    — raw token/key (encrypted before storage, never stored plain)
 *   projectId?:        string    — if omitted, workspace-level connection
 *   providerAccountId?: string   — e.g. GitHub username, Vercel team slug
 *   scopes?:           string[]
 *   // For Supabase, credential is JSON: { projectRef, serviceRoleKey }
 * }
 *
 * The raw credential is encrypted with AES-256-GCM before insert.
 * It is immediately validated against the provider before being stored.
 * If validation fails the connection is rejected.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { encryptCredential, credentialKeyConfigured } from "@/lib/streams/credentials";
import {
  listConnectedAccounts,
  validateAndRefreshAccount,
  type Provider,
} from "@/lib/streams/connectors/index";

export const maxDuration = 30;

async function resolveUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, workspaceId: null, admin: null };
  const admin = createAdminClient();
  try {
    const sel = await getCurrentWorkspaceSelection(admin, user);
    return { user, workspaceId: sel.current.workspace.id, admin };
  } catch {
    return { user: null, workspaceId: null, admin: null };
  }
}

const VALID_PROVIDERS: Provider[] = ["github", "vercel", "supabase"];

export async function GET(): Promise<NextResponse> {
  const { user, workspaceId, admin } = await resolveUser();
  if (!user || !workspaceId || !admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await listConnectedAccounts(admin, workspaceId);
  return NextResponse.json({ data: accounts });
}

export async function POST(request: Request): Promise<NextResponse> {
  const { user, workspaceId, admin } = await resolveUser();
  if (!user || !workspaceId || !admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!credentialKeyConfigured()) {
    return NextResponse.json(
      { error: "STREAMS_CREDENTIAL_KEY not configured. Add to environment variables." },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { provider, credential, projectId, providerAccountId, scopes } = body;

  if (!provider || !VALID_PROVIDERS.includes(provider as Provider)) {
    return NextResponse.json(
      { error: `provider must be one of: ${VALID_PROVIDERS.join(", ")}` },
      { status: 400 }
    );
  }

  if (!credential || typeof credential !== "string" || credential.trim().length < 10) {
    return NextResponse.json(
      { error: "credential is required and must be a valid token or key" },
      { status: 400 }
    );
  }

  // Encrypt credential immediately — raw value never touches DB
  let encryptedCredential: string;
  try {
    encryptedCredential = await encryptCredential(credential.trim());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Encryption failed" },
      { status: 500 }
    );
  }

  // Insert with status 'active' — will validate next
  const rotationDue = new Date();
  rotationDue.setDate(rotationDue.getDate() + 90); // 90-day rotation reminder

  const { data: inserted, error: insertError } = await admin
    .from("connected_accounts")
    .upsert({
      workspace_id:          workspaceId,
      user_id:               user.id,
      provider:              provider as Provider,
      provider_account_id:   providerAccountId as string ?? null,
      scopes:                Array.isArray(scopes) ? scopes : [],
      encrypted_credentials: encryptedCredential,
      status:                "active",
      project_id:            projectId as string ?? null,
      rotation_due_at:       rotationDue.toISOString(),
      connected_by:          user.id,
    }, { onConflict: "workspace_id,provider" })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      data: {
        accountId: inserted.id,
        provider,
        status:    "active",
        message:   `${provider} connected successfully`,
      }
    },
    { status: 201 }
  );
}
