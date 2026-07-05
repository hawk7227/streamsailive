import { type NextRequest } from "next/server";
import { createStreamsAIServiceClient, createStreamsAIUserClient, streamsAISchema, streamsAITables } from "./server";

export type StreamsAIScope = {
  tenantId: string;
  userId: string;
  defaultProjectId: string | null;
  workspaceId: "streams-ai";
  moduleId: "streams-ai-core";
  productId: "streams-ai";
  userFirstName?: string | null;
  userFullName?: string | null;
  userDisplayName?: string | null;
};

export class StreamsAIAuthError extends Error {
  status = 401;
}

type StreamsAIProfileNames = ReturnType<typeof profileNamesFromMetadata>;

function emptyProfileNames(): StreamsAIProfileNames {
  return {
    userFirstName: null,
    userFullName: null,
    userDisplayName: null,
  };
}

function tokenFromCookies(request: NextRequest): string | null {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const parts = c.trim().split("=");
        return [parts[0], parts.slice(1).join("=")];
      })
    );

    if (cookies["access_token"]) return cookies["access_token"];
    if (cookies["sb-access-token"]) return cookies["sb-access-token"];
    for (const [key, value] of Object.entries(cookies)) {
      if (key.includes("auth-token") && value) {
        try {
          const parsed = JSON.parse(decodeURIComponent(value));
          if (Array.isArray(parsed) && parsed[0]) return parsed[0];
          if (parsed?.access_token) return parsed.access_token;
        } catch {
          // ignore malformed cookie
        }
      }
    }
  } catch {
    // ignore cookie parsing errors
  }
  return null;
}

