import { createHash } from "node:crypto";
import type { StreamsAIScope } from "@/lib/streams-ai/auth";
import { sanitizeStreamsAIPayload, sanitizeStreamsAIText } from "@/lib/streams-ai/protected-reasoning";
import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "@/lib/streams-ai/server";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";

export const BUILDER_WORKSPACE_STATE_PURPOSE = "streams_builder_workspace_state";
export const BUILDER_WORKSPACE_STATE_VERSION = 1;
export const MAX_BUILDER_WORKSPACE_SNAPSHOT_BYTES = 2_000_000;

export type DurableBuilderActiveFile = {
  repo?: string;
  branch?: string;
  path?: string;
  folder?: string;
  sha?: string;
  content?: string;
  route?: string;
};

export type DurableBuilderDraft = {
  draftId?: string;
  checkpointId?: string;
  repo?: string;
  branch?: string;
  filePath?: string;
  baseSha?: string;
  route?: string;
  content?: string;
  patchState?: string;
  previewBuildState?: string;
  previewId?: string;
  previewUrl?: string;
  commitSha?: string;
  lastError?: string;
};

export type DurableBuilderWorkspaceSnapshot = {
  version: number;
  projectId: string;
  revision: number;
  stateHash: string;
  workspace: Record<string, unknown>;
  activeFile: DurableBuilderActiveFile | null;
  draft: DurableBuilderDraft | null;
  selection: Record<string, unknown> | null;
  proof: Record<string, unknown> | null;
  updatedAt: string;
};

export type SaveDurableBuilderWorkspaceInput = {
  projectId?: string | null;
  expectedRevision?: number | null;
  idempotencyKey?: string | null;
  workspace?: Record<string, unknown>;
  activeFile?: DurableBuilderActiveFile | null;
  draft?: DurableBuilderDraft | null;
  selection?: Record<string, unknown> | null;
  proof?: Record<string, unknown> | null;
  eventType?: string | null;
  eventMessage?: string | null;
};

export class DurableWorkspaceStateError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "DurableWorkspaceStateError";
    this.status = status;
    this.code = code;
  }
}

function db() {
  return streamsAISchema(createStreamsAIServiceClient());
}

function cleanRecord(value: unknown) {
  return sanitizeStreamsAIPayload(value && typeof value === "object" ? value : {}) as Record<string, unknown>;
}

function cleanOptionalRecord(value: unknown) {
  if (!value || typeof value !== "object") return null;
  return sanitizeStreamsAIPayload(value) as Record<string, unknown>;
}

function stableStatePayload(input: SaveDurableBuilderWorkspaceInput) {
  return sanitizeStreamsAIPayload({
    workspace: cleanRecord(input.workspace),
    activeFile: cleanOptionalRecord(input.activeFile),
    draft: cleanOptionalRecord(input.draft),
    selection: cleanOptionalRecord(input.selection),
    proof: cleanOptionalRecord(input.proof),
  }) as Record<string, unknown>;
}

export function builderWorkspaceStateHash(input: SaveDurableBuilderWorkspaceInput) {
  return createHash("sha256").update(JSON.stringify(stableStatePayload(input))).digest("hex");
}

export function builderWorkspaceSnapshotBytes(input: SaveDurableBuilderWorkspaceInput) {
  return Buffer.byteLength(JSON.stringify(stableStatePayload(input)), "utf8");
}

function normalizeSnapshot(row: any, projectId: string): DurableBuilderWorkspaceSnapshot | null {
  if (!row) return null;
  const output = row.output_json && typeof row.output_json === "object" ? row.output_json : {};
  const input = row.input_json && typeof row.input_json === "object" ? row.input_json : {};
  return {
    version: Number(output.version || input.version || BUILDER_WORKSPACE_STATE_VERSION),
    projectId,
    revision: Number(output.revision || input.revision || 0),
    stateHash: String(output.stateHash || input.stateHash || ""),
    workspace: cleanRecord(output.workspace),
    activeFile: cleanOptionalRecord(output.activeFile) as DurableBuilderActiveFile | null,
    draft: cleanOptionalRecord(output.draft) as DurableBuilderDraft | null,
    selection: cleanOptionalRecord(output.selection),
    proof: cleanOptionalRecord(output.proof),
    updatedAt: String(output.updatedAt || row.updated_at || row.created_at || ""),
  };
}

