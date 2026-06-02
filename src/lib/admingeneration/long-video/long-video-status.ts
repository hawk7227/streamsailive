export type LongVideoShotStatus = {
  shotId: string;
  status: "planned" | "queued" | "running" | "complete" | "failed" | "unknown";
  outputUrl: string | null;
  outputAssetId: string | null;
  providerRunId: string | null;
};

export function buildLongVideoStatus(input: {
  shots?: any[];
  providerRuns?: any[];
}) {
  const shots = Array.isArray(input.shots) ? input.shots : [];
  const providerRuns = Array.isArray(input.providerRuns) ? input.providerRuns : [];

  const shotStatuses: LongVideoShotStatus[] = shots.map((shot, index) => {
    const shotId = String(shot.shotId || shot.id || `shot-${index + 1}`);
    const providerRun = providerRuns.find((run) => String(run.shotId || run.metadata?.shotId || "") === shotId);

    return {
      shotId,
      status: String(providerRun?.status || shot.status || "unknown") as LongVideoShotStatus["status"],
      outputUrl: providerRun?.outputUrl || providerRun?.output_url || shot.outputUrl || null,
      outputAssetId: providerRun?.outputAssetId || providerRun?.output_asset_id || shot.outputAssetId || null,
      providerRunId: providerRun?.id || null,
    };
  });

  return {
    ok: true,
    complete: shotStatuses.length > 0 && shotStatuses.every((shot) => shot.status === "complete" && (shot.outputUrl || shot.outputAssetId)),
    shotStatuses,
  };
}
