/**
 * src/lib/project-context/types.ts
 *
 * TypeScript contracts for the STREAMS Project Context Container (Phase 2).
 *
 * These types mirror the schema in:
 *   supabase/migrations/20260502_streams_project_context.sql
 *
 * The Project Context Container is the boundary within which every
 * STREAMS session operates. No session starts without resolving a
 * project context. No action executes without knowing which project
 * it belongs to.
 */

// ── Project (extended) ────────────────────────────────────────────────────────

export type ProjectStatus = "active" | "archived" | "paused";

export interface Project {
  id: string;
  workspace_id: string;
  owner_user_id: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  active_phase: string | null;
  context_prompt: string | null;
  rules_ref: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  workspace_id: string;
  name: string;
  description?: string;
  owner_user_id?: string;
  active_phase?: string;
  context_prompt?: string;
}

// ── Project Settings ──────────────────────────────────────────────────────────

export interface ProjectSettings {
  id: string;
  project_id: string;
  workspace_id: string;

  build_rules_version: string;
  enforce_audit_layer: boolean;
  require_proof_before_done: boolean;
  block_merge_on_critical: boolean;

  default_model: string;
  mini_model: string;
  max_context_tokens: number;
  temperature: number;

  auto_load_memory: boolean;
  auto_write_memory: boolean;
  session_summary_after_n: number;

  custom_system_prompt: string | null;
  pinned_facts: Array<{ key: string; value: string }>;

  created_at: string;
  updated_at: string;
}

export interface UpdateProjectSettingsInput {
  build_rules_version?: string;
  enforce_audit_layer?: boolean;
  require_proof_before_done?: boolean;
  block_merge_on_critical?: boolean;
  default_model?: string;
  mini_model?: string;
  max_context_tokens?: number;
  temperature?: number;
  auto_load_memory?: boolean;
  auto_write_memory?: boolean;
  session_summary_after_n?: number;
  custom_system_prompt?: string;
  pinned_facts?: Array<{ key: string; value: string }>;
}

// ── Project Rules ─────────────────────────────────────────────────────────────

export type RuleSeverity = "critical" | "high" | "medium" | "low";
export type RuleSource = "BUILD_RULES" | "FRONTEND_BUILD_RULES" | "project";

export interface ProjectRule {
  id: string;
  project_id: string;
  workspace_id: string;
  rule_ref: string;
  rule_source: RuleSource;
  rule_text: string;
  severity: RuleSeverity;
  is_override: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectRuleInput {
  project_id: string;
  workspace_id: string;
  rule_ref: string;
  rule_source?: RuleSource;
  rule_text: string;
  severity?: RuleSeverity;
  is_override?: boolean;
}

// ── Project Bindings ──────────────────────────────────────────────────────────

export type VerificationStatus = "verified" | "unverified" | "failed";
export type ProjectEnvironment = "development" | "staging" | "production";

export interface ProjectBindings {
  id: string;
  project_id: string;
  workspace_id: string;

  github_repo: string | null;
  github_branch: string | null;
  github_account_id: string | null;

  vercel_project_id: string | null;
  vercel_project_name: string | null;
  vercel_team_id: string | null;
  vercel_account_id: string | null;

  supabase_project_ref: string | null;
  supabase_project_url: string | null;
  supabase_account_id: string | null;

  storage_bucket: string | null;
  storage_prefix: string | null;

  environment: ProjectEnvironment;
  env_vars_hint: Record<string, string>;

  last_verified_at: string | null;
  verification_status: VerificationStatus;

  created_at: string;
  updated_at: string;
}

export interface UpdateProjectBindingsInput {
  github_repo?: string;
  github_branch?: string;
  github_account_id?: string;
  vercel_project_id?: string;
  vercel_project_name?: string;
  vercel_team_id?: string;
  vercel_account_id?: string;
  supabase_project_ref?: string;
  supabase_project_url?: string;
  supabase_account_id?: string;
  storage_bucket?: string;
  storage_prefix?: string;
  environment?: ProjectEnvironment;
  env_vars_hint?: Record<string, string>;
  verification_status?: VerificationStatus;
  last_verified_at?: string;
}

// ── Project Sessions ──────────────────────────────────────────────────────────

export type SessionMode = "chat" | "build" | "generate" | "review";
export type SessionStatus = "active" | "completed" | "abandoned";

export interface ProjectSession {
  id: string;
  project_id: string;
  workspace_id: string;
  user_id: string | null;
  conversation_id: string;
  title: string | null;
  mode: SessionMode;
  context_loaded_at: string | null;
  context_version: string | null;
  turn_count: number;
  last_turn_at: string | null;
  memory_written: boolean;
  summary_written: boolean;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectSessionInput {
  project_id: string;
  workspace_id: string;
  user_id?: string;
  conversation_id: string;
  title?: string;
  mode?: SessionMode;
}

// ── Startup Context ───────────────────────────────────────────────────────────

export interface ProjectStartupContext {
  id: string;
  project_id: string;
  session_id: string | null;
  workspace_id: string;
  system_prompt: string;
  project_name: string;
  active_phase: string | null;
  bindings_summary: BindingsSummary;
  active_rules: ProjectRule[];
  pinned_facts: Array<{ key: string; value: string }>;
  context_hash: string;
  loaded_at: string;
  valid_until: string;
  is_stale: boolean;
}

export interface BindingsSummary {
  github_repo: string | null;
  github_branch: string | null;
  vercel_project_id: string | null;
  vercel_project_name: string | null;
  supabase_project_ref: string | null;
  storage_bucket: string | null;
  environment: string;
  verification_status: string;
}

// ── Resolved project context (runtime object used per-request) ────────────────

export interface ResolvedProjectContext {
  project: Project;
  settings: ProjectSettings;
  bindings: ProjectBindings;
  rules: ProjectRule[];
  startupContext: ProjectStartupContext;
}

// ── Repository result ─────────────────────────────────────────────────────────

export type ProjectResult<T> =
  | { data: T; error: null }
  | { data: null; error: { code: string; message: string; detail?: string } };

export function projectOk<T>(data: T): ProjectResult<T> {
  return { data, error: null };
}

export function projectErr(code: string, message: string, detail?: string): ProjectResult<never> {
  return { data: null, error: { code, message, detail } };
}
