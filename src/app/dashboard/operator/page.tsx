"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface Job {
  id: string; type: string; status: string; priority: number;
  error?: string; retries: number; created_at: string; updated_at: string;
  payload: Record<string,unknown>; result?: Record<string,unknown>;
}
interface LedgerEntry {
  id: string; action: string; severity: string; entity_type?: string;
  entity_id?: string; payload: Record<string,unknown>; created_at: string;
}
interface GenerationRow {
  id: string; type: string; status: string; prompt: string;
  output_url?: string; created_at: string; provider?: string;
}
interface FileRow {
  id: string; name: string; mime_type: string; size: number;
  hash?: string; is_temp: boolean; created_at: string;
}
interface ProviderStatus { name: string; ok: boolean; latencyMs?: number; error?: string; }

type Tab = "jobs" | "files" | "generations" | "ledger" | "providers";

const SEV_COLOR: Record<string, string> = {
  debug: "#334155", info: "#0ea5e9", warn: "#f59e0b", error: "#ef4444", critical: "#a855f7",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "#64748b", claimed: "#f59e0b", running: "#0ea5e9",
  completed: "#22c55e", failed: "#ef4444", cancelled: "#475569",
};

// ── Provider health check ──────────────────────────────────────────────────

async function checkProviders(): Promise<ProviderStatus[]> {
  const checks = [
    { name: "OpenAI",      url: "https://api.openai.com/v1/models",            key: "OPENAI" },
    { name: "ElevenLabs",  url: "https://api.elevenlabs.io/v1/voices",          key: "ELEVENLABS" },
    { name: "Kling",       url: "https://api-singapore.klingai.com/",            key: "KLING" },
    { name: "Runway",      url: "https://api.runwayml.com/v1/tasks",             key: "RUNWAY" },
  ];
  return Promise.all(checks.map(async c => {
    const t0 = Date.now();
    try {
      const r = await fetch(`/api/operator/health?provider=${c.name}`, { signal: AbortSignal.timeout(5000) });
      const d = await r.json() as { ok: boolean; latencyMs?: number; error?: string };
      return { name: c.name, ok: d.ok, latencyMs: Date.now() - t0, error: d.error };
    } catch (e) {
      return { name: c.name, ok: false, latencyMs: Date.now() - t0, error: String(e) };
    }
  }));
}

// ── Main component ─────────────────────────────────────────────────────────

