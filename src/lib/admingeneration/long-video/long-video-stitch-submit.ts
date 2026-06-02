export function buildLongVideoStitchSubmitPayload(input: {
  shotStatuses?: any[];
  fps?: number;
  aspectRatio?: string;
}) {
  const shots = Array.isArray(input.shotStatuses) ? input.shotStatuses : [];
  const clips = shots
    .filter((shot) => shot.outputUrl || shot.outputAssetId)
    .map((shot) => ({
      shotId: shot.shotId,
      outputUrl: shot.outputUrl || null,
      outputAssetId: shot.outputAssetId || null,
    }));

  return {
    readyToStitch: clips.length > 0 && clips.length === shots.length,
    clips,
    fps: Number(input.fps || 24),
    aspectRatio: input.aspectRatio || "16:9",
    seamRepair: true,
    audioCrossfade: true,
    normalizeLoudness: true,
    exportFormat: "mp4",
  };
}
