import { type NextRequest } from "next/server";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { createStreamsBuilderActivity } from "@/lib/streams-builder/activity-log";
import { listStreamsBuilderNotifications, setStreamsBuilderNotificationRead } from "@/lib/streams-builder/notifications";
import { assertProjectAccess } from "@/lib/streams-builder/permissions";
import { checkStreamsBuilderRateLimit } from "@/lib/streams-builder/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const projectId = request.nextUrl.searchParams.get("projectId");
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const accessErrors = projectId ? assertProjectAccess({ projectId, sessionId, role: "viewer", action: "view" }) : [];
    if (accessErrors.length) return streamsAIJson({ ok: false, errors: accessErrors }, 400);
    const notifications = await listStreamsBuilderNotifications(scope, { projectId, sessionId });
    return streamsAIJson({ ok: true, notifications, result: { count: notifications.length, truthState: notifications.length ? "UNPROVEN" : "UNKNOWN" } });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{ projectId?: string; sessionId?: string; notificationId?: string; read?: boolean }>(request);
    const accessErrors = assertProjectAccess({ projectId: body.projectId, sessionId: body.sessionId, role: "reviewer", action: "review" });
    if (accessErrors.length) return streamsAIJson({ ok: false, errors: accessErrors }, 400);
    if (!body.notificationId?.trim()) return streamsAIJson({ ok: false, error: "notificationId is required" }, 400);
    const limit = checkStreamsBuilderRateLimit({ key: `${scope.userId}:notifications:${body.projectId}`, limit: 60 });
    if (!limit.ok) return streamsAIJson({ ok: false, error: "Rate limited", rateLimit: limit }, 429);
    const result = setStreamsBuilderNotificationRead({ notificationId: body.notificationId, read: body.read === true });
    await createStreamsBuilderActivity(scope, {
      projectId: body.projectId || "",
      sessionId: body.sessionId,
      actionType: "notification_read_state_changed",
      previousState: null,
      nextState: body.read === true ? "read" : "unread",
      truthState: "UNPROVEN",
      message: `Notification ${body.read === true ? "read" : "unread"}`,
    });
    return streamsAIJson({ ok: true, result, rateLimit: limit });
  } catch (error) {
    return streamsAIError(error);
  }
}
