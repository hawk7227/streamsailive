import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import {
  appendRuntimeCommand,
  claimRuntime,
  createDurableRuntime,
  type RuntimeCommand,
} from "@/lib/streams-builder/durable-orchestrator";
import { AtomicFileDurableRuntimeStore } from "@/lib/streams-builder/persistent-runtime-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const store = new AtomicFileDurableRuntimeStore();

export async function GET(request: NextRequest) {
  try {
    await requireStreamsAIScope(request);
    const runtimeId = request.nextUrl.searchParams.get("runtimeId");
    if (!runtimeId) return streamsAIJson({ ok: false, error: "runtimeId is required" }, 400);
    const record = await store.get(runtimeId);
    if (!record) return streamsAIJson({ ok: false, error: "Runtime not found" }, 404);
    return streamsAIJson({ ok: true, runtime: record });
  } catch (error) { return streamsAIError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "create");
    if (action === "create") {
      const projectId = String(body.projectId ?? "");
      const workspaceId = String(body.workspaceId ?? "");
      const jobId = String(body.jobId ?? "");
      if (!projectId || !workspaceId || !jobId) return streamsAIJson({ ok: false, error: "projectId, workspaceId, and jobId are required" }, 400);
      const record = createDurableRuntime({ projectId, workspaceId, jobId });
      await store.create(record);
      return streamsAIJson({ ok: true, runtime: record }, 201);
    }
    const runtimeId = String(body.runtimeId ?? "");
    if (!runtimeId) return streamsAIJson({ ok: false, error: "runtimeId is required" }, 400);
    if (action === "claim") {
      const ownerId = String(body.ownerId ?? scope.userId);
      const record = await claimRuntime({ store, runtimeId, ownerId, force: body.force === true });
      return streamsAIJson({ ok: true, runtime: record });
    }
    if (action === "command") {
      const type = String(body.type ?? "") as RuntimeCommand["type"];
      if (!( ["pause", "resume", "cancel", "steer"] as string[]).includes(type)) return streamsAIJson({ ok: false, error: "Invalid runtime command" }, 400);
      const payload = typeof body.payload === "object" && body.payload ? body.payload as Record<string, unknown> : undefined;
      const record = await appendRuntimeCommand({ store, runtimeId, actorId: scope.userId, type, payload });
      return streamsAIJson({ ok: true, runtime: record });
    }
    return streamsAIJson({ ok: false, error: "Unsupported action" }, 400);
  } catch (error) { return streamsAIError(error); }
}
