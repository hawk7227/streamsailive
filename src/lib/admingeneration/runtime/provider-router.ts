import { getSupabaseServiceClient } from "@/lib/supabase/service";

export type AdminGenerationProvider =
  | "auto"
  | "openai"
  | "fal"
  | "runway"
  | "kling"
  | "veo"
  | "elevenlabs"
  | "external";

export type ProviderDispatchInput = {
  projectId?: string | null;
  providerRunId?: string | null;
  action: string;
  kind?: string;
  provider?: AdminGenerationProvider;
  prompt?: string;
  sourceUrl?: string | null;
  sourceImageUrl?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  selected?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  aspectRatio?: string | null;
  duration?: string | number | null;
  voiceId?: string | null;
};

export type ProviderDispatchResult = {
  provider: AdminGenerationProvider;
  status: "submitted" | "completed" | "failed" | "blocked";
  providerJobId?: string | null;
  outputUrl?: string | null;
  outputAssetId?: string | null;
  response?: unknown;
  error?: string | null;
  requiresPolling?: boolean;
};

function hasEnv(name: string) {
  return Boolean(process.env[name] && String(process.env[name]).trim().length > 0);
}

function resolveProvider(input: ProviderDispatchInput): AdminGenerationProvider {
  if (input.provider && input.provider !== "auto") return input.provider;
  const kind = String(input.kind || input.action || "").toLowerCase();
  if (kind.includes("voice") || kind.includes("audio") || kind.includes("lip")) return "elevenlabs";
  if (kind.includes("video") || kind.includes("motion") || kind.includes("segment") || kind.includes("edit")) {
    if (hasEnv("RUNWAY_API_KEY")) return "runway";
    if ((hasEnv("KLING_ACCESS_KEY") && hasEnv("KLING_SECRET_KEY")) || (hasEnv("KLING_ASSESS_API_KEY") && hasEnv("KLING_API_KEY"))) return "kling";
    if (hasEnv("VEO_API_KEY")) return "veo";
    if (hasEnv("FAL_API_KEY") || hasEnv("FAL_KEY")) return "fal";
  }
  if (hasEnv("OPENAI_API_KEY")) return "openai";
  if (hasEnv("FAL_API_KEY") || hasEnv("FAL_KEY")) return "fal";
  return "external";
}

function requirePrompt(input: ProviderDispatchInput) {
  return String(input.prompt || input.metadata?.instruction || input.selected?.instruction || input.action || "").trim();
}

async function dispatchFal(input: ProviderDispatchInput): Promise<ProviderDispatchResult> {
  const key = process.env.FAL_API_KEY || process.env.FAL_KEY;
  if (!key) return { provider: "fal", status: "blocked", error: "FAL_API_KEY or FAL_KEY is not configured." };

  const kind = String(input.kind || input.action || "text-to-video").toLowerCase();
  const model =
    kind.includes("image") && !kind.includes("video")
      ? process.env.FAL_IMAGE_MODEL || "fal-ai/flux/dev"
      : process.env.FAL_VIDEO_MODEL || process.env.FAL_TEXT_TO_VIDEO_MODEL || process.env.FAL_IMAGE_TO_VIDEO_MODEL;

  if (!model) {
    return { provider: "fal", status: "blocked", error: "Set FAL_VIDEO_MODEL, FAL_TEXT_TO_VIDEO_MODEL, or FAL_IMAGE_TO_VIDEO_MODEL for this media action." };
  }

  const body: Record<string, unknown> = {
    prompt: requirePrompt(input),
    aspect_ratio: input.aspectRatio || "16:9",
  };
  if (input.sourceImageUrl || input.sourceUrl) body.image_url = input.sourceImageUrl || input.sourceUrl;
  if (input.duration) body.duration = input.duration;

  const response = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { provider: "fal", status: "failed", response: data, error: `fal.ai request failed with HTTP ${response.status}.` };

  const outputUrl = data?.video?.url || data?.image?.url || data?.url || null;
  const responseWithModel = { ...data, model };
  return {
    provider: "fal",
    status: outputUrl ? "completed" : "submitted",
    providerJobId: data?.request_id || data?.id || data?.requestId || null,
    outputUrl,
    response: responseWithModel,
    requiresPolling: !outputUrl,
  };
}

