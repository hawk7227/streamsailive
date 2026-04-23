/**
 * src/lib/project-context/index.ts
 *
 * Public API for the STREAMS Project Context Container (Phase 2).
 *
 * Import from here in all application code:
 *   import { loadProjectContext, resolveActiveProject } from "@/lib/project-context"
 */

export {
  loadProjectContext,
  resolveActiveProject,
} from "./loader";

export type { LoadContextOptions, LoadContextResult } from "./loader";

export {
  createProject,
  getProjectById,
  listProjects,
  updateProject,
  getProjectSettings,
  updateProjectSettings,
  getActiveProjectRules,
  upsertProjectRule,
  getProjectBindings,
  updateProjectBindings,
  upsertProjectSession,
  incrementSessionTurn,
  getSessionByConversationId,
  listProjectSessions,
  getValidStartupContext,
  saveStartupContext,
} from "./repository";

export type {
  Project,
  ProjectStatus,
  ProjectSettings,
  UpdateProjectSettingsInput,
  ProjectRule,
  CreateProjectRuleInput,
  RuleSeverity,
  RuleSource,
  ProjectBindings,
  UpdateProjectBindingsInput,
  VerificationStatus,
  ProjectEnvironment,
  ProjectSession,
  CreateProjectSessionInput,
  SessionMode,
  SessionStatus,
  ProjectStartupContext,
  BindingsSummary,
  ResolvedProjectContext,
  CreateProjectInput,
  ProjectResult,
} from "./types";

export { projectOk, projectErr } from "./types";
