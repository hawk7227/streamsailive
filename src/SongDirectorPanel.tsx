"use client";

import React from "react";
import type { BulkAsset } from "@/lib/pipeline-test/bulkTypes";

type Props = {
  assets: BulkAsset[];
  onPreviewAsset: (asset: BulkAsset) => void;
};

export default function AssetShelfPanel({ assets, onPreviewAsset }: Props) {
  return (
    <div style={{ border: "1px solid rgba(148,163,184,.25)", borderRadius: 16, padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>Asset Shelf</h3>
      {assets.length === 0 ? (
        <div style={{ padding: 16, border: "1px dashed rgba(148,163,184,.35)", borderRadius: 12 }}>Shelf is empty.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 10 }}>
          {assets.map((asset) => (
            <button
              key={asset.id}
              onClick={() => onPreviewAsset(asset)}
              style={{ border: "1px solid rgba(148,163,184,.2)", borderRadius: 12, overflow: "hidden", padding: 0, background: "transparent" }}
            >
              <img src={asset.url} alt={asset.title} style={{ width: "100%", display: "block" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
