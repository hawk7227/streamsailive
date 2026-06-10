import { type NextRequest } from "next/server";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { evaluateReviewWorkflow } from "@/lib/streams-builder/review-workflow";
import type { ReviewDecision, ReviewTruthState } from "@/lib/streams-builder/review-types";

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

    const result = evaluateReviewWorkflow({
      projectId: body.projectId || scope.defaultProjectId || "project-pending",
      sessionId: body.sessionId || "builder-session-pending",
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

    return streamsAIJson({ ok: result.ok, result });
  } catch (error) {
    return streamsAIError(error);
  }
}
