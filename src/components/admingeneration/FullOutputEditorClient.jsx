"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./FullOutputEditorClient.module.css";

const DEFAULT_PROJECT_ID = "fb7bf446-78c9-4905-80bc-32a19d0f9803";

const QA_ITEMS = [
  "Identity",
  "Hands",
  "Mouth Sync",
  "Audio Sync",
  "Flicker",
  "Continuity",
  "Camera Motion",
  "Provider Run",
  "Version Safe",
  "Export Ready",
];

const TOOL_ACTIONS = [
  { label: "VIDEO GENERATION", action: "regenerate_segment", sub: "Selected segment", tool: "AI Tools" },
  { label: "FRAME → VIDEO", action: "frame_to_video", sub: "Rebuild from frame", tool: "AI Tools" },
  { label: "UPSCALE / RESTORE", action: "restore_upscale_stabilize", sub: "Restore segment", tool: "Filters" },
  { label: "AUDIO SEPARATION", action: "audio_separation", sub: "Voice / music / ambient", tool: "Audio" },
  { label: "TRANSCRIPTION", action: "transcription", sub: "Word timestamps", tool: "Text" },
  { label: "LIP SYNC", action: "mouth_sync", sub: "Mouth alignment", tool: "People" },
  { label: "COLOR GRADE", action: "color_grade", sub: "LUT / HDR", tool: "Filters" },
];

function waveformBars(seed = 1) {
  return Array.from({ length: 22 }, (_, index) => ((index * 17 + seed * 13) % 31) + 18);
}


const GUIDE_STEPS = [
  {
    title: "1. Load or analyze a video",
    body: "Start by loading an analysis ID or opening a video already processed by the analyzer. The editor uses saved intelligence instead of re-analyzing every edit.",
    target: "Source / Reference",
  },
  {
    title: "2. Pick the exact part to fix",
    body: "Click a scene, shot, frame, subject box, object box, transcript block, motion block, audio block, or caption block.",
    target: "Scenes / Preview / Timeline",
  },
  {
    title: "3. Type the requested change",
    body: "Use plain language: fix the hand, change the line, replace the voice, clean background, regenerate only this segment.",
    target: "Selected Edit",
  },
  {
    title: "4. Run the right action",
    body: "Use Motion, Voice, Transcript, Lip Sync, Restore, Regenerate Segment, or Export. Every action creates or requests a new version. The original is not overwritten.",
    target: "Tool Strip / Inspector",
  },
  {
    title: "5. Check QA and export",
    body: "Use QA to check identity, hands, mouth sync, audio sync, flicker, continuity, and provider status before final export.",
    target: "QA / Status",
  },
];


const LAYERS = [
  { id: "motion", label: "MOTION / ACTION LAYER", sub: "Movement & Actions", color: "green", samples: ["Walking forward", "Looks around", "Turns left", "Walks forward", "People pass by", "Crosses street"] },
  { id: "dialogue", label: "TRANSCRIPT / DIALOGUE LAYER", sub: "Spoken Words / Dialogue", color: "blue", samples: ["Reed walks down the street.", "He looks around.", "Reed turns left.", "People are walking.", "Cars passing by."] },
  { id: "translation", label: "TRANSLATION LAYER", sub: "Translation", color: "purple", samples: ["Reed camina por la calle.", "Él mira alrededor.", "Reed gira a la izquierda.", "La gente está caminando.", "Autos pasando."] },
  { id: "lipsync", label: "LIP-SYNC LAYER", sub: "Mouth & Lip Movements", color: "pink", samples: ["Neutral", "Slight open", "Speaking", "Speaking", "Closed", "Speaking"] },
  { id: "voice", label: "AUDIO / DIALOGUE LAYER", sub: "Dialogue & Voice", color: "teal", samples: ["Footsteps", "Breathing", "Reed: This place is amazing.", "Ambient city noise", "Car passing"] },
  { id: "music", label: "AUDIO / MUSIC LAYER", sub: "Music & Background Score", color: "greenWave", samples: ["Background music - City Vibes", "Music builds up", "Soft transition"] },
  { id: "effects", label: "AUDIO / EFFECTS LAYER", sub: "SFX & Ambient Sounds", color: "orange", samples: ["Street ambience", "Car horn", "Footsteps", "Wind ambience", "City atmosphere"] },
  { id: "subtitle", label: "SUBTITLE LAYER", sub: "On-Screen Subtitles", color: "gold", samples: ["Reed walks down the street", "He looks around", "Reed turns left", "People are walking", "Cars passing by"] },
];

