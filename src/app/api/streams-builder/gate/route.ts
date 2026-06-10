import { type NextRequest } from "next/server";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAIJobsRepository } from "@/lib/streams-ai/repositories/jobs-repository";
import { evaluateReviewWorkflow } from "@/lib/streams-builder/review-workflow";
import type { ReviewDecision, ReviewTruthState } from "@/lib/streams-builder/review-types";

const jobs = new StreamsAIJobsRepository();

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<{
      projectId?: string;
      sessionId?: string;
      previewUrl?: string;
      route?: string;
      component?: string;
      file?: string;
      githubPath?: string;
      buildStatus?: ReviewTruthState;
      proofStatus?: ReviewTruthState;
      browserVerificationStatus?: ReviewTruthState;
      workflowVerificationStatus?: ReviewTruthState;
      decision?: ReviewDecision;
      comment?: string;
    }>(request);

    const projectId = body.projectId || scope.defaultProjectId || "project-pending";
    const sessionId = body.sessionId || "builder-session-pending";
    const result = evaluateReviewWorkflow({
      projectId,
      sessionId,
      previewUrl: body.previewUrl || "",
      route: body.route,
      component: body.component,
      file: body.file,
      githubPath: body.githubPath,
      buildStatus: body.buildStatus || "UNPROVEN",
      proofStatus: body.proofStatus || "UNPROVEN",
      browserVerificationStatus: body.browserVerificationStatus || "UNPROVEN",
      workflowVerificationStatus: body.workflowVerificationStatus || "UNPROVEN",
      decision: body.decision || "comment",
      comment: body.comment,
    });

    const gateJob = await jobs.create(scope, {
      projectId,
      sessionId,
      kind: "preview_action",
      status: result.reviewState === "approved" ? "completed" : result.reviewState === "blocked" ? "failed" : "in_review",
      inputJson: { gate: result, comment: body.comment || null },
    });

    await jobs.createEvent(scope, {
      jobId: String(gateJob.id),
      eventType: "builder_gate_result",
      message: result.reviewState,
      data: { truthState: result.truthState, reviewState: result.reviewState },
    });

    return streamsAIJson({ ok: result.ok, gateJob, result });
  } catch (error) {
    return streamsAIError(error);
  }
}
