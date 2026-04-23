/**
 * POST /api/streams/upload
 *
 * Returns a signed PUT URL for direct-to-Supabase-Storage upload.
 * Client uploads directly to that URL, then calls back with the
 * public URL. No file data passes through our server.
 *
 * Body: { filename, contentType, size }
 * Returns: { uploadUrl, publicUrl, path }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";

export const maxDuration = 30;

const BUCKET = "generations";
const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

const ALLOWED_TYPES = new Set([
  "video/mp4","video/quicktime","video/webm",
  "image/jpeg","image/png","image/webp","image/gif",
  "audio/mpeg","audio/wav","audio/ogg",
]);

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = raw as { filename?: string; contentType?: string; size?: number };

  if (!body.filename || !body.contentType || !body.size) {
    return NextResponse.json({ error: "filename, contentType, size required" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(body.contentType)) {
    return NextResponse.json({ error: `Content type not allowed: ${body.contentType}` }, { status: 422 });
  }

  if (body.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File exceeds 500MB limit" }, { status: 422 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  let workspaceId: string;
  try {
    const sel = await getCurrentWorkspaceSelection(admin, user);
    workspaceId = sel.current.workspace.id;
  } catch {
    return NextResponse.json({ error: "Could not resolve workspace" }, { status: 500 });
  }

  // Build storage path: workspace/uploads/uuid.ext
  const ext  = body.filename.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${workspaceId}/uploads/${crypto.randomUUID()}.${ext}`;

  // Create signed upload URL (valid for 5 minutes)
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to create upload URL" }, { status: 500 });
  }

  const { data: pubData } = admin.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({
    uploadUrl: data.signedUrl,
    path,
    publicUrl: pubData.publicUrl,
    expiresIn: 300,
  });
}
