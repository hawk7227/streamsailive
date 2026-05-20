import { generateStreamsImage } from "./streamsImageClient";
import { isVideoIntent } from "./streamsVideoClient";

export const STUDIO_TOOLS = [
  {
    id: "studio.image",
    title: "Image Generation",
    capability: "image_generation",
    status: "wired",
    description: "Generate images through the existing STREAMS image provider path.",
  },
  {
    id: "studio.text_to_video",
    title: "Text to Video",
    capability: "text_to_video",
    status: "wired",
    description: "Generate video from a text prompt through the durable Studio job path.",
  },
  {
    id: "studio.image_to_video",
    title: "Image to Video",
    capability: "image_to_video",
    status: "wired",
    description: "Generate video from a selected Studio image asset through the durable Studio job path.",
  },
  {
    id: "studio.snap_pic_click",
    title: "Snap Pic Click",
    capability: "snap_pic_click",
    status: "blocked",
    description: "Needs action templates, source image validation, and provider routing before execution.",
  },
  {
    id: "studio.voice_audio",
    title: "Voice / Audio",
    capability: "voice_audio",
    status: "blocked",
    description: "Needs ElevenLabs/fal audio provider wiring before execution.",
  },
  {
    id: "studio.idea_to_screen",
    title: "Idea to Screen",
    capability: "idea_to_screen",
    status: "blocked",
    description: "Needs parent pipeline orchestration across image, video, and audio tools.",
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function listStudioTools() {
  return STUDIO_TOOLS;
}

export function getStudioTool(toolId) {
  return STUDIO_TOOLS.find((tool) => tool.id === toolId) || null;
}

export function detectStudioTool(message = "") {
  const text = String(message || "").trim().toLowerCase();

  if (!text) return null;

  if (
    text.includes("studio image") ||
    text.startsWith("generate an image") ||
    text.startsWith("create an image") ||
    text.startsWith("make an image") ||
    text.includes("generate an image of") ||
    text.includes("create an image of")
  ) {
    return getStudioTool("studio.image");
  }

  if (
    text.includes("image to video") ||
    text.includes("animate this image") ||
    text.includes("turn this image into a video")
  ) {
    return getStudioTool("studio.image_to_video");
  }

  if (text.includes("studio video") || isVideoIntent(text)) {
    return getStudioTool("studio.text_to_video");
  }

  if (text.includes("snap pic click")) return getStudioTool("studio.snap_pic_click");
  if (text.includes("voice") || text.includes("audio")) return getStudioTool("studio.voice_audio");
  if (text.includes("idea to screen")) return getStudioTool("studio.idea_to_screen");

  return null;
}

export async function listStudioAssets({ assetType, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (assetType) params.set("assetType", assetType);
  params.set("limit", String(limit));

  const response = await fetch(`/api/studio/assets?${params.toString()}`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `Studio asset list failed: ${response.status}`);
  }

  return data.assets || [];
}

export async function uploadStudioAsset(file, { userId, workspaceId } = {}) {
  if (!file) throw new Error("Studio upload requires a file.");
  const form = new FormData();
  form.append("file", file);
  if (userId) form.append("userId", userId);
  if (workspaceId) form.append("workspaceId", workspaceId);

  const response = await fetch("/api/studio/assets", {
    method: "POST",
    body: form,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `Studio asset upload failed: ${response.status}`);
  }

  return data.asset;
}

export async function analyzeStudioImageAsset({ assetId, imageUrl, analysisProfile = "card_standard" }) {
  if (!assetId && !imageUrl) throw new Error("Studio image analysis requires assetId or imageUrl.");

  const response = await fetch("/api/studio/assets/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetId, imageUrl, analysisProfile }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `Studio image analysis failed: ${response.status}`);
  }

  return data;
}

async function pollStudioJob({ jobId, label, signal, onStatus }) {
  const maxPolls = 100;
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= maxPolls; attempt += 1) {
    if (signal?.aborted) {
      throw new DOMException(`${label} aborted.`, "AbortError");
    }

    await sleep(3000);

    const statusRes = await fetch(`/api/studio/jobs/${jobId}/status`, {
      cache: "no-store",
      signal,
    });
    const statusData = await statusRes.json().catch(() => ({}));

    if (!statusRes.ok || statusData?.ok === false) {
      throw new Error(statusData?.error || `Studio job status failed: ${statusRes.status}`);
    }

    const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
    onStatus?.(`${label} → ${statusData.status || "running"} · ${elapsedSeconds}s · poll ${attempt}/${maxPolls}`);

    if (statusData.status === "completed" && (statusData.artifactUrl || statusData.asset?.public_url)) {
      return {
        jobId,
        generationId: statusData.providerRun?.provider_request_id,
        artifactUrl: statusData.artifactUrl || statusData.asset.public_url,
        mimeType: statusData.asset?.mime_type || "video/mp4",
        asset: statusData.asset || null,
        raw: statusData,
      };
    }

    if (statusData.status === "failed" || statusData.status === "blocked") {
      throw new Error(statusData.job?.error_message || statusData.error || `${label} job failed.`);
    }
  }

  throw new Error(`${label} timed out while waiting for durable job completion.`);
}

async function runStudioTextToVideoJob({ prompt, signal, onStatus }) {
  const label = "Studio Text to Video";
  onStatus?.(`${label} → creating durable job…`);

  const createRes = await fetch("/api/studio/modules/text-to-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
    signal,
  });

  const createData = await createRes.json().catch(() => ({}));

  if (!createRes.ok || createData?.ok === false) {
    throw new Error(createData?.error || `Studio job create failed: ${createRes.status}`);
  }

  const jobId = createData.jobId;
  if (!jobId) throw new Error("Studio text-to-video did not return a jobId.");
  onStatus?.(`${label} → job ${jobId} submitted`);
  return pollStudioJob({ jobId, label, signal, onStatus });
}

