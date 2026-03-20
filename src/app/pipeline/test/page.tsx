"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────────
type StepState = "complete" | "running" | "review" | "queued" | "blocked" | "error";
type Step = { id: string; name: string; state: StepState; icon: string; output: unknown; error: string | null; startedAt: number | null; completedAt: number | null; };
type ConceptVariant = { variantId: string; headline: string; subheadline?: string; bullets?: string[]; cta?: string; body?: string; };
type QueueStatus = "pending" | "processing" | "completed" | "failed";
type QueueItem = { id: string; type: "image" | "video" | "script"; status: QueueStatus; provider: string; prompt: string; conceptId: string | null; startedAt: number; completedAt: number | null; outputUrl: string | null; externalId: string | null; mode: string; costEstimate: number; elapsedSeconds: number; error: string | null; };
type IntakeType = "url" | "image" | "video" | "doc" | "audio" | null;
type WorkspaceTab = "output" | "editor" | "export" | "publish" | "logs";
type ViewMode = "16:9" | "9:16";
type DeviceFrame = "Desktop" | "iPhone" | "Custom";
type PreviewTab = "Image" | "Video" | "Script";

// ── Initial step config ────────────────────────────────────────────────────
const STEPS_INITIAL: Step[] = [
  { id: "strategy",  name: "Creative Strategy",   state: "queued", icon: "◫", output: null, error: null, startedAt: null, completedAt: null },
  { id: "copy",      name: "AI Copy Generation",  state: "queued", icon: "✦", output: null, error: null, startedAt: null, completedAt: null },
  { id: "validator", name: "Validator",            state: "queued", icon: "◈", output: null, error: null, startedAt: null, completedAt: null },
  { id: "imagery",   name: "Imagery Generation",  state: "queued", icon: "▣", output: null, error: null, startedAt: null, completedAt: null },
  { id: "i2v",       name: "Image to Video",      state: "queued", icon: "▶", output: null, error: null, startedAt: null, completedAt: null },
  { id: "assets",    name: "Asset Library",       state: "queued", icon: "▤", output: null, error: null, startedAt: null, completedAt: null },
  { id: "qa",        name: "Quality Assurance",   state: "queued", icon: "✓", output: null, error: null, startedAt: null, completedAt: null },
];

const STEP_PROMPT_FIELD: Record<string, string> = {
  strategy: "strategyPrompt", copy: "copyPrompt", validator: "validatorPrompt",
  imagery: "imagePrompt", i2v: "imageToVideo", assets: "templatePrompt", qa: "qaInstruction",
};

function stateColor(state: StepState): string {
  switch (state) {
    case "complete": return "#6ee7b7";
    case "running":  return "#67e8f9";
    case "review":   return "#fcd34d";
    case "blocked":  return "#f87171";
    case "error":    return "#f87171";
    default:         return "#94a3b8";
  }
}

function Spinner({ size = 12 }: { size?: number }) {
  return <span style={{ display:"inline-block", width:size, height:size, border:"2px solid rgba(255,255,255,0.2)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.7s linear infinite", flexShrink:0 }} />;
}

