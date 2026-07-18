import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsAIAssetsRepository } from "@/lib/streams-ai/repositories/assets-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const assets = new StreamsAIAssetsRepository();

function failure(error: unknown) {
  return NextResponse.json({
    ok: false,
    apiVersion: "v1",
    error: error instanceof Error ? error.message : "Unknown assets error",
  }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const projectId = request.nextUrl.searchParams.get("projectId");
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const ids = request.nextUrl.searchParams.getAll("id").map((item) => item.trim()).filter(Boolean);
    const rows = ids.length
      ? await assets.listByIds(scope, ids)
      : await assets.list(scope, { projectId, sessionId });
    return NextResponse.json({ ok: true, apiVersion: "v1", assets: rows });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ ok: false, apiVersion: "v1", error: "file is required" }, { status: 400 });
      }
      const projectId = String(form.get("projectId") || scope.defaultProjectId || "") || null;
      const sessionId = String(form.get("sessionId") || "") || null;
      const kind = String(form.get("kind") || "") || undefined;
      const asset = await assets.uploadFile(scope, file, { projectId, sessionId, kind });
      return NextResponse.json({ ok: true, apiVersion: "v1", asset }, { status: 201 });
    }

    const body = await request.json().catch(() => ({})) as {
      projectId?: string | null;
      sessionId?: string | null;
      messageId?: string | null;
      productId?: string | null;
      kind?: string;
      name?: string;
      mimeType?: string | null;
      sizeBytes?: number;
      publicUrl?: string | null;
      metadata?: Record<string, unknown>;
      assetIds?: string[];
      attachToSessionId?: string;
    };

    if (Array.isArray(body.assetIds) && body.attachToSessionId) {
      await assets.attachToSession(scope, body.assetIds, body.attachToSessionId);
      return NextResponse.json({ ok: true, apiVersion: "v1", attached: body.assetIds.length });
    }
    if (!body.name?.trim()) {
      return NextResponse.json({ ok: false, apiVersion: "v1", error: "name is required" }, { status: 400 });
    }
    const asset = await assets.create(scope, {
      projectId: body.projectId,
      sessionId: body.sessionId,
      messageId: body.messageId,
      productId: body.productId,
      kind: body.kind,
      name: body.name.trim(),
      mimeType: body.mimeType,
      sizeBytes: Math.max(0, Number(body.sizeBytes || 0)),
      publicUrl: body.publicUrl,
      metadata: body.metadata || {},
    });
    return NextResponse.json({ ok: true, apiVersion: "v1", asset }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
