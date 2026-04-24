/**
 * src/lib/streams/runtime-action.ts
 *
 * Phase 6 — Builder Runtime: Single Execution Path
 *
 * executeAction() is the one function every build action runs through.
 * It enforces the 6-step runtime contract:
 *
 *   1. Resolve projectId
 *   2. Load project context
 *   3. Load memory
 *   4. Classify required task/artifact involvement
 *   5. Execute through one runtime path
 *   6. Write results back to memory/tasks/artifacts/proof logs
 *
 * No build route calls a model directly.
 * Every build route calls executeAction() and returns its result.
 *
 * The tool continuation loop (step 5) handles:
 *   - Single-shot actions (generate, write, analyse)
 *   - Tool calls that produce artifacts
 *   - Error capture and issue logging
 *   - Proof classification on every result
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveProject,
  assembleContext,
  classifyAction,
  writeActionResult,
  type ActionResult,
  type ActionClassification,
} from "./runtime";
import { createArtifact } from "./artifacts";
import type { ArtifactType } from "./artifacts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActionInput {
  // Who is calling
  userId:      string;
  workspaceId: string;
  projectId?:  string | null;
  sessionId?:  string;

  // What action to run
  actionType: string;

  // Action-specific payload — passed to the executor
  payload:    Record<string, unknown>;

  // Optional task to advance on success
  taskId?:    string | null;

  // If true, skip artifact creation even if action produces one
  dryRun?:    boolean;
}

export interface ActionOutput {
  success:         boolean;
  actionType:      string;
  sessionId:       string;
  classification:  ActionClassification;
  result:          ActionResult;
  artifactId?:     string;
  systemPrompt:    string;
  error?:          string;
}

// ── Executor registry ─────────────────────────────────────────────────────────
// Maps actionType → executor function.
// Executors are thin — they do the actual work and return a result.
// All cross-cutting concerns (memory, artifacts, tasks) happen in executeAction.

type Executor = (
  payload: Record<string, unknown>,
  ctx: { userId: string; workspaceId: string; projectId: string | null; sessionId: string },
  admin: SupabaseClient,
) => Promise<ActionResult>;

const EXECUTORS: Record<string, Executor> = {

  // ── run_audit ──────────────────────────────────────────────────────────────
  // Runs the build rules audit programmatically.
  // Returns violation count + summary as outputText.
  run_audit: async (_payload, _ctx, _admin) => {
    // In the Next.js runtime we can't exec python — return the audit API contract.
    // The actual audit runs via scripts/audit.py pre-push.
    // This action records that an audit was requested and produces a doc artifact.
    return {
      success:    true,
      outputText: "Audit requested. Run `python scripts/audit.py` to execute. Results will be written to audit-report.txt.",
    };
  },

  // ── write_decision ─────────────────────────────────────────────────────────
  // Records a decision to the decision_log.
  write_decision: async (payload, ctx, admin) => {
    const text = payload.decisionText as string;
    const rationale = payload.rationale as string | undefined;
    if (!text) return { success: false, error: "decisionText is required" };

    await admin.from("decision_log").insert({
      workspace_id:  ctx.workspaceId,
      project_id:    ctx.projectId,
      session_id:    ctx.sessionId,
      decision_text: text,
      rationale:     rationale ?? null,
      outcome:       "pending",
    });

    return { success: true, outputText: `Decision recorded: ${text}` };
  },

  // ── log_issue ──────────────────────────────────────────────────────────────
  // Records an issue to issue_history.
  log_issue: async (payload, ctx, admin) => {
    const summary = payload.issueSummary as string;
    const detail  = payload.issueDetail as string | undefined;
    const category = payload.category as string | undefined;
    if (!summary) return { success: false, error: "issueSummary is required" };

    await admin.from("issue_history").insert({
      workspace_id:  ctx.workspaceId,
      project_id:    ctx.projectId,
      session_id:    ctx.sessionId,
      issue_summary: summary,
      issue_detail:  detail ?? null,
      category:      category ?? "build",
      status:        "open",
    });

    return { success: true, outputText: `Issue logged: ${summary}` };
  },

  // ── resolve_issue ──────────────────────────────────────────────────────────
  resolve_issue: async (payload, _ctx, admin) => {
    const issueId   = payload.issueId as string;
    const resolution = payload.resolution as string;
    if (!issueId || !resolution) {
      return { success: false, error: "issueId and resolution are required" };
    }

    await admin.from("issue_history").update({
      status:      "resolved",
      resolution,
      resolved_at: new Date().toISOString(),
    }).eq("id", issueId);

    return { success: true, outputText: `Issue ${issueId} resolved: ${resolution}` };
  },

  // ── pin_fact ───────────────────────────────────────────────────────────────
  pin_fact: async (payload, ctx, admin) => {
    const projectId  = (payload.projectId as string) ?? ctx.projectId;
    const factKey    = payload.factKey as string;
    const factValue  = payload.factValue as string;
    const isSensitive = payload.isSensitive as boolean | undefined;

    if (!projectId || !factKey || !factValue) {
      return { success: false, error: "projectId, factKey, and factValue are required" };
    }

    await admin.from("pinned_project_facts").upsert({
      workspace_id: ctx.workspaceId,
      project_id:   projectId,
      fact_key:     factKey,
      fact_value:   factValue,
      is_sensitive: isSensitive ?? false,
      updated_at:   new Date().toISOString(),
    }, { onConflict: "project_id,fact_key" });

    return { success: true, outputText: `Pinned: ${factKey} = ${isSensitive ? "[hidden]" : factValue}` };
  },

  // ── write_handoff ──────────────────────────────────────────────────────────
  write_handoff: async (payload, ctx, admin) => {
    const projectId  = (payload.projectId as string) ?? ctx.projectId;
    const handoffText = payload.handoffText as string;
    const summary     = payload.summary as Record<string, unknown>;

    if (!projectId || !handoffText || !summary) {
      return { success: false, error: "projectId, handoffText, and summary are required" };
    }

    await admin.from("latest_handoffs").upsert({
      workspace_id:       ctx.workspaceId,
      project_id:         projectId,
      handoff_text:       handoffText,
      last_commit:        payload.lastCommit as string | undefined ?? null,
      last_vercel_status: payload.lastVercelStatus as string | undefined ?? null,
      violation_count:    (payload.violationCount as number) ?? 0,
      pending_items:      (payload.pendingItems as string[]) ?? [],
      generated_at:       new Date().toISOString(),
      generated_by:       ctx.userId,
    }, { onConflict: "project_id" });

    await admin.from("session_summaries").insert({
      workspace_id: ctx.workspaceId,
      project_id:   projectId,
      session_id:   ctx.sessionId,
      summary_text: summary.summaryText as string,
      completed:    (summary.completed as string[]) ?? [],
      in_progress:  (summary.inProgress as string[]) ?? [],
      next_steps:   (summary.nextSteps as string[]) ?? [],
      files_touched: (summary.filesTouched as string[]) ?? [],
      last_commit:  payload.lastCommit as string | undefined ?? null,
      vercel_green: (summary.vercelGreen as boolean) ?? null,
    });

    return { success: true, outputText: "Handoff written." };
  },

  // ── register_artifact ──────────────────────────────────────────────────────
  // Registers an output as an artifact in the registry.
  register_artifact: async (payload, ctx, admin) => {
    const name         = payload.name as string;
    const slug         = payload.slug as string;
    const artifactType = payload.artifactType as ArtifactType;

    if (!name || !slug || !artifactType) {
      return { success: false, error: "name, slug, and artifactType are required" };
    }

    const artifact = await createArtifact(admin, ctx.userId, {
      workspaceId:      ctx.workspaceId,
      projectId:        (payload.projectId as string) ?? ctx.projectId,
      name,
      slug,
      description:      payload.description as string | undefined,
      artifactType,
      origin:           (payload.origin as "generated" | "edited" | "imported") ?? "generated",
      tags:             payload.tags as string[] | undefined,
      sessionId:        ctx.sessionId,
      generationLogId:  payload.generationLogId as string | undefined,
      contentText:      payload.contentText as string | undefined,
      contentUrl:       payload.contentUrl as string | undefined,
      contentType:      payload.contentType as string | undefined,
      previewUrl:       payload.previewUrl as string | undefined,
      changeSummary:    payload.changeSummary as string | undefined,
    });

    return {
      success:    true,
      outputText: `Artifact registered: ${name} (${artifactType})`,
      artifactId: artifact.id,
    };
  },
};

// ── executeAction ─────────────────────────────────────────────────────────────

export async function executeAction(
  admin: SupabaseClient,
  input: ActionInput,
): Promise<ActionOutput> {
  // Step 1 — Resolve project
  const ctx = await resolveProject(
    admin,
    input.userId,
    input.workspaceId,
    input.projectId,
    input.sessionId,
  );

  // Step 2 + 3 — Load project context + memory
  const assembled = await assembleContext(admin, ctx);

  // Step 4 — Classify action
  const classification = classifyAction({
    actionType: input.actionType,
    taskId:     input.taskId,
  });

  // Step 5 — Execute through one runtime path
  const executor = EXECUTORS[input.actionType];

  if (!executor) {
    const result: ActionResult = {
      success: false,
      error:   `Unknown actionType: ${input.actionType}. Valid: ${Object.keys(EXECUTORS).join(", ")}`,
    };
    return {
      success:        false,
      actionType:     input.actionType,
      sessionId:      ctx.sessionId,
      classification,
      result,
      systemPrompt:   assembled.systemPrompt,
      error:          result.error,
    };
  }

  let result: ActionResult;
  try {
    result = await executor(input.payload, ctx, admin);
  } catch (err) {
    result = {
      success: false,
      error:   err instanceof Error ? err.message : "Executor threw unexpectedly",
    };
  }

  // Step 6 — Write results back
  if (!input.dryRun) {
    await writeActionResult(admin, ctx, result, classification).catch(() => {
      // Write-back failure must not surface to caller — log silently
      console.error(JSON.stringify({
        level:      "error",
        event:      "RUNTIME_WRITEBACK_FAILED",
        actionType: input.actionType,
        sessionId:  ctx.sessionId,
      }));
    });
  }

  return {
    success:        result.success,
    actionType:     input.actionType,
    sessionId:      ctx.sessionId,
    classification,
    result,
    artifactId:     result.artifactId,
    systemPrompt:   assembled.systemPrompt,
    error:          result.error,
  };
}
