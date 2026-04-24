/**
 * src/lib/streams/tasks.ts
 *
 * Runtime helper for the Task + Assignment Engine (Phase 5).
 *
 * Core operations:
 *   createTask()         — create a task, write history entry
 *   updateTaskStatus()   — transition status, validate deps, write history
 *   assignTask()         — assign owner, write history
 *   blockTask()          — set blocked + reason, write history
 *   unblockTask()        — clear block, write history
 *   approveTask()        — set approval state, write history
 *   addDependency()      — add depends_on entry, write history
 *   linkArtifact()       — link task ↔ artifact
 *   linkProof()          — link task ↔ proof_record
 *   getTask()            — load task with history
 *   listTasks()          — list tasks filtered by status/priority/owner
 *   getDependencyStatus()— check if all dependencies are done
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TaskStatus =
  | "backlog" | "todo" | "in_progress" | "blocked"
  | "in_review" | "approved" | "done" | "cancelled";

export type TaskPriority = "critical" | "high" | "medium" | "low" | "none";

export type TaskOwnerType = "user" | "ai" | "system";

export type TaskApprovalState =
  | "not_required" | "pending" | "approved" | "rejected";

export interface TaskRow {
  id:              string;
  workspaceId:     string;
  projectId:       string | null;
  title:           string;
  description:     string | null;
  status:          TaskStatus;
  priority:        TaskPriority;
  ownerType:       TaskOwnerType;
  ownerUserId:     string | null;
  approvalState:   TaskApprovalState;
  approvedBy:      string | null;
  approvedAt:      string | null;
  rejectionReason: string | null;
  blockedReason:   string | null;
  nextStep:        string | null;
  dependsOn:       string[];
  isRecurring:     boolean;
  recurrenceRule:  string | null;
  nextDueAt:       string | null;
  dueAt:           string | null;
  startedAt:       string | null;
  completedAt:     string | null;
  proofRecordId:   string | null;
  sessionId:       string | null;
  tags:            string[];
  createdAt:       string;
  updatedAt:       string;
}

export interface TaskHistoryRow {
  id:          string;
  taskId:      string;
  workspaceId: string;
  eventType:   string;
  fromValue:   string | null;
  toValue:     string | null;
  note:        string | null;
  actorType:   TaskOwnerType;
  actorUserId: string | null;
  sessionId:   string | null;
  occurredAt:  string;
}

export interface TaskWithHistory extends TaskRow {
  history: TaskHistoryRow[];
}

export interface CreateTaskInput {
  workspaceId:    string;
  projectId?:     string | null;
  title:          string;
  description?:   string;
  priority?:      TaskPriority;
  ownerType?:     TaskOwnerType;
  ownerUserId?:   string;
  approvalState?: TaskApprovalState;
  dependsOn?:     string[];
  dueAt?:         string;
  nextStep?:      string;
  tags?:          string[];
  sessionId?:     string;
  isRecurring?:   boolean;
  recurrenceRule?: string;
  nextDueAt?:     string;
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapTask(r: Record<string, unknown>): TaskRow {
  return {
    id:              r.id as string,
    workspaceId:     r.workspace_id as string,
    projectId:       r.project_id as string | null,
    title:           r.title as string,
    description:     r.description as string | null,
    status:          r.status as TaskStatus,
    priority:        r.priority as TaskPriority,
    ownerType:       r.owner_type as TaskOwnerType,
    ownerUserId:     r.owner_user_id as string | null,
    approvalState:   r.approval_state as TaskApprovalState,
    approvedBy:      r.approved_by as string | null,
    approvedAt:      r.approved_at as string | null,
    rejectionReason: r.rejection_reason as string | null,
    blockedReason:   r.blocked_reason as string | null,
    nextStep:        r.next_step as string | null,
    dependsOn:       r.depends_on as string[],
    isRecurring:     r.is_recurring as boolean,
    recurrenceRule:  r.recurrence_rule as string | null,
    nextDueAt:       r.next_due_at as string | null,
    dueAt:           r.due_at as string | null,
    startedAt:       r.started_at as string | null,
    completedAt:     r.completed_at as string | null,
    proofRecordId:   r.proof_record_id as string | null,
    sessionId:       r.session_id as string | null,
    tags:            r.tags as string[],
    createdAt:       r.created_at as string,
    updatedAt:       r.updated_at as string,
  };
}

function mapHistory(r: Record<string, unknown>): TaskHistoryRow {
  return {
    id:          r.id as string,
    taskId:      r.task_id as string,
    workspaceId: r.workspace_id as string,
    eventType:   r.event_type as string,
    fromValue:   r.from_value as string | null,
    toValue:     r.to_value as string | null,
    note:        r.note as string | null,
    actorType:   r.actor_type as TaskOwnerType,
    actorUserId: r.actor_user_id as string | null,
    sessionId:   r.session_id as string | null,
    occurredAt:  r.occurred_at as string,
  };
}

// ── Write history entry ───────────────────────────────────────────────────────

async function writeHistory(
  admin: SupabaseClient,
  taskId: string,
  workspaceId: string,
  eventType: string,
  options: {
    fromValue?: string;
    toValue?: string;
    note?: string;
    actorType?: TaskOwnerType;
    actorUserId?: string | null;
    sessionId?: string | null;
  } = {},
): Promise<void> {
  await admin.from("task_history").insert({
    task_id:       taskId,
    workspace_id:  workspaceId,
    event_type:    eventType,
    from_value:    options.fromValue ?? null,
    to_value:      options.toValue ?? null,
    note:          options.note ?? null,
    actor_type:    options.actorType ?? "system",
    actor_user_id: options.actorUserId ?? null,
    session_id:    options.sessionId ?? null,
  });
}

// ── Create task ───────────────────────────────────────────────────────────────

export async function createTask(
  admin: SupabaseClient,
  userId: string,
  input: CreateTaskInput,
): Promise<TaskRow> {
  const { data: raw, error } = await admin
    .from("tasks")
    .insert({
      workspace_id:    input.workspaceId,
      project_id:      input.projectId ?? null,
      title:           input.title,
      description:     input.description ?? null,
      status:          "backlog",
      priority:        input.priority ?? "medium",
      owner_type:      input.ownerType ?? "ai",
      owner_user_id:   input.ownerUserId ?? null,
      approval_state:  input.approvalState ?? "not_required",
      depends_on:      input.dependsOn ?? [],
      due_at:          input.dueAt ?? null,
      next_step:       input.nextStep ?? null,
      tags:            input.tags ?? [],
      session_id:      input.sessionId ?? null,
      is_recurring:    input.isRecurring ?? false,
      recurrence_rule: input.recurrenceRule ?? null,
      next_due_at:     input.nextDueAt ?? null,
      created_by:      userId,
    })
    .select()
    .single();

  if (error) throw new Error(`Task create failed: ${error.message}`);

  const task = mapTask(raw as Record<string, unknown>);

  await writeHistory(admin, task.id, input.workspaceId, "created", {
    toValue:     "backlog",
    note:        input.title,
    actorType:   "user",
    actorUserId: userId,
    sessionId:   input.sessionId,
  });

  return task;
}

// ── Update task status ────────────────────────────────────────────────────────

export async function updateTaskStatus(
  admin: SupabaseClient,
  taskId: string,
  workspaceId: string,
  newStatus: TaskStatus,
  options: {
    actorType?: TaskOwnerType;
    actorUserId?: string;
    note?: string;
    sessionId?: string;
  } = {},
): Promise<TaskRow> {
  // Check dependencies if moving to in_progress
  if (newStatus === "in_progress") {
    const { blocked, unfinished } = await getDependencyStatus(admin, taskId, workspaceId);
    if (blocked) {
      throw new Error(
        `Cannot start: ${unfinished.length} dependency(ies) not done: ${unfinished.join(", ")}`
      );
    }
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status:     newStatus,
    updated_at: now,
  };

  if (newStatus === "in_progress") updates.started_at = now;
  if (newStatus === "done" || newStatus === "cancelled") updates.completed_at = now;
  if (newStatus !== "blocked") updates.blocked_reason = null;

  const { data: current } = await admin
    .from("tasks")
    .select("status")
    .eq("id", taskId)
    .eq("workspace_id", workspaceId)
    .single();

  const { data: raw, error } = await admin
    .from("tasks")
    .update(updates)
    .eq("id", taskId)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error) throw new Error(`Status update failed: ${error.message}`);

  await writeHistory(admin, taskId, workspaceId, "status_changed", {
    fromValue:   current?.status as string,
    toValue:     newStatus,
    note:        options.note,
    actorType:   options.actorType ?? "user",
    actorUserId: options.actorUserId,
    sessionId:   options.sessionId,
  });

  return mapTask(raw as Record<string, unknown>);
}

// ── Assign task ───────────────────────────────────────────────────────────────

export async function assignTask(
  admin: SupabaseClient,
  taskId: string,
  workspaceId: string,
  ownerType: TaskOwnerType,
  options: {
    ownerUserId?: string;
    actorUserId?: string;
    sessionId?: string;
  } = {},
): Promise<TaskRow> {
  const { data: raw, error } = await admin
    .from("tasks")
    .update({
      owner_type:    ownerType,
      owner_user_id: options.ownerUserId ?? null,
      updated_at:    new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error) throw new Error(`Assign failed: ${error.message}`);

  await writeHistory(admin, taskId, workspaceId, "assigned", {
    toValue:     `${ownerType}${options.ownerUserId ? `:${options.ownerUserId}` : ""}`,
    actorType:   "user",
    actorUserId: options.actorUserId,
    sessionId:   options.sessionId,
  });

  return mapTask(raw as Record<string, unknown>);
}

// ── Block task ────────────────────────────────────────────────────────────────

export async function blockTask(
  admin: SupabaseClient,
  taskId: string,
  workspaceId: string,
  reason: string,
  options: { actorUserId?: string; sessionId?: string } = {},
): Promise<TaskRow> {
  const { data: raw, error } = await admin
    .from("tasks")
    .update({
      status:         "blocked",
      blocked_reason: reason,
      updated_at:     new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error) throw new Error(`Block failed: ${error.message}`);

  await writeHistory(admin, taskId, workspaceId, "blocked", {
    toValue:     reason,
    actorType:   options.actorUserId ? "user" : "system",
    actorUserId: options.actorUserId,
    sessionId:   options.sessionId,
  });

  return mapTask(raw as Record<string, unknown>);
}

// ── Unblock task ──────────────────────────────────────────────────────────────

export async function unblockTask(
  admin: SupabaseClient,
  taskId: string,
  workspaceId: string,
  options: { actorUserId?: string; note?: string; sessionId?: string } = {},
): Promise<TaskRow> {
  const { data: raw, error } = await admin
    .from("tasks")
    .update({
      status:         "todo",
      blocked_reason: null,
      updated_at:     new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error) throw new Error(`Unblock failed: ${error.message}`);

  await writeHistory(admin, taskId, workspaceId, "unblocked", {
    note:        options.note,
    actorType:   options.actorUserId ? "user" : "system",
    actorUserId: options.actorUserId,
    sessionId:   options.sessionId,
  });

  return mapTask(raw as Record<string, unknown>);
}

// ── Approve task ──────────────────────────────────────────────────────────────

export async function approveTask(
  admin: SupabaseClient,
  taskId: string,
  workspaceId: string,
  approverUserId: string,
  options: { sessionId?: string } = {},
): Promise<TaskRow> {
  const now = new Date().toISOString();
  const { data: raw, error } = await admin
    .from("tasks")
    .update({
      approval_state: "approved",
      approved_by:    approverUserId,
      approved_at:    now,
      status:         "approved",
      updated_at:     now,
    })
    .eq("id", taskId)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error) throw new Error(`Approve failed: ${error.message}`);

  await writeHistory(admin, taskId, workspaceId, "approved", {
    actorType:   "user",
    actorUserId: approverUserId,
    sessionId:   options.sessionId,
  });

  return mapTask(raw as Record<string, unknown>);
}

// ── Reject task ───────────────────────────────────────────────────────────────

export async function rejectTask(
  admin: SupabaseClient,
  taskId: string,
  workspaceId: string,
  reviewerUserId: string,
  reason: string,
  options: { sessionId?: string } = {},
): Promise<TaskRow> {
  const { data: raw, error } = await admin
    .from("tasks")
    .update({
      approval_state:  "rejected",
      rejection_reason: reason,
      status:          "in_progress",
      updated_at:      new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error) throw new Error(`Reject failed: ${error.message}`);

  await writeHistory(admin, taskId, workspaceId, "rejected", {
    toValue:     reason,
    actorType:   "user",
    actorUserId: reviewerUserId,
    sessionId:   options.sessionId,
  });

  return mapTask(raw as Record<string, unknown>);
}

// ── Add dependency ────────────────────────────────────────────────────────────

export async function addDependency(
  admin: SupabaseClient,
  taskId: string,
  workspaceId: string,
  dependsOnTaskId: string,
  options: { actorUserId?: string; sessionId?: string } = {},
): Promise<void> {
  const { data: current } = await admin
    .from("tasks")
    .select("depends_on")
    .eq("id", taskId)
    .eq("workspace_id", workspaceId)
    .single();

  const existing = (current?.depends_on as string[]) ?? [];
  if (existing.includes(dependsOnTaskId)) return; // already linked

  await admin
    .from("tasks")
    .update({
      depends_on: [...existing, dependsOnTaskId],
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("workspace_id", workspaceId);

  await writeHistory(admin, taskId, workspaceId, "dependency_added", {
    toValue:     dependsOnTaskId,
    actorType:   options.actorUserId ? "user" : "system",
    actorUserId: options.actorUserId,
    sessionId:   options.sessionId,
  });
}

// ── Remove dependency ─────────────────────────────────────────────────────────

export async function removeDependency(
  admin: SupabaseClient,
  taskId: string,
  workspaceId: string,
  dependsOnTaskId: string,
  options: { actorUserId?: string; sessionId?: string } = {},
): Promise<void> {
  const { data: current } = await admin
    .from("tasks")
    .select("depends_on")
    .eq("id", taskId)
    .eq("workspace_id", workspaceId)
    .single();

  const existing = (current?.depends_on as string[]) ?? [];
  const updated = existing.filter((id: string) => id !== dependsOnTaskId);

  await admin
    .from("tasks")
    .update({
      depends_on: updated,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("workspace_id", workspaceId);

  await writeHistory(admin, taskId, workspaceId, "dependency_removed", {
    fromValue:   dependsOnTaskId,
    actorType:   options.actorUserId ? "user" : "system",
    actorUserId: options.actorUserId,
    sessionId:   options.sessionId,
  });
}

// ── Link artifact ─────────────────────────────────────────────────────────────

export async function linkArtifact(
  admin: SupabaseClient,
  taskId: string,
  artifactId: string,
  workspaceId: string,
  userId: string,
  role: "output" | "input" | "context" = "output",
): Promise<void> {
  await admin.from("task_artifacts").upsert({
    task_id:      taskId,
    artifact_id:  artifactId,
    workspace_id: workspaceId,
    role,
    linked_by:    userId,
  }, { onConflict: "task_id,artifact_id" });
}

// ── Link proof ────────────────────────────────────────────────────────────────

export async function linkProof(
  admin: SupabaseClient,
  taskId: string,
  proofRecordId: string,
  workspaceId: string,
): Promise<void> {
  await admin.from("task_proof_links").upsert({
    task_id:         taskId,
    proof_record_id: proofRecordId,
    workspace_id:    workspaceId,
  }, { onConflict: "task_id,proof_record_id" });

  // Also set proof_record_id on the task itself (most recent proof)
  await admin
    .from("tasks")
    .update({
      proof_record_id: proofRecordId,
      updated_at:      new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("workspace_id", workspaceId);
}

// ── Get dependency status ─────────────────────────────────────────────────────

export async function getDependencyStatus(
  admin: SupabaseClient,
  taskId: string,
  workspaceId: string,
): Promise<{ blocked: boolean; unfinished: string[] }> {
  const { data: task } = await admin
    .from("tasks")
    .select("depends_on")
    .eq("id", taskId)
    .eq("workspace_id", workspaceId)
    .single();

  const dependsOn = (task?.depends_on as string[]) ?? [];
  if (dependsOn.length === 0) return { blocked: false, unfinished: [] };

  const { data: deps } = await admin
    .from("tasks")
    .select("id, status, title")
    .in("id", dependsOn)
    .eq("workspace_id", workspaceId);

  const unfinished = (deps ?? [])
    .filter((d: Record<string, unknown>) => d.status !== "done")
    .map((d: Record<string, unknown>) => d.title as string);

  return { blocked: unfinished.length > 0, unfinished };
}

// ── Get task with history ─────────────────────────────────────────────────────

export async function getTask(
  admin: SupabaseClient,
  taskId: string,
  workspaceId: string,
): Promise<TaskWithHistory | null> {
  const { data: taskRaw, error } = await admin
    .from("tasks")
    .select()
    .eq("id", taskId)
    .eq("workspace_id", workspaceId)
    .single();

  if (error || !taskRaw) return null;

  const { data: historyRaw } = await admin
    .from("task_history")
    .select()
    .eq("task_id", taskId)
    .eq("workspace_id", workspaceId)
    .order("occurred_at", { ascending: false })
    .limit(50);

  const history = (historyRaw ?? []).map((r: Record<string, unknown>) => mapHistory(r));

  return { ...mapTask(taskRaw as Record<string, unknown>), history };
}

// ── List tasks ────────────────────────────────────────────────────────────────

export async function listTasks(
  admin: SupabaseClient,
  workspaceId: string,
  options?: {
    projectId?:  string;
    status?:     TaskStatus;
    priority?:   TaskPriority;
    ownerType?:  TaskOwnerType;
    ownerUserId?: string;
    limit?:      number;
  },
): Promise<TaskRow[]> {
  let query = admin
    .from("tasks")
    .select()
    .eq("workspace_id", workspaceId)
    .order("priority", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(options?.limit ?? 100);

  if (options?.projectId)  query = query.eq("project_id", options.projectId);
  if (options?.status)     query = query.eq("status", options.status);
  if (options?.priority)   query = query.eq("priority", options.priority);
  if (options?.ownerType)  query = query.eq("owner_type", options.ownerType);
  if (options?.ownerUserId) query = query.eq("owner_user_id", options.ownerUserId);

  const { data, error } = await query;
  if (error) throw new Error(`List tasks failed: ${error.message}`);

  return (data ?? []).map((r: Record<string, unknown>) => mapTask(r));
}
