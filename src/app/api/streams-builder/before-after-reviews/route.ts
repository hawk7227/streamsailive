import { type NextRequest } from "next/server";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import {
  attachAfterPreview,
  createBeforeAfterReview,
  decideBeforeAfterReview,
  listBeforeAfterReviews,
  type BeforeAfterApprovalDecision,
  type BeforeAfterCreateInput,
} from "@/lib/streams-builder/before-after-review";
import type { ReviewTruthState } from "@/lib/streams-builder/review-types";

type RequestBody = BeforeAfterCreateInput & {
  action?: "create_before" | "attach_after" | "decide";
  reviewId?: string;
  jobId?: string;
  afterPreviewUrl?: string;
  afterScreenshotUrl?: string;
  afterCodePreviewUrl?: string;
  afterViewport?: string;
  changedFiles?: string[];
  patchDiff?: string;
  visualDiffUrl?: string;
  patchSummary?: string;
  decision?: BeforeAfterApprovalDecision;
  comment?: string;
  proofStatus?: ReviewTruthState;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const projectId = request.nextUrl.searchParams.get("projectId");
    const reviews = await listBeforeAfterReviews(scope, projectId);
    return streamsAIJson({
      ok: true,
      reviews,
      result: {
        count: reviews.length,
        truthState: reviews.some((review) => review.approval.state === "approved") ? "PROVEN" : reviews.length ? "UNPROVEN" : "UNKNOWN",
      },
    });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = await readJsonBody<RequestBody>(request);
    const action = body.action || "create_before";

    if (action === "attach_after") {
      const review = await attachAfterPreview(scope, {
        reviewId: body.reviewId,
        jobId: body.jobId,
        afterPreviewUrl: body.afterPreviewUrl,
        afterScreenshotUrl: body.afterScreenshotUrl,
        afterCodePreviewUrl: body.afterCodePreviewUrl,
        afterViewport: body.afterViewport,
        changedFiles: body.changedFiles,
        patchDiff: body.patchDiff,
        visualDiffUrl: body.visualDiffUrl,
        patchSummary: body.patchSummary,
      });
      return streamsAIJson({ ok: true, review, result: { truthState: "UNPROVEN", approvalState: review.approval.state } });
    }

    if (action === "decide") {
      const review = await decideBeforeAfterReview(scope, {
        reviewId: body.reviewId,
        jobId: body.jobId,
        decision: body.decision,
        comment: body.comment,
      });
      return streamsAIJson({
        ok: review.approval.state === "approved" || review.approval.state === "changes_requested" || review.approval.state === "rejected" || body.decision === "comment",
        review,
        result: {
          truthState: review.approval.state === "approved" ? "PROVEN" : "UNPROVEN",
          approvalState: review.approval.state,
          blockers: review.blockers,
        },
      });
    }

    const review = await createBeforeAfterReview(scope, body);
    return streamsAIJson({ ok: true, review, result: { truthState: "UNPROVEN", approvalState: review.approval.state } }, 201);
  } catch (error) {
    return streamsAIError(error);
  }
}