function sec(value) {
  const n = Number(value || 0);
  const m = Math.floor(n / 60);
  const s = Math.floor(n % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function shortId(value) {
  const v = String(value || "");
  return v.length > 14 ? `${v.slice(0, 8)}…${v.slice(-4)}` : v;
}

function assetKind(asset) {
  return String(asset.assetKind || asset.asset_kind || asset.kind || "");
}

function assetUrl(asset) {
  return asset.assetUrl || asset.asset_url || asset.url || "";
}

function normalizeAsset(asset, index) {
  return {
    id: asset.id || asset.assetId || assetUrl(asset) || `asset-${index}`,
    kind: assetKind(asset),
    url: assetUrl(asset),
    metadata: asset.metadata || {},
  };
}

function normalizeSegment(segment, index) {
  const startSec = Number(segment.startSec ?? segment.start_sec ?? index * 5);
  const endSec = Number(segment.endSec ?? segment.end_sec ?? startSec + 5);
  return {
    id: segment.id || segment.segmentId || `segment-${index}`,
    label: segment.label || segment.metadata?.sceneTitle || `Scene ${String(index + 1).padStart(2, "0")}`,
    startSec,
    endSec,
    metadata: segment.metadata || {},
  };
}

async function readJson(path, init) {
  const res = await fetch(path, { cache: "no-store", ...(init || {}) });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || `${path} failed (${res.status})`);
  }
  return data;
}

