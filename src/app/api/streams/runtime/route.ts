/**
 * POST /api/streams/runtime
 *
 * The single governed endpoint for all Streams build actions.
 *
 * Phase 6 — Builder Runtime Upgrade.
 * Replaces direct model calls scattered across routes.
 * Every build action that needs project context, memory, or write-back
 * calls this endpoint instead of calling model APIs directly.
 *
 * This is NOT a chat endpoint. It is a build operator endpoint.
 * Chat goes through its own path. This handles discrete build actions.
 *
 * Flow (enforced, no exceptions):
 *   1. Authenticate — user + workspace
 *   2. Resolve project context
 *   3. Assemble memory + active tasks + recent artifacts
 *   4. Classify action (artifact? task? proof state?)
 *   5. Execute through registered executor
 *   6. Write results back (decision_log, issue_history, tasks, artifacts)
 *   7. Return structured ActionOutput
 *
 * Body: {
 *   actionType:   string        — must match a registered executor
 *   payload:      object        — action-specific input
 *   projectId?:   string        — if omitted, workspace-level context
 *   sessionId?:   string        — if omitted, generated
 *   taskId?:      string        — task to advance on success
 *   dryRun?:      boolean       — skip write-back (for testing)
 * }
 *
 * Valid actionTypes:
 *   run_audit           — records audit request, returns instructions
 *   write_decision      — writes to decision_log
 *   log_issue           — writes to issue_history
 *   resolve_issue       — marks issue resolved
 *   pin_fact            — upserts pinned_project_facts
 *   write_handoff       — upserts latest_handoffs + session_summaries
 *   register_artifact   — creates artifact + first version in registry
 *
 * Response: {
 *   success:         boolean
 *   actionType:      string
 *   sessionId:       string
 *   classification:  ActionClassification
 *   result:          ActionResult
 *   artifactId?:     string
 *   systemPrompt:    string    — assembled context block (for debugging)
 *   error?:          string
 * }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { executeAction } from "@/lib/streams/runtime-action";
import { checkRateLimit } from "@/lib/streams/rate-limiter";

export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  let workspaceId: string;
  try {
    const sel = await getCurrentWorkspaceSelection(admin, user);
    workspaceId = sel.current.workspace.id;
  } catch {
    return NextResponse.json({ error: "Could not resolve workspace" }, { status: 500 });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { actionType, payload, projectId, sessionId, taskId, dryRun } = body;

  if (!actionType || typeof actionType !== "string") {
    return NextResponse.json({ error: "actionType is required" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "payload must be an object" }, { status: 400 });
  }

  // ── Rate limit ─────────────────────────────────────────────────────────────
  const rate = checkRateLimit(workspaceId);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again shortly." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // ── Execute through runtime ────────────────────────────────────────────────
  try {
    const output = await executeAction(admin, {
      userId:      user.id,
      workspaceId,
      projectId:   projectId as string | null | undefined,
      sessionId:   sessionId as string | undefined,
      actionType,
      payload:     payload as Record<string, unknown>,
      taskId:      taskId as string | null | undefined,
      dryRun:      dryRun as boolean | undefined,
    });

    const status = output.success ? 200 : 400;
    return NextResponse.json(output, { status });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Runtime execution failed";

    console.error(JSON.stringify({
      level:      "error",
      event:      "STREAMS_RUNTIME_UNHANDLED",
      actionType,
      workspaceId,
      userId:     user.id,
      reason:     message,
    }));

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── GET — introspect registered actions ───────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    version: "phase6",
    actions: [
      {
        actionType:   "run_audit",
        description:  "Records an audit request. Run python scripts/audit.py locally.",
        payload:      {},
      },
      {
        actionType:   "write_decision",
        description:  "Records a decision to decision_log.",
        payload:      { decisionText: "string", rationale: "string?" },
      },
      {
        actionType:   "log_issue",
        description:  "Records an issue to issue_history.",
        payload:      { issueSummary: "string", issueDetail: "string?", category: "string?" },
      },
      {
        actionType:   "resolve_issue",
        description:  "Marks an issue as resolved.",
        payload:      { issueId: "string", resolution: "string" },
      },
      {
        actionType:   "pin_fact",
        description:  "Upserts a pinned project fact.",
        payload:      { projectId: "string", factKey: "string", factValue: "string", isSensitive: "boolean?" },
      },
      {
        actionType:   "write_handoff",
        description:  "Persists end-of-session handoff + summary.",
        payload:      {
          projectId:        "string",
          handoffText:      "string",
          lastCommit:       "string?",
          lastVercelStatus: "string?",
          violationCount:   "number?",
          pendingItems:     "string[]?",
          summary: {
            summaryText:  "string",
            completed:    "string[]",
            inProgress:   "string[]",
            nextSteps:    "string[]",
            filesTouched: "string[]",
            vercelGreen:  "boolean?",
          },
        },
      },
      {
        actionType:   "register_artifact",
        description:  "Registers an output in the artifact registry.",
        payload:      {
          name:         "string",
          slug:         "string",
          artifactType: "code|doc|image|video|svg|react|html|schema|prompt_pack",
          projectId:    "string?",
          description:  "string?",
          origin:       "generated|edited|imported",
          contentText:  "string?",
          contentUrl:   "string?",
          contentType:  "string?",
          previewUrl:   "string?",
        },
      },
    ],
  });
}