async function requireOwnedProject(scope: StreamsAIScope, requestedProjectId?: string | null) {
  const projectId = String(requestedProjectId || scope.defaultProjectId || "").trim();
  if (!projectId) throw new DurableWorkspaceStateError("A project is required for builder workspace state.", 400, "BUILDER_PROJECT_REQUIRED");
  const { data, error } = await db()
    .from(streamsAITables.projects)
    .select("id, metadata")
    .eq("tenant_id", scope.tenantId)
    .eq("user_id", scope.userId)
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new DurableWorkspaceStateError(`Failed to read builder project: ${error.message}`, 500, "BUILDER_PROJECT_READ_FAILED");
  if (!data) throw new DurableWorkspaceStateError("Builder project was not found.", 404, "BUILDER_PROJECT_NOT_FOUND");
  return data;
}

async function findStateJob(scope: StreamsAIScope, projectId: string, preferredJobId?: string | null) {
  if (preferredJobId) {
    const { data, error } = await db()
      .from(streamsAITables.jobs)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("project_id", projectId)
      .eq("id", preferredJobId)
      .contains("input_json", { purpose: BUILDER_WORKSPACE_STATE_PURPOSE })
      .maybeSingle();
    if (error) throw new DurableWorkspaceStateError(`Failed to read builder workspace state: ${error.message}`, 500, "BUILDER_STATE_READ_FAILED");
    if (data) return data;
  }

  const { data, error } = await db()
    .from(streamsAITables.jobs)
    .select("*")
    .eq("tenant_id", scope.tenantId)
    .eq("user_id", scope.userId)
    .eq("project_id", projectId)
    .contains("input_json", { purpose: BUILDER_WORKSPACE_STATE_PURPOSE })
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new DurableWorkspaceStateError(`Failed to locate builder workspace state: ${error.message}`, 500, "BUILDER_STATE_READ_FAILED");
  return data || null;
}

export class DurableBuilderWorkspaceStateRepository {
  async read(scope: StreamsAIScope, requestedProjectId?: string | null) {
    const project = await requireOwnedProject(scope, requestedProjectId);
    const metadata = project.metadata && typeof project.metadata === "object" ? project.metadata as Record<string, any> : {};
    const job = await findStateJob(scope, project.id, String(metadata.builderWorkspaceStateJobId || "") || null);
    return {
      projectId: project.id,
      jobId: job?.id || null,
      snapshot: normalizeSnapshot(job, project.id),
    };
  }

