/**
 * GET    /api/connectors/[id]          — get account (no credentials)
 * DELETE /api/connectors/[id]          — revoke account
 * POST   /api/connectors/[id]/validate — validate credentials, refresh status
 * POST   /api/connectors/[id]/rotate   — re-encrypt credentials with fresh IV
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import {
  getAccount,
  revokeAccount,
  rotateAccountCredentials,
  validateAndRefreshAccount,
} from "@/lib/connector";
import { createAuditRecord } from "@/lib/audit";

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

async function verifyOwnership(accountId: string, workspaceId: string) {
  const result = await getAccount(accountId);
  if (result.error) return null;
  if (result.data.workspace_id !== workspaceId) return null;
  return result.data;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { workspaceId } = await resolveWorkspace();
  if (!workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await verifyOwnership(id, workspaceId);
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ data: account });
}

// ── DELETE (revoke) ───────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, workspaceId } = await resolveWorkspace();
  if (!workspaceId || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await verifyOwnership(id, workspaceId);
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await revokeAccount(id);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });

  await createAuditRecord({
    workspace_id: workspaceId,
    event_type: "connector.revoked",
    event_category: "connect",
    actor: `user:${user.id}`,
    subject_type: "connected_account",
    subject_ref: id,
    summary: `${account.provider} account "${account.provider_account_name}" revoked`,
    detail: { provider: account.provider, accountId: id },
    outcome: "success",
  });

  return NextResponse.json({ ok: true });
}
