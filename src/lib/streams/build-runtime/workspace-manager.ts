export function getWorkspaceCapabilities() {
  return {
    local_workspace_available: "partial",
    github_workspace_available: "blocked",
    command_execution_available: "real",
    git_write_available: "blocked",
    blockedReason: "No isolated per-task workspace runner is configured.",
  };
}