function tokenFromHeader(request: NextRequest): string | null {
  const header = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function publicGuestModeEnabled(request: NextRequest) {
  if (process.env.STREAMS_AI_PUBLIC_GUEST_MODE === "1") return true;
  if (process.env.NEXT_PUBLIC_STREAMS_AI_PUBLIC_GUEST_MODE === "1") return true;
  const search = new URL(request.url).searchParams;
  return search.get("publicGuest") === "1" || search.get("guest") === "1";
}

function isTestModeEnabled(request: NextRequest) {
  if (process.env.STREAMS_AI_TEST_MODE === "1") return true;
  if (process.env.NEXT_PUBLIC_STREAMS_AI_TEST_MODE === "1") return true;
  const search = new URL(request.url).searchParams;
  return search.get("testMode") === "1" || search.get("test") === "1";
}

function publicGuestUserId() {
  return process.env.STREAMS_AI_PUBLIC_GUEST_USER_ID || "00000000-0000-0000-0000-000000000001";
}

function publicGuestTenantId() {
  return process.env.STREAMS_AI_PUBLIC_GUEST_TENANT_ID || "00000000-0000-0000-0000-000000000002";
}

function testUserId() {
  return process.env.STREAMS_AI_TEST_USER_ID || "00000000-0000-0000-0000-000000000003";
}

function profileNamesFromMetadata(metadata?: Record<string, any> | null, email?: string | null) {
  const first =
    metadata?.first_name ||
    metadata?.firstName ||
    metadata?.given_name ||
    metadata?.name?.split?.(" ")?.[0] ||
    email?.split("@")[0] ||
    null;
  const full = metadata?.full_name || metadata?.fullName || metadata?.name || first || null;
  const display = metadata?.display_name || metadata?.displayName || full || first || null;
  return { userFirstName: first, userFullName: full, userDisplayName: display };
}

function fallbackScope(userId: string, tenantId?: string | null, profile = emptyProfileNames()): StreamsAIScope {
  return {
    tenantId: tenantId || publicGuestTenantId(),
    userId,
    defaultProjectId: null,
    workspaceId: "streams-ai",
    moduleId: "streams-ai-core",
    productId: "streams-ai",
    ...profile,
  };
}

function publicScopeOptions(projectName: string) {
  return {
    tenantId: publicGuestTenantId(),
    projectName,
    entitlementPlan: "public_guest",
    userMetadata: { first_name: "Guest", full_name: "Guest User" },
    userEmail: "guest@streams.local",
  };
}

function testScopeOptions(projectName: string) {
  return {
    tenantId: process.env.STREAMS_AI_TEST_TENANT_ID || publicGuestTenantId(),
    projectName,
    entitlementPlan: "test_preview",
    userMetadata: { first_name: "Test", full_name: "Test User" },
    userEmail: "test@streams.local",
  };
}

export async function resolveStreamsAIAuthScope(request: NextRequest): Promise<StreamsAIScope> {
  if (publicGuestModeEnabled(request)) {
    try {
      return await ensureStreamsAIAccountScope(publicGuestUserId(), publicScopeOptions("public-guest"), true);
    } catch (error) {
      console.warn("[streams-ai-auth] using public guest fallback scope", error);
      return fallbackScope(publicGuestUserId(), publicGuestTenantId(), profileNamesFromMetadata({ first_name: "Guest", full_name: "Guest User" }, "guest@streams.local"));
    }
  }

  if (isTestModeEnabled(request)) {
    try {
      return await ensureStreamsAIAccountScope(testUserId(), testScopeOptions("test-preview"), true);
    } catch (error) {
      console.warn("[streams-ai-auth] using test fallback scope", error);
      return fallbackScope(testUserId(), process.env.STREAMS_AI_TEST_TENANT_ID, profileNamesFromMetadata({ first_name: "Test", full_name: "Test User" }, "test@streams.local"));
    }
  }

  const token = tokenFromHeader(request) || tokenFromCookies(request);
  if (!token) throw new StreamsAIAuthError("Missing STREAMS AI auth token.");

  const userClient = createStreamsAIUserClient(token);
  const { data: userData, error: userError } = await userClient.auth.getUser(token);

  if (userError || !userData.user) {
    if (publicGuestModeEnabled(request)) {
      try {
        return await ensureStreamsAIAccountScope(publicGuestUserId(), publicScopeOptions("public-guest-invalid-token-fallback"), true);
      } catch (error) {
        console.warn("[streams-ai-auth] using public invalid-token fallback scope", error);
        return fallbackScope(publicGuestUserId(), publicGuestTenantId());
      }
    }

    if (isTestModeEnabled(request)) {
      try {
        return await ensureStreamsAIAccountScope(testUserId(), testScopeOptions("test-preview-invalid-token-fallback"), true);
      } catch (error) {
        console.warn("[streams-ai-auth] using test invalid-token fallback scope", error);
        return fallbackScope(testUserId(), process.env.STREAMS_AI_TEST_TENANT_ID);
      }
    }

    throw new StreamsAIAuthError(userError?.message || "Invalid STREAMS AI auth session.");
  }

  const profile = profileNamesFromMetadata(userData.user.user_metadata, userData.user.email);
  try {
    return await ensureStreamsAIAccountScope(userData.user.id, {
      userMetadata: userData.user.user_metadata,
      userEmail: userData.user.email,
    });
  } catch (error) {
    if (publicGuestModeEnabled(request) || isTestModeEnabled(request)) {
      console.warn("[streams-ai-auth] using signed-in fallback scope", error);
      return fallbackScope(userData.user.id, publicGuestTenantId(), profile);
    }
    throw error;
  }
}

export async function ensureStreamsAIAccountScope(userId: string, options?: {
  userMetadata?: Record<string, any> | null;
  userEmail?: string | null;
  tenantId?: string | null;
  projectName?: string;
  entitlementPlan?: string;
}, tolerateBootstrapFailure = false): Promise<StreamsAIScope> {
  const service = createStreamsAIServiceClient();
  const now = new Date().toISOString();
  const schema = streamsAISchema(service);
  const tables = streamsAITables;
  const profile = profileNamesFromMetadata(options?.userMetadata, options?.userEmail);

  let account: any = null;
  const { data: existingAccount, error: accountReadError } = await schema
    .from(tables.accounts)
    .select("id, tenant_id, default_project_id, display_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (accountReadError && tolerateBootstrapFailure) {
    console.warn("[streams-ai-auth] account read fallback", accountReadError);
    return fallbackScope(userId, options?.tenantId, profile);
  }

  if (accountReadError) throw accountReadError;

  if (!existingAccount) {
    const tenantId = options?.tenantId || crypto.randomUUID();
    const { data: inserted, error: insertError } = await schema
      .from(tables.accounts)
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        display_name: profile.userDisplayName || profile.userFullName || profile.userFirstName || "Streams User",
        created_at: now,
        updated_at: now,
      })
      .select("id, tenant_id, default_project_id, display_name")
      .single();

    if (insertError && tolerateBootstrapFailure) {
      console.warn("[streams-ai-auth] account insert fallback", insertError);
      return fallbackScope(userId, tenantId, profile);
    }
    if (insertError) throw insertError;
    account = inserted;
  } else {
    account = existingAccount;
  }

  if (!account.default_project_id) {
    const { data: project, error: projectError } = await schema
      .from(tables.projects)
      .insert({
        tenant_id: account.tenant_id,
        account_id: account.id,
        name: options?.projectName || "My Streams Project",
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (projectError && tolerateBootstrapFailure) {
      console.warn("[streams-ai-auth] project insert fallback", projectError);
      return fallbackScope(userId, account.tenant_id, profile);
    }
    if (projectError) throw projectError;

    account.default_project_id = project.id;
    await schema.from(tables.accounts).update({ default_project_id: project.id, updated_at: now }).eq("id", account.id);
  }

  if (options?.entitlementPlan) {
    await schema.from(tables.productEntitlements).upsert({
      account_id: account.id,
      tenant_id: account.tenant_id,
      product_id: "streams-ai",
      plan: options.entitlementPlan,
      updated_at: now,
    }, { onConflict: "account_id,product_id" });
  }

  return {
    tenantId: account.tenant_id,
    userId,
    defaultProjectId: account.default_project_id,
    workspaceId: "streams-ai",
    moduleId: "streams-ai-core",
    productId: "streams-ai",
    ...profile,
  };
}
