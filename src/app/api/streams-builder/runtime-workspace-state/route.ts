import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { AtomicFileWorkspaceStateStore } from "@/lib/streams-builder/persistent-runtime-store";
import { createWorkspaceState, synchronizeWorkspaceState } from "@/lib/streams-builder/production-runtime-services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const store = new AtomicFileWorkspaceStateStore();

export async function GET(request: NextRequest) {
  try {
    await requireStreamsAIScope(request);
    const workspaceId = request.nextUrl.searchParams.get("workspaceId");
    if (!workspaceId) return streamsAIJson({ ok: false, error: "workspaceId is required" }, 400);
    const state = await store.get(workspaceId);
    if (!state) return streamsAIJson({ ok: false, error: "Workspace state not found" }, 404);
    return streamsAIJson({ ok: true, state });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireStreamsAIScope(request);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const workspaceId = String(body.workspaceId ?? "");
    if (!workspaceId) return streamsAIJson({ ok: false, error: "workspaceId is required" }, 400);
    const existing = await store.get(workspaceId);
    if (existing) return streamsAIJson({ ok: true, state: existing });
    const state = createWorkspaceState(workspaceId);
    await store.create(state);
    return streamsAIJson({ ok: true, state }, 201);
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireStreamsAIScope(request);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const workspaceId = String(body.workspaceId ?? "");
    const expectedGeneration = Number(body.expectedGeneration);
    const patch = typeof body.patch === "object" && body.patch ? body.patch as Record<string, unknown> : null;
    if (!workspaceId || !Number.isInteger(expectedGeneration) || expectedGeneration < 1 || !patch) {
      return streamsAIJson({ ok: false, error: "workspaceId, expectedGeneration, and patch are required" }, 400);
    }
    const allowed = new Set(["chatRevision", "codeRevision", "gitRevision", "runtimeRevision", "previewRevision", "activeJobId", "steeringRevision"]);
    const safePatch = Object.fromEntries(Object.entries(patch).filter(([key]) => allowed.has(key)));
    const state = await synchronizeWorkspaceState({ store, workspaceId, expectedGeneration, patch: safePatch });
    return streamsAIJson({ ok: true, state });
  } catch (error) {
    return streamsAIError(error);
  }
}
