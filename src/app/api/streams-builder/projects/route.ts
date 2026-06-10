import { type NextRequest } from "next/server";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { createStreamsBuilderActivity } from "@/lib/streams-builder/activity-log";
import { listStreamsBuilderNotifications } from "@/lib/streams-builder/notifications";
import { listStreamsBuilderProjects } from "@/lib/streams-builder/projects";
import { assertProjectAccess } from "@/lib/streams-builder/permissions";
import { checkStreamsBuilderRateLimit } from "@/lib/streams-builder/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const projects = await listStreamsBuilderProjects(scope);
    const withCounts = await Promise.all(projects.map(async (project) => {
      const notifications = await listStreamsBuilderNotifications(scope, { projectId: project.projectId, sessionId: null });
      return { ...project, unreadNotificationCount: notifications.filter((item) => !item.read).length };
    }));
    return streamsAIJson({ ok: true, projects: withCounts, result: { truthState: withCounts.length ? "UNPROVEN" : "UNKNOWN" } });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{ projectId?: string; sessionId?: string; actionType?: string; message?: string }>(request);
    const accessErrors = assertProjectAccess({ projectId: body.projectId, sessionId: body.sessionId, role: "builder", action: "write" });
    if (accessErrors.length) return streamsAIJson({ ok: false, errors: accessErrors }, 400);
    const limit = checkStreamsBuilderRateLimit({ key: `${scope.userId}:projects:${body.projectId}`, limit: 20 });
    if (!limit.ok) return streamsAIJson({ ok: false, error: "Rate limited", rateLimit: limit }, 429);
    const activity = await createStreamsBuilderActivity(scope, {
      projectId: body.projectId || "",
      sessionId: body.sessionId,
      actionType: body.actionType || "project_selected",
      truthState: "UNPROVEN",
      message: body.message || "Streams Builder project action recorded",
    });
    return streamsAIJson({ ok: true, activity, rateLimit: limit }, 201);
  } catch (error) {
    return streamsAIError(error);
  }
}
