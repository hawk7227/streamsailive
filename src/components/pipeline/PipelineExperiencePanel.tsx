"use client";

import React from "react";

export interface PipelineExperienceEvent {
  id: string;
  stepName: string;
  type: string;
  message?: string;
  ts: number;
  detail?: string;
  tags?: string[];
  score?: number;
}

interface Props {
  open: boolean;
  mode: "story" | "technical" | "executive";
  onModeChange: (mode: "story" | "technical" | "executive") => void;
  events: PipelineExperienceEvent[];
  liveStepName?: string | null;
}

export default function PipelineExperiencePanel({ open, mode, onModeChange, events, liveStepName }: Props) {
  if (!open) return null;
  return (
    <div style={{ width: 380, borderLeft: "1px solid rgba(255,255,255,0.08)", background: "linear-gradient(180deg, rgba(18,24,58,0.96), rgba(6,10,28,0.96))", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: 14, borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#f8fafc" }}>Creative Engine Live</div>
          <div style={{ fontSize: 10, color: "#93c5fd" }}>{liveStepName ? `Running: ${liveStepName}` : "Watching pipeline"}</div>
        </div>
        <div style={{ flex: 1 }} />
        {(["story", "technical", "executive"] as const).map((option) => (
          <button key={option} onClick={() => onModeChange(option)} style={{ fontSize: 10, borderRadius: 999, padding: "4px 8px", border: `1px solid ${mode === option ? "rgba(250,204,21,0.28)" : "rgba(255,255,255,0.10)"}`, background: mode === option ? "rgba(250,204,21,0.12)" : "rgba(255,255,255,0.03)", color: mode === option ? "#fde68a" : "#cbd5e1", cursor: "pointer" }}>{option}</button>
        ))}
      </div>
      <div style={{ padding: 12, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {events.slice(-40).reverse().map((event) => (
          <div key={event.id} style={{ borderRadius: 14, padding: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", boxShadow: "0 0 0 1px rgba(99,102,241,0.03), 0 0 24px rgba(59,130,246,0.08) inset" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: colorForEvent(event.type), boxShadow: `0 0 14px ${colorForEvent(event.type)}` }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: "#e2e8f0" }}>{event.stepName}</span>
              {typeof event.score === "number" && <span style={{ fontSize: 10, color: "#93c5fd" }}>{event.score}/100</span>}
              <span style={{ marginLeft: "auto", fontSize: 10, color: "#64748b" }}>{new Date(event.ts).toLocaleTimeString()}</span>
            </div>
            <div style={{ fontSize: mode === "executive" ? 11 : 12, color: mode === "technical" ? "#cbd5e1" : "#f8fafc", lineHeight: 1.55 }}>
              {event.message ?? event.type}
            </div>
            {mode !== "executive" && event.detail && (
              <div style={{ marginTop: 8, fontSize: 10, color: "#93c5fd", lineHeight: 1.5 }}>{event.detail}</div>
            )}
            {mode !== "executive" && (
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[event.type, liveChip(event.type), ...(event.tags ?? [])].filter(Boolean).map((chip) => (
                  <span key={chip} style={{ fontSize: 9, borderRadius: 999, padding: "2px 8px", background: "rgba(255,255,255,0.06)", color: "#93c5fd", border: "1px solid rgba(147,197,253,0.16)" }}>{chip}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function colorForEvent(type: string) {
  if (type.includes("fail") || type.includes("error") || type.includes("reject")) return "#fb7185";
  if (type.includes("pass") || type.includes("complete")) return "#4ade80";
  if (type.includes("warn")) return "#f59e0b";
  return "#38bdf8";
}

function liveChip(type: string) {
  if (type.includes("score")) return "Scoring";
  if (type.includes("decision")) return "Decision";
  if (type.includes("regen")) return "Repair Loop";
  if (type.includes("summary")) return "Summary";
  return "Live";
}
