"use client";

import { useMemo, useState } from "react";
import PipelineTestPlanningPanel from "@/components/pipeline/PipelineTestPlanningPanel";
import { runExecution } from "@/lib/pipeline-test/executionEngine";
import ExecutionPreview from "@/components/pipeline/ExecutionPreview";
import { validatePlan } from "@/lib/pipeline-test/toolBrain";
import type { GenerationPlan } from "@/lib/pipeline-test/types";
import BulkCreativeWorkspace from "@/components/pipeline/BulkCreativeWorkspace";
import AssetShelfPanel from "@/components/pipeline/AssetShelfPanel";
import type { BulkAsset, BulkJobInput } from "@/lib/pipeline-test/bulkTypes";
import { runBulkWorkspace } from "@/lib/pipeline-test/bulkWorkspace";
import StoryDirectorPanel from "@/components/pipeline/StoryDirectorPanel";
import SongDirectorPanel from "@/components/pipeline/SongDirectorPanel";
import GuidedCapturePanel from "@/components/pipeline/GuidedCapturePanel";

export default function Page() {
  const [plan, setPlan] = useState<GenerationPlan | null>(null);
  const [result, setResult] = useState<any>(null);
  const [executionState, setExecutionState] = useState<"idle" | "running" | "failed" | "complete">("idle");
  const [isRunning, setIsRunning] = useState(false);
  const [lastPlanHash, setLastPlanHash] = useState<string | null>(null);
  const [bulkAssets, setBulkAssets] = useState<BulkAsset[]>([]);
  const [shelfAssets, setShelfAssets] = useState<BulkAsset[]>([]);
  const [previewAsset, setPreviewAsset] = useState<BulkAsset | null>(null);
  const [storyPlan, setStoryPlan] = useState<any>(null);
  const [songPlan, setSongPlan] = useState<any>(null);

  async function run() {
    if (!plan || !validatePlan(plan)) return;
    const hash = JSON.stringify(plan);
    if (isRunning || hash === lastPlanHash) return;

    setIsRunning(true);
    setExecutionState("running");
    setLastPlanHash(hash);

    try {
      const r = await runExecution(plan);
      setResult(r);
      setExecutionState("complete");
    } catch (error) {
      console.error(error);
      setExecutionState("failed");
    } finally {
      setIsRunning(false);
    }
  }

  async function handleRunBulk(job: BulkJobInput) {
    const assets = await runBulkWorkspace(job);
    setBulkAssets((prev) => [...assets, ...prev]);
  }

  function handleSendToShelf(asset: BulkAsset) {
    setShelfAssets((prev) => (prev.find((x) => x.id === asset.id) ? prev : [asset, ...prev]));
  }

  function handleSendToEditor(asset: BulkAsset) {
    setPreviewAsset(asset);
  }

  const mergedPreview = useMemo(() => {
    if (previewAsset) {
      return {
        images: previewAsset.type === "image" ? [{ url: previewAsset.url }] : [],
        video: previewAsset.type === "video" ? { url: previewAsset.url } : null,
      };
    }
    return result;
  }, [previewAsset, result]);

  return (
    <div>
      {/* ROW 1 untouched */}
      <PipelineTestPlanningPanel onPlanReady={setPlan} />
      <button onClick={run} disabled={!plan || isRunning}>
        {isRunning ? "Running..." : "Generate"}
      </button>
      <div>Execution State: {executionState}</div>
      <ExecutionPreview result={mergedPreview} />

      <div style={{ marginTop: 24, display: "grid", gap: 24 }}>
        <StoryDirectorPanel onPlanReady={setStoryPlan} />
        <SongDirectorPanel onPlanReady={setSongPlan} />
        <GuidedCapturePanel />
        <BulkCreativeWorkspace
          onRunJob={handleRunBulk}
          assets={bulkAssets}
          onPreviewAsset={setPreviewAsset}
          onSendToShelf={handleSendToShelf}
          onSendToEditor={handleSendToEditor}
        />
        <AssetShelfPanel assets={shelfAssets} onPreviewAsset={setPreviewAsset} />
      </div>

      {storyPlan && (
        <div style={{ marginTop: 24, border: "1px solid rgba(148,163,184,.25)", borderRadius: 16, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Story Plan Output</h3>
          <pre>{JSON.stringify(storyPlan, null, 2)}</pre>
        </div>
      )}

      {songPlan && (
        <div style={{ marginTop: 24, border: "1px solid rgba(148,163,184,.25)", borderRadius: 16, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Song Plan Output</h3>
          <pre>{JSON.stringify(songPlan, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
