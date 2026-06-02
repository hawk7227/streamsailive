"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

function normalizeAsset(asset) {
  return {
    id: asset.id || asset.assetUrl || asset.asset_url || Math.random().toString(16),
    kind: asset.assetKind || asset.asset_kind || asset.kind || "",
    url: asset.assetUrl || asset.asset_url || asset.url || "",
    startSec: Number(asset.startSec ?? asset.start_sec ?? 0),
    endSec: Number(asset.endSec ?? asset.end_sec ?? 0),
    metadata: asset.metadata || {},
  };
}

function normalizeSegment(segment, index) {
  return {
    id: segment.id || `${index}`,
    type: segment.segmentType || segment.segment_type || "shot",
    index: Number(segment.segmentIndex || segment.segment_index || index + 1),
    startSec: Number(segment.startSec ?? segment.start_sec ?? 0),
    endSec: Number(segment.endSec ?? segment.end_sec ?? 0),
    label: segment.label || segment.sceneDescription || `Segment ${index + 1}`,
    metadata: segment.metadata || {},
  };
}

function formatTime(seconds) {
  const value = Number(seconds || 0);
  const minutes = Math.floor(value / 60);
  const secs = Math.floor(value % 60);
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function getVideoSource(analysis, assets) {
  const sourceVideo =
    assets.find((asset) => String(asset.kind).includes("source_video") && asset.url) ||
    assets.find((asset) => String(asset.kind).includes("video") && asset.url);

  return sourceVideo?.url || analysis?.sourceUrl || analysis?.source_url || analysis?.blueprint?.source?.url || "";
}

async function fetchJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) throw new Error(data?.error || `Request failed: ${path}`);
  return data;
}

function findTimelineAnchor() {
  const all = Array.from(document.querySelectorAll("body *"));

  const timelineLabel = all.find((el) => /Timeline\s*\/\s*Keyframes/i.test(el.textContent || ""));
  if (timelineLabel) {
    const block = timelineLabel.closest("section,div");
    return block?.parentElement || block || timelineLabel.parentElement;
  }

  const preview = all.find((el) => /Generated preview|Preview\s*\/\s*Player/i.test(el.textContent || ""));
  if (preview) {
    const block = preview.closest("section,div");
    return block?.parentElement || block || preview.parentElement;
  }

  return document.querySelector("main") || document.body;
}

