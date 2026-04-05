"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { BulkDesignTab, BulkManifest, BulkWorkspaceTab, BulkTask } from "@/lib/bulk/job-schema";
import { listTemplates } from "@/lib/bulk/template-engine";

const workspaceTabs: Array<{ id: BulkWorkspaceTab; label: string }> = [
  { id: "bulk_jobs", label: "Bulk Jobs" },
  { id: "products", label: "Products" },
  { id: "collections", label: "Collections" },
  { id: "seo", label: "SEO" },
  { id: "landing", label: "Landing" },
  { id: "library", label: "Library" },
  { id: "campaigns", label: "Campaigns" },
];

const designTabs: Array<{ id: BulkDesignTab; label: string }> = [
  { id: "templates", label: "Templates" },
  { id: "text", label: "Text" },
  { id: "fonts", label: "Fonts" },
  { id: "graphics", label: "Graphics" },
  { id: "layouts", label: "Layouts" },
  { id: "brand_kits", label: "Brand Kits" },
  { id: "offers", label: "CTA / Offers" },
];

type BulkStatusResponse = {
  data: {
    id: string;
    status: string;
    manifest: BulkManifest;
    tasks: BulkTask[];
    options: {
      requestedCount: number;
      requestedSize: string;
      selectedKinds: string[];
      selectedAspects: string[];
    };
    error: string | null;
  };
};

