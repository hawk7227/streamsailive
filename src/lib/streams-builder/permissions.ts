export type StreamsBuilderRole = "viewer" | "reviewer" | "approver" | "builder" | "owner";
export type StreamsBuilderAction = "view" | "review" | "approve" | "write";

const roleRank: Record<StreamsBuilderRole, number> = {
  viewer: 1,
  reviewer: 2,
  approver: 3,
  builder: 4,
  owner: 5,
};

function hasRole(role: StreamsBuilderRole, minimum: StreamsBuilderRole) {
  return roleRank[role] >= roleRank[minimum];
}

export function canViewProject(role: StreamsBuilderRole = "viewer") {
  return hasRole(role, "viewer");
}

export function canReviewProject(role: StreamsBuilderRole = "viewer") {
  return hasRole(role, "reviewer");
}

export function canApproveProject(role: StreamsBuilderRole = "viewer") {
  return hasRole(role, "approver");
}

export function canWriteProject(role: StreamsBuilderRole = "viewer") {
  return hasRole(role, "builder");
}

export function assertProjectAccess(input: { projectId?: string | null; sessionId?: string | null; role?: StreamsBuilderRole; action: StreamsBuilderAction }) {
  const errors: string[] = [];
  if (!input.projectId?.trim()) errors.push("projectId is required.");
  if (!input.sessionId?.trim()) errors.push("sessionId is required.");
  if (input.action === "view" && !canViewProject(input.role)) errors.push("view permission denied.");
  if (input.action === "review" && !canReviewProject(input.role)) errors.push("review permission denied.");
  if (input.action === "approve" && !canApproveProject(input.role)) errors.push("approve permission denied.");
  if (input.action === "write" && !canWriteProject(input.role)) errors.push("write permission denied.");
  return errors;
}
