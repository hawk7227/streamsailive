const DEFAULT_BASE =
  process.env.NEXT_PUBLIC_STREAMS_API_BASE_URL || "";

const TEST_USER_ID = "streams-test-user";
const TEST_WORKSPACE_ID = "streams-public-test";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function apiUrl(path) {
  return `${DEFAULT_BASE}${path}`;
}

function normalizeVideoIntentText(message = "") {
  return String(message || "")
    .trim()
    .toLowerCase()
    .replace(/\bv[ei]d[ei]o\b/g, "video")
    .replace(/\bvi[dt]eo\b/g, "video")
    .replace(/\bvidoe\b/g, "video")
    .replace(/\bviedo\b/g, "video")
    .replace(/\bvdo\b/g, "video")
    .replace(/\bvid\b/g, "video")
    .replace(/\banimation\b/g, "video")
    .replace(/\banimated\b/g, "video")
    .replace(/\bmovie\b/g, "video")
    .replace(/\bclip\b/g, "video");
}

function providerStatusLabel(statusData) {
  const rawStatus = statusData?.raw?.status || statusData?.status || "processing";
  const normalized = String(rawStatus || "processing").replace(/_/g, " ").toUpperCase();
  return normalized || "PROCESSING";
}

export function isVideoIntent(message = "") {
  const text = normalizeVideoIntentText(message);

  if (!text) return false;

  return (
    /\b(generate|create|make|render|produce|turn|animate)\b[\s\S]{0,100}\b(video|motion)\b/.test(text) ||
    /\b(video|motion)\b[\s\S]{0,100}\b(generate|create|make|render|produce|turn|animate)\b/.test(text) ||
    /\b(generate|create|make|render|produce)\b[\s\S]{0,100}\b(dancing|walking|running|moving|motion|cinematic|film)\b/.test(text)
  );
}

export async function generateStreamsVideo({
  prompt,
  userId = TEST_USER_ID,
  workspaceId = TEST_WORKSPACE_ID,
  sessionId = null,
  model = "kling",
  mode = "t2v",
  aspectRatio = "16:9",
  duration = 5,
  imageUrl,
  signal,
  onStatus,
}) {
  const cleanPrompt = String(prompt || "").trim();

  if (!cleanPrompt) {
    throw new Error("Video prompt is required.");
  }

  onStatus?.("Submitting video generation…");

  const body = {
    prompt: cleanPrompt,
    model,
    mode,
    aspectRatio,
    duration,
    userId,
    workspaceId,
    sessionId,
  };

  if (imageUrl) {
    body.imageUrl = imageUrl;
  }

  const generationRes = await fetch(apiUrl("/api/streams-ai/tools"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!generationRes.ok) {
    const errorText = await generationRes.text().catch(() => "");
    throw new Error(errorText || "Video generation request failed.");
  }

  const generationData = await generationRes.json();

  if (!generationData?.generationId || !generationData?.responseUrl) {
    throw new Error(generationData?.error || "Video generation did not return a valid job.");
  }

  onStatus?.(`Waiting on FAL provider… job ${generationData.generationId}`);

  const maxPolls = 80;
  const startedAt = Date.now();

  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    if (signal?.aborted) {
      throw new DOMException("Video generation aborted.", "AbortError");
    }

    await sleep(3000);

    const statusRes = await fetch(apiUrl("/api/streams/video/status"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationId: generationData.generationId,
        responseUrl: generationData.responseUrl,
        userId,
        workspaceId,
        sessionId,
      }),
      signal,
    });

    if (!statusRes.ok) {
      const errorText = await statusRes.text().catch(() => "");
      throw new Error(errorText || "Video status check failed.");
    }

    const statusData = await statusRes.json();

    if (statusData?.status === "completed" && statusData?.artifactUrl) {
      return {
        generationId: generationData.generationId,
        artifactUrl: statusData.artifactUrl,
        mimeType: statusData.mimeType || "video/mp4",
        artifact: statusData.artifact || null,
        raw: statusData,
      };
    }

    if (statusData?.status === "failed") {
      throw new Error(statusData?.error || "Video generation failed.");
    }

    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
    onStatus?.(`Waiting on FAL provider… ${providerStatusLabel(statusData)} · ${elapsedSeconds}s · poll ${attempt + 1}/${maxPolls}`);
  }

  throw new Error(`Video generation timed out after ${Math.round((Date.now() - startedAt) / 1000)}s waiting on FAL provider.`);
}
