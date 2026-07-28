import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";

export type AdminSessionContext = {
  userId: string;
  email: string | null;
  workspaceId: string;
  workspaceName: string | null;
  role: "owner" | "admin";
};

export class AdminAuthorizationError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AdminAuthorizationError";
  }
}

export async function requireAdminSession(): Promise<AdminSessionContext> {
  const supabase = await createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AdminAuthorizationError(401, "Authentication required");
  }

  const admin = createAdminClient();
  const selection = await getCurrentWorkspaceSelection(admin, user);
  const role = selection.current.role;

  if (role !== "owner" && role !== "admin") {
    throw new AdminAuthorizationError(403, "Administrator access required");
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    workspaceId: selection.current.workspace.id,
    workspaceName: selection.current.workspace.name,
    role,
  };
}

export function isAdminAuthorizationError(error: unknown): error is AdminAuthorizationError {
  return error instanceof AdminAuthorizationError;
}
