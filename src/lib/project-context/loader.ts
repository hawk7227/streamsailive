/**
 * src/lib/project-context/loader.ts
 *
 * Project Startup Context Loader — the core of Phase 2.
 *
 * loadProjectContext() is called at the start of every session and
 * at the start of every build/generate action. It:
 *
 *   1. Resolves the project from projectId
 *   2. Loads project settings, bindings, and active rules
 *   3. Checks for a valid cached startup context (cache hit = skip assembly)
 *   4. Assembles the system prompt with project context injected
 *   5. Saves the assembled context to project_startup_context
 *   6. Writes a proof record and audit record
 *   7. Returns the ResolvedProjectContext for use by the caller
 *
 * This function is the active project resolution contract.
 * No session begins without calling this.
 * No action executes without the returned context.
 *
 * Hook points for later phases:
 *   Phase 3 (Memory) — loader will also call loadProjectMemory()
 *   Phase 6 (Runtime) — every tool call receives resolvedContext
 *   Phase 7 (Connector) — bindings.github_account_id used to fetch live token
 */

import crypto from "crypto";
import {
  getProjectById,
  getProjectSettings,
  getProjectBindings,
  getActiveProjectRules,
  getValidStartupContext,
  saveStartupContext,
} from "./repository";
import type {
  ResolvedProjectContext,
  ProjectStartupContext,
  BindingsSummary,
  ProjectRule,
} from "./types";
import { proveSubject, createAuditRecord } from "@/lib/audit";

// ── System prompt assembly ────────────────────────────────────────────────────

function assembleSystemPrompt(opts: {
  projectName: string;
  activePhase: string | null;
  contextPrompt: string | null;
  bindings: BindingsSummary;
  rules: ProjectRule[];
  pinnedFacts: Array<{ key: string; value: string }>;
  customSystemPrompt: string | null;
}): string {
  const parts: string[] = [];

  // 1. Base operator identity
  parts.push(
    "You are STREAMS — a project-bound builder workspace AI. " +
    "You operate inside a specific project context with persistent memory, " +
    "governed actions, and proof-backed outputs. " +
    "You never behave as a generic chat assistant."
  );

  // 2. Project identity
  parts.push(`\n## Active Project\nProject: ${opts.projectName}`);
  if (opts.activePhase) {
    parts.push(`Active phase: ${opts.activePhase}`);
  }

  // 3. Project bindings summary
  const b = opts.bindings;
  if (b.github_repo || b.vercel_project_name || b.supabase_project_ref) {
    parts.push("\n## Project Bindings");
    if (b.github_repo) parts.push(`GitHub: ${b.github_repo} (branch: ${b.github_branch ?? "main"})`);
    if (b.vercel_project_name) parts.push(`Vercel: ${b.vercel_project_name} (${b.vercel_project_id ?? ""})`);
    if (b.supabase_project_ref) parts.push(`Supabase: ${b.supabase_project_ref}`);
    if (b.storage_bucket) parts.push(`Storage: ${b.storage_bucket}`);
    parts.push(`Environment: ${b.environment}`);
  }

  // 4. Active project rules (overrides only, to keep prompt lean)
  const overrides = opts.rules.filter((r) => r.is_override);
  if (overrides.length > 0) {
    parts.push("\n## Project Rule Overrides");
    for (const rule of overrides) {
      parts.push(`${rule.rule_ref} (${rule.severity}): ${rule.rule_text}`);
    }
  }

  // 5. Pinned facts
  if (opts.pinnedFacts.length > 0) {
    parts.push("\n## Pinned Project Facts");
    for (const fact of opts.pinnedFacts) {
      parts.push(`${fact.key}: ${fact.value}`);
    }
  }

  // 6. Custom project context (free-form, from project.context_prompt)
  if (opts.contextPrompt) {
    parts.push("\n## Project Context");
    parts.push(opts.contextPrompt);
  }

  // 7. Custom system prompt override (from project_settings)
  if (opts.customSystemPrompt) {
    parts.push("\n## Custom Instructions");
    parts.push(opts.customSystemPrompt);
  }

  // 8. Proof requirement
  parts.push(
    "\n## Proof Requirement\n" +
    "No work is \"done\" until a proof record exists with status=Proven. " +
    "ImplementedButUnproven means the work is written but unverified. " +
    "Blocked means a dependency is missing. " +
    "Always classify your outputs using the correct proof status."
  );

  return parts.join("\n");
}

