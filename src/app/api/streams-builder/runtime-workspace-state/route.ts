import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { AtomicFileWorkspaceStateStore } from "@/lib/streams-builder/persistent-runtime-store";
import {
  createWorkspaceState,
  synchronizeWorkspaceState,
  type WorkspaceVersionedState,
} from "@/lib/streams-builder/production-runtime-services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const store = new AtomicFileWorkspaceStateStore();
type WorkspacePatch = Partial<Omit<WorkspaceVersionedState, "workspaceId" | "generation" | "updatedAt">>;

function validatedPatch(value: unknown): WorkspacePatch | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const patch: WorkspacePatch = {};
  for (const key of ["chatRevision", "codeRevision", "gitRevision", "runtimeRevision", "previewRevision"] as const) {
    const candidate = source[key];
    if (candidate !== undefined) {
      if (typeof candidate !== "string") return null;
      patch[key] = candidate;
    }
  }
  const activeJobId = source.activeJobId;
  if (activeJobId !== undefined) {
    if (typeof activeJobId !== "string") return null;
    patch.activeJobId = activeJobId;
  }
  const steeringRevision = source.steeringRevision;
  if (steeringRevision !== undefined) {
    if (typeof steeringRevision !== "number" || !Number.isInteger(steeringRevision) || steeringRevision < 0) return null;
    patch.steeringRevision = steeringRevision;
  }
  return patch;
}

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
    const patch = validatedPatch(body.patch);
    if (!workspaceId || !Number.isInteger(expectedGeneration) || expectedGeneration < 1 || !patch) {
      return streamsAIJson({ ok: false, error: "workspaceId, expectedGeneration, and a valid patch are required" }, 400);
    }
    const state = await synchronizeWorkspaceState({ store, workspaceId, expectedGeneration, patch });
    return streamsAIJson({ ok: true, state });
  } catch (error) {
    return streamsAIError(error);
  }
}
