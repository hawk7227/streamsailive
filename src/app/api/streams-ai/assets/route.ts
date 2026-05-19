import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { readJsonBody, streamsAIError, streamsAIJson } from "@/lib/streams-ai/api";
import { StreamsAIAssetsRepository } from "@/lib/streams-ai/repositories/assets-repository";

const assets = new StreamsAIAssetsRepository();

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const projectId = request.nextUrl.searchParams.get("projectId");
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const data = await assets.list(scope, { projectId, sessionId });
    return streamsAIJson({ ok: true, assets: data });
  } catch (error) {
    return streamsAIError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const files = form.getAll("file").filter((item): item is File => item instanceof File);
      if (!files.length) return streamsAIJson({ ok: false, error: "file is required" }, 400);

      const sessionId = stringOrNull(form.get("sessionId"));
      const projectId = stringOrNull(form.get("projectId"));
      const messageId = stringOrNull(form.get("messageId"));
      const productId = stringOrNull(form.get("productId"));

      const uploaded = [];
      for (const file of files) {
        uploaded.push(
          await assets.uploadFile(scope, file, {
            sessionId,
            projectId,
            messageId,
            productId,
            metadata: { source: "streams-ai-upload" },
          }),
        );
      }

      return streamsAIJson({ ok: true, assets: uploaded }, 201);
    }

    const body = await readJsonBody<{
      name?: string;
      kind?: string;
      projectId?: string | null;
      sessionId?: string | null;
      messageId?: string | null;
      productId?: string | null;
      mimeType?: string | null;
      sizeBytes?: number;
      storageBucket?: string | null;
      storagePath?: string | null;
      publicUrl?: string | null;
      metadata?: Record<string, unknown>;
    }>(request);

    if (!body.name?.trim()) return streamsAIJson({ ok: false, error: "name is required" }, 400);

    const asset = await assets.create(scope, {
      name: body.name,
      kind: body.kind,
      projectId: body.projectId,
      sessionId: body.sessionId,
      messageId: body.messageId,
      productId: body.productId,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      storageBucket: body.storageBucket,
      storagePath: body.storagePath,
      publicUrl: body.publicUrl,
      metadata: body.metadata,
    });

    return streamsAIJson({ ok: true, asset }, 201);
  } catch (error) {
    return streamsAIError(error);
  }
}

function stringOrNull(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