export default function AnalyzerPreviewIntelligenceDock() {
  const videoRef = useRef(null);
  const [host, setHost] = useState(null);
  const [analysisIdInput, setAnalysisIdInput] = useState("");
  const [analysisId, setAnalysisId] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [intelligence, setIntelligence] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [selected, setSelected] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [showTech, setShowTech] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState("Ready. Load an analysis ID or analyze a source.");
  const [error, setError] = useState("");

  const assets = useMemo(() => {
    return (intelligence?.assets || intelligence?.intelligence?.assets || []).map(normalizeAsset);
  }, [intelligence]);

  const frames = useMemo(() => assets.filter((asset) => String(asset.kind).includes("frame")), [assets]);
  const audio = useMemo(() => assets.filter((asset) => String(asset.kind).includes("audio")), [assets]);
  const videos = useMemo(() => assets.filter((asset) => String(asset.kind).includes("video")), [assets]);

  const segments = useMemo(() => {
    return (intelligence?.segments || intelligence?.intelligence?.segments || []).map(normalizeSegment);
  }, [intelligence]);

  const transcript = analysis?.transcript || analysis?.blueprint?.audioLanguage?.transcript || "";
  const videoSrc = useMemo(() => getVideoSource(analysis, assets), [analysis, assets]);
  const hasExtractedData = frames.length > 0 || audio.length > 0 || segments.length > 0;

  async function loadById(id) {
    const clean = String(id || "").trim();
    if (!clean) return;

    setStatus("Loading analyzer intelligence…");
    setError("");

    const intel = await fetchJson(`/api/admingeneration/reference/analyze/${clean}/intelligence`);
    const nextAnalysis = intel.analysis || null;
    const nextIntelligence = intel.intelligence || intel;

    setAnalysisId(clean);
    setAnalysisIdInput(clean);
    setAnalysis(nextAnalysis);
    setIntelligence(nextIntelligence);

    try {
      const edRes = await fetch("/api/admingeneration/editor/from-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId: clean }),
      });
      const ed = await edRes.json().catch(() => null);
      if (ed?.ok && ed?.editorProject?.id) {
        const tl = await fetchJson(`/api/admingeneration/editor/projects/${ed.editorProject.id}/timeline`);
        setTimeline(tl);
      }
    } catch {
      // optional editor timeline bridge
    }

    if (typeof window !== "undefined") window.localStorage.setItem("streams:lastAnalysisId", clean);
    setEditMode(true);
    setStatus("Analyzer intelligence loaded.");
  }

  function seekTo(seconds, item) {
    setSelected(item);
    const video = videoRef.current;
    if (video && Number.isFinite(Number(seconds))) {
      try {
        video.currentTime = Number(seconds);
        video.play().catch(() => {});
      } catch {}
    }
  }

  useEffect(() => {
    const mount = document.createElement("div");
    mount.setAttribute("data-streams-analyzer-preview-dock", "true");
    mount.style.width = "100%";
    mount.style.gridColumn = "1 / -1";
    mount.style.display = "block";

    function attach() {
      const anchor = document.body;
      if (anchor && mount.parentElement !== anchor) {
        anchor.appendChild(mount);
        setHost(mount);
      }
    }

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mount.remove();
    };
  }, []);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("streams:lastAnalysisId") : "";
    if (saved) {
      setAnalysisIdInput(saved);
      loadById(saved).catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("Could not load saved analysis.");
      });
    }

    function onLoaded(event) {
      const id = event?.detail?.analysisId || event?.detail?.analysis?.id || "";
      if (id) {
        loadById(id).catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setStatus("Analyzer load failed");
        });
      }
    }

    window.addEventListener("streams:analysis-loaded", onLoaded);
    return () => window.removeEventListener("streams:analysis-loaded", onLoaded);
  }, []);

  if (!host) return null;

  return createPortal(
    <section style={styles.shell}>
      <div style={styles.header}>
        <div>
          <div style={styles.kicker}>Analyzer Breakdown</div>
          <strong>{analysis?.blueprint?.summary?.title || analysis?.summary || "Load an analysis to preview extracted media"}</strong>
          <div style={styles.status}>{status}</div>
        </div>
        <div style={styles.headerActions}>
          <button style={editMode ? styles.activeButton : styles.button} onClick={() => setEditMode(!editMode)}>
            Video Edit Mode
          </button>
          <button style={styles.button} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? "Show" : "Hide"}
          </button>
        </div>
      </div>

      <div style={styles.loadRow}>
        <input
          style={styles.input}
          value={analysisIdInput}
          onChange={(event) => setAnalysisIdInput(event.target.value)}
          placeholder="Load Existing Analysis ID"
        />
        <button style={styles.primaryButton} onClick={() => loadById(analysisIdInput)}>
          Load Analysis
        </button>
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}

      {!collapsed ? (
        <>
          <div style={styles.previewGrid}>
            <div style={styles.previewCard}>
              <div style={styles.cardTitle}>Source Video Preview</div>
              {videoSrc ? (
                <video ref={videoRef} src={videoSrc} controls playsInline style={styles.video} />
              ) : (
                <div style={styles.empty}>No analyzed source loaded yet.</div>
              )}
            </div>

            <div style={styles.cards}>
              <div style={styles.metric}><b>{assets.length}</b><span>Assets</span></div>
              <div style={styles.metric}><b>{videos.length}</b><span>Video</span></div>
              <div style={styles.metric}><b>{frames.length}</b><span>Frames</span></div>
              <div style={styles.metric}><b>{audio.length}</b><span>Audio</span></div>
              <div style={styles.metric}><b>{segments.length}</b><span>Segments</span></div>
            </div>
          </div>

          {!hasExtractedData ? (
            <div style={styles.workerWarning}>
              Frames/audio/segments appear here after the unified worker populates the intelligence graph.
            </div>
          ) : null}

          <div style={styles.lane}>
            <div style={styles.laneHeader}><b>Frames / Keyframes</b><span>{frames.length}</span></div>
            <div style={styles.frameStrip}>
              {frames.length ? frames.map((frame, index) => (
                <button key={frame.id} style={styles.frameButton} onClick={() => seekTo(frame.startSec || index, frame)}>
                  <img src={frame.url} alt={`Frame ${index + 1}`} style={styles.frameImage} />
                  <span>{formatTime(frame.startSec || index)}</span>
                </button>
              )) : <span style={styles.emptyInline}>No frames extracted yet</span>}
            </div>
          </div>

          <div style={styles.lane}>
            <div style={styles.laneHeader}><b>Segments / Shots</b><span>{segments.length}</span></div>
            <div style={styles.segmentGrid}>
              {segments.length ? segments.map((segment) => (
                <button key={segment.id} style={styles.segmentButton} onClick={() => seekTo(segment.startSec, segment)}>
                  <b>{segment.metadata?.sceneTitle || segment.metadata?.shotTitle || segment.label}</b>
                  <span>{formatTime(segment.startSec)} – {formatTime(segment.endSec)}</span>
                  <small>{segment.metadata?.sceneDescription || segment.metadata?.detectionMode || segment.type}</small>
                  <small>Camera: {segment.metadata?.cameraMovement || "pending"}</small>
                  <small>Lighting: {segment.metadata?.lighting || "pending"}</small>
                  <small>Motion: {segment.metadata?.motion || "pending"}</small>
                  <small>Edit: {segment.metadata?.editIntent || "pending"}</small>
                </button>
              )) : <span style={styles.emptyInline}>No segments extracted yet</span>}
            </div>
          </div>

          <div style={styles.lane}>
            <div style={styles.laneHeader}><b>Audio</b><span>{audio.length}</span></div>
            <div style={styles.audioList}>
              {audio.length ? audio.map((item, index) => (
                <div key={item.id} style={styles.audioItem}>
                  <span>Audio track {index + 1}</span>
                  <audio src={item.url} controls style={styles.audio} />
                </div>
              )) : <span style={styles.emptyInline}>No audio extracted yet</span>}
            </div>
          </div>

          <div style={styles.lane}>
            <div style={styles.laneHeader}><b>Transcript</b><span>{transcript ? "available" : "pending"}</span></div>
            <div style={styles.transcript}>{transcript || "Transcript/word timestamps are pending the transcription worker."}</div>
          </div>

          <div style={styles.lane}>
            <div style={styles.laneHeader}><b>Versions / Edit State</b><span>{selected ? "selection active" : "source"}</span></div>
            <div style={styles.selectedBox}>
              {selected ? JSON.stringify({
                type: selected.type || selected.kind || "selection",
                label: selected.label || selected.kind,
                startSec: selected.startSec,
                endSec: selected.endSec,
              }, null, 2) : "Original source selected. Choose a frame or segment to edit a specific part."}
            </div>
          </div>

          <details style={styles.details}>
            <summary>Compact Intelligence Cards</summary>
            <div style={styles.infoGrid}>
              <div><b>Visual</b><span>{analysis?.blueprint?.visualLanguage?.style || "pending model analysis"}</span></div>
              <div><b>Lighting</b><span>{analysis?.blueprint?.visualLanguage?.lightingStyle || "pending model analysis"}</span></div>
              <div><b>Camera</b><span>{analysis?.blueprint?.visualLanguage?.cameraLanguage || analysis?.blueprint?.visualLanguage?.compositionStyle || "pending model analysis"}</span></div>
              <div><b>Environment</b><span>{analysis?.blueprint?.visualLanguage?.environment || "pending model analysis"}</span></div>
              <div><b>Motion</b><span>{analysis?.blueprint?.visualLanguage?.pacing || "pending model analysis"}</span></div>
              <div><b>Sound</b><span>{analysis?.blueprint?.audioLanguage?.soundDesign || "pending audio model analysis"}</span></div>
              <div><b>Voice</b><span>{analysis?.blueprint?.audioLanguage?.voiceStyle || "pending transcription"}</span></div>
              <div><b>Music</b><span>{analysis?.blueprint?.audioLanguage?.musicStyle || "pending audio model analysis"}</span></div>
            </div>
          </details>

          <div style={styles.lane}>
            <div style={styles.laneHeader}><b>Provider Blueprint</b><span>{analysis?.blueprint?.generation?.providerReadyPrompt ? "ready" : "pending"}</span></div>
            <div style={styles.transcript}>{analysis?.blueprint?.generation?.providerReadyPrompt || "Provider-ready prompt pending enrichment worker."}</div>
          </div>

          <details style={styles.details}>
            <summary>Technical Details</summary>
            <button style={styles.button} onClick={() => setShowTech(!showTech)}>
              {showTech ? "Hide JSON" : "Show JSON"}
            </button>
            {showTech ? (
              <textarea readOnly style={styles.techBox} value={JSON.stringify({ analysis, intelligence, timeline }, null, 2)} />
            ) : null}
          </details>
        </>
      ) : null}
    </section>,
    host,
  );
}

