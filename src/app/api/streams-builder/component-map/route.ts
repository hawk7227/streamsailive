import { type NextRequest } from "next/server";
import { streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { deriveComponentMap } from "@/lib/streams-builder/component-map";
import { listStreamsBuilderProjects } from "@/lib/streams-builder/projects";
import { assertProjectAccess } from "@/lib/streams-builder/permissions";

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const projectId = request.nextUrl.searchParams.get("projectId");
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const accessErrors = projectId ? assertProjectAccess({ projectId, sessionId, role: "viewer", action: "view" }) : [];
    if (accessErrors.length) return streamsAIJson({ ok: false, errors: accessErrors }, 400);
    const projects = await listStreamsBuilderProjects(scope);
    const mappings = deriveComponentMap(projects, projectId);
    return streamsAIJson({ ok: true, mappings, result: { count: mappings.length, truthState: mappings.length ? "UNPROVEN" : "UNKNOWN" } });
  } catch (error) {
    return streamsAIError(error);
  }
}
