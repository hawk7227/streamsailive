import type { BulkJobPayload, BulkManifest, BulkOutput } from "./job-schema";

export function createManifest(prompt: string, sourceType: "prompt" | "document", total: number): BulkManifest {
  return {
    jobId: "",
    prompt,
    sourceType,
    total,
    completed: 0,
    failed: 0,
    outputs: [],
    errors: [],
    exportedAt: null,
    exportFileName: null,
  };
}

export function appendManifestOutput(payload: BulkJobPayload, output: BulkOutput): BulkManifest {
  const outputs = [...payload.manifest.outputs, output];
  return {
    ...payload.manifest,
    completed: outputs.length,
    outputs,
  };
}

export function appendManifestError(payload: BulkJobPayload, taskId: string, message: string): BulkManifest {
  return {
    ...payload.manifest,
    failed: payload.manifest.failed + 1,
    errors: [...payload.manifest.errors, { taskId, message }],
  };
}

export function finalizeManifest(manifest: BulkManifest, exportFileName?: string): BulkManifest {
  return {
    ...manifest,
    exportedAt: new Date().toISOString(),
    exportFileName: exportFileName ?? manifest.exportFileName ?? null,
  };
}
