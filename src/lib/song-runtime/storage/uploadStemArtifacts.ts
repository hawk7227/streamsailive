/**
 * storage/uploadStemArtifacts.ts
 *
 * Downloads and durably uploads each stem returned by the provider.
 * A stem is an isolated audio track (vocals, instrumental, drums, bass, other).
 *
 * Rules:
 * - Uploads each stem independently — partial success is acceptable
 * - Failed stems are logged and skipped; they do not abort the primary artifact
 * - Returns only the stems that were successfully uploaded
 * - Never returns temporary provider URLs as canonical stem artifacts
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { StemKind, StemRef, UploadedStem } from "../types";

const DOWNLOAD_TIMEOUT_MS = 90_000;
const STORAGE_BUCKET = "generations";

async function uploadOneStem(
  stem: StemRef,
  workspaceId: string,
): Promise<UploadedStem | null> {
  try {
    const res = await fetch(stem.url, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "STEM_DOWNLOAD_FAILED",
          stemKind: stem.kind,
          status: res.status,
        }),
      );
      return null;
    }

    const contentType = res.headers.get("content-type") ?? "audio/mpeg";
    const ext = contentType.includes("wav") ? "wav" : "mp3";
    const storagePath = `${workspaceId}/stems/${crypto.randomUUID()}-${stem.kind}.${ext}`;
    const buffer = Buffer.from(await res.arrayBuffer());

    if (buffer.length === 0) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "STEM_DOWNLOAD_EMPTY",
          stemKind: stem.kind,
        }),
      );
      return null;
    }

    const admin = createAdminClient();
    const { error } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, { contentType, upsert: true });

    if (error) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "STEM_UPLOAD_FAILED",
          stemKind: stem.kind,
          reason: error.message,
        }),
      );
      return null;
    }

    const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

    return {
      kind: stem.kind as StemKind,
      storageUrl: data.publicUrl,
      mimeType: contentType,
    };
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "STEM_UPLOAD_EXCEPTION",
        stemKind: stem.kind,
        reason: err instanceof Error ? err.message : String(err),
      }),
    );
    return null;
  }
}

/**
 * Upload all stems from a provider result.
 * Returns the stems that were successfully uploaded.
 * Partial success is acceptable — does not throw.
 */
export async function uploadStemArtifacts(
  stems: StemRef[],
  workspaceId: string,
): Promise<UploadedStem[]> {
  if (stems.length === 0) return [];

  const results = await Promise.allSettled(
    stems.map((stem) => uploadOneStem(stem, workspaceId)),
  );

  const uploaded: UploadedStem[] = [];
  for (const result of results) {
    if (result.status === "fulfilled" && result.value !== null) {
      uploaded.push(result.value);
    }
  }

  console.log(
    JSON.stringify({
      level: "info",
      event: "STEMS_UPLOADED",
      total: stems.length,
      succeeded: uploaded.length,
      failed: stems.length - uploaded.length,
    }),
  );

  return uploaded;
}
