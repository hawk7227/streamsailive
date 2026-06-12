import { type NextRequest } from "next/server";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import {
  runBrowserVerification,
  type BrowserVerificationAction,
} from "@/lib/streams-builder/browser-verification";

export const runtime = "nodejs";
export const maxDuration = 60;

const jobs = new StreamsAIJobsRepository();

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{
      projectId?: string;
      sessionId?: string;
      jobId?: string;
      targetUrl?: string;
      route?: string;
      actions?: BrowserVerificationAction[];
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
          inputJson: { projectId, sessionId, targetUrl, route: body.route || null, actions, source: "browser_verification" },
        });

    const jobId = String(verificationJob?.id || body.jobId || "");
    if (!jobId) return streamsAIJson({ ok: false, error: "Unable to create browser verification job" }, 500);

    await jobs.createEvent(scope, {
      jobId,
      eventType: "browser.verification.started",
      message: "Browser verification started",
      data: { projectId, sessionId, targetUrl, route: body.route || null, actions },
    });

    const result = await runBrowserVerification({ projectId, sessionId, targetUrl, route: body.route, actions });
    await jobs.update(scope, jobId, {
      status: result.truthState === "PROVEN" ? "completed" : result.truthState === "FAILED" ? "failed" : "in_review",
      metadata: { browserVerification: result, truthState: result.truthState },
    });
    await jobs.createEvent(scope, {
      jobId,
      eventType: "browser.verification.completed",
      message: `Browser verification ${result.truthState}`,
      data: { result },
    });

    return streamsAIJson({ ok: result.ok, jobId, result });
  } catch (error) {
    return streamsAIError(error);
  }
}

