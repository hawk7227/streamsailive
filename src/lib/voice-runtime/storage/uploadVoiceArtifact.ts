import { createAdminClient } from "@/lib/supabase/admin";
export async function uploadVoiceArtifact(audio: Buffer, workspaceId: string, mimeType: string): Promise<string> {
  const ext = mimeType.includes("wav") ? "wav" : "mp3";
  const storagePath = workspaceId + "/" + crypto.randomUUID() + "." + ext;
  const admin = createAdminClient();
  const { error } = await admin.storage.from("generations").upload(storagePath, audio, { contentType: mimeType, upsert: true });
  if (error) throw new Error("VOICE_STORAGE_UPLOAD_FAILED: " + error.message);
  const { data } = admin.storage.from("generations").getPublicUrl(storagePath);
  return data.publicUrl;
}
