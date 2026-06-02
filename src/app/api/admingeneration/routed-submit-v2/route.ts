import { NextResponse } from "next/server";
import { buildCompiledPrompt, normalizeGenerationMode } from "@/lib/admingeneration/generation-mode";
import { generateVideo, VideoRuntimeError } from "@/lib/video-runtime/generateVideo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Payload = {
  kind?: string;
  provider?: string;
  prompt?: string;
  aspectRatio?: string;
  duration?: string;
  projectId?: string;
  workspaceId?: string;
  sourceImageUrl?: string;
  imageUrl?: string;
  voiceId?: string;
  model?: string;
  metadata?: Record<string, unknown>;
};

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

function internalUrl(request: Request, pathname: string) {
  return new URL(pathname, new URL(request.url).origin).toString();
}

async function readResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json().catch(() => null);
  const text = await response.text().catch(() => "");
  return text ? { text } : null;
}

function isVideoKind(kind: string) {
  return kind === "image-to-video" || kind === "text-to-video" || kind === "motion";
}

function resolveRuntimeProvider(provider?: string) {
  const selected = String(provider || "fal").trim().toLowerCase();
  if (selected === "runway") return { provider: "runway", model: "gen4_turbo" };
  if (selected === "kling") return { provider: "kling", model: "kling-v2-6" };
  if (selected === "veo") return { provider: "fal", model: "veo-3.1" };
  return { provider: "fal", model: "kling-v3" };
}

async function submitImageOrVoice(request: Request, payload: Payload) {
  const adminKey = process.env.ADMIN_GENERATION_KEY?.trim();
  if (!adminKey) return jsonError("ADMIN_GENERATION_KEY is not configured.", 500);

  const response = await fetch(internalUrl(request, "/api/admingeneration/jobs"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-generation-key": adminKey,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  return NextResponse.json({
    ok: response.ok,
    route: "admingeneration-routed-submit-v2",
    target: "/api/admingeneration/jobs",
    status: response.status,
    result: await readResponse(response),
  }, { status: response.ok ? 200 : response.status });
}

async function submitVideo(payload: Payload) {
  const kind = String(payload.kind || "").trim();
  const prompt = String(payload.prompt || "").trim();
  const imageUrl = String(payload.imageUrl || payload.sourceImageUrl || "").trim() || undefined;
  const resolved = resolveRuntimeProvider(payload.provider);
  const type = kind === "image-to-video" || (kind === "motion" && imageUrl) ? "i2v" : "video";

  const result = await generateVideo({
    type,
    prompt,
    provider: resolved.provider,
    model: payload.model || resolved.model,
    duration: payload.duration,
    aspectRatio: payload.aspectRatio,
    quality: typeof payload.metadata?.qualityGoal === "string" ? String(payload.metadata.qualityGoal) : undefined,
    imageUrl,
    workspaceId: payload.workspaceId || payload.projectId || "admingeneration",
    realismMode: "premium_commercial",
    conversationId: typeof payload.metadata?.conversationId === "string" ? String(payload.metadata.conversationId) : undefined,
  });

  return NextResponse.json({
    ok: result.ok,
    route: "admingeneration-routed-submit-v2",
    target: "video-runtime/generateVideo",
    requestedKind: kind,
    requestedProvider: payload.provider || "auto",
    result,
  }, { status: result.ok ? 200 : 500 });
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as Payload | null;
  if (!payload || typeof payload !== "object") return jsonError("Invalid routed submit request body.", 400);

  const kind = String(payload.kind || "").trim();
  const prompt = String(payload.prompt || "").trim();
  if (!kind) return jsonError("kind is required.", 400);
  if (!prompt) return jsonError("prompt is required.", 400);

  try {
    if (isVideoKind(kind)) return await submitVideo(payload);
    return await submitImageOrVoice(request, payload);
  } catch (error) {
    if (error instanceof VideoRuntimeError) {
      return jsonError(error.message, 422, { code: error.code, detail: error.detail });
    }
    return jsonError("Routed submit failed.", 500, { message: error instanceof Error ? error.message : String(error) });
  }
}
