/**
 * src/lib/connector/index.ts
 *
 * Public API for the STREAMS Connector Action Layer (Phase 7).
 *
 * Import from here in all application code:
 *   import { resolveGitHub, resolveVercel, withConnector } from "@/lib/connector"
 *
 * NEVER import from encryption.ts outside of connector/ — raw credentials
 * must never be handled outside this module boundary.
 */

// Runtime — the main entry points
export {
  resolveGitHub,
  resolveVercel,
  resolveSupabase,
  withConnector,
  validateAndRefreshAccount,
} from "./runtime";

// Repository — for API routes and admin operations
export {
  createConnectedAccount,
  getAccount,
  listAccountsForWorkspace,
  updateAccountStatus,
  revokeAccount,
  rotateAccountCredentials,
  grantProjectAccess,
  getProjectGrant,
  getRecentConnectorLogs,
} from "./repository";

// Adapters — for direct provider operations (server-only)
export {
  validateGitHubToken,
  getGitHubRepo,
  getLatestCommit,
  listGitHubRepos,
  validateVercelToken,
  getLatestDeployment,
  pollDeployment,
  getVercelProject,
  validateSupabaseKey,
  runSupabaseMigration,
} from "./adapters";

// Types
export type {
  ConnectorProvider,
  ConnectorStatus,
  ConnectorActionType,
  ConnectedAccount,
  DecryptedCredentials,
  ConnectorPermissionGrant,
  ConnectorActionLog,
  CreateAccountInput,
  CreatePermissionGrantInput,
  GitHubContext,
  VercelContext,
  SupabaseContext,
  ConnectorResolutionResult,
  ConnectorResult,
} from "./types";

export { connOk, connErr, GITHUB_SCOPES, VERCEL_SCOPES, SUPABASE_SCOPES } from "./types";
