/**
 * POST /api/streams/memory/handoff
 *
 * Persists end-of-session handoff + summary.
 * Called at session end or on explicit save.
 *
 * Body: {
 *   projectId: string
 *   sessionId: string
 *   handoffText: string          — full markdown handoff document
 *   lastCommit?: string          — git commit hash
 *   lastVercelStatus?: string    — 'Ready' | 'Error' | 'Building'
 *   violationCount?: number      — audit violations at handoff time
 *   pendingItems?: string[]      — extracted pending work items
 *   summary: {
 *     summaryText: string
 *     completed: string[]
 *     inProgress: string[]
 *     nextSteps: string[]
 *     filesTouched: string[]
 *     vercelGreen?: boolean
 *   }
 * }
 *
 * Returns: { handoffId, summaryId }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { writeSessionHandoff } from "@/lib/streams/memory";

export const maxDuration = 30;

export async function POST(request: Request): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { projectId, sessionId, handoffText, summary } = body;

  if (!projectId || typeof projectId !== "string") {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }
  if (!handoffText || typeof handoffText !== "string") {
    return NextResponse.json({ error: "handoffText is required" }, { status: 400 });
  }
  if (!summary || typeof summary !== "object") {
    return NextResponse.json({ error: "summary is required" }, { status: 400 });
  }

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

  try {
    const result = await writeSessionHandoff(admin, workspaceId, projectId, user.id, {
      sessionId:         sessionId,
      handoffText:       handoffText,
      lastCommit:        body.lastCommit as string | undefined,
      lastVercelStatus:  body.lastVercelStatus as string | undefined,
      violationCount:    body.violationCount as number | undefined,
      pendingItems:      body.pendingItems as string[] | undefined,
      summary: {
        summaryText:  (summary as Record<string, unknown>).summaryText as string,
        completed:    (summary as Record<string, unknown>).completed as string[] ?? [],
        inProgress:   (summary as Record<string, unknown>).inProgress as string[] ?? [],
        nextSteps:    (summary as Record<string, unknown>).nextSteps as string[] ?? [],
        filesTouched: (summary as Record<string, unknown>).filesTouched as string[] ?? [],
        vercelGreen:  (summary as Record<string, unknown>).vercelGreen as boolean | undefined,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Handoff write failed" },
      { status: 500 }
    );
  }
}
