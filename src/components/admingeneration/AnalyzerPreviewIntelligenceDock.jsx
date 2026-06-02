"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

function assetKind(asset) {
  return String(asset.assetKind || asset.asset_kind || asset.kind || "");
}

function assetUrl(asset) {
  return asset.assetUrl || asset.asset_url || asset.url || "";
}

function normalizeAsset(asset, index = 0) {
  const metadata = asset.metadata || {};
  return {
    id: asset.id || asset.assetId || assetUrl(asset) || `asset-${index}`,
    label: asset.label || metadata.label || assetKind(asset) || `Asset ${index + 1}`,
    kind: assetKind(asset),
    url: assetUrl(asset),
    startSec: Number(asset.startSec ?? asset.start_sec ?? metadata.startSec ?? metadata.start_sec ?? 0),
    endSec: Number(asset.endSec ?? asset.end_sec ?? metadata.endSec ?? metadata.end_sec ?? 0),
    metadata,
  };
}

function normalizeSegment(segment, index = 0) {
  const metadata = segment.metadata || {};
  return {
    id: segment.id || segment.segmentId || `${index}`,
    targetType: segment.segmentType || segment.segment_type || "shot",
    type: segment.segmentType || segment.segment_type || "shot",
    index: Number(segment.segmentIndex || segment.segment_index || index + 1),
    startSec: Number(segment.startSec ?? segment.start_sec ?? 0),
    endSec: Number(segment.endSec ?? segment.end_sec ?? 0),
    label: metadata.sceneTitle || metadata.shotTitle || segment.label || `Timeline segment ${index + 1}`,
    description: metadata.sceneDescription || metadata.description || metadata.detectionMode || "Editable segment",
    camera: metadata.cameraMovement || metadata.camera || metadata.lensComposition || "pending",
    lighting: metadata.lighting || "pending",
    motion: metadata.motion || metadata.motionProfile || "pending",
    emotion: metadata.emotion || metadata.expression || "pending",
    subject: metadata.subject || metadata.person || metadata.character || "pending",
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

function readArray(root, keys) {
  for (const key of keys) {
    const value = key.split(".").reduce((acc, part) => acc?.[part], root);
    if (Array.isArray(value)) return value;
  }
  return [];
}

function compactId(id) {
  const value = String(id || "");
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function resultText(result) {
  if (!result) return "No action yet.";
  const status = result.status || result.qcReport?.status || result.transcriptEdit?.status || "saved";
  if (String(status).includes("blocked")) return `Blocked: ${status.replaceAll("_", " ")}`;
  return `Saved: ${String(status).replaceAll("_", " ")}`;
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
  const [busyAction, setBusyAction] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const [versions, setVersions] = useState(null);
  const [showTech, setShowTech] = useState(false);

  const assets = useMemo(() => (intelligence?.assets || intelligence?.intelligence?.assets || []).map(normalizeAsset), [intelligence]);
  const frames = useMemo(() => assets.filter((a) => String(a.kind).includes("frame")), [assets]);
  const audios = useMemo(() => assets.filter((a) => String(a.kind).includes("audio") || String(a.kind).includes("voice") || String(a.kind).includes("music") || String(a.kind).includes("ambient")), [assets]);
  const videos = useMemo(() => assets.filter((a) => String(a.kind).includes("video")), [assets]);
  const segments = useMemo(() => (intelligence?.segments || intelligence?.intelligence?.segments || []).map(normalizeSegment), [intelligence]);

  const transcript = analysis?.transcript || analysis?.blueprint?.audioLanguage?.transcript || intelligence?.transcript || intelligence?.intelligence?.transcript || "";
  const providerPrompt = analysis?.blueprint?.generation?.providerReadyPrompt || analysis?.blueprint?.generation?.recreatePrompt || "";
  const videoSrc = useMemo(() => getVideoSource(analysis, assets), [analysis, assets]);

  const transcriptTargets = useMemo(() => {
    const wordSegments = readArray(intelligence, ["word_timestamps", "wordTimestamps", "transcript.words", "intelligence.word_timestamps", "intelligence.wordTimestamps"]);
    if (wordSegments.length) {
      return wordSegments.slice(0, 80).map((item, index) => ({
        id: item.id || `word-${index}`,
        label: item.word || item.text || `Word ${index + 1}`,
        text: item.word || item.text || "",
        startSec: Number(item.start ?? item.startSec ?? item.start_sec ?? 0),
        endSec: Number(item.end ?? item.endSec ?? item.end_sec ?? 0),
        metadata: item,
      }));
    }
    return String(transcript || "")
      .split(/(?<=[.!?])\s+/)
      .filter(Boolean)
      .slice(0, 30)
      .map((line, index) => ({ id: `line-${index}`, label: `Line ${index + 1}`, text: line, startSec: null, endSec: null, metadata: {} }));
  }, [intelligence, transcript]);

  const semanticTargets = useMemo(() => {
    const root = intelligence?.intelligence || intelligence || {};
    const subjects = readArray(root, ["subjects", "subject_profiles", "subjectProfiles", "faces", "people"]);
    const motions = readArray(root, ["motions", "motion_profiles", "motionProfiles", "gestures", "body_movement"]);
    const objects = readArray(root, ["objects", "backgrounds", "scene_objects"]);
    return [
      ...subjects.map((item, index) => ({ id: item.id || `subject-${index}`, label: item.name || item.label || `Person/Face ${index + 1}`, targetType: "face_person", metadata: item })),
      ...motions.map((item, index) => ({ id: item.id || `motion-${index}`, label: item.label || item.type || `Motion ${index + 1}`, targetType: "body_motion", metadata: item })),
      ...objects.map((item, index) => ({ id: item.id || `object-${index}`, label: item.label || item.name || `Object/Background ${index + 1}`, targetType: "object_background", metadata: item })),
    ];
  }, [intelligence]);

  async function loadVersions(nextEditorId = editorId) {
    if (!nextEditorId) return null;
    const data = await getJson(`/api/admingeneration/editor/projects/${nextEditorId}/versions`);
    setVersions(data);
    return data;
  }

  async function loadById(id) {
    const clean = String(id || "").trim();
    if (!clean) return;

    setError("");
    setLastResult(null);
    setStatus("Loading analysis…");

    const intel = await getJson(`/api/admingeneration/reference/analyze/${clean}/intelligence`);
    const nextAnalysis = intel.analysis || null;
    const nextIntelligence = intel.intelligence || intel;

    setAnalysisId(clean);
    setAnalysisIdInput(clean);
    setAnalysis(nextAnalysis);
    setIntelligence(nextIntelligence);

    let nextEditorId = "";
    try {
      const ed = await postJson("/api/admingeneration/editor/from-analysis", { analysisId: clean });
      nextEditorId = ed?.editorProject?.id || ed?.project?.id || "";
      if (nextEditorId) setEditorId(nextEditorId);
    } catch {
      setEditorId("");
    }

    if (nextEditorId) await loadVersions(nextEditorId).catch(() => null);
    window.localStorage.setItem("streams:lastAnalysisId", clean);
    setStatus("Loaded. Select any target, type the change, run a real saved action.");
  }

  function selectItem(item, type) {
    const target = { ...item, targetType: type || item.targetType || "project" };
    setSelected(target);
    setError("");
    if (type === "transcript" && item.text) setEditText(item.text);
    else setEditText("");
    if ((type === "segment" || type === "shot" || type === "scene" || type === "frame") && videoRef.current) {
      try {
        videoRef.current.currentTime = Number(item.startSec || 0);
        if (type !== "frame") videoRef.current.play().catch(() => {});
      } catch {}
    }
  }

  async function runAction(action) {
    if (!editorId) {
      setError("Editor project is not ready. Load analysis again.");
      return;
    }
    const instruction = editText.trim();
    if (!instruction && action !== "load_versions" && action !== "qa_status" && action !== "export_final") {
      setError("Enter an edit instruction first.");
      return;
    }

    setError("");
    setBusyAction(action);
    setStatus(`Running ${action.replaceAll("_", " ")}…`);

    try {
      let result;
      if (action === "transcript_edit") {
        result = await postJson(`/api/admingeneration/editor/projects/${editorId}/transcript-edits`, {
          editedText: instruction,
          originalText: selected?.text || transcript || null,
          segmentId: selected?.id || null,
          startSec: typeof selected?.startSec === "number" ? selected.startSec : null,
          endSec: typeof selected?.endSec === "number" ? selected.endSec : null,
          metadata: { selected, analysisId },
        });
      } else if (action === "export_final") {
        result = await postJson(`/api/admingeneration/editor/projects/${editorId}/export-final`, {
          exportType: "mp4",
          settings: { source: "compact-semantic-edit-rail", analysisId, selected },
        });
      } else if (action === "qa_status") {
        result = await loadVersions(editorId);
      } else if (action === "load_versions") {
        result = await loadVersions(editorId);
      } else {
        result = await postJson(`/api/admingeneration/editor/projects/${editorId}/execute-edit`, {
          instruction,
          provider: "provider_router",
          action,
          targetType: selected?.targetType || "project",
          targetId: selected?.id || null,
          analysisId,
          selected,
          providerPrompt,
          semanticEditRail: true,
        });
      }

      setLastResult(result);
      if (action !== "load_versions") await loadVersions(editorId).catch(() => null);
      setStatus(resultText(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("Action failed without changing the original.");
    } finally {
      setBusyAction("");
    }
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

  const targetLabel = selected ? `${selected.targetType} · ${selected.label || selected.kind || compactId(selected.id)}` : "project/source";
  const actionDisabled = Boolean(busyAction || !editorId);

  const body = (
    <section style={styles.shell}>
      <div style={styles.topbar}>
        <strong style={styles.title}>Semantic Edit Rail</strong>
        <input style={styles.input} value={analysisIdInput} onChange={(event) => setAnalysisIdInput(event.target.value)} placeholder="analysisId" />
        <button style={styles.primary} onClick={() => loadById(analysisIdInput)} disabled={Boolean(busyAction)}>Load</button>
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
              {videoSrc ? <video ref={videoRef} src={videoSrc} controls playsInline style={styles.video} /> : <div style={styles.empty}>Load analysis to preview source video.</div>}
            </div>

            <div style={styles.editorBox}>
              <div style={styles.selectedLine}><b>Target:</b> {targetLabel}</div>
              <textarea
                style={styles.editInput}
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                placeholder="Select any target, then type the exact change. Example: fix the hand movement, rewrite this line, change voice, clean background, rebuild from this frame..."
              />
              <div style={styles.actionRow}>
                <button style={styles.primary} disabled={actionDisabled} onClick={() => runAction("segment_edit")}>Save Edit</button>
                <button style={styles.button} disabled={actionDisabled} onClick={() => runAction("regenerate_segment")}>Regenerate Segment</button>
                <button style={styles.button} disabled={actionDisabled} onClick={() => runAction("replace_clip")}>Replace Clip</button>
                <button style={styles.button} disabled={actionDisabled} onClick={() => runAction("regenerate_from_frame")}>Frame → Video</button>
                <button style={styles.button} disabled={actionDisabled} onClick={() => runAction("voice_edit")}>Voice</button>
                <button style={styles.button} disabled={actionDisabled} onClick={() => runAction("motion_edit")}>Motion</button>
                <button style={styles.button} disabled={actionDisabled} onClick={() => runAction("emotion_body_edit")}>Emotion/Body</button>
                <button style={styles.button} disabled={actionDisabled} onClick={() => runAction("mouth_sync")}>Mouth Sync</button>
                <button style={styles.button} disabled={actionDisabled} onClick={() => runAction("object_background_cleanup")}>Object/BG</button>
                <button style={styles.button} disabled={actionDisabled} onClick={() => runAction("restore_upscale_stabilize")}>Restore</button>
                <button style={styles.button} disabled={actionDisabled} onClick={() => runAction("transcript_edit")}>Transcript Edit</button>
                <button style={styles.button} disabled={actionDisabled} onClick={() => runAction("qa_status")}>QA / Status</button>
                <button style={styles.button} disabled={actionDisabled} onClick={() => runAction("export_final")}>Export Final</button>
              </div>
              <div style={styles.resultLine}>{busyAction ? `Working: ${busyAction.replaceAll("_", " ")}` : resultText(lastResult)}</div>
            </div>
          </div>

          <div style={styles.tabs}>
            {["shots", "frames", "audio", "transcript", "motion", "voice", "versions", "export", "technical"].map((tab) => (
              <button key={tab} style={activeTab === tab ? styles.activeTab : styles.tab} onClick={() => setActiveTab(tab)}>{tab}</button>
            ))}
          </div>

          {activeTab === "shots" ? (
            <div style={styles.compactGrid}>
              {segments.length ? segments.map((segment) => (
                <button key={segment.id} style={selected?.id === segment.id ? styles.selectedCard : styles.shotCard} onClick={() => selectItem(segment, segment.type || "segment")}>
                  <b>{segment.label}</b>
                  <span>{time(segment.startSec)}–{time(segment.endSec)}</span>
                  <small>Cam {segment.camera} · Motion {segment.motion}</small>
                  <small>Subject {segment.subject} · Emotion {segment.emotion}</small>
                </button>
              )) : <div style={styles.emptySmall}>No shots yet. Run analyzer worker.</div>}
            </div>
          ) : null}

          {activeTab === "frames" ? (
            <div style={styles.frameStrip}>
              {frames.length ? frames.map((frame, index) => (
                <button key={frame.id} style={selected?.id === frame.id ? styles.selectedFrameButton : styles.frameButton} onClick={() => selectItem({ ...frame, label: `Frame ${index + 1}` }, "frame")}>
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
                  <button style={styles.button} onClick={() => selectItem({ ...item, label: item.label || `Audio ${index + 1}` }, "audio_track")}>Select</button>
                  <span style={styles.smallLabel}>{item.kind || `Audio ${index + 1}`}</span>
                  <audio src={item.url} controls style={styles.audio} />
                </div>
              )) : <div style={styles.emptySmall}>No audio yet.</div>}
            </div>
          ) : null}

          {activeTab === "transcript" ? (
            <div style={styles.compactGrid}>
              {transcriptTargets.length ? transcriptTargets.map((line) => (
                <button key={line.id} style={selected?.id === line.id ? styles.selectedCard : styles.shotCard} onClick={() => selectItem(line, "transcript_line")}>
                  <b>{line.label}</b>
                  {line.startSec !== null ? <span>{time(line.startSec)}–{time(line.endSec)}</span> : null}
                  <small>{line.text}</small>
                </button>
              )) : <div style={styles.emptySmall}>Transcript/word timestamps pending enrichment worker.</div>}
            </div>
          ) : null}

          {activeTab === "motion" ? (
            <div style={styles.compactGrid}>
              {[...segments.map((s) => ({ ...s, label: `${s.label} motion`, targetType: "body_motion" })), ...semanticTargets.filter((t) => String(t.targetType).includes("motion") || String(t.targetType).includes("object"))].map((item) => (
                <button key={`${item.targetType}-${item.id}`} style={selected?.id === item.id && selected?.targetType === item.targetType ? styles.selectedCard : styles.shotCard} onClick={() => selectItem(item, item.targetType)}>
                  <b>{item.label}</b>
                  <small>Body · hand · gesture · camera · object/background</small>
                  <small>{item.motion || item.camera || item.description || "Selectable motion target"}</small>
                </button>
              ))}
            </div>
          ) : null}

          {activeTab === "voice" ? (
            <div style={styles.compactGrid}>
              {audios.map((item, index) => (
                <button key={item.id} style={selected?.id === item.id ? styles.selectedCard : styles.shotCard} onClick={() => selectItem({ ...item, label: item.label || `Voice/Audio ${index + 1}` }, "voice") }>
                  <b>{item.label || `Voice/Audio ${index + 1}`}</b>
                  <small>{item.kind}</small>
                  <small>Use Voice, Transcript Edit, or Mouth Sync action.</small>
                </button>
              ))}
              {semanticTargets.filter((t) => t.targetType === "face_person").map((item) => (
                <button key={item.id} style={selected?.id === item.id ? styles.selectedCard : styles.shotCard} onClick={() => selectItem(item, "face_person") }>
                  <b>{item.label}</b>
                  <small>Person/face identity target for voice, emotion, lip-sync.</small>
                </button>
              ))}
              {!audios.length && !semanticTargets.length ? <div style={styles.emptySmall}>Voice/person targets pending enrichment worker.</div> : null}
            </div>
          ) : null}

          {activeTab === "versions" ? (
            <div style={styles.stack}>
              <button style={styles.button} onClick={() => runAction("load_versions")}>Refresh Versions</button>
              <div style={styles.compactGrid}>
                {(versions?.versions || []).length ? versions.versions.map((version) => (
                  <div key={version.id} style={styles.shotCard}>
                    <b>{compactId(version.id)}</b>
                    <span>{version.status || "version"}</span>
                    <small>{version.change_summary || "Original / saved version"}</small>
                  </div>
                )) : <div style={styles.emptySmall}>No output versions yet. Saved blocked edit/provider runs are preserved until real provider output is supplied.</div>}
              </div>
            </div>
          ) : null}

          {activeTab === "export" ? (
            <div style={styles.stack}>
              <button style={styles.primary} disabled={actionDisabled} onClick={() => runAction("export_final")}>Save Stitch + Export Request</button>
              <div style={styles.textPanel}>Export must create a real render job/output or a truthful blocked render state. The original source remains untouched.</div>
            </div>
          ) : null}

          {activeTab === "technical" ? (
            <details open style={styles.details}>
              <summary>Technical Details</summary>
              <button style={styles.button} onClick={() => setShowTech(!showTech)}>{showTech ? "Hide JSON" : "Show JSON"}</button>
              {showTech ? <textarea readOnly style={styles.tech} value={JSON.stringify({ analysis, intelligence, editorId, selected, lastResult, versions }, null, 2)} /> : null}
            </details>
          ) : null}
        </>
      ) : null}
    </section>
  );

  return createPortal(body, host);
}

const styles = {
  shell: { position: "fixed", left: 320, right: 12, bottom: 12, zIndex: 90, maxHeight: "52dvh", overflow: "auto", padding: 10, borderRadius: 16, border: "1px solid rgba(148,163,184,0.22)", background: "rgba(8,13,24,0.97)", color: "#f8fafc", boxShadow: "0 24px 80px rgba(0,0,0,.42)", backdropFilter: "blur(12px)", display: "grid", gap: 8 },
  topbar: { display: "grid", gridTemplateColumns: "auto minmax(160px,1fr) auto repeat(5, auto) auto", gap: 6, alignItems: "center" },
  title: { whiteSpace: "nowrap" },
  input: { minHeight: 30, borderRadius: 9, background: "#020617", color: "#f8fafc", border: "1px solid rgba(148,163,184,.25)", padding: "0 9px" },
  primary: { minHeight: 30, borderRadius: 9, background: "#2563eb", color: "#fff", border: "1px solid rgba(96,165,250,.45)", padding: "0 10px", cursor: "pointer" },
  button: { minHeight: 30, borderRadius: 9, background: "#1e293b", color: "#fff", border: "1px solid rgba(148,163,184,.25)", padding: "0 10px", cursor: "pointer" },
  chip: { display: "grid", placeItems: "center", minWidth: 34, minHeight: 28, borderRadius: 9, background: "rgba(15,23,42,.9)", border: "1px solid rgba(148,163,184,.18)", fontSize: 12 },
  status: { color: "#cbd5e1", fontSize: 12 },
  error: { color: "#fecaca", fontSize: 12 },
  workGrid: { display: "grid", gridTemplateColumns: "240px minmax(0,1fr)", gap: 8 },
  previewBox: { minHeight: 126, borderRadius: 12, overflow: "hidden", background: "#020617", border: "1px solid rgba(148,163,184,.18)" },
  video: { width: "100%", height: 132, objectFit: "contain", background: "#020617" },
  empty: { height: 132, display: "grid", placeItems: "center", color: "#94a3b8", fontSize: 12 },
  editorBox: { display: "grid", gap: 6 },
  selectedLine: { color: "#cbd5e1", fontSize: 12 },
  editInput: { width: "100%", minHeight: 56, resize: "vertical", borderRadius: 10, border: "1px solid rgba(148,163,184,.25)", background: "#020617", color: "#f8fafc", padding: 8 },
  actionRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  resultLine: { fontSize: 12, color: "#bfdbfe" },
  tabs: { display: "flex", gap: 6, overflowX: "auto" },
  tab: { minHeight: 29, borderRadius: 9, background: "#0f172a", color: "#cbd5e1", border: "1px solid rgba(148,163,184,.18)", padding: "0 10px", cursor: "pointer", textTransform: "capitalize" },
  activeTab: { minHeight: 29, borderRadius: 9, background: "#2563eb", color: "#fff", border: "1px solid rgba(96,165,250,.45)", padding: "0 10px", cursor: "pointer", textTransform: "capitalize" },
  compactGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 6 },
  shotCard: { display: "grid", gap: 3, textAlign: "left", padding: 8, borderRadius: 10, border: "1px solid rgba(96,165,250,.22)", background: "#020617", color: "#f8fafc", cursor: "pointer", fontSize: 12, minHeight: 76 },
  selectedCard: { display: "grid", gap: 3, textAlign: "left", padding: 8, borderRadius: 10, border: "1px solid rgba(96,165,250,.75)", background: "rgba(37,99,235,.18)", color: "#f8fafc", cursor: "pointer", fontSize: 12, minHeight: 76 },
  frameStrip: { display: "flex", gap: 6, overflowX: "auto" },
  frameButton: { width: 104, flex: "0 0 auto", display: "grid", gap: 4, padding: 4, borderRadius: 9, background: "#020617", color: "#f8fafc", border: "1px solid rgba(96,165,250,.22)", cursor: "pointer" },
  selectedFrameButton: { width: 104, flex: "0 0 auto", display: "grid", gap: 4, padding: 4, borderRadius: 9, background: "rgba(37,99,235,.18)", color: "#f8fafc", border: "1px solid rgba(96,165,250,.75)", cursor: "pointer" },
  frameImage: { width: "100%", height: 56, objectFit: "cover", borderRadius: 7 },
  stack: { display: "grid", gap: 6 },
  audioRow: { display: "grid", gridTemplateColumns: "74px 130px minmax(0,1fr)", gap: 6, alignItems: "center" },
  audio: { width: "100%" },
  smallLabel: { color: "#cbd5e1", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  textPanel: { maxHeight: 105, overflow: "auto", whiteSpace: "pre-wrap", fontSize: 12, color: "#cbd5e1", padding: 8, borderRadius: 10, background: "#020617", border: "1px solid rgba(148,163,184,.18)" },
  emptySmall: { color: "#94a3b8", fontSize: 12, padding: 8 },
  details: { color: "#cbd5e1", fontSize: 12 },
  tech: { width: "100%", minHeight: 140, marginTop: 6, borderRadius: 10, background: "#020617", color: "#f8fafc", border: "1px solid rgba(148,163,184,.22)", padding: 8, fontSize: 11 },
};