export default function BulkCreativeWorkspace() {
  const [workspaceTab, setWorkspaceTab] = useState<BulkWorkspaceTab>("bulk_jobs");
  const [designTab, setDesignTab] = useState<BulkDesignTab>("templates");
  const [prompt, setPrompt] = useState("Generate 6 ad creatives 1024x1024 plus 4:5 product variants for a premium wellness gummy launch");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<BulkStatusResponse["data"] | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [psdInfo, setPsdInfo] = useState<string | null>(null);
  const templates = useMemo(() => listTemplates(), []);

  useEffect(() => {
    if (!jobId) return;
    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/bulk/job-status/${jobId}`);
      const payload = (await response.json()) as BulkStatusResponse | { error: string };
      if (!response.ok || !("data" in payload)) {
        setError("error" in payload ? payload.error : "Failed to poll bulk job");
        window.clearInterval(interval);
        return;
      }
      const nextJob = payload.data;
      setJob(nextJob);
      if (!selectedTaskId && nextJob.manifest.outputs[0]) {
        setSelectedTaskId(nextJob.manifest.outputs[0].taskId);
      }
      if (["completed", "failed", "cancelled"].includes(nextJob.status)) {
        window.clearInterval(interval);
      }
    }, 1500);
    return () => window.clearInterval(interval);
  }, [jobId, selectedTaskId]);

  const selectedOutput = useMemo(() => {
    if (!job || !selectedTaskId) return null;
    return job.manifest.outputs.find((output) => output.taskId === selectedTaskId) ?? null;
  }, [job, selectedTaskId]);

  async function createBulkJob() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/bulk/create-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const payload = await response.json() as { data?: { jobId: string }; error?: string };
      if (!response.ok || !payload.data?.jobId) throw new Error(payload.error ?? "Bulk job creation failed");
      setJobId(payload.data.jobId);
      setJob(null);
      setSelectedTaskId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk job creation failed");
    } finally {
      setBusy(false);
    }
  }

  async function exportJob() {
    if (!jobId) return;
    const response = await fetch("/api/bulk/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Export failed" }));
      setError(payload.error ?? "Export failed");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bulk-${jobId}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function inspectPsd(file: File) {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/psd/upload", { method: "POST", body: form });
    const payload = await response.json();
    if (!response.ok) {
      setPsdInfo(payload.error ?? "PSD inspect failed");
      return;
    }
    setPsdInfo(`${payload.data.filename} • ${payload.data.metadata.width}x${payload.data.metadata.height} • ${payload.data.reason}`);
  }

  const mutedCard: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 };

  return (
    <div style={{ background: "linear-gradient(180deg, rgba(8,15,28,0.98), rgba(6,12,24,0.98))", border: "1px solid rgba(148,163,184,0.14)", borderRadius: 18, marginBottom: 14, boxShadow: "0 18px 46px rgba(2,6,23,.18)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#e2e8f0", letterSpacing: "0.08em" }}>BULK CREATIVE WORKSPACE</div>
          <div style={{ fontSize: 10, color: "#64748b" }}>Bulk jobs · templates · PSD intake · Adobe fail-closed adapters</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={createBulkJob} disabled={busy} style={{ background: "rgba(103,232,249,0.12)", color: "#67e8f9", border: "1px solid rgba(103,232,249,0.28)", borderRadius: 10, padding: "8px 14px", fontSize: 11, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>{busy ? "Starting…" : "Generate Bulk"}</button>
          <button onClick={exportJob} disabled={!jobId || !job?.manifest.outputs.length} style={{ background: "rgba(255,255,255,0.06)", color: !jobId || !job?.manifest.outputs.length ? "#334155" : "#94a3b8", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 14px", fontSize: 11, fontWeight: 700, cursor: !jobId || !job?.manifest.outputs.length ? "not-allowed" : "pointer" }}>Export ZIP</button>
        </div>
      </div>

      <div style={{ padding: 14, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.9fr 0.7fr auto", gap: 10 }}>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} style={{ width: "100%", background: "rgba(255,255,255,0.04)", color: "#cbd5e1", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12, resize: "vertical" }} />
          <div style={{ ...mutedCard, padding: 12 }}>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Current Job</div>
            <div style={{ fontSize: 11, color: "#cbd5e1" }}>{jobId ?? "Not started"}</div>
            <div style={{ fontSize: 11, color: "#67e8f9", marginTop: 6 }}>{job?.status ?? "idle"}</div>
          </div>
          <label style={{ ...mutedCard, padding: 12, color: "#94a3b8", fontSize: 11, cursor: "pointer" }}>
            PSD Upload
            <input type="file" accept=".psd,image/vnd.adobe.photoshop,application/photoshop,application/x-photoshop" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) void inspectPsd(file); e.currentTarget.value = ""; }} />
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 6 }}>{psdInfo ?? "Header inspection only until a real PSD editor runtime is installed."}</div>
          </label>
          <div style={{ ...mutedCard, padding: 12, minWidth: 160 }}>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Progress</div>
            <div style={{ fontSize: 16, color: "#e2e8f0", fontWeight: 800 }}>{job ? `${job.manifest.completed}/${job.manifest.total}` : "0/0"}</div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>{job?.manifest.failed ? `${job.manifest.failed} failed` : "No failures"}</div>
          </div>
        </div>
        {error && <div style={{ marginTop: 10, color: "#fca5a5", fontSize: 11 }}>{error}</div>}
      </div>

      <div style={{ display: "flex", gap: 0, padding: "0 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {workspaceTabs.map((tab) => (
          <button key={tab.id} onClick={() => setWorkspaceTab(tab.id)} style={{ padding: "9px 10px", fontSize: 11, color: workspaceTab === tab.id ? "#67e8f9" : "#64748b", background: "none", border: "none", borderBottom: workspaceTab === tab.id ? "2px solid #67e8f9" : "2px solid transparent", cursor: "pointer" }}>{tab.label}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 0, padding: "0 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {designTabs.map((tab) => (
          <button key={tab.id} onClick={() => setDesignTab(tab.id)} style={{ padding: "8px 10px", fontSize: 10, color: designTab === tab.id ? "#a5f3fc" : "#475569", background: "none", border: "none", borderBottom: designTab === tab.id ? "2px solid rgba(165,243,252,0.8)" : "2px solid transparent", cursor: "pointer" }}>{tab.label}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 0.85fr", gap: 14, padding: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...mutedCard, padding: 12 }}>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{workspaceTab === "bulk_jobs" ? "Bulk Grid" : workspaceTabs.find((tab) => tab.id === workspaceTab)?.label}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {job?.manifest.outputs.map((output) => (
                <button key={output.taskId} onClick={() => setSelectedTaskId(output.taskId)} style={{ textAlign: "left", padding: 0, background: selectedTaskId === output.taskId ? "rgba(103,232,249,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${selectedTaskId === output.taskId ? "rgba(103,232,249,0.28)" : "rgba(255,255,255,0.06)"}`, borderRadius: 12, overflow: "hidden", cursor: "pointer" }}>
                  <div style={{ aspectRatio: "1 / 1", background: "#0f172a" }}>
                    <img src={output.url} alt={output.plan.kind} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </div>
                  <div style={{ padding: 10 }}>
                    <div style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 700 }}>{output.plan.kind.replaceAll("_", " ")}</div>
                    <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>{output.plan.layoutFamily} • {output.plan.aspectRatio} • score {output.plan.score}</div>
                  </div>
                </button>
              ))}
              {!job?.manifest.outputs.length && <div style={{ fontSize: 11, color: "#475569", padding: 8 }}>No outputs yet. Start a bulk job to populate the grid.</div>}
            </div>
          </div>
          <div style={{ ...mutedCard, padding: 12 }}>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Design Library</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {templates.map((template) => (
                <div key={template.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 700 }}>{template.name}</div>
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>{template.kind.replaceAll("_", " ")} • {template.layoutFamily}</div>
                  <div style={{ fontSize: 10, color: "#475569", marginTop: 6 }}>{template.guidance}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...mutedCard, padding: 12 }}>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Preview</div>
            {selectedOutput ? (
              <>
                <div style={{ aspectRatio: "1 / 1", background: "#020617", borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
                  <img src={selectedOutput.url} alt={selectedOutput.plan.kind} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
                <div style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 800 }}>{selectedOutput.plan.kind.replaceAll("_", " ")} • {selectedOutput.plan.layoutFamily}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, lineHeight: 1.7 }}>
                  Tone {selectedOutput.plan.tone} · Angle {selectedOutput.plan.angle} · CTA {selectedOutput.plan.ctaIntent}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <a href={selectedOutput.url} download={`bulk-${selectedOutput.taskId}.png`} style={{ background: "rgba(255,255,255,0.06)", color: "#cbd5e1", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 12px", fontSize: 11, textDecoration: "none" }}>Download</a>
                  <button onClick={exportJob} style={{ background: "rgba(103,232,249,0.12)", color: "#67e8f9", border: "1px solid rgba(103,232,249,0.28)", borderRadius: 10, padding: "8px 12px", fontSize: 11, cursor: "pointer" }}>Export all</button>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: "#475569" }}>Select an output from the bulk grid.</div>
            )}
          </div>
          <div style={{ ...mutedCard, padding: 12 }}>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Task Trace</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflowY: "auto" }}>
              {job?.tasks.map((task) => (
                <div key={task.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 700 }}>{task.kind.replaceAll("_", " ")} • {task.plan.layoutFamily}</div>
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>{task.aspectRatio} · {task.provider} · template {task.plan.templateId}</div>
                  <div style={{ fontSize: 10, color: "#475569", marginTop: 6, lineHeight: 1.6 }}>{task.finalPrompt}</div>
                </div>
              ))}
              {!job?.tasks.length && <div style={{ fontSize: 11, color: "#475569" }}>Task plans appear here after job creation.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
