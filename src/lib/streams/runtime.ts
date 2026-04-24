/**
 * src/lib/streams/runtime.ts
 *
 * Phase 6 — Builder Runtime Upgrade
 *
 * Three responsibilities:
 *
 * 1. resolveProject()
 *    Resolves workspace + project from a request.
 *    Single source of truth — every build action calls this first.
 *
 * 2. assembleContext()
 *    Loads all context needed before a model call:
 *    - Project rules and settings
 *    - Phase 3 memory (rules, decisions, issues, pinned facts, handoff)
 *    - Active tasks (in_progress, blocked)
 *    - Recent artifacts (stable, last 10)
 *    Returns a structured RuntimeContext + a formatted system prompt block.
 *
 * 3. classifyAction()
 *    Determines what a build action involves:
 *    - Does it produce an artifact? Which type?
 *    - Does it belong to a task?
 *    - What proof classification applies?
 *    Returns an ActionClassification used to drive write-back.
 *
 * Usage pattern in every build route:
 *   const ctx = await resolveProject(admin, user, projectId);
 *   const assembled = await assembleContext(admin, ctx);
 *   // ... execute action ...
 *   await writeActionResult(admin, ctx, result, classification);
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProjectMemory, formatMemoryForContext } from "./memory";
import { listArtifacts } from "./artifacts";
import { listTasks } from "./tasks";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ResolvedProject {
  userId:      string;
  workspaceId: string;
  projectId:   string | null;
  sessionId:   string;
}

export interface RuntimeContext extends ResolvedProject {
  projectName:    string | null;
  projectRules:   string[];
  projectPhase:   string | null;
}

export interface AssembledContext {
  ctx:            RuntimeContext;
  memoryBlock:    string;
  activeTasksBlock: string;
  recentArtifactsBlock: string;
  systemPrompt:   string;
}

export type ArtifactTypeHint =
  | "code" | "doc" | "image" | "video"
  | "svg" | "react" | "html" | "schema" | "prompt_pack" | null;

export type ProofClassification =
  | "Proven"
  | "ImplementedButUnproven"
  | "Unproven";

export interface ActionClassification {
  producesArtifact:  boolean;
  artifactTypeHint:  ArtifactTypeHint;
  taskId:            string | null;
  proofClassification: ProofClassification;
  requiresApproval:  boolean;
  // human-readable summary of what this action does
  actionSummary:     string;
}

// ── 1. Resolve project ────────────────────────────────────────────────────────

export async function resolveProject(
  admin: SupabaseClient,
  userId: string,
  workspaceId: string,
  projectId?: string | null,
  sessionId?: string,
): Promise<RuntimeContext> {
  const resolvedSessionId = sessionId ?? `session_${Date.now()}`;

  if (!projectId) {
    return {
      userId,
      workspaceId,
      projectId:   null,
      sessionId:   resolvedSessionId,
      projectName: null,
      projectRules: [],
      projectPhase: null,
    };
  }

  // Load project metadata
  const { data: project } = await admin
    .from("projects")
    .select("id, name, description")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .single();

  // Load project rules from project_settings if available
  const { data: settings } = await admin
    .from("project_settings")
    .select("active_phase, custom_rules")
    .eq("project_id", projectId)
    .maybeSingle();

  const projectRules: string[] = [];
  if (settings?.custom_rules) {
    const raw = settings.custom_rules as unknown;
    if (Array.isArray(raw)) {
      raw.forEach((r: unknown) => {
        if (typeof r === "string") projectRules.push(r);
      });
    }
  }

  return {
    userId,
    workspaceId,
    projectId,
    sessionId:    resolvedSessionId,
    projectName:  project?.name as string | null ?? null,
    projectRules,
    projectPhase: settings?.active_phase as string | null ?? null,
  };
}

// ── 2. Assemble context ───────────────────────────────────────────────────────

export async function assembleContext(
  admin: SupabaseClient,
  ctx: RuntimeContext,
): Promise<AssembledContext> {
  // Load Phase 3 memory
  const memory = await loadProjectMemory(admin, ctx.workspaceId, ctx.projectId);
  const memoryBlock = formatMemoryForContext(memory);

  // Load active tasks (in_progress + blocked only — noise reduction)
  const [inProgress, blocked] = await Promise.all([
    listTasks(admin, ctx.workspaceId, {
      projectId: ctx.projectId ?? undefined,
      status:    "in_progress",
      limit:     10,
    }),
    listTasks(admin, ctx.workspaceId, {
      projectId: ctx.projectId ?? undefined,
      status:    "blocked",
      limit:     5,
    }),
  ]);

  const activeTasksBlock = buildActiveTasksBlock([...inProgress, ...blocked]);

  // Load recent stable artifacts (last 10)
  const artifacts = await listArtifacts(admin, ctx.workspaceId, {
    projectId: ctx.projectId ?? undefined,
    state:     "stable",
    limit:     10,
  });

  const recentArtifactsBlock = buildArtifactsBlock(artifacts);

  // Assemble full system prompt block
  const systemPrompt = buildSystemPrompt(ctx, memoryBlock, activeTasksBlock, recentArtifactsBlock);

  return { ctx, memoryBlock, activeTasksBlock, recentArtifactsBlock, systemPrompt };
}

// ── 3. Classify action ────────────────────────────────────────────────────────

export function classifyAction(input: {
  actionType:    string;
  // 'generate_video' | 'generate_image' | 'generate_voice' | 'generate_music'
  // | 'write_code' | 'write_doc' | 'edit_artifact' | 'run_analysis'
  // | 'run_audit' | 'chat_response' | 'memory_write' | 'task_update'
  taskId?:       string | null;
  hasProof?:     boolean;
  proofEvidence?: string;
}): ActionClassification {
  const { actionType, taskId, hasProof, proofEvidence } = input;

  // Artifact type mapping
  const artifactMap: Record<string, ArtifactTypeHint> = {
    generate_video:  "video",
    generate_image:  "image",
    generate_voice:  "audio" as ArtifactTypeHint,
    generate_music:  "audio" as ArtifactTypeHint,
    write_code:      "code",
    write_doc:       "doc",
    edit_artifact:   null,  // type determined by target artifact
    run_analysis:    "doc",
    run_audit:       "doc",
    chat_response:   null,
    memory_write:    null,
    task_update:     null,
  };

  const producesArtifact = [
    "generate_video", "generate_image", "generate_voice", "generate_music",
    "write_code", "write_doc", "run_analysis", "run_audit",
  ].includes(actionType);

  // Proof classification
  let proofClassification: ProofClassification = "Unproven";
  if (hasProof && proofEvidence) {
    proofClassification = "Proven";
  } else if (producesArtifact) {
    proofClassification = "ImplementedButUnproven";
  }

  // Approval required for destructive or high-impact actions
  const requiresApproval = [
    "run_audit", "write_code",
  ].includes(actionType);

  return {
    producesArtifact,
    artifactTypeHint: artifactMap[actionType] ?? null,
    taskId:           taskId ?? null,
    proofClassification,
    requiresApproval,
    actionSummary:    actionType.replace(/_/g, " "),
  };
}

// ── Write action result back ──────────────────────────────────────────────────

export interface ActionResult {
  success:      boolean;
  outputText?:  string;
  outputUrl?:   string;
  artifactId?:  string;
  error?:       string;
  proofEvidence?: string;
}

export async function writeActionResult(
  admin: SupabaseClient,
  ctx: RuntimeContext,
  result: ActionResult,
  classification: ActionClassification,
): Promise<void> {
  const now = new Date().toISOString();

  // Write to decision_log if action produced meaningful output
  if (result.success && classification.producesArtifact) {
    await admin.from("decision_log").insert({
      workspace_id:  ctx.workspaceId,
      project_id:    ctx.projectId,
      session_id:    ctx.sessionId,
      decision_text: `${classification.actionSummary} completed`,
      rationale:     result.outputUrl ?? result.outputText?.slice(0, 200) ?? null,
      outcome:       "pending",
    });
  }

  // Write to issue_history if action failed
  if (!result.success && result.error) {
    await admin.from("issue_history").insert({
      workspace_id:  ctx.workspaceId,
      project_id:    ctx.projectId,
      session_id:    ctx.sessionId,
      issue_summary: `${classification.actionSummary} failed`,
      issue_detail:  result.error,
      category:      "runtime",
      status:        "open",
      occurred_at:   now,
    });
  }

  // Advance task status if action belongs to a task
  if (classification.taskId && result.success) {
    await admin
      .from("tasks")
      .update({
        status:     "in_review",
        updated_at: now,
        ...(result.artifactId ? { proof_record_id: null } : {}),
      })
      .eq("id", classification.taskId)
      .eq("workspace_id", ctx.workspaceId);

    // Write task history entry
    await admin.from("task_history").insert({
      task_id:      classification.taskId,
      workspace_id: ctx.workspaceId,
      event_type:   "status_changed",
      from_value:   "in_progress",
      to_value:     "in_review",
      note:         `${classification.actionSummary} completed`,
      actor_type:   "ai",
      session_id:   ctx.sessionId,
    });
  }
}

// ── Block builders ────────────────────────────────────────────────────────────

interface ArtifactLike {
  name: string;
  artifactType: string;
  proofState: string;
  updatedAt: string;
}

interface TaskLike {
  title: string;
  status: string;
  priority: string;
  blockedReason?: string | null;
  nextStep?: string | null;
}

function buildActiveTasksBlock(tasks: TaskLike[]): string {
  if (tasks.length === 0) return "";
  const lines = ["## Active Tasks"];
  tasks.forEach(t => {
    lines.push(`[${t.priority.toUpperCase()}] ${t.title} — ${t.status}`);
    if (t.blockedReason) lines.push(`  Blocked: ${t.blockedReason}`);
    if (t.nextStep)      lines.push(`  Next: ${t.nextStep}`);
  });
  return lines.join("\n");
}

function buildArtifactsBlock(artifacts: ArtifactLike[]): string {
  if (artifacts.length === 0) return "";
  const lines = ["## Recent Stable Artifacts"];
  artifacts.forEach(a => {
    lines.push(`${a.name} (${a.artifactType}) — ${a.proofState}`);
  });
  return lines.join("\n");
}

function buildSystemPrompt(
  ctx: RuntimeContext,
  memoryBlock: string,
  tasksBlock: string,
  artifactsBlock: string,
): string {
  const parts: string[] = [
    "# Streams Builder Runtime",
    `Session: ${ctx.sessionId}`,
    `Workspace: ${ctx.workspaceId}`,
  ];

  if (ctx.projectName) {
    parts.push(`Project: ${ctx.projectName}`);
  }
  if (ctx.projectPhase) {
    parts.push(`Phase: ${ctx.projectPhase}`);
  }
  if (ctx.projectRules.length > 0) {
    parts.push("\n## Project Rules");
    ctx.projectRules.forEach(r => parts.push(`- ${r}`));
  }

  if (memoryBlock)    parts.push(`\n${memoryBlock}`);
  if (tasksBlock)     parts.push(`\n${tasksBlock}`);
  if (artifactsBlock) parts.push(`\n${artifactsBlock}`);

  parts.push([
    "\n## Runtime Constraints",
    "- Every output is classified before being returned",
    "- Artifact-producing actions write to artifact registry",
    "- Failed actions write to issue_history",
    "- Task-linked actions advance task status on success",
    "- No direct model calls outside the runtime envelope",
  ].join("\n"));

  return parts.join("\n");
}
