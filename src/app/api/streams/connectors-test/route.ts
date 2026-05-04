/**
 * GET /api/streams/connectors-test
 * Diagnostic endpoint — returns exact failure point on DO.
 * DELETE THIS FILE after connectors are confirmed working.
 */
import { NextResponse } from "next/server";
import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { credentialKeyConfigured } from "@/lib/streams/credentials";


declare const process: { env: Record<string, string | undefined> };

export const maxDuration = 15;

export async function GET(): Promise<NextResponse> {
  const checks: Record<string, string> = {};

  checks.supabase_url     = process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ set" : "❌ MISSING";
  checks.service_role_key = process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ set" : "❌ MISSING";
  checks.credential_key   = credentialKeyConfigured() ? "✅ set" : "❌ MISSING — add STREAMS_CREDENTIAL_KEY";

  // Auth check
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    checks.auth = user ? `✅ user=${user.id.slice(0,8)}…` : `❌ no user (${error?.message ?? "not logged in"})`;

    if (user) {
      const admin = createAdminClient();

      // Workspace owner check
      try {
        const start = Date.now();
        const { data: ws } = await admin.from("workspaces").select("id").eq("owner_id", user.id).maybeSingle();
        checks.workspace_owner = ws?.id ? `✅ found ${ws.id.slice(0,8)}… (${Date.now()-start}ms)` : `⚠️ none (${Date.now()-start}ms)`;
      } catch (e) { checks.workspace_owner = `❌ error: ${(e as Error).message}`; }

      // Member check
      try {
        const start = Date.now();
        const { data: mb } = await admin.from("workspace_members").select("workspace_id").eq("user_id", user.id).limit(1).maybeSingle();
        checks.workspace_member = mb?.workspace_id ? `✅ found (${Date.now()-start}ms)` : `⚠️ none (${Date.now()-start}ms)`;
      } catch (e) { checks.workspace_member = `❌ error: ${(e as Error).message}`; }

      // connected_accounts table columns check
      try {
        const { data: cols } = await admin.rpc("version");
        checks.db_connection = `✅ connected (${cols})`;
      } catch (e) {
        checks.db_connection = `❌ ${(e as Error).message}`;
      }
    }
  } catch (e) { checks.auth = `❌ exception: ${(e as Error).message}`; }

  return NextResponse.json(checks, { status: 200 });
}
