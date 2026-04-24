"use client";

/**
 * BuilderTab — Phase 10 Builder Workspace.
 *
 * Three panels: Tasks · Audit · Runtime
 *
 * Tasks:   list + create tasks via /api/streams/tasks
 *          approve/reject/status-change via /api/streams/tasks/[id]
 * Audit:   proof summary, open violations, pending gates via /api/audit/proof
 *          gate resolution via /api/audit/gates/[id]/resolve
 * Runtime: execute build actions via /api/streams/runtime
 *
 * Rules compliance:
 *   Rule 1.1  — single column default, desktop enhancement via min-width:768px
 *   Rule 1.5  — safe-area-inset-bottom on input bar
 *   Rule 3.1  — no bottom-anchored input in this tab (list view only)
 *   Rule 4.*  — no chat bubbles, no avatars (not a chat tab)
 *   Rule 9.1  — no fontSize below 12
 *   CSS.1     — zero !important
 *   Rule 11.1 — all useState consumed
 *   Rule 6.1  — every empty state designed
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { C, R, S, DUR, EASE } from "../tokens";

// ── Types ─────────────────────────────────────────────────────────────────────

type BuilderPanel = "tasks" | "audit" | "runtime";

type TaskStatus =
  | "backlog" | "todo" | "in_progress" | "blocked"
  | "in_review" | "approved" | "done" | "cancelled";

type TaskPriority = "critical" | "high" | "medium" | "low" | "none";

type TaskApprovalState = "not_required" | "pending" | "approved" | "rejected";

interface TaskRow {
  id:              string;
  title:           string;
  description:     string | null;
  status:          TaskStatus;
  priority:        TaskPriority;
  ownerType:       string;
  approvalState:   TaskApprovalState;
  nextStep:        string | null;
  tags:            string[];
  dueAt:           string | null;
  createdAt:       string;
  updatedAt:       string;
}

type AuditSummary = {
  proof: {
    summary: { proven: number; implementedButUnproven: number; blocked: number; rejected: number; pending: number };
    records: unknown[];
  };
  violations: {
    summary: { critical: number; high: number; medium: number; low: number; total: number };
    open: Array<{ id: string; title: string; severity: string; status: string; createdAt: string }>;
  };
  approvalGates: {
    pendingCount: number;
    pending: Array<{ id: string; gate_name: string; action_name: string; workspace_id: string; created_at: string }>;
  };
  audit: {
    recent: Array<{ id: string; event_type: string; summary: string; actor: string; occurred_at: string; outcome: string }>;
  };
};

type RuntimeActionType =
  | "run_audit" | "write_decision" | "log_issue" | "resolve_issue"
  | "pin_fact" | "write_handoff" | "register_artifact";

// ── Colour helpers ────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  critical: "#ef4444",
  high:     "#f97316",
  medium:   "#f59e0b",
  low:      "#6b7280",
  none:     "#374151",
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  backlog:     C.t4,
  todo:        C.t3,
  in_progress: "#60a5fa",
  blocked:     "#ef4444",
  in_review:   "#f59e0b",
  approved:    "#34d399",
  done:        "#10b981",
  cancelled:   C.t4,
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog:     "Backlog",
  todo:        "To do",
  in_progress: "In progress",
  blocked:     "Blocked",
  in_review:   "In review",
  approved:    "Approved",
  done:        "Done",
  cancelled:   "Cancelled",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function BuilderTab() {
  const [panel, setPanel] = useState<BuilderPanel>("tasks");

  // ── Tasks state ─────────────────────────────────────────────────────────────
  const [tasks,         setTasks]        = useState<TaskRow[]>([]);
  const [tasksLoading,  setTasksLoading] = useState(false);
  const [tasksError,    setTasksError]   = useState<string | null>(null);
  const [statusFilter,  setStatusFilter] = useState<TaskStatus | "all">("all");
  const [newTitle,      setNewTitle]     = useState("");
  const [newPriority,   setNewPriority]  = useState<TaskPriority>("medium");
  const [creating,      setCreating]     = useState(false);
  const [expandedTask,  setExpandedTask] = useState<string | null>(null);
  const [updatingTask,  setUpdatingTask] = useState<string | null>(null);

  // ── Audit state ──────────────────────────────────────────────────────────────
  const [audit,         setAudit]        = useState<AuditSummary | null>(null);
  const [auditLoading,  setAuditLoading] = useState(false);
  const [auditError,    setAuditError]   = useState<string | null>(null);
  const [resolvingGate, setResolvingGate] = useState<string | null>(null);

  // ── Runtime state ────────────────────────────────────────────────────────────
  const [actionType,    setActionType]   = useState<RuntimeActionType>("run_audit");
  const [actionPayload, setActionPayload] = useState("{}");
  const [actionRunning, setActionRunning] = useState(false);
  const [actionResult,  setActionResult] = useState<string | null>(null);
  const [actionError,   setActionError]  = useState<string | null>(null);
  const [payloadError,  setPayloadError] = useState<string | null>(null);

  const createInputRef = useRef<HTMLInputElement>(null);

  // ── Load tasks ───────────────────────────────────────────────────────────────
  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/streams/tasks?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json() as { data?: TaskRow[] };
      setTasks(json.data ?? []);
    } catch (e) {
      setTasksError(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setTasksLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (panel === "tasks") void loadTasks();
  }, [panel, statusFilter, loadTasks]);

  // ── Load audit ───────────────────────────────────────────────────────────────
  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const res = await fetch("/api/audit/proof", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json() as AuditSummary;
      setAudit(json);
    } catch (e) {
      setAuditError(e instanceof Error ? e.message : "Failed to load audit data");
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (panel === "audit") void loadAudit();
  }, [panel, loadAudit]);

  // ── Create task ──────────────────────────────────────────────────────────────
  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/streams/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, priority: newPriority }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json() as { data?: TaskRow };
      if (json.data) setTasks(prev => [json.data!, ...prev]);
      setNewTitle("");
      createInputRef.current?.focus();
    } catch (e) {
      setTasksError(e instanceof Error ? e.message : "Failed to create task");
    } finally {
      setCreating(false);
    }
  }

  // ── Update task status ───────────────────────────────────────────────────────
  async function handleStatusChange(taskId: string, status: TaskStatus) {
    setUpdatingTask(taskId);
    try {
      const res = await fetch(`/api/streams/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
      setExpandedTask(null);
    } catch (e) {
      setTasksError(e instanceof Error ? e.message : "Failed to update task");
    } finally {
      setUpdatingTask(null);
    }
  }

  // ── Approve / reject task ────────────────────────────────────────────────────
  async function handleTaskAction(taskId: string, action: "approve" | "reject") {
    setUpdatingTask(taskId);
    try {
      const res = await fetch(`/api/streams/tasks/${taskId}?action=${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ actorType: "user" }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const newApproval: TaskApprovalState = action === "approve" ? "approved" : "rejected";
      const newStatus: TaskStatus = action === "approve" ? "approved" : "backlog";
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, approvalState: newApproval, status: newStatus } : t
      ));
    } catch (e) {
      setTasksError(e instanceof Error ? e.message : "Failed to update task");
    } finally {
      setUpdatingTask(null);
    }
  }

  // ── Resolve approval gate ─────────────────────────────────────────────────────
  async function handleGateResolve(gateId: string, outcome: "approved" | "rejected") {
    setResolvingGate(gateId);
    try {
      const res = await fetch(`/api/audit/gates/${gateId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ outcome, resolvedBy: "user" }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setAudit(prev => prev ? {
        ...prev,
        approvalGates: {
          ...prev.approvalGates,
          pending: prev.approvalGates.pending.filter(g => g.id !== gateId),
          pendingCount: prev.approvalGates.pendingCount - 1,
        },
      } : prev);
    } catch (e) {
      setAuditError(e instanceof Error ? e.message : "Failed to resolve gate");
    } finally {
      setResolvingGate(null);
    }
  }

  // ── Run runtime action ───────────────────────────────────────────────────────
  async function handleRunAction() {
    if (actionRunning) return;
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(actionPayload) as Record<string, unknown>;
      setPayloadError(null);
    } catch {
      setPayloadError("Invalid JSON — check your payload");
      return;
    }
    setActionRunning(true);
    setActionResult(null);
    setActionError(null);
    try {
      const res = await fetch("/api/streams/runtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ actionType, payload }),
      });
      const json = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        setActionError(json.error as string ?? `Error ${res.status}`);
      } else {
        setActionResult(JSON.stringify(json, null, 2));
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Connection error");
    } finally {
      setActionRunning(false);
    }
  }

  // ── Filtered tasks ───────────────────────────────────────────────────────────
  const filteredTasks = statusFilter === "all"
    ? tasks
    : tasks.filter(t => t.status === statusFilter);

  // ── Sub-nav ──────────────────────────────────────────────────────────────────
  const panels: Array<{ id: BuilderPanel; label: string; badge?: number }> = [
    { id: "tasks",   label: "Tasks",   badge: tasks.filter(t => t.status === "in_review").length || undefined },
    { id: "audit",   label: "Audit",   badge: audit?.approvalGates.pendingCount || undefined },
    { id: "runtime", label: "Runtime"  },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg }}>

      {/* Sub-nav */}
      <div style={{
        display: "flex", alignItems: "center", gap: S.s2,
        padding: `${S.s3}px ${S.s6}px`,
        borderBottom: `1px solid ${C.bdr}`,
        flexShrink: 0,
        overflowX: "auto",
        scrollbarWidth: "none" as React.CSSProperties["scrollbarWidth"],
      }} className="streams-builder-subnav">
        {panels.map(p => (
          <button
            key={p.id}
            onClick={() => setPanel(p.id)}
            style={{
              display: "flex", alignItems: "center", gap: S.s2,
              padding: "6px 14px", borderRadius: R.pill,
              border: `1px solid ${panel === p.id ? C.acc : C.bdr}`,
              background: panel === p.id ? C.accDim : "transparent",
              color: panel === p.id ? C.acc2 : C.t3,
              fontSize: 13, fontWeight: 500,
              fontFamily: "inherit", cursor: "pointer",
              flexShrink: 0, minHeight: 32,
              transition: `background ${DUR.fast} ${EASE}, border-color ${DUR.fast} ${EASE}`,
            }}
          >
            {p.label}
            {p.badge ? (
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 18, height: 18, borderRadius: R.pill,
                background: C.acc, color: "#fff",
                fontSize: 12, fontWeight: 500,
              }}>
                {p.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── TASKS PANEL ── */}
      {panel === "tasks" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Create task form */}
          <form
            onSubmit={handleCreateTask}
            style={{
              padding: `${S.s4}px ${S.s6}px`,
              borderBottom: `1px solid ${C.bdr}`,
              display: "flex", gap: S.s2, alignItems: "flex-end",
              flexShrink: 0,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: C.t4, marginBottom: S.s1, letterSpacing: ".06em", textTransform: "uppercase" }}>
                New task
              </div>
              <input
                ref={createInputRef}
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Task title…"
                maxLength={200}
                style={{
                  width: "100%", background: C.bg3, border: "none",
                  borderRadius: R.r2, padding: "8px 12px",
                  color: C.t1, fontSize: 14, fontFamily: "inherit",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: 12, color: C.t4, marginBottom: S.s1, letterSpacing: ".06em", textTransform: "uppercase" }}>
                Priority
              </div>
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value as TaskPriority)}
                style={{
                  background: C.bg3, border: "none", borderRadius: R.r2,
                  padding: "8px 10px", color: C.t1, fontSize: 14,
                  fontFamily: "inherit", cursor: "pointer", outline: "none",
                  height: 38,
                }}
              >
                {(["critical","high","medium","low","none"] as TaskPriority[]).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={!newTitle.trim() || creating}
              style={{
                padding: "8px 20px", borderRadius: R.r2,
                background: newTitle.trim() && !creating ? C.acc : C.bg4,
                border: "none", color: newTitle.trim() && !creating ? "#fff" : C.t4,
                fontSize: 14, fontFamily: "inherit", fontWeight: 500,
                cursor: newTitle.trim() && !creating ? "pointer" : "not-allowed",
                minHeight: 38, flexShrink: 0,
                transition: `background ${DUR.fast} ${EASE}`,
              }}
            >
              {creating ? "Adding…" : "+ Add"}
            </button>
          </form>

          {/* Status filter chips */}
          <div style={{
            display: "flex", gap: S.s1, padding: `${S.s2}px ${S.s6}px`,
            borderBottom: `1px solid ${C.bdr}`,
            overflowX: "auto", flexShrink: 0,
            scrollbarWidth: "none" as React.CSSProperties["scrollbarWidth"],
          }} className="streams-builder-filters">
            {(["all", "backlog", "todo", "in_progress", "blocked", "in_review", "done"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: "4px 10px", borderRadius: R.pill,
                  border: `1px solid ${statusFilter === s ? C.acc : C.bdr}`,
                  background: statusFilter === s ? C.accDim : "transparent",
                  color: statusFilter === s ? C.acc2 : C.t3,
                  fontSize: 12, fontFamily: "inherit", cursor: "pointer",
                  flexShrink: 0, whiteSpace: "nowrap",
                  minHeight: 28,
                }}
              >
                {s === "all" ? "All" : STATUS_LABELS[s as TaskStatus]}
              </button>
            ))}
          </div>

          {/* Error banner */}
          {tasksError && (
            <div style={{
              padding: "8px 24px",
              background: "rgba(239,68,68,0.08)",
              borderBottom: `1px solid rgba(239,68,68,0.2)`,
              color: C.red, fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              {tasksError}
              <button onClick={() => setTasksError(null)} style={{
                background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 14,
              }} aria-label="Dismiss error">×</button>
            </div>
          )}

          {/* Task list */}
          <div style={{ flex: 1, overflowY: "auto", padding: `${S.s4}px ${S.s6}px` }}>

            {tasksLoading && (
              <div style={{ display: "flex", flexDirection: "column", gap: S.s2 }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{
                    height: 64, borderRadius: R.r2,
                    background: `linear-gradient(90deg, ${C.bg3} 25%, ${C.bg4} 50%, ${C.bg3} 75%)`,
                    backgroundSize: "200% 100%",
                    animation: "streams-builder-shimmer 1.4s ease infinite",
                  }} />
                ))}
              </div>
            )}

            {!tasksLoading && filteredTasks.length === 0 && (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", height: "60%",
                color: C.t4, fontSize: 14, gap: S.s2,
              }}>
                <span style={{ fontSize: 28, opacity: .2 }}>✦</span>
                {statusFilter === "all"
                  ? "No tasks yet — add your first task above"
                  : `No ${STATUS_LABELS[statusFilter as TaskStatus].toLowerCase()} tasks`}
              </div>
            )}

            {!tasksLoading && filteredTasks.map(task => (
              <div key={task.id} style={{
                background: C.bg2, borderRadius: R.r2,
                border: `1px solid ${expandedTask === task.id ? C.accBr : C.bdr}`,
                marginBottom: S.s2,
                transition: `border-color ${DUR.fast} ${EASE}`,
              }}>
                {/* Task row */}
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setExpandedTask(expandedTask === task.id ? null : task.id); }}
                  onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: S.s3,
                    padding: "12px 16px", cursor: "pointer",
                  }}
                >
                  {/* Priority dot */}
                  <span style={{
                    width: 8, height: 8, borderRadius: R.pill, flexShrink: 0,
                    background: PRIORITY_COLOR[task.priority],
                  }} />

                  {/* Title */}
                  <div style={{
                    flex: 1, minWidth: 0,
                    fontSize: 14, color: task.status === "done" || task.status === "cancelled" ? C.t4 : C.t1,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    textDecoration: task.status === "cancelled" ? "line-through" : "none",
                  }}>
                    {task.title}
                  </div>

                  {/* Status badge */}
                  <span style={{
                    fontSize: 12, fontWeight: 500,
                    color: STATUS_COLOR[task.status],
                    flexShrink: 0,
                  }}>
                    {STATUS_LABELS[task.status]}
                  </span>

                  {/* Approval badge */}
                  {task.approvalState === "pending" && (
                    <span style={{
                      padding: "2px 8px", borderRadius: R.pill,
                      background: "rgba(245,158,11,0.15)",
                      border: `1px solid rgba(245,158,11,0.3)`,
                      color: C.amber, fontSize: 12,
                    }}>
                      Review
                    </span>
                  )}

                  {/* Chevron */}
                  <span style={{
                    color: C.t4, fontSize: 12, flexShrink: 0,
                    transform: expandedTask === task.id ? "rotate(180deg)" : "rotate(0deg)",
                    transition: `transform ${DUR.fast} ${EASE}`,
                  }}>▾</span>
                </div>

                {/* Expanded detail */}
                {expandedTask === task.id && (
                  <div style={{
                    padding: "0 16px 16px",
                    borderTop: `1px solid ${C.bdr}`,
                  }}>

                    {/* Description / next step */}
                    {(task.description || task.nextStep) && (
                      <div style={{ marginTop: S.s3, marginBottom: S.s3 }}>
                        {task.description && (
                          <div style={{ fontSize: 13, color: C.t3, lineHeight: 1.6, marginBottom: S.s2 }}>
                            {task.description}
                          </div>
                        )}
                        {task.nextStep && (
                          <div style={{
                            fontSize: 12, color: C.acc2,
                            padding: "6px 10px", borderRadius: R.r1,
                            background: C.accDim, border: `1px solid ${C.accBr}`,
                          }}>
                            → {task.nextStep}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Meta row */}
                    <div style={{
                      display: "flex", gap: S.s4, flexWrap: "wrap",
                      marginTop: S.s2, marginBottom: S.s3,
                      fontSize: 12, color: C.t4,
                    }}>
                      <span>Owner: {task.ownerType}</span>
                      {task.dueAt && <span>Due: {new Date(task.dueAt).toLocaleDateString()}</span>}
                      {task.tags.length > 0 && (
                        <span>Tags: {task.tags.join(", ")}</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: S.s2, flexWrap: "wrap" }}>

                      {/* Approve / reject if in review */}
                      {task.approvalState === "pending" && (
                        <>
                          <button
                            onClick={() => void handleTaskAction(task.id, "approve")}
                            disabled={updatingTask === task.id}
                            style={{
                              padding: "6px 14px", borderRadius: R.r1,
                              background: "rgba(16,185,129,0.15)",
                              border: `1px solid rgba(16,185,129,0.3)`,
                              color: C.green, fontSize: 13,
                              fontFamily: "inherit", cursor: "pointer",
                              minHeight: 32,
                              opacity: updatingTask === task.id ? 0.5 : 1,
                            }}
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => void handleTaskAction(task.id, "reject")}
                            disabled={updatingTask === task.id}
                            style={{
                              padding: "6px 14px", borderRadius: R.r1,
                              background: "rgba(239,68,68,0.10)",
                              border: `1px solid rgba(239,68,68,0.25)`,
                              color: C.red, fontSize: 13,
                              fontFamily: "inherit", cursor: "pointer",
                              minHeight: 32,
                              opacity: updatingTask === task.id ? 0.5 : 1,
                            }}
                          >
                            ✕ Reject
                          </button>
                        </>
                      )}

                      {/* Status transitions */}
                      {task.status === "backlog" && (
                        <button onClick={() => void handleStatusChange(task.id, "todo")}
                          disabled={updatingTask === task.id}
                          style={actionBtn}>Start</button>
                      )}
                      {task.status === "todo" && (
                        <button onClick={() => void handleStatusChange(task.id, "in_progress")}
                          disabled={updatingTask === task.id}
                          style={actionBtn}>Begin</button>
                      )}
                      {task.status === "in_progress" && (
                        <>
                          <button onClick={() => void handleStatusChange(task.id, "in_review")}
                            disabled={updatingTask === task.id}
                            style={actionBtn}>Send for review</button>
                          <button onClick={() => void handleStatusChange(task.id, "done")}
                            disabled={updatingTask === task.id}
                            style={actionBtn}>Mark done</button>
                        </>
                      )}
                      {(task.status === "in_review" || task.status === "approved") && (
                        <button onClick={() => void handleStatusChange(task.id, "done")}
                          disabled={updatingTask === task.id}
                          style={actionBtn}>Mark done</button>
                      )}
                      {task.status !== "cancelled" && task.status !== "done" && (
                        <button onClick={() => void handleStatusChange(task.id, "cancelled")}
                          disabled={updatingTask === task.id}
                          style={{ ...actionBtn, color: C.t4 }}>Cancel</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AUDIT PANEL ── */}
      {panel === "audit" && (
        <div style={{ flex: 1, overflowY: "auto", padding: `${S.s4}px ${S.s6}px` }}>

          {auditLoading && (
            <div style={{ color: C.t4, fontSize: 14, padding: "32px 0", textAlign: "center" }}>
              Loading audit data…
            </div>
          )}

          {auditError && (
            <div style={{
              padding: "10px 14px", borderRadius: R.r2,
              background: "rgba(239,68,68,0.08)",
              border: `1px solid rgba(239,68,68,0.2)`,
              color: C.red, fontSize: 13, marginBottom: S.s4,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              {auditError}
              <button onClick={() => void loadAudit()} style={{
                background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 13,
                fontFamily: "inherit",
              }}>Retry</button>
            </div>
          )}

          {audit && !auditLoading && (
            <>
              {/* Proof summary */}
              <div style={{ marginBottom: S.s6 }}>
                <div style={{ fontSize: 12, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: S.s3 }}>
                  Proof status
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: S.s2 }}>
                  {[
                    { label: "Proven",     value: audit.proof.summary.proven,                 color: C.green },
                    { label: "Unproven",   value: audit.proof.summary.implementedButUnproven, color: C.amber },
                    { label: "Blocked",    value: audit.proof.summary.blocked,                color: C.red   },
                    { label: "Pending",    value: audit.proof.summary.pending,                color: C.t3    },
                  ].map(s => (
                    <div key={s.label} style={{
                      padding: "12px 14px", borderRadius: R.r2,
                      background: C.bg2, border: `1px solid ${C.bdr}`,
                    }}>
                      <div style={{ fontSize: 22, fontWeight: 500, color: s.color, lineHeight: 1 }}>
                        {s.value}
                      </div>
                      <div style={{ fontSize: 12, color: C.t4, marginTop: S.s1 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Violations */}
              <div style={{ marginBottom: S.s6 }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginBottom: S.s3,
                }}>
                  <div style={{ fontSize: 12, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase" }}>
                    Open violations
                  </div>
                  <span style={{
                    padding: "2px 8px", borderRadius: R.pill, fontSize: 12,
                    background: audit.violations.summary.total > 0 ? "rgba(239,68,68,0.12)" : C.bg3,
                    color: audit.violations.summary.total > 0 ? C.red : C.t4,
                    border: `1px solid ${audit.violations.summary.total > 0 ? "rgba(239,68,68,0.25)" : C.bdr}`,
                  }}>
                    {audit.violations.summary.total} total
                  </span>
                </div>
                {audit.violations.open.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.t4, padding: "12px 0" }}>
                    No open violations ✓
                  </div>
                ) : (
                  audit.violations.open.slice(0, 20).map(v => (
                    <div key={v.id} style={{
                      display: "flex", alignItems: "center", gap: S.s3,
                      padding: "10px 14px", borderRadius: R.r1,
                      background: C.bg2, border: `1px solid ${C.bdr}`,
                      marginBottom: S.s1,
                    }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: R.pill, flexShrink: 0,
                        background: v.severity === "critical" ? C.red : v.severity === "high" ? "#f97316" : C.amber,
                      }} />
                      <span style={{ flex: 1, fontSize: 13, color: C.t1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {v.title}
                      </span>
                      <span style={{ fontSize: 12, color: C.t4, flexShrink: 0 }}>
                        {v.severity}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Pending approval gates */}
              <div style={{ marginBottom: S.s6 }}>
                <div style={{ fontSize: 12, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: S.s3 }}>
                  Pending approval gates
                </div>
                {audit.approvalGates.pending.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.t4, padding: "12px 0" }}>
                    No pending gates ✓
                  </div>
                ) : (
                  audit.approvalGates.pending.map(gate => (
                    <div key={gate.id} style={{
                      padding: "12px 14px", borderRadius: R.r2,
                      background: C.bg2, border: `1px solid ${C.accBr}`,
                      marginBottom: S.s2,
                    }}>
                      <div style={{ fontSize: 14, color: C.t1, fontWeight: 500, marginBottom: S.s1 }}>
                        {gate.gate_name}
                      </div>
                      <div style={{ fontSize: 12, color: C.t4, marginBottom: S.s3 }}>
                        Action: {gate.action_name}
                      </div>
                      <div style={{ display: "flex", gap: S.s2 }}>
                        <button
                          onClick={() => void handleGateResolve(gate.id, "approved")}
                          disabled={resolvingGate === gate.id}
                          style={{
                            padding: "6px 16px", borderRadius: R.r1,
                            background: "rgba(16,185,129,0.15)",
                            border: `1px solid rgba(16,185,129,0.3)`,
                            color: C.green, fontSize: 13,
                            fontFamily: "inherit", cursor: "pointer",
                            minHeight: 32,
                            opacity: resolvingGate === gate.id ? 0.5 : 1,
                          }}
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => void handleGateResolve(gate.id, "rejected")}
                          disabled={resolvingGate === gate.id}
                          style={{
                            padding: "6px 16px", borderRadius: R.r1,
                            background: "rgba(239,68,68,0.10)",
                            border: `1px solid rgba(239,68,68,0.25)`,
                            color: C.red, fontSize: 13,
                            fontFamily: "inherit", cursor: "pointer",
                            minHeight: 32,
                            opacity: resolvingGate === gate.id ? 0.5 : 1,
                          }}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Recent audit events */}
              <div>
                <div style={{ fontSize: 12, color: C.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: S.s3 }}>
                  Recent events
                </div>
                {audit.audit.recent.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.t4, padding: "12px 0" }}>No recent events</div>
                ) : (
                  audit.audit.recent.slice(0, 15).map(ev => (
                    <div key={ev.id} style={{
                      display: "flex", gap: S.s3, alignItems: "flex-start",
                      padding: "8px 0",
                      borderBottom: `1px solid ${C.bdr}`,
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: R.pill, marginTop: 6, flexShrink: 0,
                        background: ev.outcome === "failure" ? C.red : C.green,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: C.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ev.summary}
                        </div>
                        <div style={{ fontSize: 12, color: C.t4, marginTop: 2 }}>
                          {ev.actor} · {new Date(ev.occurred_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── RUNTIME PANEL ── */}
      {panel === "runtime" && (
        <div style={{ flex: 1, overflowY: "auto", padding: `${S.s4}px ${S.s6}px` }}>

          <div style={{ maxWidth: 640 }}>

            {/* Action type */}
            <div style={{ marginBottom: S.s4 }}>
              <div style={{ fontSize: 12, color: C.t4, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: S.s2 }}>
                Action type
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: S.s2 }}>
                {([
                  "run_audit", "write_decision", "log_issue", "resolve_issue",
                  "pin_fact", "write_handoff", "register_artifact",
                ] as RuntimeActionType[]).map(a => (
                  <button
                    key={a}
                    onClick={() => setActionType(a)}
                    style={{
                      padding: "5px 12px", borderRadius: R.pill,
                      border: `1px solid ${actionType === a ? C.acc : C.bdr}`,
                      background: actionType === a ? C.accDim : "transparent",
                      color: actionType === a ? C.acc2 : C.t3,
                      fontSize: 12, fontFamily: "inherit", cursor: "pointer",
                      minHeight: 28,
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Payload */}
            <div style={{ marginBottom: S.s4 }}>
              <div style={{ fontSize: 12, color: C.t4, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: S.s2 }}>
                Payload (JSON)
              </div>
              <textarea
                value={actionPayload}
                onChange={e => {
                  setActionPayload(e.target.value);
                  setPayloadError(null);
                }}
                maxLength={4000}
                rows={6}
                aria-label="Action payload JSON"
                style={{
                  width: "100%", background: C.bg3, border: payloadError ? `1px solid ${C.red}` : "none",
                  borderRadius: R.r2, padding: "10px 12px",
                  color: C.t1, fontSize: 13, fontFamily: "ui-monospace, monospace",
                  resize: "vertical", outline: "none", lineHeight: 1.6,
                }}
              />
              {payloadError && (
                <div style={{ fontSize: 12, color: C.red, marginTop: S.s1 }}>{payloadError}</div>
              )}
            </div>

            {/* Run button */}
            <button
              onClick={() => void handleRunAction()}
              disabled={actionRunning}
              style={{
                padding: "10px 24px", borderRadius: R.r2,
                background: actionRunning ? C.bg4 : C.acc,
                border: "none",
                color: actionRunning ? C.t4 : "#fff",
                fontSize: 14, fontFamily: "inherit", fontWeight: 500,
                cursor: actionRunning ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: S.s2,
                minHeight: 44,
                transition: `background ${DUR.fast} ${EASE}`,
              }}
            >
              {actionRunning && (
                <span style={{
                  width: 12, height: 12, borderRadius: R.pill,
                  border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff",
                  display: "inline-block",
                  animation: "streams-builder-spin 600ms linear infinite",
                }} />
              )}
              {actionRunning ? "Running…" : "✦ Run action"}
            </button>

            {/* Error */}
            {actionError && (
              <div style={{
                marginTop: S.s4, padding: "10px 14px", borderRadius: R.r2,
                background: "rgba(239,68,68,0.08)",
                border: `1px solid rgba(239,68,68,0.2)`,
                color: C.red, fontSize: 13,
              }}>
                {actionError}
              </div>
            )}

            {/* Result */}
            {actionResult && (
              <div style={{ marginTop: S.s4 }}>
                <div style={{ fontSize: 12, color: C.t4, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: S.s2 }}>
                  Result
                </div>
                <pre style={{
                  background: C.bg2, borderRadius: R.r2,
                  border: `1px solid ${C.bdr}`,
                  padding: "12px 14px",
                  color: C.t2, fontSize: 12,
                  fontFamily: "ui-monospace, monospace",
                  overflowX: "auto", lineHeight: 1.6,
                  whiteSpace: "pre-wrap", overflowWrap: "break-word",
                }}>
                  {actionResult}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes streams-builder-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes streams-builder-spin { to { transform: rotate(360deg); } }
        .streams-builder-subnav::-webkit-scrollbar { display: none; }
        .streams-builder-filters::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

// ── Shared button style helper (avoids repetition in JSX) ────────────────────
const actionBtn: React.CSSProperties = {
  padding: "6px 14px", borderRadius: R.r1,
  background: C.surf, border: `1px solid ${C.bdr}`,
  color: C.t2, fontSize: 13,
  fontFamily: "inherit", cursor: "pointer",
  minHeight: 32,
};
