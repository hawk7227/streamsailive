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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const projectRefMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase/);
    const projectRef = projectRefMatch?.[1] || "";

    if (projectRef) {
      const baseKey = `sb-${projectRef}-auth-token`;

      if (cookies[baseKey]) {
        const val = cookies[baseKey];
        if (val.startsWith("base64-")) {
          const decoded = Buffer.from(val.slice(7), "base64").toString("utf-8");
          const json = JSON.parse(decoded);
          if (json?.access_token) return json.access_token;
        }
      }

      const splitKeys = Object.keys(cookies).filter((key) => key.startsWith(baseKey + ".")).sort();
      if (splitKeys.length > 0) {
        let combined = "";
        for (const k of splitKeys) combined += cookies[k];
        if (combined.startsWith("base64-")) {
          const decoded = Buffer.from(combined.slice(7), "base64").toString("utf-8");
          const json = JSON.parse(decoded);
          if (json?.access_token) return json.access_token;
        }
      }
    }

    const supabaseCookieKeys = Object.keys(cookies).filter((key) => key.startsWith("sb-") && key.endsWith("-auth-token"));
    if (supabaseCookieKeys.length > 0) {
      const val = cookies[supabaseCookieKeys[0]];
      if (val.startsWith("base64-")) {
        const decoded = Buffer.from(val.slice(7), "base64").toString("utf-8");
        const json = JSON.parse(decoded);
        if (json?.access_token) return json.access_token;
      }
    }

    const splitKeysFallback = Object.keys(cookies).filter((key) => key.startsWith("sb-") && key.includes("-auth-token.")).sort();
    if (splitKeysFallback.length > 0) {
      const baseKeyFallback = splitKeysFallback[0].split(".")[0];
      const matchingSplitKeys = splitKeysFallback.filter((k) => k.startsWith(baseKeyFallback + "."));
      let combined = "";
      for (const k of matchingSplitKeys) combined += cookies[k];
      if (combined.startsWith("base64-")) {
        const decoded = Buffer.from(combined.slice(7), "base64").toString("utf-8");
        const json = JSON.parse(decoded);
        if (json?.access_token) return json.access_token;
      }
    }
  } catch (err) {
    console.error("[tokenFromCookies] failed to parse cookies:", err);
  }
  return null;
}

function bearerFromRequest(request: NextRequest): string | null {
  const header = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (match?.[1]?.trim()) return match[1].trim();

  const tokenParam = request.nextUrl.searchParams.get("token");
  if (tokenParam) return tokenParam.trim();

  const tokenCookie = tokenFromCookies(request);
  if (tokenCookie) return tokenCookie.trim();

  return null;
}

function cleanNamePart(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function titleCaseFirstName(value: unknown) {
  const first = cleanNamePart(value).split(" ")[0] || "";
  if (!first || /@/.test(first)) return "";
  return first.toLocaleLowerCase().replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase());
}

function profileNamesFromMetadata(metadata: Record<string, any> | null | undefined, email?: string | null) {
  const fullName = cleanNamePart(
    metadata?.full_name ||
    metadata?.fullName ||
    metadata?.name ||
    metadata?.display_name ||
    metadata?.displayName ||
    "",
  );
  const displayName = cleanNamePart(metadata?.display_name || metadata?.displayName || fullName);
  const firstName = titleCaseFirstName(metadata?.first_name || metadata?.firstName || fullName || displayName || "");

  return {
    userFirstName: firstName || null,
    userFullName: fullName || null,
    userDisplayName: displayName || fullName || null,
  };
}

function isExplicitTestModeEnabled() {
  return process.env.STREAMS_AI_TEST_MODE === "true";
}

function isProductionRuntime() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

function isPreviewTestHost(request: NextRequest) {
  if (isProductionRuntime()) return false;

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  const isVercelGitPreview = host.includes(".vercel.app") && host.includes("-git-");
  const isVercelPreviewEnv = process.env.VERCEL_ENV === "preview";
  const explicitlyDisabled = process.env.STREAMS_AI_TEST_MODE === "false";
  return !explicitlyDisabled && (isLocal || isVercelGitPreview || isVercelPreviewEnv);
}

function isTestModeEnabled(request?: NextRequest) {
  if (isProductionRuntime()) return false;
  return isExplicitTestModeEnabled() || (request ? isPreviewTestHost(request) : false);
}

function testUserId() {
  return process.env.STREAMS_AI_TEST_USER_ID || "00000000-0000-4000-8000-000000000001";
}

function publicGuestUserId() {
  return process.env.STREAMS_AI_PUBLIC_GUEST_USER_ID || "00000000-0000-4000-8000-0000000000aa";
}

function publicGuestTenantId() {
  return process.env.STREAMS_AI_PUBLIC_GUEST_TENANT_ID || null;
}

