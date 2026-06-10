import { type NextRequest } from "next/server";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { createStreamsBuilderActivity, listStreamsBuilderActivity, type StreamsBuilderActivityTruthState } from "@/lib/streams-builder/activity-log";
import { assertProjectAccess } from "@/lib/streams-builder/permissions";
import { checkStreamsBuilderRateLimit } from "@/lib/streams-builder/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const projectId = request.nextUrl.searchParams.get("projectId");
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const accessErrors = projectId ? assertProjectAccess({ projectId, sessionId, role: "viewer", action: "view" }) : [];
    if (accessErrors.length) return streamsAIJson({ ok: false, errors: accessErrors }, 400);
    const activity = await listStreamsBuilderActivity(scope, { projectId, sessionId });
    return streamsAIJson({ ok: true, activity, result: { count: activity.length, truthState: activity.length ? "UNPROVEN" : "UNKNOWN" } });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{
      projectId?: string;
      sessionId?: string;
      actionType?: string;
      previousState?: string | null;
      nextState?: string | null;
      truthState?: StreamsBuilderActivityTruthState;
      message?: string;
    }>(request);
    const accessErrors = assertProjectAccess({ projectId: body.projectId, sessionId: body.sessionId, role: "reviewer", action: "review" });
    if (accessErrors.length) return streamsAIJson({ ok: false, errors: accessErrors }, 400);
    const limit = checkStreamsBuilderRateLimit({ key: `${scope.userId}:activity:${body.projectId}`, limit: 40 });
    if (!limit.ok) return streamsAIJson({ ok: false, error: "Rate limited", rateLimit: limit }, 429);
    const activity = await createStreamsBuilderActivity(scope, {
      projectId: body.projectId || "",
      sessionId: body.sessionId,
      actionType: body.actionType || "builder_activity",
      previousState: body.previousState,
      nextState: body.nextState,
      truthState: body.truthState || "UNPROVEN",
      message: body.message || "Streams Builder activity recorded",
    });
    return streamsAIJson({ ok: true, activity, rateLimit: limit }, 201);
  } catch (error) {
    return streamsAIError(error);
  }
}
