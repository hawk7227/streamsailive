const blocked = { status: "blocked", reason: "CI/GitHub/Vercel monitor integration is not configured." } as const;
export const getGitHubChecks = async () => blocked;
export const getCiCheckLogs = async () => blocked;
export const getVercelDeployment = async () => blocked;
export const getVercelLogs = async () => blocked;
export const getMergeConflictStatus = async () => blocked;
export const getBranchProtectionStatus = async () => blocked;