function publicGuestModeEnabled(request: NextRequest) {
  if (process.env.STREAMS_AI_PUBLIC_GUEST_MODE === "false") return false;
  const pathname = request.nextUrl.pathname || "";
  return pathname.startsWith("/api/streams-ai/");
}

function testScopeOptions(reason: string) {
  return {
    tenantId: process.env.STREAMS_AI_TEST_TENANT_ID || null,
    projectName: "STREAMS AI test project",
    entitlementPlan: reason,
  };
}

function publicScopeOptions(reason: string) {
  return {
    tenantId: publicGuestTenantId(),
    projectName: "STREAMS AI public guest project",
    entitlementPlan: reason,
  };
}

function fallbackScope(userId: string, tenantId: string | null | undefined, profile: StreamsAIProfileNames = emptyProfileNames()): StreamsAIScope {
  return {
    tenantId: tenantId || "00000000-0000-4000-8000-0000000000bb",
    userId,
    defaultProjectId: null,
    workspaceId: "streams-ai",
    moduleId: "streams-ai-core",
    productId: "streams-ai",
    ...profile,
  };
}

export async function requireStreamsAIScope(request: NextRequest): Promise<StreamsAIScope> {
  const accessToken = bearerFromRequest(request);

  if (!accessToken) {
    if (publicGuestModeEnabled(request)) {
      try {
        return await ensureStreamsAIAccountScope(publicGuestUserId(), publicScopeOptions("public-guest"), true);
      } catch (error) {
        console.warn("[streams-ai-auth] using public fallback scope", error);
        return fallbackScope(publicGuestUserId(), publicGuestTenantId());
      }
    }

    if (isTestModeEnabled(request)) {
      try {
        return await ensureStreamsAIAccountScope(testUserId(), testScopeOptions("test-preview-no-token"), true);
      } catch (error) {
        console.warn("[streams-ai-auth] using test fallback scope", error);
        return fallbackScope(testUserId(), process.env.STREAMS_AI_TEST_TENANT_ID);
      }
    }

    throw new StreamsAIAuthError("STREAMS AI requires an authenticated Bearer token from the main streamsailive auth session.");
  }

  const userClient = createStreamsAIUserClient(accessToken);
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
  if (userError || !userData?.user?.id) {
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
  const schema = streamsAISchema();
  const tables = streamsAITables();
  const profile = profileNamesFromMetadata(options?.userMetadata, options?.userEmail);

  let account: any = null;
  const { data: existingAccount, error: accountReadError } = await service
    .schema(schema)
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
    const { data: inserted, error: insertError } = await service
      .schema(schema)
      .from(tables.accounts)
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        display_name: profile.userDisplayName || profile.userFullName || "Streams AI User",
        created_at: now,
        updated_at: now,
        settings: {},
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

  let projectId = account.default_project_id as string | null;
  if (!projectId) {
    const { data: project, error: projectError } = await service
      .schema(schema)
      .from(tables.projects)
      .insert({
        account_id: account.id,
        tenant_id: account.tenant_id,
        name: options?.projectName || "STREAMS AI workspace",
        slug: `streams-ai-${userId.slice(0, 8)}`,
        is_default: true,
        created_at: now,
        updated_at: now,
        metadata: { bootstrap: true },
      })
      .select("id")
      .single();

    if (projectError && tolerateBootstrapFailure) {
      console.warn("[streams-ai-auth] project insert fallback", projectError);
      return fallbackScope(userId, account.tenant_id, profile);
    }

    if (projectError) throw projectError;
    projectId = project.id;

    const { error: updateError } = await service
      .schema(schema)
      .from(tables.accounts)
      .update({ default_project_id: projectId, updated_at: now })
      .eq("id", account.id);

    if (updateError && tolerateBootstrapFailure) {
      console.warn("[streams-ai-auth] account default project update fallback", updateError);
      return fallbackScope(userId, account.tenant_id, profile);
    }

    if (updateError) throw updateError;
  }

  const { error: entitlementError } = await service
    .schema(schema)
    .from(tables.entitlements)
    .upsert({
      tenant_id: account.tenant_id,
      user_id: userId,
      product_id: "streams-ai",
      plan: options?.entitlementPlan || "trial",
      status: "active",
      updated_at: now,
    }, { onConflict: "tenant_id,user_id,product_id" });

  if (entitlementError && tolerateBootstrapFailure) {
    console.warn("[streams-ai-auth] entitlement upsert fallback", entitlementError);
    return fallbackScope(userId, account.tenant_id, profile);
  }

  if (entitlementError) throw entitlementError;

  return {
    tenantId: account.tenant_id,
    userId,
    defaultProjectId: projectId,
    workspaceId: "streams-ai",
    moduleId: "streams-ai-core",
    productId: "streams-ai",
    ...profile,
  };
}