async function postJson(path, body) {
  return readJson(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getInitialAnalysisId() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("analysisId") || window.localStorage.getItem("streams:lastAnalysisId") || "";
}

export default function FullOutputEditorClient() {
  const videoRef = useRef(null);
  const [loadValue, setLoadValue] = useState("");
  const [analysisId, setAnalysisId] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [intelligence, setIntelligence] = useState(null);
  const [editorId, setEditorId] = useState("");
  const [timeline, setTimeline] = useState(null);
  const [versions, setVersions] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [editingBlockId, setEditingBlockId] = useState("");
  const [inlineEditValue, setInlineEditValue] = useState("");
  const [localBlockLabels, setLocalBlockLabels] = useState({});
  const [compareMode, setCompareMode] = useState("after");
  const [providerStatus, setProviderStatus] = useState("No provider run yet");
  const [editInstruction, setEditInstruction] = useState("");
  const [activeTopTab, setActiveTopTab] = useState("SUBJECTS");
  const [activeTool, setActiveTool] = useState("Select");
  const [status, setStatus] = useState("Load an analysis to open the full output editor.");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  const assets = useMemo(() => {
    const raw = intelligence?.assets || intelligence?.intelligence?.assets || [];
    return raw.map(normalizeAsset);
  }, [intelligence]);

  const segments = useMemo(() => {
    const raw = timeline?.timeline?.segments || timeline?.segments || intelligence?.segments || intelligence?.intelligence?.segments || [];
    return raw.map(normalizeSegment);
  }, [timeline, intelligence]);

  const frames = useMemo(() => assets.filter((asset) => asset.kind.includes("frame")), [assets]);
  const audios = useMemo(() => assets.filter((asset) => asset.kind.includes("audio") || asset.kind.includes("voice")), [assets]);
  const videoAsset = useMemo(() => assets.find((asset) => asset.kind.includes("source_video") && asset.url) || assets.find((asset) => asset.kind.includes("video") && asset.url), [assets]);
  const sourceUrl = videoAsset?.url || analysis?.sourceUrl || analysis?.source_url || "";
  const duration = Math.max(segments[segments.length - 1]?.endSec || 30, 30);

  const scenes = useMemo(() => {
    const fallback = Array.from({ length: 5 }, (_, index) => normalizeSegment({}, index));
    return (segments.length ? segments : fallback).slice(0, 8);
  }, [segments, localBlockLabels]);

  const layers = useMemo(() => {
    return LAYERS.map((layer) => ({
      ...layer,
      blocks: layer.samples.map((sample, index) => {
        const segment = segments[index] || normalizeSegment({ label: sample, startSec: index * 5, endSec: (index + 1) * 5 }, index);
        return {
          id: `${layer.id}-${segment.id}-${index}`,
          layer: layer.id,
          targetType: layer.id,
          color: layer.color,
          label: localBlockLabels[`${layer.id}-${segment.id}-${index}`] || sample,
          originalLabel: sample,
          startSec: segment.startSec,
          endSec: segment.endSec,
          segmentId: segment.id,
        };
      }),
    }));
  }, [segments, localBlockLabels]);

  useEffect(() => {
    const id = getInitialAnalysisId();
    setLoadValue(id);
    if (id) loadAnalysis(id);
  }, []);


  useEffect(() => {
    if (typeof window === "undefined") return;
    const complete = window.localStorage.getItem("streams:full-editor-guide-complete");
    if (!complete) setGuideOpen(true);
  }, []);

  function closeGuide() {
    setGuideOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("streams:full-editor-guide-complete", "1");
    }
  }

  function resetGuide() {
    setGuideStep(0);
    setGuideOpen(true);
  }

  const currentGuideStep = GUIDE_STEPS[guideStep] || GUIDE_STEPS[0];
  const selectedTargetLabel = selectedTarget
    ? `${selectedTarget.targetType || selectedTarget.layer || "target"} · ${selectedTarget.label || selectedTarget.id || "selected"} · ${sec(selectedTarget.startSec || 0)}-${sec(selectedTarget.endSec || selectedTarget.startSec || 0)}`
    : "No target selected yet";

  const selectedKind = String(selectedTarget?.targetType || selectedTarget?.layer || activeTool || "none").toLowerCase();
  const isTranscriptTarget = ["dialogue", "translation", "subtitle", "text"].some((key) => selectedKind.includes(key));
  const isAudioTarget = ["voice", "music", "effects", "audio", "ambience"].some((key) => selectedKind.includes(key));
  const isMotionTarget = ["motion", "body", "lipsync"].some((key) => selectedKind.includes(key));
  const isObjectTarget = ["object", "background"].some((key) => selectedKind.includes(key));
  const selectedWords = String(selectedTarget?.label || "Select a transcript block to show word timestamps").split(/\s+/).filter(Boolean).slice(0, 14);

  async function versionAction(action, version) {
    if (!editorId && action !== "compare") {
      setError("Load an editor project first.");
      return;
    }

    if (action === "compare") {
      setCompareMode((current) => current === "before" ? "after" : "before");
      setStatus("Compare mode toggled. Original remains preserved.");
      return;
    }

    setBusy(true);
    setError("");
    setStatus(`Running version action: ${action}…`);

    try {
      const result = await postJson(`/api/admingeneration/editor/projects/${editorId}/version-actions`, {
        action,
        versionId: version?.id || null,
        selectedTarget,
        source: "full-output-editor",
      });
      await loadVersions(editorId).catch(() => null);
      setProviderStatus(result?.status || `version_${action}`);
      setStatus(result?.status ? String(result.status) : `Version action saved: ${action}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(`Version action failed: ${action}. Original media was not overwritten.`);
      setProviderStatus("blocked/error");
    } finally {
      setBusy(false);
    }
  }


  function selectTarget(target) {
    setSelectedTarget(target);
    setEditInstruction(target?.label || "");
    if (videoRef.current && Number.isFinite(Number(target?.startSec))) {
      videoRef.current.currentTime = Number(target.startSec);
    }
  }

  async function loadVersions(nextEditorId = editorId) {
    if (!nextEditorId) return;
    const data = await readJson(`/api/admingeneration/editor/projects/${nextEditorId}/versions`);
    setVersions(data.versions || data.items || []);
  }

  async function loadAnalysis(id = loadValue) {
    const nextId = String(id || "").trim();
    if (!nextId) return;

    setBusy(true);
    setError("");
    setStatus("Loading analysis intelligence…");

    try {
      const intel = await readJson(`/api/admingeneration/reference/analyze/${nextId}/intelligence`);
      setAnalysisId(nextId);
      setLoadValue(nextId);
      setAnalysis(intel.analysis || null);
      setIntelligence(intel.intelligence || intel);
      window.localStorage.setItem("streams:lastAnalysisId", nextId);

      const editor = await postJson("/api/admingeneration/editor/from-analysis", {
        analysisId: nextId,
        projectId: DEFAULT_PROJECT_ID,
      });

      const nextEditorId = editor.editorProject?.id || editor.project?.id || editor.editorProjectId || "";
      setEditorId(nextEditorId);

      if (nextEditorId) {
        const tl = await readJson(`/api/admingeneration/editor/projects/${nextEditorId}/timeline`);
        setTimeline(tl);
        await loadVersions(nextEditorId);
      }

      setStatus("Output editor loaded. Click any scene, subject, object, audio, transcript, or timeline block.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("Failed to load output editor.");
    } finally {
      setBusy(false);
    }
  }


  function startInlineEdit(block) {
    selectTarget(block);
    setEditingBlockId(block.id);
    setInlineEditValue(block.label || "");
    setEditInstruction(block.label || "");
  }

  function cancelInlineEdit() {
    setEditingBlockId("");
    setInlineEditValue("");
  }

  async function saveInlineEdit(block) {
    const nextText = inlineEditValue.trim();
    if (!nextText) {
      setError("Inline edit cannot be empty.");
      return;
    }

    setSelectedTarget(block);
    setEditInstruction(nextText);
    setLocalBlockLabels((current) => ({ ...current, [block.id]: nextText }));

    const isTranscriptLike =
      block.layer === "dialogue" ||
      block.layer === "translation" ||
      block.layer === "subtitle" ||
      block.targetType === "dialogue" ||
      block.targetType === "translation" ||
      block.targetType === "subtitle";

    setBusy(true);
    setError("");
    setStatus(isTranscriptLike ? "Saving transcript/timeline text edit…" : "Saving selected block edit…");

    try {
      let result;

      if (isTranscriptLike) {
        result = await postJson(`/api/admingeneration/editor/projects/${editorId}/transcript-edits`, {
          editedText: nextText,
          originalText: block.originalLabel || block.label || "",
          segmentId: block.segmentId || block.id || null,
          startSec: block.startSec ?? null,
          endSec: block.endSec ?? null,
          metadata: {
            selectedTarget: block,
            analysisId,
            source: "inline-timeline-editor",
          },
        });
      } else {
        result = await postJson(`/api/admingeneration/editor/projects/${editorId}/execute-edit`, {
          instruction: nextText,
          action: block.layer === "motion" ? "motion_edit" : block.layer === "voice" ? "voice_edit" : block.layer === "lipsync" ? "mouth_sync" : "segment_edit",
          targetType: block.targetType || block.layer || "segment",
          targetId: block.segmentId || block.id || null,
          selected: block,
          analysisId,
          semanticFullEditor: true,
          source: "inline-timeline-editor",
        });
      }

      await loadVersions(editorId).catch(() => null);
      const resultStatus = result?.status || result?.providerRun?.status || result?.edit?.status || "saved";
      setProviderStatus(result?.providerRun?.status || result?.status || "saved");
      setStatus(String(resultStatus).includes("blocked") ? `Blocked: ${String(resultStatus).replaceAll("_", " ")}` : `Saved: ${String(resultStatus).replaceAll("_", " ")}`);
      setEditingBlockId("");
      setInlineEditValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("Inline edit failed. Original media was not overwritten.");
    } finally {
      setBusy(false);
    }
  }


  async function regenerateEntireVideo() {
    if (!editorId || !analysisId) {
      setError("Load an analyzed editor project first.");
      return;
    }

    setBusy(true);
    setError("");
    setStatus("Creating full-video regeneration job. Original video will remain unchanged.");

    try {
      const result = await postJson(`/api/admingeneration/editor/projects/${editorId}/execute-edit`, {
        instruction:
          editInstruction ||
          "Regenerate the entire video as a new full version using the saved analysis, timeline, subject profiles, transcript, audio, motion, and reference frames.",
        action: "regenerate_entire_video",
        targetType: "full_video",
        targetId: analysisId,
        selected: null,
        analysisId,
        fullVideoRegeneration: true,
        preserveOriginal: true,
        semanticFullEditor: true,
        source: "full-output-editor-explicit-full-regenerate",
      });

      await loadVersions(editorId).catch(() => null);

      const resultStatus = result?.status || result?.providerRun?.status || result?.edit?.status || "saved";
      setStatus(
        String(resultStatus).includes("blocked")
          ? `Blocked: ${String(resultStatus).replaceAll("_", " ")}`
          : `Full video regeneration saved as a new version request: ${String(resultStatus).replaceAll("_", " ")}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("Full video regeneration failed. Original media was not overwritten.");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action) {
    if (!editorId) {
      setError("Load an analysis/editor project first.");
      return;
    }

    if (!selectedTarget && !["export_final", "load_versions", "qa_status"].includes(action)) {
      setError("Select a scene, subject, object, audio, transcript, or timeline block first.");
      return;
    }

    setBusy(true);
    setError("");
    setStatus(`Running ${action.replaceAll("_", " ")}…`);

    try {
      let result;

      if (action === "transcript_edit") {
        result = await postJson(`/api/admingeneration/editor/projects/${editorId}/transcript-edits`, {
          editedText: editInstruction,
          originalText: selectedTarget?.label || "",
          segmentId: selectedTarget?.segmentId || selectedTarget?.id || null,
          startSec: selectedTarget?.startSec ?? null,
          endSec: selectedTarget?.endSec ?? null,
          metadata: { selectedTarget, analysisId },
        });
      } else if (action === "export_final") {
        result = await postJson(`/api/admingeneration/editor/projects/${editorId}/export-final`, {
          exportType: "mp4",
          settings: { selectedTarget, source: "full-output-editor" },
        });
      } else if (action === "load_versions") {
        await loadVersions(editorId);
        result = { status: "versions_loaded" };
      } else if (action === "qa_status") {
        result = await readJson(`/api/admingeneration/editor/projects/${editorId}/qc`);
      } else {
        result = await postJson(`/api/admingeneration/editor/projects/${editorId}/execute-edit`, {
          instruction: editInstruction || `Run ${action.replaceAll("_", " ")}`,
          action,
          targetType: selectedTarget?.targetType || selectedTarget?.layer || "segment",
          targetId: selectedTarget?.id || selectedTarget?.segmentId || null,
          selected: selectedTarget,
          analysisId,
          semanticFullEditor: true,
        });
      }

      await loadVersions(editorId).catch(() => null);
      const resultStatus = result?.status || result?.providerRun?.status || result?.edit?.status || "saved";
      setProviderStatus(result?.providerRun?.status || result?.status || result?.export?.status || "saved");
      setStatus(String(resultStatus).includes("blocked") ? `Blocked: ${String(resultStatus).replaceAll("_", " ")}` : `Saved: ${String(resultStatus).replaceAll("_", " ")}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("Action failed. Original media was not overwritten.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.editorShell}>
      <header className={styles.topBar}>
        <div className={styles.brand}><span className={styles.logoMark}>◆</span><div><strong>STREAMS</strong><small>AI VIDEO CONTROL ROOM</small></div></div>
        <nav className={styles.topNav}>{["PROJECTS", "GENERATE", "EDIT", "PIPELINE", "ASSETS", "EXPORT", "ANALYTICS", "SETTINGS"].map((item) => <button key={item} className={item === "EDIT" ? styles.activeNav : ""}>{item}</button>)}</nav>
        <div className={styles.systemOnline}><span /> SYSTEM ONLINE</div>
      </header>

      <section className={styles.workspace}>
        <aside className={styles.leftRail}>
          <div className={styles.panelTitle}><strong>SCENES / SHOTS</strong><button type="button">＋</button></div>
          <input className={styles.search} placeholder="Search scenes…" />
          <div className={styles.sceneList}>{scenes.map((scene, index) => <button key={scene.id} type="button" onClick={() => selectTarget({ ...scene, targetType: "scene" })} className={selectedTarget?.id === scene.id ? styles.selectedScene : ""}><div className={styles.thumb}>{frames[index]?.url ? <img src={frames[index].url} alt="" /> : null}</div><span>{String(index + 1).padStart(2, "0")}</span><strong>{scene.label}</strong><small>{sec(scene.startSec)} - {sec(scene.endSec)}</small></button>)}</div>

          <div className={styles.versions}><div><strong>VERSIONS</strong><button type="button" onClick={() => runAction("load_versions")}>Refresh</button></div>{(versions.length ? versions : [{ id: "v-current", status: "source", change_summary: "Immutable source version created from reference analysis." }]).slice(0, 5).map((version, index) => <article key={version.id || index} className={styles.versionCard}><button type="button" onClick={() => versionAction("compare", version)}><span>V{versions.length - index || 1}</span><strong>{version.status || "Version"}</strong><small>{version.change_summary || version.summary || "Saved state"}</small></button><div><button type="button" onClick={() => versionAction("compare", version)}>Compare</button><button type="button" onClick={() => versionAction("approve", version)}>Approve</button><button type="button" onClick={() => versionAction("revert", version)}>Revert</button><button type="button" onClick={() => versionAction("branch", version)}>Branch</button></div></article>)}</div>

          <div className={styles.sourceBox}><strong>SOURCE / REFERENCE</strong><input value={loadValue} onChange={(e) => setLoadValue(e.target.value)} placeholder="Paste analysisId" /><button type="button" onClick={() => loadAnalysis(loadValue)} disabled={busy}>{busy ? "Loading…" : "Load Analysis"}</button><small>{analysisId ? `Analysis ${shortId(analysisId)}` : "No analysis loaded"}</small></div>
        </aside>

        <section className={styles.centerStage}>
          <div className={styles.projectRow}><span>PROJECT:</span><strong>The City Walk</strong><button type="button" className={styles.statusPill}>FINISHED</button><span>RAW 4K</span><span>24 FPS</span><span>PRORES 422</span><button type="button" className={styles.guideButton} onClick={resetGuide}>Guide</button></div>

          <div className={styles.viewerWrap}>
            {sourceUrl ? <video ref={videoRef} src={sourceUrl} controls playsInline className={styles.viewerVideo} /> : <div className={styles.viewerEmpty}>Load analysis to preview source video</div>}
            <div className={styles.compareBadge}>{compareMode === "before" ? "BEFORE / ORIGINAL" : "AFTER / CURRENT VERSION"}</div>
            <div className={styles.analysisCard}><strong>AI ANALYSIS</strong>{[["Faces Detected", "2 OK"], ["Body Tracking", "OK"], ["Motion Vectors", "OK"], ["Depth Map", "OK"], ["Scene Segmentation", segments.length ? "OK" : "pending"], ["Audio Quality", audios.length ? "OK" : "pending"], ["Stability", "93%"]].map(([a, b]) => <p key={a}><span>{a}</span><b>{b}</b></p>)}<button type="button" onClick={() => runAction("qa_status")}>View Full Analysis</button></div>
            <button type="button" className={styles.subjectBox} onClick={() => selectTarget({ id: "subject-1", targetType: "subject_person", label: "Subject 1 (Man)", startSec: 0, endSec: duration })}>Subject 1 (Man)</button>
            <button type="button" className={styles.carBox} onClick={() => selectTarget({ id: "object-car-1", targetType: "object_background", label: "Car 01", startSec: 0, endSec: duration })}>Car 01</button>
          </div>

          <div className={styles.playbar}><span>00:00:02:17</span><button type="button">◀</button><button type="button">▶</button><button type="button">▶▶</button><span>{sec(duration)}</span></div>

          <div className={styles.selectedActionBar}>
            <div>
              <span>SELECTED TARGET</span>
              <strong>{selectedTargetLabel}</strong>
            </div>
            <textarea value={editInstruction} onChange={(e) => setEditInstruction(e.target.value)} placeholder="Selected Target Edit only. Example: make this hand movement smoother, replace this line, change this voice, clean this background…" />
            <div>
              <button type="button" onClick={() => runAction("segment_edit")} disabled={busy || !selectedTarget}>Save Edit</button>
              <button type="button" onClick={() => runAction("regenerate_segment")} disabled={busy || !selectedTarget}>Regenerate Selected Segment</button>
              <button type="button" onClick={() => runAction("replace_clip")} disabled={busy || !selectedTarget}>Replace Clip</button>
              <button type="button" onClick={() => runAction("voice_edit")} disabled={busy || !selectedTarget}>Edit Voice</button>
              <button type="button" onClick={() => runAction("motion_edit")} disabled={busy || !selectedTarget}>Edit Motion</button>
              <button type="button" onClick={() => runAction("transcript_edit")} disabled={busy || !selectedTarget}>Edit Transcript</button>
              <button type="button" onClick={() => runAction("mouth_sync")} disabled={busy || !selectedTarget}>Fix Lip Sync</button>
              <button type="button" onClick={() => runAction("restore_upscale_stabilize")} disabled={busy || !selectedTarget}>Restore / Upscale Segment</button>
              <button type="button" onClick={() => runAction("object_background_cleanup")} disabled={busy || !selectedTarget}>Clean Object / Background</button>
              <button type="button" onClick={() => runAction("qa_status")} disabled={busy || !editorId}>QA / Status</button>
            </div>
          </div>

          <div className={styles.timeline}>{layers.map((layer, layerIndex) => <div key={layer.id} className={styles.layerRow}><div className={styles.layerLabel}><strong>{layer.label}</strong><small>{layer.sub}</small></div><div className={styles.layerBlocks}>{layer.blocks.map((block, blockIndex) => editingBlockId === block.id ? (
            <div key={block.id} className={`${styles.blockEditor} ${styles[block.color]}`}>
              <input
                value={inlineEditValue}
                onChange={(e) => setInlineEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveInlineEdit(block);
                  if (e.key === "Escape") cancelInlineEdit();
                }}
                autoFocus
              />
              <button type="button" onClick={() => saveInlineEdit(block)} disabled={busy}>Save</button>
              <button type="button" onClick={cancelInlineEdit}>Cancel</button>
            </div>
          ) : (
            <button
              type="button"
              key={block.id}
              className={`${styles.block} ${styles[block.color]} ${selectedTarget?.id === block.id ? styles.activeBlock : ""} ${["music", "effects", "voice"].includes(layer.id) ? styles.waveBlock : ""}`}
              onClick={() => selectTarget(block)}
              onDoubleClick={() => startInlineEdit(block)}
              title="Click to select. Double-click to edit this block."
            >
              {["music", "effects", "voice"].includes(layer.id) ? <i>{waveformBars(layerIndex + blockIndex).map((height, i) => <em key={i} style={{ height: `${height}%` }} />)}</i> : null}
              <span>{block.label}</span>
            </button>
          ))}</div></div>)}</div>

          <div className={styles.toolStrip}>{TOOL_ACTIONS.map((tool) => <button type="button" key={tool.action} className={activeTool === tool.tool ? styles.activeToolAction : ""} onClick={() => { setActiveTool(tool.tool); runAction(tool.action); }} disabled={busy}>{tool.label}<small>{tool.sub}</small></button>)}</div>
        </section>

        <aside className={styles.rightRail}>
          <div className={styles.rightTabs}>{["SUBJECTS", "SCENE", "AUDIO", "MOTION", "OUTPUT"].map((tab) => <button type="button" key={tab} className={activeTopTab === tab ? styles.activeTab : ""} onClick={() => setActiveTopTab(tab)}>{tab}</button>)}</div>

          <div className={styles.inspectorCard}><select><option>{selectedTarget?.label || "Subject 1 (Man)"}</option></select><div className={styles.miniTabs}>{["IDENTITY", "FACE", "BODY", "CLOTHING", "TRACKING"].map((tab) => <button type="button" key={tab}>{tab}</button>)}</div>{isTranscriptTarget ? (
            <div className={styles.transcriptPanel}><strong>TRANSCRIPT / WORD TIMESTAMPS</strong><p>Selected text: {selectedTarget?.label || "Select a dialogue, subtitle, or timeline block."}</p><label>Speaker<select><option>Speaker 1</option><option>Speaker 2</option></select></label><div>{selectedWords.map((word, index) => <button type="button" key={`${word}-${index}`} onClick={() => setEditInstruction(word)}>{word}<small>{sec((selectedTarget?.startSec || 0) + index * 0.35)}</small></button>)}</div><button type="button" onClick={() => runAction("transcript_edit")}>Save Transcript Line</button></div>
          ) : isAudioTarget ? (
            <div className={styles.transcriptPanel}><strong>AUDIO TARGET</strong><p>Layer: {selectedTarget?.layer || activeTool}</p><label>Track Type<select><option>Voice</option><option>Music</option><option>Ambient</option><option>SFX</option></select></label><button type="button" onClick={() => runAction("audio_separation")}>Separate Voice / Music / Ambient</button><button type="button" onClick={() => runAction("voice_edit")}>Edit Voice</button><button type="button" onClick={() => runAction("mouth_sync")}>Lip Sync</button></div>
          ) : isObjectTarget ? (
            <div className={styles.transcriptPanel}><strong>OBJECT / BACKGROUND TARGET</strong><p>{selectedTarget?.label || "Object/background selection"}</p><button type="button" onClick={() => runAction("object_background_cleanup")}>Clean Object / Background</button><button type="button" onClick={() => runAction("restore_upscale_stabilize")}>Restore Segment</button></div>
          ) : (
            <div className={styles.formGrid}><label>Gender<select><option>Male</option></select></label><label>Top<select><option>Jacket</option></select></label><label>Age<input value="30" readOnly /></label><label>Bottom<select><option>Jeans</option></select></label><label>Race<select><option>Caucasian</option></select></label><label>Shoes<select><option>Sneakers</option></select></label></div>
          )}<div className={styles.actionBox}><strong>{isMotionTarget ? "MOTION / BODY ACTIONS" : "ACTIONS / MOTION"}</strong><label>Current Action<select><option>{selectedTarget?.layer || "Walking"}</option></select></label><label>Direction<select><option>Turning Left</option></select></label><button type="button" onClick={() => runAction(isTranscriptTarget ? "transcript_edit" : "motion_edit")}>{isTranscriptTarget ? "Edit Transcript Line" : "Edit Motion / Action"}</button></div><div className={styles.actionBox}><strong>EXPRESSION / BODY</strong><label>Emotion<select><option>Neutral</option></select></label><button type="button" onClick={() => runAction("emotion_body_edit")}>Edit Facial Expression</button></div></div>

          <div className={styles.mixer}><strong>AUDIO MIXER</strong>{["Dialogue", "Music", "SFX", "Ambience"].map((item) => <p key={item}><span>{item}</span><i /><b>0.0 dB</b></p>)}</div>

          <div className={styles.sourcePreview}><strong>SOURCE / REFERENCE</strong>{frames[0]?.url ? <img src={frames[0].url} alt="source frame" /> : null}<p>Title: City Walk - Cinematic Reference</p><p>Resolution: 3840×2160</p><button type="button" onClick={() => loadAnalysis(analysisId)}>Re-analyze Source</button></div>

          <div className={styles.fullRegenerateCard}>
            <strong>FULL VIDEO REGENERATION</strong>
            <p>Regenerate Entire Video creates a new full version using the saved analysis, transcript, frames, subjects, motion, and audio intelligence. Original stays unchanged.</p>
            <button type="button" onClick={regenerateEntireVideo} disabled={busy || !editorId || !analysisId}>Regenerate Entire Video</button>
          </div>

          <div className={styles.exportCard}><strong>EXPORT</strong><select><option>4K (3840x2160)</option></select><button type="button" onClick={() => runAction("export_final")}>RENDER FINAL VIDEO</button></div>

          <div className={styles.editInstruction}><strong>Selected Edit</strong><textarea value={editInstruction} onChange={(e) => setEditInstruction(e.target.value)} placeholder="Type targeted edit instruction…" /><div><button type="button" onClick={() => runAction("segment_edit")}>Save Edit</button><button type="button" onClick={() => runAction("regenerate_segment")}>Regenerate Selected Segment</button><button type="button" onClick={() => runAction("transcript_edit")}>Transcript</button></div></div>

          <div className={styles.qaChecklist}>
            <strong>QA / STATUS CHECKLIST</strong>
            {QA_ITEMS.map((item) => <p key={item}><span>{item}</span><b>{item === "Provider Run" ? providerStatus : item === "Mouth Sync" && !audios.length ? "needs audio" : item === "Continuity" && !segments.length ? "needs segments" : item === "Export Ready" ? "check render" : item === "Version Safe" ? "non-destructive" : "ready"}</b></p>)}
            <button type="button" onClick={() => runAction("qa_status")} disabled={busy || !editorId}>Run QA / Status</button>
          </div>

          <div className={styles.statusBox}>{error ? <b>{error}</b> : <span>{status}</span>}<div className={styles.statusActions}><button type="button" onClick={() => runAction("qa_status")}>QA / Status</button><button type="button" onClick={() => runAction("load_versions")}>Versions</button><button type="button" onClick={() => runAction("export_final")}>Export</button></div></div>
        </aside>

        <aside className={styles.toolRail}>{["Select", "People", "Objects", "Background", "Text", "Audio", "Effects", "Transitions", "Filters", "AI Tools"].map((tool) => <button type="button" key={tool} className={activeTool === tool ? styles.activeTool : ""} onClick={() => { setActiveTool(tool); if (tool !== "Select") setSelectedTarget((current) => current || { id: `tool-${tool}`, targetType: tool.toLowerCase(), label: `${tool} tool target`, startSec: 0, endSec: duration }); }}>{tool}</button>)}</aside>
      </section>

      {guideOpen ? (
        <div className={styles.guideOverlay}>
          <section className={styles.guideCard}>
            <div className={styles.guideHeader}>
              <div>
                <span>FIRST-TIME GUIDE</span>
                <strong>{currentGuideStep.title}</strong>
              </div>
              <button type="button" onClick={closeGuide}>×</button>
            </div>
            <p>{currentGuideStep.body}</p>
            <div className={styles.guideTarget}>Look at: <b>{currentGuideStep.target}</b></div>
            <div className={styles.guideProgress}>
              {GUIDE_STEPS.map((step, index) => <button type="button" key={step.title} className={index === guideStep ? styles.activeGuideDot : ""} onClick={() => setGuideStep(index)}>{index + 1}</button>)}
            </div>
            <div className={styles.guideActions}>
              <button type="button" onClick={() => setGuideStep(Math.max(0, guideStep - 1))} disabled={guideStep === 0}>Back</button>
              {guideStep < GUIDE_STEPS.length - 1 ? (
                <button type="button" onClick={() => setGuideStep(guideStep + 1)}>Next</button>
              ) : (
                <button type="button" onClick={closeGuide}>Start Editing</button>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
