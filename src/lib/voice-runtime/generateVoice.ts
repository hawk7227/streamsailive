/**
 * src/lib/voice-runtime/generateVoice.ts
 *
 * THE single public gate for all voice generation.
 * Every voice entrypoint calls this function. Nothing below it decides public behavior.
 *
 * Voice generation is synchronous (ElevenLabs/OpenAI return audio immediately).
 * The gate: normalize → validate → plan → persist → submit → upload → finalize → return
 */

import { normalizeVoiceRequest } from "./normalizeVoiceRequest";
import { validateVoiceRequest } from "./validateVoiceRequest";
import { buildVoicePlan } from "./buildVoicePlan";
import { resolveVoiceProvider } from "./resolveVoiceProvider";
import { createVoiceGeneration } from "./persistence/createVoiceGeneration";
import { createVoiceJob } from "./persistence/createVoiceJob";
import { finalizeVoiceArtifact } from "./persistence/finalizeVoiceArtifact";
import { uploadVoiceArtifact } from "./storage/uploadVoiceArtifact";
import { submitElevenLabsVoice } from "./providers/elevenlabs";
import { submitOpenAIVoice } from "./providers/openai";
import type { GenerateVoiceInput, GenerateVoiceResult } from "./types";

export { VoiceRuntimeError } from "./types";

export async function generateVoice(input: GenerateVoiceInput): Promise<GenerateVoiceResult> {
  // 1. Normalize
  const req = normalizeVoiceRequest(input);

  // 2. Resolve provider
  const resolved = resolveVoiceProvider(req);
  const normalizedReq = { ...req, provider: resolved.provider, model: resolved.model };

  // 3. Validate
  validateVoiceRequest(normalizedReq);

  // 4. Plan
  const plan = buildVoicePlan(normalizedReq);

  // 5. Create generation record
  let generationId: string;
  try {
    generationId = await createVoiceGeneration(normalizedReq, plan);
  } catch (err) {
    console.error(JSON.stringify({ level: "error", event: "VOICE_GENERATION_RECORD_FAILED", reason: err instanceof Error ? err.message : String(err) }));
    return { ok: false, generationId: "", status: "failed", outputUrl: null, provider: resolved.provider, model: resolved.model };
  }

  // 6. Create job record
  const jobId = await createVoiceJob({
    generationId, workspaceId: normalizedReq.workspaceId,
    provider: resolved.provider, model: resolved.model,
    requestPayload: { voice: normalizedReq.voice, speed: normalizedReq.speed, format: normalizedReq.format },
  });

  // 7. Submit to provider (voice is synchronous — returns audio Buffer directly)
  const submitArgs = { text: plan.text, voice: plan.voice, model: resolved.model, speed: plan.speed };
  const submitResult = resolved.provider === "openai"
    ? await submitOpenAIVoice(submitArgs)
    : await submitElevenLabsVoice(submitArgs);

  if (!submitResult.accepted || !submitResult.audio) {
    console.error(JSON.stringify({ level: "error", event: "VOICE_SUBMIT_FAILED", generationId, provider: resolved.provider, reason: submitResult.raw }));
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    await admin.from("generations").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", generationId);
    return { ok: false, generationId, status: "failed", outputUrl: null, provider: resolved.provider, model: resolved.model };
  }

  // 8. Upload to Supabase storage
  let storageUrl: string;
  try {
    storageUrl = await uploadVoiceArtifact(submitResult.audio, normalizedReq.workspaceId, submitResult.mimeType);
  } catch (err) {
    console.error(JSON.stringify({ level: "error", event: "VOICE_UPLOAD_FAILED", generationId, reason: err instanceof Error ? err.message : String(err) }));
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    await admin.from("generations").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", generationId);
    return { ok: false, generationId, status: "failed", outputUrl: null, provider: resolved.provider, model: resolved.model };
  }

  // 9. Finalize — create artifact + mark generation completed
  await finalizeVoiceArtifact({ generationId, jobId, workspaceId: normalizedReq.workspaceId, storageUrl, mimeType: submitResult.mimeType });

  console.log(JSON.stringify({ level: "info", event: "VOICE_GENERATION_COMPLETED", generationId, provider: resolved.provider, storageUrl }));

  return { ok: true, generationId, status: "completed", outputUrl: storageUrl, provider: resolved.provider, model: resolved.model };
}
