import { type NextRequest } from "next/server";
import { createStreamsAIServiceClient, createStreamsAIUserClient, streamsAISchema } from "./server";

export type StreamsAIScope = {
  tenantId: string;
  userId: string;
  defaultProjectId: string | null;
  workspaceId: "streams-ai";
  moduleId: "streams-ai-core";
  productId: "streams-ai";
};

export class StreamsAIAuthError extends Error {
  status = 401;
}

function bearerFromRequest(request: NextRequest): string | null {
  const header = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function requireStreamsAIScope(request: NextRequest): Promise<StreamsAIScope> {
  const accessToken = bearerFromRequest(request);
  if (!accessToken) {
    throw new StreamsAIAuthError("STREAMS AI requires an authenticated Bearer token from the main streamsailive auth session.");
  }

  const userClient = createStreamsAIUserClient(accessToken);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user?.id) {
    throw new StreamsAIAuthError(userError?.message || "Invalid STREAMS AI auth session.");
  }

  return ensureStreamsAIAccountScope(userData.user.id);
}

async function ensureStreamsAIAccountScope(userId: string): Promise<StreamsAIScope> {
  const service = streamsAISchema(createStreamsAIServiceClient());

  const { data: membership, error: membershipError } = await service
    .from("memberships")
    .select("tenant_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error(`Failed to resolve STREAMS AI membership: ${membershipError.message}`);
  }

  let tenantId = membership?.tenant_id as string | undefined;

  if (!tenantId) {
    const { data: tenant, error: tenantError } = await service
      .from("tenants")
      .insert({ name: "Personal workspace" })
      .select("id")
      .single();

    if (tenantError || !tenant?.id) {
      throw new Error(`Failed to create STREAMS AI tenant: ${tenantError?.message || "unknown error"}`);
    }

    tenantId = tenant.id as string;

    const { error: memberCreateError } = await service
      .from("memberships")
      .insert({ tenant_id: tenantId, user_id: userId, role: "owner" });

    if (memberCreateError) {
      throw new Error(`Failed to create STREAMS AI membership: ${memberCreateError.message}`);
    }

    await service
      .from("product_entitlements")
      .upsert(
        { tenant_id: tenantId, user_id: userId, product_id: "streams-ai", status: "active", plan_id: "included" },
        { onConflict: "tenant_id,user_id,product_id" },
      );
  }

  const { data: project, error: projectError } = await service
    .from("projects")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (projectError) {
    throw new Error(`Failed to resolve STREAMS AI project: ${projectError.message}`);
  }

  let defaultProjectId = project?.id as string | undefined;
  if (!defaultProjectId) {
    const { data: createdProject, error: createProjectError } = await service
      .from("projects")
      .insert({ tenant_id: tenantId, user_id: userId, name: "Default STREAMS AI project" })
      .select("id")
      .single();

    if (createProjectError || !createdProject?.id) {
      throw new Error(`Failed to create STREAMS AI project: ${createProjectError?.message || "unknown error"}`);
    }

    defaultProjectId = createdProject.id as string;
  }

  return {
    tenantId,
    userId,
    defaultProjectId: defaultProjectId || null,
    workspaceId: "streams-ai",
    moduleId: "streams-ai-core",
    productId: "streams-ai",
  };
}
