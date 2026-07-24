import type { StreamsAIScope } from "../streams-ai/auth";
import { createStreamsAIServiceClient, streamsAISchema } from "../streams-ai/server";
import { getRuntimeCapabilityManifest } from "../streams-ai/runtime/architecture/capability-registry";
import type { RouteDecision, RuntimeArtifact, RuntimeOperation } from "../streams-ai/runtime/architecture/contracts";
import { StreamsOperationRepository } from "../streams-ai/runtime/architecture/operation-repository";
import { withStageTimeout } from "../streams-ai/runtime/architecture/timeout-policy";
import { normalizeFailure } from "../streams-ai/runtime/architecture/failure-taxonomy";
import { assertToolAllowed } from "../streams-ai/runtime/architecture/tool-policy";

const operations = new StreamsOperationRepository();
function db() { return streamsAISchema(createStreamsAIServiceClient()); }

type Emit = (phase: string, statusText: string, data?: Record<string, unknown>) => void;

function extractOutputText(payload: any) {
  const output = Array.isArray(payload?.output) ? payload.output : [];
  return output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    .filter((part: any) => part?.type === "output_text" && typeof part?.text === "string")
    .map((part: any) => part.text).join("").trim() || String(payload?.output_text || "").trim();
}

function normalizeHtml(value: string) {
  const unwrapped = value.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (!/<!doctype html/i.test(unwrapped) || !/<html[\s>]/i.test(unwrapped) || !/<body[\s>]/i.test(unwrapped)) {
    throw new Error("BUILDER_INVALID_HTML_OUTPUT");
  }
  if (/<script[^>]+src=["']https?:\/\//i.test(unwrapped)) throw new Error("BUILDER_EXTERNAL_SCRIPT_NOT_ALLOWED");
  return unwrapped;
}

async function generateFrontendHtml(prompt: string, signal?: AbortSignal) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("BUILDER_PROVIDER_NOT_CONFIGURED");
  const model = String(process.env.STREAMS_BUILDER_MODEL || "gpt-4o").trim();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    signal,
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            "You are the authoritative Streams frontend builder.",
            "Create one production-quality, responsive, accessible, self-contained HTML document with embedded CSS and minimal embedded JavaScript.",
            "Return HTML only. Do not use Markdown fences. Do not claim deployment or persistence.",
            "Do not use external scripts, trackers, remote fonts, or network requests.",
            "The document must include a viewport meta tag, semantic landmarks, keyboard-visible focus styles, and mobile responsiveness.",
          ].join("\n"),
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `BUILDER_PROVIDER_FAILED_${response.status}`);
  }
  return normalizeHtml(extractOutputText(await response.json()));
}

async function createPreview(scope: StreamsAIScope, input: { sessionId: string; projectId?: string | null; title: string; html: string; operationId: string }) {
  const now = new Date().toISOString();
  const { data: preview, error } = await db().from("streams_ai_previews").insert({
    tenant_id: scope.tenantId,
    user_id: scope.userId,
    project_id: input.projectId || scope.defaultProjectId || null,
    session_id: input.sessionId,
    title: input.title.slice(0, 180),
    type: "html",
    source_code: input.html,
    preview_html: input.html,
    status: "ready",
    metadata: { source: "chat-builder-executor", canonical: true, placeholder: false, operationId: input.operationId },
    created_at: now,
    updated_at: now,
  }).select("*").single();
  if (error) throw new Error(`PREVIEW_CREATE_FAILED:${error.message}`);

  const { data: version, error: versionError } = await db().from("streams_ai_preview_versions").insert({
    tenant_id: scope.tenantId,
    user_id: scope.userId,
    preview_id: preview.id,
    version_number: 1,
    source_code: input.html,
    preview_html: input.html,
    metadata: { source: "chat-builder-executor", operationId: input.operationId },
    created_at: now,
  }).select("*").single();
  if (versionError) {
    try {
      await db().from("streams_ai_previews")
        .delete()
        .eq("tenant_id", scope.tenantId)
        .eq("user_id", scope.userId)
        .eq("id", preview.id);
    } catch {
      // Preserve the original version-create failure; orphan cleanup is best effort.
    }
    throw new Error(`PREVIEW_VERSION_CREATE_FAILED:${versionError.message}`);
  }
  const { error: activateError } = await db().from("streams_ai_previews")
    .update({ active_version_id: version.id, updated_at: new Date().toISOString() })
    .eq("tenant_id", scope.tenantId)
    .eq("user_id", scope.userId)
    .eq("id", preview.id);
  if (activateError) throw new Error(`PREVIEW_ACTIVATION_FAILED:${activateError.message}`);
  return { previewId: String(preview.id), previewUrl: `/streams-builder/preview/${preview.id}`, versionId: String(version.id) };
}

