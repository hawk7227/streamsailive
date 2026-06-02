import { NextResponse } from "next/server";
import { generateVideo, VideoRuntimeError } from "@/lib/video-runtime/generateVideo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type RoutedPayload = {
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
  metadata?: Record<string, unknown>;
  model?: string;
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

async function forwardToAdminSubmit(request: Request, payload: RoutedPayload) {
  const response = await fetch(internalUrl(request, "/api/admingeneration/submit"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  return NextResponse.json(
    {
      ok: response.ok,
      route: "admingeneration-routed-submit",
      target: "/api/admingeneration/submit",
      status: response.status,
      result: await readResponse(response),
    },
    { status: response.ok ? 200 : response.status },
  );
}

function isVideoKind(kind: string) {
  return kind === "image-to-video" || kind === "text-to-video" || kind === "motion";
}

function resolveVideoRuntimeProvider(provider?: string) {
  const selected = String(provider || "fal").trim().toLowerCase();
  if (selected === "runway") return { provider: "runway", model: "gen4_turbo" };
  if (selected === "kling") return { provider: "kling", model: "kling-v2-6" };
  if (selected === "veo") return { provider: "fal", model: "veo-3.1" };
  return { provider: "fal", model: selected === "fal" ? "kling-v3" : undefined };
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as RoutedPayload | null;
  if (!payload || typeof payload !== "object") return jsonError("Invalid routed generation request body.", 400);

  const kind = String(payload.kind || "").trim();
  const prompt = String(payload.prompt || "").trim();
  if (!kind) return jsonError("kind is required.", 400);
  if (!prompt) return jsonError("prompt is required.", 400);

  if (!isVideoKind(kind)) {
    // Image / visual planning and voice stay on the proven admin submit path:
    // image/planning -> OpenAI/fal admin generation, voice -> ElevenLabs admin generation.
    return forwardToAdminSubmit(request, payload);
  }

  const imageUrl = String(payload.imageUrl || payload.sourceImageUrl || "").trim() || undefined;
  const runtimeProvider = resolveVideoRuntimeProvider(payload.provider);
  const type = kind === "image-to-video" || (kind === "motion" && imageUrl) ? "i2v" : "video";

  try {
    const result = await generateVideo({
      type,
      prompt,
      provider: runtimeProvider.provider,
      model: payload.model || runtimeProvider.model,
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
      route: "admingeneration-routed-submit",
      target: "video-runtime/generateVideo",
      kind,
      requestedProvider: payload.provider || "auto",
      result,
    }, { status: result.ok ? 200 : 500 });
  } catch (error) {
    if (error instanceof VideoRuntimeError) {
      return jsonError(error.message, 422, { code: error.code, detail: error.detail });
    }
    return jsonError("Video runtime generation failed.", 500, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
