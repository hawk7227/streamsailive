import {
  createStreamsMediaAsset,
  getStreamsAssetDownloadUrl,
  listStreamsMediaAssets,
  normalizeStreamsMediaAsset,
} from "./streamsMediaClient";

export async function listStreamsArtifacts(options = {}) {
  return listStreamsMediaAssets(options);
}

export async function createStreamsArtifact(input = {}) {
  return createStreamsMediaAsset({
    ...input,
    kind: input.kind || input.artifactType || "file",
    metadata: {
      ...(input.metadata || {}),
      artifactType: input.artifactType || input.kind || "file",
    },
  });
}

export async function getStreamsArtifactDownloadUrl(artifactId, options = {}) {
  return getStreamsAssetDownloadUrl(artifactId, options);
}

export function normalizeStreamsArtifact(artifact = {}) {
  return normalizeStreamsMediaAsset(artifact);
}
