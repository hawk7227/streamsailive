/**
 * VideoAnalysisUpload.tsx
 * 
 * Upload videos for duplication analysis + platform detection
 * Supports: URL, file upload, screen recording, YouTube embeds
 * 
 * Phase 2: Video Analysis Feature
 */

"use client";

import { useState, useRef } from "react";
import { C, R } from "./tokens";

interface VideoAnalysisUploadProps {
  onAnalysisComplete?: (analysis: VideoAnalysis) => void;
}

export interface VideoAnalysis {
  uploadedUrl: string;
  detectedPlatform: string;
  canEmbed: boolean;
  frames: string[];
  duplicationScore: number;
  confidence: number;
  analysis: string;
  suggestedPrompt: string;
}

export default function VideoAnalysisUpload({ onAnalysisComplete }: VideoAnalysisUploadProps) {
  const [mode, setMode] = useState<"url" | "upload" | "record" | "youtube">("url");
  const [input, setInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // Analyze video via API
  async function analyzeVideo() {
    if (!input.trim()) return;
    
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/streams/check-video-accessibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          input,
        }),
      });

      if (!res.ok) throw new Error("Analysis failed");

      const data = await res.json();
      setAnalysis(data);
      onAnalysisComplete?.(data);
    } catch (error) {
      console.error("Video analysis error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  }

  // Handle file upload
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setInput(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  // Start screen recording
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      } as DisplayMediaStreamOptions);

      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          setInput(reader.result as string);
          setIsRecording(false);
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Recording error:", error);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
  }

  return (
    <div
      style={{
        background: C.bg2,
        border: `1px solid ${C.bdr}`,
        borderRadius: R.r2,
        padding: "16px",
        marginBottom: "16px",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, marginBottom: "12px" }}>
        📹 Video Analysis (Phase 2)
      </div>

      {/* Mode selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: "12px", flexWrap: "wrap" }}>
        {(["url", "upload", "record", "youtube"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: "6px 12px",
              borderRadius: R.r1,
              border: `1px solid ${mode === m ? C.acc : C.bdr}`,
              background: mode === m ? C.accDim : "transparent",
              color: mode === m ? C.acc2 : C.t3,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {m === "url" && "URL"}
            {m === "upload" && "Upload"}
            {m === "record" && "Record"}
            {m === "youtube" && "YouTube"}
          </button>
        ))}
      </div>

      {/* Input area */}
      {mode === "url" && (
        <input
          type="text"
          placeholder="Paste video URL..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: R.r1,
            border: `1px solid ${C.bdr}`,
            background: C.bg3,
            color: C.t1,
            fontSize: 12,
            fontFamily: "inherit",
            marginBottom: "12px",
          }}
        />
      )}

      {mode === "upload" && (
        <div style={{ marginBottom: "12px" }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: R.r1,
              border: `1px dashed ${C.bdr}`,
              background: "transparent",
              color: C.t3,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {input ? "✓ Video selected" : "Click to upload video"}
          </button>
        </div>
      )}

      {mode === "record" && (
        <div style={{ marginBottom: "12px" }}>
          <button
            onClick={isRecording ? stopRecording : startRecording}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: R.r1,
              border: "none",
              background: isRecording ? C.red : C.acc,
              color: "#fff",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 500,
            }}
          >
            {isRecording ? "⏹ Stop recording" : "⚫ Start recording"}
          </button>
        </div>
      )}

      {mode === "youtube" && (
        <input
          type="text"
          placeholder="Paste YouTube URL..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: R.r1,
            border: `1px solid ${C.bdr}`,
            background: C.bg3,
            color: C.t1,
            fontSize: 12,
            fontFamily: "inherit",
            marginBottom: "12px",
          }}
        />
      )}

      {/* Analyze button */}
      <button
        onClick={analyzeVideo}
        disabled={!input.trim() || isAnalyzing}
        style={{
          width: "100%",
          padding: "8px 12px",
          borderRadius: R.r1,
          border: "none",
          background: input.trim() && !isAnalyzing ? C.acc : C.bdr,
          color: input.trim() && !isAnalyzing ? "#fff" : C.t4,
          fontSize: 12,
          cursor: input.trim() && !isAnalyzing ? "pointer" : "not-allowed",
          fontFamily: "inherit",
          fontWeight: 500,
        }}
      >
        {isAnalyzing ? "⟳ Analyzing..." : "Analyze for duplication"}
      </button>

      {/* Results */}
      {analysis && (
        <div
          style={{
            marginTop: "12px",
            padding: "12px",
            background: C.bg3,
            borderRadius: R.r1,
            fontSize: 12,
            color: C.t2,
          }}
        >
          <div style={{ fontWeight: 600, color: C.t1, marginBottom: 8 }}>Analysis Results</div>
          <div style={{ marginBottom: 4 }}>
            <strong>Platform:</strong> {analysis.detectedPlatform}
          </div>
          <div style={{ marginBottom: 4 }}>
            <strong>Duplication:</strong> {(analysis.duplicationScore * 100).toFixed(0)}%
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Confidence:</strong> {(analysis.confidence * 100).toFixed(0)}%
          </div>
          <div style={{ fontSize: 11, color: C.t3, marginTop: 8 }}>
            <strong>Suggested prompt:</strong>
            <div style={{ marginTop: 4, fontStyle: "italic" }}>{analysis.suggestedPrompt}</div>
          </div>
        </div>
      )}
    </div>
  );
}
