/**
 * GET /api/streams/memory?projectId=xxx
 *
 * Loads full project memory at the start of a session.
 * Returns: rules, decisions, issues, pinned facts, latest handoff, last session.
 *
 * projectId is optional — without it, returns workspace-level memory.
 *
 * Called once at session start. Result is injected into the system context.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { loadProjectMemory, formatMemoryForContext } from "@/lib/streams/memory";

export const maxDuration = 30;

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? null;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  let workspaceId: string;
  try {
    const selection = await getCurrentWorkspaceSelection(admin, user);
    workspaceId = selection.current.workspace.id;
  } catch {
    return NextResponse.json({ error: "Could not resolve workspace" }, { status: 500 });
  }

  const memory = await loadProjectMemory(admin, workspaceId, projectId);
  const contextBlock = formatMemoryForContext(memory);

  return NextResponse.json({
    memory,
    contextBlock,
    meta: {
      ruleCount:     memory.rules.length,
      decisionCount: memory.recentDecisions.length,
      issueCount:    memory.openIssues.length,
      factCount:     memory.pinnedFacts.length,
      hasHandoff:    memory.latestHandoff !== null,
      hasSession:    memory.lastSession !== null,
    },
  });
}
