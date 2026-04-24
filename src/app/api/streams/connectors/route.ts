/**
 * GET  /api/streams/connectors  — list connected accounts
 * POST /api/streams/connectors  — save a new connector credential
 *
 * resolveUser uses THREE fast paths, none of which call getCurrentWorkspaceSelection.
 * Each DB call has an explicit 8s timeout — function fails fast instead of hanging 30s.
 */

import { NextResponse } from "next/server";
import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptCredential, credentialKeyConfigured } from "@/lib/streams/credentials";
import {
  listConnectedAccounts,
  type Provider,
} from "@/lib/streams/connectors/index";

export const maxDuration = 30;

// Wrap any promise with an explicit timeout so we fail fast, never hang
function withTimeout<T>(promise: Promise<T> | PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function resolveUser(): Promise<{
  user: { id: string } | null;
  workspaceId: string | null;
  admin: ReturnType<typeof createAdminClient> | null;
  errorMsg?: string;
}> {
  // ── Step 1: validate env vars immediately ─────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return {
      user: null, workspaceId: null, admin: null,
      errorMsg: `Missing env vars: ${!supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL " : ""}${!serviceKey ? "SUPABASE_SERVICE_ROLE_KEY" : ""}`.trim(),
    };
  }

  // ── Step 2: get user from session (8s timeout) ────────────────────────────
  let user: { id: string } | null = null;
  try {
    const supabase = await createClient();
    const result = await withTimeout(
      supabase.auth.getUser(),
      8000,
      "auth.getUser"
    );
    if (result.error || !result.data.user) {
      return { user: null, workspaceId: null, admin: null, errorMsg: "Not authenticated" };
    }
    user = result.data.user;
  } catch (e) {
    return { user: null, workspaceId: null, admin: null, errorMsg: `Auth failed: ${(e as Error).message}` };
  }

  const admin = createAdminClient();

  // ── Step 3a: owned workspace (fastest — single index scan) ────────────────
  try {
    const res1 = await withTimeout(
      admin.from("workspaces").select("id").eq("owner_id", user.id).maybeSingle() as unknown as Promise<{data:{id:string}|null}>,
      8000,
      "workspace owner lookup"
    );
    const data = res1.data;
    if (data?.id) return { user, workspaceId: data.id, admin };
  } catch { /* fall through */ }

  // ── Step 3b: workspace membership (second fastest) ────────────────────────
  try {
    const res2 = await withTimeout(
      admin.from("workspace_members").select("workspace_id").eq("user_id", user.id).limit(1).maybeSingle() as unknown as Promise<{data:{workspace_id:string}|null}>,
      8000,
      "workspace member lookup"
    );
    const data = res2.data;
    if (data?.workspace_id) return { user, workspaceId: data.workspace_id as string, admin };
  } catch { /* fall through */ }

  // ── Step 3c: profile current_workspace_id (last resort) ──────────────────
  try {
    const res3 = await withTimeout(
      admin.from("profiles").select("current_workspace_id").eq("id", user.id).maybeSingle() as unknown as Promise<{data:{current_workspace_id:string}|null}>,
      8000,
      "profile workspace lookup"
    );
    const data = res3.data;
    if (data?.current_workspace_id) return { user, workspaceId: data.current_workspace_id as string, admin };
  } catch { /* fall through */ }

  return { user: null, workspaceId: null, admin: null, errorMsg: "No workspace found for user" };
}

const VALID_PROVIDERS: Provider[] = ["github", "vercel", "supabase"];

export async function GET(): Promise<NextResponse> {
  const { user, workspaceId, admin, errorMsg } = await resolveUser();
  if (!user || !workspaceId || !admin) {
    const isEnvError = errorMsg?.includes("Missing env vars") || errorMsg?.includes("timed out");
    return NextResponse.json(
      { error: errorMsg ?? "Unauthorized" },
      { status: isEnvError ? 503 : 401 }
    );
  }

  try {
    const accounts = await withTimeout(
      listConnectedAccounts(admin, workspaceId),
      10000,
      "listConnectedAccounts"
    );
    return NextResponse.json({ data: accounts });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const { user, workspaceId, admin, errorMsg } = await resolveUser();
  if (!user || !workspaceId || !admin) {
    const isEnvError = errorMsg?.includes("Missing env vars") || errorMsg?.includes("timed out");
    return NextResponse.json(
      { error: errorMsg ?? "Unauthorized" },
      { status: isEnvError ? 503 : 401 }
    );
  }

  if (!credentialKeyConfigured()) {
    return NextResponse.json(
      { error: "STREAMS_CREDENTIAL_KEY not set on this server. Add it to DigitalOcean environment variables." },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { provider, credential, projectId, providerAccountId, scopes } = body;

  if (!provider || !VALID_PROVIDERS.includes(provider as Provider)) {
    return NextResponse.json(
      { error: `provider must be one of: ${VALID_PROVIDERS.join(", ")}` },
      { status: 400 }
    );
  }
  if (!credential || typeof credential !== "string" || credential.trim().length < 10) {
    return NextResponse.json(
      { error: "credential must be a valid token (at least 10 chars)" },
      { status: 400 }
    );
  }

  let encryptedCredential: string;
  try {
    encryptedCredential = await withTimeout(
      encryptCredential(credential.trim()),
      5000,
      "encryptCredential"
    );
  } catch (e) {
    return NextResponse.json(
      { error: `Encryption failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  const rotationDue = new Date();
  rotationDue.setDate(rotationDue.getDate() + 90);

  try {
    const upsertQuery = admin
      .from("connected_accounts")
      .upsert({
        workspace_id:          workspaceId,
        user_id:               user.id,
        provider:              provider as Provider,
        provider_account_id:   (providerAccountId as string) ?? null,
        scopes:                Array.isArray(scopes) ? scopes : [],
        encrypted_credentials: encryptedCredential,
        status:                "active",
        project_id:            (projectId as string) ?? null,
        rotation_due_at:       rotationDue.toISOString(),
        connected_by:          user.id,
      }, { onConflict: "workspace_id,provider" })
      .select("id")
      .single();
    const upsertResult = await withTimeout(
      upsertQuery as unknown as Promise<{data:{id:string}|null; error:{message:string}|null}>,
      10000,
      "upsert connected_accounts"
    );
    const { data: inserted, error: insertError } = upsertResult;

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    if (!inserted) {
      return NextResponse.json({ error: "Insert returned no data" }, { status: 500 });
    }

    return NextResponse.json(
      { data: { accountId: inserted.id, provider, status: "active", message: `${provider} connected successfully` } },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: `Database error: ${(e as Error).message}` },
      { status: 503 }
    );
  }
}
