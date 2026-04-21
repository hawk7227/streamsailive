/**
 * storage/uploadVideoArtifact.ts
 * Downloads a provider video URL and uploads to Supabase storage.
 * Returns a durable storage URL. Never exposes temporary provider URLs.
 */

import { createAdminClient } from "@/lib/supabase/admin";

const DOWNLOAD_TIMEOUT_MS = 60_000;

export async function uploadVideoArtifact(
  providerUrl: string,
  workspaceId: string,
): Promise<{ storageUrl: string; mimeType: string }> {
  const res = await fetch(providerUrl, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error("DOWNLOAD_FAILED: " + res.statusText);
  }

  const contentType = res.headers.get("content-type") ?? "video/mp4";
  const ext = contentType.includes("webm") ? "webm" : "mp4";
  const storagePath = workspaceId + "/" + crypto.randomUUID() + "." + ext;
  const buffer = Buffer.from(await res.arrayBuffer());

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from("generations")
    .upload(storagePath, buffer, { contentType, upsert: true });

  if (error) {
    throw new Error("STORAGE_UPLOAD_FAILED: " + error.message);
  }

  const { data } = admin.storage.from("generations").getPublicUrl(storagePath);
  return { storageUrl: data.publicUrl, mimeType: contentType };
}
