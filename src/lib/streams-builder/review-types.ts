export type ReviewDecision = "approve" | "request_changes" | "comment";
export type ReviewTruthState = "PROVEN" | "FAILED" | "UNPROVEN" | "WAITING_FOR_USER";

export interface ReviewWorkflowRequest {
  projectId: string;
  sessionId: string;
  previewUrl: string;
  buildStatus: ReviewTruthState;
  proofStatus: ReviewTruthState;
  browserVerificationStatus: ReviewTruthState;
  workflowVerificationStatus: ReviewTruthState;
  decision: ReviewDecision;
  comment?: string;
  route?: string;
  component?: string;
  file?: string;
  githubPath?: string;
  checkpointId?: string;
  buildJobId?: string;
}

export interface ReviewWorkflowResult {
  ok: boolean;
  truthState: ReviewTruthState;
  reviewState: "approved" | "changes_requested" | "commented" | "blocked";
  blockedReasons: string[];
  proof: string[];
  unproven: string[];
}
