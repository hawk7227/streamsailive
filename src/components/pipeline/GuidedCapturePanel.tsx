"use client";

import React, { useMemo, useState } from "react";

type CaptureMode = "voice" | "video";

export default function GuidedCapturePanel() {
  const [mode, setMode] = useState<CaptureMode>("voice");
  const steps = useMemo(() => {
    if (mode === "voice") {
      return [
        "Record in a quiet room",
        "Keep your mouth close to the mic",
        "Read the prompt slowly and clearly",
        "Retry if clipping or noise is detected",
      ];
    }
    return [
      "Center your face in frame",
      "Keep lighting even on both sides",
      "Turn slowly when prompted",
      "Hold still for 2 seconds between movements",
    ];
  }, [mode]);

  return (
    <div style={{ border: "1px solid rgba(148,163,184,.25)", borderRadius: 16, padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>Guided Capture</h3>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setMode("voice")}>Voice</button>
        <button onClick={() => setMode("video")}>Video</button>
      </div>
      <ol style={{ margin: 0, paddingLeft: 18 }}>
        {steps.map((step) => (
          <li key={step} style={{ marginBottom: 8 }}>{step}</li>
        ))}
      </ol>
      <div style={{ marginTop: 12 }}>
        <button>Start Guided {mode === "voice" ? "Voice" : "Video"} Capture</button>
      </div>
    </div>
  );
}
