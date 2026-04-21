/**
 * storage/uploadSongArtifact.ts
 *
 * Downloads the final song audio from a provider URL and uploads it to
 * Supabase durable storage. Returns the durable public URL and MIME type.
 *
 * Rules:
 * - Never returns a temporary provider URL as the canonical artifact
 * - Verifies download success before attempting upload
 * - Verifies upload success before returning
 * - Throws on any failure — the caller decides how to handle it
 */

import { createAdminClient } from "@/lib/supabase/admin";

const DOWNLOAD_TIMEOUT_MS = 90_000; // songs can be large
const STORAGE_BUCKET = "generations";

export async function uploadSongArtifact(
  providerUrl: string,
  workspaceId: string,
): Promise<{ storageUrl: string; mimeType: string; fileSizeBytes: number }> {
  // Download from provider
  const res = await fetch(providerUrl, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(
      `SONG_DOWNLOAD_FAILED: Provider URL returned ${res.status} ${res.statusText}`,
    );
  }

  const contentType = res.headers.get("content-type") ?? "audio/mpeg";
  const ext = contentType.includes("wav") ? "wav" : "mp3";
  const storagePath = `${workspaceId}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await res.arrayBuffer());

  if (buffer.length === 0) {
    throw new Error("SONG_DOWNLOAD_EMPTY: Provider returned zero-byte response");
  }

  // Upload to Supabase storage
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: true });

  if (error) {
    throw new Error(`SONG_STORAGE_UPLOAD_FAILED: ${error.message}`);
  }

  const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

  return {
    storageUrl: data.publicUrl,
    mimeType: contentType,
    fileSizeBytes: buffer.length,
  };
}
