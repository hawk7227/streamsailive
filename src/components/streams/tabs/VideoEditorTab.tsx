"use client";

import { useEffect, useMemo, useState } from "react";
import MediaPlayer from "../VideoPlayer";
import { C, R } from "../tokens";

type ActionStatus = "idle" | "ready" | "running" | "succeeded" | "failed" | "blocked";
type Sel = "full_video" | "shot" | "transcript_line" | "audio_segment" | "version";

interface ActionItem {
  id: string;
  label: string;
  description: string;
  requiredTarget: Sel | "none";
  route?: string;
  method?: "POST" | "GET";
  outputType: "job" | "version" | "artifact" | "audio" | "frames" | "none";
  available: boolean;
  blockedReason?: string;
}

const ACTIONS: ActionItem[] = [
  { id: "ingest", label: "Ingest / analyze", description: "Start ingest pipeline", requiredTarget: "full_video", route: "/api/streams/video/ingest", method: "POST", outputType: "job", available: true },
  { id: "ingest_status", label: "Check ingest status", description: "Poll ingest state", requiredTarget: "none", route: "/api/streams/video/ingest/status", method: "POST", outputType: "job", available: true },
  { id: "extract_frames", label: "Extract frames", description: "Extract frame strip", requiredTarget: "full_video", route: "/api/streams/extract-video-frames", method: "POST", outputType: "frames", available: true },
  { id: "extract_audio", label: "Extract audio", description: "Voice and silent video split", requiredTarget: "full_video", route: "/api/pipeline-test/audio/extract", method: "POST", outputType: "audio", available: true },
  { id: "separate_audio", label: "Separate audio", description: "Voice/ambient separation", requiredTarget: "audio_segment", route: "/api/pipeline-test/audio/separate", method: "POST", outputType: "audio", available: true },
  { id: "transcribe", label: "Transcribe audio", description: "Pipeline transcript extraction", requiredTarget: "audio_segment", route: "/api/pipeline-test/transcript/transcribe", method: "POST", outputType: "artifact", available: true },
  { id: "edit_voice", label: "Replace voice", description: "Edit one dialogue segment", requiredTarget: "transcript_line", route: "/api/streams/video/edit-voice", method: "POST", outputType: "version", available: true },
  { id: "edit_motion", label: "Motion transfer", description: "Replace selected shot motion", requiredTarget: "shot", route: "/api/streams/video/edit-motion", method: "POST", outputType: "version", available: true },
  { id: "edit_body", label: "Change body motion", description: "Upper-body motion replacement", requiredTarget: "full_video", route: "/api/streams/video/edit-body", method: "POST", outputType: "version", available: true },
  { id: "edit_emotion", label: "Change emotion", description: "Expression change on loaded video", requiredTarget: "full_video", route: "/api/streams/video/edit-emotion", method: "POST", outputType: "version", available: true },
  { id: "dub", label: "Translate / dub", description: "Language dub", requiredTarget: "full_video", route: "/api/streams/video/dub", method: "POST", outputType: "version", available: true },
  { id: "voice_generate", label: "Generate voice", description: "Generate TTS asset", requiredTarget: "none", route: "/api/streams/voice/generate", method: "POST", outputType: "audio", available: true },
  { id: "stitch", label: "Stitch outputs", description: "Concatenate multiple clip urls", requiredTarget: "version", route: "/api/streams/stitch", method: "POST", outputType: "job", available: true },
  { id: "save_version", label: "Save artifact version", description: "Create non-destructive artifact version", requiredTarget: "version", outputType: "artifact", available: false, blockedReason: "Artifact ID is required in editor context; current tab receives generationLogId but not artifactId." },
  { id: "sync_mouth", label: "Sync mouth", description: "Dedicated lip-sync action", requiredTarget: "transcript_line", outputType: "version", available: false, blockedReason: "No direct editor-safe lipsync route contract exposed." },
];

