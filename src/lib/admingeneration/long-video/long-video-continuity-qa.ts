export type LongVideoContinuityQaResult = {
  ok: boolean;
  status: "pass" | "needs_outputs" | "needs_check";
  checks: Array<{
    id: string;
    label: string;
    status: "pass" | "needs_output" | "needs_check";
  }>;
};

export function evaluateLongVideoContinuityQa(input: {
  shotStatuses?: any[];
}) : LongVideoContinuityQaResult {
  const shots = Array.isArray(input.shotStatuses) ? input.shotStatuses : [];
  const allOutputs = shots.length > 0 && shots.every((shot) => shot.outputUrl || shot.outputAssetId);

  const checks = [
    { id: "identity", label: "Character identity continuity", status: allOutputs ? "needs_check" : "needs_output" },
    { id: "style", label: "Style / lighting continuity", status: allOutputs ? "needs_check" : "needs_output" },
    { id: "motion", label: "Motion continuity", status: allOutputs ? "needs_check" : "needs_output" },
    { id: "audio", label: "Audio continuity", status: allOutputs ? "needs_check" : "needs_output" },
    { id: "seams", label: "Seam visibility", status: allOutputs ? "needs_check" : "needs_output" },
  ] as LongVideoContinuityQaResult["checks"];

  return {
    ok: allOutputs,
    status: allOutputs ? "needs_check" : "needs_outputs",
    checks,
  };
}