function hashContext(prompt: string): string {
  return crypto.createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}

// ── Main loader ───────────────────────────────────────────────────────────────

export interface LoadContextOptions {
  projectId: string;
  workspaceId?: string;
  sessionId?: string;
  conversationId?: string;
  forceRefresh?: boolean; // bypass cache
}

export interface LoadContextResult {
  context: ResolvedProjectContext | null;
  startupContext: ProjectStartupContext | null;
  cacheHit: boolean;
  error: string | null;
}

/**
 * The project startup context loader.
 *
 * Call this at the start of every session and before every governed action.
 * The returned ResolvedProjectContext is the single source of truth for
 * what project the current session belongs to and what its bindings are.
 *
 * @example
 * const { context, error } = await loadProjectContext({ projectId, workspaceId });
 * if (error || !context) return fail(error);
 * // context.bindings.github_repo — the repo to push to
 * // context.startupContext.system_prompt — inject into model call
 */
export async function loadProjectContext(
  opts: LoadContextOptions
): Promise<LoadContextResult> {
  const { projectId, workspaceId, sessionId, forceRefresh = false } = opts;

  try {
    // 1. Check cache first (unless forceRefresh)
    if (!forceRefresh) {
      const cached = await getValidStartupContext(projectId);
      if (cached.data) {
        await createAuditRecord({
          workspace_id: workspaceId,
          project_id: projectId,
          session_id: sessionId,
          event_type: "project_context.loaded",
          event_category: "system",
          summary: `Project context loaded (cache hit) for project ${projectId}`,
          detail: { projectId, cacheHit: true, contextHash: cached.data.context_hash },
          outcome: "success",
        });

        // We have a cached context but need the full resolved context object.
        // Fetch the underlying data to populate ResolvedProjectContext.
        const [project, settings, bindings, rules] = await Promise.all([
          getProjectById(projectId),
          getProjectSettings(projectId),
          getProjectBindings(projectId),
          getActiveProjectRules(projectId),
        ]);

        if (project.error || settings.error || bindings.error || rules.error) {
          // Cache hit but data fetch failed — proceed to fresh load below
        } else {
          return {
            context: {
              project: project.data!,
              settings: settings.data!,
              bindings: bindings.data!,
              rules: rules.data!,
              startupContext: cached.data,
            },
            startupContext: cached.data,
            cacheHit: true,
            error: null,
          };
        }
      }
    }

    // 2. Fresh load — fetch all project data in parallel
    const [projectResult, settingsResult, bindingsResult, rulesResult] =
      await Promise.all([
        getProjectById(projectId),
        getProjectSettings(projectId),
        getProjectBindings(projectId),
        getActiveProjectRules(projectId),
      ]);

    if (projectResult.error) {
      return { context: null, startupContext: null, cacheHit: false, error: projectResult.error.message };
    }

    const project = projectResult.data!;
    const settings = settingsResult.data;
    const bindings = bindingsResult.data;
    const rules = rulesResult.data ?? [];

    // 3. Assemble bindings summary
    const bindingsSummary: BindingsSummary = {
      github_repo: bindings?.github_repo ?? null,
      github_branch: bindings?.github_branch ?? null,
      vercel_project_id: bindings?.vercel_project_id ?? null,
      vercel_project_name: bindings?.vercel_project_name ?? null,
      supabase_project_ref: bindings?.supabase_project_ref ?? null,
      storage_bucket: bindings?.storage_bucket ?? null,
      environment: bindings?.environment ?? "production",
      verification_status: bindings?.verification_status ?? "unverified",
    };

    // 4. Assemble system prompt
    const pinnedFacts = settings?.pinned_facts ?? [];
    const systemPrompt = assembleSystemPrompt({
      projectName: project.name,
      activePhase: project.active_phase,
      contextPrompt: project.context_prompt,
      bindings: bindingsSummary,
      rules,
      pinnedFacts,
      customSystemPrompt: settings?.custom_system_prompt ?? null,
    });

    const contextHash = hashContext(systemPrompt);
    const validUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // 5. Save startup context
    const savedContext = await saveStartupContext({
      project_id: projectId,
      session_id: sessionId ?? null,
      workspace_id: workspaceId ?? project.workspace_id,
      system_prompt: systemPrompt,
      project_name: project.name,
      active_phase: project.active_phase,
      bindings_summary: bindingsSummary,
      active_rules: rules,
      pinned_facts: pinnedFacts,
      context_hash: contextHash,
      valid_until: validUntil,
    });

    if (savedContext.error) {
      // Non-fatal — continue without saving
      console.error("[loadProjectContext] Failed to save context:", savedContext.error);
    }

    // 6. Write audit record
    await createAuditRecord({
      workspace_id: workspaceId ?? project.workspace_id,
      project_id: projectId,
      session_id: sessionId,
      event_type: "project_context.loaded",
      event_category: "system",
      summary: `Project context assembled fresh for "${project.name}"`,
      detail: {
        projectId,
        projectName: project.name,
        activePhase: project.active_phase,
        ruleCount: rules.length,
        hasBindings: !!(bindings?.github_repo || bindings?.vercel_project_id),
        cacheHit: false,
        contextHash,
      },
      outcome: "success",
    });

    // 7. Classify proof state for this project's context
    const hasBindings = !!(bindings?.github_repo && bindings?.vercel_project_id);
    await proveSubject({
      subjectType: "project",
      subjectRef: `project/${projectId}/context`,
      claim: `Project context loaded and system prompt assembled for "${project.name}"`,
      status: hasBindings ? "Proven" : "ImplementedButUnproven",
      proofType: "runtime",
      proofDetail: hasBindings
        ? `Bindings verified: ${bindings?.github_repo} / ${bindings?.vercel_project_name}`
        : "Context assembled but no GitHub/Vercel bindings set — add bindings to fully prove",
      workspaceId: workspaceId ?? project.workspace_id,
      projectId,
    });

    const resolvedContext: ResolvedProjectContext = {
      project,
      settings: settings!,
      bindings: bindings!,
      rules,
      startupContext: savedContext.data ?? ({
        id: "",
        project_id: projectId,
        session_id: sessionId ?? null,
        workspace_id: workspaceId ?? project.workspace_id,
        system_prompt: systemPrompt,
        project_name: project.name,
        active_phase: project.active_phase,
        bindings_summary: bindingsSummary,
        active_rules: rules,
        pinned_facts: pinnedFacts,
        context_hash: contextHash,
        loaded_at: new Date().toISOString(),
        valid_until: validUntil,
        is_stale: false,
      } as ProjectStartupContext),
    };

    return {
      context: resolvedContext,
      startupContext: resolvedContext.startupContext,
      cacheHit: false,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await createAuditRecord({
      workspace_id: workspaceId,
      project_id: projectId,
      session_id: sessionId,
      event_type: "project_context.failed",
      event_category: "system",
      summary: `Project context load failed for ${projectId}: ${message}`,
      detail: { projectId, error: message },
      outcome: "failure",
      error: message,
    });

    return { context: null, startupContext: null, cacheHit: false, error: message };
  }
}

/**
 * resolveActiveProject — given a conversationId, returns the project it belongs to.
 * Returns null if the conversation is not assigned to any project.
 *
 * Used by: chat route, build route — any handler that receives a conversationId
 * and needs to load the correct project context.
 */
export async function resolveActiveProject(
  conversationId: string
): Promise<{ projectId: string | null; workspaceId: string | null }> {
  try {
    const db = (await import("@/lib/supabase/admin")).createAdminClient();

    // Check project_conversations (the assignment join table)
    const { data } = await db
      .from("project_conversations")
      .select("project_id, workspace_id")
      .eq("conversation_id", conversationId)
      .maybeSingle();

    if (data) {
      return { projectId: data.project_id, workspaceId: data.workspace_id };
    }

    // Also check project_sessions (server-side session record)
    const { data: session } = await db
      .from("project_sessions")
      .select("project_id, workspace_id")
      .eq("conversation_id", conversationId)
      .maybeSingle();

    if (session) {
      return { projectId: session.project_id, workspaceId: session.workspace_id };
    }

    return { projectId: null, workspaceId: null };
  } catch {
    return { projectId: null, workspaceId: null };
  }
}
