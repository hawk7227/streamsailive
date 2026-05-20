import { createLocalAsset, formatBytes, makeId, saveLibraryItem, saveProject } from "./studioStore";

export function validateAsset(asset, acceptedKinds = []) {
  if (!asset) return { ok: false, reason: "Upload or create an asset first." };
  if (!acceptedKinds.length) return { ok: true, reason: "" };

  if (!acceptedKinds.includes(asset.kind)) {
    return {
      ok: false,
      reason: `This tool accepts ${acceptedKinds.join(", ")} files. Current file is ${asset.kind}.`,
    };
  }

  return { ok: true, reason: "" };
}

export async function shareAsset(asset) {
  if (!asset?.previewUrl) return { ok: false, reason: "No asset available to share." };

  const payload = {
    title: asset.name || "STREAMS asset",
    text: asset.name || "STREAMS asset",
    url: asset.previewUrl,
  };

  if (navigator.share && (!navigator.canShare || navigator.canShare(payload))) {
    await navigator.share(payload);
    return { ok: true, reason: "Shared." };
  }

  await navigator.clipboard?.writeText(asset.previewUrl);
  return { ok: true, reason: "Share is unavailable, copied link instead." };
}

export async function copyAsset(asset) {
  if (!asset?.previewUrl) return { ok: false, reason: "No asset available to copy." };
  await navigator.clipboard?.writeText(asset.previewUrl);
  return { ok: true, reason: "Copied link." };
}

export function downloadAsset(asset) {
  if (!asset?.downloadUrl && !asset?.previewUrl) {
    return { ok: false, reason: "No asset available to download." };
  }

  const a = document.createElement("a");
  a.href = asset.downloadUrl || asset.previewUrl;
  a.download = asset.name || "streams-asset";
  document.body.appendChild(a);
  a.click();
  a.remove();

  return { ok: true, reason: "Download started." };
}

export function saveAsset(asset) {
  if (!asset) return { ok: false, reason: "No asset available to save." };
  saveLibraryItem(asset);
  return { ok: true, reason: `Saved ${asset.name || "asset"} to Library.` };
}

export function handleFiles(files, toolId) {
  const file = Array.from(files || [])[0];
  if (!file) return null;
  return createLocalAsset(file, toolId);
}

export function createEditorProjectFromVideo(asset) {
  const validation = validateAsset(asset, ["video"]);
  if (!validation.ok) return { ok: false, reason: validation.reason, project: null };

  const project = saveProject({
    id: makeId("project"),
    title: asset.name?.replace(/\.[^.]+$/, "") || "Video Project",
    source: "studio",
    videoAssetId: asset.id,
    videoUrl: asset.previewUrl,
    duration: "00:00:05:00",
    resolution: "Uploaded source",
    fps: "24",
    format: asset.mimeType || "video",
    size: formatBytes(asset.sizeBytes),
    scenes: [
      { id: "scene_01", title: "Scene 01", range: "00:00 - 00:05", thumbnailUrl: asset.previewUrl },
    ],
    analysis: {
      faceDetection: "blocked",
      bodyTracking: "blocked",
      motionVectors: "blocked",
      depthMap: "blocked",
      sceneSegmentation: "blocked",
      audioQuality: "blocked",
      lipSync: "blocked",
      stability: "blocked",
    },
  });

  return { ok: true, reason: "Editor project created.", project };
}
