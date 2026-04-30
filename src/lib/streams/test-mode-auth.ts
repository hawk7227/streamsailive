import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection, listWorkspaceMemberships } from "@/lib/team-server";

export interface StreamsRouteContext {
  userId: string | null;
  workspaceId: string | null;
  admin: ReturnType<typeof createAdminClient>;
  isTestMode: boolean;
  authenticatedUser: User | null;
}

type ResolveOptions = {
  request?: Request;
  body?: Record<string, unknown> | null;
  requireWorkspace?: boolean;
  allowTestMode?: boolean;
};

const TEST_USER_ID = process.env.TEST_USER_ID || "streams-test-user";
const TEST_WORKSPACE_ID =
  process.env.STREAMS_TEST_WORKSPACE_ID ||
  process.env.NEXT_PUBLIC_STREAMS_TEST_WORKSPACE_ID ||
  "streams-public-test";

function extractBodyString(body: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = body?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function extractRequestString(request: Request | undefined, key: string): string | null {
  if (!request) return null;
  const headerValue = request.headers.get(`x-streams-${key}`) || request.headers.get(`x-${key}`);
  if (headerValue && headerValue.trim().length > 0) return headerValue.trim();
  try {
    const value = new URL(request.url).searchParams.get(key);
    return value && value.trim().length > 0 ? value.trim() : null;
  } catch {
    return null;
  }
}

async function resolveWorkspaceForUser(
  admin: ReturnType<typeof createAdminClient>,
  user: User,
): Promise<string | null> {
  try {
    const selection = await getCurrentWorkspaceSelection(admin, user);
    return selection.current.workspace.id;
  } catch {
    return null;
  }
}

async function resolveWorkspaceForTestUser(
  admin: ReturnType<typeof createAdminClient>,
  requestedWorkspaceId: string | null,
): Promise<string> {
  if (requestedWorkspaceId) return requestedWorkspaceId;

  try {
    const memberships = await listWorkspaceMemberships(admin, TEST_USER_ID);
    const firstWorkspaceId = memberships[0]?.workspace.id;
    if (firstWorkspaceId) return firstWorkspaceId;
  } catch {
    // fall through to configured test workspace id
  }

  return TEST_WORKSPACE_ID;
}

export async function resolveStreamsRouteContext(
  options: ResolveOptions = {},
): Promise<StreamsRouteContext | null> {
  const admin = createAdminClient();
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (!error && user) {
    const workspaceId = await resolveWorkspaceForUser(admin, user);
    if (options.requireWorkspace !== false && !workspaceId) {
      return null;
    }

    return {
      userId: user.id,
      workspaceId,
      admin,
      isTestMode: false,
      authenticatedUser: user,
    };
  }

  if (options.allowTestMode === false) {
    return null;
  }

  const requestedUserId =
    extractBodyString(options.body ?? null, "userId") ||
    extractRequestString(options.request, "user-id") ||
    extractRequestString(options.request, "userId") ||
    extractRequestString(options.request, "testUserId");

  if (requestedUserId !== TEST_USER_ID) {
    return null;
  }

  const requestedWorkspaceId =
    extractBodyString(options.body ?? null, "workspaceId") ||
    extractRequestString(options.request, "workspace-id") ||
    extractRequestString(options.request, "workspaceId");

  const workspaceId = await resolveWorkspaceForTestUser(admin, requestedWorkspaceId);

  if (options.requireWorkspace !== false && !workspaceId) {
    return null;
  }

  return {
    userId: TEST_USER_ID,
    workspaceId,
    admin,
    isTestMode: true,
    authenticatedUser: null,
  };
}

export function isFallbackTestWorkspace(workspaceId: string | null | undefined): boolean {
  return !workspaceId || workspaceId === TEST_WORKSPACE_ID;
}
