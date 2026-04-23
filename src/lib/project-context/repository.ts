/**
 * src/lib/project-context/repository.ts
 *
 * Database access layer for the STREAMS Project Context Container.
 * All reads and writes to project_settings, project_rules, project_bindings,
 * project_sessions, and project_startup_context go through this file.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Project,
  ProjectSettings,
  ProjectRule,
  ProjectBindings,
  ProjectSession,
  ProjectStartupContext,
  CreateProjectInput,
  UpdateProjectSettingsInput,
  CreateProjectRuleInput,
  UpdateProjectBindingsInput,
  CreateProjectSessionInput,
  ProjectResult,
} from "./types";
import { projectOk, projectErr } from "./types";

// ── Projects ──────────────────────────────────────────────────────────────────

export async function createProject(
  input: CreateProjectInput
): Promise<ProjectResult<Project>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("projects")
      .insert({
        workspace_id: input.workspace_id,
        name: input.name,
        description: input.description ?? null,
        owner_user_id: input.owner_user_id ?? null,
        active_phase: input.active_phase ?? null,
        context_prompt: input.context_prompt ?? null,
        status: "active",
      })
      .select()
      .single();

    if (error) return projectErr("DB_ERROR", error.message, error.code);
    return projectOk(data as Project);
  } catch (err) {
    return projectErr("UNEXPECTED", String(err));
  }
}

export async function getProjectById(
  projectId: string
): Promise<ProjectResult<Project>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("projects")
      .select()
      .eq("id", projectId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return projectErr("NOT_FOUND", `Project ${projectId} not found`);
      return projectErr("DB_ERROR", error.message);
    }
    return projectOk(data as Project);
  } catch (err) {
    return projectErr("UNEXPECTED", String(err));
  }
}

export async function listProjects(
  workspaceId: string
): Promise<ProjectResult<Project[]>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("projects")
      .select()
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .order("updated_at", { ascending: false });

    if (error) return projectErr("DB_ERROR", error.message);
    return projectOk((data ?? []) as Project[]);
  } catch (err) {
    return projectErr("UNEXPECTED", String(err));
  }
}

export async function updateProject(
  projectId: string,
  updates: Partial<Pick<Project, "name" | "description" | "status" | "active_phase" | "context_prompt">>
): Promise<ProjectResult<Project>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("projects")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", projectId)
      .select()
      .single();

    if (error) return projectErr("DB_ERROR", error.message);
    return projectOk(data as Project);
  } catch (err) {
    return projectErr("UNEXPECTED", String(err));
  }
}

// ── Project Settings ──────────────────────────────────────────────────────────

export async function getProjectSettings(
  projectId: string
): Promise<ProjectResult<ProjectSettings>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("project_settings")
      .select()
      .eq("project_id", projectId)
      .single();

    if (error) return projectErr("DB_ERROR", error.message);
    return projectOk(data as ProjectSettings);
  } catch (err) {
    return projectErr("UNEXPECTED", String(err));
  }
}

export async function updateProjectSettings(
  projectId: string,
  updates: UpdateProjectSettingsInput
): Promise<ProjectResult<ProjectSettings>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("project_settings")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .select()
      .single();

    if (error) return projectErr("DB_ERROR", error.message);
    return projectOk(data as ProjectSettings);
  } catch (err) {
    return projectErr("UNEXPECTED", String(err));
  }
}

// ── Project Rules ─────────────────────────────────────────────────────────────

export async function getActiveProjectRules(
  projectId: string
): Promise<ProjectResult<ProjectRule[]>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("project_rules")
      .select()
      .eq("project_id", projectId)
      .eq("is_active", true)
      .order("severity", { ascending: true });

    if (error) return projectErr("DB_ERROR", error.message);
    return projectOk((data ?? []) as ProjectRule[]);
  } catch (err) {
    return projectErr("UNEXPECTED", String(err));
  }
}

export async function upsertProjectRule(
  input: CreateProjectRuleInput
): Promise<ProjectResult<ProjectRule>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("project_rules")
      .upsert({
        project_id: input.project_id,
        workspace_id: input.workspace_id,
        rule_ref: input.rule_ref,
        rule_source: input.rule_source ?? "project",
        rule_text: input.rule_text,
        severity: input.severity ?? "high",
        is_override: input.is_override ?? false,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "project_id,rule_ref" })
      .select()
      .single();

    if (error) return projectErr("DB_ERROR", error.message);
    return projectOk(data as ProjectRule);
  } catch (err) {
    return projectErr("UNEXPECTED", String(err));
  }
}

// ── Project Bindings ──────────────────────────────────────────────────────────

export async function getProjectBindings(
  projectId: string
): Promise<ProjectResult<ProjectBindings>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("project_bindings")
      .select()
      .eq("project_id", projectId)
      .single();

    if (error) return projectErr("DB_ERROR", error.message);
    return projectOk(data as ProjectBindings);
  } catch (err) {
    return projectErr("UNEXPECTED", String(err));
  }
}

export async function updateProjectBindings(
  projectId: string,
  updates: UpdateProjectBindingsInput
): Promise<ProjectResult<ProjectBindings>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("project_bindings")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .select()
      .single();

    if (error) return projectErr("DB_ERROR", error.message);
    return projectOk(data as ProjectBindings);
  } catch (err) {
    return projectErr("UNEXPECTED", String(err));
  }
}

// ── Project Sessions ──────────────────────────────────────────────────────────

export async function upsertProjectSession(
  input: CreateProjectSessionInput
): Promise<ProjectResult<ProjectSession>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("project_sessions")
      .upsert({
        project_id: input.project_id,
        workspace_id: input.workspace_id,
        user_id: input.user_id ?? null,
        conversation_id: input.conversation_id,
        title: input.title ?? null,
        mode: input.mode ?? "chat",
        status: "active",
        updated_at: new Date().toISOString(),
      }, { onConflict: "conversation_id" })
      .select()
      .single();

    if (error) return projectErr("DB_ERROR", error.message);
    return projectOk(data as ProjectSession);
  } catch (err) {
    return projectErr("UNEXPECTED", String(err));
  }
}

export async function incrementSessionTurn(
  conversationId: string
): Promise<ProjectResult<ProjectSession>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db.rpc("increment_session_turn", {
      p_conversation_id: conversationId,
    });

    if (error) {
      // Fallback: manual increment
      const session = await db
        .from("project_sessions")
        .select("turn_count")
        .eq("conversation_id", conversationId)
        .single();

      if (session.error) return projectErr("DB_ERROR", session.error.message);

      const updated = await db
        .from("project_sessions")
        .update({
          turn_count: (session.data?.turn_count ?? 0) + 1,
          last_turn_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("conversation_id", conversationId)
        .select()
        .single();

      if (updated.error) return projectErr("DB_ERROR", updated.error.message);
      return projectOk(updated.data as ProjectSession);
    }

    return projectOk(data as ProjectSession);
  } catch (err) {
    return projectErr("UNEXPECTED", String(err));
  }
}

export async function getSessionByConversationId(
  conversationId: string
): Promise<ProjectResult<ProjectSession | null>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("project_sessions")
      .select()
      .eq("conversation_id", conversationId)
      .maybeSingle();

    if (error) return projectErr("DB_ERROR", error.message);
    return projectOk(data as ProjectSession | null);
  } catch (err) {
    return projectErr("UNEXPECTED", String(err));
  }
}

export async function listProjectSessions(
  projectId: string,
  limit = 20
): Promise<ProjectResult<ProjectSession[]>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("project_sessions")
      .select()
      .eq("project_id", projectId)
      .order("last_turn_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) return projectErr("DB_ERROR", error.message);
    return projectOk((data ?? []) as ProjectSession[]);
  } catch (err) {
    return projectErr("UNEXPECTED", String(err));
  }
}

// ── Startup Context ───────────────────────────────────────────────────────────

export async function getValidStartupContext(
  projectId: string
): Promise<ProjectResult<ProjectStartupContext | null>> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("project_startup_context")
      .select()
      .eq("project_id", projectId)
      .eq("is_stale", false)
      .gt("valid_until", new Date().toISOString())
      .order("loaded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return projectErr("DB_ERROR", error.message);
    return projectOk(data as ProjectStartupContext | null);
  } catch (err) {
    return projectErr("UNEXPECTED", String(err));
  }
}

export async function saveStartupContext(
  ctx: Omit<ProjectStartupContext, "id" | "loaded_at" | "is_stale">
): Promise<ProjectResult<ProjectStartupContext>> {
  try {
    const db = createAdminClient();

    // Invalidate old contexts for this project
    await db
      .from("project_startup_context")
      .update({ is_stale: true })
      .eq("project_id", ctx.project_id)
      .eq("is_stale", false);

    const { data, error } = await db
      .from("project_startup_context")
      .insert({
        project_id: ctx.project_id,
        session_id: ctx.session_id,
        workspace_id: ctx.workspace_id,
        system_prompt: ctx.system_prompt,
        project_name: ctx.project_name,
        active_phase: ctx.active_phase,
        bindings_summary: ctx.bindings_summary,
        active_rules: ctx.active_rules,
        pinned_facts: ctx.pinned_facts,
        context_hash: ctx.context_hash,
        valid_until: ctx.valid_until,
      })
      .select()
      .single();

    if (error) return projectErr("DB_ERROR", error.message);
    return projectOk(data as ProjectStartupContext);
  } catch (err) {
    return projectErr("UNEXPECTED", String(err));
  }
}
