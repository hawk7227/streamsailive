/**
 * POST /api/projects/[id]/context
 *
 * Loads or refreshes the startup context for a project+session.
 * Returns the assembled system prompt and all context data.
 *
 * Body: { sessionId?: string, conversationId?: string, forceRefresh?: boolean }
 *
 * Response:
 * {
 *   systemPrompt: string
 *   projectName: string
 *   activePhase: string | null
 *   bindingsSummary: BindingsSummary
 *   cacheHit: boolean
 *   contextHash: string
 * }
 *
 * Used by: assistant-core/context.ts (Phase 6 Builder Runtime)
 * Called at the start of every session that belongs to a project.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { loadProjectContext, getProjectById } from "@/lib/project-context";

async function resolveWorkspace() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, workspaceId: null };
  const admin = createAdminClient();
  try {
    const selection = await getCurrentWorkspaceSelection(admin, user);
    return { user, workspaceId: selection.current.workspace.id };
  } catch {
    return { user, workspaceId: null };
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { workspaceId } = await resolveWorkspace();
  if (!workspaceId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify project ownership
  const project = await getProjectById(projectId);
  if (project.error) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (project.data.workspace_id !== workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { sessionId?: string; conversationId?: string; forceRefresh?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // body is optional
  }

  const { context, startupContext, cacheHit, error } = await loadProjectContext({
    projectId,
    workspaceId,
    sessionId: body.sessionId,
    forceRefresh: body.forceRefresh ?? false,
  });

  if (error || !context || !startupContext) {
    return NextResponse.json({ error: error ?? "Failed to load context" }, { status: 500 });
  }

  return NextResponse.json({
    systemPrompt: startupContext.system_prompt,
    projectName: startupContext.project_name,
    activePhase: startupContext.active_phase,
    bindingsSummary: startupContext.bindings_summary,
    activeRules: startupContext.active_rules,
    pinnedFacts: startupContext.pinned_facts,
    contextHash: startupContext.context_hash,
    validUntil: startupContext.valid_until,
    cacheHit,
  });
}
