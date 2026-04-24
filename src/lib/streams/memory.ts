/**
 * src/lib/streams/memory.ts
 *
 * Runtime memory helper for the Streams Memory System (Phase 3).
 *
 * Two operations:
 *   loadProjectMemory(admin, workspaceId, projectId?)
 *     → returns everything needed to start a session
 *
 *   writeSessionHandoff(admin, workspaceId, projectId, handoff)
 *     → persists end-of-session state for next session to load
 *
 * Loaded at the start of every build/chat session.
 * Written at session end or on explicit save.
 *
 * Memory budget: top 20 rules + last 10 decisions + last 5 issues
 * + latest handoff + all pinned facts. Fits in one context block.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MemoryRule {
  id: string;
  ruleText: string;
  category: string;
  priority: number;
}

export interface DecisionEntry {
  id: string;
  decisionText: string;
  rationale: string | null;
  outcome: string;
  madeAt: string;
}

export interface IssueEntry {
  id: string;
  issueSummary: string;
  issueDetail: string | null;
  resolution: string | null;
  status: string;
  category: string;
  occurredAt: string;
}

export interface PinnedFact {
  factKey: string;
  factValue: string;
  isSensitive: boolean;
}

export interface LatestHandoff {
  handoffText: string;
  lastCommit: string | null;
  lastVercelStatus: string | null;
  violationCount: number;
  pendingItems: string[];
  generatedAt: string;
}

export interface SessionSummary {
  sessionId: string;
  summaryText: string;
  completed: string[];
  inProgress: string[];
  nextSteps: string[];
  filesTouched: string[];
  lastCommit: string | null;
  vercelGreen: boolean | null;
  createdAt: string;
}

export interface ProjectMemory {
  rules: MemoryRule[];
  recentDecisions: DecisionEntry[];
  openIssues: IssueEntry[];
  pinnedFacts: PinnedFact[];
  latestHandoff: LatestHandoff | null;
  lastSession: SessionSummary | null;
}

export interface HandoffInput {
  sessionId: string;
  handoffText: string;
  lastCommit?: string;
  lastVercelStatus?: string;
  violationCount?: number;
  pendingItems?: string[];
  summary: {
    summaryText: string;
    completed: string[];
    inProgress: string[];
    nextSteps: string[];
    filesTouched: string[];
    vercelGreen?: boolean;
  };
}

// ── Load ──────────────────────────────────────────────────────────────────────

export async function loadProjectMemory(
  admin: SupabaseClient,
  workspaceId: string,
  projectId?: string | null,
): Promise<ProjectMemory> {

  // Build base filters
  const wsFilter = (q: ReturnType<SupabaseClient["from"]>) =>
    q.eq("workspace_id", workspaceId);

  const projFilter = (q: ReturnType<SupabaseClient["from"]>) =>
    projectId
      ? q.eq("project_id", projectId)
      : q.is("project_id", null);

  // 1. Memory rules — top 20 by priority
  const { data: rulesRaw } = await admin
    .from("project_memory_rules")
    .select("id, rule_text, category, priority")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .limit(20);

  const rules: MemoryRule[] = (rulesRaw ?? []).map((r: Record<string, unknown>) => ({
    id:       r.id as string,
    ruleText: r.rule_text as string,
    category: r.category as string,
    priority: r.priority as number,
  }));

  // 2. Recent decisions — last 10, non-reverted
  const decisionsQuery = admin
    .from("decision_log")
    .select("id, decision_text, rationale, outcome, made_at")
    .eq("workspace_id", workspaceId)
    .neq("outcome", "reverted")
    .order("made_at", { ascending: false })
    .limit(10);

  const { data: decisionsRaw } = projectId
    ? await decisionsQuery.eq("project_id", projectId)
    : await decisionsQuery;

  const recentDecisions: DecisionEntry[] = (decisionsRaw ?? []).map((d: Record<string, unknown>) => ({
    id:           d.id as string,
    decisionText: d.decision_text as string,
    rationale:    d.rationale as string | null,
    outcome:      d.outcome as string,
    madeAt:       d.made_at as string,
  }));

  // 3. Open issues — last 5
  const issuesQuery = admin
    .from("issue_history")
    .select("id, issue_summary, issue_detail, resolution, status, category, occurred_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "open")
    .order("occurred_at", { ascending: false })
    .limit(5);

  const { data: issuesRaw } = projectId
    ? await issuesQuery.eq("project_id", projectId)
    : await issuesQuery;

  const openIssues: IssueEntry[] = (issuesRaw ?? []).map((i: Record<string, unknown>) => ({
    id:           i.id as string,
    issueSummary: i.issue_summary as string,
    issueDetail:  i.issue_detail as string | null,
    resolution:   i.resolution as string | null,
    status:       i.status as string,
    category:     i.category as string,
    occurredAt:   i.occurred_at as string,
  }));

  // 4. Pinned facts — all of them
  const pinnedQuery = projectId
    ? admin
        .from("pinned_project_facts")
        .select("fact_key, fact_value, is_sensitive")
        .eq("project_id", projectId)
    : admin
        .from("pinned_project_facts")
        .select("fact_key, fact_value, is_sensitive")
        .eq("workspace_id", workspaceId)
        .is("project_id", null);

  const { data: factsRaw } = await pinnedQuery;

  const pinnedFacts: PinnedFact[] = (factsRaw ?? []).map((f: Record<string, unknown>) => ({
    factKey:     f.fact_key as string,
    factValue:   f.is_sensitive ? "[hidden]" : f.fact_value as string,
    isSensitive: f.is_sensitive as boolean,
  }));

  // 5. Latest handoff
  let latestHandoff: LatestHandoff | null = null;
  if (projectId) {
    const { data: handoffRaw } = await admin
      .from("latest_handoffs")
      .select("handoff_text, last_commit, last_vercel_status, violation_count, pending_items, generated_at")
      .eq("project_id", projectId)
      .maybeSingle();

    if (handoffRaw) {
      latestHandoff = {
        handoffText:       handoffRaw.handoff_text as string,
        lastCommit:        handoffRaw.last_commit as string | null,
        lastVercelStatus:  handoffRaw.last_vercel_status as string | null,
        violationCount:    handoffRaw.violation_count as number,
        pendingItems:      handoffRaw.pending_items as string[],
        generatedAt:       handoffRaw.generated_at as string,
      };
    }
  }

  // 6. Last session summary
  let lastSession: SessionSummary | null = null;
  const summaryQuery = admin
    .from("session_summaries")
    .select("session_id, summary_text, completed, in_progress, next_steps, files_touched, last_commit, vercel_green, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: summaryRaw } = projectId
    ? await (summaryQuery.eq("project_id", projectId))
    : await summaryQuery;

  if (summaryRaw && summaryRaw[0]) {
    const s = summaryRaw[0] as Record<string, unknown>;
    lastSession = {
      sessionId:    s.session_id as string,
      summaryText:  s.summary_text as string,
      completed:    s.completed as string[],
      inProgress:   s.in_progress as string[],
      nextSteps:    s.next_steps as string[],
      filesTouched: s.files_touched as string[],
      lastCommit:   s.last_commit as string | null,
      vercelGreen:  s.vercel_green as boolean | null,
      createdAt:    s.created_at as string,
    };
  }

  return { rules, recentDecisions, openIssues, pinnedFacts, latestHandoff, lastSession };
}

// ── Write handoff ─────────────────────────────────────────────────────────────

export async function writeSessionHandoff(
  admin: SupabaseClient,
  workspaceId: string,
  projectId: string,
  userId: string,
  input: HandoffInput,
): Promise<{ handoffId: string; summaryId: string }> {

  // Upsert latest_handoffs — one row per project
  const { data: handoffRow, error: handoffError } = await admin
    .from("latest_handoffs")
    .upsert({
      workspace_id:        workspaceId,
      project_id:          projectId,
      handoff_text:        input.handoffText,
      last_commit:         input.lastCommit ?? null,
      last_vercel_status:  input.lastVercelStatus ?? null,
      violation_count:     input.violationCount ?? 0,
      pending_items:       input.pendingItems ?? [],
      generated_at:        new Date().toISOString(),
      generated_by:        userId,
    }, { onConflict: "project_id" })
    .select("id")
    .single();

  if (handoffError) throw new Error(`Handoff upsert failed: ${handoffError.message}`);

  // Insert session_summaries — one row per session
  const { data: summaryRow, error: summaryError } = await admin
    .from("session_summaries")
    .insert({
      workspace_id: workspaceId,
      project_id:   projectId,
      session_id:   input.sessionId,
      summary_text: input.summary.summaryText,
      completed:    input.summary.completed,
      in_progress:  input.summary.inProgress,
      next_steps:   input.summary.nextSteps,
      files_touched: input.summary.filesTouched,
      last_commit:  input.lastCommit ?? null,
      vercel_green: input.summary.vercelGreen ?? null,
    })
    .select("id")
    .single();

  if (summaryError) throw new Error(`Summary insert failed: ${summaryError.message}`);

  return {
    handoffId: handoffRow.id as string,
    summaryId: summaryRow.id as string,
  };
}

// ── Log decision ──────────────────────────────────────────────────────────────

export async function logDecision(
  admin: SupabaseClient,
  workspaceId: string,
  projectId: string | null,
  userId: string,
  sessionId: string,
  decisionText: string,
  rationale?: string,
): Promise<string> {
  const { data, error } = await admin
    .from("decision_log")
    .insert({
      workspace_id:  workspaceId,
      project_id:    projectId,
      session_id:    sessionId,
      decision_text: decisionText,
      rationale:     rationale ?? null,
      outcome:       "pending",
      made_by:       userId,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Decision log failed: ${error.message}`);
  return data.id as string;
}

// ── Log issue ─────────────────────────────────────────────────────────────────

export async function logIssue(
  admin: SupabaseClient,
  workspaceId: string,
  projectId: string | null,
  sessionId: string,
  issueSummary: string,
  options?: {
    issueDetail?: string;
    category?: string;
  },
): Promise<string> {
  const { data, error } = await admin
    .from("issue_history")
    .insert({
      workspace_id:  workspaceId,
      project_id:    projectId,
      session_id:    sessionId,
      issue_summary: issueSummary,
      issue_detail:  options?.issueDetail ?? null,
      category:      options?.category ?? "build",
      status:        "open",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Issue log failed: ${error.message}`);
  return data.id as string;
}

// ── Resolve issue ─────────────────────────────────────────────────────────────

export async function resolveIssue(
  admin: SupabaseClient,
  issueId: string,
  resolution: string,
): Promise<void> {
  const { error } = await admin
    .from("issue_history")
    .update({
      status:      "resolved",
      resolution,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", issueId);

  if (error) throw new Error(`Issue resolve failed: ${error.message}`);
}

// ── Format memory for context injection ──────────────────────────────────────

export function formatMemoryForContext(memory: ProjectMemory): string {
  const parts: string[] = [];

  if (memory.pinnedFacts.length > 0) {
    parts.push("## Pinned Facts");
    memory.pinnedFacts.forEach(f => {
      parts.push(`${f.factKey}: ${f.factValue}`);
    });
  }

  if (memory.latestHandoff) {
    parts.push("\n## Last Session Handoff");
    parts.push(`Commit: ${memory.latestHandoff.lastCommit ?? "unknown"}`);
    parts.push(`Vercel: ${memory.latestHandoff.lastVercelStatus ?? "unknown"}`);
    parts.push(`Violations at handoff: ${memory.latestHandoff.violationCount}`);
    if (memory.latestHandoff.pendingItems.length > 0) {
      parts.push("Pending:");
      memory.latestHandoff.pendingItems.forEach(p => parts.push(`  - ${p}`));
    }
  }

  if (memory.rules.length > 0) {
    parts.push("\n## Project Rules");
    memory.rules.forEach(r => {
      parts.push(`[${r.category}] ${r.ruleText}`);
    });
  }

  if (memory.openIssues.length > 0) {
    parts.push("\n## Open Issues");
    memory.openIssues.forEach(i => {
      parts.push(`[${i.category}] ${i.issueSummary}`);
      if (i.issueDetail) parts.push(`  Detail: ${i.issueDetail}`);
    });
  }

  if (memory.recentDecisions.length > 0) {
    parts.push("\n## Recent Decisions");
    memory.recentDecisions.slice(0, 5).forEach(d => {
      parts.push(`${d.decisionText} (${d.outcome})`);
    });
  }

  return parts.join("\n");
}
