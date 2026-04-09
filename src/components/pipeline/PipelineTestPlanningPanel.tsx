"use client";

import { GenerationPlan, ToolMode } from "@/lib/pipeline-test/types";
import { useState } from "react";

export default function PipelineTestPlanningPanel({
  onPlanReady,
}: {
  onPlanReady: (plan: GenerationPlan) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<ToolMode>("auto");
  const [plan, setPlan] = useState<GenerationPlan | null>(null);

  async function handleAnalyze() {
    const res = await fetch("/api/pipeline-test/tool-brain/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, mode }),
    });

    const data = await res.json();
    setPlan(data);
    onPlanReady(data);
  }

  return (
    <div style={{ padding: 16, border: "1px solid #ccc", borderRadius: 12 }}>
      <h3>Tool Brain Planning</h3>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter prompt"
        style={{ width: "100%", height: 80 }}
      />

      <div style={{ marginTop: 12 }}>
        <select value={mode} onChange={(e) => setMode(e.target.value as ToolMode)}>
          <option value="auto">Auto</option>
          <option value="cheapest">Cheapest</option>
          <option value="quality">Highest Quality</option>
        </select>
      </div>

      <button style={{ marginTop: 12 }} onClick={handleAnalyze}>
        Analyze + Plan
      </button>

      {plan && (
        <div style={{ marginTop: 16 }}>
          <h4>Plan Preview</h4>
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(plan, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
