"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

function assetKind(asset) {
  return String(asset.assetKind || asset.asset_kind || asset.kind || "");
}

function assetUrl(asset) {
  return asset.assetUrl || asset.asset_url || asset.url || "";
}

function normalizeAsset(asset) {
  return {
    id: asset.id || assetUrl(asset) || Math.random().toString(16),
    kind: assetKind(asset),
    url: assetUrl(asset),
    startSec: Number(asset.startSec ?? asset.start_sec ?? 0),
    endSec: Number(asset.endSec ?? asset.end_sec ?? 0),
    metadata: asset.metadata || {},
  };
}

function normalizeSegment(segment, index) {
  const metadata = segment.metadata || {};
  return {
    id: segment.id || `${index}`,
    type: segment.segmentType || segment.segment_type || "shot",
    index: Number(segment.segmentIndex || segment.segment_index || index + 1),
    startSec: Number(segment.startSec ?? segment.start_sec ?? 0),
    endSec: Number(segment.endSec ?? segment.end_sec ?? 0),
    label: metadata.sceneTitle || metadata.shotTitle || segment.label || `Shot ${index + 1}`,
    description: metadata.sceneDescription || metadata.description || metadata.detectionMode || "Pending enrichment",
    camera: metadata.cameraMovement || metadata.lensComposition || "pending",
    lighting: metadata.lighting || "pending",
    motion: metadata.motion || "pending",
    environment: metadata.environment || "pending",
    editIntent: metadata.editIntent || "pending",
    metadata,
  };
}

function time(seconds) {
  const n = Number(seconds || 0);
  const m = Math.floor(n / 60);
  const s = Math.floor(n % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getVideoSource(analysis, assets) {
  const video =
    assets.find((a) => String(a.kind).includes("source_video") && a.url) ||
    assets.find((a) => String(a.kind).includes("video") && a.url);
  return video?.url || analysis?.sourceUrl || analysis?.source_url || analysis?.blueprint?.source?.url || "";
}

async function getJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) throw new Error(data?.error || `Request failed: ${path}`);
  return data;
}

async function postJson(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) throw new Error(data?.error || `Request failed: ${path}`);
  return data;
}

function findAnchor() {
  const all = Array.from(document.querySelectorAll("body *"));
  const timeline = all.find((el) => /Timeline\s*\/\s*Keyframes/i.test(el.textContent || ""));
  if (timeline) return timeline.closest("section,div")?.parentElement || timeline.parentElement;
  const preview = all.find((el) => /Generated preview|Preview\s*\/\s*Player/i.test(el.textContent || ""));
  if (preview) return preview.closest("section,div")?.parentElement || preview.parentElement;
  return document.body;
}