const styles = {
  shell: {
    position: "fixed",
    left: 320,
    right: 24,
    bottom: 18,
    zIndex: 90,
    maxHeight: "44dvh",
    overflow: "auto",
    margin: 0,
    padding: 12,
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(8,13,24,0.96)",
    color: "#f8fafc",
    display: "grid",
    gap: 12,
    boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
    backdropFilter: "blur(12px)",
  },
  header: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" },
  headerActions: { display: "flex", gap: 8, flexWrap: "wrap" },
  kicker: { color: "#93c5fd", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" },
  status: { color: "#cbd5e1", fontSize: 12, marginTop: 4 },
  error: { color: "#fecaca", fontSize: 12 },
  loadRow: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 140px", gap: 8 },
  input: { minHeight: 38, borderRadius: 10, border: "1px solid rgba(148,163,184,0.24)", background: "#020617", color: "#f8fafc", padding: "0 10px" },
  button: { minHeight: 36, borderRadius: 10, border: "1px solid rgba(148,163,184,0.24)", background: "#1e293b", color: "#f8fafc", padding: "0 10px", cursor: "pointer" },
  activeButton: { minHeight: 36, borderRadius: 10, border: "1px solid rgba(96,165,250,0.45)", background: "#2563eb", color: "#f8fafc", padding: "0 10px", cursor: "pointer" },
  primaryButton: { minHeight: 38, borderRadius: 10, border: "1px solid rgba(96,165,250,0.45)", background: "#2563eb", color: "#f8fafc", padding: "0 10px", cursor: "pointer" },
  previewGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 260px", gap: 12 },
  previewCard: { display: "grid", gap: 8 },
  cardTitle: { color: "#93c5fd", fontSize: 12 },
  video: { width: "100%", maxHeight: 420, borderRadius: 14, background: "#020617" },
  empty: { minHeight: 180, display: "grid", placeItems: "center", color: "#94a3b8", background: "#020617", borderRadius: 14 },
  cards: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  metric: { display: "grid", placeItems: "center", borderRadius: 12, background: "rgba(15,23,42,0.86)", border: "1px solid rgba(148,163,184,0.16)", minHeight: 64 },
  workerWarning: { color: "#fde68a", fontSize: 12, padding: 10, borderRadius: 12, background: "rgba(120,53,15,0.2)", border: "1px solid rgba(251,191,36,0.3)" },
  lane: { display: "grid", gap: 8, padding: 10, borderRadius: 14, background: "rgba(15,23,42,0.72)", border: "1px solid rgba(148,163,184,0.16)" },
  laneHeader: { display: "flex", justifyContent: "space-between", color: "#cbd5e1", fontSize: 12 },
  frameStrip: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 },
  frameButton: { minWidth: 132, display: "grid", gap: 5, padding: 5, borderRadius: 10, border: "1px solid rgba(96,165,250,0.28)", background: "#020617", color: "#f8fafc", cursor: "pointer" },
  frameImage: { width: "100%", height: 72, objectFit: "cover", borderRadius: 8 },
  segmentGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 },
  segmentButton: { display: "grid", gap: 4, textAlign: "left", padding: 10, borderRadius: 10, border: "1px solid rgba(96,165,250,0.24)", background: "#020617", color: "#f8fafc", cursor: "pointer" },
  audioList: { display: "grid", gap: 8 },
  audioItem: { display: "grid", gap: 6 },
  audio: { width: "100%" },
  transcript: { color: "#cbd5e1", fontSize: 12, lineHeight: 1.45, maxHeight: 120, overflow: "auto" },
  selectedBox: { whiteSpace: "pre-wrap", color: "#cbd5e1", fontSize: 12 },
  emptyInline: { color: "#94a3b8", fontSize: 12 },
  details: { color: "#e2e8f0" },
  infoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginTop: 8 },
  techBox: { width: "100%", minHeight: 180, marginTop: 8, borderRadius: 10, background: "#020617", color: "#f8fafc", border: "1px solid rgba(148,163,184,0.22)", padding: 10 },
};