export default function OperatorPage() {
  const [tab, setTab] = useState<Tab>("jobs");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [generations, setGenerations] = useState<GenerationRow[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (tab === "jobs") {
        const r = await fetch("/api/jobs?limit=100");
        const d = await r.json() as { data: Job[] };
        setJobs(d.data ?? []);
      } else if (tab === "files") {
        const r = await fetch("/api/files?limit=100");
        const d = await r.json() as { data: FileRow[] };
        setFiles(d.data ?? []);
      } else if (tab === "generations") {
        const r = await fetch("/api/generations?limit=100");
        const d = await r.json() as { data: GenerationRow[] };
        setGenerations(d.data ?? []);
      } else if (tab === "ledger") {
        const r = await fetch("/api/operator/ledger?limit=200");
        const d = await r.json() as { data: LedgerEntry[] };
        setLedger(d.data ?? []);
      } else if (tab === "providers") {
        const results = await checkProviders();
        setProviders(results);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const cancelJob = async (id: string) => {
    await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    load();
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "jobs",        label: "Job Queue",       count: jobs.filter(j => ["pending","running","claimed"].includes(j.status)).length },
    { id: "files",       label: "Files",           count: files.length },
    { id: "generations", label: "Generations",     count: generations.filter(g => g.status === "failed").length },
    { id: "ledger",      label: "Ledger",          count: ledger.filter(l => l.severity === "error").length },
    { id: "providers",   label: "Provider Health", count: providers.filter(p => !p.ok).length },
  ];

  return (
    <div style={{ background: "#050810", minHeight: "100vh", color: "#f1f5f9", fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#f1f5f9" }}>Operator Dashboard</h1>
            <p style={{ fontSize: 12, color: "#475569", margin: "4px 0 0" }}>System status, jobs, files, ledger, provider health</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b", cursor: "pointer" }}>
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
              Auto-refresh (5s)
            </label>
            <button onClick={load} style={{ background: "rgba(103,232,249,0.1)", border: "1px solid rgba(103,232,249,0.3)", color: "#67e8f9", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>
              {loading ? "Loading…" : "↺ Refresh"}
            </button>
          </div>
        </div>

        {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#f87171" }}>Error: {error}</div>}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ background: tab === t.id ? "rgba(103,232,249,0.1)" : "transparent", border: "none", borderBottom: tab === t.id ? "2px solid #67e8f9" : "2px solid transparent", color: tab === t.id ? "#67e8f9" : "#64748b", padding: "8px 16px", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span style={{ background: t.id === "providers" || t.id === "generations" || t.id === "ledger" ? "rgba(239,68,68,0.2)" : "rgba(103,232,249,0.15)", color: t.id === "providers" || t.id === "generations" || t.id === "ledger" ? "#f87171" : "#67e8f9", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Job Queue ── */}
        {tab === "jobs" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              {(["pending","running","completed","failed"] as const).map(s => (
                <div key={s} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${STATUS_COLOR[s]}33`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: STATUS_COLOR[s] }}>{jobs.filter(j => j.status === s).length}</div>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>{s}</div>
                </div>
              ))}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {["ID","Type","Status","Priority","Retries","Created","Error","Actions"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobs.map(j => (
                    <tr key={j.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "8px 12px", color: "#94a3b8", fontFamily: "monospace" }}>{j.id.slice(0,8)}</td>
                      <td style={{ padding: "8px 12px", color: "#67e8f9" }}>{j.type}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{ background: `${STATUS_COLOR[j.status]}20`, color: STATUS_COLOR[j.status], borderRadius: 5, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>{j.status}</span>
                      </td>
                      <td style={{ padding: "8px 12px", color: "#94a3b8" }}>{j.priority}</td>
                      <td style={{ padding: "8px 12px", color: j.retries > 0 ? "#f59e0b" : "#94a3b8" }}>{j.retries}</td>
                      <td style={{ padding: "8px 12px", color: "#475569" }}>{new Date(j.created_at).toLocaleTimeString()}</td>
                      <td style={{ padding: "8px 12px", color: "#f87171", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.error ?? ""}</td>
                      <td style={{ padding: "8px 12px" }}>
                        {["pending","claimed","running"].includes(j.status) && (
                          <button onClick={() => cancelJob(j.id)} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", borderRadius: 5, padding: "2px 8px", fontSize: 10, cursor: "pointer" }}>Cancel</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {jobs.length === 0 && !loading && <div style={{ textAlign: "center", padding: 40, color: "#334155" }}>No jobs found</div>}
            </div>
          </div>
        )}

        {/* ── Files ── */}
        {tab === "files" && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {["Name","Type","Size","Hash","Temp","Created"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {files.map(f => (
                  <tr key={f.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "8px 12px", color: "#f1f5f9", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</td>
                    <td style={{ padding: "8px 12px", color: "#67e8f9" }}>{f.mime_type}</td>
                    <td style={{ padding: "8px 12px", color: "#94a3b8" }}>{(f.size/1024).toFixed(1)}KB</td>
                    <td style={{ padding: "8px 12px", color: "#475569", fontFamily: "monospace" }}>{f.hash?.slice(0,12) ?? "—"}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ color: f.is_temp ? "#f59e0b" : "#22c55e", fontSize: 10, fontWeight: 700 }}>{f.is_temp ? "TEMP" : "PERM"}</span>
                    </td>
                    <td style={{ padding: "8px 12px", color: "#475569" }}>{new Date(f.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {files.length === 0 && !loading && <div style={{ textAlign: "center", padding: 40, color: "#334155" }}>No files found</div>}
          </div>
        )}

        {/* ── Generations ── */}
        {tab === "generations" && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {["ID","Type","Status","Provider","Prompt","Output","Created"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {generations.map(g => (
                  <tr key={g.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "8px 12px", color: "#94a3b8", fontFamily: "monospace" }}>{g.id.slice(0,8)}</td>
                    <td style={{ padding: "8px 12px", color: "#67e8f9" }}>{g.type}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ background: `${STATUS_COLOR[g.status] ?? "#64748b"}20`, color: STATUS_COLOR[g.status] ?? "#64748b", borderRadius: 5, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>{g.status}</span>
                    </td>
                    <td style={{ padding: "8px 12px", color: "#94a3b8" }}>{g.provider ?? "—"}</td>
                    <td style={{ padding: "8px 12px", color: "#cbd5e1", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.prompt}</td>
                    <td style={{ padding: "8px 12px" }}>
                      {g.output_url && <a href={g.output_url} target="_blank" rel="noreferrer" style={{ color: "#67e8f9", fontSize: 10 }}>View ↗</a>}
                    </td>
                    <td style={{ padding: "8px 12px", color: "#475569" }}>{new Date(g.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {generations.length === 0 && !loading && <div style={{ textAlign: "center", padding: 40, color: "#334155" }}>No generations found</div>}
          </div>
        )}

        {/* ── Ledger ── */}
        {tab === "ledger" && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {["Severity","Action","Entity","Payload","Time"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledger.map(l => (
                  <tr key={l.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ background: `${SEV_COLOR[l.severity]}20`, color: SEV_COLOR[l.severity], borderRadius: 5, padding: "2px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{l.severity}</span>
                    </td>
                    <td style={{ padding: "8px 12px", color: "#67e8f9" }}>{l.action}</td>
                    <td style={{ padding: "8px 12px", color: "#94a3b8" }}>{l.entity_type}{l.entity_id ? `:${l.entity_id.slice(0,8)}` : ""}</td>
                    <td style={{ padding: "8px 12px", color: "#475569", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{JSON.stringify(l.payload).slice(0,80)}</td>
                    <td style={{ padding: "8px 12px", color: "#475569" }}>{new Date(l.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ledger.length === 0 && !loading && <div style={{ textAlign: "center", padding: 40, color: "#334155" }}>No ledger entries found</div>}
          </div>
        )}

        {/* ── Provider Health ── */}
        {tab === "providers" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {providers.map(p => (
                <div key={p.name} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${p.ok ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`, borderRadius: 12, padding: "16px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9" }}>{p.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: p.ok ? "#22c55e" : "#ef4444", background: p.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", borderRadius: 5, padding: "2px 8px" }}>
                      {p.ok ? "✓ ONLINE" : "✗ OFFLINE"}
                    </span>
                  </div>
                  {p.latencyMs && <div style={{ fontSize: 11, color: "#64748b" }}>{p.latencyMs}ms</div>}
                  {p.error && <div style={{ fontSize: 10, color: "#f87171", marginTop: 4 }}>{p.error.slice(0,80)}</div>}
                </div>
              ))}
              {providers.length === 0 && !loading && (
                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "#334155" }}>
                  Click Refresh to check provider health
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
