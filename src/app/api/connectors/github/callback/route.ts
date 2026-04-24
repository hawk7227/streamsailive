/**
 * GET /api/connectors/github/callback
 *
 * GitHub OAuth callback — completes the OAuth flow.
 *
 * Flow:
 *   1. Verify CSRF state token from cookie matches query param
 *   2. Exchange code for access_token via GitHub API
 *   3. Fetch user info + scopes from GitHub
 *   4. Encrypt token with AES-256-GCM (CONNECTOR_ENCRYPTION_KEY)
 *   5. Upsert into connected_accounts
 *   6. Create permission grant if projectId was in state
 *   7. Write audit record
 *   8. Redirect to redirectTo (default: /settings/connectors)
 *
 * Security:
 *   - State token verified before any processing
 *   - State expires after 10 minutes (checked via issuedAt)
 *   - Raw token is encrypted immediately — never logged or returned
 *   - Cookie cleared after use
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { createConnectedAccount, grantProjectAccess } from "@/lib/connector";
import { validateGitHubToken } from "@/lib/connector";
import { createAuditRecord } from "@/lib/audit";
import {
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_CALLBACK_URL,
} from "@/lib/env";

interface OAuthState {
  csrf:       string;
  projectId:  string | null;
  redirectTo: string;
  issuedAt:   number;
}

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function errorRedirect(base: string, message: string): NextResponse {
  const url = new URL(base);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url.toString());
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code       = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const redirectBase = `${req.nextUrl.origin}/settings/connectors`;

  // ── GitHub returned an error (user denied access, etc.) ───────────────────
  if (errorParam) {
    return errorRedirect(redirectBase, `GitHub OAuth error: ${errorParam}`);
  }

  if (!code || !stateParam) {
    return errorRedirect(redirectBase, "Missing code or state from GitHub.");
  }

  // ── Verify CSRF state ──────────────────────────────────────────────────────
  const cookieState = req.cookies.get("gh_oauth_state")?.value;
  if (!cookieState || cookieState !== stateParam) {
    return errorRedirect(redirectBase, "Invalid OAuth state. Please try connecting again.");
  }

  let state: OAuthState;
  try {
    state = JSON.parse(Buffer.from(stateParam, "base64url").toString("utf8")) as OAuthState;
  } catch {
    return errorRedirect(redirectBase, "Malformed OAuth state.");
  }

  // Check state expiry
  if (Date.now() - state.issuedAt > STATE_TTL_MS) {
    return errorRedirect(redirectBase, "OAuth session expired. Please try connecting again.");
  }

  const finalRedirect = state.redirectTo ?? redirectBase;

  // ── Validate env ───────────────────────────────────────────────────────────
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET || !GITHUB_CALLBACK_URL) {
    return errorRedirect(finalRedirect, "GitHub OAuth is not configured on this server.");
  }

  // ── Resolve authenticated user ─────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return errorRedirect(`${req.nextUrl.origin}/login`, "You must be signed in to connect a GitHub account.");
  }

  const admin = createAdminClient();
  let workspaceId: string;
  try {
    const sel = await getCurrentWorkspaceSelection(admin, user);
    workspaceId = sel.current.workspace.id;
  } catch {
    return errorRedirect(finalRedirect, "Could not resolve your workspace.");
  }

  // ── Exchange code for access token ─────────────────────────────────────────
  let accessToken: string;
  let refreshToken: string | undefined;

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept":       "application/json",
      },
      body: JSON.stringify({
        client_id:     GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri:  GITHUB_CALLBACK_URL,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`GitHub token endpoint returned ${tokenRes.status}`);
    }

    const tokenData = await tokenRes.json() as {
      access_token?:  string;
      refresh_token?: string;
      error?:         string;
      error_description?: string;
    };

    if (tokenData.error || !tokenData.access_token) {
      throw new Error(tokenData.error_description ?? tokenData.error ?? "No access_token in response");
    }

    accessToken  = tokenData.access_token;
    refreshToken = tokenData.refresh_token;
  } catch (err) {
    return errorRedirect(
      finalRedirect,
      `Failed to exchange GitHub code: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // ── Validate token + fetch user info ───────────────────────────────────────
  let providerAccountId:   string;
  let providerAccountName: string;
  let scopes:              string[];

  try {
    const validation = await validateGitHubToken(accessToken);
    providerAccountId   = String(validation.id);
    providerAccountName = validation.login;
    scopes              = validation.scopes;
  } catch (err) {
    return errorRedirect(
      finalRedirect,
      `GitHub token validation failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // ── Store encrypted account ────────────────────────────────────────────────
  const accountResult = await createConnectedAccount({
    workspace_id:         workspaceId,
    user_id:              user.id,
    provider:             "github",
    provider_account_id:  providerAccountId,
    provider_account_name: providerAccountName,
    provider_account_url: `https://github.com/${providerAccountName}`,
    scopes,
    credentials: {
      token:        accessToken,
      refreshToken: refreshToken,
    },
    display_name: providerAccountName,
    avatar_url:   `https://github.com/${providerAccountName}.png`,
  });

  if (accountResult.error) {
    return errorRedirect(
      finalRedirect,
      `Failed to save GitHub connection: ${accountResult.error.message}`
    );
  }

  const account = accountResult.data;

  // ── Grant project access if projectId in state ─────────────────────────────
  if (state.projectId && account) {
    await grantProjectAccess({
      account_id:        account.id,
      project_id:        state.projectId,
      workspace_id:      workspaceId,
      granted_scopes:    scopes,
      allow_destructive: false, // destructive must be explicitly enabled
      granted_by:        user.id,
    });
  }

  // ── Audit record ───────────────────────────────────────────────────────────
  await createAuditRecord({
    workspace_id:  workspaceId,
    event_type:    "connector.github.connected",
    event_category: "connect",
    actor:         `user:${user.id}`,
    subject_type:  "connected_account",
    subject_ref:   account?.id,
    summary:       `GitHub account "${providerAccountName}" connected via OAuth`,
    detail: {
      provider:            "github",
      providerAccountName,
      providerAccountId,
      scopes,
      projectId:           state.projectId ?? null,
      grantedDestructive:  false,
    },
    outcome: "success",
  });

  // ── Clear the state cookie and redirect ────────────────────────────────────
  const successUrl = new URL(finalRedirect);
  successUrl.searchParams.set("connected", "github");
  successUrl.searchParams.set("account",   providerAccountName);

  const response = NextResponse.redirect(successUrl.toString());
  response.cookies.delete("gh_oauth_state");

  return response;
}
