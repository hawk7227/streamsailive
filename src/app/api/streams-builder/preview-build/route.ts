import { recordBuilderSystemEvent } from "@/lib/streams-builder/system-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const previewId = url.searchParams.get("previewId") || "";
  const sessionId = url.searchParams.get("sessionId") || "agent-1";
  if (!previewId) {
    await recordBuilderSystemEvent({ sessionId, phase: "preview-build-route-missing-id", source: "preview-build-route", severity: "warning", message: "Preview build status requested without previewId." });
    return Response.json({ ok: true, purpose: "Temporary preview build status API", required: ["previewId"] });
  }
  try {
    const target = `${url.origin}/api/streams-builder/line-patches?previewId=${encodeURIComponent(previewId)}&sessionId=${encodeURIComponent(sessionId)}`;
    const response = await fetch(target, { cache: "no-store" });
    const json = await response.json().catch(() => ({}));
    await recordBuilderSystemEvent({ sessionId, phase: response.ok ? "preview-build-route-polled" : "preview-build-route-poll-failed", source: "preview-build-route", severity: response.ok ? "info" : "error", previewId, message: response.ok ? `Preview build ${previewId} polled.` : `Preview build ${previewId} poll failed.` });
    return Response.json(json, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview build poll crashed.";
    await recordBuilderSystemEvent({ sessionId, phase: "preview-build-route-poll-crashed", source: "preview-build-route", severity: "error", previewId, message, error: message });
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const sessionId = String(body.sessionId || "agent-1");
  try {
    await recordBuilderSystemEvent({ sessionId, phase: "preview-build-route-started", source: "preview-build-route", message: "Preview build route started temporary build request.", repo: body.repository, branch: body.branch, filePath: body.filePath, route: body.route });
    const response = await fetch(`${url.origin}/api/streams-builder/line-patches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ ...body, push: false, buildPreview: true, sessionId }),
    });
    const json = await response.json().catch(() => ({}));
    const build = json.previewBuild || {};
    await recordBuilderSystemEvent({ sessionId, phase: response.ok ? "preview-build-route-submitted" : "preview-build-route-submit-failed", source: "preview-build-route", severity: response.ok ? "info" : "error", message: response.ok ? "Preview build request submitted." : String(json.error || "Preview build request failed."), repo: body.repository, branch: body.branch, filePath: body.filePath, route: body.route, previewId: build.previewId, previewUrl: build.previewUrl });
    return Response.json(json, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview build request crashed.";
    await recordBuilderSystemEvent({ sessionId, phase: "preview-build-route-submit-crashed", source: "preview-build-route", severity: "error", message, error: message, repo: body.repository, branch: body.branch, filePath: body.filePath, route: body.route });
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
