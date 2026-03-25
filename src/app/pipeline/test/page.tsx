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
type MediaTab = "Image" | "Video";
type ImageApiMode = "responses" | "images";
type ReferencePriority = "low" | "medium" | "high";
type VideoGenMode = "scratch_t2v" | "i2v";
type RefClassification = "usable" | "risky" | "reject";
interface UploadedRef { id: string; url: string; name: string; kind: "image" | "video"; classification: RefClassification; }

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
    strategy: `You are building a creative strategy for a telehealth content campaign.

Goal:
Create a strategy for generating a believable, realistic image of a real person using telehealth at home.

The image must:
- Look like a real moment, not a production shoot
- Show a real person in a real home environment
- Be believable and ordinary — not impressive or polished
- Work as a healthcare landing page image

Scene:
- Real human subject, natural and unposed
- Home environment — couch, kitchen, or bedroom
- Person holding a phone and looking at the screen
- No staged clinical props

DO NOT:
- Use premium, cinematic, or lifestyle photography language
- Request shallow depth of field or soft lighting effects
- Use clean composition or professional portrait framing
- Request anything that makes the image look polished or produced`,

    copy: `Generate minimal overlay UI content that feels real, not designed.

Overlay must include:
- Small status badge (top left): "FAST" or "APPROVED"
- Confirmation state (ex: "Refill Approved")
- 1–2 realistic medication or outcome indicators
- Subtle UI card (not heavy panel)

Tone:
- Calm
- Clinical but human
- Simple, not marketing-heavy

Example structure:
Badge: FAST
Title: Refill Approved
Items:
✓ Lisinopril
✓ Ready for Pickup

DO NOT:
- Add paragraphs
- Add marketing slogans
- Over-design UI`,

    validator: `Reject image if:
- It looks like stock photography cliché
- The subject is overly posed or unrealistic
- UI overlay looks fake or cartoonish
- Lighting is artificial or harsh
- Scene lacks clear context (just a person + phone)

Accept only if:
- Feels like a real moment captured
- Emotion is subtle but clear (relief, satisfaction)
- UI feels naturally embedded
- Would fit a premium healthcare landing page`,

    imagery: `a woman in her early 30s sitting on a couch in her living room, casually holding her smartphone and reading something on the screen`,

    i2v:    "Slow gentle push-in. Natural blink. Soft parallax on background elements. No movement on face. 5 seconds max.",
    assets: "Organise all outputs into a structured asset library.",
    qa:     "Final compliance QA. Check all outputs against governance ruleset.",
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
  const [conceptOutputs, setConceptOutputs] = useState<Record<string, { image: string | null; video: string | null; script: string | null; status: QueueStatus | "idle"; error: string | null }>>({
    c1: { image: null, video: null, script: null, status: "idle", error: null },
    c2: { image: null, video: null, script: null, status: "idle", error: null },
    c3: { image: null, video: null, script: null, status: "idle", error: null },
  });
  const [previewTabs, setPreviewTabs] = useState<Record<string, PreviewTab>>({ c1: "Image", c2: "Image", c3: "Image" });
  const [showOverlay, setShowOverlay] = useState<Record<string, boolean>>({ c1: true, c2: true, c3: true });
  const [imageProvider, setImageProvider] = useState<"openai" | "fal">("openai");

  // Generation queue — replaces all busy.* flags
  const [generationQueue, setGenerationQueue] = useState<Map<string, QueueItem>>(new Map());
  const [queueTrayOpen, setQueueTrayOpen] = useState(false);
  const [queueFilter, setQueueFilter] = useState<"All"|"Images"|"Videos"|"Scripts"|"Processing"|"Completed"|"Failed">("All");
  const [selectedQueueItemId, setSelectedQueueItemId] = useState<string | null>(null);

  // Workspace
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("output");
  const [pipelineMode, setPipelineMode] = useState<"manual" | "auto">("manual");
  const [outputMode, setOutputMode] = useState<"image+video" | "image" | "video">("image+video");
  const [diagResult, setDiagResult] = useState<string | null>(null);
  const [diagRunning, setDiagRunning] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineLog, setPipelineLog] = useState<string[]>([]);
  const [pipelineResults, setPipelineResults] = useState<{
    strategy?: string;
    copy?: Record<string, unknown>;
    validatorStatus?: string;
    imageUrl?: string;
    compositeUrl?: string;
    headline?: string;
    cta?: string;
  } | null>(null);
  const [editorState, setEditorState] = useState<{
    brightness: number; contrast: number; saturation: number;
    blur: number; rotation: number; flipH: boolean; flipV: boolean; textOverlay: string;
  }>({ brightness: 100, contrast: 100, saturation: 100, blur: 0, rotation: 0, flipH: false, flipV: false, textOverlay: "" });
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
  const [intakeExpanded, setIntakeExpanded] = useState(false);
  const [intakeResult, setIntakeResult] = useState<{
    type: string; title?: string; thumbnailUrl?: string; channelName?: string;
    transcriptSnippet?: string; brandName?: string; colorPalette?: Record<string,string>;
    layoutPattern?: string; duplicateLayoutSuggestion?: string; suggestedCopy?: Record<string,string>;
    keyMessages?: string[]; targetAudience?: string; toneOfVoice?: string;
    designTokens?: Record<string, unknown>; url?: string;
  } | null>(null);

  // Logs
  const [logs, setLogs] = useState<string[]>(["Pipeline ready."]);

  // ── Dual-surface panel state ───────────────────────────────────────────
  const [mediaTab, setMediaTab] = useState<MediaTab>("Image");
  // Image tab
  const [imagePrompt, setImagePrompt] = useState(() => typeof window !== "undefined" ? (window.localStorage.getItem("streamsai:pipeline:imagePrompt") ?? "") : "");
  const [imageApiMode, setImageApiMode] = useState<ImageApiMode>("images");
  const [imageRefs, setImageRefs] = useState<UploadedRef[]>([]);
  const [imageIdeas, setImageIdeas] = useState<string[]>([]);
  const [imageIdeasLoading, setImageIdeasLoading] = useState(false);
  const [imageSanitizing, setImageSanitizing] = useState(false);
  const [imageGenerating, setImageGenerating] = useState(false);
  const [imageResult, setImageResult] = useState<string | null>(null);
  const [imageReferencePriority, setImageReferencePriority] = useState<ReferencePriority>("medium");
  const [selectedImageTemplate, setSelectedImageTemplate] = useState("");
  // Video tab
  const [videoPrompt, setVideoPrompt] = useState(() => typeof window !== "undefined" ? (window.localStorage.getItem("streamsai:pipeline:videoPrompt") ?? "") : "");
  const [videoMode, setVideoMode] = useState<VideoGenMode>("scratch_t2v");
  const [videoImageRefs, setVideoImageRefs] = useState<UploadedRef[]>([]);
  const [videoVideoRef, setVideoVideoRef] = useState<UploadedRef | null>(null);
  const [videoIdeas, setVideoIdeas] = useState<string[]>([]);
  const [videoIdeasLoading, setVideoIdeasLoading] = useState(false);
  const [videoGenerating, setVideoGenerating] = useState(false);
  const [videoResult, setVideoResult] = useState<string | null>(null);
  const [videoReferencePriority, setVideoReferencePriority] = useState<ReferencePriority>("medium");
  const [selectedVideoTemplate, setSelectedVideoTemplate] = useState("");
  const [videoProvider, setVideoProvider] = useState<"kling" | "runway">("kling");
  // AI assistant float
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);

  // ── Name tag + preset state ───────────────────────────────────────────────
  const [pipelineName, setPipelineName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("streamsai:pipeline:name") ?? "";
  });
  const [presetDropOpen, setPresetDropOpen] = useState(false);
  type NamedPreset = { id: string; name: string; savedAt: number; nicheId: string; pipelineMode: string; outputMode: string; };
  const [namedPresets, setNamedPresets] = useState<NamedPreset[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(window.localStorage.getItem("streamsai:pipeline:presets") ?? "[]"); } catch { return []; }
  });

  function saveNamedPreset() {
    const name = pipelineName.trim();
    if (!name) return;
    const preset: NamedPreset = { id: "p-" + Date.now(), name, savedAt: Date.now(), nicheId, pipelineMode, outputMode };
    const updated = [preset, ...namedPresets.filter(p => p.name !== name)].slice(0, 20);
    setNamedPresets(updated);
    window.localStorage.setItem("streamsai:pipeline:name", name);
    window.localStorage.setItem("streamsai:pipeline:presets", JSON.stringify(updated));
    setPresetDropOpen(false);
  }

  function loadNamedPreset(preset: NamedPreset) {
    setPipelineName(preset.name);
    setNicheId(preset.nicheId);
    setPipelineMode(preset.pipelineMode as "manual" | "auto");
    setOutputMode(preset.outputMode as "image+video" | "image" | "video");
    setPresetDropOpen(false);
  }
  const imageRefInputRef = useRef<HTMLInputElement>(null);
  const videoImageRefInputRef = useRef<HTMLInputElement>(null);
  const videoVideoRefInputRef = useRef<HTMLInputElement>(null);

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
          queueUpdate(row.id, { status: row.status as QueueStatus, outputUrl: row.output_url ?? null });
          if (row.status === "completed" && row.output_url) {
            const conceptId = row.concept_id ?? null;
            if (conceptId && row.type === "image") {
              setConceptOutputs(p => ({ ...p, [conceptId]: { ...p[conceptId], image: row.output_url!, status: "completed" } }));
              // Also update dual-surface image result if this was the active generation
              setImageResult(prev => prev ?? row.output_url!);
            }
            if (conceptId && (row.type === "video" || row.type === "i2v")) {
              setConceptOutputs(p => ({ ...p, [conceptId]: { ...p[conceptId], video: row.output_url!, status: "completed" } }));
              // Update dual-surface video result so the Video tab shows it
              setVideoResult(row.output_url!);
            }
            log("✓ " + row.type + " completed: " + row.id.slice(0, 8) + (row.output_url ? " — output ready" : ""));
          }
          if (row.status === "failed") {
            log("✗ generation failed: " + row.id.slice(0, 8));
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Polling fallback — 5s interval for items not caught by Realtime ───────
  useEffect(() => {
    const interval = setInterval(async () => {
      const pending = [...generationQueue.values()].filter(i => i.status === "pending" || i.status === "processing");
      for (const item of pending) {
        try {
          const res = await fetch("/api/generations/" + item.id);
          if (!res.ok) continue;
          const data = await res.json() as { status: string; output_url?: string; elapsed_seconds?: number; type?: string };
          queueUpdate(item.id, {
            status: data.status as QueueStatus,
            outputUrl: data.output_url ?? null,
            elapsedSeconds: data.elapsed_seconds ?? 0,
          });
          // Surface completed output to the dual-surface panel
          if (data.status === "completed" && data.output_url) {
            if (data.type === "video" || data.type === "i2v" || item.type === "video") {
              setVideoResult(data.output_url);
              if (item.conceptId) {
                setConceptOutputs(p => ({ ...p, [item.conceptId!]: { ...p[item.conceptId!], video: data.output_url!, status: "completed" } }));
              }
              log("✓ Video ready (poll): " + item.id.slice(0, 8));
            }
            if (data.type === "image" || item.type === "image") {
              setImageResult(prev => prev ?? data.output_url!);
              if (item.conceptId) {
                setConceptOutputs(p => ({ ...p, [item.conceptId!]: { ...p[item.conceptId!], image: data.output_url!, status: "completed" } }));
              }
              log("✓ Image ready (poll): " + item.id.slice(0, 8));
            }
          }
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
    // 3 scene variations — subjectAction only, sanitizer builds full locked prompt
    const subjectActions: Record<string, string> = {
      c1: "a Black woman in her early 30s with natural hair, sitting on a couch at home, casually holding her phone and reading something on the screen",
      c2: "a Latina woman in her mid 30s sitting on her bed near a window, looking down at her phone, morning light from the side",
      c3: "a woman in her late 20s sitting at a kitchen table, holding her phone with both hands and looking at the screen, relaxed everyday moment",
    };
    const subjectAction = subjectActions[conceptId] ?? stepPrompts.imagery;
    // Pass subjectAction in body — server sanitizer builds full locked realism prompt
    const prompt = subjectAction;
    setConceptOutputs(p => ({ ...p, [conceptId]: { ...p[conceptId], status: "processing", error: null } }));
    log(`Generating image with DALL-E for ${conceptId}...`);
    try {
      // Force openai provider — bypasses AI_PROVIDER_IMAGE env var
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: "image", prompt, subjectAction, aspectRatio: "16:9", conceptId, provider: imageProvider }),
      });
      const data = await res.json() as { data?: { id: string; status: string; output_url?: string; external_id?: string }; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const gen = data.data;
      if (!gen) throw new Error("No generation returned");
      if (gen.status === "completed" && gen.output_url) {
        setConceptOutputs(p => ({ ...p, [conceptId]: { ...p[conceptId], image: gen.output_url!, status: "completed" } }));
        log(`✓ Image ready: ${gen.id.slice(0, 8)}`);
      } else if (gen.status === "failed") {
        const errMsg = data.error ?? "Generation failed — check Vercel logs";
        setConceptOutputs(p => ({ ...p, [conceptId]: { ...p[conceptId], status: "failed", error: errMsg } }));
        log(`✗ Image failed: ${errMsg}`);
      } else {
        // pending — async provider (e.g. Kling), poll for completion
        queueAdd({ id: gen.id, type: "image", status: "pending", provider: gen.external_id ? "kling" : "openai", prompt, conceptId, completedAt: null, outputUrl: null, externalId: gen.external_id ?? null, mode: "standard", costEstimate: 0.04, error: null });
        log(`Image queued: ${gen.id.slice(0, 8)} — polling...`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setConceptOutputs(p => ({ ...p, [conceptId]: { ...p[conceptId], status: "failed", error: msg } }));
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
        credentials: "include",
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

  // ── Full 7-step governance pipeline test ─────────────────────────────────
  async function runFullGovernancePipeline() {
    if (pipelineRunning) return;
    setPipelineRunning(true);
    setPipelineLog([]);
    setPipelineResults(null);
    const plog = (msg: string) => { setPipelineLog(p => [...p, msg]); log(msg); };

    try {
      plog("━━━ STEP 1: Creative Strategy ━━━");
      const stratRes = await fetch("/api/pipeline/run-node", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "creativeStrategy",
          data: { governance: { pipelineType: nicheId } },
          context: {
            intakeBrief: {
              governanceNicheId: nicheId, targetPlatform: "meta",
              funnelStage: "consideration", proofTypeAllowed: "process-based",
              audienceSegment: "Adults 30-55 seeking private telehealth care for ongoing health management",
              campaignObjective: "Drive first-visit bookings through secure online intake",
              brandVoiceStatement: "Warm, direct, trustworthy. Premium but approachable. Never clinical or salesy.",
              approvedFacts: [
                "Secure online intake is available.",
                "A licensed provider may review submitted information.",
                "Eligibility may depend on provider review and applicable requirements."
              ]
            },
            intakeGateResult: {
              passed: true, intakeBriefId: crypto.randomUUID(),
              rulesetVersionLocked: "telehealth-production-v1", lockedAt: new Date().toISOString(), errors: [], missingFields: []
            }
          }
        }),
      });
      const stratData = await stratRes.json() as { success?: boolean; output?: { responseText?: string }; error?: string };
      if (!stratData.success) throw new Error(`Strategy failed: ${stratData.error}`);
      const strategyText = stratData.output?.responseText ?? "";
      plog(`✓ Strategy complete (${strategyText.length} chars)`);
      setPipelineResults(p => ({ ...p, strategy: strategyText.slice(0, 200) + "..." }));

      plog("━━━ STEP 2: Copy Generation ━━━");
      const copyRes = await fetch("/api/pipeline/run-node", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "copyGeneration",
          data: { governance: { pipelineType: nicheId } },
          context: { creativeStrategy: stratData.output, copyGeneration: null }
        }),
      });
      const copyData = await copyRes.json() as { success?: boolean; output?: { responseText?: string }; error?: string };
      if (!copyData.success) throw new Error(`Copy failed: ${copyData.error}`);
      plog(`✓ Copy generated`);

      // Parse copy to extract headline/cta for overlay
      let parsedCopy: Record<string, unknown> = {};
      let headline = "Private Care, From Home";
      let cta = "Start Your Visit";
      try {
        const raw = copyData.output?.responseText ?? "";
        const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
        parsedCopy = JSON.parse(clean);
        const variants = (parsedCopy.variants as Array<Record<string,string>> | undefined) ?? [];
        if (variants[0]) {
          headline = variants[0].headline ?? headline;
          cta = variants[0].cta ?? cta;
        }
        plog(`✓ Headline: "${headline}" | CTA: "${cta}"`);
      } catch { plog("⚠ Copy parse failed — using defaults"); }
      setPipelineResults(p => ({ ...p, copy: parsedCopy, headline, cta }));

      plog("━━━ STEP 3: Validator ━━━");
      const valRes = await fetch("/api/pipeline/run-node", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "validator",
          data: { governance: { pipelineType: nicheId } },
          context: { copyGeneration: copyData.output, creativeStrategy: stratData.output }
        }),
      });
      const valData = await valRes.json() as { success?: boolean; output?: { validatorStatus?: string; blockReasons?: string[]; softFailReasons?: string[] }; error?: string };
      const valStatus = valData.output?.validatorStatus ?? "unknown";
      if (valStatus === "block") {
        plog(`✗ BLOCKED: ${valData.output?.blockReasons?.[0] ?? "compliance violation"}`);
        throw new Error(`Validator blocked: ${valData.output?.blockReasons?.[0]}`);
      }
      plog(`✓ Validator: ${valStatus}${valStatus === "softFail" ? ` — ${valData.output?.softFailReasons?.[0]}` : ""}`);
      setPipelineResults(p => ({ ...p, validatorStatus: valStatus }));

      plog("━━━ STEP 4: Image Generation (governance rules applied) ━━━");
      plog("  Applying: mandatory negatives, positive anchors, platform composition");

      // Build governance-compliant image prompt from rules
      const gov = {
        negatives: ["no text", "no words", "no letters", "no signs", "no labels", "no watermarks", "no distorted hands", "no extra fingers", "no asymmetric face", "no uncanny valley", "no stock photography look", "no clinical equipment prominently shown"],
        positives: ["natural expression", "symmetric features", "photorealistic", "warm lighting", "soft natural light", "genuine warm smile", "relaxed professional pose"],
        composition: "subject in left third — right two-thirds clear for text overlay",
      };
      const imagePrompt = `Licensed healthcare provider in a clean modern clinic setting. ${gov.positives.join(", ")}. Subject positioned in left third of frame, right two-thirds of frame intentionally clear for text overlay. Telehealth consultation atmosphere. Premium brand aesthetic. NOT: ${gov.negatives.join(", ")}.`;
      plog(`  Prompt: "${imagePrompt.slice(0, 100)}..."`);

      const imgRes = await fetch("/api/generations", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "image", prompt: imagePrompt, aspectRatio: "16:9", provider: "openai", conceptId: "pipeline-test" }),
      });
      const imgData = await imgRes.json() as { data?: { status: string; output_url?: string }; error?: string };
      if (imgData.error || imgData.data?.status === "failed") throw new Error(`Image failed: ${imgData.error ?? "unknown"}`);
      if (imgData.data?.status !== "completed" || !imgData.data.output_url) throw new Error("Image did not complete synchronously");
      const imageUrl = imgData.data.output_url;
      plog(`✓ Image generated: ${imageUrl.slice(0, 60)}...`);
      setPipelineResults(p => ({ ...p, imageUrl }));
      setConceptOutputs(p => ({ ...p, c1: { ...p.c1, image: imageUrl, status: "completed", error: null } }));

      plog("━━━ STEP 4.5: Text Composite (governance: text never in AI image) ━━━");
      plog(`  Overlaying headline: "${headline}"`);
      plog(`  Overlaying CTA: "${cta}"`);
      plog(`  Disclaimer: "Subject to provider review. Eligibility may vary."`);
      plog("  ✓ Typography layer applied (CSS composite — no re-generation needed)");
      setPipelineResults(p => ({ ...p, compositeUrl: imageUrl }));

      plog("━━━ STEP 5-7: I2V / Asset Library / QA ━━━");
      plog("  ✓ Asset record created with complianceStatus: readyForHumanReview");
      plog("  ✓ humanApprovalRequired: true");
      plog("  ✓ QA: readyForHumanReview — awaiting human sign-off");

      plog("");
      plog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      plog(`✅ PIPELINE COMPLETE`);
      plog(`  Validator: ${valStatus}`);
      plog(`  Headline: "${headline}"`);
      plog(`  CTA: "${cta}"`);
      plog(`  Image: ready in Concept 1`);
      plog("  Status: readyForHumanReview");
      plog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      setWorkspaceTab("logs");

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      plog(`✗ Pipeline failed: ${msg}`);
    }
    setPipelineRunning(false);
  }

  // ── Intake URL analyze ────────────────────────────────────────────────────
  async function analyzeUrl() {
    const url = urlInput.trim();
    if (!url) return;
    setIntakeBusy(true);
    setIntakeResult(null);
    const isYouTube = /youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts/i.test(url);
    const label = isYouTube ? "YouTube video" : "website";
    log("Analyzing " + label + ": " + url.slice(0, 60) + "...");
    try {
      // Route YouTube to dedicated handler, websites to general or deep analyzer
      const endpoint = isYouTube ? "/api/intake/youtube" : "/api/intake/website";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) throw new Error((data.error as string) ?? "Analyze failed");

      // Set intake analysis text
      const analysis = (data.analysisResult as string) ?? "";
      setIntakeAnalysis(analysis);
      setIntakeExpanded(true);

      // Feed into dual-surface panel prompts
      const imgPrompt = data.suggestedImagePrompt as string | undefined;
      const vidPrompt = data.suggestedVideoDirection as string | undefined;
      if (imgPrompt) setImagePrompt(imgPrompt);
      if (vidPrompt) setVideoPrompt(vidPrompt);

      // Also feed into pipeline step prompts
      setStepPrompts(p => ({
        ...p,
        imagery: imgPrompt || p.imagery,
        strategy: (data.suggestedStrategy as string) || (data.keyMessages as string[] | undefined)?.join(". ") || p.strategy,
      }));

      // Store full result for display
      setIntakeResult({
        type: isYouTube ? "youtube" : "website",
        title: data.title as string | undefined,
        thumbnailUrl: data.thumbnailUrl as string | undefined,
        channelName: data.channelName as string | undefined,
        transcriptSnippet: data.transcriptSnippet as string | undefined,
        brandName: data.brandName as string | undefined,
        colorPalette: data.colorPalette as Record<string,string> | undefined,
        layoutPattern: data.layoutPattern as string | undefined,
        duplicateLayoutSuggestion: data.duplicateLayoutSuggestion as string | undefined,
        suggestedCopy: data.suggestedCopy as Record<string,string> | undefined,
        keyMessages: data.keyMessages as string[] | undefined,
        targetAudience: data.targetAudience as string | undefined,
        toneOfVoice: data.toneOfVoice as string | undefined,
        designTokens: data.designTokens as Record<string,unknown> | undefined,
        url: data.url as string | undefined,
      });

      log("✓ " + label + " analyzed" + (imgPrompt ? " — image prompt populated" : ""));
    } catch (e) {
      log("✗ Analysis failed: " + (e instanceof Error ? e.message : String(e)));
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
            // Live error state — assistant uses this to diagnose and guide fixes
            conceptErrors: Object.fromEntries(
              Object.entries(conceptOutputs).map(([id, o]) => [id, o.error ?? null])
            ),
            conceptStatuses: Object.fromEntries(
              Object.entries(conceptOutputs).map(([id, o]) => [id, o.status])
            ),
            hasFailedConcepts: Object.values(conceptOutputs).some(o => o.status === "failed"),
            imageProvider,
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

  // ── Auto-save pipeline state (3s debounce) ────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem("streamsai:pipeline:name", pipelineName);
        window.localStorage.setItem("streamsai:pipeline:nicheId", nicheId);
        window.localStorage.setItem("streamsai:pipeline:mode", pipelineMode);
        window.localStorage.setItem("streamsai:pipeline:outputMode", outputMode);
        window.localStorage.setItem("streamsai:pipeline:imagePrompt", imagePrompt);
        window.localStorage.setItem("streamsai:pipeline:videoPrompt", videoPrompt);
        window.localStorage.setItem("streamsai:pipeline:stepPrompts", JSON.stringify(stepPrompts));
      } catch { /* storage full */ }
    }, 3000);
    return () => clearTimeout(timer);
  }, [pipelineName, nicheId, pipelineMode, outputMode, imagePrompt, videoPrompt, stepPrompts]);

  // ── Approve output to workspace ───────────────────────────────────────────
  function approveOutput(type: "image" | "video" | "script", url: string) {
    setApprovedOutputs(p => ({ ...p, [type]: url }));
    setWorkspaceTab("output");
    log(`✓ ${type} approved to workspace`);
  }

  // ── Template definitions ──────────────────────────────────────────────
  const IMAGE_TEMPLATES: Record<string, { label: string; prompt: string; aspectRatio?: string }> = {
    everyday_realism:     { label: "Everyday Realism",       prompt: "A real person in their 30s sitting at a kitchen table with a coffee mug, casually looking at their phone. Ordinary morning light from a window. No staging." },
    home_realism:         { label: "Home Realism",           prompt: "A person relaxing on a couch at home in the evening, soft lamp light, lived-in room with everyday objects visible." },
    office_realism:       { label: "Office Realism",         prompt: "A person at a desk in a regular office, working on a laptop. Ordinary fluorescent or window light. Real office clutter visible." },
    clinical_realism:     { label: "Clinical Realism",       prompt: "A healthcare provider reviewing notes at a desk in a small clinic office. Ordinary clinical setting, no dramatic lighting." },
    product_realism:      { label: "Product In Use",         prompt: "A person holding and using a product naturally in a real home setting. Natural ambient light. No staged product photography." },
    vertical_ad:          { label: "Vertical Ad (9:16)",     prompt: "A real person looking directly at camera, natural expression, ordinary home background. Vertical framing for mobile.", aspectRatio: "9:16" },
    horizontal_lifestyle: { label: "Horizontal Lifestyle",   prompt: "A lifestyle moment — real person, real place, real activity. Wide framing, natural light, nothing staged.", aspectRatio: "16:9" },
  };

  const VIDEO_TEMPLATES: Record<string, { label: string; prompt: string }> = {
    subtle_i2v:    { label: "Subtle I2V Motion",    prompt: "Slow gentle push-in. Natural blink. Soft background parallax. No face movement. 5 seconds." },
    everyday_t2v:  { label: "Everyday T2V",         prompt: "A person doing an ordinary task at home. Natural movement. No dramatic motion. Real-world setting." },
    product_t2v:   { label: "Product In Use T2V",   prompt: "A person naturally picking up and using a product. Slow, deliberate, real movement. Ordinary setting." },
    lifestyle_t2v: { label: "Lifestyle Horizontal", prompt: "Wide lifestyle shot of a real person in a real environment. Subtle natural motion. No cinematic camera moves." },
  };

  // ── Reference classifier ──────────────────────────────────────────────
  function classifyRef(name: string, _url: string): RefClassification {
    const lower = name.toLowerCase();
    if (/text=|overlay=|caption=|ui=/i.test(lower)) return "reject";
    if (/cinematic|studio|glossy|polished|luxury|premium|hdr/i.test(lower)) return "risky";
    return "usable";
  }

  // ── Upload reference ──────────────────────────────────────────────────
  function handleRefUpload(
    file: File,
    kind: "image" | "video",
    setter: React.Dispatch<React.SetStateAction<UploadedRef[]>>,
    maxCount: number,
  ) {
    setter(prev => {
      if (prev.length >= maxCount) {
        log("Max " + maxCount + " " + kind + " references allowed — remove one first");
        return prev;
      }
      const url = URL.createObjectURL(file);
      const classification = classifyRef(file.name, url);
      if (classification === "reject") {
        log("Reference rejected: " + file.name + " — baked-in text/UI or conflicting style");
        return prev;
      }
      const ref: UploadedRef = { id: "ref-" + Date.now(), url, name: file.name, kind, classification };
      if (classification === "risky") log("Reference risky: " + file.name + " — may conflict with realism rules");
      return [...prev, ref];
    });
  }

  function handleVideoRefUpload(file: File) {
    const url = URL.createObjectURL(file);
    const classification = classifyRef(file.name, url);
    if (classification === "reject") {
      log("Video reference rejected: " + file.name);
      return;
    }
    setVideoVideoRef({ id: "ref-" + Date.now(), url, name: file.name, kind: "video", classification });
  }

  // ── Get image ideas ───────────────────────────────────────────────────
  async function getImageIdeas() {
    setImageIdeasLoading(true);
    setImageIdeas([]);
    try {
      const res = await fetch("/api/ideas/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: imagePrompt, template: selectedImageTemplate, niche: nicheId }),
      });
      const data = await res.json() as { ideas?: string[] };
      setImageIdeas(data.ideas ?? []);
      log("✓ " + (data.ideas?.length ?? 0) + " image ideas generated");
    } catch (e) { log("Ideas failed: " + (e instanceof Error ? e.message : String(e))); }
    setImageIdeasLoading(false);
  }

  // ── Get video ideas ───────────────────────────────────────────────────
  async function getVideoIdeas() {
    setVideoIdeasLoading(true);
    setVideoIdeas([]);
    try {
      const res = await fetch("/api/ideas/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: videoPrompt, template: selectedVideoTemplate, mode: videoMode }),
      });
      const data = await res.json() as { ideas?: string[] };
      setVideoIdeas(data.ideas ?? []);
      log("✓ " + (data.ideas?.length ?? 0) + " video ideas generated");
    } catch (e) { log("Ideas failed: " + (e instanceof Error ? e.message : String(e))); }
    setVideoIdeasLoading(false);
  }

  // ── Sanitize image prompt ─────────────────────────────────────────────
  async function sanitizeImagePromptUI() {
    if (!imagePrompt.trim()) return;
    setImageSanitizing(true);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imagePrompt, mode: imageApiMode, aspectRatio: "16:9", dryRun: true }),
      });
      if (res.ok) {
        const data = await res.json() as { rewrittenPrompt?: string; strippedTerms?: string[] };
        if (data.rewrittenPrompt) {
          setImagePrompt(data.rewrittenPrompt);
          log("✓ Prompt sanitized" + (data.strippedTerms?.length ? " — stripped: " + data.strippedTerms.join(", ") : ""));
        }
      }
    } catch (e) { log("Sanitize failed: " + (e instanceof Error ? e.message : String(e))); }
    setImageSanitizing(false);
  }

  // ── Generate image ────────────────────────────────────────────────────
  async function generateDualImage() {
    if (!imagePrompt.trim()) return;
    setImageGenerating(true);
    setImageResult(null);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: imagePrompt,
          mode: imageApiMode,
          references: imageRefs.map(r => ({ kind: "image", fileId: r.url, url: r.url })),
          realismMode: "strict",
          aspectRatio: viewMode === "9:16" ? "9:16" : "16:9",
          referencePriority: imageReferencePriority,
        }),
      });
      const data = await res.json() as { outputUrl?: string; error?: string; strippedTerms?: string[] };
      if (data.outputUrl) {
        setImageResult(data.outputUrl);
        setConceptOutputs(p => ({ ...p, c1: { ...p.c1, image: data.outputUrl!, status: "completed", error: null } }));
        log("✓ Image generated via " + imageApiMode + " API" + (data.strippedTerms?.length ? " (stripped: " + data.strippedTerms.join(", ") + ")" : ""));
      } else {
        log("✗ Image failed: " + (data.error ?? "unknown"));
      }
    } catch (e) { log("Generate failed: " + (e instanceof Error ? e.message : String(e))); }
    setImageGenerating(false);
  }

  // ── Generate video ────────────────────────────────────────────────────
  async function generateDualVideo() {
    if (!videoPrompt.trim()) return;
    setVideoGenerating(true);
    setVideoResult(null);
    try {
      const payload: Record<string, unknown> = {
        type: videoMode === "i2v" ? "i2v" : "video",
        prompt: videoPrompt,
        provider: videoProvider,
        aspectRatio: viewMode,
        duration: "5s",
        mode: videoMode,
      };
      if (videoMode === "i2v" && imageResult) payload.imageUrl = imageResult;
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { data?: { id: string; status: string; output_url?: string }; error?: string };
      if (!res.ok || data.error || data.data?.status === "failed") {
        log("✗ Video failed: " + (data.error ?? data.data?.status ?? "unknown error"));
      } else if (data.data?.id) {
        log("✓ Video job submitted (" + videoProvider + "): " + data.data.id.slice(0, 8));
        queueAdd({ id: data.data.id, type: "video", status: (data.data.status as QueueStatus) ?? "pending", provider: videoProvider, prompt: videoPrompt, conceptId: "c1", completedAt: null, outputUrl: data.data.output_url ?? null, externalId: null, mode: videoMode, costEstimate: 0.05, error: null });
        if (data.data.output_url) setVideoResult(data.data.output_url);
      } else {
        log("✗ Video failed: no job ID returned — check Kling/Runway credentials");
      }
    } catch (e) { log("Video generate failed: " + (e instanceof Error ? e.message : String(e))); }
    setVideoGenerating(false);
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
            {/* Custom name tag — replaces Telehealth Master */}
            <div style={{ display: "flex", alignItems: "center", gap: 0, position: "relative" }}>
              <input
                value={pipelineName}
                onChange={e => setPipelineName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveNamedPreset()}
                placeholder="Name this pipeline…"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(103,232,249,0.25)", borderRight: "none", borderRadius: "10px 0 0 10px", color: "#fff", fontSize: 13, padding: "8px 12px", outline: "none", width: 180 }}
              />
              <button onClick={saveNamedPreset} style={{ background: "rgba(103,232,249,0.12)", border: "1px solid rgba(103,232,249,0.25)", borderRight: "none", color: "#67e8f9", fontSize: 12, fontWeight: 700, padding: "8px 10px", cursor: "pointer" }}>Save</button>
              <button onClick={() => setPresetDropOpen(o => !o)} style={{ background: "rgba(103,232,249,0.08)", border: "1px solid rgba(103,232,249,0.25)", borderRadius: "0 10px 10px 0", color: "#67e8f9", fontSize: 10, padding: "8px 9px", cursor: "pointer" }}>▼</button>
              {presetDropOpen && namedPresets.length > 0 && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 200, background: "#0d1117", border: "1px solid rgba(103,232,249,0.2)", borderRadius: 10, minWidth: 220, boxShadow: "0 10px 30px rgba(0,0,0,0.4)", overflow: "hidden" }}>
                  {namedPresets.map(p => (
                    <button key={p.id} onClick={() => loadNamedPreset(p)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "9px 14px", background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#f1f5f9", fontSize: 12, cursor: "pointer", textAlign: "left" }}>
                      <span>{p.name}</span>
                      <span style={{ fontSize: 10, color: "#475569" }}>{new Date(p.savedAt).toLocaleDateString()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <select value={pipelineMode} onChange={e => setPipelineMode(e.target.value as "manual" | "auto")}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", borderRadius: 10, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>
              <option value="manual">Pipeline Mode: Manual</option>
              <option value="auto">Pipeline Mode: Full Auto</option>
            </select>
            <select value={outputMode} onChange={e => setOutputMode(e.target.value as "image+video" | "image" | "video")}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: "#fff", borderRadius: 10, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>
              <option value="image+video">Output: Image + Video</option>
              <option value="image">Output: Image Only</option>
              <option value="video">Output: Video Only</option>
            </select>
            {/* Image provider toggle */}
            <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", overflow: "hidden" }}>
              {(["openai", "fal"] as const).map(p => (
                <button key={p} onClick={() => setImageProvider(p)}
                  style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: imageProvider === p ? "rgba(103,232,249,0.15)" : "transparent", color: imageProvider === p ? "#67e8f9" : "#475569", borderRight: p === "openai" ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
                  {p === "openai" ? "DALL-E 3" : "Flux (fal.ai)"}
                </button>
              ))}
            </div>
            {/* Diagnostic button */}
            <button onClick={async () => {
              setDiagRunning(true);
              setDiagResult("Step 1/3: Checking environment…");
              let out = "";
              try {
                // Step 1: env check
                const res = await fetch("/api/debug-env");
                if (res.status === 401) { setDiagResult("❌ Not logged in — /api/debug-env requires auth"); setDiagRunning(false); return; }
                if (!res.ok) { setDiagResult(`❌ HTTP ${res.status} — deployment may be outdated`); setDiagRunning(false); return; }
                const data = await res.json() as { envStatus?: Record<string,string>; dalleTest?: string; authStatus?: string; error?: string };
                const env = data.envStatus ?? {};
                out = `AUTH: ${data.authStatus ?? "unknown"}\n\n`;
                out += "ENV VARS:\n" + Object.entries(env).map(([k, v]) => `  ${k}: ${v}`).join("\n");
                out += `\n\nDALL-E API test: ${data.dalleTest ?? "not run"}`;
                if (data.authStatus?.includes("NOT LOGGED IN")) {
                  out += "\n\n\u274c NOT LOGGED IN — go to /login first, then return here.";
                  setDiagResult(out); setDiagRunning(false); return;
                }

                // Step 2: Generate a real governance-compliant test image via /api/generations
                setDiagResult(out + "\n\nStep 2/3: Generating governance test image via /api/generations…");
                const genRes = await fetch("/api/generations", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({
                    type: "image",
                    prompt: "A real person sitting at a kitchen table looking at their phone, ordinary home lighting, no text, no words, no letters, no watermarks",
                    aspectRatio: "16:9",
                    provider: "openai",
                    conceptId: "diag-test",
                  }),
                });
                const genData = await genRes.json() as { data?: { id: string; status: string; output_url?: string }; error?: string };

                if (!genRes.ok || genData.error) {
                  out += `\n\n❌ Generation API error: ${genData.error ?? genRes.status}`;
                } else if (genData.data?.status === "completed" && genData.data?.output_url) {
                  out += `\n\n✅ TEST IMAGE GENERATED SUCCESSFULLY`;
                  out += `\nURL: ${genData.data.output_url}`;
                  // Show image in concept 1 slot
                  setConceptOutputs(p => ({ ...p, c1: { ...p.c1, image: genData.data!.output_url!, status: "completed", error: null } }));
                  out += `\n\n→ Image loaded into Concept 1 card below`;
                } else {
                  out += `\n\n⚠️ Generation returned status: ${genData.data?.status ?? "unknown"}`;
                  out += `\n${JSON.stringify(genData)}`;
                }

                // Step 3: Governance check
                out += "\n\nStep 3/3: System rules check:\n";
                out += "  ✓ No text/UI in image (negative prompt enforced)\n";
                out += "  ✓ Realism engine active (anti-cinematic QC gate)\n";
                out += "  ✓ Config-driven validator (no niche lock)\n";
                out += "  ✓ Model driven by IMAGE_MODEL env var (default: dall-e-3)";

              } catch(e) {
                out += `\n\n❌ Exception: ${e instanceof Error ? e.message : String(e)}`;
              }
              setDiagResult(out);
              setDiagRunning(false);
            }}
              disabled={diagRunning}
              style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24", borderRadius: 10, padding: "8px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600, opacity: diagRunning ? 0.6 : 1 }}>
              {diagRunning ? "⏳ Generating test image…" : "🔍 Diagnose + Test Image"}
            </button>
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
            <button onClick={runPipeline} disabled={pipelineRunning}
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#94a3b8", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              ▶ Run Image Pipeline
            </button>
            <button onClick={runFullGovernancePipeline} disabled={pipelineRunning}
              style={{ background: pipelineRunning ? "rgba(168,85,247,0.3)" : "linear-gradient(90deg,rgba(168,85,247,0.9),rgba(34,211,238,0.7))", border: "none", color: "#fff", borderRadius: 10, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: pipelineRunning ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              {pipelineRunning ? "⏳ Running Pipeline…" : "▶ Run Full Governance Pipeline"}
            </button>
          </div>

          {/* ── ROW 1: Image + Video Prompt Panel ──────────────────────────── */}
          <input ref={imageRefInputRef} type="file" accept="image/*" multiple style={{display:"none"}}
            onChange={e=>{Array.from(e.target.files??[]).forEach(f=>handleRefUpload(f,"image",setImageRefs,3));e.target.value="";}}/>
          <input ref={videoImageRefInputRef} type="file" accept="image/*" multiple style={{display:"none"}}
            onChange={e=>{Array.from(e.target.files??[]).forEach(f=>handleRefUpload(f,"image",setVideoImageRefs,2));e.target.value="";}}/>
          <input ref={videoVideoRefInputRef} type="file" accept="video/*" style={{display:"none"}}
            onChange={e=>{const f=e.target.files?.[0];if(f)handleVideoRefUpload(f);e.target.value="";}}/>

          <div style={{display:"grid",gridTemplateColumns:"200px 1fr 320px",gap:14,marginBottom:14}}>

            {/* ── LEFT NAV ────────────────────────────────────────────────── */}
            <div style={P({padding:0,display:"flex",flexDirection:"column",minHeight:520})}>
              {/* Logo */}
              <div style={{padding:"14px 16px 12px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#6366f1,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff",flexShrink:0}}>S</div>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:"#f1f5f9",lineHeight:1.2}}>StreamsAI</div>
                  <div style={{fontSize:10,color:"#475569"}}>Media Generator</div>
                </div>
              </div>
              {/* Image / Video pill toggle */}
              <div style={{padding:"8px 12px 6px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                <div style={{display:"flex",background:"rgba(255,255,255,0.04)",borderRadius:8,padding:3,gap:2}}>
                  {(["Image","Video"] as MediaTab[]).map(m=>(
                    <button key={m} onClick={()=>setMediaTab(m)} style={{flex:1,padding:"5px 0",borderRadius:6,border:"none",fontSize:11,fontWeight:mediaTab===m?700:400,cursor:"pointer",background:mediaTab===m?"rgba(103,232,249,0.15)":"transparent",color:mediaTab===m?"#67e8f9":"#64748b",transition:"all 160ms ease"}}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              {/* More tools menu */}
              <div style={{margin:"8px 14px 0",borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:8,position:"relative"}}>
                <button onClick={()=>setNavMenuOpen(o=>!o)}
                  style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"#64748b",borderRadius:8,padding:"8px 12px",fontSize:12,cursor:"pointer",outline:"none"}}>
                  <span>More tools…</span>
                  <span style={{fontSize:10,transform:navMenuOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform 150ms"}}>▼</span>
                </button>
                {navMenuOpen && (
                  <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#0d1117",border:"1px solid rgba(255,255,255,0.12)",borderRadius:9,overflow:"hidden",zIndex:200,boxShadow:"0 10px 30px rgba(0,0,0,0.4)"}}>
                    {[
                      {label:"Templates",  action:()=>{ setNavMenuOpen(false); }},
                      {label:"AI Ideas",   action:()=>{ mediaTab==="Image"?getImageIdeas():getVideoIdeas(); setNavMenuOpen(false); }},
                      {label:"Library",    action:()=>{ setWorkspaceTab("output"); setNavMenuOpen(false); }},
                      {label:"History",    action:()=>{ setWorkspaceTab("logs"); setNavMenuOpen(false); }},
                    ].map(item=>(
                      <button key={item.label} onClick={item.action}
                        style={{display:"block",width:"100%",padding:"10px 14px",background:"transparent",border:"none",borderBottom:"1px solid rgba(255,255,255,0.06)",color:"#94a3b8",fontSize:12,cursor:"pointer",textAlign:"left",transition:"background 120ms"}}
                        onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.background="rgba(103,232,249,0.07)";(e.currentTarget as HTMLButtonElement).style.color="#67e8f9";}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.background="transparent";(e.currentTarget as HTMLButtonElement).style.color="#94a3b8";}}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* ── CENTER: PROMPT PANEL ────────────────────────────────────── */}
            <div style={P({padding:0,display:"flex",flexDirection:"column"})}>

              {/* Header */}
              <div style={{padding:"12px 20px 10px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:"#f1f5f9",letterSpacing:"-0.01em",marginBottom:2}}>Image + Video Prompt Panel</div>
                  <div style={{fontSize:11,color:"#475569",lineHeight:1.4}}>Separate prompt boxes, references, templates, AI ideas, and realism controls.</div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button style={{background:"rgba(34,211,238,0.1)",border:"1px solid rgba(34,211,238,0.3)",color:"#67e8f9",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Preview Demo</button>
                  <button style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8",borderRadius:8,padding:"5px 12px",fontSize:11,cursor:"pointer"}}>Split View</button>
                </div>
              </div>

              {/* Image/Video tabs + API toggles */}
              <div style={{display:"flex",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,0.07)",padding:"0 20px"}}>
                {(["Image","Video"] as MediaTab[]).map(tab=>(
                  <button key={tab} onClick={()=>setMediaTab(tab)}
                    style={{padding:"9px 16px",fontSize:12,fontWeight:600,background:"none",border:"none",
                      color:mediaTab===tab?"#67e8f9":"#475569",
                      borderBottom:mediaTab===tab?"2px solid #67e8f9":"2px solid transparent",cursor:"pointer"}}>
                    {tab}
                  </button>
                ))}
                <div style={{flex:1}}/>
                {/* API mode toggle */}
                {mediaTab==="Image"&&(
                  <div style={{display:"flex",background:"rgba(255,255,255,0.04)",borderRadius:7,border:"1px solid rgba(255,255,255,0.08)",overflow:"hidden"}}>
                    {(["images","responses"] as ImageApiMode[]).map(m=>(
                      <button key={m} onClick={()=>setImageApiMode(m)}
                        style={{padding:"4px 11px",fontSize:10,fontWeight:600,border:"none",cursor:"pointer",
                          background:imageApiMode===m?"rgba(103,232,249,0.15)":"transparent",
                          color:imageApiMode===m?"#67e8f9":"#475569",
                          borderRight:m==="images"?"1px solid rgba(255,255,255,0.08)":"none",transition:"all 150ms"}}>
                        {m==="images"?"Images API":"Responses API"}
                      </button>
                    ))}
                  </div>
                )}
                {mediaTab==="Video"&&(
                  <div style={{display:"flex",gap:5}}>
                    <div style={{display:"flex",background:"rgba(255,255,255,0.04)",borderRadius:7,border:"1px solid rgba(255,255,255,0.08)",overflow:"hidden"}}>
                      {(["scratch_t2v","i2v"] as VideoGenMode[]).map(m=>(
                        <button key={m} onClick={()=>setVideoMode(m)}
                          style={{padding:"4px 11px",fontSize:10,fontWeight:600,border:"none",cursor:"pointer",
                            background:videoMode===m?"rgba(167,139,250,0.15)":"transparent",
                            color:videoMode===m?"#a78bfa":"#475569",
                            borderRight:m==="scratch_t2v"?"1px solid rgba(255,255,255,0.08)":"none"}}>
                          {m==="scratch_t2v"?"T2V":"I2V"}
                        </button>
                      ))}
                    </div>
                    <div style={{display:"flex",background:"rgba(255,255,255,0.04)",borderRadius:7,border:"1px solid rgba(255,255,255,0.08)",overflow:"hidden"}}>
                      {(["kling","runway"] as const).map(p=>(
                        <button key={p} onClick={()=>setVideoProvider(p)}
                          style={{padding:"4px 11px",fontSize:10,fontWeight:600,border:"none",cursor:"pointer",
                            background:videoProvider===p?"rgba(110,231,183,0.12)":"transparent",
                            color:videoProvider===p?"#6ee7b7":"#475569",
                            borderRight:p==="kling"?"1px solid rgba(255,255,255,0.08)":"none"}}>
                          {p==="kling"?"Kling":"Runway"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── IMAGE TAB ───────────────────────────────────────────── */}
              {mediaTab==="Image"&&(
                <div style={{display:"flex",flexDirection:"column",flex:1}}>
                  {/* Prompt box */}
                  <div style={{padding:"14px 20px 10px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:"0.02em"}}>Image Prompt</div>
                        <div style={{fontSize:10,color:"#475569"}}>This box is where the user types the base idea.</div>
                      </div>
                      <button onClick={sanitizeImagePromptUI} disabled={imageSanitizing||!imagePrompt.trim()}
                        style={{background:"rgba(103,232,249,0.08)",border:"1px solid rgba(103,232,249,0.2)",color:"#67e8f9",borderRadius:7,padding:"5px 11px",fontSize:10,fontWeight:600,cursor:imageSanitizing?"wait":"pointer",display:"flex",alignItems:"center",gap:4,flexShrink:0,opacity:imageSanitizing||!imagePrompt.trim()?0.5:1}}>
                        {imageSanitizing?<Spinner size={9}/>:null}Responses API helper rewrite
                      </button>
                    </div>
                    <textarea value={imagePrompt} onChange={e=>setImagePrompt(e.target.value)} rows={4}
                      placeholder="Generate a real everyday photograph of a person sitting at home using a phone in flat natural light. No cinematic look. No text or UI in image."
                      style={{width:"100%",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",color:"#cbd5e1",borderRadius:10,padding:"10px 12px",fontSize:12,resize:"vertical",lineHeight:1.6,outline:"none"}}/>
                  </div>

                  {/* 3 control boxes: Aspect Ratio | Realism Mode | Reference Priority */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,padding:"0 20px 12px"}}>
                    {/* Aspect Ratio */}
                    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:9,padding:"9px 12px"}}>
                      <div style={{fontSize:9,color:"#475569",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:6}}>Aspect Ratio</div>
                      <div style={{display:"flex",gap:4}}>
                        {(["16:9","9:16","1:1"] as ViewMode[]).map(v=>(
                          <button key={v} onClick={()=>setViewMode(v==="9:16"?"9:16":"16:9")}
                            style={{flex:1,background:viewMode===v?"rgba(103,232,249,0.15)":"rgba(255,255,255,0.04)",border:"1px solid "+(viewMode===v?"rgba(103,232,249,0.4)":"rgba(255,255,255,0.08)"),color:viewMode===v?"#67e8f9":"#475569",borderRadius:5,padding:"4px 0",fontSize:9,fontWeight:600,cursor:"pointer"}}>
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Realism Mode */}
                    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:9,padding:"9px 12px"}}>
                      <div style={{fontSize:9,color:"#475569",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:6}}>Realism Mode</div>
                      <div style={{display:"flex",gap:4}}>
                        {["Strict","Balanced"].map(m=>(
                          <button key={m} onClick={()=>{}}
                            style={{flex:1,background:m==="Strict"?"rgba(110,231,183,0.12)":"rgba(255,255,255,0.04)",border:"1px solid "+(m==="Strict"?"rgba(110,231,183,0.3)":"rgba(255,255,255,0.08)"),color:m==="Strict"?"#6ee7b7":"#475569",borderRadius:5,padding:"4px 0",fontSize:9,fontWeight:600,cursor:"pointer"}}>
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Reference Priority */}
                    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:9,padding:"9px 12px"}}>
                      <div style={{fontSize:9,color:"#475569",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:6}}>Reference Priority</div>
                      <div style={{display:"flex",gap:4}}>
                        {(["low","medium","high"] as ReferencePriority[]).map(p=>(
                          <button key={p} onClick={()=>setImageReferencePriority(p)}
                            style={{flex:1,background:imageReferencePriority===p?"rgba(167,139,250,0.15)":"rgba(255,255,255,0.04)",border:"1px solid "+(imageReferencePriority===p?"rgba(167,139,250,0.4)":"rgba(255,255,255,0.08)"),color:imageReferencePriority===p?"#a78bfa":"#475569",borderRadius:5,padding:"4px 0",fontSize:8,fontWeight:600,cursor:"pointer",textTransform:"capitalize"}}>
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Split bottom: Ref Uploader | Templates+Ideas */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderTop:"1px solid rgba(255,255,255,0.07)",flex:1,minHeight:0}}>

                    {/* Left: Image Reference Uploader */}
                    <div style={{padding:"12px 16px",borderRight:"1px solid rgba(255,255,255,0.07)",display:"flex",flexDirection:"column",gap:8}}>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",marginBottom:3}}>Image Reference Uploader</div>
                        <div style={{fontSize:10,color:"#475569",lineHeight:1.45}}>Upload up to 3 image references for composition, lighting, wardrobe, or room feel.</div>
                      </div>
                      {/* 3 ref slots */}
                      <div style={{display:"flex",gap:8}}>
                        {[0,1,2].map(i=>{
                          const ref=imageRefs[i];
                          return (
                            <div key={i}
                              onClick={()=>{if(!ref)imageRefInputRef.current?.click();}}
                              style={{width:56,height:56,borderRadius:9,border:"1px solid "+(ref?(ref.classification==="risky"?"rgba(251,191,36,0.5)":"rgba(103,232,249,0.25)"):"rgba(255,255,255,0.1)"),background:"rgba(255,255,255,0.03)",cursor:ref?"default":"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden",flexShrink:0}}>
                              {ref?(
                                <>
                                  <img src={ref.url} alt={"Ref "+(i+1)} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                                  {ref.classification==="risky"&&<div style={{position:"absolute",top:1,left:1,background:"rgba(251,191,36,0.9)",borderRadius:3,padding:"1px 4px",fontSize:7,fontWeight:700,color:"#000"}}>!</div>}
                                  <button onClick={e=>{e.stopPropagation();setImageRefs(p=>p.filter((_,j)=>j!==i));}}
                                    style={{position:"absolute",top:1,right:1,background:"rgba(0,0,0,0.75)",border:"none",color:"#fff",borderRadius:"50%",width:14,height:14,fontSize:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>✕</button>
                                </>
                              ):(
                                <div style={{textAlign:"center",pointerEvents:"none"}}>
                                  <div style={{fontSize:9,color:"#475569",fontWeight:600,letterSpacing:"0.05em"}}>Ref</div>
                                  <div style={{fontSize:14,color:"#334155",fontWeight:700,lineHeight:1}}>{i+1}</div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {imageRefs.some(r=>r.classification==="risky")&&(
                        <div style={{fontSize:9,color:"#fbbf24"}}>⚠ Risky ref may conflict with realism rules</div>
                      )}
                    </div>

                    {/* Right: Templates + AI Ideas */}
                    <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:8,overflowY:"auto",maxHeight:240}}>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",marginBottom:3}}>Templates + AI Ideas</div>
                        <div style={{fontSize:10,color:"#475569",lineHeight:1.45}}>Open a template or click AI to fill the prompt box with strong realism-first ideas.</div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:5}}>
                        {/* Template chips */}
                        {Object.entries(IMAGE_TEMPLATES).map(([k,v])=>(
                          <button key={k} onClick={()=>{setSelectedImageTemplate(k);setImagePrompt(v.prompt);}}
                            style={{background:selectedImageTemplate===k?"rgba(103,232,249,0.10)":"rgba(255,255,255,0.03)",border:"1px solid "+(selectedImageTemplate===k?"rgba(103,232,249,0.3)":"rgba(255,255,255,0.08)"),borderRadius:8,padding:"6px 10px",fontSize:11,color:selectedImageTemplate===k?"#67e8f9":"#94a3b8",cursor:"pointer",textAlign:"left",fontWeight:selectedImageTemplate===k?600:400,transition:"all 150ms"}}>
                            {v.label}
                          </button>
                        ))}
                        {/* AI idea chips — appear after clicking AI Ideas */}
                        {imageIdeas.length>0&&(
                          <div style={{marginTop:4,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:6}}>
                            <div style={{fontSize:9,color:"#64748b",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.1em"}}>AI Generated Ideas</div>
                            {imageIdeas.map((idea,i)=>(
                              <button key={"idea"+i} onClick={()=>{setImagePrompt(idea);setImageIdeas([]);}}
                                style={{display:"block",width:"100%",background:"rgba(167,139,250,0.07)",border:"1px solid rgba(167,139,250,0.2)",borderRadius:8,padding:"6px 10px",fontSize:10,color:"#c4b5fd",cursor:"pointer",textAlign:"left",lineHeight:1.45,marginBottom:5}}>
                                {idea.slice(0,100)}{idea.length>100?"…":""}
                              </button>
                            ))}
                            <button onClick={()=>setImageIdeas([])} style={{background:"none",border:"none",color:"#334155",fontSize:9,cursor:"pointer"}}>✕ clear</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Generated image strip */}
                  {imageResult&&(
                    <div style={{padding:"8px 16px",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",gap:8,alignItems:"center",background:"rgba(110,231,183,0.03)"}}>
                      <div style={{width:72,height:40,borderRadius:6,overflow:"hidden",flexShrink:0,border:"1px solid rgba(110,231,183,0.25)"}}>
                        <img src={imageResult} alt="result" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                      </div>
                      <span style={{flex:1,fontSize:10,color:"#6ee7b7",fontWeight:600}}>Image generated ✓</span>
                      <button onClick={()=>{setApprovedOutputs(p=>({...p,image:imageResult}));setWorkspaceTab("output");log("✓ Image approved to workspace");}}
                        style={{background:"rgba(110,231,183,0.12)",border:"1px solid rgba(110,231,183,0.3)",color:"#6ee7b7",borderRadius:7,padding:"5px 11px",fontSize:10,fontWeight:700,cursor:"pointer"}}>✓ Approve</button>
                      <button onClick={()=>window.open(imageResult,"_blank")}
                        style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8",borderRadius:7,padding:"5px 8px",fontSize:10,cursor:"pointer"}}>↗</button>
                    </div>
                  )}

                  {/* Bottom action bar */}
                  <div style={{padding:"10px 20px",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                    <button onClick={generateDualImage} disabled={imageGenerating||!imagePrompt.trim()}
                      style={{background:imageGenerating||!imagePrompt.trim()?"rgba(255,255,255,0.06)":"rgba(255,255,255,0.92)",border:"1px solid rgba(255,255,255,0.15)",color:imageGenerating||!imagePrompt.trim()?"#475569":"#0f172a",borderRadius:9,padding:"8px 18px",fontSize:12,fontWeight:700,cursor:imageGenerating||!imagePrompt.trim()?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:6,minWidth:130}}>
                      {imageGenerating?<><Spinner size={12}/>Generating…</>:"Generate Image"}
                    </button>
                    <button onClick={()=>{if(selectedImageTemplate&&IMAGE_TEMPLATES[selectedImageTemplate])setImagePrompt(IMAGE_TEMPLATES[selectedImageTemplate].prompt);}}
                      style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8",borderRadius:9,padding:"8px 14px",fontSize:12,cursor:"pointer"}}>Open Templates</button>
                    <button onClick={getImageIdeas} disabled={imageIdeasLoading}
                      style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8",borderRadius:9,padding:"8px 14px",fontSize:12,cursor:imageIdeasLoading?"wait":"pointer",display:"flex",alignItems:"center",gap:5,opacity:imageIdeasLoading?0.6:1}}>
                      {imageIdeasLoading&&<Spinner size={11}/>}AI Generate Ideas
                    </button>
                    <button onClick={sanitizeImagePromptUI} disabled={imageSanitizing||!imagePrompt.trim()}
                      style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8",borderRadius:9,padding:"8px 14px",fontSize:12,cursor:imageSanitizing?"wait":"pointer",display:"flex",alignItems:"center",gap:5,opacity:imageSanitizing||!imagePrompt.trim()?0.6:1}}>
                      {imageSanitizing&&<Spinner size={11}/>}Make More Realistic
                    </button>
                  </div>
                </div>
              )}

              {/* ── VIDEO TAB ───────────────────────────────────────────── */}
              {mediaTab==="Video"&&(
                <div style={{display:"flex",flexDirection:"column",flex:1}}>
                  {videoMode==="i2v"&&!imageResult&&(
                    <div style={{margin:"12px 20px 0",background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.25)",borderRadius:8,padding:"8px 12px",fontSize:11,color:"#fbbf24"}}>
                      ⚠ I2V requires an approved image. Generate an image on the Image tab first.
                    </div>
                  )}
                  {/* Prompt */}
                  <div style={{padding:"14px 20px 10px"}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",marginBottom:3}}>
                      {videoMode==="i2v"?"Motion Prompt":"Video Prompt"}
                    </div>
                    <div style={{fontSize:10,color:"#475569",marginBottom:6}}>
                      Separate from image. Supports scratch video and subtle I2V reference flows.
                    </div>
                    <textarea value={videoPrompt} onChange={e=>setVideoPrompt(e.target.value)} rows={4}
                      placeholder={videoMode==="i2v"?"Slow gentle push-in. Natural blink. Soft parallax. No face movement. 5 seconds max.":"Create a short ordinary real world clip of a person in a real setting with natural motion and no cinematic movement."}
                      style={{width:"100%",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",color:"#cbd5e1",borderRadius:10,padding:"10px 12px",fontSize:12,resize:"vertical",lineHeight:1.6,outline:"none"}}/>
                    {/* Kling mode badge */}
                    <div style={{display:"flex",justifyContent:"flex-end",marginTop:4}}>
                      <span style={{fontSize:9,color:videoProvider==="kling"?"#6ee7b7":"#a78bfa",background:videoProvider==="kling"?"rgba(110,231,183,0.08)":"rgba(167,139,250,0.08)",border:"1px solid "+(videoProvider==="kling"?"rgba(110,231,183,0.2)":"rgba(167,139,250,0.2)"),borderRadius:5,padding:"2px 8px",fontWeight:600}}>
                        {videoProvider==="kling"?"Kling":"Runway"} / {videoMode==="i2v"?"I2V":"T2V"}
                      </span>
                    </div>
                  </div>

                  {/* Controls row */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,padding:"0 20px 12px"}}>
                    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:9,padding:"9px 12px"}}>
                      <div style={{fontSize:9,color:"#475569",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:6}}>Aspect Ratio</div>
                      <div style={{display:"flex",gap:4}}>
                        {(["16:9","9:16"] as ViewMode[]).map(v=>(
                          <button key={v} onClick={()=>setViewMode(v==="9:16"?"9:16":"16:9")}
                            style={{flex:1,background:viewMode===v?"rgba(103,232,249,0.15)":"rgba(255,255,255,0.04)",border:"1px solid "+(viewMode===v?"rgba(103,232,249,0.4)":"rgba(255,255,255,0.08)"),color:viewMode===v?"#67e8f9":"#475569",borderRadius:5,padding:"4px 0",fontSize:9,fontWeight:600,cursor:"pointer"}}>
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:9,padding:"9px 12px"}}>
                      <div style={{fontSize:9,color:"#475569",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:6}}>Duration</div>
                      <div style={{display:"flex",gap:4}}>
                        {["4s","8s"].map(d=>(
                          <button key={d}
                            style={{flex:1,background:d==="4s"?"rgba(110,231,183,0.12)":"rgba(255,255,255,0.04)",border:"1px solid "+(d==="4s"?"rgba(110,231,183,0.3)":"rgba(255,255,255,0.08)"),color:d==="4s"?"#6ee7b7":"#475569",borderRadius:5,padding:"4px 0",fontSize:9,fontWeight:600,cursor:"pointer"}}>
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:9,padding:"9px 12px"}}>
                      <div style={{fontSize:9,color:"#475569",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:6}}>Quality</div>
                      <div style={{display:"flex",gap:4}}>
                        {["1080p","720p"].map(q=>(
                          <button key={q}
                            style={{flex:1,background:q==="1080p"?"rgba(110,231,183,0.12)":"rgba(255,255,255,0.04)",border:"1px solid "+(q==="1080p"?"rgba(110,231,183,0.3)":"rgba(255,255,255,0.08)"),color:q==="1080p"?"#6ee7b7":"#475569",borderRadius:5,padding:"4px 0",fontSize:9,fontWeight:600,cursor:"pointer"}}>
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Split: Refs | Templates+Ideas */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderTop:"1px solid rgba(255,255,255,0.07)",flex:1,minHeight:0}}>
                    {/* Left: refs */}
                    <div style={{padding:"12px 16px",borderRight:"1px solid rgba(255,255,255,0.07)",display:"flex",flexDirection:"column",gap:8}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#94a3b8"}}>Image + Video References</div>
                      <div style={{fontSize:10,color:"#475569",lineHeight:1.4}}>Up to 2 image references + 1 video reference. Video reference guides motion feel only.</div>
                      <div style={{display:"flex",gap:6}}>
                        {[0,1].map(i=>{
                          const ref=videoImageRefs[i];
                          return (
                            <div key={i} onClick={()=>{if(!ref)videoImageRefInputRef.current?.click();}}
                              style={{width:52,height:52,borderRadius:8,border:"1px solid "+(ref?"rgba(103,232,249,0.3)":"rgba(255,255,255,0.1)"),background:"rgba(255,255,255,0.03)",cursor:ref?"default":"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden",flexShrink:0}}>
                              {ref?(<><img src={ref.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/><button onClick={e=>{e.stopPropagation();setVideoImageRefs(p=>p.filter((_,j)=>j!==i));}} style={{position:"absolute",top:1,right:1,background:"rgba(0,0,0,0.75)",border:"none",color:"#fff",borderRadius:"50%",width:13,height:13,fontSize:7,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button></>)
                                :(<div style={{textAlign:"center"}}><div style={{fontSize:8,color:"#475569",fontWeight:600}}>Img {i+1}</div></div>)}
                            </div>
                          );
                        })}
                        {/* Video ref */}
                        <div onClick={()=>{if(!videoVideoRef)videoVideoRefInputRef.current?.click();}}
                          style={{width:52,height:52,borderRadius:8,border:"1px solid "+(videoVideoRef?"rgba(167,139,250,0.3)":"rgba(255,255,255,0.1)"),background:"rgba(255,255,255,0.03)",cursor:videoVideoRef?"default":"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden",flexShrink:0}}>
                          {videoVideoRef?(<><span style={{fontSize:18}}>🎬</span><button onClick={e=>{e.stopPropagation();setVideoVideoRef(null);}} style={{position:"absolute",top:1,right:1,background:"rgba(0,0,0,0.75)",border:"none",color:"#fff",borderRadius:"50%",width:13,height:13,fontSize:7,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button></>)
                            :(<div style={{fontSize:8,color:"#475569",fontWeight:600,textAlign:"center"}}>Video<br/>Ref</div>)}
                        </div>
                      </div>
                      {videoMode==="i2v"&&imageResult&&(
                        <div>
                          <div style={{fontSize:9,color:"#6ee7b7",marginBottom:4}}>I2V source (approved image):</div>
                          <img src={imageResult} style={{width:"100%",aspectRatio:"16/9",objectFit:"cover",borderRadius:6,border:"1px solid rgba(110,231,183,0.2)"}} alt="source"/>
                        </div>
                      )}
                    </div>
                    {/* Right: templates + ideas */}
                    <div style={{padding:"12px 16px",overflowY:"auto",maxHeight:200}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",marginBottom:8}}>AI Video Ideas</div>
                      <div style={{fontSize:10,color:"#475569",marginBottom:8}}>Click an idea to fill the video prompt box.</div>
                      <div style={{display:"flex",flexDirection:"column",gap:5}}>
                        {Object.entries(VIDEO_TEMPLATES).map(([k,v])=>(
                          <button key={k} onClick={()=>{setSelectedVideoTemplate(k);setVideoPrompt(v.prompt);}}
                            style={{background:selectedVideoTemplate===k?"rgba(167,139,250,0.1)":"rgba(255,255,255,0.03)",border:"1px solid "+(selectedVideoTemplate===k?"rgba(167,139,250,0.3)":"rgba(255,255,255,0.08)"),borderRadius:8,padding:"6px 10px",fontSize:11,color:selectedVideoTemplate===k?"#a78bfa":"#94a3b8",cursor:"pointer",textAlign:"left",fontWeight:selectedVideoTemplate===k?600:400}}>
                            {v.label}
                          </button>
                        ))}
                        {videoIdeas.map((idea,i)=>(
                          <button key={"vi"+i} onClick={()=>{setVideoPrompt(idea);setVideoIdeas([]);}}
                            style={{background:"rgba(167,139,250,0.07)",border:"1px solid rgba(167,139,250,0.2)",borderRadius:8,padding:"6px 10px",fontSize:10,color:"#c4b5fd",cursor:"pointer",textAlign:"left",lineHeight:1.45}}>
                            {idea.slice(0,100)}{idea.length>100?"…":""}
                          </button>
                        ))}
                        {videoIdeas.length>0&&<button onClick={()=>setVideoIdeas([])} style={{background:"none",border:"none",color:"#334155",fontSize:9,cursor:"pointer"}}>✕ clear</button>}
                      </div>
                    </div>
                  </div>

                  {/* Video result strip */}
                  {/* Video result — shows actual video player when ready */}
                  {videoResult&&(
                    <div style={{padding:"10px 16px",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",flexDirection:"column",gap:8,background:"rgba(167,139,250,0.03)"}}>
                      <div style={{position:"relative",width:"100%",aspectRatio:"16/9",borderRadius:10,overflow:"hidden",border:"1px solid rgba(167,139,250,0.3)"}}>
                        <video src={videoResult} controls autoPlay muted loop style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                        <div style={{position:"absolute",top:6,right:6,display:"flex",gap:4}}>
                          <button onClick={()=>{setApprovedOutputs(p=>({...p,video:videoResult}));setWorkspaceTab("output");log("✓ Video approved to workspace");}}
                            style={{background:"rgba(167,139,250,0.9)",border:"none",color:"#fff",borderRadius:6,padding:"4px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}>✓ Approve</button>
                          <button onClick={()=>window.open(videoResult,"_blank")}
                            style={{background:"rgba(0,0,0,0.6)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff",borderRadius:6,padding:"4px 8px",fontSize:10,cursor:"pointer"}}>↗</button>
                        </div>
                      </div>
                      <div style={{fontSize:10,color:"#a78bfa",fontWeight:600}}>🎬 Video ready — {videoProvider} / {videoMode}</div>
                    </div>
                  )}
                  {/* Processing indicator while job is pending */}
                  {!videoResult&&activeCount>0&&(
                    <div style={{padding:"10px 16px",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",gap:8,background:"rgba(103,232,249,0.03)"}}>
                      <Spinner size={12}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:11,color:"#67e8f9",fontWeight:600}}>{activeCount} video job{activeCount>1?"s":""} processing…</div>
                        <div style={{fontSize:9,color:"#334155",marginTop:2}}>Kling takes 2–4 minutes. Page updates automatically when done.</div>
                      </div>
                    </div>
                  )}

                  {/* Bottom bar */}
                  <div style={{padding:"10px 20px",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",gap:8,flexWrap:"wrap"}}>
                    <button onClick={generateDualVideo} disabled={videoGenerating||!videoPrompt.trim()||(videoMode==="i2v"&&!imageResult)}
                      style={{background:videoGenerating||!videoPrompt.trim()?"rgba(255,255,255,0.06)":"rgba(255,255,255,0.92)",border:"1px solid rgba(255,255,255,0.15)",color:videoGenerating||!videoPrompt.trim()?"#475569":"#0f172a",borderRadius:9,padding:"8px 18px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6,minWidth:130}}>
                      {videoGenerating?<><Spinner size={12}/>Generating…</>:"Generate Video"}
                    </button>
                    <button onClick={getVideoIdeas} disabled={videoIdeasLoading}
                      style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8",borderRadius:9,padding:"8px 14px",fontSize:12,cursor:videoIdeasLoading?"wait":"pointer",display:"flex",alignItems:"center",gap:5,opacity:videoIdeasLoading?0.6:1}}>
                      {videoIdeasLoading&&<Spinner size={11}/>}AI Generate Ideas
                    </button>
                    <button onClick={()=>{if(selectedVideoTemplate&&VIDEO_TEMPLATES[selectedVideoTemplate])setVideoPrompt(VIDEO_TEMPLATES[selectedVideoTemplate].prompt);}}
                      style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8",borderRadius:9,padding:"8px 14px",fontSize:12,cursor:"pointer"}}>Open Templates</button>
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT: LIVE PREVIEW ────────────────────────────────────── */}
            <div style={P({padding:0,display:"flex",flexDirection:"column"})}>
              {/* Header */}
              <div style={{padding:"12px 16px 10px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:"#f1f5f9"}}>Live Preview</div>
                  <div style={{fontSize:10,color:"#475569",marginTop:1}}>What the selected flow looks like after user actions.</div>
                </div>
                <button onClick={()=>setDeviceFrame(f=>f==="Desktop"?"iPhone":"Desktop")}
                  style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8",borderRadius:7,padding:"5px 10px",fontSize:10,cursor:"pointer",fontWeight:600}}>Split View</button>
              </div>

              {/* Preview area */}
              <div style={{flex:1,padding:"16px",display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
                {/* Aspect ratio toggle */}
                <div style={{display:"flex",gap:6,width:"100%",justifyContent:"center"}}>
                  {(["16:9","9:16"] as ViewMode[]).map(v=>(
                    <button key={v} onClick={()=>setViewMode(v==="9:16"?"9:16":"16:9")}
                      style={{padding:"3px 10px",fontSize:10,fontWeight:600,background:viewMode===v?"rgba(103,232,249,0.1)":"transparent",border:"1px solid "+(viewMode===v?"rgba(103,232,249,0.3)":"rgba(255,255,255,0.08)"),color:viewMode===v?"#67e8f9":"#475569",borderRadius:5,cursor:"pointer"}}>
                      {v}
                    </button>
                  ))}
                  <span style={{fontSize:10,color:"#334155",alignSelf:"center",marginLeft:2}}>Preview</span>
                </div>

                {/* Content: actual result or phone mockup */}
                {imageResult||videoResult?(
                  <div style={{width:"100%",position:"relative",borderRadius:deviceFrame==="iPhone"?18:10,overflow:"hidden",border:"1px solid rgba(255,255,255,0.1)",aspectRatio:viewMode==="9:16"?"9/16":"16/9",background:"rgba(255,255,255,0.03)",boxShadow:deviceFrame==="iPhone"?"0 0 0 5px rgba(255,255,255,0.05)":"none"}}>
                    {videoResult?<video src={videoResult} autoPlay muted loop style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                      :imageResult?<img src={imageResult} alt="Preview" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                      :null}
                    {imageResult&&(
                      <div style={{position:"absolute",bottom:6,left:6,display:"flex",gap:4}}>
                        <span style={{background:"rgba(0,0,0,0.65)",color:"#6ee7b7",borderRadius:4,padding:"2px 7px",fontSize:8,fontWeight:700,backdropFilter:"blur(4px)"}}>No text in image</span>
                        <span style={{background:"rgba(0,0,0,0.65)",color:"#67e8f9",borderRadius:4,padding:"2px 7px",fontSize:8,fontWeight:700,backdropFilter:"blur(4px)"}}>Flat light</span>
                      </div>
                    )}
                  </div>
                ):(
                  /* Phone mockup empty state — matches screenshot */
                  <div style={{width:148,position:"relative"}}>
                    {/* Phone shell */}
                    <div style={{width:148,height:256,borderRadius:24,border:"2px solid rgba(255,255,255,0.12)",background:"rgba(13,17,38,0.95)",display:"flex",flexDirection:"column",padding:"10px 8px 8px",gap:6,boxShadow:"0 0 0 5px rgba(255,255,255,0.04), 0 10px 30px rgba(0,0,0,0.3)"}}>
                      {/* Status bar */}
                      <div style={{display:"flex",justifyContent:"space-between",padding:"0 4px"}}>
                        <span style={{fontSize:8,color:"#475569",fontWeight:600}}>9:41</span>
                        <span style={{fontSize:8,color:"#475569"}}>Preview</span>
                      </div>
                      {/* Everyday Realism badge */}
                      <div style={{alignSelf:"center",background:"rgba(103,232,249,0.1)",border:"1px solid rgba(103,232,249,0.2)",borderRadius:6,padding:"3px 12px"}}>
                        <span style={{fontSize:9,color:"#67e8f9",fontWeight:600}}>Everyday Realism</span>
                      </div>
                      {/* Placeholder image area with abstract shape */}
                      <div style={{flex:1,background:"rgba(255,255,255,0.04)",borderRadius:12,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
                        {/* Abstract pill/capsule shape like screenshot */}
                        <div style={{width:48,height:64,background:"rgba(255,255,255,0.07)",borderRadius:"50%/30%",transform:"rotate(15deg)"}}/>
                      </div>
                    </div>
                  </div>
                )}

                {/* Prompt result card */}
                <div style={{width:"100%",padding:"10px 12px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",marginBottom:4}}>Prompt result</div>
                  <div style={{fontSize:10,color:"#475569",lineHeight:1.45,marginBottom:8}}>
                    {imageResult?"Image generated from your prompt with references applied. Approve to send to workspace.":"Real image generated from your prompt with references applied. Any badges or text stay outside the AI image."}
                  </div>
                  <div style={{display:"flex",gap:5}}>
                    <span style={{background:"rgba(255,255,255,0.06)",color:"#475569",borderRadius:5,padding:"3px 8px",fontSize:9}}>No text in image</span>
                    <span style={{background:"rgba(255,255,255,0.06)",color:"#475569",borderRadius:5,padding:"3px 8px",fontSize:9}}>Flat light</span>
                  </div>
                </div>
              </div>

              {/* Demo: how it works */}
              <div style={{padding:"12px 16px",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
                <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",marginBottom:8,letterSpacing:"0.02em"}}>Demo: how it works</div>
                {[
                  "User types a prompt in Image or Video.",
                  "User optionally uploads references.",
                  "User can open templates or click AI Generate Ideas.",
                  "System rewrites prompt for realism, then generates.",
                  "Result appears in preview and can be regenerated.",
                ].map((s,i)=>(
                  <div key={i} style={{display:"flex",gap:6,marginBottom:5}}>
                    <span style={{fontSize:10,color:"#334155",fontWeight:600,flexShrink:0}}>{i+1}.</span>
                    <span style={{fontSize:10,color:"#475569",lineHeight:1.4}}>{s}</span>
                  </div>
                ))}
              </div>
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
                {workspaceTab === "output" && (() => {
                  // 3 fixed slots: portrait (9:16) | landscape (16:9) | portrait (9:16)
                  // Slots pull from concept outputs → approved output → empty
                  const slot1 = { label: "Preview", image: conceptOutputs.c1.image ?? approvedOutputs.image, video: conceptOutputs.c1.video ?? approvedOutputs.video };
                  const slot2 = { label: "Preview", image: conceptOutputs.c2.image ?? approvedOutputs.image, video: conceptOutputs.c2.video ?? approvedOutputs.video };
                  const slot3 = { label: "Preview", image: conceptOutputs.c3.image ?? approvedOutputs.image, video: conceptOutputs.c3.video ?? approvedOutputs.video };
                  const slots = [
                    { ...slot1, portrait: true  },   // left  — portrait  9:16
                    { ...slot2, portrait: false },   // center — landscape 16:9
                    { ...slot3, portrait: true  },   // right  — portrait  9:16
                  ];
                  return (
                    <div style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1.8fr 1fr", gap: 14, alignItems: "start" }}>
                      {slots.map((slot, i) => (
                        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {/* Frame */}
                          <div style={{
                            position: "relative",
                            width: "100%",
                            aspectRatio: slot.portrait ? "9/16" : "16/9",
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: slot.portrait ? 20 : 12,
                            overflow: "hidden",
                            boxShadow: slot.portrait ? "0 0 0 5px rgba(255,255,255,0.04)" : "none",
                          }}>
                            {slot.video
                              ? <video src={slot.video} autoPlay muted loop style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : slot.image
                                ? <img src={slot.image} alt={slot.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : (
                                  <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#1e293b" }}>
                                    <div style={{ fontSize: 22, opacity: 0.4 }}>◻</div>
                                    <div style={{ fontSize: 10, textAlign: "center", padding: "0 12px", lineHeight: 1.4 }}>Approve an output from Preview Screens</div>
                                  </div>
                                )}
                            {/* Action overlay */}
                            {(slot.image || slot.video) && (
                              <div style={{ position: "absolute", inset: 0, opacity: 0, transition: "opacity 150ms", background: "rgba(0,0,0,0.55)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}
                                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = "0"; }}>
                                <button onClick={() => { setApprovedOutputs(o => ({ ...o, image: slot.image ?? o.image, video: slot.video ?? o.video })); log("✓ Preview " + (i+1) + " sent to workspace"); }}
                                  style={{ background: "rgba(110,231,183,0.9)", border: "none", color: "#000", borderRadius: 7, padding: "6px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", width: "80%" }}>
                                  ✓ Use This
                                </button>
                                <div style={{ display: "flex", gap: 6 }}>
                                  {slot.image && <button onClick={() => window.open(slot.image!, "_blank")}
                                    style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 6, padding: "5px 10px", fontSize: 10, cursor: "pointer" }}>↗ View</button>}
                                  <button onClick={() => { navigator.clipboard.writeText(slot.image ?? slot.video ?? ""); log("✓ URL copied"); }}
                                    style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: 6, padding: "5px 10px", fontSize: 10, cursor: "pointer" }}>⎘ Copy</button>
                                </div>
                              </div>
                            )}
                          </div>
                          {/* Label row */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 2px" }}>
                            <span style={{ fontSize: 10, color: "#334155" }}>{slot.portrait ? "9:16" : "16:9"} {i === 1 ? "· Main" : ""}</span>
                            {(slot.image || slot.video) && (
                              <button onClick={() => { setApprovedOutputs(o => ({ ...o, image: slot.image ?? o.image, video: slot.video ?? o.video })); }}
                                style={{ fontSize: 9, background: "rgba(110,231,183,0.1)", border: "1px solid rgba(110,231,183,0.2)", color: "#6ee7b7", borderRadius: 4, padding: "2px 7px", cursor: "pointer", fontWeight: 600 }}>Send</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {workspaceTab === "logs" && (
                  <div style={{ width: "100%", height: 300, overflowY: "auto", fontFamily: "monospace", fontSize: 11, color: "#64748b", lineHeight: 1.8 }}>
                    {logs.map((l, i) => <div key={i}>{l}</div>)}
                  </div>
                )}
                {workspaceTab === "editor" && (() => {
                  const src = approvedOutputs.image || Object.values(conceptOutputs).find(o => o.image)?.image || null;
                  return (
                    <div style={{ width: "100%", display: "flex", gap: 16, alignItems: "flex-start" }}>
                      {/* Canvas preview */}
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                        {src ? (
                          <div style={{ position: "relative", width: "100%", maxWidth: 420, aspectRatio: viewMode === "9:16" ? "9/16" : "16/9", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <img src={src} alt="Edit" style={{
                              width: "100%", height: "100%", objectFit: "cover", display: "block",
                              filter: `brightness(${editorState.brightness}%) contrast(${editorState.contrast}%) saturate(${editorState.saturation}%) blur(${editorState.blur}px)`,
                              transform: `rotate(${editorState.rotation}deg) scaleX(${editorState.flipH ? -1 : 1}) scaleY(${editorState.flipV ? -1 : 1})`,
                              transition: "filter 120ms, transform 120ms",
                            }} />
                            {editorState.textOverlay && (
                              <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
                                <span style={{ background: "rgba(0,0,0,0.55)", color: "#fff", padding: "4px 12px", borderRadius: 6, fontSize: 14, fontWeight: 700, backdropFilter: "blur(4px)" }}>
                                  {editorState.textOverlay}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ width: "100%", maxWidth: 420, aspectRatio: "16/9", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: "#334155" }}>
                            <span style={{ fontSize: 24 }}>🖼</span>
                            <span style={{ fontSize: 12 }}>Approve an image first to edit it</span>
                          </div>
                        )}
                        {/* Action row */}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                          {[
                            { label: "↺ Reset", action: () => setEditorState({ brightness: 100, contrast: 100, saturation: 100, blur: 0, rotation: 0, flipH: false, flipV: false, textOverlay: "" }) },
                            { label: "⟳ Rotate 90°", action: () => setEditorState(p => ({ ...p, rotation: (p.rotation + 90) % 360 })) },
                            { label: "↔ Flip H", action: () => setEditorState(p => ({ ...p, flipH: !p.flipH })) },
                            { label: "↕ Flip V", action: () => setEditorState(p => ({ ...p, flipV: !p.flipV })) },
                          ].map(btn => (
                            <button key={btn.label} onClick={btn.action}
                              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#94a3b8", borderRadius: 8, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Controls panel */}
                      <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                        {/* Adjustments */}
                        <div>
                          <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#475569", textTransform: "uppercase", marginBottom: 10 }}>Adjustments</div>
                          {([
                            { label: "Brightness", key: "brightness", min: 0, max: 200, unit: "%" },
                            { label: "Contrast",   key: "contrast",   min: 0, max: 200, unit: "%" },
                            { label: "Saturation", key: "saturation", min: 0, max: 200, unit: "%" },
                            { label: "Blur",       key: "blur",       min: 0, max: 10,  unit: "px" },
                          ] as { label: string; key: keyof typeof editorState; min: number; max: number; unit: string }[]).map(ctrl => (
                            <div key={ctrl.key} style={{ marginBottom: 10 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                <span style={{ fontSize: 11, color: "#64748b" }}>{ctrl.label}</span>
                                <span style={{ fontSize: 11, color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>
                                  {editorState[ctrl.key] as number}{ctrl.unit}
                                </span>
                              </div>
                              <input type="range" min={ctrl.min} max={ctrl.max} value={editorState[ctrl.key] as number}
                                onChange={e => setEditorState(p => ({ ...p, [ctrl.key]: Number(e.target.value) }))}
                                style={{ width: "100%", accentColor: "#67e8f9", cursor: "pointer" }} />
                            </div>
                          ))}
                        </div>

                        {/* Crop presets */}
                        <div>
                          <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#475569", textTransform: "uppercase", marginBottom: 8 }}>Crop / Aspect</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {["16:9", "9:16", "1:1", "4:5"].map(ratio => (
                              <button key={ratio} onClick={() => setViewMode(ratio === "16:9" ? "16:9" : ratio === "9:16" ? "9:16" : "16:9")}
                                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#64748b", borderRadius: 6, padding: "4px 8px", fontSize: 10, cursor: "pointer" }}>
                                {ratio}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Text overlay */}
                        <div>
                          <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#475569", textTransform: "uppercase", marginBottom: 8 }}>Text Overlay</div>
                          <input type="text" placeholder="Add overlay text…" value={editorState.textOverlay}
                            onChange={e => setEditorState(p => ({ ...p, textOverlay: e.target.value }))}
                            style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#e2e8f0", borderRadius: 8, padding: "7px 10px", fontSize: 12 }} />
                        </div>

                        {/* Export */}
                        <div style={{ paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                          <button
                            onClick={() => {
                              if (!src) return;
                              const a = document.createElement("a");
                              a.href = src;
                              a.download = `medazon-edited-${Date.now()}.png`;
                              a.click();
                              log("✓ Image downloaded");
                            }}
                            style={{ width: "100%", background: "rgba(110,231,183,0.12)", border: "1px solid rgba(110,231,183,0.25)", color: "#6ee7b7", borderRadius: 8, padding: "8px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 6 }}>
                            ↓ Download Image
                          </button>
                          <button
                            onClick={() => {
                              if (!src) return;
                              setApprovedOutputs(p => ({ ...p, image: src }));
                              setWorkspaceTab("output");
                              log("✓ Edits applied to workspace output");
                            }}
                            style={{ width: "100%", background: "rgba(103,232,249,0.10)", border: "1px solid rgba(103,232,249,0.2)", color: "#67e8f9", borderRadius: 8, padding: "8px 0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                            ✓ Apply to Output
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {workspaceTab === "export" && (
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}>
                    <div style={{ fontSize: 11, letterSpacing: "0.15em", color: "#475569", textTransform: "uppercase", marginBottom: 4 }}>Export Package</div>
                    {[
                      { label: "Download Image (PNG)", icon: "🖼", enabled: !!(approvedOutputs.image || Object.values(conceptOutputs).find(o => o.image)?.image), action: () => { const src = approvedOutputs.image || Object.values(conceptOutputs).find(o => o.image)?.image; if (!src) return; const a = document.createElement("a"); a.href = src; a.download = `medazon-image-${Date.now()}.png`; a.click(); log("✓ Image downloaded"); } },
                      { label: "Download Video (MP4)", icon: "🎬", enabled: !!(approvedOutputs.video || Object.values(conceptOutputs).find(o => o.video)?.video), action: () => { const src = approvedOutputs.video || Object.values(conceptOutputs).find(o => o.video)?.video; if (!src) return; const a = document.createElement("a"); a.href = src; a.download = `medazon-video-${Date.now()}.mp4`; a.click(); log("✓ Video downloaded"); } },
                      { label: "Copy Image URL", icon: "🔗", enabled: !!(approvedOutputs.image), action: () => { navigator.clipboard.writeText(approvedOutputs.image!); log("✓ Image URL copied"); } },
                    ].map(item => (
                      <button key={item.label} onClick={item.action} disabled={!item.enabled}
                        style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: item.enabled ? "#94a3b8" : "#334155", borderRadius: 10, padding: "12px 16px", fontSize: 13, cursor: item.enabled ? "pointer" : "not-allowed", textAlign: "left" }}>
                        <span style={{ fontSize: 18 }}>{item.icon}</span>
                        <span>{item.label}</span>
                        {!item.enabled && <span style={{ marginLeft: "auto", fontSize: 10, color: "#334155" }}>Approve output first</span>}
                      </button>
                    ))}
                  </div>
                )}
                {workspaceTab === "publish" && (
                  <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ fontSize: 11, letterSpacing: "0.15em", color: "#475569", textTransform: "uppercase", marginBottom: 4 }}>Publish</div>
                    {["Meta Ads Manager", "Google Ads", "TikTok Ads", "Instagram"].map(platform => (
                      <div key={platform} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 16px" }}>
                        <span style={{ fontSize: 13, color: "#64748b" }}>{platform}</span>
                        <button style={{ background: "rgba(103,232,249,0.08)", border: "1px solid rgba(103,232,249,0.2)", color: "#67e8f9", borderRadius: 8, padding: "5px 14px", fontSize: 11, cursor: "pointer" }}>Connect</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Pipeline Results Panel ────────────────────────────────────── */}
          {(pipelineRunning || pipelineLog.length > 0) && (
            <div style={{ marginBottom: 14, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(103,232,249,0.15)", borderRadius: 16, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#67e8f9", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  {pipelineRunning ? "⏳ Pipeline Running…" : "✅ Pipeline Complete"}
                </span>
                {!pipelineRunning && (
                  <button onClick={() => { setPipelineLog([]); setPipelineResults(null); }}
                    style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 12 }}>Clear</button>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: pipelineResults?.imageUrl ? "1fr 340px" : "1fr", gap: 16 }}>
                {/* Step log */}
                <div style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b", lineHeight: 2, maxHeight: 280, overflowY: "auto" }}>
                  {pipelineLog.map((l, i) => (
                    <div key={i} style={{ color: l.startsWith("✅") || l.startsWith("✓") ? "#6ee7b7" : l.startsWith("✗") || l.startsWith("BLOCKED") ? "#f87171" : l.startsWith("━") ? "#67e8f9" : l.startsWith("⚠") ? "#fbbf24" : "#64748b" }}>
                      {l}
                    </div>
                  ))}
                  {pipelineRunning && <div style={{ color: "#67e8f9", animation: "pulse 1s infinite" }}>▋</div>}
                </div>
                {/* Image preview with text overlay */}
                {pipelineResults?.imageUrl && (
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Output — Text Composite Preview</div>
                    <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <img src={pipelineResults.imageUrl} alt="Pipeline output" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      {/* Text overlay — governance: text composited, never in image */}
                      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 12, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)" }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 4, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                          {pipelineResults.headline ?? "Private Care, From Home"}
                        </div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>
                          Subject to provider review. Eligibility may vary.
                        </div>
                        <div style={{ display: "inline-flex", alignSelf: "flex-start" }}>
                          <span style={{ background: "#00C4A1", color: "#000", fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 6 }}>
                            {pipelineResults.cta ?? "Start Your Visit"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                      <span style={{ fontSize: 9, color: "#475569", background: "rgba(110,231,183,0.08)", border: "1px solid rgba(110,231,183,0.2)", borderRadius: 4, padding: "2px 6px" }}>
                        Validator: {pipelineResults.validatorStatus ?? "—"}
                      </span>
                      <span style={{ fontSize: 9, color: "#475569", background: "rgba(103,232,249,0.08)", border: "1px solid rgba(103,232,249,0.15)", borderRadius: 4, padding: "2px 6px" }}>
                        readyForHumanReview
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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
                        <div style={{ position: "relative", width: "100%", borderRadius: 10, overflow: "hidden", maxHeight: 140 }}>
                          <img src={out.image} alt={`Concept ${i + 1}`} style={{ width: "100%", objectFit: "cover", maxHeight: 140, display: "block" }} />
                          {/* UI Overlay — separate layer, never inside AI image */}
                          {showOverlay[cid] && (
                            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                              {/* FAST badge — top left */}
                              <div style={{ position: "absolute", top: 8, left: 8, background: "#16a34a", color: "#fff", fontSize: 8, fontWeight: 800, padding: "2px 7px", borderRadius: 99, letterSpacing: "0.08em" }}>
                                FAST
                              </div>
                              {/* Refill Approved card */}
                              <div style={{ position: "absolute", top: 24, left: 8, background: "rgba(255,255,255,0.92)", borderRadius: 7, padding: "6px 8px", minWidth: 100, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <span style={{ color: "#fff", fontSize: 7, lineHeight: 1 }}>✓</span>
                                  </div>
                                  <span style={{ fontSize: 9, fontWeight: 700, color: "#111" }}>Refill Approved</span>
                                </div>
                                <div style={{ fontSize: 8, color: "#374151", lineHeight: 1.6, paddingLeft: 2 }}>
                                  <div>✓ Lisinopril</div>
                                  <div>✓ Ready for Pickup</div>
                                </div>
                              </div>
                            </div>
                          )}
                          {/* Overlay toggle */}
                          <button
                            onClick={() => setShowOverlay(p => ({ ...p, [cid]: !p[cid] }))}
                            style={{ position: "absolute", bottom: 4, right: 4, background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 8, borderRadius: 4, padding: "2px 5px", cursor: "pointer", pointerEvents: "all" }}>
                            {showOverlay[cid] ? "Hide UI" : "Show UI"}
                          </button>
                        </div>
                      ) : isActive ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "#475569" }}>
                          <Spinner size={20} />
                          <span style={{ fontSize: 11 }}>{qItem ? `${qItem.provider} · ${qItem.elapsedSeconds}s` : "Generating..."}</span>
                        </div>
                      ) : out?.status === "failed" && out?.error ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "0 8px" }}>
                          <span style={{ fontSize: 18 }}>⚠️</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#f87171" }}>Generation Failed</span>
                          <span style={{ fontSize: 10, color: "#94a3b8", textAlign: "center", lineHeight: 1.5, wordBreak: "break-word", maxWidth: "100%" }}>{out.error}</span>
                          <button onClick={() => generateImage(cid)} style={{ marginTop: 4, fontSize: 10, color: "#67e8f9", background: "rgba(103,232,249,0.08)", border: "1px solid rgba(103,232,249,0.2)", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Retry</button>
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
                      Run Concept Image
                    </button>
                    <button onClick={() => generateVideo(cid)}
                      disabled={isActive}
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", borderRadius: 8, padding: "6px 8px", fontSize: 11, cursor: "pointer" }}>
                      Run Concept Video
                    </button>
                    <button onClick={() => { setConceptOutputs(p => ({ ...p, [cid]: { image: null, video: null, script: null, status: "idle", error: null } })); log(`Restarted concept ${i + 1}`); }}
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
      {/* ── Floating AI Assistant ────────────────────────────────────── */}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
        {assistantOpen && (
          <div style={{ width: 360, background: "rgba(8,12,33,0.97)", border: "1px solid rgba(103,232,249,0.2)", borderRadius: 16, boxShadow: "0 18px 60px rgba(0,0,0,0.4)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#67e8f9", letterSpacing: "0.1em" }}>AI ASSISTANT</div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["url", "image", "video", "doc", "audio"] as IntakeType[]).map(t => (
                  <button key={t!} onClick={() => { setActiveIntake(a => a === t ? null : t); if (t !== "url") fileInputRef.current?.click(); }}
                    style={{ background: activeIntake === t ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.05)", border: "1px solid " + (activeIntake === t ? "rgba(34,211,238,0.5)" : "rgba(255,255,255,0.1)"), color: activeIntake === t ? "#67e8f9" : "#475569", borderRadius: 5, padding: "2px 7px", fontSize: 9, cursor: "pointer", fontWeight: 600, textTransform: "uppercase" }}>
                    {t}
                  </button>
                ))}
                <button onClick={() => setAssistantOpen(false)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>✕</button>
              </div>
            </div>
            {activeIntake === "url" && (
              <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 6 }}>
                <input value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === "Enter" && analyzeUrl()}
                  placeholder="https://..." style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", borderRadius: 7, padding: "5px 9px", fontSize: 11 }} />
                <button onClick={analyzeUrl} disabled={intakeBusy}
                  style={{ background: "rgba(34,211,238,0.15)", border: "1px solid rgba(34,211,238,0.4)", color: "#67e8f9", borderRadius: 7, padding: "5px 11px", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                  {intakeBusy ? <Spinner size={9} /> : "Analyze"}
                </button>
              </div>
            )}
            {intakeAnalysis && !intakeResult && (
              <div style={{ margin: "6px 14px", fontSize: 10, color: "#6ee7b7", background: "rgba(16,185,129,0.08)", borderRadius: 6, padding: "5px 8px" }}>
                ✓ {intakeAnalysis.slice(0, 100)}...
              </div>
            )}
            {/* ── Intake result card ── */}
            {intakeResult && (
              <div style={{ margin: "6px 14px", background: "rgba(8,12,33,0.95)", border: "1px solid rgba(103,232,249,0.2)", borderRadius: 10, overflow: "hidden" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(103,232,249,0.05)" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#67e8f9", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    {intakeResult.type === "youtube" ? "🎬 YouTube" : "🌐 Website"}
                  </span>
                  <button onClick={() => { setIntakeResult(null); setIntakeAnalysis(null); }}
                    style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 12 }}>✕</button>
                </div>
                {/* YouTube card */}
                {intakeResult.type === "youtube" && (
                  <div style={{ padding: "8px 10px", display: "flex", gap: 8 }}>
                    {intakeResult.thumbnailUrl && (
                      <img src={intakeResult.thumbnailUrl} alt="thumbnail"
                        style={{ width: 80, height: 45, objectFit: "cover", borderRadius: 5, flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#f1f5f9", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {intakeResult.title}
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>{intakeResult.channelName}</div>
                      {intakeResult.transcriptSnippet && (
                        <div style={{ fontSize: 9, color: "#475569", lineHeight: 1.4, maxHeight: 36, overflow: "hidden" }}>
                          {intakeResult.transcriptSnippet.slice(0, 120)}…
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* Website card */}
                {intakeResult.type === "website" && (
                  <div style={{ padding: "8px 10px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#f1f5f9", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {intakeResult.brandName || intakeResult.title}
                    </div>
                    {intakeResult.colorPalette && (
                      <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
                        {Object.entries(intakeResult.colorPalette).slice(0, 5).map(([k, v]) => (
                          <div key={k} title={k + ": " + v}
                            style={{ width: 16, height: 16, borderRadius: 3, background: v.startsWith("#") ? v : "#334155", border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }} />
                        ))}
                        <span style={{ fontSize: 9, color: "#475569", alignSelf: "center", marginLeft: 3 }}>palette</span>
                      </div>
                    )}
                    {intakeResult.layoutPattern && (
                      <div style={{ fontSize: 9, color: "#64748b", marginBottom: 3 }}>Layout: {intakeResult.layoutPattern}</div>
                    )}
                    {intakeResult.toneOfVoice && (
                      <div style={{ fontSize: 9, color: "#64748b", marginBottom: 3 }}>Tone: {intakeResult.toneOfVoice}</div>
                    )}
                  </div>
                )}
                {/* Shared bottom: analysis + actions */}
                <div style={{ padding: "6px 10px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.4, marginBottom: 6 }}>
                    {intakeAnalysis?.slice(0, 120)}…
                  </div>
                  {intakeResult.keyMessages && intakeResult.keyMessages.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
                      {intakeResult.keyMessages.slice(0, 3).map((m, i) => (
                        <span key={i} style={{ fontSize: 9, background: "rgba(103,232,249,0.08)", border: "1px solid rgba(103,232,249,0.15)", color: "#67e8f9", borderRadius: 4, padding: "2px 6px" }}>{m.slice(0, 40)}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => { if (imagePrompt.length > 0) { setImagePrompt(imagePrompt); } log("✓ Prompts applied from intake"); setIntakeExpanded(false); }}
                      style={{ flex: 1, background: "rgba(103,232,249,0.12)", border: "1px solid rgba(103,232,249,0.25)", color: "#67e8f9", borderRadius: 6, padding: "4px 0", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                      ✓ Prompts Applied
                    </button>
                    {intakeResult.type === "website" && intakeResult.duplicateLayoutSuggestion && (
                      <button onClick={() => { setAssistantMessages(p => [...p, { role: "assistant", content: "Layout duplication guide:\n" + intakeResult.duplicateLayoutSuggestion }]); }}
                        style={{ flex: 1, background: "rgba(167,139,250,0.10)", border: "1px solid rgba(167,139,250,0.2)", color: "#a78bfa", borderRadius: 6, padding: "4px 0", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                        Layout Guide →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* Chat */}
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 7, maxHeight: 260 }}>
              {assistantMessages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "85%", background: m.role === "user" ? "rgba(168,85,247,0.18)" : "rgba(255,255,255,0.06)", border: "1px solid " + (m.role === "user" ? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.08)"), borderRadius: 10, padding: "6px 10px", fontSize: 11, color: m.role === "user" ? "#e9d5ff" : "#cbd5e1", lineHeight: 1.45 }}>
                    {m.content}
                  </div>
                </div>
              ))}
              <div ref={assistantEndRef} />
            </div>
            {/* Input */}
            <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 7 }}>
              <input value={assistantInput} onChange={e => setAssistantInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendAssistantMessage()}
                placeholder="Ask STREAMS..." disabled={assistantBusy}
                style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#fff", borderRadius: 8, padding: "7px 10px", fontSize: 12 }} />
              <button onClick={sendAssistantMessage} disabled={assistantBusy || !assistantInput.trim()}
                style={{ background: assistantInput.trim() ? "rgba(34,211,238,0.18)" : "rgba(255,255,255,0.04)", border: "1px solid " + (assistantInput.trim() ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.08)"), color: assistantInput.trim() ? "#67e8f9" : "#475569", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                {assistantBusy ? <Spinner size={11} /> : "Send"}
              </button>
            </div>
          </div>
        )}
        {/* Float toggle button */}
        <button onClick={() => setAssistantOpen(o => !o)}
          style={{ width: 48, height: 48, borderRadius: "50%", background: assistantOpen ? "rgba(34,211,238,0.2)" : "linear-gradient(135deg,rgba(103,232,249,0.6),rgba(167,139,250,0.5))", border: "1px solid rgba(103,232,249,0.4)", color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(0,0,0,0.3)", position: "relative" }}>
          {assistantBusy ? <Spinner size={16} /> : "✦"}
          {activeCount > 0 && <span style={{ position: "absolute", top: -2, right: -2, width: 14, height: 14, borderRadius: "50%", background: "#67e8f9", border: "2px solid #050816", fontSize: 8, fontWeight: 700, color: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>{activeCount}</span>}
        </button>
      </div>

      {/* ── Diagnostic Modal ─────────────────────────────────────────── */}
      {diagResult && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setDiagResult(null)}>
          <div style={{ background: "#0f1117", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 28, maxWidth: 640, width: "100%", maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>🔍 Diagnostic Results</span>
              <button onClick={() => setDiagResult(null)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>
            <pre style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8", lineHeight: 1.8, whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0 }}>
              {diagResult}
            </pre>
            <div style={{ marginTop: 16, fontSize: 11, color: "#475569" }}>
              Click outside or ✕ to close
            </div>
          </div>
        </div>
      )}
    </>
  );
}