export async function executeWebsiteBuild(input: {
  scope: StreamsAIScope;
  sessionId: string;
  turnId: string;
  userMessage: string;
  idempotencyKey: string;
  route: RouteDecision;
  projectId?: string | null;
  parentOperationId?: string | null;
  signal?: AbortSignal;
  emit: Emit;
}) {
  assertToolAllowed("CREATE_WEBSITE", "files.write");
  assertToolAllowed("CREATE_WEBSITE", "build.run");
  assertToolAllowed("CREATE_WEBSITE", "preview.create");
  let operation = await operations.create(input.scope, {
    sessionId: input.sessionId,
    turnId: input.turnId,
    intent: "CREATE_WEBSITE",
    idempotencyKey: input.idempotencyKey,
    parentOperationId: input.parentOperationId,
    projectId: input.projectId,
    metadata: { route: input.route, userMessage: input.userMessage, capabilities: getRuntimeCapabilityManifest() },
  });
  if (operation.status === "completed") return operation;
  const leaseOwner = `builder:${crypto.randomUUID()}`;
  await operations.heartbeat(input.scope, operation.operationId, leaseOwner);
  let stage: RuntimeOperation["stage"] = operation.stage;
  try {
    stage = "REQUIREMENTS_RESOLVED";
    input.emit(stage, "Requirements resolved…", { operationId: operation.operationId });
    operation = await operations.transition(input.scope, operation.operationId, stage);

    stage = "FILES_GENERATING";
    input.emit(stage, "Generating the frontend…", { operationId: operation.operationId });
    operation = await operations.transition(input.scope, operation.operationId, stage);
    const html = await withStageTimeout(stage, (signal) => generateFrontendHtml(input.userMessage, signal), input.signal);
    await operations.heartbeat(input.scope, operation.operationId, leaseOwner);

    stage = "FILES_WRITTEN";
    const sourceArtifact: RuntimeArtifact = { artifactId: crypto.randomUUID(), artifactType: "source", status: "saved", metadata: { format: "html", bytes: Buffer.byteLength(html) } };
    input.emit(stage, "Frontend source saved…", { operationId: operation.operationId, bytes: Buffer.byteLength(html) });
    operation = await operations.transition(input.scope, operation.operationId, stage, { artifacts: [sourceArtifact] });
    await operations.snapshot(input.scope, operation.operationId, stage, [sourceArtifact], { htmlBytes: Buffer.byteLength(html) });

    stage = "BUILD_VALIDATING";
    input.emit(stage, "Validating the frontend…", { operationId: operation.operationId });
    operation = await operations.transition(input.scope, operation.operationId, stage);

    stage = "PREVIEW_STARTING";
    input.emit(stage, "Starting the preview…", { operationId: operation.operationId });
    operation = await operations.transition(input.scope, operation.operationId, stage);
    const preview = await withStageTimeout(stage, () => createPreview(input.scope, { sessionId: input.sessionId, projectId: input.projectId, title: "Generated frontend", html, operationId: operation.operationId }), input.signal);
    const previewArtifact: RuntimeArtifact = { artifactId: preview.previewId, artifactType: "preview", status: "ready", url: preview.previewUrl, metadata: { versionId: preview.versionId } };

    stage = "PREVIEW_READY";
    input.emit(stage, "Preview ready…", { operationId: operation.operationId, ...preview });
    operation = await operations.transition(input.scope, operation.operationId, stage, { previewId: preview.previewId, previewUrl: preview.previewUrl, artifacts: [sourceArtifact, previewArtifact] });
    await operations.snapshot(input.scope, operation.operationId, stage, [sourceArtifact, previewArtifact], { previewId: preview.previewId, previewUrl: preview.previewUrl });

    stage = "COMPLETED";
    operation = await operations.transition(input.scope, operation.operationId, stage, { status: "completed", previewId: preview.previewId, previewUrl: preview.previewUrl, artifacts: [sourceArtifact, previewArtifact] });
    input.emit(stage, "Complete", { operationId: operation.operationId, ...preview, artifacts: operation.artifacts });
    return operation;
  } catch (error) {
    const failure = normalizeFailure(error, stage);
    operation = await operations.transition(input.scope, operation.operationId, "FAILED", { status: "failed", failure });
    input.emit("FAILED", failure.safeMessage, { operationId: operation.operationId, failure });
    throw Object.assign(new Error(failure.safeMessage), { operation });
  }
}