async function dispatchConfiguredEndpoint(input: ProviderDispatchInput, provider: AdminGenerationProvider): Promise<ProviderDispatchResult> {
  const prefix = provider.toUpperCase();
  const key = process.env[`${prefix}_API_KEY`];
  const endpoint = process.env[`${prefix}_GENERATION_ENDPOINT`] || process.env[`${prefix}_EDIT_ENDPOINT`];
  if (!key) return { provider, status: "blocked", error: `${prefix}_API_KEY is not configured.` };
  if (!endpoint) return { provider, status: "blocked", error: `${prefix}_GENERATION_ENDPOINT or ${prefix}_EDIT_ENDPOINT is not configured.` };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      promptText: requirePrompt(input),
      prompt: requirePrompt(input),
      ratio: input.aspectRatio || "16:9",
      image: input.sourceImageUrl || input.sourceUrl || undefined,
      duration: input.duration || undefined,
      metadata: input.metadata || {},
    }),
  });
  const data = await response.json().catch(async () => ({ text: await response.text().catch(() => "") }));
  if (!response.ok) return { provider, status: "failed", response: data, error: `${provider} request failed with HTTP ${response.status}.` };
  const outputUrl = data?.outputUrl || data?.videoUrl || data?.url || data?.asset?.url || null;
  return {
    provider,
    status: outputUrl ? "completed" : "submitted",
    providerJobId: data?.id || data?.taskId || data?.jobId || data?.request_id || null,
    outputUrl,
    response: data,
    requiresPolling: !outputUrl,
  };
}

async function dispatchElevenLabs(input: ProviderDispatchInput): Promise<ProviderDispatchResult> {
  const key = process.env.ELEVENLABS_API_KEY;
  const voiceId = input.voiceId || process.env.ELEVENLABS_VOICE_ID;
  if (!key) return { provider: "elevenlabs", status: "blocked", error: "ELEVENLABS_API_KEY is not configured." };
  if (!voiceId) return { provider: "elevenlabs", status: "blocked", error: "ELEVENLABS_VOICE_ID or request voiceId is required." };

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: requirePrompt(input), model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2" }),
  });
  if (!response.ok) return { provider: "elevenlabs", status: "failed", error: `ElevenLabs request failed with HTTP ${response.status}.`, response: await response.text().catch(() => "") };
  const bytes = Buffer.from(await response.arrayBuffer());
  return { provider: "elevenlabs", status: "completed", response: { base64Audio: bytes.toString("base64"), mimeType: "audio/mpeg" } };
}

export async function dispatchProvider(input: ProviderDispatchInput): Promise<ProviderDispatchResult> {
  const provider = resolveProvider(input);
  if (provider === "fal") return dispatchFal(input);
  if (provider === "runway" || provider === "kling" || provider === "veo") return dispatchConfiguredEndpoint(input, provider);
  if (provider === "elevenlabs") return dispatchElevenLabs(input);
  if (provider === "openai") {
    return dispatchConfiguredEndpoint({ ...input, provider: "openai" }, "openai");
  }
  return { provider: "external", status: "blocked", error: "No production provider is configured for this action." };
}

export async function persistProviderDispatch(input: ProviderDispatchInput, result: ProviderDispatchResult) {
  if (!input.providerRunId && !input.projectId) return null;
  const supabase = getSupabaseServiceClient();
  const patch = {
    provider: result.provider,
    status: result.status,
    provider_job_id: result.providerJobId || null,
    response: result.response || {},
    error: result.error || null,
    updated_at: new Date().toISOString(),
  };

  if (input.providerRunId) {
    const { data, error } = await supabase
      .from("admingeneration_provider_runs")
      .update(patch)
      .eq("id", input.providerRunId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("admingeneration_provider_runs")
    .insert({
      project_id: input.projectId,
      provider: result.provider,
      action: input.action,
      status: result.status,
      request: input,
      response: result.response || {},
      provider_job_id: result.providerJobId || null,
      error: result.error || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
