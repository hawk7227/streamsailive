"use client";

import { useRef, useState } from "react";

const PROJECT_ID = "fb7bf446-78c9-4905-80bc-32a19d0f9803";

async function readJson(res) {
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) throw new Error(data?.error || `Request failed ${res.status}`);
  return data;
}

function Box({ title, children }) {
  return <section style={styles.box}><div style={styles.boxTitle}>{title}</div>{children}</section>;
}

function JsonView({ title, value }) {
  return (
    <Box title={title}>
      <textarea readOnly value={JSON.stringify(value || {}, null, 2)} style={styles.json} />
    </Box>
  );
}

export default function FinalVideoEditorWorkbench() {
  const fileRef = useRef(null);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("Ready");
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [intelligence, setIntelligence] = useState(null);
  const [editor, setEditor] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [job, setJob] = useState(null);
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);

  const analysisId = analysis?.id || analysis?.analysisId;
  const editorId = editor?.id || editor?.editorProject?.id;
  const jobId = job?.id || job?.job?.id;

  async function post(path, body) {
    return readJson(await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }));
  }

  async function refresh(nextAnalysisId = analysisId, nextEditorId = editorId, nextJobId = jobId) {
    if (nextAnalysisId) {
      const intel = await readJson(await fetch(`/api/admingeneration/reference/analyze/${nextAnalysisId}/intelligence`, { cache: "no-store" }));
      setIntelligence(intel);
      if (intel.analysis) setAnalysis(intel.analysis);
    }
    if (nextEditorId) {
      const ed = await readJson(await fetch(`/api/admingeneration/editor/projects/${nextEditorId}`, { cache: "no-store" }));
      setEditor(ed.project || ed.editorProject || ed);
      const tl = await readJson(await fetch(`/api/admingeneration/editor/projects/${nextEditorId}/timeline`, { cache: "no-store" }));
      setTimeline(tl);
      const ex = await readJson(await fetch(`/api/admingeneration/editor/projects/${nextEditorId}/version-actions`, { cache: "no-store" }));
      setSummary(ex);
    }
    if (nextAnalysisId && nextJobId) {
      const j = await readJson(await fetch(`/api/admingeneration/reference/analyze/${nextAnalysisId}/worker-jobs/${nextJobId}`, { cache: "no-store" }));
      setJob(j.job || j);
    }
  }

  async function makeEditorAndJob(nextAnalysis) {
    const id = nextAnalysis?.id || nextAnalysis?.analysisId;
    const ed = await post("/api/admingeneration/editor/from-analysis", { analysisId: id, projectId: PROJECT_ID });
    setEditor(ed.editorProject);
    const j = await post(`/api/admingeneration/reference/analyze/${id}/worker-jobs`, { requestedProfile: "admin_full" });
    setJob(j.job);
    await refresh(id, ed.editorProject?.id, j.job?.id);
  }

  async function analyzeUrl() {
    setBusy(true); setError(""); setMessage("Analyzing URL...");
    try {
      const isYoutube = /youtube\.com|youtu\.be/i.test(url);
      const data = await post("/api/admingeneration/reference/analyze", {
        sourceType: isYoutube ? "youtube" : "url",
        url,
        projectId: PROJECT_ID,
      });
      const nextAnalysis = data.analysis || { id: data.analysisId, ...data };
      setAnalysis(nextAnalysis);
      await makeEditorAndJob(nextAnalysis);
      setMessage("URL analyzer/editor chain ready.");
    } catch (e) {
      setError(e.message || String(e)); setMessage("URL analyze failed.");
    } finally { setBusy(false); }
  }

  async function uploadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(""); setMessage("Uploading + analyzing...");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", PROJECT_ID);
      form.append("requestedProfile", "admin_full");
      const data = await readJson(await fetch("/api/admingeneration/reference/upload-and-analyze", { method: "POST", body: form }));
      const nextAnalysis = data.analysis || { id: data.analysisId, ...data };
      setAnalysis(nextAnalysis);
      await makeEditorAndJob(nextAnalysis);
      setMessage("Upload analyzer/editor chain ready. Run the worker script for real frame/audio extraction.");
    } catch (e2) {
      setError(e2.message || String(e2)); setMessage("Upload failed.");
    } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function saveProviderRun() {
    if (!editorId) return;
    setBusy(true);
    try {
      await post(`/api/admingeneration/editor/projects/${editorId}/provider-runs`, {
        provider: "provider_router",
        action: "segment_edit",
        targetType: "project",
        prompt: analysis?.blueprint?.generation?.providerReadyPrompt || "",
      });
      await refresh();
      setMessage("Provider edit request saved as blocked_provider_not_wired.");
    } catch (e) { setError(e.message || String(e)); } finally { setBusy(false); }
  }

  async function saveExport() {
    if (!editorId) return;
    setBusy(true);
    try {
      await post(`/api/admingeneration/editor/projects/${editorId}/stitch-jobs`, { timelineSnapshot: timeline || {} });
      await post(`/api/admingeneration/editor/projects/${editorId}/exports`, { exportType: "mp4", settings: { source: "admingeneration" } });
      await refresh();
      setMessage("Stitch/export request saved as blocked until render worker is wired.");
    } catch (e) { setError(e.message || String(e)); } finally { setBusy(false); }
  }

  const lanes = timeline?.timeline?.lanes || [];
  const counts = timeline?.timeline?.counts || {};
  const extractedAssets = intelligence?.intelligence?.assets || [];
  const extractedSegments = intelligence?.intelligence?.segments || [];

  return (
    <main style={styles.shell}>
      <aside style={styles.left}>
        <h1 style={styles.h1}>Streams Video Analyzer + Editor</h1>
        <p style={styles.small}>Final bundle UI: upload/analyze, editor project, timeline, worker job, provider/edit/export control plane.</p>

        <Box title="Analyze URL">
          <input style={styles.input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="YouTube or direct video URL" />
          <button style={styles.primary} disabled={busy || !url} onClick={analyzeUrl}>Analyze URL</button>
        </Box>

        <Box title="Upload video/reference">
          <input ref={fileRef} type="file" accept="video/*,audio/*,image/*,.pdf" onChange={uploadFile} style={{ display: "none" }} />
          <button style={styles.primary} disabled={busy} onClick={() => fileRef.current?.click()}>Upload + Analyze</button>
        </Box>

        <Box title="Editor Actions">
          <button style={styles.button} disabled={busy || !editorId} onClick={saveProviderRun}>Save Provider Edit Request</button>
          <button style={styles.button} disabled={busy || !editorId} onClick={saveExport}>Save Stitch + Export Request</button>
          <button style={styles.button} disabled={busy || (!analysisId && !editorId)} onClick={() => refresh()}>Refresh State</button>
        </Box>

        <Box title="Status">
          <div style={styles.small}>{message}</div>
          {error ? <div style={styles.error}>{error}</div> : null}
          <div style={styles.ids}>analysis: {analysisId || "none"}</div>
          <div style={styles.ids}>editor: {editorId || "none"}</div>
          <div style={styles.ids}>job: {jobId || "none"}</div>
        </Box>
      </aside>

      <section style={styles.center}>
        <div style={styles.preview}>
          <div style={styles.previewTitle}>Preview / Player</div>
          <div style={styles.small}>{analysis?.sourceUrl || analysis?.source?.url || "No source loaded"}</div>
        </div>
        <div style={styles.timeline}>
          <div style={styles.timelineHead}>Timeline · tracks {counts.tracks || 0} · assets {counts.assets || extractedAssets.length} · segments {(counts.editorSegments || 0) + (counts.intelligenceSegments || extractedSegments.length)}</div>
          {lanes.map((lane) => (
            <div key={lane.id || lane.type} style={styles.lane}>
              <div style={styles.laneName}>{lane.label || lane.type}</div>
              <div style={styles.items}>
                {(lane.items || []).length ? lane.items.slice(0, 10).map((item, i) => (
                  <span key={item.id || i} style={styles.item}>{item.label || item.asset_kind || item.status || "item"}</span>
                )) : <span style={styles.empty}>empty</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <aside style={styles.right}>
        <JsonView title="Analysis" value={analysis} />
        <JsonView title="Worker Job" value={job} />
        <JsonView title="Intelligence Graph" value={intelligence?.intelligence || intelligence} />
        <JsonView title="Execution Summary" value={summary} />
      </aside>
    </main>
  );
}

const styles = {
  shell: { display: "grid", gridTemplateColumns: "340px minmax(0,1fr) 410px", gap: 14, minHeight: "100dvh", padding: 14, background: "#020617", color: "#f8fafc" },
  left: { display: "grid", gap: 12, alignContent: "start" },
  center: { display: "grid", gridTemplateRows: "minmax(420px,1fr) 320px", gap: 12, minWidth: 0 },
  right: { display: "grid", gap: 12, alignContent: "start", minWidth: 0 },
  h1: { fontSize: 25, margin: "0 0 8px" },
  small: { color: "#94a3b8", fontSize: 13, lineHeight: 1.45, wordBreak: "break-word" },
  box: { background: "rgba(15,23,42,.86)", border: "1px solid rgba(148,163,184,.2)", borderRadius: 16, padding: 14, display: "grid", gap: 10 },
  boxTitle: { color: "#93c5fd", textTransform: "uppercase", fontSize: 12, letterSpacing: ".1em" },
  input: { minHeight: 42, borderRadius: 12, border: "1px solid rgba(148,163,184,.25)", background: "#020617", color: "#fff", padding: "0 12px" },
  primary: { minHeight: 42, borderRadius: 12, border: "1px solid rgba(96,165,250,.5)", background: "#2563eb", color: "#fff", cursor: "pointer" },
  button: { minHeight: 42, borderRadius: 12, border: "1px solid rgba(148,163,184,.25)", background: "#1e293b", color: "#fff", cursor: "pointer" },
  error: { color: "#fecaca", fontSize: 13 },
  ids: { color: "#cbd5e1", fontSize: 12, wordBreak: "break-all" },
  preview: { display: "grid", placeItems: "center", textAlign: "center", borderRadius: 20, border: "1px solid rgba(148,163,184,.2)", background: "radial-gradient(circle, rgba(37,99,235,.25), transparent 30%), rgba(15,23,42,.86)", padding: 24 },
  previewTitle: { fontSize: 28, fontWeight: 800 },
  timeline: { borderRadius: 18, border: "1px solid rgba(148,163,184,.2)", background: "rgba(15,23,42,.86)", padding: 12, overflow: "auto" },
  timelineHead: { marginBottom: 10, color: "#cbd5e1", fontSize: 13 },
  lane: { display: "grid", gridTemplateColumns: "105px 1fr", gap: 8, marginBottom: 8, alignItems: "center" },
  laneName: { color: "#93c5fd", fontSize: 13 },
  items: { display: "flex", gap: 6, overflow: "hidden" },
  item: { maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "6px 9px", borderRadius: 10, background: "rgba(37,99,235,.35)", fontSize: 12 },
  empty: { padding: "6px 9px", borderRadius: 10, background: "rgba(51,65,85,.5)", color: "#94a3b8", fontSize: 12 },
  json: { width: "100%", minHeight: 170, borderRadius: 12, border: "1px solid rgba(148,163,184,.25)", background: "#020617", color: "#f8fafc", padding: 10, fontSize: 12, resize: "vertical" },
};