function P(style: React.CSSProperties): React.CSSProperties {
  return { border:"1px solid rgba(255,255,255,0.10)", background:"rgba(8,12,33,0.92)", borderRadius:16, boxShadow:"0 10px 30px rgba(0,0,0,.08)", ...style };
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function PipelineTestPage() {
  // Step builder
  const [steps, setSteps] = useState<Step[]>(STEPS_INITIAL);
  const [selectedStepId, setSelectedStepId] = useState<string>("strategy");
  const [stepConfigOpen, setStepConfigOpen] = useState(false);

  // Step prompts — keyed by step id
  const [stepPrompts, setStepPrompts] = useState<Record<string, string>>({
    strategy:  "You are a senior healthcare brand strategist. Build a compliant telehealth creative strategy.",
    copy:      "Write 3 compliant telehealth copy variants. Headline ≤8 words. CTA ≤4 words.",
    validator: "Validate copy against telehealth governance. Block banned phrases and diagnostic claims.",
    imagery:   "Premium telehealth brand scene. Licensed provider in minimal clinic. Soft natural light.",
    i2v:       "Slow push-in toward provider. Soft parallax on background. Natural blink. 5 seconds.",
    assets:    "Organise all outputs into a structured asset library.",
    qa:        "Final compliance QA. Check all outputs against governance ruleset.",
  });

  // Pipeline config
  const [nicheId, setNicheId] = useState("telehealth");
  const [selectedConceptId, setSelectedConceptId] = useState("c1");
  const [concepts, setConcepts] = useState<ConceptVariant[]>([
    { variantId: "c1", headline: "Private Care, From Home",   body: "Licensed provider review. Next steps after intake.", cta: "Start Your Visit" },
    { variantId: "c2", headline: "Care Without the Wait",     body: "Secure intake, licensed review, clear next steps.",  cta: "Begin Intake" },
    { variantId: "c3", headline: "Online Care, Simplified",   body: "Discreet, fast, provider-reviewed.",                cta: "Get Started" },
  ]);

  // Workspace outputs (approved from preview screens)
  const [approvedOutputs, setApprovedOutputs] = useState<{ image: string | null; video: string | null; script: string | null }>({ image: null, video: null, script: null });

  // Per-concept preview state
  const [conceptOutputs, setConceptOutputs] = useState<Record<string, { image: string | null; video: string | null; script: string | null; status: QueueStatus | "idle" }>>({
    c1: { image: null, video: null, script: null, status: "idle" },
    c2: { image: null, video: null, script: null, status: "idle" },
    c3: { image: null, video: null, script: null, status: "idle" },
  });
  const [previewTabs, setPreviewTabs] = useState<Record<string, PreviewTab>>({ c1: "Image", c2: "Image", c3: "Image" });

  // Generation queue — replaces all busy.* flags
  const [generationQueue, setGenerationQueue] = useState<Map<string, QueueItem>>(new Map());
  const [queueTrayOpen, setQueueTrayOpen] = useState(false);
  const [queueFilter, setQueueFilter] = useState<"All"|"Images"|"Videos"|"Scripts"|"Processing"|"Completed"|"Failed">("All");
  const [selectedQueueItemId, setSelectedQueueItemId] = useState<string | null>(null);

  // Workspace
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("output");
  const [viewMode, setViewMode] = useState<ViewMode>("16:9");
  const [deviceFrame, setDeviceFrame] = useState<DeviceFrame>("Desktop");

  // AI assistant
  const [assistantMessages, setAssistantMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "Ready. Select a niche and run the pipeline, or ask me to generate something." }
  ]);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantBusy, setAssistantBusy] = useState(false);

  // Intake
  const [activeIntake, setActiveIntake] = useState<IntakeType>(null);
  const [urlInput, setUrlInput] = useState("");
  const [intakeAnalysis, setIntakeAnalysis] = useState<string | null>(null);
  const [intakeBusy, setIntakeBusy] = useState(false);

  // Logs
  const [logs, setLogs] = useState<string[]>(["Pipeline ready."]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const assistantEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  function log(msg: string) {
    setLogs(p => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...p].slice(0, 100));
  }

  // ── Queue helpers ─────────────────────────────────────────────────────────
  function queueAdd(item: Omit<QueueItem, "startedAt" | "elapsedSeconds">) {
    setGenerationQueue(prev => {
      const next = new Map(prev);
      next.set(item.id, { ...item, startedAt: Date.now(), elapsedSeconds: 0 });
      return next;
    });
  }

  function queueUpdate(id: string, updates: Partial<QueueItem>) {
    setGenerationQueue(prev => {
      const existing = prev.get(id);
      if (!existing) return prev;
      const next = new Map(prev);
      const updated = { ...existing, ...updates };
      if (updates.status === "completed" || updates.status === "failed") {
        updated.completedAt = Date.now();
      }
      next.set(id, updated);
      return next;
    });
  }

  function queueClearCompleted() {
    setGenerationQueue(prev => {
      const next = new Map(prev);
      for (const [id, item] of next.entries()) {
        if (item.status === "completed" || item.status === "failed") next.delete(id);
      }
      return next;
    });
  }

  const activeCount = [...generationQueue.values()].filter(i => i.status === "pending" || i.status === "processing").length;

  // ── Supabase Realtime — completions push to queue ─────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("generations-updates")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "generations" }, (payload) => {
        const row = payload.new as { id: string; status: string; output_url?: string; type?: string; concept_id?: string };
        if (row.status === "completed" || row.status === "failed") {
          queueUpdate(row.id, {
            status: row.status as QueueStatus,
            outputUrl: row.output_url ?? null,
          });
          if (row.status === "completed" && row.output_url) {
            const conceptId = row.concept_id ?? null;
            if (conceptId && row.type === "image") {
              setConceptOutputs(p => ({ ...p, [conceptId]: { ...p[conceptId], image: row.output_url!, status: "completed" } }));
            }
            if (conceptId && row.type === "video") {
              setConceptOutputs(p => ({ ...p, [conceptId]: { ...p[conceptId], video: row.output_url!, status: "completed" } }));
            }
            log(`✓ ${row.type} completed: ${row.id.slice(0, 8)}`);
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Polling fallback for items without Realtime (5s interval) ─────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      const pending = [...generationQueue.values()].filter(i => i.status === "pending" || i.status === "processing");
      for (const item of pending) {
        try {
          const res = await fetch(`/api/generations/${item.id}`);
          if (!res.ok) continue;
          const data = await res.json() as { status: string; output_url?: string; elapsed_seconds?: number };
          queueUpdate(item.id, {
            status: data.status as QueueStatus,
            outputUrl: data.output_url ?? null,
            elapsedSeconds: data.elapsed_seconds ?? 0,
          });
        } catch { /* non-fatal */ }
      }
    }, 5000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationQueue]);

  // ── Step config toggle ────────────────────────────────────────────────────
  function selectStep(id: string) {
    if (selectedStepId === id && stepConfigOpen) {
      setStepConfigOpen(false);
    } else {
      setSelectedStepId(id);
      setStepConfigOpen(true);
    }
  }

  // ── Generate image for concept ────────────────────────────────────────────
  async function generateImage(conceptId: string) {
    const concept = concepts.find(c => c.variantId === conceptId);
    const prompt = stepPrompts.imagery + (concept ? ` Concept: ${concept.headline}. ${concept.body ?? ""}` : "");
    setConceptOutputs(p => ({ ...p, [conceptId]: { ...p[conceptId], status: "processing" } }));
    log(`Generating image with DALL-E for ${conceptId}...`);
    try {
      // Force openai provider — bypasses AI_PROVIDER_IMAGE env var
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "image", prompt, aspectRatio: "16:9", conceptId, provider: "openai" }),
      });
      const data = await res.json() as { data?: { id: string; status: string; output_url?: string; external_id?: string }; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const gen = data.data;
      if (!gen) throw new Error("No generation returned");
      if (gen.status === "completed" && gen.output_url) {
        setConceptOutputs(p => ({ ...p, [conceptId]: { ...p[conceptId], image: gen.output_url!, status: "completed" } }));
        log(`✓ Image ready: ${gen.id.slice(0, 8)}`);
      } else if (gen.status === "failed") {
        setConceptOutputs(p => ({ ...p, [conceptId]: { ...p[conceptId], status: "failed" } }));
        log(`✗ Image failed (server): ${gen.id.slice(0, 8)}`);
      } else {
        // pending — async provider (e.g. Kling), poll for completion
        queueAdd({ id: gen.id, type: "image", status: "pending", provider: gen.external_id ? "kling" : "openai", prompt, conceptId, completedAt: null, outputUrl: null, externalId: gen.external_id ?? null, mode: "standard", costEstimate: 0.04, error: null });
        log(`Image queued: ${gen.id.slice(0, 8)} — polling...`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setConceptOutputs(p => ({ ...p, [conceptId]: { ...p[conceptId], status: "failed" } }));
      log(`✗ Image failed: ${msg}`);
    }
  }

  // ── Generate video for concept ────────────────────────────────────────────
  async function generateVideo(conceptId: string) {
    const concept = concepts.find(c => c.variantId === conceptId);
    const prompt = stepPrompts.i2v + (concept ? ` Concept: ${concept.headline}.` : "");
    const imageUrl = conceptOutputs[conceptId]?.image;
    setConceptOutputs(p => ({ ...p, [conceptId]: { ...p[conceptId], status: "pending" } }));
    log(`Submitting video for ${conceptId}...`);
    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: imageUrl ? "i2v" : "video", prompt, duration: "5", aspectRatio: "16:9", conceptId, imageUrl }),
      });
      const data = await res.json() as { data?: { id: string; status: string; output_url?: string; external_id?: string }; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const gen = data.data;
      if (!gen) throw new Error("No generation returned");
      if (gen.status === "completed" && gen.output_url) {
        setConceptOutputs(p => ({ ...p, [conceptId]: { ...p[conceptId], video: gen.output_url!, status: "completed" } }));
        log(`✓ Video ready: ${gen.id.slice(0, 8)}`);
      } else if (gen.status === "failed") {
        setConceptOutputs(p => ({ ...p, [conceptId]: { ...p[conceptId], status: "failed" } }));
        log(`✗ Video failed (server): ${gen.id.slice(0, 8)}`);
      } else {
        // pending — Kling async, poll for completion
        queueAdd({ id: gen.id, type: "video", status: "pending", provider: "kling", prompt, conceptId, completedAt: null, outputUrl: null, externalId: gen.external_id ?? null, mode: "standard", costEstimate: 0.20, error: null });
        log(`Video queued: ${gen.id.slice(0, 8)} — polling...`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setConceptOutputs(p => ({ ...p, [conceptId]: { ...p[conceptId], status: "failed" } }));
      log(`✗ Video failed: ${msg}`);
    }
  }

  // ── Run full pipeline ─────────────────────────────────────────────────────
  async function runPipeline() {
    log("▶ Running pipeline for all 3 concepts...");
    await Promise.all(["c1", "c2", "c3"].map(async (cid) => {
      await generateImage(cid);
    }));
  }

  // ── Intake URL analyze ────────────────────────────────────────────────────
  async function analyzeUrl() {
    if (!urlInput.trim()) return;
    setIntakeBusy(true);
    log(`Analyzing: ${urlInput.slice(0, 60)}...`);
    try {
      const res = await fetch("/api/intake/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "url", url: urlInput }),
      });
      const data = await res.json() as { data?: { analysisResult: string; suggestedImagePrompt: string; suggestedStrategy: string } };
      if (!res.ok) throw new Error("Analyze failed");
      const d = data.data!;
      setIntakeAnalysis(d.analysisResult);
      setStepPrompts(p => ({ ...p, imagery: d.suggestedImagePrompt || p.imagery, strategy: d.suggestedStrategy || p.strategy }));
      log(`✓ Analysis complete`);
    } catch (e) {
      log(`✗ Analysis failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    setIntakeBusy(false);
    setActiveIntake(null);
    setUrlInput("");
  }

  // ── AI assistant ──────────────────────────────────────────────────────────
  async function sendAssistantMessage() {
    const text = assistantInput.trim();
    if (!text || assistantBusy) return;
    setAssistantInput("");
    setAssistantBusy(true);
    setAssistantMessages(p => [...p, { role: "user", content: text }]);
    try {
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...assistantMessages, { role: "user", content: text }],
          context: {
            type: "pipeline",
            prompt: stepPrompts[selectedStepId] ?? "",
            settings: { niche: nicheId, concept: selectedConceptId },
            nicheId,
            currentStepId: selectedStepId,
            selectedConceptId,
            stepStates: Object.fromEntries(steps.map(s => [s.id, s.state])),
            intakeAnalysis: intakeAnalysis ?? undefined,
          },
        }),
      });
      const data = await res.json() as { message?: string; actions?: { type: string; payload: Record<string, unknown> }[] };
      const msg = data.message ?? "Done.";
      const actionCount = (data.actions ?? []).length;
      setAssistantMessages(p => [...p, { role: "assistant", content: msg + (actionCount > 0 ? ` (executing ${actionCount} action${actionCount > 1 ? "s" : ""}...)` : "") }]);
      if (actionCount > 0) log(`Assistant: ${actionCount} action(s) — ${(data.actions ?? []).map(a => a.type).join(", ")}`);
      // Execute actions — fall back to selectedConceptId when action omits it
      for (const action of (data.actions ?? [])) {
        const cid = (action.payload.conceptId as string | undefined) ?? selectedConceptId;
        if (action.type === "generate_image") {
          await generateImage(cid);
        } else if (action.type === "generate_video") {
          await generateVideo(cid);
        } else if (action.type === "generate_i2v") {
          await generateVideo(cid);
        } else if (action.type === "update_image_prompt" && action.payload.value) {
          setStepPrompts(p => ({ ...p, imagery: action.payload.value as string }));
        } else if (action.type === "update_strategy_prompt" && action.payload.value) {
          setStepPrompts(p => ({ ...p, strategy: action.payload.value as string }));
        } else if (action.type === "update_copy_prompt" && action.payload.value) {
          setStepPrompts(p => ({ ...p, copy: action.payload.value as string }));
        } else if (action.type === "run_pipeline") {
          await runPipeline();
        } else if (action.type === "select_concept") {
          setSelectedConceptId(cid);
        } else if (action.type === "open_step_config" && action.payload.stepId) {
          setSelectedStepId(action.payload.stepId as string);
          setStepConfigOpen(true);
        } else if (action.type === "set_niche" && action.payload.nicheId) {
          setNicheId(action.payload.nicheId as string);
        } else if (action.type === "update_prompt" && action.payload.new_prompt) {
          setStepPrompts(p => ({ ...p, [selectedStepId]: action.payload.new_prompt as string }));
        }
      }
    } catch (e) {
      setAssistantMessages(p => [...p, { role: "assistant", content: `Error: ${e instanceof Error ? e.message : String(e)}` }]);
    }
    setAssistantBusy(false);
  }

  useEffect(() => {
    assistantEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [assistantMessages]);

  // ── Approve output to workspace ───────────────────────────────────────────
  function approveOutput(type: "image" | "video" | "script", url: string) {
    setApprovedOutputs(p => ({ ...p, [type]: url }));
    setWorkspaceTab("output");
    log(`✓ ${type} approved to workspace`);
  }

  const s = { minHeight: "100vh", background: "#050816", color: "#fff", padding: 20, fontFamily: "Inter,ui-sans-serif,system-ui,-apple-system,sans-serif" } as React.CSSProperties;

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
        textarea, input, select { outline: none; }
        textarea:focus, input:focus { border-color: rgba(34,211,238,0.5) !important; }
      `}</style>
      <input ref={fileInputRef} type="file" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) log(`File: ${f.name}`); }} />

      <div style={s}>
        <div style={{ maxWidth: 1720, margin: "0 auto" }}>

          {/* ── TOP BAR ──────────────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            {/* Niche selector */}
            <select value={nicheId} onChange={e => setNicheId(e.target.value)}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", borderRadius: 10, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>
              <option value="telehealth">Telehealth Master</option>
              <option value="google_ads">Google Ads — Telehealth</option>
            </select>
            <select style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", borderRadius: 10, padding: "8px 12px", fontSize: 13 }}>
              <option>Pipeline Mode</option>
              <option>Manual</option>
              <option>Full Auto</option>
            </select>
            <select style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", borderRadius: 10, padding: "8px 12px", fontSize: 13 }}>
              <option>Output: Image+Video</option>
              <option>Image Only</option>
              <option>Video Only</option>
            </select>
            <div style={{ flex: 1 }} />
            {/* Queue pill */}
            {(activeCount > 0 || queueTrayOpen) && (
              <button onClick={() => setQueueTrayOpen(p => !p)}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: 999, padding: "6px 14px", color: "#67e8f9", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#67e8f9", animation: activeCount > 0 ? "pulse 1.5s infinite" : "none", display: "inline-block" }} />
                Queue {activeCount > 0 ? `  ${activeCount} processing` : ""}
              </button>
            )}
            <button onClick={() => setQueueTrayOpen(p => !p)}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "#94a3b8", borderRadius: 10, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>
              ⬡ Queue
            </button>
            <button style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "#94a3b8", borderRadius: 10, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>Save</button>
            <button style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "#94a3b8", borderRadius: 10, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>Pause</button>
            <button onClick={runPipeline}
              style={{ background: "linear-gradient(90deg,rgba(168,85,247,0.7),rgba(34,211,238,0.6))", border: "none", color: "#fff", borderRadius: 10, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              ▶ Run
            </button>
          </div>

          {/* ── ROW 1: Notifications | AI Assistant | Concept Cards ──────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr", gap: 14, marginBottom: 14 }}>

            {/* Col 1: Reserved / Notifications */}
            <div style={P({ padding: 20, minHeight: 260 })}>
              <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#475569", textTransform: "uppercase", marginBottom: 12 }}>Notifications</div>
              <div style={{ color: "#334155", fontSize: 13, fontStyle: "italic" }}>— Reserved —</div>
            </div>

            {/* Col 2: AI Assistant */}
            <div style={P({ padding: 0, minHeight: 260, display: "flex", flexDirection: "column" })}>
              <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#67e8f9", textTransform: "uppercase" }}>AI Assistant</div>
                {/* Source intake bar */}
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  {(["url", "image", "video", "doc", "audio"] as IntakeType[]).map(t => (
                    <button key={t!} onClick={() => { setActiveIntake(a => a === t ? null : t); if (t !== "url") fileInputRef.current?.click(); }}
                      style={{ background: activeIntake === t ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${activeIntake === t ? "rgba(34,211,238,0.5)" : "rgba(255,255,255,0.1)"}`, color: activeIntake === t ? "#67e8f9" : "#94a3b8", borderRadius: 8, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {t}
                    </button>
                  ))}
                </div>
                {activeIntake === "url" && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <input value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === "Enter" && analyzeUrl()}
                      placeholder="https://..." style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", borderRadius: 8, padding: "6px 10px", fontSize: 12 }} />
                    <button onClick={analyzeUrl} disabled={intakeBusy}
                      style={{ background: "rgba(34,211,238,0.15)", border: "1px solid rgba(34,211,238,0.4)", color: "#67e8f9", borderRadius: 8, padding: "6px 12px", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      {intakeBusy ? <Spinner size={10} /> : "Analyze"}
                    </button>
                  </div>
                )}
                {intakeAnalysis && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "#6ee7b7", background: "rgba(16,185,129,0.08)", borderRadius: 6, padding: "6px 8px" }}>
                    ✓ {intakeAnalysis.slice(0, 120)}...
                  </div>
                )}
              </div>
              {/* Chat history */}
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px", display: "flex", flexDirection: "column", gap: 8, maxHeight: 180 }}>
                {assistantMessages.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "80%", background: m.role === "user" ? "rgba(168,85,247,0.18)" : "rgba(255,255,255,0.06)", border: `1px solid ${m.role === "user" ? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, padding: "7px 11px", fontSize: 12, color: m.role === "user" ? "#e9d5ff" : "#cbd5e1", lineHeight: 1.45 }}>
                      {m.content}
                    </div>
                  </div>
                ))}
                <div ref={assistantEndRef} />
              </div>
              {/* Input */}
              <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 8 }}>
                <input value={assistantInput} onChange={e => setAssistantInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendAssistantMessage()}
                  placeholder="Ask STREAMS..." disabled={assistantBusy}
                  style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#fff", borderRadius: 10, padding: "8px 12px", fontSize: 13 }} />
                <button onClick={sendAssistantMessage} disabled={assistantBusy || !assistantInput.trim()}
                  style={{ background: assistantInput.trim() ? "rgba(34,211,238,0.18)" : "rgba(255,255,255,0.04)", border: `1px solid ${assistantInput.trim() ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.08)"}`, color: assistantInput.trim() ? "#67e8f9" : "#475569", borderRadius: 10, padding: "8px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600 }}>
                  {assistantBusy ? <Spinner size={12} /> : "Send"}
                </button>
              </div>
            </div>

            {/* Col 3: Concept Cards */}
            <div style={P({ padding: 16, minHeight: 260, display: "flex", flexDirection: "column", gap: 10 })}>
              <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#a78bfa", textTransform: "uppercase", marginBottom: 4 }}>Concepts</div>
              {concepts.map((c, i) => (
                <div key={c.variantId} style={{ background: selectedConceptId === c.variantId ? "rgba(168,85,247,0.10)" : "rgba(255,255,255,0.03)", border: `1px solid ${selectedConceptId === c.variantId ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.08)"}`, borderRadius: 12, padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Concept {i + 1}</span>
                    <span style={{ fontSize: 10, background: "rgba(168,85,247,0.15)", color: "#a78bfa", borderRadius: 6, padding: "2px 7px" }}>{i === 0 ? "Recommended" : "Preview"}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 3 }}>{c.headline}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>{c.body ?? c.subheadline ?? ""}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setSelectedConceptId(c.variantId)}
                      style={{ flex: 1, background: selectedConceptId === c.variantId ? "rgba(168,85,247,0.25)" : "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: selectedConceptId === c.variantId ? "#e9d5ff" : "#94a3b8", borderRadius: 7, padding: "5px 0", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                      {selectedConceptId === c.variantId ? "✓ Selected" : "Select"}
                    </button>
                    <button onClick={() => { document.getElementById(`preview-${c.variantId}`)?.scrollIntoView({ behavior: "smooth" }); }}
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b", borderRadius: 7, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>
                      Preview
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── ROW 2: Step Builder | Step Config Rail | Production Workspace */}
          <div style={{ display: "grid", gridTemplateColumns: `220px ${stepConfigOpen ? "280px" : "48px"} 1fr`, gap: 14, marginBottom: 14, transition: "grid-template-columns 200ms ease" }}>

            {/* Step Builder */}
            <div style={P({ padding: 14, display: "flex", flexDirection: "column", gap: 6 })}>
              <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>Pipeline Steps</div>
              {steps.map(step => (
                <div key={step.id} onClick={() => selectStep(step.id)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: selectedStepId === step.id ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${selectedStepId === step.id ? "rgba(168,85,247,0.35)" : "rgba(255,255,255,0.07)"}`, cursor: "pointer", transition: "all 150ms" }}>
                  <span style={{ fontSize: 14, color: stateColor(step.state), flexShrink: 0 }}>{step.icon}</span>
                  <span style={{ flex: 1, fontSize: 12, color: "#cbd5e1", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{step.name}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: stateColor(step.state), flexShrink: 0 }}>{step.state.toUpperCase().slice(0, 4)}</span>
                </div>
              ))}
              <button onClick={() => setSteps(p => [...p, { id: `custom-${Date.now()}`, name: "Custom Step", state: "queued", icon: "+", output: null, error: null, startedAt: null, completedAt: null }])}
                style={{ marginTop: 6, background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)", color: "#475569", borderRadius: 10, padding: "7px 0", fontSize: 12, cursor: "pointer" }}>
                + Add Step
              </button>
            </div>

            {/* Step Config Rail */}
            <div style={P({ overflow: "hidden", display: "flex", flexDirection: "column" })}>
              {!stepConfigOpen ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 0", gap: 16 }}>
                  <button onClick={() => setStepConfigOpen(true)} title="Open step config"
                    style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 16, padding: 4 }}>✎</button>
                </div>
              ) : (
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, letterSpacing: "0.15em", color: "#67e8f9", textTransform: "uppercase" }}>{steps.find(s => s.id === selectedStepId)?.name ?? "Step Config"}</span>
                    <button onClick={() => setStepConfigOpen(false)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 16 }}>✕</button>
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 2 }}>
                    {STEP_PROMPT_FIELD[selectedStepId] ?? "prompt"}
                  </div>
                  <textarea value={stepPrompts[selectedStepId] ?? ""}
                    onChange={e => setStepPrompts(p => ({ ...p, [selectedStepId]: e.target.value }))}
                    rows={8}
                    style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "#e2e8f0", borderRadius: 10, padding: 10, fontSize: 12, resize: "none", lineHeight: 1.55 }} />
                  <button onClick={async () => {
                    const step = steps.find(s => s.id === selectedStepId);
                    if (!step) return;
                    setSteps(p => p.map(s => s.id === selectedStepId ? { ...s, state: "running" } : s));
                    log(`Running ${step.name}...`);
                    try {
                      const res = await fetch("/api/generations", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ type: ["imagery", "i2v"].includes(selectedStepId) ? (selectedStepId === "imagery" ? "image" : "video") : "script", prompt: stepPrompts[selectedStepId] }),
                      });
                      const data = await res.json() as { data?: { id: string } };
                      if (!res.ok) throw new Error("Run failed");
                      setSteps(p => p.map(s => s.id === selectedStepId ? { ...s, state: "complete" } : s));
                      log(`✓ ${step.name} complete`);
                      if (data.data?.id) queueAdd({ id: data.data.id, type: "script", status: "pending", provider: "openai", prompt: stepPrompts[selectedStepId], conceptId: null, completedAt: null, outputUrl: null, externalId: null, mode: "standard", costEstimate: 0.001, error: null });
                    } catch (e) {
                      setSteps(p => p.map(s => s.id === selectedStepId ? { ...s, state: "error", error: e instanceof Error ? e.message : "error" } : s));
                      log(`✗ ${step.name} failed`);
                    }
                  }}
                    style={{ background: "linear-gradient(90deg,rgba(168,85,247,0.5),rgba(34,211,238,0.4))", border: "none", color: "#fff", borderRadius: 10, padding: "9px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    ▶ Run Step
                  </button>
                </div>
              )}
            </div>

            {/* Production Workspace */}
            <div style={P({ display: "flex", flexDirection: "column" })}>
              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0 16px" }}>
                {(["output", "editor", "export", "publish", "logs"] as WorkspaceTab[]).map(t => (
                  <button key={t} onClick={() => setWorkspaceTab(t)}
                    style={{ padding: "11px 14px", fontSize: 12, fontWeight: 600, color: workspaceTab === t ? "#67e8f9" : "#475569", background: "none", border: "none", borderBottom: workspaceTab === t ? "2px solid #67e8f9" : "2px solid transparent", cursor: "pointer", textTransform: "capitalize" }}>
                    {t === "output" ? "Final Output" : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
                <div style={{ flex: 1 }} />
                {/* View switcher */}
                {(["16:9", "9:16"] as ViewMode[]).map(v => (
                  <button key={v} onClick={() => setViewMode(v)}
                    style={{ padding: "6px 10px", fontSize: 11, color: viewMode === v ? "#67e8f9" : "#475569", background: "none", border: "none", cursor: "pointer", fontWeight: viewMode === v ? 700 : 400 }}>
                    {v}
                  </button>
                ))}
                {(["Desktop", "iPhone", "Custom"] as DeviceFrame[]).map(d => (
                  <button key={d} onClick={() => setDeviceFrame(d)}
                    style={{ padding: "6px 10px", fontSize: 11, color: deviceFrame === d ? "#a78bfa" : "#475569", background: "none", border: "none", cursor: "pointer", fontWeight: deviceFrame === d ? 700 : 400 }}>
                    {d}
                  </button>
                ))}
              </div>
              {/* Canvas */}
              <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 320 }}>
                {workspaceTab === "output" && (
                  <div style={{ position: "relative", width: "100%", maxWidth: viewMode === "9:16" ? 200 : 560, aspectRatio: viewMode === "16:9" ? "16/9" : "9/16", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: deviceFrame === "iPhone" ? 28 : 12, overflow: "hidden", boxShadow: deviceFrame === "iPhone" ? "0 0 0 8px rgba(255,255,255,0.06), 0 0 0 9px rgba(255,255,255,0.03)" : "none" }}>
                    {approvedOutputs.video ? (
                      <video src={approvedOutputs.video} controls autoPlay muted loop style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : approvedOutputs.image ? (
                      <img src={approvedOutputs.image} alt="Approved output" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#334155", gap: 8 }}>
                        <div style={{ fontSize: 28 }}>◻</div>
                        <div style={{ fontSize: 12 }}>Approve an output from Preview Screens</div>
                      </div>
                    )}
                  </div>
                )}
                {workspaceTab === "logs" && (
                  <div style={{ width: "100%", height: 300, overflowY: "auto", fontFamily: "monospace", fontSize: 11, color: "#64748b", lineHeight: 1.8 }}>
                    {logs.map((l, i) => <div key={i}>{l}</div>)}
                  </div>
                )}
                {workspaceTab !== "output" && workspaceTab !== "logs" && (
                  <div style={{ color: "#334155", fontSize: 13 }}>{workspaceTab.charAt(0).toUpperCase() + workspaceTab.slice(1)} — coming soon</div>
                )}
              </div>
            </div>
          </div>

          {/* ── ROW 3: 3 Preview Screens ─────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            {concepts.map((concept, i) => {
              const cid = concept.variantId;
              const out = conceptOutputs[cid];
              const tab = previewTabs[cid] ?? "Image";
              const isActive = out?.status === "pending" || out?.status === "processing";
              const qItem = [...generationQueue.values()].find(q => q.conceptId === cid && (q.status === "pending" || q.status === "processing"));

              return (
                <div key={cid} id={`preview-${cid}`} style={P({ padding: 0 })}>
                  {/* Header */}
                  <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>Concept {i + 1}</span>
                      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: isActive ? "#67e8f9" : out?.status === "completed" ? "#6ee7b7" : out?.status === "failed" ? "#f87171" : "#334155", display: "inline-block", animation: isActive ? "pulse 1.5s infinite" : "none" }} />
                        <span style={{ fontSize: 10, color: "#475569" }}>{isActive ? "Processing" : out?.status === "completed" ? "Ready" : out?.status === "failed" ? "Failed" : "Idle"}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 2 }}>{concept.headline}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{concept.cta}</div>
                    {/* Tabs */}
                    <div style={{ display: "flex", gap: 0, marginTop: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      {(["Image", "Video", "Script"] as PreviewTab[]).map(t => (
                        <button key={t} onClick={() => setPreviewTabs(p => ({ ...p, [cid]: t }))}
                          style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, color: tab === t ? "#67e8f9" : "#475569", background: "none", border: "none", borderBottom: tab === t ? "2px solid #67e8f9" : "2px solid transparent", cursor: "pointer" }}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Output area */}
                  <div style={{ padding: 14, minHeight: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    {tab === "Image" && (
                      out?.image ? (
                        <img src={out.image} alt={`Concept ${i + 1}`} style={{ width: "100%", borderRadius: 10, objectFit: "cover", maxHeight: 140 }} />
                      ) : isActive ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "#475569" }}>
                          <Spinner size={20} />
                          <span style={{ fontSize: 11 }}>{qItem ? `${qItem.provider} · ${qItem.elapsedSeconds}s` : "Generating..."}</span>
                        </div>
                      ) : (
                        <div style={{ color: "#334155", fontSize: 12, textAlign: "center" }}>No image yet</div>
                      )
                    )}
                    {tab === "Video" && (
                      out?.video ? (
                        <video src={out.video} controls muted loop style={{ width: "100%", borderRadius: 10, maxHeight: 140 }} />
                      ) : isActive ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "#475569" }}>
                          <Spinner size={20} />
                          <span style={{ fontSize: 11 }}>Video processing...</span>
                        </div>
                      ) : (
                        <div style={{ color: "#334155", fontSize: 12, textAlign: "center" }}>No video yet</div>
                      )
                    )}
                    {tab === "Script" && (
                      <div style={{ width: "100%", fontSize: 11, color: "#64748b", lineHeight: 1.6 }}>
                        {out?.script ?? "No script generated yet."}
                      </div>
                    )}
                  </div>

                  {/* Process preview + action buttons */}
                  <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => approveOutput(tab === "Video" ? "video" : "image", (tab === "Video" ? out?.video : out?.image) ?? "")}
                      disabled={!((tab === "Video" ? out?.video : out?.image))}
                      style={{ flex: 1, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#6ee7b7", borderRadius: 8, padding: "6px 0", fontSize: 11, cursor: "pointer", fontWeight: 600, opacity: (tab === "Video" ? out?.video : out?.image) ? 1 : 0.3 }}>
                      ✓ Approve
                    </button>
                    <button onClick={() => generateImage(cid)}
                      disabled={isActive}
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", borderRadius: 8, padding: "6px 8px", fontSize: 11, cursor: "pointer" }}>
                      🖼 Img
                    </button>
                    <button onClick={() => generateVideo(cid)}
                      disabled={isActive}
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", borderRadius: 8, padding: "6px 8px", fontSize: 11, cursor: "pointer" }}>
                      ▶ Vid
                    </button>
                    <button onClick={() => { setConceptOutputs(p => ({ ...p, [cid]: { image: null, video: null, script: null, status: "idle" } })); log(`Restarted concept ${i + 1}`); }}
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b", borderRadius: 8, padding: "6px 8px", fontSize: 11, cursor: "pointer" }}>
                      ↺
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Generation Queue Tray ─────────────────────────────────────── */}
          {queueTrayOpen && (
            <div style={{ position: "fixed", bottom: 24, right: 24, width: 360, maxHeight: 480, background: "rgba(8,12,33,0.97)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, boxShadow: "0 18px 60px rgba(0,0,0,.3)", display: "flex", flexDirection: "column", zIndex: 1000 }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>Generation Queue</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={queueClearCompleted} style={{ fontSize: 10, color: "#475569", background: "none", border: "none", cursor: "pointer" }}>Clear completed</button>
                  <button onClick={() => setQueueTrayOpen(false)} style={{ color: "#475569", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>✕</button>
                </div>
              </div>
              {/* Filter tabs */}
              <div style={{ display: "flex", padding: "8px 12px", gap: 4, borderBottom: "1px solid rgba(255,255,255,0.06)", overflowX: "auto" }}>
                {(["All","Images","Videos","Scripts","Processing","Completed","Failed"] as const).map(f => (
                  <button key={f} onClick={() => setQueueFilter(f)}
                    style={{ padding: "3px 8px", fontSize: 10, fontWeight: queueFilter === f ? 700 : 400, color: queueFilter === f ? "#67e8f9" : "#475569", background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
                    {f}
                  </button>
                ))}
              </div>
              {/* Items */}
              <div style={{ flex: 1, overflowY: "auto" }}>
                {[...generationQueue.values()]
                  .filter(item => {
                    if (queueFilter === "Images") return item.type === "image";
                    if (queueFilter === "Videos") return item.type === "video";
                    if (queueFilter === "Scripts") return item.type === "script";
                    if (queueFilter === "Processing") return item.status === "pending" || item.status === "processing";
                    if (queueFilter === "Completed") return item.status === "completed";
                    if (queueFilter === "Failed") return item.status === "failed";
                    return true;
                  })
                  .map(item => (
                    <div key={item.id} onClick={() => setSelectedQueueItemId(item.id === selectedQueueItemId ? null : item.id)}
                      style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", cursor: "pointer", background: selectedQueueItemId === item.id ? "rgba(34,211,238,0.05)" : "transparent" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: item.status === "completed" ? "#6ee7b7" : item.status === "failed" ? "#f87171" : "#67e8f9", flexShrink: 0, animation: (item.status === "pending" || item.status === "processing") ? "pulse 1.5s infinite" : "none" }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", flexShrink: 0, width: 40 }}>{item.type}</span>
                        <span style={{ fontSize: 11, color: "#475569", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.prompt.slice(0, 50)}</span>
                        <span style={{ fontSize: 10, color: "#334155", flexShrink: 0 }}>{item.elapsedSeconds}s</span>
                      </div>
                      {selectedQueueItemId === item.id && (
                        <div style={{ marginTop: 8, fontSize: 11, color: "#475569", lineHeight: 1.6 }}>
                          <div>ID: {item.id}</div>
                          <div>Provider: {item.provider}</div>
                          <div>Status: {item.status}</div>
                          {item.outputUrl && <div style={{ marginTop: 4 }}>
                            <a href={item.outputUrl} target="_blank" rel="noreferrer" style={{ color: "#67e8f9" }}>View output ↗</a>
                          </div>}
                          {item.error && <div style={{ color: "#f87171" }}>Error: {item.error}</div>}
                        </div>
                      )}
                    </div>
                  ))}
                {generationQueue.size === 0 && (
                  <div style={{ padding: 24, textAlign: "center", color: "#334155", fontSize: 12 }}>No generations yet</div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
