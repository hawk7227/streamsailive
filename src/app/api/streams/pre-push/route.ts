/**
 * POST /api/streams/pre-push
 *
 * Phase 8 — Pre-Push Operator Workflow: API Endpoint
 *
 * Called by scripts/pre-push.mjs after running local checks.
 * Receives the full PrePushReport, processes it through the governance
 * layer, and returns PrePushResult including Vercel status.
 *
 * Body: PrePushReport (see src/lib/streams/pre-push.ts)
 *
 * Response:
 * {
 *   allowed:       boolean   — clean enough to push?
 *   blocked:       boolean   — blocked by critical violations?
 *   gateId?:       string    — approval gate if blocked
 *   vercelStatus?: string    — deployment state after push
 *   vercelUrl?:    string
 *   deploymentId?: string
 *   logId?:        string
 *   summary:       string
 *   errors:        string[]
 * }
 *
 * GET /api/streams/pre-push/status?deploymentId=xxx
 *
 * Polls a specific Vercel deployment and returns its state.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { processPrePushReport, pollVercelStatus } from "@/lib/streams/pre-push";
import type { PrePushReport } from "@/lib/streams/pre-push";

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

// ── POST — process pre-push report ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { user, workspaceId } = await resolveWorkspace();
  if (!workspaceId || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Partial<PrePushReport>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Required fields
  if (!body.branch || !body.headCommit || !body.remote) {
    return NextResponse.json(
      { error: "branch, headCommit, and remote are required" },
      { status: 400 }
    );
  }

  const report: PrePushReport = {
    workspaceId,
    projectId:      body.projectId,
    sessionId:      body.sessionId,
    actor:          `user:${user.id}`,
    repoRoot:       body.repoRoot ?? "",
    branch:         body.branch,
    remote:         body.remote,
    headCommit:     body.headCommit,
    commitMessage:  body.commitMessage ?? "",
    tscErrors:      body.tscErrors ?? [],
    untrackedImports: body.untrackedImports ?? [],
    auditFindings:  body.auditFindings ?? [],
    stagedFiles:    body.stagedFiles ?? [],
    pushed:         body.pushed ?? false,
    pushedCommit:   body.pushedCommit,
    pushError:      body.pushError,
  };

  const result = await processPrePushReport(report);
  return NextResponse.json(result);
}

// ── GET — poll Vercel deployment status ───────────────────────────────────────

export async function GET(req: NextRequest) {
  const { workspaceId } = await resolveWorkspace();
  if (!workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deploymentId = req.nextUrl.searchParams.get("deploymentId");
  if (!deploymentId) {
    return NextResponse.json({ error: "deploymentId is required" }, { status: 400 });
  }

  const status = await pollVercelStatus(deploymentId);
  return NextResponse.json(status);
}
