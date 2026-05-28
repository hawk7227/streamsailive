import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

type GenerationKind =
  | "image"
  | "image-to-video"
  | "text-to-video"
  | "voice"
  | "snap-pick-click"
  | "motion"
  | "launch";

type Provider = "auto" | "openai" | "fal" | "runway" | "kling" | "veo" | "elevenlabs";

type CreateGenerationRequest = {
  kind: GenerationKind;
  provider?: Provider;
  prompt: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  projectId?: string;
  userId?: string;
  sourceImageUrl?: string;
  voiceId?: string;
};

type ProviderResult = {
  provider: string;
  status: "submitted" | "completed" | "blocked";
  providerRunId?: string;
  outputUrl?: string;
  outputBase64?: string;
  response?: unknown;
  blockedReason?: string;
};

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

function timingSafeEqualText(left: string, right: string) {
  if (!left || !right || left.length !== right.length) return false;

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

function requireAdminGenerationAccess(request: Request) {
  const expected = process.env.ADMIN_GENERATION_KEY?.trim();

  if (!expected) {
    return jsonError(
      "ADMIN_GENERATION_KEY is not configured. Refusing to run provider generation.",
      500
    );
  }

  const headerKey = request.headers.get("x-admin-generation-key")?.trim() || "";
  const authorization = request.headers.get("authorization")?.trim() || "";
  const bearerKey = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : "";

  const allowed =
    timingSafeEqualText(headerKey, expected) ||
    timingSafeEqualText(bearerKey, expected);

  if (!allowed) {
    return jsonError("Unauthorized admin generation request.", 401);
  }

  return null;
}

function hasEnv(name: string) {
  return Boolean(process.env[name] && String(process.env[name]).trim().length > 0);
}

function resolveProvider(kind: GenerationKind, requested?: Provider): Provider {
  if (requested && requested !== "auto") return requested;
  if (kind === "image") return hasEnv("OPENAI_API_KEY") ? "openai" : "fal";
  if (kind === "voice") return "elevenlabs";
  if (kind === "text-to-video" || kind === "image-to-video") return hasEnv("RUNWAY_API_KEY") ? "runway" : "fal";
  if (kind === "snap-pick-click" || kind === "motion") return hasEnv("FAL_API_KEY") || hasEnv("FAL_KEY") ? "fal" : "openai";
  return hasEnv("OPENAI_API_KEY") ? "openai" : "fal";
}

function sizeFor(aspectRatio?: string) {
  switch (aspectRatio) {
    case "16:9":
      return "1536x1024";
    case "9:16":
      return "1024x1536";
    case "1:1":
    default:
      return "1024x1024";
  }
}

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function persistJobStart(input: CreateGenerationRequest, provider: Provider) {
  const supabase = supabaseAdmin();
  if (!supabase) return { persistence: false as const };

  const { data, error } = await supabase
    .schema("streams")
    .from("jobs")
    .insert({
      project_id: input.projectId || null,
      type: "generate",
      status: "submitted",
      provider,
      prompt: input.prompt,
      metadata: {
        source: "admingeneration",
        aspectRatio: input.aspectRatio || "16:9",
        userId: input.userId || null,
      },
    })
    .select("id")
    .single();

  if (error) return { persistence: false as const, persistenceError: error.message };
  return { persistence: true as const, jobId: data?.id as string | undefined };
}

async function persistProviderRun(jobId: string | undefined, result: ProviderResult) {
  const supabase = supabaseAdmin();
  if (!supabase || !jobId) return;

  await supabase.schema("streams").from("provider_runs").insert({
    job_id: jobId,
    provider: result.provider,
    status: result.status,
    request_ref: result.providerRunId || null,
    response_ref:
      typeof result.response === "object" && result.response && "response_url" in result.response
        ? String((result.response as { response_url?: string }).response_url || "")
        : null,
    output_asset_id: null,
  });

  if (result.outputUrl || result.outputBase64) {
    await supabase.schema("streams").from("assets").insert({
      project_id: null,
      job_id: jobId,
      type: result.outputBase64 ? "image_base64" : "url",
      url: result.outputUrl || null,
      metadata: {
        provider: result.provider,
        hasBase64: Boolean(result.outputBase64),
      },
    });
  }
}

async function runOpenAI(input: CreateGenerationRequest): Promise<ProviderResult> {
  if (!hasEnv("OPENAI_API_KEY")) {
    return { provider: "openai", status: "blocked", blockedReason: "OPENAI_API_KEY is not configured." };
  }

  if (input.kind !== "image" && input.kind !== "snap-pick-click" && input.kind !== "launch") {
    return {
      provider: "openai",
      status: "blocked",
      blockedReason: `OpenAI route is enabled here for image/visual planning jobs only. ${input.kind} requires the matching provider key.`,
    };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.images.generate({
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
    prompt: input.prompt,
    size: sizeFor(input.aspectRatio) as "1024x1024" | "1536x1024" | "1024x1536",
  });

  const first = response.data?.[0] as { url?: string; b64_json?: string } | undefined;
  return {
    provider: "openai",
    status: "completed",
    providerRunId: response.created ? String(response.created) : undefined,
    outputUrl: first?.url,
    outputBase64: first?.b64_json,
    response,
  };
}

async function runFal(input: CreateGenerationRequest): Promise<ProviderResult> {
  const key = process.env.FAL_API_KEY || process.env.FAL_KEY;
  if (!key) return { provider: "fal", status: "blocked", blockedReason: "FAL_API_KEY or FAL_KEY is not configured." };

  const modelByKind: Record<GenerationKind, string | undefined> = {
    image: process.env.FAL_IMAGE_MODEL || "fal-ai/flux/dev",
    "image-to-video": process.env.FAL_IMAGE_TO_VIDEO_MODEL,
    "text-to-video": process.env.FAL_TEXT_TO_VIDEO_MODEL,
    voice: undefined,
    "snap-pick-click": process.env.FAL_IMAGE_TO_VIDEO_MODEL || process.env.FAL_IMAGE_MODEL || "fal-ai/flux/dev",
    motion: process.env.FAL_IMAGE_TO_VIDEO_MODEL,
    launch: process.env.FAL_IMAGE_MODEL || "fal-ai/flux/dev",
  };

  const modelId = modelByKind[input.kind];
  if (!modelId) {
    return {
      provider: "fal",
      status: "blocked",
      blockedReason: `No fal.ai model is configured for ${input.kind}. Set the matching FAL_*_MODEL environment variable.`,
    };
  }

  const body: Record<string, unknown> = {
    prompt: input.prompt,
    aspect_ratio: input.aspectRatio || "16:9",
  };
  if (input.sourceImageUrl) body.image_url = input.sourceImageUrl;

  const response = await fetch(`https://queue.fal.run/${modelId}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      provider: "fal",
      status: "blocked",
      blockedReason: `fal.ai request failed with HTTP ${response.status}.`,
      response: data,
    };
  }

  return {
    provider: "fal",
    status: "submitted",
    providerRunId: data?.request_id || data?.id,
    response: data,
  };
}

async function runRunway(input: CreateGenerationRequest): Promise<ProviderResult> {
  if (!hasEnv("RUNWAY_API_KEY")) {
    return { provider: "runway", status: "blocked", blockedReason: "RUNWAY_API_KEY is not configured." };
  }
  if (!hasEnv("RUNWAY_GENERATION_ENDPOINT")) {
    return {
      provider: "runway",
      status: "blocked",
      blockedReason: "RUNWAY_GENERATION_ENDPOINT is not configured. Add the exact production Runway endpoint for the selected model.",
    };
  }

  const response = await fetch(String(process.env.RUNWAY_GENERATION_ENDPOINT), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RUNWAY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      promptText: input.prompt,
      ratio: input.aspectRatio || "16:9",
      image: input.sourceImageUrl || undefined,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { provider: "runway", status: "blocked", blockedReason: `Runway request failed with HTTP ${response.status}.`, response: data };
  }
  return { provider: "runway", status: "submitted", providerRunId: data?.id || data?.taskId, response: data };
}

async function runElevenLabs(input: CreateGenerationRequest): Promise<ProviderResult> {
  if (!hasEnv("ELEVENLABS_API_KEY")) {
    return { provider: "elevenlabs", status: "blocked", blockedReason: "ELEVENLABS_API_KEY is not configured." };
  }
  const voiceId = input.voiceId || process.env.ELEVENLABS_VOICE_ID;
  if (!voiceId) {
    return { provider: "elevenlabs", status: "blocked", blockedReason: "ELEVENLABS_VOICE_ID or request voiceId is required." };
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": String(process.env.ELEVENLABS_API_KEY),
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: input.prompt,
      model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return { provider: "elevenlabs", status: "blocked", blockedReason: `ElevenLabs request failed with HTTP ${response.status}.`, response: text };
  }

  const audio = Buffer.from(await response.arrayBuffer()).toString("base64");
  return { provider: "elevenlabs", status: "completed", outputBase64: audio };
}

async function runBlockedProvider(provider: Provider, input: CreateGenerationRequest): Promise<ProviderResult> {
  const envName = provider === "kling" ? "KLING_API_KEY" : provider === "veo" ? "VEO_API_KEY" : `${provider.toUpperCase()}_API_KEY`;
  if (!hasEnv(envName)) {
    return { provider, status: "blocked", blockedReason: `${envName} is not configured for ${input.kind}.` };
  }
  return {
    provider,
    status: "blocked",
    blockedReason: `${provider} is selected, but this repository does not yet contain a verified production endpoint contract for ${provider}. Add the official endpoint and request schema before enabling this path.`,
  };
}

async function runProvider(provider: Provider, input: CreateGenerationRequest): Promise<ProviderResult> {
  switch (provider) {
    case "openai":
      return runOpenAI(input);
    case "fal":
      return runFal(input);
    case "runway":
      return runRunway(input);
    case "elevenlabs":
      return runElevenLabs(input);
    case "kling":
    case "veo":
      return runBlockedProvider(provider, input);
    case "auto":
    default:
      return runProvider(resolveProvider(input.kind, input.provider), input);
  }
}

export async function POST(request: Request) {
  const authError = requireAdminGenerationAccess(request);
  if (authError) return authError;

  try {
    const input = (await request.json()) as CreateGenerationRequest;
    if (!input.prompt?.trim()) return jsonError("prompt is required");
    if (!input.kind) return jsonError("kind is required");

    const provider = resolveProvider(input.kind, input.provider);
    const job = await persistJobStart(input, provider);
    const result = await runProvider(provider, input);

    await persistProviderRun(job.jobId, result);

    return NextResponse.json({
      ok: result.status !== "blocked",
      route: "admingeneration",
      kind: input.kind,
      provider,
      job,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown generation error";
    return jsonError(message, 500);
  }
}
