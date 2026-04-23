/**
 * src/lib/audit/index.ts
 *
 * Public API for the STREAMS Approval + Audit Layer.
 *
 * Import from here in all application code:
 *   import { withAudit, proveSubject, logViolations } from "@/lib/audit"
 *
 * Direct imports from types.ts or repository.ts are permitted for
 * type-only imports and repository-level access in server routes.
 */

export {
  // Runtime helpers — use in every governed action
  withAudit,
  classifyAction,
  requiresGate,
  logViolations,
  proveSubject,
} from "./runtime";

export type { AuditFinding } from "./runtime";

export {
  // Repository — use in API routes and server-side code
  createProofRecord,
  updateProofStatus,
  getProofBySubject,
  getProofPanel,
  createAuditRecord,
  getRecentAuditEvents,
  createViolationRecord,
  markViolationFixed,
  getOpenViolations,
  startActionLog,
  completeActionLog,
  failActionLog,
  createApprovalGate,
  resolveApprovalGate,
  getPendingGates,
} from "./repository";

export type {
  // Types — use everywhere
  ProofRecord,
  AuditRecord,
  ViolationRecord,
  ActionLog,
  ApprovalGate,
  ProofStatus,
  ActionCategory,
  ViolationSeverity,
  ApprovalOutcome,
  ActionStatus,
  ViolationStatus,
  RuleSource,
  ProofPanelSummary,
  AuditPanelEntry,
  ViolationPanelEntry,
  CreateProofRecordInput,
  CreateAuditRecordInput,
  CreateViolationRecordInput,
  CreateActionLogInput,
  CreateApprovalGateInput,
  AuditResult,
} from "./types";

export { auditOk, auditErr } from "./types";
