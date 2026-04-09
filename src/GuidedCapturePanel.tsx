"use client";

import React, { useState } from "react";
import { buildStoryDirectorPlan, type StoryDirectorInput, type StoryDirectorPlan } from "@/lib/pipeline-test/storyDirector";

export default function StoryDirectorPanel({
  onPlanReady,
}: {
  onPlanReady: (plan: StoryDirectorPlan) => void;
}) {
  const [form, setForm] = useState<StoryDirectorInput>({
    idea: "",
    subject: "",
    tone: "dramatic",
    structure: "hook-story-lesson",
    length: "30 sec",
    voiceStyle: "calm male",
    visualStrategy: "image_to_video",
  });
  const [plan, setPlan] = useState<StoryDirectorPlan | null>(null);

  function setField<K extends keyof StoryDirectorInput>(key: K, value: StoryDirectorInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleBuild() {
    const next = buildStoryDirectorPlan(form);
    setPlan(next);
    onPlanReady(next);
  }

  return (
    <div style={{ border: "1px solid rgba(148,163,184,.25)", borderRadius: 16, padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>Story Director</h3>
      <div style={{ display: "grid", gap: 10 }}>
        <input value={form.idea} onChange={(e) => setField("idea", e.target.value)} placeholder="Core idea" />
        <input value={form.subject} onChange={(e) => setField("subject", e.target.value)} placeholder="Main subject" />
        <input value={form.tone} onChange={(e) => setField("tone", e.target.value)} placeholder="Tone / emotion" />
        <input value={form.structure} onChange={(e) => setField("structure", e.target.value)} placeholder="Structure type" />
        <input value={form.length} onChange={(e) => setField("length", e.target.value)} placeholder="Length" />
        <input value={form.voiceStyle} onChange={(e) => setField("voiceStyle", e.target.value)} placeholder="Voice style" />
        <input value={form.visualStrategy} onChange={(e) => setField("visualStrategy", e.target.value)} placeholder="Visual strategy" />
        <button onClick={handleBuild}>Build Story Plan</button>
      </div>
      {plan && (
        <div style={{ marginTop: 12 }}>
          <strong>{plan.title}</strong>
          <div style={{ marginTop: 6 }}>{plan.summary}</div>
          <ul>
            {plan.scenes.map((scene) => (
              <li key={scene.id}><strong>{scene.title}:</strong> {scene.beat}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