  async save(scope: StreamsAIScope, input: SaveDurableBuilderWorkspaceInput) {
    const project = await requireOwnedProject(scope, input.projectId);
    const metadata = project.metadata && typeof project.metadata === "object" ? project.metadata as Record<string, any> : {};
    const currentJob = await findStateJob(scope, project.id, String(metadata.builderWorkspaceStateJobId || "") || null);
    const currentSnapshot = normalizeSnapshot(currentJob, project.id);
    const currentRevision = currentSnapshot?.revision || 0;
    const expectedRevision = input.expectedRevision == null ? currentRevision : Number(input.expectedRevision);
    const idempotencyKey = sanitizeStreamsAIText(String(input.idempotencyKey || ""), 300).trim();
    const currentIdempotencyKey = String(currentJob?.input_json?.lastIdempotencyKey || "");

    if (idempotencyKey && currentJob && idempotencyKey === currentIdempotencyKey) {
      return { projectId: project.id, jobId: currentJob.id, snapshot: currentSnapshot, unchanged: true };
    }
    if (currentJob && expectedRevision !== currentRevision) {
      throw new DurableWorkspaceStateError(
        `Builder workspace state changed on another device. Expected revision ${expectedRevision}, current revision is ${currentRevision}.`,
        409,
        "BUILDER_STATE_REVISION_CONFLICT",
      );
    }

    const payloadBytes = builderWorkspaceSnapshotBytes(input);
    if (payloadBytes > MAX_BUILDER_WORKSPACE_SNAPSHOT_BYTES) {
      throw new DurableWorkspaceStateError(
        `Builder workspace snapshot is ${payloadBytes} bytes and exceeds the ${MAX_BUILDER_WORKSPACE_SNAPSHOT_BYTES}-byte durable JSON limit. Store the large file as an asset before saving state.`,
        413,
        "BUILDER_STATE_TOO_LARGE",
      );
    }

    const stateHash = builderWorkspaceStateHash(input);
    if (currentJob && currentSnapshot?.stateHash === stateHash) {
      return { projectId: project.id, jobId: currentJob.id, snapshot: currentSnapshot, unchanged: true };
    }

    const revision = currentRevision + 1;
    const updatedAt = new Date().toISOString();
    const stable = stableStatePayload(input);
    const inputJson = sanitizeStreamsAIPayload({
      purpose: BUILDER_WORKSPACE_STATE_PURPOSE,
      version: BUILDER_WORKSPACE_STATE_VERSION,
      revision,
      stateHash,
      lastIdempotencyKey: idempotencyKey || null,
      payloadBytes,
      updatedAt,
    });
    const outputJson = sanitizeStreamsAIPayload({
      version: BUILDER_WORKSPACE_STATE_VERSION,
      projectId: project.id,
      revision,
      stateHash,
      ...stable,
      updatedAt,
    });

    let job: any;
    if (currentJob) {
      const { data, error } = await db()
        .from(streamsAITables.jobs)
        .update({ input_json: inputJson, output_json: outputJson, status: "running", error: null, updated_at: updatedAt })
        .eq("tenant_id", scope.tenantId)
        .eq("user_id", scope.userId)
        .eq("project_id", project.id)
        .eq("id", currentJob.id)
        .select("*")
        .single();
      if (error) throw new DurableWorkspaceStateError(`Failed to update builder workspace state: ${error.message}`, 500, "BUILDER_STATE_WRITE_FAILED");
      job = data;
    } else {
      const { data, error } = await db()
        .from(streamsAITables.jobs)
        .insert({
          tenant_id: scope.tenantId,
          user_id: scope.userId,
          project_id: project.id,
          workspace_id: "streams-builder",
          module_id: "workspace-state",
          product_id: "streams-ai",
          status: "running",
          kind: "chat_tool",
          input_json: inputJson,
          output_json: outputJson,
          credit_estimate: 0,
          credit_cost: 0,
          updated_at: updatedAt,
        })
        .select("*")
        .single();
      if (error) throw new DurableWorkspaceStateError(`Failed to create builder workspace state: ${error.message}`, 500, "BUILDER_STATE_WRITE_FAILED");
      job = data;
    }

    const nextProjectMetadata = sanitizeStreamsAIPayload({
      ...metadata,
      builderWorkspaceStateJobId: job.id,
      builderWorkspaceRevision: revision,
      builderWorkspaceUpdatedAt: updatedAt,
      builderWorkspaceSummary: {
        repository: String((stable.activeFile as any)?.repo || (stable.draft as any)?.repo || ""),
        branch: String((stable.activeFile as any)?.branch || (stable.draft as any)?.branch || ""),
        filePath: String((stable.activeFile as any)?.path || (stable.draft as any)?.filePath || ""),
        route: String((stable.activeFile as any)?.route || (stable.draft as any)?.route || ""),
        revision,
      },
    });
    const { error: projectError } = await db()
      .from(streamsAITables.projects)
      .update({ metadata: nextProjectMetadata, updated_at: updatedAt })
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("id", project.id);
    if (projectError) throw new DurableWorkspaceStateError(`Builder state was saved but the project pointer failed: ${projectError.message}`, 500, "BUILDER_STATE_POINTER_FAILED");

    const eventType = sanitizeStreamsAIText(String(input.eventType || ""), 100).trim();
    if (eventType) {
      const jobs = new StreamsAIJobsRepository();
      await jobs.createEvent(scope, {
        jobId: job.id,
        eventType,
        message: sanitizeStreamsAIText(String(input.eventMessage || "Builder workspace state saved"), 1000),
        data: { revision, stateHash, payloadBytes, projectId: project.id },
      });
    }

    return {
      projectId: project.id,
      jobId: job.id,
      snapshot: normalizeSnapshot(job, project.id),
      unchanged: false,
    };
  }
}
