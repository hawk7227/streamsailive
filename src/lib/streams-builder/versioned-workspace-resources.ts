import type { StreamsAIScope } from "@/lib/streams-ai/auth";
import { sanitizeStreamsAIPayload, sanitizeStreamsAIText } from "@/lib/streams-ai/protected-reasoning";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import {
  DurableBuilderWorkspaceStateRepository,
  type DurableBuilderDraft,
  type DurableBuilderWorkspaceSnapshot,
} from "@/lib/streams-builder/durable-workspace-state";

const workspaceState = new DurableBuilderWorkspaceStateRepository();
const jobs = new StreamsAIJobsRepository();

export type BuilderApprovalState = {
  status: "not_requested" | "requested" | "approved" | "rejected";
  requestedAt?: string;
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
  verificationJobId?: string;
  checkpointId?: string;
};

export type BuilderCheckpointRecord = {
  id: string;
  createdAt: string;
  draftId?: string;
  patchState?: string;
  previewId?: string;
  previewUrl?: string;
  verificationJobId?: string;
  approvalStatus?: BuilderApprovalState["status"];
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? sanitizeStreamsAIPayload(value) as Record<string, unknown>
    : {};
}

function currentSnapshotOrEmpty(projectId: string, snapshot: DurableBuilderWorkspaceSnapshot | null) {
  return snapshot || {
    version: 1,
    projectId,
    revision: 0,
    stateHash: "",
    workspace: {},
    activeFile: null,
    draft: null,
    selection: null,
    proof: null,
    updatedAt: "",
  } satisfies DurableBuilderWorkspaceSnapshot;
}

export class VersionedBuilderWorkspaceResources {
  async read(scope: StreamsAIScope, projectId?: string | null) {
    const result = await workspaceState.read(scope, projectId);
    return {
      ...result,
      snapshot: currentSnapshotOrEmpty(result.projectId, result.snapshot),
    };
  }

  async saveDraft(scope: StreamsAIScope, input: {
    projectId?: string | null;
    expectedRevision?: number | null;
    idempotencyKey?: string | null;
    draft: DurableBuilderDraft;
  }) {
    const current = await this.read(scope, input.projectId);
    const nextDraft = sanitizeStreamsAIPayload({
      ...(current.snapshot.draft || {}),
      ...(input.draft || {}),
    }) as DurableBuilderDraft;
    return workspaceState.save(scope, {
      projectId: current.projectId,
      expectedRevision: input.expectedRevision ?? current.snapshot.revision,
      idempotencyKey: input.idempotencyKey,
      workspace: current.snapshot.workspace,
      activeFile: current.snapshot.activeFile,
      draft: nextDraft,
      selection: current.snapshot.selection,
      proof: current.snapshot.proof,
      eventType: "draft.saved",
      eventMessage: `Builder draft saved${nextDraft.filePath ? ` for ${nextDraft.filePath}` : ""}`,
    });
  }

  async createCheckpoint(scope: StreamsAIScope, input: {
    projectId?: string | null;
    expectedRevision?: number | null;
    idempotencyKey?: string | null;
    checkpointId?: string | null;
    verificationJobId?: string | null;
  }) {
    const current = await this.read(scope, input.projectId);
    const checkpointId = sanitizeStreamsAIText(String(input.checkpointId || `checkpoint-${crypto.randomUUID()}`), 200);
    const approval = record(current.snapshot.proof?.approval) as BuilderApprovalState;
    const checkpoint: BuilderCheckpointRecord = {
      id: checkpointId,
      createdAt: new Date().toISOString(),
      draftId: current.snapshot.draft?.draftId,
      patchState: current.snapshot.draft?.patchState,
      previewId: current.snapshot.draft?.previewId,
      previewUrl: current.snapshot.draft?.previewUrl,
      verificationJobId: sanitizeStreamsAIText(String(input.verificationJobId || approval.verificationJobId || ""), 200) || undefined,
      approvalStatus: approval.status || "not_requested",
    };
    const previous = Array.isArray(current.snapshot.workspace.checkpoints)
      ? current.snapshot.workspace.checkpoints as BuilderCheckpointRecord[]
      : [];
    const checkpoints = [...previous.filter((item) => item?.id !== checkpointId), checkpoint].slice(-100);
    return workspaceState.save(scope, {
      projectId: current.projectId,
      expectedRevision: input.expectedRevision ?? current.snapshot.revision,
      idempotencyKey: input.idempotencyKey,
      workspace: { ...current.snapshot.workspace, checkpoints, activeCheckpointId: checkpointId },
      activeFile: current.snapshot.activeFile,
      draft: { ...(current.snapshot.draft || {}), checkpointId },
      selection: current.snapshot.selection,
      proof: current.snapshot.proof,
      eventType: "checkpoint.created",
      eventMessage: `Builder checkpoint ${checkpointId} created`,
    });
  }

  async saveApproval(scope: StreamsAIScope, input: {
    projectId?: string | null;
    expectedRevision?: number | null;
    idempotencyKey?: string | null;
    approval: Partial<BuilderApprovalState> & { status: BuilderApprovalState["status"] };
  }) {
    const current = await this.read(scope, input.projectId);
    const now = new Date().toISOString();
    const previous = record(current.snapshot.proof?.approval);
    const approval = sanitizeStreamsAIPayload({
      ...previous,
      ...input.approval,
      status: input.approval.status,
      ...(input.approval.status === "requested" && !previous.requestedAt ? { requestedAt: now } : {}),
      ...(["approved", "rejected"].includes(input.approval.status) ? { decidedAt: now } : {}),
    }) as BuilderApprovalState;
    const proof = sanitizeStreamsAIPayload({
      ...(current.snapshot.proof || {}),
      approval,
    }) as Record<string, unknown>;
    return workspaceState.save(scope, {
      projectId: current.projectId,
      expectedRevision: input.expectedRevision ?? current.snapshot.revision,
      idempotencyKey: input.idempotencyKey,
      workspace: current.snapshot.workspace,
      activeFile: current.snapshot.activeFile,
      draft: current.snapshot.draft,
      selection: current.snapshot.selection,
      proof,
      eventType: `approval.${approval.status}`,
      eventMessage: `Builder approval ${approval.status}`,
    });
  }

  async events(scope: StreamsAIScope, input: {
    projectId?: string | null;
    afterSequence?: number | null;
  }) {
    const current = await this.read(scope, input.projectId);
    if (!current.jobId) return { projectId: current.projectId, jobId: null, events: [], nextSequence: Number(input.afterSequence || 0) };
    const allEvents = await jobs.events(scope, current.jobId);
    const afterSequence = Math.max(0, Number(input.afterSequence || 0));
    const events = allEvents.filter((event: any) => Number(event?.data?.sequenceNumber || 0) > afterSequence);
    const nextSequence = events.reduce((max: number, event: any) => Math.max(max, Number(event?.data?.sequenceNumber || 0)), afterSequence);
    return { projectId: current.projectId, jobId: current.jobId, events, nextSequence };
  }
}