export default function AnalyzerPreviewIntelligenceDock() {
  const videoRef = useRef(null);
  const [host, setHost] = useState(null);
  const [analysisIdInput, setAnalysisIdInput] = useState("");
  const [analysisId, setAnalysisId] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [intelligence, setIntelligence] = useState(null);
  const [editorId, setEditorId] = useState("");
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("shots");
  const [editText, setEditText] = useState("");
  const [status, setStatus] = useState("Load an analysis to edit.");
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [showTech, setShowTech] = useState(false);

  const assets = useMemo(() => (intelligence?.assets || intelligence?.intelligence?.assets || []).map(normalizeAsset), [intelligence]);
  const frames = useMemo(() => assets.filter((a) => String(a.kind).includes("frame")), [assets]);
  const audios = useMemo(() => assets.filter((a) => String(a.kind).includes("audio")), [assets]);
  const videos = useMemo(() => assets.filter((a) => String(a.kind).includes("video")), [assets]);
  const segments = useMemo(() => (intelligence?.segments || intelligence?.intelligence?.segments || []).map(normalizeSegment), [intelligence]);

  const transcript = analysis?.transcript || analysis?.blueprint?.audioLanguage?.transcript || "";
  const providerPrompt = analysis?.blueprint?.generation?.providerReadyPrompt || analysis?.blueprint?.generation?.recreatePrompt || "";
  const videoSrc = useMemo(() => getVideoSource(analysis, assets), [analysis, assets]);

  async function loadById(id) {
    const clean = String(id || "").trim();
    if (!clean) return;

    setError("");
    setStatus("Loading analysis…");

    const intel = await getJson(`/api/admingeneration/reference/analyze/${clean}/intelligence`);
    const nextAnalysis = intel.analysis || null;
    const nextIntelligence = intel.intelligence || intel;

    setAnalysisId(clean);
    setAnalysisIdInput(clean);
    setAnalysis(nextAnalysis);
    setIntelligence(nextIntelligence);

    try {
      const ed = await postJson("/api/admingeneration/editor/from-analysis", { analysisId: clean });
      if (ed?.editorProject?.id) setEditorId(ed.editorProject.id);
    } catch {
      setEditorId("");
    }

    window.localStorage.setItem("streams:lastAnalysisId", clean);
    setStatus("Loaded. Select a frame/shot/audio item and enter an edit.");
  }

  function selectItem(item, type) {
    const target = { ...item, targetType: type };
    setSelected(target);
    setEditText("");
    if (type === "segment" && videoRef.current) {
      try {
        videoRef.current.currentTime = Number(item.startSec || 0);
        videoRef.current.play().catch(() => {});
      } catch {}
    }
    if (type === "frame" && videoRef.current) {
      try {
        videoRef.current.currentTime = Number(item.startSec || 0);
      } catch {}
    }
  }

  async function saveEdit(action = "segment_edit") {
    if (!editorId) {
      setError("Editor project is not ready. Load analysis again.");
      return;
    }
    const instruction = editText.trim();
    if (!instruction) {
      setError("Enter an edit instruction first.");
      return;
    }

    setError("");
    setStatus("Saving edit request…");

    const result = await postJson(`/api/admingeneration/editor/projects/${editorId}/execute-edit`, {
      instruction,
      provider: "provider_router",
      action,
      targetType: selected?.targetType || "project",
      targetId: selected?.id || null,
      analysisId,
      selected,
      providerPrompt,
    });

    setStatus(
      result.status === "blocked_provider_not_wired"
        ? "Edit saved. Provider execution is blocked until a real provider adapter is connected."
        : "Edit saved."
    );
  }

  async function exportFinal() {
    if (!editorId) {
      setError("Editor project is not ready. Load analysis first.");
      return;
    }
    setError("");
    setStatus("Saving export request…");

    const result = await postJson(`/api/admingeneration/editor/projects/${editorId}/export-final`, {
      exportType: "mp4",
      settings: { source: "compact-edit-rail", analysisId },
    });

    setStatus(
      result.status === "blocked_render_worker_required"
        ? "Export request saved. Render worker is blocked until a real FFmpeg render worker is connected."
        : "Export request saved."
    );
  }

  useEffect(() => {
    const mount = document.createElement("div");
    mount.setAttribute("data-streams-analyzer-edit-rail", "true");
    mount.style.width = "100%";
    mount.style.gridColumn = "1 / -1";

    function attach() {
      const anchor = findAnchor();
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
    const saved = window.localStorage.getItem("streams:lastAnalysisId");
    if (saved) {
      setAnalysisIdInput(saved);
      loadById(saved).catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("Saved analysis failed to load.");
      });
    }

    function onLoaded(event) {
      const id = event?.detail?.analysisId || event?.detail?.analysis?.id || "";
      if (id) {
        loadById(id).catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setStatus("Analysis event failed.");
        });
      }
    }

    window.addEventListener("streams:analysis-loaded", onLoaded);
    return () => window.removeEventListener("streams:analysis-loaded", onLoaded);
  }, []);

  if (!host) return null;

  const body = (
    <section style={styles.shell}>
      <div style={styles.topbar}>
        <strong>Analyzer Edit Rail</strong>
        <input
          style={styles.input}
          value={analysisIdInput}
          onChange={(event) => setAnalysisIdInput(event.target.value)}
          placeholder="analysisId"
        />
        <button style={styles.primary} onClick={() => loadById(analysisIdInput)}>Load</button>
        <span style={styles.chip}>A {assets.length}</span>
        <span style={styles.chip}>V {videos.length}</span>
        <span style={styles.chip}>F {frames.length}</span>
        <span style={styles.chip}>Au {audios.length}</span>
        <span style={styles.chip}>S {segments.length}</span>
        <button style={styles.button} onClick={() => setCollapsed(!collapsed)}>{collapsed ? "Show" : "Hide"}</button>
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}
      <div style={styles.status}>{status}</div>

      {!collapsed ? (
        <>
          <div style={styles.workGrid}>
            <div style={styles.previewBox}>
              {videoSrc ? (
                <video ref={videoRef} src={videoSrc} controls playsInline style={styles.video} />
              ) : (
                <div style={styles.empty}>Load analysis to preview source video.</div>
              )}
            </div>

            <div style={styles.editorBox}>
              <div style={styles.selectedLine}>
                <b>Selected:</b>{" "}
                {selected ? `${selected.targetType} · ${selected.label || selected.kind || selected.id}` : "project/source"}
              </div>
              <textarea
                style={styles.editInput}
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                placeholder="Edit selected shot/frame/audio. Example: Replace product, change motion, improve camera, rewrite dialogue, change tone..."
              />
              <div style={styles.actionRow}>
                <button style={styles.primary} onClick={() => saveEdit("segment_edit")}>Save Edit</button>
                <button style={styles.button} onClick={() => saveEdit("voice_edit")}>Voice</button>
                <button style={styles.button} onClick={() => saveEdit("motion_edit")}>Motion</button>
                <button style={styles.button} onClick={() => saveEdit("regenerate_from_frame")}>Frame → Video</button>
                <button style={styles.button} onClick={exportFinal}>Export</button>
              </div>
            </div>
          </div>

          <div style={styles.tabs}>
            {["shots", "frames", "audio", "transcript", "blueprint", "versions"].map((tab) => (
              <button key={tab} style={activeTab === tab ? styles.activeTab : styles.tab} onClick={() => setActiveTab(tab)}>
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "shots" ? (
            <div style={styles.compactGrid}>
              {segments.length ? segments.map((segment) => (
                <button key={segment.id} style={styles.shotCard} onClick={() => selectItem(segment, "segment")}>
                  <b>{segment.label}</b>
                  <span>{time(segment.startSec)}–{time(segment.endSec)}</span>
                  <small>{segment.description}</small>
                  <small>Camera: {segment.camera}</small>
                  <small>Lighting: {segment.lighting}</small>
                  <small>Motion: {segment.motion}</small>
                  <small>Edit: {segment.editIntent}</small>
                </button>
              )) : <div style={styles.emptySmall}>No shots yet. Run analyzer worker.</div>}
            </div>
          ) : null}

          {activeTab === "frames" ? (
            <div style={styles.frameStrip}>
              {frames.length ? frames.map((frame, index) => (
                <button key={frame.id} style={styles.frameButton} onClick={() => selectItem({ ...frame, label: `Frame ${index + 1}` }, "frame")}>
                  <img src={frame.url} alt={`Frame ${index + 1}`} style={styles.frameImage} />
                  <span>{time(frame.startSec || index)}</span>
                </button>
              )) : <div style={styles.emptySmall}>No frames yet.</div>}
            </div>
          ) : null}

          {activeTab === "audio" ? (
            <div style={styles.stack}>
              {audios.length ? audios.map((item, index) => (
                <div key={item.id} style={styles.audioRow}>
                  <button style={styles.button} onClick={() => selectItem({ ...item, label: `Audio ${index + 1}` }, "audio")}>Select</button>
                  <audio src={item.url} controls style={styles.audio} />
                </div>
              )) : <div style={styles.emptySmall}>No audio yet.</div>}
            </div>
          ) : null}

          {activeTab === "transcript" ? (
            <div style={styles.textPanel}>{transcript || "Transcript/word timestamps pending enrichment worker."}</div>
          ) : null}

          {activeTab === "blueprint" ? (
            <div style={styles.textPanel}>{providerPrompt || "Provider-ready prompt pending enrichment worker."}</div>
          ) : null}

          {activeTab === "versions" ? (
            <div style={styles.textPanel}>Original source selected. Saved edit requests create provider runs. Real outputs create pending-QA versions. Export requests create truthful blocked states until render is wired.</div>
          ) : null}

          <details style={styles.details}>
            <summary>Technical Details</summary>
            <button style={styles.button} onClick={() => setShowTech(!showTech)}>{showTech ? "Hide JSON" : "Show JSON"}</button>
            {showTech ? <textarea readOnly style={styles.tech} value={JSON.stringify({ analysis, intelligence, selected }, null, 2)} /> : null}
          </details>
        </>
      ) : null}
    </section>
  );

  return createPortal(body, host);
}

