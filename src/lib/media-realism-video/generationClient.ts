/**
 * generationClient.ts — media-realism-video
 *
 * Submits N T2V candidates to Kling.
 * Wraps KlingProvider without modifying it.
 * Per spec: generate 4 candidates, poll/webhook resolves them.
 */

import jwt from "jsonwebtoken";
import type { T2VCandidate, T2VInput, ExpandedPrompt, T2VAspectRatio } from "./types";

function klingToken(): string {
  const sk = process.env.KLING_API_KEY;
  const ak = process.env.KLING_ASSESS_API_KEY;
  if (!sk || !ak) throw new Error("KLING_API_KEY or KLING_ASSESS_API_KEY is not set");
  return jwt.sign(
    { iss: ak, exp: Math.floor(Date.now() / 1000) + 1800, nbf: Math.floor(Date.now() / 1000) - 5 },
    sk,
    { header: { alg: "HS256", typ: "JWT" } },
  );
}

function aspectRatioToKling(ar: T2VAspectRatio): string {
  // Kling accepts: "16:9", "9:16", "1:1"
  if (ar === "4:5") return "9:16"; // closest Kling equivalent
  return ar;
}

async function submitOneCandidate(
  expanded: ExpandedPrompt,
  input: T2VInput,
  attempt: number,
): Promise<T2VCandidate> {
  const token = klingToken();

  const body = {
    model_name: "kling-v2-6",
    prompt: expanded.finalPrompt,
    negative_prompt: expanded.negativePrompt,
    duration: input.duration,
    mode: "standard",
    aspect_ratio: aspectRatioToKling(input.aspectRatio),
  };

  const res = await fetch("https://api-singapore.klingai.com/v1/videos/text2video", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kling T2V submit failed (${res.status}): ${text}`);
  }

  const result = await res.json() as { code: number; message?: string; data?: { task_id: string } };
  if (result.code !== 0 || !result.data?.task_id) {
    throw new Error(`Kling T2V rejected: ${result.message ?? "unknown error"}`);
  }

  return {
    id: `t2v-${attempt}-${Date.now()}`,
    externalId: result.data.task_id,
    attempt,
    promptUsed: expanded.finalPrompt,
    status: "pending",
  };
}

/**
 * Per spec: generate N candidates (default 4).
 * Submits all in parallel. Some may fail — partial success is OK.
 * Returns array of pending candidates with Kling task IDs.
 */
export async function submitT2VCandidates(
  expanded: ExpandedPrompt,
  input: T2VInput,
  n = 4,
): Promise<T2VCandidate[]> {
  const attempts = await Promise.allSettled(
    Array.from({ length: n }, (_, i) => submitOneCandidate(expanded, input, i + 1))
  );

  const successful = attempts
    .filter((r): r is PromiseFulfilledResult<T2VCandidate> => r.status === "fulfilled")
    .map(r => r.value);

  if (successful.length === 0) {
    const errors = attempts
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map(r => r.reason instanceof Error ? r.reason.message : String(r.reason));
    throw new Error(`All ${n} candidate submissions failed: ${errors.join("; ")}`);
  }

  return successful;
}

/**
 * Poll a single candidate's status from Kling.
 * Returns updated candidate with status and videoUrl if complete.
 */
export async function pollT2VCandidate(candidate: T2VCandidate): Promise<T2VCandidate> {
  const token = klingToken();

  const res = await fetch(
    `https://api-singapore.klingai.com/v1/videos/text2video/${candidate.externalId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    },
  );

  if (!res.ok) return { ...candidate, status: "processing" };

  const data = await res.json() as {
    data: {
      task_status: string;
      task_result?: { videos?: { url: string; duration?: number }[] };
    };
  };

  const t = data.data;
  if (t.task_status === "failed") return { ...candidate, status: "failed" };
  if (t.task_status !== "succeed") return { ...candidate, status: "processing" };

  const videoUrl = t.task_result?.videos?.[0]?.url;
  const duration = t.task_result?.videos?.[0]?.duration;

  return {
    ...candidate,
    status: "completed",
    videoUrl,
    durationSeconds: duration,
  };
}
