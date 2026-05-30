import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  return (name || "reference.bin").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 140);
}

function assetTypeFor(mimeType: string, fileName: string) {
  const lower = fileName.toLowerCase();
  if (mimeType.startsWith("video/") || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(lower)) return "video";
  if (mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(lower)) return "image";
  if (mimeType.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg)$/i.test(lower)) return "audio";
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) return "document";
  return "reference";
}

export async function POST(request: Request) {
  const supabase = supabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, route: "admingeneration-reference-upload", error: "Supabase admin storage is not configured." },
      { status: 500 },
    );
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ ok: false, error: "multipart/form-data body is required" }, { status: 400 });
  }

  const file = form.get("file");
  const projectId = typeof form.get("projectId") === "string" ? String(form.get("projectId")) : null;

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "file is required" }, { status: 400 });
  }

  const fileName = safeFileName(file.name);
  const mimeType = file.type || "application/octet-stream";
  const assetType = assetTypeFor(mimeType, fileName);
  const bucket = process.env.STREAMS_REFERENCE_BUCKET || "reference-assets";
  const objectPath = `admingeneration/reference/${projectId || "unassigned"}/${crypto.randomUUID()}-${fileName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const upload = await supabase.storage.from(bucket).upload(objectPath, bytes, {
    contentType: mimeType,
    upsert: false,
  });

  if (upload.error) {
    return NextResponse.json(
      { ok: false, route: "admingeneration-reference-upload", error: upload.error.message, bucket, objectPath },
      { status: 500 },
    );
  }

  const publicUrl = supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;

  const insert = await supabase
    .schema("streams")
    .from("assets")
    .insert({
      project_id: projectId,
      type: assetType,
      url: publicUrl,
      metadata: {
        source: "admingeneration-reference-upload",
        bucket,
        objectPath,
        fileName,
        mimeType,
        size: file.size,
      },
    })
    .select("id")
    .single();

  return NextResponse.json({
    ok: true,
    route: "admingeneration-reference-upload",
    assetId: insert.data?.id || null,
    sourceUrl: publicUrl,
    projectId,
    assetType,
    mimeType,
    size: file.size,
    storage: { bucket, path: objectPath, publicUrl },
    persistence: !insert.error,
    persistenceError: insert.error?.message || null,
  });
}
