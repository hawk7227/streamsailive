"use client";

import { useMemo, useRef, useState } from "react";

const DEFAULT_PROJECT_ID = "fb7bf446-78c9-4905-80bc-32a19d0f9803";

function smallId(value) {
  if (!value) return "none";
  return String(value).slice(0, 8) + "…" + String(value).slice(-4);
}

function countAssets(intelligence, kind) {
  const assets = intelligence?.intelligence?.assets || [];
  if (!kind) return assets.length;
  return assets.filter((asset) => String(asset.asset_kind || "").includes(kind)).length;
}

export default function CompactAnalyzerVideoMode({ projectId = DEFAULT_PROJECT_ID }) {
  const fileRef = useRef(null);
  const [open, setOpen] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [url, setUrl] = useState("");
  const [loadAnalysisId, setLoadAnalysisId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Ready");
  const [error, setError] = useState("");

  const [analysis, setAnalysis] = useState(null);
  const [intelligence, setIntelligence] = useState(null);
  const [editor, setEditor] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [job, setJob] = useState(null);
  const [executionSummary, setExecutionSummary] = useState(null);
  const [generateSimilar, setGenerateSimilar] = useState(null);

  const analysisId = analysis?.id || analysis?.analysisId;
  const editorId = editor?.id || editor?.editorProject?.id;
  const jobId = job?.id || job?.job?.id;

  const sourceTitle =
    analysis?.blueprint?.summary?.title ||
    analysis?.title ||
    analysis?.sourceUrl ||
    "No source analyzed yet";

  const providerPrompt =
    analysis?.blueprint?.generation?.providerReadyPrompt ||
    analysis?.blueprint?.generation?.recreatePrompt ||
    "";

  const negativePrompt = analysis?.blueprint?.generation?.negativePrompt || "";

  const counts = useMemo(() => {
    const timelineCounts = timeline?.timeline?.counts || {};
    return {
      assets: countAssets(intelligence),
      frames: countAssets(intelligence, "frame"),
      audio: countAssets(intelligence, "audio"),
      timelineAssets: timelineCounts.assets || 0,
      segments:
        (timelineCounts.editorSegments || 0) +
        (timelineCounts.intelligenceSegments || 0) ||
        (intelligence?.intelligence?.segments || []).length,
    };
  }, [intelligence, timeline]);

  async function readJson(res, label) {
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.ok === false) {
      throw new Error(data?.error || `${label || "request"} failed (${res.status})`);
    }
    return data;
  }

  async function postJson(path, body) {
    return readJson(
      await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      path,
    );
  }

  async function refreshState(nextAnalysisId = analysisId, nextEditorId = editorId, nextJobId = jobId) {
    if (nextAnalysisId) {
      const intel = await readJson(
        await fetch(`/api/admingeneration/reference/analyze/${nextAnalysisId}/intelligence`, { cache: "no-store" }),
        "load intelligence",
      );
      setIntelligence(intel);
      if (intel.analysis) setAnalysis(intel.analysis);
    }

    if (nextEditorId) {
      const ed = await readJson(
        await fetch(`/api/admingeneration/editor/projects/${nextEditorId}`, { cache: "no-store" }),
        "load editor",
      );
      setEditor(ed.project || ed.editorProject || ed);

      const tl = await readJson(
        await fetch(`/api/admingeneration/editor/projects/${nextEditorId}/timeline`, { cache: "no-store" }),
        "load timeline",
      );
      setTimeline(tl);

      const summary = await readJson(
        await fetch(`/api/admingeneration/editor/projects/${nextEditorId}/version-actions`, { cache: "no-store" }),
        "load execution summary",
      );
      setExecutionSummary(summary);
    }

    if (nextAnalysisId && nextJobId) {
      const worker = await readJson(
        await fetch(`/api/admingeneration/reference/analyze/${nextAnalysisId}/worker-jobs/${nextJobId}`, {
          cache: "no-store",
        }),
        "load worker job",
      );
      setJob(worker.job || worker);
    }
  }

  async function createEditorAndJob(nextAnalysis) {
    const nextAnalysisId = nextAnalysis?.id || nextAnalysis?.analysisId;
    if (!nextAnalysisId) throw new Error("Missing analysisId.");

    const ed = await postJson("/api/admingeneration/editor/from-analysis", {
      analysisId: nextAnalysisId,
      projectId,
    });
    setEditor(ed.editorProject);

    const worker = await postJson(`/api/admingeneration/reference/analyze/${nextAnalysisId}/worker-jobs`, {
      requestedProfile: "admin_full",
    });
    setJob(worker.job);

    await refreshState(nextAnalysisId, ed.editorProject?.id, worker.job?.id);
  }

  
  async function loadExistingAnalysis() {
    if (!loadAnalysisId.trim()) return;
    setBusy(true);
    setError("");
    setMessage("Loading existing analysis…");

    try {
      const existingId = loadAnalysisId.trim();
      const intel = await readJson(
        await fetch(`/api/admingeneration/reference/analyze/${existingId}/intelligence`, { cache: "no-store" }),
        "load analysis",
      );

      setIntelligence(intel);
      if (intel.analysis) setAnalysis(intel.analysis);

      const ed = await postJson("/api/admingeneration/editor/from-analysis", {
        analysisId: existingId,
        projectId,
      });
      setEditor(ed.editorProject);

      await refreshState(existingId, ed.editorProject?.id, jobId);
      setMessage("Existing analysis loaded.");
      setEditMode(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMessage("Load analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  async function analyzeUrl() {
    if (!url.trim()) return;
    setBusy(true);
    setError("");
    setMessage("Analyzing source URL…");

    try {
      const isYoutube = /youtube\.com|youtu\.be/i.test(url);
      const data = await postJson("/api/admingeneration/reference/analyze", {
        sourceType: isYoutube ? "youtube" : "url",
        url: url.trim(),
        projectId,
      });

      const nextAnalysis = data.analysis || { id: data.analysisId, ...data };
      setAnalysis(nextAnalysis);
      setMessage("Creating editor project + worker job…");
      await createEditorAndJob(nextAnalysis);
      setMessage(isYoutube ? "Reference saved. YouTube requires downloader/worker for frames." : "Analyzer chain ready.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMessage("Analyze failed.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadAndAnalyze(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setError("");
    setMessage("Uploading + analyzing…");

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", projectId);
      form.append("requestedProfile", "admin_full");

      const data = await readJson(
        await fetch("/api/admingeneration/reference/upload-and-analyze", { method: "POST", body: form }),
        "upload and analyze",
      );

      const nextAnalysis = data.analysis || { id: data.analysisId, ...data };
      setAnalysis(nextAnalysis);
      setMessage("Creating editor project + worker job…");
      await createEditorAndJob(nextAnalysis);
      setMessage("Uploaded source ready. Worker can extract frames/audio.");
      setEditMode(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMessage("Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function applyToBuilder() {
    if (!providerPrompt) {
      setError("No provider-ready prompt available yet.");
      return;
    }

    try {
      await navigator.clipboard.writeText(providerPrompt);
      setMessage("Provider-ready prompt copied.");
    } catch {
      setMessage("Prompt ready. Open Technical Details to copy.");
    }
  }

  async function generateSimilarFromBlueprint() {
    if (!analysisId) return;
    setBusy(true);
    setError("");
    setMessage("Preparing Generate Similar payload…");

    try {
      const data = await postJson("/api/admingeneration/reference/generate-similar", { analysisId });
      setGenerateSimilar(data);
      setMessage("Generate Similar payload ready.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMessage("Generate Similar failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProviderEditRequest() {
    if (!editorId) return;
    setBusy(true);
    setError("");
    setMessage("Saving provider edit request…");

    try {
      await postJson(`/api/admingeneration/editor/projects/${editorId}/provider-runs`, {
        provider: "provider_router",
        action: "segment_edit",
        targetType: "project",
        prompt: providerPrompt,
        negativePrompt,
      });
      await refreshState();
      setMessage("Edit request saved as blocked until provider execution is wired.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveExportRequest() {
    if (!editorId) return;
    setBusy(true);
    setError("");
    setMessage("Saving stitch/export request…");

    try {
      await postJson(`/api/admingeneration/editor/projects/${editorId}/stitch-jobs`, {
        timelineSnapshot: timeline || {},
      });
      await postJson(`/api/admingeneration/editor/projects/${editorId}/exports`, {
        exportType: "mp4",
        settings: { source: "compact-analyzer" },
      });
      await refreshState();
      setMessage("Stitch/export request saved as blocked until render worker is wired.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button style={styles.closedButton} onClick={() => setOpen(true)}>
        Analyzer
      </button>
    );
  }

  return (
    <aside style={styles.panel}>
      <div style={styles.header}>
        <div>
          <div style={styles.kicker}>Standalone Analyzer</div>
          <strong>Reference + Video Mode</strong>
        </div>
        <button style={styles.iconButton} onClick={() => setOpen(false)} aria-label="Collapse analyzer">
          ×
        </button>
      </div>

      <div style={styles.tabs}>
        <button
          style={!editMode ? styles.activeTab : styles.tab}
          onClick={() => setEditMode(false)}
          disabled={busy}
        >
          Analyze
        </button>
        <button
          style={editMode ? styles.activeTab : styles.tab}
          onClick={() => setEditMode(true)}
          disabled={!analysisId || busy}
        >
          Video Edit Mode
        </button>
      </div>

      {!editMode ? (
        <>
          <label style={styles.label}>YouTube / direct URL</label>
          <div style={styles.row}>
            <input
              style={styles.input}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="Paste reference URL"
            />
            <button style={styles.primaryButton} disabled={busy || !url.trim()} onClick={analyzeUrl}>
              Analyze
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="video/*,audio/*,image/*,.pdf"
            style={{ display: "none" }}
            onChange={uploadAndAnalyze}
          />
          <button style={styles.secondaryButton} disabled={busy} onClick={() => fileRef.current?.click()}>
            Upload + Analyze
          </button>

          <label style={styles.label}>Load Existing Analysis ID</label>
          <div style={styles.row}>
            <input
              style={styles.input}
              value={loadAnalysisId}
              onChange={(event) => setLoadAnalysisId(event.target.value)}
              placeholder="Paste analysisId"
            />
            <button style={styles.secondaryButton} disabled={busy || !loadAnalysisId.trim()} onClick={loadExistingAnalysis}>
              Load
            </button>
          </div>

          {analysisId ? (
            <div style={styles.summaryBox}>
              <div style={styles.label}>Source</div>
              <div style={styles.titleLine}>{sourceTitle}</div>
              <div style={styles.countRow}>
                <span>Assets {counts.assets}</span>
                <span>Frames {counts.frames}</span>
                <span>Audio {counts.audio}</span>
                <span>Segments {counts.segments}</span>
              </div>
              <div style={styles.row}>
                <button style={styles.secondaryButton} onClick={applyToBuilder}>
                  Apply to Builder
                </button>
                <button style={styles.secondaryButton} disabled={busy} onClick={generateSimilarFromBlueprint}>
                  Generate Similar
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div style={styles.videoMode}>
          <div style={styles.summaryBox}>
            <div style={styles.label}>Video status</div>
            <div>Analysis: {smallId(analysisId)}</div>
            <div>Editor: {smallId(editorId)}</div>
            <div>Worker: {smallId(jobId)}</div>
            <div style={styles.countRow}>
              <span>Assets {counts.assets}</span>
              <span>Frames {counts.frames}</span>
              <span>Audio {counts.audio}</span>
              <span>Segments {counts.segments}</span>
            </div>
          </div>

          <button style={styles.secondaryButton} disabled={busy || !editorId} onClick={saveProviderEditRequest}>
            Save Provider Edit Request
          </button>
          <button style={styles.secondaryButton} disabled={busy || !editorId} onClick={saveExportRequest}>
            Save Stitch + Export Request
          </button>
          <button style={styles.secondaryButton} disabled={busy || (!analysisId && !editorId)} onClick={() => refreshState()}>
            Refresh State
          </button>
        </div>
      )}

      <div style={styles.status}>
        <span>{message}</span>
        {error ? <b style={styles.error}>{error}</b> : null}
      </div>

      <button style={styles.detailsButton} onClick={() => setShowDetails((value) => !value)}>
        {showDetails ? "Hide" : "Show"} Technical Details
      </button>

      {showDetails ? (
        <div style={styles.details}>
          <details open>
            <summary>Prompt</summary>
            <textarea readOnly style={styles.textarea} value={providerPrompt} />
          </details>
          <details>
            <summary>Negative prompt</summary>
            <textarea readOnly style={styles.textareaSmall} value={negativePrompt} />
          </details>
          <details>
            <summary>Analysis</summary>
            <textarea readOnly style={styles.textarea} value={JSON.stringify(analysis || {}, null, 2)} />
          </details>
          <details>
            <summary>Intelligence</summary>
            <textarea readOnly style={styles.textarea} value={JSON.stringify(intelligence?.intelligence || {}, null, 2)} />
          </details>
          <details>
            <summary>Timeline</summary>
            <textarea readOnly style={styles.textarea} value={JSON.stringify(timeline?.timeline || {}, null, 2)} />
          </details>
          <details>
            <summary>Execution</summary>
            <textarea readOnly style={styles.textarea} value={JSON.stringify(executionSummary || generateSimilar || {}, null, 2)} />
          </details>
        </div>
      ) : null}
    </aside>
  );
}

const baseButton = {
  minHeight: 36,
  borderRadius: 10,
  padding: "0 10px",
  color: "#f8fafc",
  cursor: "pointer",
  fontSize: 12,
};

const styles = {
  closedButton: {
    position: "fixed",
    right: 16,
    bottom: 16,
    zIndex: 80,
    ...baseButton,
    background: "#2563eb",
    border: "1px solid rgba(96,165,250,0.45)",
  },
  panel: {
    position: "fixed",
    top: 92,
    right: 18,
    zIndex: 80,
    width: "min(420px, calc(100vw - 36px))",
    maxHeight: "calc(100dvh - 116px)",
    overflow: "auto",
    display: "grid",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.24)",
    background: "rgba(8,13,24,0.94)",
    color: "#f8fafc",
    boxShadow: "0 24px 80px rgba(0,0,0,0.34)",
    backdropFilter: "blur(12px)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  kicker: {
    color: "#93c5fd",
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  iconButton: {
    ...baseButton,
    minHeight: 28,
    width: 30,
    background: "rgba(30,41,59,0.8)",
    border: "1px solid rgba(148,163,184,0.24)",
  },
  tabs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  tab: {
    ...baseButton,
    background: "rgba(30,41,59,0.7)",
    border: "1px solid rgba(148,163,184,0.22)",
  },
  activeTab: {
    ...baseButton,
    background: "#2563eb",
    border: "1px solid rgba(96,165,250,0.45)",
  },
  label: {
    color: "#93c5fd",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  row: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  input: {
    flex: "1 1 210px",
    minHeight: 38,
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.24)",
    background: "#020617",
    color: "#f8fafc",
    padding: "0 10px",
  },
  primaryButton: {
    ...baseButton,
    background: "#2563eb",
    border: "1px solid rgba(96,165,250,0.45)",
  },
  secondaryButton: {
    ...baseButton,
    background: "#1e293b",
    border: "1px solid rgba(148,163,184,0.24)",
  },
  summaryBox: {
    display: "grid",
    gap: 7,
    padding: 10,
    borderRadius: 12,
    background: "rgba(15,23,42,0.86)",
    border: "1px solid rgba(148,163,184,0.18)",
    fontSize: 12,
  },
  titleLine: {
    color: "#e2e8f0",
    wordBreak: "break-word",
    lineHeight: 1.35,
  },
  countRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    color: "#cbd5e1",
    fontSize: 11,
  },
  videoMode: {
    display: "grid",
    gap: 8,
  },
  status: {
    display: "grid",
    gap: 4,
    color: "#cbd5e1",
    fontSize: 12,
  },
  error: {
    color: "#fecaca",
    fontWeight: 500,
  },
  detailsButton: {
    ...baseButton,
    background: "transparent",
    border: "1px dashed rgba(148,163,184,0.34)",
  },
  details: {
    display: "grid",
    gap: 8,
  },
  textarea: {
    width: "100%",
    minHeight: 120,
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "#020617",
    color: "#f8fafc",
    padding: 10,
    fontSize: 11,
    lineHeight: 1.45,
  },
  textareaSmall: {
    width: "100%",
    minHeight: 70,
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "#020617",
    color: "#f8fafc",
    padding: 10,
    fontSize: 11,
    lineHeight: 1.45,
  },
};
