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

export function isImageIntent(message = "") {
  const text = String(message || "").trim().toLowerCase();

  if (!text) return false;

  return (
    /\b(generate|create|make|draw|render|produce|design)\b[\s\S]{0,120}\b(image|photo|picture|visual|graphic|art|logo|thumbnail|banner)\b/.test(text) ||
    /\b(image|photo|picture|visual|graphic|art|logo|thumbnail|banner)\b[\s\S]{0,120}\b(generate|create|make|draw|render|produce|design)\b/.test(text) ||
    text.startsWith("image of ") ||
    text.startsWith("photo of ") ||
    text.startsWith("picture of ") ||
    text.includes(" ai image") ||
    text.includes(" generated image")
  );
}

export async function generateStreamsImage({
  prompt,
  userId = TEST_USER_ID,
  workspaceId = TEST_WORKSPACE_ID,
  sessionId = null,
  model = "kontext",
  aspectRatio = "1:1",
  numImages = 1,
  signal,
  onStatus,
}) {
  const cleanPrompt = String(prompt || "").trim();

  if (!cleanPrompt) {
    throw new Error("Image prompt is required.");
  }

  onStatus?.("Submitting image generation…");

  const generationRes = await fetch(apiUrl("/api/streams/image/generate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: cleanPrompt,
      model,
      aspectRatio,
      numImages,
      userId,
      workspaceId,
      sessionId,
    }),
    signal,
  });

  if (!generationRes.ok) {
    const errorText = await generationRes.text().catch(() => "");
    throw new Error(errorText || "Image generation request failed.");
  }

  const generationData = await generationRes.json();

  if (!generationData?.generationId || !generationData?.responseUrl) {
    throw new Error(generationData?.error || "Image generation did not return a valid job.");
  }

  onStatus?.("Generating image…");

  const maxPolls = 90;

  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    if (signal?.aborted) {
      throw new DOMException("Image generation aborted.", "AbortError");
    }

    await sleep(2000);

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
      throw new Error(errorText || "Image status check failed.");
    }

    const statusData = await statusRes.json();

    if (statusData?.status === "completed" && statusData?.artifactUrl) {
      return {
        generationId: generationData.generationId,
        artifactUrl: statusData.artifactUrl,
        mimeType: statusData.mimeType || "image/png",
        artifact: statusData.artifact || null,
        raw: statusData,
      };
    }

    if (statusData?.status === "failed") {
      throw new Error(statusData?.error || "Image generation failed.");
    }

    onStatus?.(`Generating image… (${attempt + 1})`);
  }

  throw new Error("Image generation timed out.");
}