async function runStudioImageToVideoJob({
  prompt,
  sourceAssetId,
  imageUrl,
  durationSeconds,
  aspectRatio,
  quality,
  signal,
  onStatus,
}) {
  const label = "Studio Image to Video";
  onStatus?.(`${label} → creating durable job…`);

  const createRes = await fetch("/api/studio/modules/image-to-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, sourceAssetId, imageUrl, durationSeconds, aspectRatio, quality }),
    signal,
  });

  const createData = await createRes.json().catch(() => ({}));

  if (!createRes.ok || createData?.ok === false) {
    throw new Error(createData?.error || `Studio image-to-video create failed: ${createRes.status}`);
  }

  const jobId = createData.jobId;
  if (!jobId) throw new Error("Studio image-to-video did not return a jobId.");
  if (createData.plan?.estimatedCredits) {
    onStatus?.(`${label} → ${createData.plan.durationSeconds}s · ${createData.plan.method} · ${createData.plan.estimatedCredits} credits`);
  }
  onStatus?.(`${label} → job ${jobId} submitted`);
  return pollStudioJob({ jobId, label, signal, onStatus });
}

export async function invokeStudioTool({
  toolId,
  prompt,
  imageUrl,
  sourceAssetId,
  durationSeconds,
  aspectRatio,
  quality,
  signal,
  onStatus,
}) {
  const tool = getStudioTool(toolId);

  if (!tool) {
    throw new Error(`Unknown Studio tool: ${toolId}`);
  }

  if (tool.status === "blocked") {
    throw new Error(`${tool.title} is visible in Studio but not yet wired to a real provider path. ${tool.description}`);
  }

  if (tool.id === "studio.image") {
    onStatus?.("Studio Image Generation → submitting provider request…");
    return generateStreamsImage({
      prompt,
      signal,
      onStatus: (statusText) => onStatus?.(`Studio Image Generation → ${statusText || "Generating image…"}`),
    });
  }

  if (tool.id === "studio.text_to_video") {
    return runStudioTextToVideoJob({ prompt, signal, onStatus });
  }

  if (tool.id === "studio.image_to_video") {
    if (!sourceAssetId && !imageUrl) {
      throw new Error("Studio Image to Video requires a selected image asset or image URL.");
    }
    return runStudioImageToVideoJob({
      prompt,
      sourceAssetId,
      imageUrl,
      durationSeconds,
      aspectRatio,
      quality,
      signal,
      onStatus,
    });
  }

  throw new Error(`${tool.title} is not executable yet.`);
}
