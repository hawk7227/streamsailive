import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope, StreamsAIAuthError } from "@/lib/streams-ai/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    return NextResponse.json({
      ok: true,
      apiVersion: "v1",
      authenticated: true,
      account: {
        userId: scope.userId,
        tenantId: scope.tenantId,
        defaultProjectId: scope.defaultProjectId,
        workspaceId: scope.workspaceId,
        moduleId: scope.moduleId,
        productId: scope.productId,
        firstName: scope.userFirstName || null,
        fullName: scope.userFullName || null,
        displayName: scope.userDisplayName || null,
      },
    });
  } catch (error) {
    const status = error instanceof StreamsAIAuthError ? error.status : 500;
    return NextResponse.json({
      ok: false,
      apiVersion: "v1",
      authenticated: false,
      error: error instanceof Error ? error.message : "Authentication failed",
    }, { status });
  }
}
