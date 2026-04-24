/**
 * GET /api/connectors/github/connect
 *
 * Initiates GitHub OAuth flow.
 * Redirects the browser to GitHub's authorization URL.
 *
 * Query params (optional):
 *   projectId — if provided, stored in state so callback can create a project grant
 *   redirectTo — where to send the user after successful connection
 *
 * Required env vars:
 *   GITHUB_CLIENT_ID      — from github.com Settings → Developer settings → OAuth Apps
 *   GITHUB_CALLBACK_URL   — must match the callback URL registered in the OAuth App
 *                           e.g. https://streamsailive.vercel.app/api/connectors/github/callback
 *
 * Security:
 *   A random CSRF state token is generated and stored in a signed cookie.
 *   The callback verifies this token before accepting the code exchange.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { GITHUB_CLIENT_ID, GITHUB_CALLBACK_URL } from "@/lib/env";

// GitHub OAuth scopes required for STREAMS operations
const GITHUB_SCOPES = [
  "repo",          // read/write code, create branches, commits
  "workflow",      // GitHub Actions access
  "read:user",     // username + avatar for display
  "user:email",    // email for display
].join(" ");

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const projectId  = searchParams.get("projectId");
  const redirectTo = searchParams.get("redirectTo") ?? "/settings/connectors";

  // Validate env vars are set
  if (!GITHUB_CLIENT_ID) {
    return NextResponse.json(
      { error: "GITHUB_CLIENT_ID is not configured. Add it to Vercel environment variables." },
      { status: 500 }
    );
  }
  if (!GITHUB_CALLBACK_URL) {
    return NextResponse.json(
      { error: "GITHUB_CALLBACK_URL is not configured." },
      { status: 500 }
    );
  }

  // Generate CSRF state token
  const statePayload = {
    csrf:       crypto.randomBytes(16).toString("hex"),
    projectId:  projectId ?? null,
    redirectTo,
    issuedAt:   Date.now(),
  };
  const stateEncoded = Buffer.from(JSON.stringify(statePayload)).toString("base64url");

  // Build GitHub authorization URL
  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id",     GITHUB_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri",  GITHUB_CALLBACK_URL);
  authUrl.searchParams.set("scope",         GITHUB_SCOPES);
  authUrl.searchParams.set("state",         stateEncoded);
  authUrl.searchParams.set("allow_signup",  "false"); // require existing GitHub account

  // Redirect to GitHub with state cookie set
  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set("gh_oauth_state", stateEncoded, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   600, // 10 minutes — OAuth flow should complete within this window
    path:     "/",
  });

  return response;
}