export default function VideoEditorTab({ analysisId, genLogId, videoUrl, artifactId }: { analysisId?: string | null; genLogId?: string | null; videoUrl?: string | null; artifactId?: string | null; }) {
  const [selected, setSelected] = useState<Sel>("full_video");
  const [activeAction, setActiveAction] = useState("ingest");
  const [status, setStatus] = useState<Record<string, ActionStatus>>({});
  const [result, setResult] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string>("");
  const [timeline, setTimeline] = useState<Array<{ id: string; actionId: string; route: string; requestSummary: string; responseSummary: string; outputId: string; timestamp: string; status: ActionStatus }>>([]);
  const [viewport, setViewport] = useState<"desktop"|"tablet"|"mobile">("desktop");
  const [mobilePanel, setMobilePanel] = useState<"left"|"right"|"timeline">("left");

  const [prompt, setPrompt] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [firstFrameUrl, setFirstFrameUrl] = useState("");
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(5000);

  const actionInv = useMemo(() => ACTIONS.map((a) => ({ ...a, available: a.id === "save_version" ? Boolean(artifactId) : a.available, blockedReason: a.id === "save_version" && !artifactId ? "Save Version requires artifactId in editor context." : a.blockedReason })), [artifactId]);

  useEffect(() => {
    const apply = () => {
      const w = window.innerWidth;
      setViewport(w < 768 ? "mobile" : w < 1100 ? "tablet" : "desktop");
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  async function runAction(id: string) {
    const action = actionInv.find((a) => a.id === id);
    if (!action) return;
    if (!action.available || !action.route) {
      setStatus((s) => ({ ...s, [id]: "blocked" }));
      setTimeline((t) => [{ id: crypto.randomUUID(), actionId: id, route: action.route ?? "n/a", requestSummary: "blocked", responseSummary: action.blockedReason ?? "blocked", outputId: "", timestamp: new Date().toISOString(), status: "blocked" as ActionStatus }, ...t].slice(0, 20));
      return;
    }
    setStatus((s) => ({ ...s, [id]: "running" }));
    setError("");

    try {
      let body: Record<string, unknown> = {};
      if (id === "ingest") body = { videoUrl, generationLogId: genLogId };
      if (id === "ingest_status") body = { analysisId };
      if (id === "extract_frames") body = { videoUrl, frameCount: 8 };
      if (id === "extract_audio") body = { videoUrl };
      if (id === "separate_audio") body = { audioUrl };
      if (id === "transcribe") body = { audioUrl };
      if (id === "edit_voice") body = { generationLogId: genLogId, analysisId, originalText: "line", newText: prompt || "Updated dialogue", startMs, endMs, videoUrl };
      if (id === "edit_motion") body = { generationLogId: genLogId, firstFrameUrl, newPrompt: prompt || "gentle walk", startMs, endMs, videoUrl };
      if (id === "edit_body") body = { generationLogId: genLogId, analysisId, newText: prompt || "change body expression" };
      if (id === "edit_emotion") body = { generationLogId: genLogId, videoUrl, emotion: "neutral" };
      if (id === "dub") body = { generationLogId: genLogId, videoUrl, targetLanguage: "es" };
      if (id === "voice_generate") body = { text: prompt || "voice sample" };
      if (id === "stitch") body = { clips: [videoUrl, videoUrl].filter(Boolean) };
      if (id === "save_version") body = { contentUrl: videoUrl, contentType: "video/mp4", changeSummary: prompt || "Editor version", origin: "edited", generationLogId: genLogId };
      if (id === "sync_mouth") body = { generationLogId: genLogId, analysisId, originalText: "line", newText: prompt || "lip sync line", startMs, endMs, videoUrl };

      const route = id === "save_version" && artifactId ? `/api/streams/artifacts/${artifactId}/versions` : action.route;
      const res = await fetch(route ?? action.route ?? "", { method: action.method ?? "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) throw new Error(String(data.error ?? `${action.label} failed`));

      setResult(data);
      setStatus((s) => ({ ...s, [id]: "succeeded" }));
      const outputId = String((data.versionId ?? data.generationId ?? data.analysisId ?? data.responseUrl ?? ""));
      setTimeline((t) => [{ id: crypto.randomUUID(), actionId: id, route: String(route ?? action.route ?? ""), requestSummary: JSON.stringify(body).slice(0, 140), responseSummary: JSON.stringify(data).slice(0, 180), outputId, timestamp: new Date().toISOString(), status: "succeeded" as ActionStatus }, ...t].slice(0, 20));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      setStatus((s) => ({ ...s, [id]: "failed" }));
      setTimeline((t) => [{ id: crypto.randomUUID(), actionId: id, route: String(action.route ?? ""), requestSummary: "failed", responseSummary: msg, outputId: "", timestamp: new Date().toISOString(), status: "failed" as ActionStatus }, ...t].slice(0, 20));
    }
  }

  return <div data-testid="streams-editor" style={{ display: "grid", gridTemplateRows: "56px minmax(0,1fr) 220px", height: "100%", gap: 8, overflowX: "hidden" }}>
    <div style={{ border: `1px solid ${C.bdr}`, borderRadius: R.r2, padding: "8px 12px", display: "flex", justifyContent: "space-between" }}>
      <div><div>STREAMS Editor</div><div style={{ fontSize: 12, color: C.t3 }}>{videoUrl ? "Loaded media" : "No media loaded"}</div></div>
      <div style={{ fontSize: 12, color: C.t3 }}>analysis:{analysisId ?? "not analyzed"} · generation:{genLogId ?? "missing"} · artifact:{artifactId ?? "missing"}</div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: viewport === "desktop" ? "minmax(240px,300px) minmax(0,1fr) minmax(280px,360px)" : "minmax(0,1fr)", gap: 8, minHeight: 0 }}>
      {(viewport === "desktop" || mobilePanel === "left") && <section data-testid="editor-left" style={{ border: `1px solid ${C.bdr}`, borderRadius: R.r2, padding: 8, overflow: "auto" }}>
        <h4>Source & Analysis</h4>
        <div style={{ fontSize: 12, color: C.t3 }}>Transcript: {analysisId ? "Available via ingest status" : "Not analyzed yet"}</div>
        <div style={{ fontSize: 12, color: C.t3 }}>Audio tracks: {audioUrl ? "Loaded" : "Audio has not been extracted."}</div>
        <div style={{ fontSize: 12, color: C.t3 }}>Frames: {firstFrameUrl ? "Reference loaded" : "Not analyzed yet"}</div>
        <textarea maxLength={2000} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Prompt/transcript edit" style={{ width: "100%", minHeight: 80, border: "none", background: C.bg2, color: C.t1 }} />
        <input value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} placeholder="Audio URL for separate/transcribe" style={{ width: "100%", height: 32, marginTop: 8 }} />
        <input value={firstFrameUrl} onChange={(e) => setFirstFrameUrl(e.target.value)} placeholder="First frame URL for motion edit" style={{ width: "100%", height: 32, marginTop: 8 }} />
      </section>}
      <section data-testid="editor-center" style={{ border: `1px solid ${C.bdr}`, borderRadius: R.r2, padding: 8, minHeight: 0 }}>
        {videoUrl ? <MediaPlayer src={videoUrl} kind="video" showDownload /> : <div style={{ height: "100%", display: "grid", placeItems: "center", color: C.t3 }}>Load a generated video, upload media, or select an artifact from Library.</div>}
      </section>
      {(viewport === "desktop" || mobilePanel === "right") && <section data-testid="editor-right" style={{ border: `1px solid ${C.bdr}`, borderRadius: R.r2, padding: 8, overflow: "auto" }}>
        <h4>Actions</h4>
        {actionInv.map((a) => <div key={a.id} style={{ border: `1px solid ${C.bdr}`, borderRadius: R.r1, padding: 8, marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><strong>{a.label}</strong><span style={{ fontSize: 12 }}>{a.available ? "Wired" : "Blocked"}</span></div>
          <div style={{ fontSize: 12, color: C.t3 }}>{a.description}</div>
          <div style={{ fontSize: 12, color: C.t3 }}>{a.route ?? a.blockedReason}</div>
          {a.available ? <button onClick={() => { setActiveAction(a.id); setStatus((st) => ({...st, [a.id]: "ready"})); void runAction(a.id); }} style={{ marginTop: 8 }}>Run</button> : <div style={{ fontSize: 12, color: C.t3, marginTop: 8 }}>{a.blockedReason}</div>}
          <div style={{ fontSize: 12, color: C.t3 }}>state: {status[a.id] ?? "idle"}</div>
        </div>)}
        <h4>Inspector</h4>
        <div style={{ fontSize: 12 }}>Selected target: {selected}</div>
        <div style={{ fontSize: 12 }}>Active action: {activeAction}</div>
        <pre style={{ fontSize: 12, whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto" }}>{JSON.stringify(result, null, 2)}</pre>
        {error ? <div style={{ color: C.red, fontSize: 12 }}>{error}</div> : null}
      </section>}
    </div>
    {(viewport === "desktop" || mobilePanel === "timeline") && <section data-testid="editor-timeline" style={{ border: `1px solid ${C.bdr}`, borderRadius: R.r2, padding: 8, overflow: "auto" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {(["full_video", "shot", "transcript_line", "audio_segment", "version"] as Sel[]).map((s) => <button key={s} onClick={() => setSelected(s)} style={{ padding: "4px 8px" }}>{s}</button>)}
      </div>
      <div style={{ fontSize: 12, color: C.t3 }}>Action history / jobs</div>
      {timeline.length === 0 ? <div style={{ fontSize: 12, color: C.t3 }}>No jobs yet.</div> : timeline.map((x) => <div key={x.id} style={{ fontSize: 12 }}>{x.timestamp} · {x.actionId} · {x.status} · {x.route} · {x.outputId || "no-output"}</div>)}
    </section>}
  {viewport !== "desktop" ? <div style={{ display: "flex", gap: 8 }}><button onClick={() => setMobilePanel("left")}>Source</button><button onClick={() => setMobilePanel("right")}>Tools</button><button onClick={() => setMobilePanel("timeline")}>Timeline</button></div> : null}
  </div>;
}
