/**
 * video-runtime/providers/kling.ts
 * Transport only. Normalized submit + poll for Kling video API.
 * JWT generation uses Node built-in crypto — no jsonwebtoken dependency.
 */

import { createHmac } from "crypto";
import { KLING_API_KEY, KLING_ASSESS_API_KEY } from "@/lib/env";
import type { ClipSpec, VideoProviderSubmitResult, VideoProviderStatusResult, VideoMode } from "../types";

const SUBMIT_TIMEOUT_MS = 30_000;
const POLL_TIMEOUT_MS = 10_000;
const KLING_BASE = "https://api-singapore.klingai.com";

function makeKlingJWT(): string {
  const ak = KLING_ASSESS_API_KEY;
  const sk = KLING_API_KEY;
  if (!ak || !sk) throw new Error("KLING keys not set");
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iss: ak, exp: now + 1800, nbf: now - 5 })).toString("base64url");
  const data = header + "." + payload;
  const sig = createHmac("sha256", sk).update(data).digest("base64url");
  return data + "." + sig;
}

function buildKlingBody(clip: ClipSpec, mode: VideoMode): Record<string, unknown> {
  const duration = String(Math.min(Math.max(clip.durationSeconds, 3), 15));
  if (mode === "image_to_video") {
    return {
      model_name: "kling-v2-1",
      image: clip.referenceImageUrl,
      prompt: clip.prompt,
      negative_prompt: "",
      duration,
      mode: "standard",
      aspect_ratio: "16:9",
    };
  }
  return {
    model_name: "kling-v2-6",
    prompt: clip.prompt,
    negative_prompt: "",
    duration,
    mode: "standard",
    aspect_ratio: "16:9",
  };
}

export async function submitKlingVideo(args: {
  clip: ClipSpec;
  model: string | null;
  mode: VideoMode;
  aspectRatio: string;
}): Promise<VideoProviderSubmitResult> {
  let token: string;
  try { token = makeKlingJWT(); } catch {
    return { accepted: false, provider: "kling", providerJobId: null, status: "failed", raw: "KLING keys not set" };
  }

  const endpoint = args.mode === "image_to_video"
    ? KLING_BASE + "/v1/videos/image2video"
    : KLING_BASE + "/v1/videos/text2video";

  const body = buildKlingBody(args.clip, args.mode);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return { accepted: false, provider: "kling", providerJobId: null, status: "failed", raw: text };
    }
    const data = await res.json() as { code: number; message?: string; data?: { task_id: string } };
    if (data.code !== 0 || !data.data?.task_id) {
      return { accepted: false, provider: "kling", providerJobId: null, status: "failed", raw: data };
    }
    return { accepted: true, provider: "kling", providerJobId: data.data.task_id, status: "queued", raw: data };
  } catch (err) {
    return { accepted: false, provider: "kling", providerJobId: null, status: "failed", raw: err instanceof Error ? err.message : String(err) };
  }
}

export async function pollKlingVideo(
  providerJobId: string,
  generationType: string,
): Promise<VideoProviderStatusResult> {
  let token: string;
  try { token = makeKlingJWT(); } catch {
    return { provider: "kling", providerJobId, status: "failed", raw: "KLING keys not set" };
  }

  const endpoint = generationType === "i2v"
    ? KLING_BASE + "/v1/videos/image2video/" + providerJobId
    : KLING_BASE + "/v1/videos/text2video/" + providerJobId;

  try {
    const res = await fetch(endpoint, {
      headers: { Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { provider: "kling", providerJobId, status: "processing", raw: null };
    }
    const d = await res.json() as { data: { task_status: string; task_result?: { videos?: { url: string }[] } } };
    const t = d.data;
    if (t.task_status === "failed") return { provider: "kling", providerJobId, status: "failed", raw: d };
    if (t.task_status !== "succeed") return { provider: "kling", providerJobId, status: "processing", raw: d };
    const outputUrl = t.task_result?.videos?.[0]?.url ?? null;
    return { provider: "kling", providerJobId, status: outputUrl ? "completed" : "failed", outputUrl, raw: d };
  } catch (err) {
    return { provider: "kling", providerJobId, status: "processing", raw: err instanceof Error ? err.message : String(err) };
  }
}
