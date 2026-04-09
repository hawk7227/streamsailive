"use client";

import React, { useMemo, useState } from "react";
import type { BulkAsset, BulkJobInput } from "@/lib/pipeline-test/bulkTypes";

type Props = {
  onRunJob: (job: BulkJobInput) => Promise<void> | void;
  assets: BulkAsset[];
  onPreviewAsset: (asset: BulkAsset) => void;
  onSendToShelf: (asset: BulkAsset) => void;
  onSendToEditor: (asset: BulkAsset) => void;
};

export default function BulkCreativeWorkspace({
  onRunJob,
  assets,
  onPreviewAsset,
  onSendToShelf,
  onSendToEditor,
}: Props) {
  const [label, setLabel] = useState("Concept Batch");
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(6);
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(512);

  const grouped = useMemo(() => {
    return assets.reduce<Record<string, BulkAsset[]>>((acc, asset) => {
      acc[asset.jobId] = acc[asset.jobId] ?? [];
      acc[asset.jobId].push(asset);
      return acc;
    }, {});
  }, [assets]);

  async function handleRun() {
    const job: BulkJobInput = {
      id: `job-${Date.now()}`,
      label,
      prompt,
      count,
      width,
      height,
    };
    await onRunJob(job);
  }

  return (
    <div style={{ border: "1px solid rgba(148,163,184,.25)", borderRadius: 16, padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>Bulk Creative Workspace</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Batch label" />
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Bulk prompt" rows={6} />
          <input type="number" min={1} max={24} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} placeholder="Count" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value) || 512)} placeholder="Width" />
            <input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value) || 512)} placeholder="Height" />
          </div>
          <button onClick={handleRun}>Run Bulk Job</button>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          {Object.keys(grouped).length === 0 ? (
            <div style={{ padding: 16, border: "1px dashed rgba(148,163,184,.35)", borderRadius: 12 }}>
              No bulk results yet.
            </div>
          ) : (
            Object.entries(grouped).map(([jobId, jobAssets]) => (
              <section key={jobId} style={{ display: "grid", gap: 10 }}>
                <strong>{jobId}</strong>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
                  {jobAssets.map((asset) => (
                    <div key={asset.id} style={{ border: "1px solid rgba(148,163,184,.2)", borderRadius: 12, overflow: "hidden" }}>
                      <img src={asset.url} alt={asset.title} style={{ width: "100%", display: "block" }} />
                      <div style={{ padding: 10, display: "grid", gap: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{asset.title}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                          <button onClick={() => onPreviewAsset(asset)}>Preview</button>
                          <button onClick={() => onSendToEditor(asset)}>Editor</button>
                          <button onClick={() => onSendToShelf(asset)}>Shelf</button>
                          <a href={asset.url} download target="_blank" rel="noreferrer">
                            <button style={{ width: "100%" }}>Download</button>
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