const styles = {
  shell: {
    position: "fixed",
    left: 320,
    right: 24,
    bottom: 16,
    zIndex: 90,
    maxHeight: "48dvh",
    overflow: "auto",
    padding: 10,
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(8,13,24,0.96)",
    color: "#f8fafc",
    boxShadow: "0 24px 80px rgba(0,0,0,.42)",
    backdropFilter: "blur(12px)",
    display: "grid",
    gap: 8,
  },
  topbar: { display: "grid", gridTemplateColumns: "auto minmax(160px,1fr) auto repeat(5, auto) auto", gap: 6, alignItems: "center" },
  input: { minHeight: 32, borderRadius: 9, background: "#020617", color: "#f8fafc", border: "1px solid rgba(148,163,184,.25)", padding: "0 9px" },
  primary: { minHeight: 32, borderRadius: 9, background: "#2563eb", color: "#fff", border: "1px solid rgba(96,165,250,.45)", padding: "0 10px", cursor: "pointer" },
  button: { minHeight: 32, borderRadius: 9, background: "#1e293b", color: "#fff", border: "1px solid rgba(148,163,184,.25)", padding: "0 10px", cursor: "pointer" },
  chip: { display: "grid", placeItems: "center", minWidth: 34, minHeight: 28, borderRadius: 9, background: "rgba(15,23,42,.9)", border: "1px solid rgba(148,163,184,.18)", fontSize: 12 },
  status: { color: "#cbd5e1", fontSize: 12 },
  error: { color: "#fecaca", fontSize: 12 },
  workGrid: { display: "grid", gridTemplateColumns: "270px minmax(0,1fr)", gap: 8 },
  previewBox: { minHeight: 136, borderRadius: 12, overflow: "hidden", background: "#020617", border: "1px solid rgba(148,163,184,.18)" },
  video: { width: "100%", height: 150, objectFit: "contain", background: "#020617" },
  empty: { height: 150, display: "grid", placeItems: "center", color: "#94a3b8", fontSize: 12 },
  editorBox: { display: "grid", gap: 6 },
  selectedLine: { color: "#cbd5e1", fontSize: 12 },
  editInput: { width: "100%", minHeight: 64, resize: "vertical", borderRadius: 10, border: "1px solid rgba(148,163,184,.25)", background: "#020617", color: "#f8fafc", padding: 8 },
  actionRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  tabs: { display: "flex", gap: 6, overflowX: "auto" },
  tab: { minHeight: 30, borderRadius: 9, background: "#0f172a", color: "#cbd5e1", border: "1px solid rgba(148,163,184,.18)", padding: "0 10px", cursor: "pointer", textTransform: "capitalize" },
  activeTab: { minHeight: 30, borderRadius: 9, background: "#2563eb", color: "#fff", border: "1px solid rgba(96,165,250,.45)", padding: "0 10px", cursor: "pointer", textTransform: "capitalize" },
  compactGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 6 },
  shotCard: { display: "grid", gap: 3, textAlign: "left", padding: 8, borderRadius: 10, border: "1px solid rgba(96,165,250,.22)", background: "#020617", color: "#f8fafc", cursor: "pointer", fontSize: 12 },
  frameStrip: { display: "flex", gap: 6, overflowX: "auto" },
  frameButton: { width: 112, flex: "0 0 auto", display: "grid", gap: 4, padding: 4, borderRadius: 9, background: "#020617", color: "#f8fafc", border: "1px solid rgba(96,165,250,.22)", cursor: "pointer" },
  frameImage: { width: "100%", height: 58, objectFit: "cover", borderRadius: 7 },
  stack: { display: "grid", gap: 6 },
  audioRow: { display: "grid", gridTemplateColumns: "76px minmax(0,1fr)", gap: 6, alignItems: "center" },
  audio: { width: "100%" },
  textPanel: { maxHeight: 110, overflow: "auto", whiteSpace: "pre-wrap", fontSize: 12, color: "#cbd5e1", padding: 8, borderRadius: 10, background: "#020617", border: "1px solid rgba(148,163,184,.18)" },
  emptySmall: { color: "#94a3b8", fontSize: 12, padding: 8 },
  details: { color: "#cbd5e1", fontSize: 12 },
  tech: { width: "100%", minHeight: 140, marginTop: 6, borderRadius: 10, background: "#020617", color: "#f8fafc", border: "1px solid rgba(148,163,184,.22)", padding: 8, fontSize: 11 },
};
