export type ExportProofResult = {
  exportReady: boolean;
  status: "ready" | "missing_output" | "blocked" | "unknown";
  outputUrl: string | null;
  outputAssetId: string | null;
  reason: string | null;
};

export function evaluateExportProof(input: any): ExportProofResult {
  const exportData = input?.export || input?.result || input || {};
  const outputUrl = exportData.outputUrl || exportData.output_url || exportData.url || null;
  const outputAssetId = exportData.outputAssetId || exportData.output_asset_id || exportData.assetId || null;
  const status = String(exportData.status || "").toLowerCase();

  if (outputUrl || outputAssetId) {
    return {
      exportReady: true,
      status: "ready",
      outputUrl,
      outputAssetId,
      reason: null,
    };
  }

  if (status.includes("blocked") || exportData.error) {
    return {
      exportReady: false,
      status: "blocked",
      outputUrl: null,
      outputAssetId: null,
      reason: exportData.error || "Export worker/render output is blocked.",
    };
  }

  return {
    exportReady: false,
    status: "missing_output",
    outputUrl: null,
    outputAssetId: null,
    reason: "No real export output URL or output asset ID was returned.",
  };
}
