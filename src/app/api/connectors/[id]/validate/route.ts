/**
 * POST /api/connectors/[id]/validate — re-validate credentials, update status
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { getAccount, validateAndRefreshAccount } from "@/lib/connector";
import { createAuditRecord } from "@/lib/audit";
import type { ConnectorProvider } from "@/lib/connector";

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

  const accountResult = await getAccount(id);
  if (accountResult.error || accountResult.data.workspace_id !== workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const account = accountResult.data;
  const { valid, error } = await validateAndRefreshAccount(id, account.provider as ConnectorProvider);

  await createAuditRecord({
    workspace_id: workspaceId,
    event_type: "connector.validated",
    event_category: "connect",
    actor: `user:${user.id}`,
    subject_type: "connected_account",
    subject_ref: id,
    summary: `${account.provider} account validation: ${valid ? "passed" : "failed"}`,
    detail: { provider: account.provider, valid, error: error ?? null },
    outcome: valid ? "success" : "failure",
    error: error ?? undefined,
  });

  const updated = await getAccount(id);
  return NextResponse.json({ valid, error, data: updated.data });
}
