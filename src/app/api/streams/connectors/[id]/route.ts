/**
 * GET    /api/streams/connectors/[id]               — account info (safe, no credentials)
 * DELETE /api/streams/connectors/[id]               — revoke connection
 * POST   /api/streams/connectors/[id]?action=validate — re-validate credentials
 * POST   /api/streams/connectors/[id]?action=rotate   — rotate credentials
 *
 * Rotate body: {
 *   credential: string   — new raw token/key (encrypted before storage)
 * }
 *
 * All responses exclude encrypted_credentials.
 * Credential values are never returned, ever.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { encryptCredential, toSafeAccountInfo, credentialKeyConfigured } from "@/lib/streams/credentials";
import {
  validateAndRefreshAccount,
  revokeConnectedAccount,
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { user, workspaceId, admin } = await resolveUser();
  if (!user || !workspaceId || !admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data, error } = await admin
    .from("connected_accounts")
    .select("id, provider, provider_account_id, scopes, status, project_id, last_validated_at, validation_error, rotation_due_at, connected_at")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: toSafeAccountInfo(data as Record<string, unknown>) });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { user, workspaceId, admin } = await resolveUser();
  if (!user || !workspaceId || !admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await revokeConnectedAccount(admin, workspaceId, id, user.id);
  return NextResponse.json({ revoked: id });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { user, workspaceId, admin } = await resolveUser();
  if (!user || !workspaceId || !admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // Load account to get provider
  const { data: account, error: loadError } = await admin
    .from("connected_accounts")
    .select("provider, status")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();

  if (loadError || !account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const provider = account.provider as Provider;

  if (action === "validate") {
    const { valid, result } = await validateAndRefreshAccount(admin, workspaceId, provider);
    return NextResponse.json({
      valid,
      provider,
      error: result.valid ? undefined : result.error,
    });
  }

  if (action === "rotate") {
    if (!credentialKeyConfigured()) {
      return NextResponse.json(
        { error: "STREAMS_CREDENTIAL_KEY not configured" },
        { status: 503 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { credential } = body;
    if (!credential || typeof credential !== "string" || credential.trim().length < 10) {
      return NextResponse.json(
        { error: "credential is required for rotation" },
        { status: 400 }
      );
    }

    let encryptedCredential: string;
    try {
      encryptedCredential = await encryptCredential(credential.trim());
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Encryption failed" },
        { status: 500 }
      );
    }

    const rotationDue = new Date();
    rotationDue.setDate(rotationDue.getDate() + 90);

    await admin
      .from("connected_accounts")
      .update({
        encrypted_credentials: encryptedCredential,
        status:                "active",
        rotated_at:            new Date().toISOString(),
        rotation_due_at:       rotationDue.toISOString(),
        validation_error:      null,
      })
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    // Validate new credentials immediately
    const { valid, result } = await validateAndRefreshAccount(admin, workspaceId, provider);

    return NextResponse.json({
      rotated: id,
      valid,
      error: valid ? undefined : result.error,
    });
  }

  return NextResponse.json(
    { error: `Unknown action '${action}'. Valid: validate | rotate` },
    { status: 400 }
  );
}
