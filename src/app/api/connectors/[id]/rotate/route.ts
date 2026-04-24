/**
 * POST /api/connectors/[id]/rotate — re-encrypt credentials with fresh IV
 *
 * This does NOT change the underlying token.
 * It re-encrypts the existing token with a new random IV.
 * Use this periodically or after a suspected key exposure.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { getAccount, rotateAccountCredentials } from "@/lib/connector";
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

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, workspaceId } = await resolveWorkspace();
  if (!workspaceId || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await getAccount(id);
  if (existing.error || existing.data.workspace_id !== workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await rotateAccountCredentials(id);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });

  await createAuditRecord({
    workspace_id: workspaceId,
    event_type: "connector.rotated",
    event_category: "connect",
    actor: `user:${user.id}`,
    subject_type: "connected_account",
    subject_ref: id,
    summary: `${existing.data.provider} account credentials rotated (IV refresh, rotation #${result.data?.rotation_count})`,
    detail: {
      provider: existing.data.provider,
      rotationCount: result.data?.rotation_count,
    },
    outcome: "success",
  });

  return NextResponse.json({ data: result.data });
}
