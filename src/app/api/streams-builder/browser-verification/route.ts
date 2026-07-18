import { type NextRequest } from "next/server";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAIAssetsRepository } from "@/lib/streams-ai/repositories/assets-repository";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import {
  runBrowserVerification,
  type BrowserScreenshotArtifact,
  type BrowserVerificationAction,
  type BrowserVerificationViewport,
} from "@/lib/streams-builder/browser-verification";

export const runtime = "nodejs";
export const maxDuration = 60;

const jobs = new StreamsAIJobsRepository();
const assets = new StreamsAIAssetsRepository();

function screenshotFile(screenshot: BrowserScreenshotArtifact) {
  const base64 = screenshot.dataUrl.split(",")[1] || "";
  const bytes = Buffer.from(base64, "base64");
  return new File([bytes], `browser-verification-${screenshot.viewportName}-${screenshot.id}.png`, { type: screenshot.mimeType });
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{
      projectId?: string;
      sessionId?: string;
      jobId?: string;
      targetUrl?: string;
      route?: string;
      checkpointId?: string;
      previewId?: string;
      actions?: BrowserVerificationAction[];
      viewports?: BrowserVerificationViewport[];
    }>(request);

    const projectId = body.projectId || scope.defaultProjectId || "project-pending";
    const sessionId = body.sessionId || "builder-session-pending";
    const targetUrl = body.targetUrl || "";
    const actions = body.actions || [{ type: "wait_for_selector", selector: "body" }];

    const verificationJob = body.jobId
      ? await jobs.get(scope, body.jobId)
      : await jobs.create(scope, {
          projectId,
          sessionId,
          kind: "preview_action",
          status: "running",
          inputJson: { projectId, sessionId, targetUrl, route: body.route || null, checkpointId: body.checkpointId || null, previewId: body.previewId || null, actions, viewports: body.viewports || null, source: "browser_verification" },
        });

    const jobId = String(verificationJob?.id || body.jobId || "");
    if (!jobId) return streamsAIJson({ ok: false, error: "Unable to create browser verification job" }, 500);

    await jobs.createEvent(scope, {
      jobId,
      eventType: "browser.verification.started",
      message: "Desktop and mobile browser verification started",
      data: { projectId, sessionId, targetUrl, route: body.route || null, checkpointId: body.checkpointId || null, previewId: body.previewId || null, actions, viewports: body.viewports || null },
    });

    const result = await runBrowserVerification({ projectId, sessionId, targetUrl, route: body.route, actions, viewports: body.viewports });
    const evidenceAssets = [];
    for (const screenshot of result.screenshots) {
      const asset = await assets.uploadFile(scope, screenshotFile(screenshot), {
        projectId,
        sessionId,
        kind: "image",
        metadata: {
          evidenceType: "browser_verification_screenshot",
          jobId,
          checkpointId: body.checkpointId || null,
          previewId: body.previewId || null,
          targetUrl,
          route: body.route || null,
          viewportName: screenshot.viewportName,
          viewport: screenshot.viewport,
          capturedAt: screenshot.capturedAt,
        },
      });
      evidenceAssets.push({ id: asset.id, name: asset.name, viewportName: screenshot.viewportName, storageBucket: asset.storage_bucket, storagePath: asset.storage_path });
    }

    const durableResult = {
      ...result,
      screenshot: undefined,
      screenshots: result.screenshots.map((item) => ({ ...item, dataUrl: undefined })),
      viewports: result.viewports.map((item) => ({ ...item, screenshot: item.screenshot ? { ...item.screenshot, dataUrl: undefined } : undefined })),
      evidenceAssets,
      checkpointId: body.checkpointId || null,
      previewId: body.previewId || null,
    };

    await jobs.update(scope, jobId, {
      status: result.truthState === "PROVEN" ? "completed" : result.truthState === "FAILED" ? "failed" : "in_review",
      metadata: { browserVerification: durableResult, truthState: result.truthState, evidenceAssetIds: evidenceAssets.map((asset) => asset.id) },
    });
    await jobs.createEvent(scope, {
      jobId,
      eventType: "browser.verification.completed",
      message: `Browser verification ${result.truthState}`,
      data: { result: durableResult, evidenceAssetIds: evidenceAssets.map((asset) => asset.id) },
    });

    return streamsAIJson({ ok: result.ok, jobId, result: durableResult, evidenceAssets });
  } catch (error) {
    return streamsAIError(error);
  }
}
