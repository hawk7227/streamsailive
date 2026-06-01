import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { emptyBlueprint } from "@/lib/admingeneration/video-reference-blueprint";
import { createReferenceAnalysis } from "@/lib/admingeneration/video-reference-repository";
import { requiredWorkerCapabilities } from "@/lib/admingeneration/video-reference-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function safeFileName(name: string) {
  return (name || "reference-video.bin")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 160);
}

function assetTypeFor(mimeType: string, fileName: string) {
  const lower = fileName.toLowerCase();
  if (mimeType.startsWith("video/") || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(lower)) return "video";
  if (mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(lower)) return "image";
  if (mimeType.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg)$/i.test(lower)) return "audio";
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) return "document";
  return "reference";
}

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { ok: false, route: "admingeneration-reference-upload-and-analyze", error: message, details },
    { status },
  );
}

export async function POST(request: Request) {
  const supabase = supabaseAdmin();

  if (!supabase) {
    return jsonError(
      "Supabase admin storage is not configured. SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
      500,
    );
  }

  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("multipart/form-data body is required.", 400);

  const file = form.get("file");
  const projectId = typeof form.get("projectId") === "string" ? String(form.get("projectId")) : null;
  const userId = typeof form.get("userId") === "string" ? String(form.get("userId")) : null;
  const requestedProfile =
    typeof form.get("requestedProfile") === "string" ? String(form.get("requestedProfile")) : "admin_full";

  if (!(file instanceof File)) return jsonError("file is required.", 400);

  const fileName = safeFileName(file.name);
  const mimeType = file.type || "application/octet-stream";
  const assetType = assetTypeFor(mimeType, fileName);
  const bucket = process.env.STREAMS_REFERENCE_BUCKET || "reference-assets";
  const objectPath = [
    "admingeneration",
    "reference",
    projectId || "unassigned",
    `${crypto.randomUUID()}-${fileName}`,
  ].join("/");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const upload = await supabase.storage.from(bucket).upload(objectPath, bytes, {
    contentType: mimeType,
    upsert: false,
  });

  if (upload.error) {
    return jsonError("Reference upload failed.", 500, {
      bucket,
      objectPath,
      storageError: upload.error.message,
    });
  }

  const publicUrl = supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;

  let assetId: string | null = null;
  let assetPersistence = false;
  let assetPersistenceError: string | null = null;

  const insert = await supabase
    .schema("streams")
    .from("assets")
    .insert({
      project_id: projectId,
      type: assetType,
      url: publicUrl,
      metadata: {
        source: "admingeneration-reference-upload-and-analyze",
        bucket,
        objectPath,
        fileName,
        mimeType,
        size: file.size,
        userId,
        requestedProfile,
      },
    })
    .select("id")
    .single();

  if (insert.error) {
    assetPersistenceError = insert.error.message;
  } else {
    assetPersistence = true;
    assetId = insert.data?.id || null;
  }

  const sourceType = "upload";
  const blueprint = emptyBlueprint({
    sourceType,
    sourceUrl: publicUrl,
    sourceAssetId: assetId,
    title: fileName,
  });

  const analysisResult = await createReferenceAnalysis({
    projectId,
    sourceType,
    sourceUrl: publicUrl,
    sourceAssetId: assetId,
    status: "needs_worker",
    blueprint,
    transcript: null,
    summary: "Uploaded source accepted. Full analysis requires worker frame/audio extraction.",
    metadata: {
      source: "admingeneration-reference-upload-and-analyze",
      upload: {
        bucket,
        objectPath,
        publicUrl,
        fileName,
        mimeType,
        size: file.size,
        assetType,
        assetId,
        assetPersistence,
        assetPersistenceError,
      },
      mode: "full-video-reference-analysis",
      requestedProfile,
      needsWorker: true,
      requiredWorkerCapabilities: requiredWorkerCapabilities(),
    },
  });

  return NextResponse.json({
    ok: true,
    route: "admingeneration-reference-upload-and-analyze",
    projectId,
    sourceType,
    asset: {
      assetId,
      assetType,
      sourceUrl: publicUrl,
      mimeType,
      size: file.size,
      persistence: assetPersistence,
      persistenceError: assetPersistenceError,
      storage: { bucket, path: objectPath, publicUrl },
    },
    analysisId: analysisResult.record.id,
    analysis: analysisResult.record,
    persistence: analysisResult.persistence,
    persistenceError: "persistenceError" in analysisResult ? analysisResult.persistenceError : null,
    worker: {
      required: true,
      capabilities: requiredWorkerCapabilities(),
    },
  });
}
