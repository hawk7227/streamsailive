"use client";

import React, { useState } from "react";
import { buildSongDirectorPlan, type SongDirectorInput, type SongDirectorPlan } from "@/lib/pipeline-test/songDirector";

export default function SongDirectorPanel({
  onPlanReady,
}: {
  onPlanReady: (plan: SongDirectorPlan) => void;
}) {
  const [form, setForm] = useState<SongDirectorInput>({
    theme: "",
    emotion: "emotional",
    genre: "cinematic",
    voiceType: "user voice",
    length: "30 sec",
    lyricsMode: "generate",
    energy: "medium",
  });
  const [plan, setPlan] = useState<SongDirectorPlan | null>(null);

  function setField<K extends keyof SongDirectorInput>(key: K, value: SongDirectorInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleBuild() {
    const next = buildSongDirectorPlan(form);
    setPlan(next);
    onPlanReady(next);
  }

  return (
    <div style={{ border: "1px solid rgba(148,163,184,.25)", borderRadius: 16, padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>Song Director</h3>
      <div style={{ display: "grid", gap: 10 }}>
        <input value={form.theme} onChange={(e) => setField("theme", e.target.value)} placeholder="Theme" />
        <input value={form.emotion} onChange={(e) => setField("emotion", e.target.value)} placeholder="Emotion" />
        <input value={form.genre} onChange={(e) => setField("genre", e.target.value)} placeholder="Genre" />
        <input value={form.voiceType} onChange={(e) => setField("voiceType", e.target.value)} placeholder="Voice type" />
        <input value={form.length} onChange={(e) => setField("length", e.target.value)} placeholder="Song length" />
        <input value={form.lyricsMode} onChange={(e) => setField("lyricsMode", e.target.value)} placeholder="Lyrics mode" />
        <input value={form.energy} onChange={(e) => setField("energy", e.target.value)} placeholder="Energy" />
        <button onClick={handleBuild}>Build Song Plan</button>
      </div>
      {plan && (
        <div style={{ marginTop: 12 }}>
          <strong>{plan.title}</strong>
          <div style={{ marginTop: 6 }}>{plan.summary}</div>
          <ul>
            {plan.sections.map((section) => (
              <li key={section.id}><strong>{section.label}:</strong> {section.direction}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
