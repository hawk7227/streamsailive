export function gitPrBlocked() { return { status: "blocked", reason: "Git branch/commit/PR write path is not configured." } as const; }
export const createBranch = async () => gitPrBlocked();
export const commitChanges = async () => gitPrBlocked();
export const pushBranch = async () => gitPrBlocked();
export const openPullRequest = async () => gitPrBlocked();
export const updatePullRequest = async () => gitPrBlocked();
export const getPullRequestStatus = async () => gitPrBlocked();
export const getCheckRuns = async () => gitPrBlocked();
export const getCheckLogs = async () => gitPrBlocked();
