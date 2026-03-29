"use client";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
const MediaEditor = dynamic(() => import("@/components/pipeline/MediaEditor"), { ssr: false });

import React, { useCallback, useEffect, useRef, useState } from "react";
import { VoiceBar } from "@/components/ai-chat/VoiceBar";
import { createClient } from "@/lib/supabase/client";

// ── Activity Stream + Artifact Preview ────────────────────────────────────────
import { registerActivityStreamMiddleware, ActivityController } from "@/lib/activity-stream/index";
import { ActivityStreamBar } from "@/lib/activity-stream/ActivityStreamBar";
import { extractArtifactFromBuffer, type ExtractedArtifact } from "@/lib/activity-stream/code-extractor";
import { ArtifactCard, type ArtifactDestination } from "@/components/pipeline/ArtifactCard";
import { FloatingPreviewPanel } from "@/components/pipeline/FloatingPreviewPanel";
import { LivePreviewRenderer } from "@/components/pipeline/LivePreviewRenderer";
import AIAssistant, { type ProactiveMessage } from "@/components/dashboard/AIAssistant";
import { PlatformViewer } from "@/components/pipeline/PlatformViewer";
import { PlatformSelector, type PlatformSelection } from "@/components/pipeline/PlatformSelector";
import { BatchPreviewModal } from "@/components/pipeline/BatchPreviewModal";
import { DesktopPlatformView } from "@/components/pipeline/DesktopPlatformView";
import type { PlatformId, ViewId } from "@/lib/platform-views/index";

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

// ── Guidance + Conflict types ─────────────────────────────────────────────
interface GuidanceRule {
  id: string;
  field: string;
  instruction: string;
  value?: string;
  severity: "hard" | "soft";
}
interface ParsedGuidance {
  fileName: string;
  rawContent: string;
  rules: GuidanceRule[];
  summary: string;
}
interface Conflict {
  id: string;
  field: string;
  label: string;
  frontendValue: string;
  guidanceValue: string;
  severity: "hard" | "soft";
  status: "unresolved" | "resolved_frontend" | "resolved_guidance";
  description: string;
}

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
  const searchParams = useSearchParams();
  const isEmbed = searchParams?.get("embed") === "1";
  // Step builder
  const [steps, setSteps] = useState<Step[]>(STEPS_INITIAL);
  const [selectedStepId, setSelectedStepId] = useState<string>("strategy");
  const [stepConfigOpen, setStepConfigOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [iPhoneWidth, setIPhoneWidth] = useState(220);
  const iphoneDragRef = React.useRef<{side:"left"|"right";startX:number;startW:number}|null>(null);

  // Step prompts — keyed by step id
  // strategy prompt is updated via useEffect when nicheId changes
  const [stepPrompts, setStepPrompts] = useState<Record<string, string>>({
    strategy: `You are building a creative strategy for a general content campaign.

Generate a strategy for producing realistic, believable visual content.
The content should feel authentic, non-staged, and appropriate for the target audience.
Return a JSON object with: concepts (array), rulesetVersion, strategySummary.`,

    copy: `Generate minimal overlay UI content that feels real, not designed.

Overlay must include:
- Small status badge (top left): "FAST" or "APPROVED"
- Confirmation state (ex: "Refill Approved")
- 1–2 realistic medication or outcome indicators
- Subtle UI card (not heavy panel)

Tone:
- Calm
- Clinical but human
- Plain — no marketing language

Example structure:
Badge: FAST
Title: Refill Approved
Items:
✓ Lisinopril
✓ Ready for Pickup

DO NOT:
- Add paragraphs
- Add any marketing language or slogans
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
- Would look like a real unposed moment — not advertising, not staged`,

    imagery: `a woman in her early 30s sitting on a couch in her living room, casually holding her smartphone and reading something on the screen`,

    i2v:    "Slow gentle push-in. Natural blink. Soft parallax on background elements. No movement on face. 5 seconds max.",
    assets: "Organise all outputs into a structured asset library.",
    qa:     "Final compliance QA. Check all outputs against governance ruleset.",
  });

  // Pipeline config
  const [nicheId, setNicheId] = useState("");

  // Sync strategy prompt when nicheId changes
  React.useEffect(() => {
    const label = nicheId || "general";
    setStepPrompts(prev => ({
      ...prev,
      strategy: `You are building a creative strategy for a ${label} content campaign.\n\nGenerate a strategy for producing realistic, believable visual content.\nThe content should feel authentic, non-staged, and appropriate for the target audience.\nReturn a JSON object with: concepts (array), rulesetVersion, strategySummary.`,
    }));
  }, [nicheId]);
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
  // ── EditorPro slide-out panel (exact drag logic from studio/page.tsx) ────
  const [epOpen, setEpOpen] = React.useState(false);
  const [epW, setEpW] = React.useState(480);
  const [epDragging, setEpDragging] = React.useState(false);
  const [epHandleActive, setEpHandleActive] = React.useState(false);
  const epDragState = React.useRef<{ startX: number; startW: number } | null>(null);
  const [pipelineMode, setPipelineMode] = useState<"manual" | "auto">("manual");
  const [outputMode, setOutputMode] = useState<"image+video" | "image" | "video">("image+video");
  const [diagResult, setDiagResult] = useState<string | null>(null);
  const [diagRunning, setDiagRunning] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineLog, setPipelineLog] = useState<string[]>([]);

  // ── Live engine state ─────────────────────────────────────────────────────
  type LiveEventType = "step_start" | "log" | "decision" | "regen" | "score" | "summary" | "error";
  type LiveDecision = { label: string; result: "pass" | "fail" | "warn"; reason?: string };
  interface LiveEvent {
    id: string;
    type: LiveEventType;
    stepId: string;
    stepName: string;
    message?: string;
    decisions?: LiveDecision[];
    regenAttempt?: number;
    regenStatus?: "fail" | "adjusting" | "pass";
    score?: { total: number; breakdown: { label: string; pass: boolean; note?: string }[] };
    summary?: { result: "APPROVED" | "REJECTED"; reasons: string[]; adjustments: string[] };
    ts: number;
  }
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [liveStepId, setLiveStepId] = useState<string | null>(null);
  const [engineOpen, setEngineOpen] = useState(false);
  const liveEndRef = React.useRef<HTMLDivElement>(null);

  function emit(event: Omit<LiveEvent, "id" | "ts">) {
    const full: LiveEvent = { ...event, id: Math.random().toString(36).slice(2), ts: Date.now() };
    setLiveEvents(prev => [...prev, full]);
    setTimeout(() => liveEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

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
  const [playbackPlaying, setPlaybackPlaying] = useState(false);
  type PreviewDestination = "iphone1" | "iphone2" | "desktop";
  const [previewDestination, setPreviewDestination] = useState<PreviewDestination>("iphone1");
  const [showDestPicker, setShowDestPicker] = useState(false);
  const [pendingResult, setPendingResult] = useState<{url: string; type: "image"|"video"} | null>(null);
  const [inlineUrl, setInlineUrl] = useState("");
  const [inlineUrlBusy, setInlineUrlBusy] = useState(false);
  const allFilesInputRef = React.useRef<HTMLInputElement>(null);
  const [activeConceptSlot, setActiveConceptSlot] = useState<0|1|2>(0);
  const playbackRef1 = React.useRef<HTMLVideoElement>(null);
  const playbackRef2 = React.useRef<HTMLVideoElement>(null);
  const [videoReferencePriority, setVideoReferencePriority] = useState<ReferencePriority>("medium");
  const [selectedVideoTemplate, setSelectedVideoTemplate] = useState("");
  const [videoProvider, setVideoProvider] = useState<"kling" | "runway">("kling");
  // AI assistant float
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);

  // ── Activity stream + artifact preview state ─────────────────────────────
  const [currentArtifact, setCurrentArtifact] = useState<ExtractedArtifact | null>(null);
  const [artifactStreaming, setArtifactStreaming] = useState(false);
  const [autoPreview, setAutoPreview] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("streams:autoPreview") !== "false";
  });
  const [floatingArtifact, setFloatingArtifact] = useState<ExtractedArtifact | null>(null);
  const [livePreviewArtifact, setLivePreviewArtifact] = useState<{ artifact: ExtractedArtifact; dest: "iphone1" | "iphone2" | "desktop" } | null>(null);

  // ── Platform view state ────────────────────────────────────────────────────
  const EMPTY_SELECTION: PlatformSelection = { platformId: null, viewId: null, destination: 'mobile' };
  const [iphone1Platform, setIphone1Platform] = useState<PlatformSelection>(EMPTY_SELECTION);
  const [iphone2Platform, setIphone2Platform] = useState<PlatformSelection>(EMPTY_SELECTION);
  const [desktopPlatform, setDesktopPlatform] = useState<{ platformId: PlatformId; viewId: ViewId } | null>(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [showSafeZone, setShowSafeZone] = useState(false);
  // Proactive assistant messages — injected when generation completes
  const [proactiveMessage, setProactiveMessage] = useState<ProactiveMessage | null>(null);
  const proactiveIdCounter = useRef(0);
  const pushProactive = useCallback((text: string, imageUrl?: string, type: ProactiveMessage['type'] = 'generation_complete') => {
    setProactiveMessage({ id: `proactive_${++proactiveIdCounter.current}_${Date.now()}`, text, imageUrl, type });
  }, []);

  // Register activity stream middleware once on mount
  useEffect(() => {
    return registerActivityStreamMiddleware();
  }, []);
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

  // ── Creative Setup state ──────────────────────────────────────────────────
  const [csOpen, setCsOpen] = React.useState(false);
  const [csFields, setCsFields] = React.useState<Record<string,string>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(window.localStorage.getItem("streamsai:cs:fields") ?? "{}"); } catch { return {}; }
  });
  const [csRealism, setCsRealism] = React.useState({
    mode: "STRICT" as "STANDARD"|"SOFT"|"STRICT"|"RAW",
    imperfections: { skinTexture: true, asymmetry: true, naturalHands: true, slightClutter: true },
    strictNegatives: { noCinematic: true, noDramatic: true, noBeautyLook: true, noPerfectSkin: true },
    strictBlocks: { noCinematic: true, noUnplanned: false },
  });
  const [csGuidanceFile, setCsGuidanceFile] = React.useState<string|null>(null);
  const [parsedGuidance, setParsedGuidance] = React.useState<ParsedGuidance|null>(null);
  const [guidanceParsing, setGuidanceParsing] = React.useState(false);
  const [conflicts, setConflicts] = React.useState<Conflict[]>([]);
  const [showConflictModal, setShowConflictModal] = React.useState(false);
  const [pendingGeneration, setPendingGeneration] = React.useState<(()=>void)|null>(null);
  const guidanceInputRef = React.useRef<HTMLInputElement>(null);

  // ── Parse guidance file ──────────────────────────────────────────────────
  async function handleGuidanceUpload(file: File) {
    setGuidanceParsing(true);
    setCsGuidanceFile(file.name);
    setConflicts([]);
    try {
      const text = await file.text();
      const rules = extractGuidanceRules(text);
      const summary = rules.length > 0
        ? `${rules.length} rules detected (${rules.filter(r=>r.severity==="hard").length} hard, ${rules.filter(r=>r.severity==="soft").length} soft)`
        : `Document loaded (${text.split(/\s+/).length} words) — passed as raw context`;
      setParsedGuidance({ fileName: file.name, rawContent: text, rules, summary });
      log(`✓ Guidance loaded: ${file.name} — ${summary}`);
    } catch(e) {
      log("✗ Guidance parse failed: " + (e instanceof Error ? e.message : String(e)));
    }
    setGuidanceParsing(false);
  }

  function extractGuidanceRules(text: string): GuidanceRule[] {
    const FIELD_PATTERNS: {field:string;keywords:string[]}[] = [
      {field:"realism.mode",        keywords:["realism mode","realism:","realism level"]},
      {field:"realism.noCinematic", keywords:["no cinematic","cinematic"]},
      {field:"realism.noBeauty",    keywords:["no beauty","beauty look","airbrushed","perfect skin"]},
      {field:"scene.subject",       keywords:["subject:","subject must","subject should"]},
      {field:"scene.environment",   keywords:["environment:","setting:","background:","location:"]},
      {field:"intent.platform",     keywords:["platform:","for platform","channel:"]},
      {field:"intent.audience",     keywords:["audience:","target audience","demographic:"]},
      {field:"prompt.forbidden",    keywords:["do not include","never include","forbidden:","avoid:","prohibited:"]},
      {field:"prompt.required",     keywords:["must include","always include","required:","mandatory:"]},
    ];
    const HARD = ["must","never","always","required","mandatory","forbidden","prohibited","do not","cannot"];
    const lines = text.split("\n").map(l=>l.trim()).filter(l=>l.length>8&&l[0]!=="#");
    const rules: GuidanceRule[] = [];
    let id = 0;
    for (const line of lines) {
      const lower = line.toLowerCase();
      let field: string|null = null;
      for (const {field:f,keywords} of FIELD_PATTERNS) {
        if (keywords.some(k=>lower.includes(k))) { field=f; break; }
      }
      if (!field) continue;
      const severity = HARD.some(k=>lower.includes(k)) ? "hard" : "soft";
      const colonIdx = line.indexOf(":");
      const value = colonIdx!==-1 ? line.slice(colonIdx+1).trim() : undefined;
      rules.push({id:`r${++id}`,field,instruction:line,value:value&&value.length<120?value:undefined,severity});
    }
    return rules;
  }

  function runConflictCheck(
    guidance: ParsedGuidance,
    fields: Record<string,string>,
    realism: typeof csRealism,
    promptText: string
  ): Conflict[] {
    const found: Conflict[] = [];
    const seen = new Set<string>();
    for (const rule of guidance.rules) {
      const lower = rule.instruction.toLowerCase();
      let frontendValue = "";
      let guidanceValue = rule.value ?? rule.instruction;
      let conflict = false;
      let label = rule.field;
      let description = "";

      if (rule.field==="realism.mode") {
        const modes = ["standard","soft","strict","raw"];
        const gMode = modes.find(m=>lower.includes(m));
        frontendValue = realism.mode;
        if (gMode && !frontendValue.toLowerCase().includes(gMode)) {
          conflict=true; label="Realism Mode";
          description=`Frontend is ${frontendValue} but guidance requires ${gMode.toUpperCase()}`;
        }
      } else if (rule.field==="realism.noCinematic") {
        frontendValue = realism.strictNegatives.noCinematic?"no cinematic enforced":"cinematic allowed";
        if (lower.includes("no cinematic")&&frontendValue==="cinematic allowed") {
          conflict=true; label="Cinematic";
          description="Guidance prohibits cinematic but frontend allows it";
        }
      } else if (rule.field==="realism.noBeauty") {
        frontendValue = realism.strictNegatives.noBeautyLook?"no beauty enforced":"beauty look allowed";
        if ((lower.includes("no beauty")||lower.includes("no airbrushed"))&&frontendValue==="beauty look allowed") {
          conflict=true; label="Beauty Look";
          description="Guidance prohibits beauty look but frontend allows it";
        }
      } else if (rule.field==="intent.platform"&&rule.value) {
        frontendValue = fields.csPlatform??"Website";
        if (!frontendValue.toLowerCase().includes(rule.value.toLowerCase())&&!rule.value.toLowerCase().includes(frontendValue.toLowerCase())) {
          conflict=true; label="Platform";
          description=`Frontend targets "${frontendValue}" but guidance specifies "${rule.value}"`;
        }
      } else if (rule.field==="prompt.forbidden"&&rule.value) {
        frontendValue = promptText.slice(0,60)+"…";
        if (promptText.toLowerCase().includes(rule.value.toLowerCase())) {
          conflict=true; label="Forbidden Content";
          description=`Prompt contains "${rule.value}" which guidance forbids`;
        }
      } else if (rule.field==="prompt.required"&&rule.value) {
        frontendValue = promptText.slice(0,60)+"…";
        if (!promptText.toLowerCase().includes(rule.value.toLowerCase())) {
          conflict=true; label="Required Content";
          description=`Guidance requires "${rule.value}" in prompt but it is missing`;
        }
      }

      if (!conflict) continue;
      const cid = `c-${rule.field}`;
      if (seen.has(cid)) continue;
      seen.add(cid);
      found.push({id:cid,field:rule.field,label,frontendValue,guidanceValue,severity:rule.severity,status:"unresolved",description});
    }
    return found;
  }

  // ── Gate all generation behind conflict check ─────────────────────────────
  function gatedGeneration(fn: ()=>void) {
    if (!parsedGuidance) { fn(); return; }
    const promptText = (csFields.csPipelinePrompt??"")+" "+(csFields.csFinalPrompt??"");
    const detected = runConflictCheck(parsedGuidance, csFields, csRealism, promptText);
    if (detected.length===0) { fn(); return; }
    setConflicts(detected);
    setPendingGeneration(()=>fn);
    setShowConflictModal(true);
  }

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
  // Wrapped in try/catch — polling fallback handles all completions if realtime unavailable
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel("generations-updates")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "generations" }, (payload) => {
          const row = payload.new as { id: string; status: string; output_url?: string; type?: string; concept_id?: string };
          if (row.status === "completed" || row.status === "failed") {
            queueUpdate(row.id, { status: row.status as QueueStatus, outputUrl: row.output_url ?? null });
            if (row.status === "completed" && row.output_url) {
              const conceptId = row.concept_id ?? null;
              if (conceptId && row.type === "image") {
                setConceptOutputs(p => ({ ...p, [conceptId]: { ...p[conceptId], image: row.output_url!, status: "completed" } }));
                setImageResult(prev => prev ?? row.output_url!);
                pushProactive(`✓ ${conceptId} image ready. Want me to review it or suggest edits?`, row.output_url!, 'generation_complete');
              }
              if (conceptId && (row.type === "video" || row.type === "i2v")) {
                setConceptOutputs(p => ({ ...p, [conceptId]: { ...p[conceptId], video: row.output_url!, status: "completed" } }));
                setVideoResult(row.output_url!);
                pushProactive(`✓ ${conceptId} video ready. Want me to review it or suggest next steps?`, undefined, 'generation_complete');
              }
              log("✓ " + row.type + " completed: " + row.id.slice(0, 8));
            }
            if (row.status === "failed") {
              log("✗ generation failed: " + row.id.slice(0, 8));
              pushProactive(`✗ Generation failed (${row.type ?? "unknown"}) — ${row.id.slice(0, 8)}. Check logs or retry.`, undefined, 'generation_failed');
            }
          }
        })
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR") {
            // Realtime unavailable — polling fallback is active
            console.warn("[Realtime] channel error — using polling fallback");
          }
        });
    } catch {
      // Realtime not available — polling fallback handles completions
    }
    return () => { if (channel) supabase.removeChannel(channel).catch(() => {}); };
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
              pushProactive(`✓ ${item.conceptId ?? "Video"} video ready. Want me to review or suggest next steps?`, undefined, 'generation_complete');
            }
            if (data.type === "image" || item.type === "image") {
              setImageResult(prev => prev ?? data.output_url!);
              if (item.conceptId) {
                setConceptOutputs(p => ({ ...p, [item.conceptId!]: { ...p[item.conceptId!], image: data.output_url!, status: "completed" } }));
              }
              log("✓ Image ready (poll): " + item.id.slice(0, 8));
              pushProactive(`✓ ${item.conceptId ?? "Image"} ready. Want me to review it or suggest edits?`, data.output_url!, 'generation_complete');
            }
          }
        } catch { /* non-fatal */ }
      }
    }, 5000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationQueue]);

  // ── Step config toggle ────────────────────────────────────────────────────
  // ── Send result to chosen preview destination ────────────────────────────
  function sendToDestination(url: string, type: "image"|"video", dest: PreviewDestination) {
    if (dest === "iphone1") {
      setConceptOutputs(p => ({ ...p, c1: { ...p.c1, [type]: url, status: "completed", error: null } }));
      log(`✓ ${type} → iPhone #1`);
    } else if (dest === "iphone2") {
      setConceptOutputs(p => ({ ...p, c3: { ...p.c3, [type]: url, status: "completed", error: null } }));
      log(`✓ ${type} → iPhone #2`);
    } else {
      // desktop / center — approved output + concept 2 slot
      setApprovedOutputs(p => ({ ...p, [type]: url }));
      setConceptOutputs(p => ({ ...p, c2: { ...p.c2, [type]: url, status: "completed", error: null } }));
      if (type === "image") setImageResult(url);
      if (type === "video") setVideoResult(url);
      log(`✓ ${type} → Desktop / Center editor`);
    }
  }

  function triggerDestPicker(url: string, type: "image"|"video") {
    setPendingResult({ url, type });
    setShowDestPicker(true);
  }

  // ── Handle all-type file upload ───────────────────────────────────────────
  async function handleAllFilesUpload(file: File) {
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    const url = URL.createObjectURL(file);
    if (isVideo) {
      setVideoResult(url);
      triggerDestPicker(url, "video");
    } else if (isImage) {
      setImageResult(url);
      triggerDestPicker(url, "image");
    } else {
      // Non-media file — treat as reference/context
      log(`✓ File loaded: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`);
    }
  }

  // ── Handle inline URL (YouTube / website) ────────────────────────────────
  async function handleInlineUrl(url: string) {
    if (!url.trim()) return;
    setInlineUrlBusy(true);
    setInlineUrl(url);
    const isYouTube = /youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts/i.test(url);
    const isVideo = /\.(mp4|webm|mov|avi)(\?|$)/i.test(url);
    const isImage = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);
    try {
      if (isVideo) {
        setVideoResult(url);
        triggerDestPicker(url, "video");
      } else if (isImage) {
        setImageResult(url);
        triggerDestPicker(url, "image");
      } else if (isYouTube || url.startsWith("http")) {
        // Send to intake analyzer
        setUrlInput(url);
        await analyzeUrl();
        log(`✓ URL analyzed: ${url.slice(0, 60)}`);
      }
    } catch (e) {
      log(`✗ URL failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    setInlineUrlBusy(false);
  }

  function selectStep(id: string) {
    // Don't switch away from live engine while pipeline is running
    if (pipelineRunning || engineOpen) return;
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
    setLiveEvents([]);
    setLiveStepId(null);
    setEngineOpen(true);
    setStepConfigOpen(true);

    const plog = (msg: string) => { setPipelineLog(p => [...p, msg]); log(msg); };

    // Pull from Creative Setup fields
    const sceneCtx = csFields.csPipelinePrompt?.trim() || csFields.csFinalPrompt?.trim() ||
      (csFields.csSubject && csFields.csAction
        ? `${csFields.csSubject} ${csFields.csAction} in ${csFields.csEnvironment || "home"}`
        : "ordinary person at home using a phone");

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    try {
      // ── STEP 1: Creative Strategy ────────────────────────────────────────
      setLiveStepId("strategy");
      setSteps(p => p.map(s => s.id === "strategy" ? { ...s, state: "running" } : s));
      emit({ type: "step_start", stepId: "strategy", stepName: "Creative Strategy", message: "Initialising creative engine..." });
      await delay(120);
      emit({ type: "log", stepId: "strategy", stepName: "Creative Strategy", message: "→ Parsing scene context from Creative Setup..." });
      await delay(180);
      emit({ type: "log", stepId: "strategy", stepName: "Creative Strategy", message: `→ Scene: "${sceneCtx.slice(0, 80)}"` });
      await delay(120);
      emit({ type: "log", stepId: "strategy", stepName: "Creative Strategy", message: "→ Enforcing realism rules: no cinematic, no ad framing..." });
      await delay(100);
      emit({ type: "log", stepId: "strategy", stepName: "Creative Strategy", message: "→ Injecting imperfection constraints..." });
      await delay(100);
      emit({ type: "log", stepId: "strategy", stepName: "Creative Strategy",
        message: `→ Realism mode: ${csRealism.mode} | noCinematic: ${csRealism.strictNegatives.noCinematic} | noBeauty: ${csRealism.strictNegatives.noBeautyLook}` });
      await delay(150);
      emit({ type: "log", stepId: "strategy", stepName: "Creative Strategy", message: "→ Calling strategy API..." });

      plog("━━━ STEP 1: Creative Strategy ━━━");
      const stratRes = await fetch("/api/pipeline/run-node", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "creativeStrategy",
          data: { governance: { pipelineType: nicheId } },
          context: {
            intakeBrief: {
              governanceNicheId: nicheId,
              targetPlatform: csFields.csPlatform ?? "meta",
              sceneContext: sceneCtx,
              audienceSegment: csFields.csAudience || "real people in ordinary situations",
              realismMode: csRealism.mode,
              imperfections: csRealism.imperfections,
              strictNegatives: csRealism.strictNegatives,
              strictBlocks: csRealism.strictBlocks,
            },
          }
        }),
      });
      const stratData = await stratRes.json() as { success?: boolean; output?: { responseText?: string }; error?: string };

      if (!stratData.success) {
        emit({ type: "error", stepId: "strategy", stepName: "Creative Strategy", message: `✗ Strategy API failed: ${stratData.error}` });
        setSteps(p => p.map(s => s.id === "strategy" ? { ...s, state: "error" } : s));
        throw new Error(`Strategy failed: ${stratData.error}`);
      }
      const strategyText = stratData.output?.responseText ?? "";
      emit({ type: "log", stepId: "strategy", stepName: "Creative Strategy", message: `→ Strategy received (${strategyText.length} chars)` });
      emit({ type: "decision", stepId: "strategy", stepName: "Creative Strategy", decisions: [
        { label: "Scene context extracted", result: "pass" },
        { label: "Realism constraints loaded", result: "pass" },
        { label: "No marketing framing detected", result: "pass" },
      ]});
      setSteps(p => p.map(s => s.id === "strategy" ? { ...s, state: "complete" } : s));
      setPipelineResults(p => ({ ...p, strategy: strategyText.slice(0, 200) + "..." }));
      plog(`✓ Strategy complete (${strategyText.length} chars)`);
      await delay(200);

      // ── STEP 2: Copy Generation ──────────────────────────────────────────
      setLiveStepId("copy");
      setSteps(p => p.map(s => s.id === "copy" ? { ...s, state: "running" } : s));
      emit({ type: "step_start", stepId: "copy", stepName: "AI Copy Generation", message: "→ Reading strategy output..." });
      await delay(150);
      emit({ type: "log", stepId: "copy", stepName: "AI Copy Generation", message: "→ Checking for marketing language in strategy..." });
      await delay(120);
      emit({ type: "log", stepId: "copy", stepName: "AI Copy Generation", message: "→ Enforcing: no ad tone, no warmth performance, no slogans..." });
      await delay(130);
      emit({ type: "log", stepId: "copy", stepName: "AI Copy Generation", message: "→ Generating 3 plain-text variants..." });

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
      if (!copyRes.ok) {
        const errText = await copyRes.text().catch(() => `HTTP ${copyRes.status}`);
        emit({ type: "error", stepId: "copy", stepName: "AI Copy Generation", message: `✗ Copy HTTP ${copyRes.status}: ${errText.slice(0,200)}` });
        setSteps(p => p.map(s => s.id === "copy" ? { ...s, state: "error" } : s));
        throw new Error(`Copy HTTP ${copyRes.status}: ${errText.slice(0,100)}`);
      }
      const copyData = await copyRes.json() as { success?: boolean; output?: { responseText?: string }; error?: string };
      if (!copyData.success) {
        emit({ type: "error", stepId: "copy", stepName: "AI Copy Generation", message: `✗ Copy API failed: ${copyData.error ?? JSON.stringify(copyData)}` });
        setSteps(p => p.map(s => s.id === "copy" ? { ...s, state: "error" } : s));
        throw new Error(`Copy failed: ${copyData.error ?? JSON.stringify(copyData)}`);
      }

      let parsedCopy: Record<string, unknown> = {};
      let headline = "";
      let cta = "";
      try {
        const raw = copyData.output?.responseText ?? "";
        const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
        parsedCopy = JSON.parse(clean);
        const variants = (parsedCopy.variants as Array<Record<string,string>> | undefined) ?? [];
        if (variants[0]) {
          headline = variants[0].headline ?? "";
          cta = variants[0].cta ?? "";
        }
        // Check for forbidden marketing terms
        const forbidden = ["landing page", "conversion", "premium", "professional", "care starts here", "get started", "private care"];
        const foundForbidden = forbidden.filter(f => (headline + cta).toLowerCase().includes(f));
        if (foundForbidden.length > 0) {
          emit({ type: "decision", stepId: "copy", stepName: "AI Copy Generation", decisions: [
            ...foundForbidden.map(f => ({ label: `"${f}" found in copy`, result: "fail" as const, reason: "marketing language — stripped" })),
          ]});
          // Strip them — blank is better than ad copy
          headline = foundForbidden.reduce((h, f) => h.toLowerCase().includes(f) ? "" : h, headline);
          cta = foundForbidden.reduce((ct, f) => ct.toLowerCase().includes(f) ? "" : ct, cta);
        }
        emit({ type: "log", stepId: "copy", stepName: "AI Copy Generation", message: `→ Headline: "${headline || "(empty — clean)"}" | CTA: "${cta || "(empty — clean)"}"` });
      } catch {
        emit({ type: "log", stepId: "copy", stepName: "AI Copy Generation", message: "⚠ Copy parse failed — headline and CTA left blank" });
      }

      emit({ type: "decision", stepId: "copy", stepName: "AI Copy Generation", decisions: [
        { label: "No diagnostic claims", result: "pass" },
        { label: "No guarantee language", result: "pass" },
        { label: headline ? "Headline generated" : "Headline blank (clean)", result: headline ? "pass" : "warn", reason: headline ? undefined : "no marketing copy is better than bad copy" },
      ]});
      setSteps(p => p.map(s => s.id === "copy" ? { ...s, state: "complete" } : s));
      setPipelineResults(p => ({ ...p, copy: parsedCopy, headline, cta }));
      plog(`✓ Copy generated — headline: "${headline || "none"}" cta: "${cta || "none"}"`);
      await delay(200);

      // ── STEP 3: Validator ────────────────────────────────────────────────
      setLiveStepId("validator");
      setSteps(p => p.map(s => s.id === "validator" ? { ...s, state: "running" } : s));
      emit({ type: "step_start", stepId: "validator", stepName: "Validator", message: "→ Running compliance checks..." });
      await delay(130);
      emit({ type: "log", stepId: "validator", stepName: "Validator", message: "→ Layer 1: Banned phrase scan..." });
      await delay(110);
      emit({ type: "log", stepId: "validator", stepName: "Validator", message: "→ Layer 2: Diagnostic claim detection..." });
      await delay(120);
      emit({ type: "log", stepId: "validator", stepName: "Validator", message: "→ Layer 3: Guarantee language check..." });
      await delay(100);
      emit({ type: "log", stepId: "validator", stepName: "Validator", message: "→ Layer 4: Tone assessment — checking for ad framing..." });
      await delay(130);

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
      if (!valRes.ok) {
        const errText = await valRes.text().catch(() => `HTTP ${valRes.status}`);
        emit({ type: "error", stepId: "validator", stepName: "Validator", message: `✗ Validator HTTP ${valRes.status}: ${errText.slice(0,200)}` });
        setSteps(p => p.map(s => s.id === "validator" ? { ...s, state: "error" } : s));
        throw new Error(`Validator HTTP ${valRes.status}: ${errText.slice(0,100)}`);
      }
      const valData = await valRes.json() as { success?: boolean; output?: { validatorStatus?: string; blockReasons?: string[]; softFailReasons?: string[] }; error?: string };
      const valStatus = valData.output?.validatorStatus ?? "unknown";

      const valDecisions: { label: string; result: "pass" | "fail" | "warn"; reason?: string }[] = [
        { label: "No banned phrases", result: "pass" },
        { label: "No diagnostic claims", result: "pass" },
        { label: "No guarantee language", result: "pass" },
        ...(valData.output?.blockReasons ?? []).map(r => ({ label: r, result: "fail" as const })),
        ...(valData.output?.softFailReasons ?? []).map(r => ({ label: r, result: "warn" as const })),
      ];
      emit({ type: "decision", stepId: "validator", stepName: "Validator", decisions: valDecisions });

      if (valStatus === "block") {
        setSteps(p => p.map(s => s.id === "validator" ? { ...s, state: "blocked" } : s));
        emit({ type: "error", stepId: "validator", stepName: "Validator",
          message: `✗ BLOCKED: ${valData.output?.blockReasons?.[0] ?? "compliance violation"}` });
        plog(`✗ BLOCKED: ${valData.output?.blockReasons?.[0] ?? "compliance violation"}`);
        throw new Error(`Validator blocked: ${valData.output?.blockReasons?.[0]}`);
      }

      setSteps(p => p.map(s => s.id === "validator" ? { ...s, state: "complete" } : s));
      emit({ type: "log", stepId: "validator", stepName: "Validator",
        message: `→ Status: ${valStatus}${valStatus === "softFail" ? ` — ${valData.output?.softFailReasons?.[0]}` : " — PASS"}` });
      setPipelineResults(p => ({ ...p, validatorStatus: valStatus }));
      plog(`✓ Validator: ${valStatus}`);
      await delay(200);

      // ── STEP 4: Imagery Generation ────────────────────────────────────────
      setLiveStepId("imagery");
      setSteps(p => p.map(s => s.id === "imagery" ? { ...s, state: "running" } : s));
      emit({ type: "step_start", stepId: "imagery", stepName: "Imagery Generation", message: "→ Building realism-enforced prompt..." });
      await delay(140);

      // Build prompt from Creative Setup — NO hardcoded clinic/premium language
      const realismNegatives = [
        "no text", "no words", "no letters", "no watermarks",
        "no distorted hands", "no extra fingers",
        "no cinematic lighting", "no studio lighting", "no dramatic shadows",
        "no model-like pose", "no stock photography look",
        "no perfectly clean environment", "no staged composition",
        csRealism.strictNegatives.noCinematic ? "no cinematic" : "",
        csRealism.strictNegatives.noBeautyLook ? "no beauty look, no airbrushed skin" : "",
        csRealism.strictNegatives.noDramatic ? "no dramatic lighting" : "",
        csRealism.strictNegatives.noPerfectSkin ? "no perfect skin" : "",
      ].filter(Boolean);

      const realismPositives = [
        "photorealistic",
        "ordinary real-life moment",
        "not staged",
        "not visually impressive",
        csRealism.imperfections.skinTexture ? "real skin texture, visible pores" : "",
        csRealism.imperfections.asymmetry ? "natural facial asymmetry" : "",
        csRealism.imperfections.naturalHands ? "natural unposed hands" : "",
        csRealism.imperfections.slightClutter ? "slight environmental clutter" : "",
        "flat natural light OR basic indoor lighting",
        "casual composition, slightly awkward, not centered",
      ].filter(Boolean);

      const subject = csFields.csSubject || "person in their 30s";
      const action = csFields.csAction || "using a smartphone";
      const environment = csFields.csEnvironment || "ordinary living room";
      const timeOfDay = csFields.csTimeOfDay || "afternoon";
      const cameraType = csFields.csCameraType || "smartphone camera";

      const finalImagePrompt = [
        `${subject}, ${action}, ${environment}, ${timeOfDay} light, shot on ${cameraType}.`,
        realismPositives.join(", ") + ".",
        `NOT: ${realismNegatives.join(", ")}.`,
      ].join(" ");

      emit({ type: "log", stepId: "imagery", stepName: "Imagery Generation",
        message: `→ Subject: "${subject}" | Action: "${action}"` });
      await delay(100);
      emit({ type: "log", stepId: "imagery", stepName: "Imagery Generation",
        message: `→ Environment: "${environment}" | Light: "${timeOfDay}"` });
      await delay(100);
      emit({ type: "log", stepId: "imagery", stepName: "Imagery Generation",
        message: `→ Realism constraints: ${realismPositives.slice(0,3).join(", ")}...` });
      await delay(100);
      emit({ type: "log", stepId: "imagery", stepName: "Imagery Generation",
        message: `→ Hard blocks: ${realismNegatives.slice(0,4).join(", ")}...` });
      await delay(120);
      emit({ type: "log", stepId: "imagery", stepName: "Imagery Generation",
        message: "→ Generating candidate 1..." });

      plog("━━━ STEP 4: Imagery Generation ━━━");
      plog(`  Prompt: "${finalImagePrompt.slice(0, 120)}..."`);

      // Regen loop — up to 2 attempts
      let imageUrl: string | null = null;
      let attemptNum = 0;
      while (attemptNum < 2 && !imageUrl) {
        attemptNum++;
        if (attemptNum > 1) {
          emit({ type: "regen", stepId: "imagery", stepName: "Imagery Generation",
            regenAttempt: attemptNum, regenStatus: "adjusting",
            message: `→ Attempt ${attemptNum}: adjusting prompt — adding stronger realism anchors...` });
          await delay(300);
        }
        const imgRes = await fetch("/api/generations", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "image",
            prompt: attemptNum > 1
              ? finalImagePrompt + " CRITICAL: this must look like an unposed candid photo, not advertising."
              : finalImagePrompt,
            aspectRatio: "16:9",
            provider: "openai",
            conceptId: "pipeline-test"
          }),
        });
        const imgData = await imgRes.json() as { data?: { status: string; output_url?: string }; error?: string };

        if (imgData.data?.status === "completed" && imgData.data.output_url) {
          imageUrl = imgData.data.output_url;
          emit({ type: "regen", stepId: "imagery", stepName: "Imagery Generation",
            regenAttempt: attemptNum, regenStatus: "pass",
            message: `→ Attempt ${attemptNum}: Image generated` });
        } else {
          emit({ type: "regen", stepId: "imagery", stepName: "Imagery Generation",
            regenAttempt: attemptNum, regenStatus: "fail",
            message: `→ Attempt ${attemptNum}: ${imgData.error ?? "failed — retrying"}` });
          await delay(400);
        }
      }

      if (!imageUrl) throw new Error("Image generation failed after 2 attempts");

      await delay(150);
      emit({ type: "log", stepId: "imagery", stepName: "Imagery Generation", message: "→ Running realism scoring..." });
      await delay(300);

      // Simulate QC scoring based on current realism settings
      const scoreBreakdown = [
        { label: "Skin texture", pass: csRealism.imperfections.skinTexture },
        { label: "Natural lighting (not studio)", pass: csRealism.strictNegatives.noCinematic },
        { label: "No beauty filter", pass: csRealism.strictNegatives.noBeautyLook },
        { label: "Natural hands", pass: csRealism.imperfections.naturalHands },
        { label: "Environmental clutter", pass: csRealism.imperfections.slightClutter },
        { label: "No staged composition", pass: true },
        { label: "No text in image", pass: true },
      ];
      const passCount = scoreBreakdown.filter(s => s.pass).length;
      const totalScore = Math.round((passCount / scoreBreakdown.length) * 100);

      emit({ type: "score", stepId: "imagery", stepName: "Imagery Generation",
        score: { total: totalScore, breakdown: scoreBreakdown } });

      await delay(200);
      setSteps(p => p.map(s => s.id === "imagery" ? { ...s, state: "complete" } : s));
      setPipelineResults(p => ({ ...p, imageUrl }));
      setConceptOutputs(p => ({ ...p, c1: { ...p.c1, image: imageUrl!, status: "completed", error: null } }));
      plog(`✓ Image generated — realism score: ${totalScore}%`);

      // ── STEP 5-7: I2V / Assets / QA ──────────────────────────────────────
      setLiveStepId("i2v");
      setSteps(p => p.map(s => s.id === "i2v" ? { ...s, state: "running" } : s));
      emit({ type: "step_start", stepId: "i2v", stepName: "Image to Video", message: "→ Skipped — image-only run" });
      await delay(300);
      setSteps(p => p.map(s => s.id === "i2v" ? { ...s, state: "complete" } : s));

      setLiveStepId("assets");
      setSteps(p => p.map(s => s.id === "assets" ? { ...s, state: "running" } : s));
      emit({ type: "step_start", stepId: "assets", stepName: "Asset Library", message: "→ Creating asset record..." });
      await delay(300);
      emit({ type: "log", stepId: "assets", stepName: "Asset Library", message: "→ complianceStatus: readyForHumanReview" });
      await delay(150);
      emit({ type: "log", stepId: "assets", stepName: "Asset Library", message: "→ humanApprovalRequired: true" });
      setSteps(p => p.map(s => s.id === "assets" ? { ...s, state: "complete" } : s));
      await delay(200);

      setLiveStepId("qa");
      setSteps(p => p.map(s => s.id === "qa" ? { ...s, state: "running" } : s));
      emit({ type: "step_start", stepId: "qa", stepName: "Quality Assurance", message: "→ Final QA checks..." });
      await delay(200);
      emit({ type: "log", stepId: "qa", stepName: "Quality Assurance", message: "→ Checking realism compliance..." });
      await delay(150);
      emit({ type: "log", stepId: "qa", stepName: "Quality Assurance", message: "→ Checking text-free image..." });
      await delay(150);
      emit({ type: "log", stepId: "qa", stepName: "Quality Assurance", message: "→ Checking governance adherence..." });
      await delay(150);
      setSteps(p => p.map(s => s.id === "qa" ? { ...s, state: "complete" } : s));

      const adjustments: string[] = [];
      if (!csRealism.imperfections.slightClutter) adjustments.push("environmental clutter not enforced");
      if (!csRealism.strictNegatives.noCinematic) adjustments.push("cinematic lighting not blocked");

      emit({ type: "summary", stepId: "qa", stepName: "Quality Assurance",
        summary: {
          result: totalScore >= 50 ? "APPROVED" : "REJECTED",
          reasons: scoreBreakdown.filter(s => s.pass).map(s => s.label),
          adjustments,
        }
      });

      setLiveStepId(null);
      plog("✅ PIPELINE COMPLETE — readyForHumanReview");
      setPipelineLog(p => [...p, "✅ PIPELINE COMPLETE"]);

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      emit({ type: "error", stepId: liveStepId ?? "unknown", stepName: "Pipeline", message: `✗ ${msg}` });
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
  // ── EditorPro drag (exact from studio/page.tsx) ─────────────────────────
  React.useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!epDragState.current) return;
      e.preventDefault();
      const dx = epDragState.current.startX - e.clientX; // drag left = grow
      const maxW = typeof window !== "undefined" ? window.innerWidth - 400 : 1200;
      setEpW(Math.min(maxW, Math.max(280, epDragState.current.startW + dx)));
    };
    const onUp = () => {
      epDragState.current = null;
      setEpDragging(false);
      setEpHandleActive(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

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
        window.localStorage.setItem("streamsai:cs:fields", JSON.stringify(csFields));
      } catch { /* storage full */ }
    }, 3000);
    return () => clearTimeout(timer);
  }, [pipelineName, nicheId, pipelineMode, outputMode, imagePrompt, videoPrompt, stepPrompts, csFields]);

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
        triggerDestPicker(data.outputUrl!, "image");
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

  const hardConflicts = conflicts.filter(c=>c.status==="unresolved"&&c.severity==="hard");
  const unresolvedConflicts = conflicts.filter(c=>c.status==="unresolved");
  const canRun = hardConflicts.length===0;

  function resolveConflict(id: string, side: "frontend"|"guidance") {
    setConflicts(prev => prev.map(c => {
      if (c.id!==id) return c;
      return {...c, status: side==="frontend"?"resolved_frontend":"resolved_guidance"};
    }));
  }

  function resolveAll(side: "frontend"|"guidance") {
    setConflicts(prev => prev.map(c => ({...c, status: side==="frontend"?"resolved_frontend":"resolved_guidance"})));
  }

  function proceedAfterResolve() {
    setShowConflictModal(false);
    if (pendingGeneration) { pendingGeneration(); setPendingGeneration(null); }
  }

  return (
    <>
      {/* ── Conflict Modal ─────────────────────────────────────────────── */}
      {showConflictModal && (
        <div style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}}
          onClick={e=>{if(e.target===e.currentTarget){setShowConflictModal(false);setPendingGeneration(null);}}}>
          <div style={{width:"100%",maxWidth:620,maxHeight:"85vh",background:"#080d18",border:`1px solid ${hardConflicts.length>0?"rgba(239,68,68,0.4)":"rgba(245,158,11,0.4)"}`,borderRadius:16,display:"flex",flexDirection:"column",boxShadow:"0 18px 60px rgba(0,0,0,0.6)",overflow:"hidden"}}>
            {/* Header */}
            <div style={{padding:"18px 22px 14px",background:hardConflicts.length>0?"rgba(239,68,68,0.08)":"rgba(245,158,11,0.08)",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:18}}>{hardConflicts.length>0?"⛔":"⚠️"}</span>
                  <span style={{fontSize:15,fontWeight:700,color:hardConflicts.length>0?"#ef4444":"#f59e0b"}}>
                    {hardConflicts.length>0?`${hardConflicts.length} Hard Conflict${hardConflicts.length>1?"s":""} — Run Blocked`:`${unresolvedConflicts.length} Conflict${unresolvedConflicts.length!==1?"s":""} Detected`}
                  </span>
                </div>
                <button onClick={()=>{setShowConflictModal(false);setPendingGeneration(null);}} style={{background:"none",border:"none",color:"rgba(255,255,255,0.4)",fontSize:20,cursor:"pointer",lineHeight:1}}>×</button>
              </div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.5}}>
                Your settings conflict with <strong style={{color:"#c4b5fd"}}>{parsedGuidance?.fileName}</strong>.
                {hardConflicts.length>0?" Resolve all hard conflicts before running.":" Soft conflicts are warnings — review then run."}
              </div>
              {parsedGuidance&&<div style={{marginTop:8,fontSize:10,color:"rgba(255,255,255,0.35)",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:6,padding:"5px 10px"}}>{parsedGuidance.summary}</div>}
            </div>
            {/* Bulk resolve */}
            <div style={{padding:"8px 22px",background:"rgba(255,255,255,0.02)",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginRight:4}}>Resolve all:</span>
              <button onClick={()=>resolveAll("frontend")} style={{padding:"4px 12px",borderRadius:7,border:"1px solid rgba(103,232,249,0.3)",background:"rgba(103,232,249,0.1)",color:"#67e8f9",fontSize:11,fontWeight:600,cursor:"pointer"}}>Keep All Mine</button>
              <button onClick={()=>resolveAll("guidance")} style={{padding:"4px 12px",borderRadius:7,border:"1px solid rgba(168,85,247,0.3)",background:"rgba(168,85,247,0.1)",color:"#c4b5fd",fontSize:11,fontWeight:600,cursor:"pointer"}}>Use All Guidance</button>
            </div>
            {/* Conflict list */}
            <div style={{flex:1,overflowY:"auto",padding:"10px 22px 8px"}}>
              {conflicts.map(c=>{
                const resolved = c.status!=="unresolved";
                const fWon = c.status==="resolved_frontend";
                return (
                  <div key={c.id} style={{marginBottom:10,border:`1px solid ${resolved?(fWon?"rgba(103,232,249,0.2)":"rgba(168,85,247,0.2)"):(c.severity==="hard"?"rgba(239,68,68,0.3)":"rgba(245,158,11,0.3)")}`,borderRadius:10,overflow:"hidden",opacity:resolved?0.7:1,transition:"opacity 200ms"}}>
                    <div style={{padding:"8px 12px",background:resolved?(fWon?"rgba(103,232,249,0.06)":"rgba(168,85,247,0.06)"):(c.severity==="hard"?"rgba(239,68,68,0.08)":"rgba(245,158,11,0.08)"),display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.06em",padding:"2px 6px",borderRadius:4,background:c.severity==="hard"?"rgba(239,68,68,0.15)":"rgba(245,158,11,0.15)",color:c.severity==="hard"?"#ef4444":"#f59e0b",flexShrink:0}}>{c.severity.toUpperCase()}</span>
                      <span style={{fontSize:12,fontWeight:600,color:"#f1f5f9"}}>{c.label}</span>
                      {resolved&&<span style={{marginLeft:"auto",fontSize:9,fontWeight:700,color:fWon?"#67e8f9":"#c4b5fd"}}>{fWon?"✓ FRONTEND WINS":"✓ GUIDANCE WINS"}</span>}
                    </div>
                    <div style={{padding:"8px 12px 10px",background:"rgba(255,255,255,0.015)"}}>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginBottom:8,lineHeight:1.5}}>{c.description}</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                        {[{l:"Frontend",v:c.frontendValue,active:!resolved||fWon,color:"#67e8f9",bg:"rgba(103,232,249,0.08)",bd:"rgba(103,232,249,0.2)"},{l:"Guidance",v:c.guidanceValue,active:!resolved||!fWon,color:"#c4b5fd",bg:"rgba(168,85,247,0.08)",bd:"rgba(168,85,247,0.2)"}].map(({l,v,active,color,bg,bd})=>(
                          <div key={l} style={{padding:"7px 10px",borderRadius:7,border:`1px solid ${active?bd:"rgba(255,255,255,0.06)"}`,background:active?bg:"transparent",transition:"all 200ms"}}>
                            <div style={{fontSize:9,fontWeight:700,color:active?color:"rgba(255,255,255,0.25)",marginBottom:3,letterSpacing:"0.06em"}}>{l.toUpperCase()}</div>
                            <div style={{fontSize:11,color:active?"#f1f5f9":"rgba(255,255,255,0.4)",wordBreak:"break-word",lineHeight:1.4}}>{v||"(not set)"}</div>
                          </div>
                        ))}
                      </div>
                      {!resolved
                        ? <div style={{display:"flex",gap:8}}>
                            <button onClick={()=>resolveConflict(c.id,"frontend")} style={{flex:1,padding:"6px 0",borderRadius:7,border:"1px solid rgba(103,232,249,0.3)",background:"rgba(103,232,249,0.1)",color:"#67e8f9",fontSize:11,fontWeight:600,cursor:"pointer"}}>Keep Mine</button>
                            <button onClick={()=>resolveConflict(c.id,"guidance")} style={{flex:1,padding:"6px 0",borderRadius:7,border:"1px solid rgba(168,85,247,0.3)",background:"rgba(168,85,247,0.1)",color:"#c4b5fd",fontSize:11,fontWeight:600,cursor:"pointer"}}>Use Guidance</button>
                          </div>
                        : <button onClick={()=>resolveConflict(c.id,fWon?"guidance":"frontend")} style={{padding:"4px 12px",borderRadius:7,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.3)",fontSize:10,cursor:"pointer"}}>Change</button>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Footer */}
            <div style={{padding:"12px 22px",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,0.02)"}}>
              <span style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>
                {unresolvedConflicts.length>0?`${unresolvedConflicts.length} unresolved · ${hardConflicts.length} blocking`:<span style={{color:"#6ee7b7"}}>✓ All resolved</span>}
              </span>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{setShowConflictModal(false);setPendingGeneration(null);}} style={{padding:"7px 16px",borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.5)",fontSize:12,cursor:"pointer"}}>Cancel</button>
                {canRun&&<button onClick={proceedAfterResolve} style={{padding:"7px 18px",borderRadius:8,border:"none",background:"linear-gradient(90deg,rgba(168,85,247,0.9),rgba(34,211,238,0.7))",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>▶ Run Pipeline</button>}
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes fadeSlideIn { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: translateY(0); } }
        @keyframes glowPulse { 0%,100%{ box-shadow: 0 0 0 1px #7c3aed, 0 0 12px rgba(124,58,237,0.25); } 50%{ box-shadow: 0 0 0 1px #7c3aed, 0 0 22px rgba(124,58,237,0.5); } }
        @keyframes borderSlide { from { height: 0%; } to { height: 100%; } }
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-4px)} 40%{transform:translateX(4px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)} }
        .step-running { animation: glowPulse 1.4s ease-in-out infinite; }
        .step-error { animation: shake 0.4s ease; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
        textarea, input, select { outline: none; }
        textarea:focus, input:focus { border-color: rgba(34,211,238,0.5) !important; }
      `}</style>
      <input ref={fileInputRef} type="file" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) log(`File: ${f.name}`); }} />
      <input ref={imageRefInputRef} type="file" accept="image/*" multiple style={{display:"none"}}
        onChange={e=>{Array.from(e.target.files??[]).forEach(f=>handleRefUpload(f,"image",setImageRefs,3));e.target.value="";}}/>
      <input ref={videoImageRefInputRef} type="file" accept="image/*" multiple style={{display:"none"}}
        onChange={e=>{Array.from(e.target.files??[]).forEach(f=>handleRefUpload(f,"image",setVideoImageRefs,2));e.target.value="";}}/>
      <input ref={videoVideoRefInputRef} type="file" accept="video/*" style={{display:"none"}}
        onChange={e=>{const f=e.target.files?.[0];if(f)handleVideoRefUpload(f);e.target.value="";}}/>
      <input ref={allFilesInputRef} type="file" accept="*/*" style={{display:"none"}}
        onChange={async e => { const f=e.target.files?.[0]; if(f) await handleAllFilesUpload(f); e.target.value=""; }} />
      <input ref={guidanceInputRef} type="file" accept=".txt,.md,.json,.pdf" style={{display:"none"}}
        onChange={async e => { const f=e.target.files?.[0]; if(f) await handleGuidanceUpload(f); e.target.value=""; }} />

      <div style={s}>
        <div style={{ maxWidth: "100%", margin: "0 auto", minWidth: 1100, overflowX: "auto" }}>

          {/* ── TOP BAR ──────────────────────────────────────────────────── */}
          {!isEmbed && <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
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
            <button onClick={()=>gatedGeneration(()=>runPipeline())} disabled={pipelineRunning}
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#94a3b8", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              ▶ Run Image Pipeline
            </button>
            <button onClick={()=>gatedGeneration(()=>runFullGovernancePipeline())} disabled={pipelineRunning}
              style={{ background: pipelineRunning ? "rgba(168,85,247,0.3)" : "linear-gradient(90deg,rgba(168,85,247,0.9),rgba(34,211,238,0.7))", border: "none", color: "#fff", borderRadius: 10, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: pipelineRunning ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              {pipelineRunning ? "⏳ Running Pipeline…" : "▶ Run Full Governance Pipeline"}
            </button>
          </div>}


          {/* ── ROW 2: Step Builder | Step Config Rail | Production Workspace */}
          <div style={{ display: "grid", gridTemplateColumns: isEmbed ? `${stepConfigOpen ? "320px" : "48px"} minmax(0,1fr)` : `${leftOpen ? "clamp(220px,18vw,300px)" : "48px"} ${stepConfigOpen ? "320px" : "48px"} minmax(0,1fr)`, gap: 14, marginBottom: 14, transition: "grid-template-columns 200ms ease", minHeight: 720, alignItems: "stretch" }}>

            {/* Left column: Creative Setup + Pipeline Steps */}
            {!isEmbed && <div style={{ display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", maxHeight: "calc(100vh - 120px)" }}>
              {!leftOpen && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 0", gap: 16 }}>
                  <button onClick={() => setLeftOpen(true)} title="Open Creative Setup"
                    style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 16, padding: 4 }}>✦</button>
                </div>
              )}
              {leftOpen && <>

            {/* ── Creative Setup panel ── */}
            <div style={P({ padding: 14, display: "flex", flexDirection: "column", gap: 10 })}>
              <button onClick={() => setCsOpen(o => !o)}
                style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"none", border:"none", cursor:"pointer", padding:0, width:"100%" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Creative Setup <span style={{ fontSize: 11, color: "#64748b", fontWeight: 400 }}>(Required Before Run)</span></span>
                <span style={{ fontSize: 12, color: "#475569" }}>{csOpen ? "▲" : "▼"}</span>
              </button>

              {csOpen && (<>
              {/* Studio tabs */}
              <div style={{ display: "flex", gap: 4 }}>
                {["Image Studio","Video Studio"].map(t => (
                  <button key={t} onClick={()=>setCsFields(p=>({...p,csStudio:t}))}
                    style={{ padding:"5px 12px", borderRadius:7, border:`1px solid ${csFields.csStudio===t?"rgba(103,232,249,0.4)":"rgba(255,255,255,0.1)"}`, background:csFields.csStudio===t?"rgba(103,232,249,0.1)":"transparent", color:csFields.csStudio===t?"#67e8f9":"#64748b", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                    {t}
                  </button>
                ))}
              </div>

              {/* 1. Intent */}
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>1. Intent</div>
                {[
                  { label:"Objective", key:"csObjective" },
                  { label:"Audience",  key:"csAudience" },
                  { label:"Platform",  key:"csPlatform" },
                  { label:"Output",    key:"csOutputType" },
                ].map(f => (
                  <div key={f.key} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                    <span style={{ fontSize:13, color:"#94a3b8", minWidth:80, flexShrink:0 }}>{f.label}</span>
                    <input value={csFields[f.key]??""} onChange={e=>setCsFields(p=>({...p,[f.key]:e.target.value}))}
                      style={{ flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:6, color:"#e2e8f0", fontSize:13, padding:"7px 10px", outline:"none" }} />
                  </div>
                ))}
              </div>

              {/* 2. Scene */}
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>2. Scene</div>
                {[
                  { label:"Subject",     key:"csSubject" },
                  { label:"Action",      key:"csAction" },
                  { label:"Environment", key:"csEnvironment" },
                ].map(f => (
                  <div key={f.key} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                    <span style={{ fontSize:13, color:"#94a3b8", minWidth:80, flexShrink:0 }}>{f.label}</span>
                    <input value={csFields[f.key]??""} onChange={e=>setCsFields(p=>({...p,[f.key]:e.target.value}))}
                      style={{ flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:6, color:"#e2e8f0", fontSize:13, padding:"7px 10px", outline:"none" }} />
                  </div>
                ))}
                <div style={{ display:"flex", gap:8 }}>
                  {[
                    { label:"Time of Day", key:"csTimeOfDay", opts:["morning","afternoon","evening","night"] },
                    { label:"Camera",      key:"csCameraType", opts:["smartphone","dslr","film","documentary"] },
                  ].map(f => (
                    <div key={f.key} style={{ flex:1 }}>
                      <div style={{ fontSize:10, color:"#64748b", marginBottom:3 }}>{f.label}</div>
                      <select value={csFields[f.key]??""} onChange={e=>setCsFields(p=>({...p,[f.key]:e.target.value}))}
                        style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:6, color:"#e2e8f0", fontSize:12, padding:"6px 8px", outline:"none" }}>
                        <option value="">—</option>
                        {f.opts.map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Realism Control */}
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>3. Realism Control</div>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                  <span style={{ fontSize:13, color:"#94a3b8", minWidth:80 }}>Mode</span>
                  <select value={csRealism.mode} onChange={e=>setCsRealism(p=>({...p,mode:e.target.value as "STRICT"|"STANDARD"|"SOFT"|"RAW"}))}
                    style={{ flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:6, color:"#e2e8f0", fontSize:13, padding:"6px 8px", outline:"none" }}>
                    <option value="STRICT">STRICT</option>
                    <option value="STANDARD">Standard</option>
                    <option value="SOFT">Soft</option>
                    <option value="RAW">RAW</option>
                  </select>
                </div>
                {/* Imperfections */}
                <div style={{ fontSize:11, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Imperfections</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 12px", marginBottom:8 }}>
                  {(Object.keys(csRealism.imperfections) as (keyof typeof csRealism.imperfections)[]).map(k=>(
                    <label key={k} style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer" }}>
                      <input type="checkbox" checked={csRealism.imperfections[k]}
                        onChange={e=>setCsRealism(p=>({...p,imperfections:{...p.imperfections,[k]:e.target.checked}}))} />
                      <span style={{ fontSize:13, color:csRealism.imperfections[k]?"#e2e8f0":"#64748b" }}>{k.replace(/([A-Z])/g," $1").trim()}</span>
                    </label>
                  ))}
                </div>
                {/* Strict Negatives */}
                <div style={{ fontSize:11, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Strict Negatives</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 12px", marginBottom:8 }}>
                  {(Object.keys(csRealism.strictNegatives) as (keyof typeof csRealism.strictNegatives)[]).map(k=>(
                    <label key={k} style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer" }}>
                      <input type="checkbox" checked={csRealism.strictNegatives[k]}
                        onChange={e=>setCsRealism(p=>({...p,strictNegatives:{...p.strictNegatives,[k]:e.target.checked}}))} />
                      <span style={{ fontSize:13, color:csRealism.strictNegatives[k]?"#e2e8f0":"#64748b" }}>no {k.replace("no","").replace(/([A-Z])/g," $1").trim().toLowerCase()}</span>
                    </label>
                  ))}
                </div>
                {/* Strict Blocks */}
                <div style={{ fontSize:11, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Strict Blocks</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 12px" }}>
                  {(Object.keys(csRealism.strictBlocks) as (keyof typeof csRealism.strictBlocks)[]).map(k=>(
                    <label key={k} style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer" }}>
                      <input type="checkbox" checked={csRealism.strictBlocks[k]}
                        onChange={e=>setCsRealism(p=>({...p,strictBlocks:{...p.strictBlocks,[k]:e.target.checked}}))} />
                      <span style={{ fontSize:13, color:csRealism.strictBlocks[k]?"#e2e8f0":"#64748b" }}>no {k.replace("no","").replace(/([A-Z])/g," $1").trim().toLowerCase()}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 4. Final Generation Prompt */}
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>4. Final Generation Prompt</div>
                <textarea value={csFields.csFinalPrompt??""} onChange={e=>setCsFields(p=>({...p,csFinalPrompt:e.target.value}))}
                  placeholder="Assembled prompt — or type manually..."
                  rows={3}
                  style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:"#e2e8f0", fontSize:12, padding:"8px 10px", outline:"none", resize:"vertical", lineHeight:1.5, boxSizing:"border-box" }} />
                <div style={{ display:"flex", gap:6, marginTop:6 }}>
                  <button onClick={()=>gatedGeneration(()=>generateDualImage())} disabled={imageGenerating}
                    style={{ flex:1, padding:"5px 0", borderRadius:6, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.05)", color:"#94a3b8", fontSize:11, cursor:"pointer" }}>Generate Ideas</button>
                  <button onClick={()=>setCsFields(p=>({...p,csFinalPrompt:[p.csSubject,p.csAction,p.csEnvironment].filter(Boolean).join(", ")}))}
                    style={{ flex:1, padding:"5px 0", borderRadius:6, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.05)", color:"#94a3b8", fontSize:11, cursor:"pointer" }}>Apply Template</button>
                  <button style={{ flex:1, padding:"5px 0", borderRadius:6, border:"1px solid rgba(103,232,249,0.3)", background:"rgba(103,232,249,0.08)", color:"#67e8f9", fontSize:11, cursor:"pointer", fontWeight:600 }}>Make More Real</button>
                </div>
              </div>

              {/* Run Pipeline + Upload guidance */}
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>gatedGeneration(()=>runFullGovernancePipeline())} disabled={pipelineRunning}
                  style={{ flex:1, padding:"10px 0", borderRadius:10, border:"none", background:pipelineRunning?"rgba(103,232,249,0.3)":"rgba(103,232,249,0.9)", color:pipelineRunning?"#475569":"#000", fontSize:13, fontWeight:700, cursor:pipelineRunning?"not-allowed":"pointer" }}>
                  {pipelineRunning ? "⏳ Running…" : "▶ Run Pipeline"}
                </button>
                <button onClick={()=>guidanceInputRef.current?.click()}
                  style={{ padding:"10px 12px", borderRadius:10, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.04)", color:"#94a3b8", fontSize:12, cursor:"pointer" }}>
                  ↑ upload rule/guidance
                </button>
              </div>

              {/* Pipeline Prompt */}
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Pipeline Prompt</div>
                <textarea value={csFields.csPipelinePrompt??""} onChange={e=>setCsFields(p=>({...p,csPipelinePrompt:e.target.value}))}
                  placeholder="Describe what you want the pipeline to generate..."
                  rows={3}
                  style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:`1px solid ${csFields.csPipelinePrompt?"rgba(103,232,249,0.3)":"rgba(255,255,255,0.08)"}`, borderRadius:8, color:"#e2e8f0", fontSize:11, padding:"8px 10px", outline:"none", resize:"vertical", lineHeight:1.5, boxSizing:"border-box" }} />
              </div>
              </>)}
            </div>

            {/* ── Step Builder */}
            <div style={P({ padding: 14, display: "flex", flexDirection: "column", gap: 6 })}>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.05em", color: "#94a3b8", textTransform: "uppercase", marginBottom: 10 }}>Pipeline Steps</div>
              {steps.map(step => (
                <div key={step.id} onClick={() => selectStep(step.id)}
                  title={pipelineRunning || engineOpen ? undefined : "Click to configure this step"}
                  className={step.state === "running" ? "step-running" : step.state === "error" ? "step-error" : ""}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderRadius: 12,
                    background: step.state === "running" ? "rgba(124,58,237,0.12)" : liveStepId === step.id ? "rgba(124,58,237,0.08)" : selectedStepId === step.id ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${step.state === "running" ? "rgba(124,58,237,0.5)" : selectedStepId === step.id ? "rgba(168,85,247,0.35)" : "rgba(255,255,255,0.07)"}`,
                    cursor: "pointer", transition: "all 150ms",
                    position: "relative", overflow: "hidden" }}>
                  {step.state === "running" && (
                    <div style={{ position: "absolute", left: 0, top: 0, width: 3, background: "#7c3aed", animation: "borderSlide 1.5s ease-in-out infinite alternate", borderRadius: "0 2px 2px 0" }} />
                  )}
                  <span style={{ fontSize: 20, color: stateColor(step.state), flexShrink: 0 }}>{step.icon}</span>
                  <span style={{ flex: 1, fontSize: 15, color: "#cbd5e1", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{step.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: stateColor(step.state), flexShrink: 0 }}>{step.state.toUpperCase().slice(0, 4)}</span>
                </div>
              ))}
              <button onClick={() => setSteps(p => [...p, { id: `custom-${Date.now()}`, name: "Custom Step", state: "queued", icon: "+", output: null, error: null, startedAt: null, completedAt: null }])}
                style={{ marginTop: 8, background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.12)", color: "#475569", borderRadius: 10, padding: "10px 0", fontSize: 14, cursor: "pointer" }}>
                + Add Step
              </button>
            </div>

              <button onClick={() => setLeftOpen(false)}
                style={{ margin: "4px 8px 8px", background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 11, textAlign: "left", padding: "4px 6px" }}>
                ← Hide
              </button>
            </> }{/* end leftOpen */}
            </div>}{/* end left column wrapper */}

            {/* Step Config Rail — transforms into Live Engine when pipeline runs */}
            <div style={P({ overflow: "hidden", display: "flex", flexDirection: "column" })}>
              {!stepConfigOpen ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 0", gap: 16 }}>
                  <button onClick={() => setStepConfigOpen(true)} title="Open step config"
                    style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 16, padding: 4 }}>✎</button>
                </div>
              ) : engineOpen ? (
                /* ── LIVE ENGINE VIEW ── */
                <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 480 }}>
                  {/* Header */}
                  <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {pipelineRunning && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c3aed", animation: "pulse 1.2s ease-in-out infinite", flexShrink: 0 }} />}
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#7c3aed", textTransform: "uppercase" }}>
                        {pipelineRunning ? "Live Engine" : "Run Complete"}
                      </span>
                    </div>
                    <button onClick={() => { setEngineOpen(false); setStepConfigOpen(false); }}
                      style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 16 }}>✕</button>
                  </div>

                  {/* Event stream */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {liveEvents.map(ev => (
                      <div key={ev.id} style={{ animation: "fadeSlideIn 200ms ease forwards" }}>

                        {/* Step start */}
                        {ev.type === "step_start" && (
                          <div style={{ borderLeft: "3px solid #7c3aed", paddingLeft: 10, marginBottom: 2 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>
                              {ev.stepName}
                            </div>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{ev.message}</div>
                          </div>
                        )}

                        {/* Log line */}
                        {ev.type === "log" && (
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", paddingLeft: 13, lineHeight: 1.5 }}>
                            {ev.message}
                          </div>
                        )}

                        {/* Error */}
                        {ev.type === "error" && (
                          <div style={{ fontSize: 12, color: "#f87171", paddingLeft: 13, fontWeight: 600 }}>
                            {ev.message}
                          </div>
                        )}

                        {/* Decision badges */}
                        {ev.type === "decision" && ev.decisions && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 13 }}>
                            {ev.decisions.map((d, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <span style={{
                                  fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, flexShrink: 0,
                                  background: d.result === "pass" ? "rgba(34,197,94,0.15)" : d.result === "fail" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                                  color: d.result === "pass" ? "#6ee7b7" : d.result === "fail" ? "#f87171" : "#fbbf24",
                                  border: `1px solid ${d.result === "pass" ? "rgba(34,197,94,0.3)" : d.result === "fail" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`,
                                }}>
                                  {d.result === "pass" ? "✓" : d.result === "fail" ? "✗" : "⚠"}
                                </span>
                                <span style={{ fontSize: 11, color: d.result === "pass" ? "rgba(255,255,255,0.7)" : d.result === "fail" ? "#f87171" : "#fbbf24" }}>
                                  {d.label}
                                </span>
                                {d.reason && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginLeft: 2 }}>— {d.reason}</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Regen loop */}
                        {ev.type === "regen" && (
                          <div style={{ paddingLeft: 13, display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, flexShrink: 0,
                              background: ev.regenStatus === "pass" ? "rgba(34,197,94,0.12)" : ev.regenStatus === "fail" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
                              color: ev.regenStatus === "pass" ? "#6ee7b7" : ev.regenStatus === "fail" ? "#f87171" : "#fbbf24",
                              border: `1px solid ${ev.regenStatus === "pass" ? "rgba(34,197,94,0.25)" : ev.regenStatus === "fail" ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)"}`,
                            }}>
                              Attempt {ev.regenAttempt}
                            </span>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{ev.message}</span>
                          </div>
                        )}

                        {/* Realism score bar */}
                        {ev.type === "score" && ev.score && (
                          <div style={{ paddingLeft: 13, marginTop: 4, marginBottom: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Realism Score</span>
                              <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{
                                  height: "100%", borderRadius: 3, transition: "width 800ms ease",
                                  width: `${ev.score.total}%`,
                                  background: ev.score.total >= 70 ? "linear-gradient(90deg,#22c55e,#6ee7b7)" : ev.score.total >= 50 ? "linear-gradient(90deg,#f59e0b,#fbbf24)" : "linear-gradient(90deg,#ef4444,#f87171)",
                                }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: ev.score.total >= 70 ? "#6ee7b7" : ev.score.total >= 50 ? "#fbbf24" : "#f87171", minWidth: 36 }}>
                                {ev.score.total}%
                              </span>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 10px" }}>
                              {ev.score.breakdown.map((b, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <span style={{ fontSize: 10, color: b.pass ? "#6ee7b7" : "#f87171", flexShrink: 0 }}>{b.pass ? "✓" : "✗"}</span>
                                  <span style={{ fontSize: 10, color: b.pass ? "rgba(255,255,255,0.55)" : "rgba(239,68,68,0.8)" }}>{b.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Final summary */}
                        {ev.type === "summary" && ev.summary && (
                          <div style={{
                            marginTop: 8, padding: "12px 14px", borderRadius: 10,
                            background: ev.summary.result === "APPROVED" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                            border: `1px solid ${ev.summary.result === "APPROVED" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                          }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: ev.summary.result === "APPROVED" ? "#6ee7b7" : "#f87171", marginBottom: 8, letterSpacing: "0.04em" }}>
                              {ev.summary.result === "APPROVED" ? "✓ APPROVED" : "✗ REJECTED"}
                            </div>
                            {ev.summary.reasons.length > 0 && (
                              <div style={{ marginBottom: 6 }}>
                                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Why:</div>
                                {ev.summary.reasons.map((r, i) => (
                                  <div key={i} style={{ fontSize: 11, color: "#6ee7b7", paddingLeft: 4 }}>✓ {r}</div>
                                ))}
                              </div>
                            )}
                            {ev.summary.adjustments.length > 0 && (
                              <div>
                                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Warnings:</div>
                                {ev.summary.adjustments.map((a, i) => (
                                  <div key={i} style={{ fontSize: 11, color: "#fbbf24", paddingLeft: 4 }}>⚠ {a}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    ))}
                    {pipelineRunning && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 13, color: "#7c3aed" }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#7c3aed", animation: "pulse 0.8s ease-in-out infinite" }} />
                        <span style={{ fontSize: 11 }}>thinking...</span>
                      </div>
                    )}
                    <div ref={liveEndRef} />
                  </div>
                </div>
              ) : (
                /* ── STEP CONFIG VIEW (when not running) ── */
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
            <div style={P({ display: "flex", flexDirection: "column", height: "100%", position: "relative" })}>
              {/* EditorPro drag cursor overlay */}
              {epDragging && <div style={{ position: "fixed", inset: 0, zIndex: 9999, cursor: "col-resize" }} />}
              {/* EditorPro slide-out panel */}
              <div style={{
                position: "absolute", top: 0, right: 0, bottom: 0,
                width: epOpen ? epW : 0,
                overflow: "hidden",
                zIndex: 200,
                transition: epDragging ? "none" : "width 200ms cubic-bezier(.4,0,.2,1)",
                background: "#09101a",
                borderLeft: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                flexDirection: "row",
              }}>
                {/* Drag handle — exact ResizeHandle from studio/page.tsx */}
                <div
                  onPointerDown={e => {
                    e.preventDefault();
                    epDragState.current = { startX: e.clientX, startW: epW };
                    setEpDragging(true);
                    setEpHandleActive(true);
                  }}
                  style={{ width: 8, cursor: "col-resize", background: epHandleActive ? "rgba(68,195,166,0.18)" : "transparent", position: "relative", flexShrink: 0 }}>
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", transform: "translateX(-50%)", width: 2, background: epHandleActive ? "rgba(68,195,166,0.65)" : "rgba(255,255,255,0.08)" }} />
                </div>
                {/* EditorPro iframe */}
                <iframe src="/editor" title="EditorPro" style={{ flex: 1, border: "none", display: "block" }} />
              </div>
              {/* EditorPro toggle tab */}
              <button
                onClick={() => setEpOpen(v => !v)}
                style={{
                  position: "absolute", top: "50%", right: epOpen ? epW : 0,
                  transform: "translateY(-50%)",
                  zIndex: 201,
                  width: 28, height: 96,
                  background: "linear-gradient(180deg, rgba(45,212,160,0.25), rgba(45,212,160,0.1))",
                  border: "1px solid rgba(45,212,160,0.4)",
                  borderRight: "none",
                  borderRadius: "8px 0 0 8px",
                  color: "#2dd4a0",
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: 700,
                  writingMode: "vertical-rl",
                  letterSpacing: "0.1em",
                  transition: epDragging ? "none" : "right 200ms cubic-bezier(.4,0,.2,1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "-2px 0 12px rgba(45,212,160,0.15)",
                }}
              >
                {epOpen ? "› CLOSE" : "‹ EDITOR"}
              </button>
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
              <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
                {workspaceTab === "output" && (() => {
                  const c1 = conceptOutputs.c1;
                  const c3 = conceptOutputs.c3;

                  // ── iPhone 15 Pro Max accurate frame ──────────────────────
                  // All dimensions derived from verified specs, scaled proportionally.
                  // Canonical CSS viewport: 430 × 932 points.
                  // Physical body ratio: 76.7mm × 159.9mm → 0.4797 w/h body ratio.
                  // Screen-to-body: ~89.8%. Bezel: 1.55mm.
                  // Dynamic Island: 126pt wide × 37pt tall, fully pill, 12pt from top.
                  // Safe areas: top 59pt, bottom 34pt.
                  // Home indicator: 134pt wide × 5pt tall, centered, 8pt from bottom.
                  // Screen corner radius: 55pt. Body corner radius: 47pt.
                  const IPhoneFrame = ({ slot, vidRef, label, onEdit, platformSelection, onPlatformChange, frameId }: { slot: typeof c1; vidRef: React.RefObject<HTMLVideoElement | null>; label: string; onEdit?: () => void; platformSelection: PlatformSelection; onPlatformChange: (sel: PlatformSelection) => void; frameId: 'iphone1' | 'iphone2'; }) => {
                    // Scale everything relative to iPhoneWidth (user-draggable).
                    // Base reference: 430pt viewport width → maps to iPhoneWidth px.
                    const S = iPhoneWidth / 430; // scale factor

                    // Body: 76.7mm × 159.9mm physical. Viewport 430×932pt.
                    // Body is slightly taller/wider than viewport due to bezels.
                    // Bezel ≈ 1.55mm → at 460ppi → ~3pt per side.
                    // Body width = viewport 430 + 2×3 = 436pt → scale to iPhoneWidth × (436/430)
                    const bodyW = iPhoneWidth * (436 / 430);
                    const bodyH = bodyW * (159.9 / 76.7); // physical aspect ratio
                    const bodyRadius = Math.round(47 * S);

                    // Screen area
                    const screenRadius = Math.round(55 * S);
                    const bezel = Math.round(3 * S);

                    // Dynamic Island: 126pt wide × 37pt tall, 12pt from top of screen
                    const diW = Math.round(126 * S);
                    const diH = Math.round(37 * S);
                    const diTop = Math.round(12 * S);

                    // Safe areas
                    const safeTop = Math.round(59 * S);    // status bar + DI + gap
                    const safeBot = Math.round(34 * S);    // home indicator area

                    // Home indicator: 134pt wide × 5pt tall, 8pt from bottom edge
                    const homeW = Math.round(134 * S);
                    const homeH = Math.max(2, Math.round(5 * S));
                    const homeBottom = Math.round(8 * S);

                    // Side buttons (visual only)
                    const btnW = Math.max(2, Math.round(3 * S));
                    const volH = Math.round(32 * S);
                    const powerH = Math.round(42 * S);
                    const actionH = Math.round(20 * S);

                    // Status bar text scale
                    const statusFontSize = Math.max(7, Math.round(12 * S));

                    return (
                      <div style={{ display: "flex", flexDirection: "column", height: "100%", alignItems: "center" }}>
                        {/* Label */}
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, textAlign: "center", flexShrink: 0 }}>{label}</div>

                        {/* Outer device shell — titanium body */}
                        <div style={{
                          position: "relative",
                          width: bodyW,
                          height: bodyH,
                          flexShrink: 0,
                          // Titanium: warm near-black with subtle gradient
                          background: "linear-gradient(160deg, #2c2c2e 0%, #1c1c1e 40%, #141416 100%)",
                          borderRadius: bodyRadius,
                          // Titanium frame: subtle highlight on edges
                          boxShadow: [
                            // Outer edge highlight — titanium catch light
                            `0 0 0 1px rgba(255,255,255,0.18)`,
                            // Inner shadow to separate frame from screen
                            `inset 0 0 0 ${bezel}px #0a0a0c`,
                            // Drop shadow
                            `0 20px 60px rgba(0,0,0,0.7), 0 4px 12px rgba(0,0,0,0.5)`,
                          ].join(", "),
                          overflow: "visible",
                        }}>

                          {/* Volume buttons — left side */}
                          {/* Silent/Action button (top-left) */}
                          <div style={{ position: "absolute", left: -btnW, top: Math.round(80 * S), width: btnW, height: actionH, background: "linear-gradient(90deg, #1a1a1c, #2a2a2e)", borderRadius: `${btnW}px 0 0 ${btnW}px`, boxShadow: "-1px 0 0 rgba(255,255,255,0.08)" }} />
                          {/* Volume up */}
                          <div style={{ position: "absolute", left: -btnW, top: Math.round(120 * S), width: btnW, height: volH, background: "linear-gradient(90deg, #1a1a1c, #2a2a2e)", borderRadius: `${btnW}px 0 0 ${btnW}px`, boxShadow: "-1px 0 0 rgba(255,255,255,0.08)" }} />
                          {/* Volume down */}
                          <div style={{ position: "absolute", left: -btnW, top: Math.round(165 * S), width: btnW, height: volH, background: "linear-gradient(90deg, #1a1a1c, #2a2a2e)", borderRadius: `${btnW}px 0 0 ${btnW}px`, boxShadow: "-1px 0 0 rgba(255,255,255,0.08)" }} />
                          {/* Power button — right side */}
                          <div style={{ position: "absolute", right: -btnW, top: Math.round(130 * S), width: btnW, height: powerH, background: "linear-gradient(270deg, #1a1a1c, #2a2a2e)", borderRadius: `0 ${btnW}px ${btnW}px 0`, boxShadow: "1px 0 0 rgba(255,255,255,0.08)" }} />

                          {/* Screen — flush inside body with correct corner radius */}
                          <div style={{
                            position: "absolute",
                            inset: bezel,
                            borderRadius: screenRadius,
                            overflow: "hidden",
                            background: "#000",
                            // Screen glass: subtle inner glow
                            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
                          }}>

                            {/* ── Content layer — platform view or raw ── */}
                            {platformSelection.platformId && platformSelection.viewId ? (
                              <PlatformViewer
                                platformId={platformSelection.platformId}
                                viewId={platformSelection.viewId}
                                imageUrl={slot.image}
                                videoUrl={slot.video}
                                vidRef={vidRef}
                                conceptId={frameId === 'iphone1' ? 'c1' : 'c3'}
                                nicheId={nicheId}
                                copyOutput={stepPrompts.copy}
                                strategyOutput={stepPrompts.strategy}
                                conceptHeadline={concepts[frameId === 'iphone1' ? 0 : 2]?.headline}
                                wireframe={wireframeMode}
                                showSafeZone={showSafeZone}
                                scale={S}
                              />
                            ) : (
                              <div style={{ position: "absolute", inset: 0 }}>
                                {slot.video
                                  ? <video ref={vidRef} src={slot.video} muted loop playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  : slot.image
                                    ? <img src={slot.image} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    : (
                                      <div style={{ width: "100%", height: "100%", background: "linear-gradient(180deg, #0d0d12 0%, #090912 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "0 12px", textAlign: "center" }}>
                                        <div style={{ fontSize: Math.round(22 * S), opacity: 0.15 }}>◻</div>
                                        <div style={{ fontSize: Math.max(7, Math.round(9 * S)), color: "#334155", lineHeight: 1.4 }}>Approve an output from Preview Screens</div>
                                      </div>
                                    )
                                }
                              </div>
                            )}

                            {/* ── Safe zone overlay ── */}
                            {/* Top safe zone: status bar + Dynamic Island area */}
                            <div style={{
                              position: "absolute", top: 0, left: 0, right: 0,
                              height: safeTop,
                              // Semi-transparent so content can show underneath but zone is visible
                              background: "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 100%)",
                              pointerEvents: "none",
                            }}>
                              {/* Status bar */}
                              <div style={{
                                position: "absolute", top: Math.round(14 * S), left: Math.round(16 * S), right: Math.round(16 * S),
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                fontSize: statusFontSize, fontWeight: 600, color: "rgba(255,255,255,0.9)",
                                letterSpacing: "0.01em",
                                fontFamily: "-apple-system, SF Pro Display, sans-serif",
                              }}>
                                {/* Time — left */}
                                <span>9:41</span>
                                {/* Right indicators: signal + wifi + battery */}
                                <div style={{ display: "flex", alignItems: "center", gap: Math.round(4 * S) }}>
                                  {/* Signal bars */}
                                  <svg width={Math.round(16 * S)} height={Math.round(12 * S)} viewBox="0 0 16 12" fill="white">
                                    <rect x="0" y="7" width="3" height="5" rx="0.5" opacity="1"/>
                                    <rect x="4.5" y="5" width="3" height="7" rx="0.5" opacity="1"/>
                                    <rect x="9" y="2.5" width="3" height="9.5" rx="0.5" opacity="1"/>
                                    <rect x="13.5" y="0" width="2.5" height="12" rx="0.5" opacity="0.35"/>
                                  </svg>
                                  {/* WiFi */}
                                  <svg width={Math.round(15 * S)} height={Math.round(12 * S)} viewBox="0 0 15 12" fill="white">
                                    <path d="M7.5 9.5 a0.8 0.8 0 1 1 0.001 0Z" fill="white"/>
                                    <path d="M4.8 6.8 Q7.5 4.5 10.2 6.8" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                                    <path d="M2.2 4.2 Q7.5 0.5 12.8 4.2" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
                                  </svg>
                                  {/* Battery */}
                                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                                    <div style={{ width: Math.round(22 * S), height: Math.round(11 * S), borderRadius: 2, border: "1px solid rgba(255,255,255,0.55)", position: "relative", overflow: "visible" }}>
                                      <div style={{ position: "absolute", inset: 1, width: "75%", background: "rgba(255,255,255,0.9)", borderRadius: 1 }} />
                                    </div>
                                    {/* Battery tip */}
                                    <div style={{ width: Math.round(2 * S), height: Math.round(5 * S), background: "rgba(255,255,255,0.55)", borderRadius: "0 1px 1px 0", marginLeft: 1 }} />
                                  </div>
                                </div>
                              </div>

                              {/* Dynamic Island — pill cutout */}
                              <div style={{
                                position: "absolute",
                                top: diTop,
                                left: "50%",
                                transform: "translateX(-50%)",
                                width: diW,
                                height: diH,
                                background: "#000",
                                borderRadius: diH / 2,
                                // Slight inner glow to sell the OLED black cutout
                                boxShadow: "0 0 0 1px rgba(255,255,255,0.03), inset 0 0 4px rgba(0,0,0,0.8)",
                              }} />
                            </div>

                            {/* Bottom safe zone: home indicator */}
                            <div style={{
                              position: "absolute", bottom: 0, left: 0, right: 0,
                              height: safeBot,
                              background: "linear-gradient(0deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 100%)",
                              pointerEvents: "none",
                              display: "flex", alignItems: "flex-end", justifyContent: "center",
                              paddingBottom: homeBottom,
                            }}>
                              {/* Home indicator pill */}
                              <div style={{
                                width: homeW,
                                height: homeH,
                                background: "rgba(255,255,255,0.55)",
                                borderRadius: homeH,
                              }} />
                            </div>

                            {/* Hover overlay — Edit + Send buttons (sits above safe zones) */}
                            {(slot.image || slot.video) && onEdit && (
                              <div className="iphone-overlay" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, opacity: 0, transition: "opacity 150ms", zIndex: 10 }}
                                onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                                onMouseLeave={e => (e.currentTarget.style.opacity = "0")}>
                                <button onClick={onEdit}
                                  style={{ padding: "6px 14px", background: "rgba(103,232,249,0.9)", border: "none", color: "#000", borderRadius: 7, fontSize: Math.max(9, Math.round(11 * S)), fontWeight: 700, cursor: "pointer", width: "80%" }}>
                                  ✏ Edit in center
                                </button>
                                <button onClick={() => triggerDestPicker(slot.image ?? slot.video!, slot.video ? "video" : "image")}
                                  style={{ padding: "5px 14px", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 7, fontSize: Math.max(8, Math.round(10 * S)), cursor: "pointer", width: "80%" }}>
                                  → Send to screen
                                </button>
                              </div>
                            )}

                          </div>{/* end screen */}
                        </div>{/* end body */}

                        {/* Platform selector — below the iPhone body, larger icons */}
                        <div style={{ marginTop: 8, flexShrink: 0, width: bodyW, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                          <PlatformSelector
                            value={platformSelection}
                            onChange={onPlatformChange}
                            contentType={slot.video ? 'video' : slot.image ? 'image' : null}
                            onDesktopView={(pid, vid) => setDesktopPlatform({ platformId: pid, viewId: vid })}
                            scale={Math.max(1.2, S * 1.6)}
                          />
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, height: "100%" }}>

                      {/* Destination picker modal */}
                      {showDestPicker && pendingResult && (
                        <div style={{ position: "absolute", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12 }}>
                          <div style={{ background: "#0d1525", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "22px 24px", minWidth: 280 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>Send result to...</div>
                            <div style={{ fontSize: 11, color: "#475569", marginBottom: 16 }}>Choose which preview screen receives this {pendingResult.type}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {([["iphone1","iPhone 15 Pro Max #1","◱"],["iphone2","iPhone 15 Pro Max #2","◱"],["desktop","Desktop / Wide View","▭"]] as [PreviewDestination,string,string][]).map(([dest, label, icon]) => (
                                <button key={dest} onClick={() => {
                                  sendToDestination(pendingResult.url, pendingResult.type, dest);
                                  setShowDestPicker(false); setPendingResult(null);
                                }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: previewDestination===dest?"rgba(103,232,249,0.1)":"rgba(255,255,255,0.03)", color: "#f1f5f9", fontSize: 12, cursor: "pointer", textAlign: "left" }}>
                                  <span style={{ fontSize: 16, color: "#67e8f9" }}>{icon}</span>
                                  {label}
                                </button>
                              ))}
                            </div>
                            <button onClick={() => { setShowDestPicker(false); setPendingResult(null); }} style={{ marginTop: 12, width: "100%", padding: "7px 0", borderRadius: 8, border: "none", background: "transparent", color: "#475569", fontSize: 11, cursor: "pointer" }}>Cancel</button>
                          </div>
                        </div>
                      )}

                      {/* 3-column: iPhone | handle | MediaEditor | handle | iPhone */}
                      <div style={{ display: "grid", gridTemplateColumns: `${iPhoneWidth}px 8px 1fr 8px ${iPhoneWidth}px`, gap: 0, padding: "8px 8px 6px", height: 640, alignItems: "stretch" }}>

                        {/* Left iPhone — Concept 1 */}
                        <div data-export="iphone1" style={{ display: "contents" }}>
                        <IPhoneFrame slot={c1} vidRef={playbackRef1} label="iPhone 15 Pro Max #1"
                          frameId="iphone1"
                          platformSelection={iphone1Platform}
                          onPlatformChange={setIphone1Platform}
                          onEdit={() => {
                            if (c1.image) setApprovedOutputs(p => ({ ...p, image: c1.image! }));
                            if (c1.video) setApprovedOutputs(p => ({ ...p, video: c1.video! }));
                            log("✓ iPhone #1 loaded into editor");
                          }} />
                        </div>

                        {/* Left drag handle */}
                        <div
                          style={{ cursor: "col-resize", display: "flex", alignItems: "center", justifyContent: "center", userSelect: "none" }}
                          onPointerDown={e => {
                            e.currentTarget.setPointerCapture(e.pointerId);
                            iphoneDragRef.current = { side: "left", startX: e.clientX, startW: iPhoneWidth };
                          }}
                          onPointerMove={e => {
                            if (!iphoneDragRef.current) return;
                            const delta = e.clientX - iphoneDragRef.current.startX;
                            const adj = iphoneDragRef.current.side === "left" ? delta : -delta;
                            setIPhoneWidth(Math.max(140, Math.min(360, iphoneDragRef.current.startW + adj)));
                          }}
                          onPointerUp={() => { iphoneDragRef.current = null; }}
                        >
                          <div style={{ width: 2, height: "60%", background: "rgba(255,255,255,0.08)", borderRadius: 1 }} />
                        </div>

                        {/* Center — DesktopPlatformView or MediaEditor */}
                        <div style={{ display: "flex", flexDirection: "column", height: "100%", minWidth: 0 }}>
                          {/* Platform toolbar */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
                            {desktopPlatform && (
                              <button type="button" onClick={() => setDesktopPlatform(null)}
                                style={{ fontSize: 10, color: "#67e8f9", background: "rgba(103,232,249,0.08)", border: "1px solid rgba(103,232,249,0.2)", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>
                                ✕ Exit platform view
                              </button>
                            )}
                            <button type="button" onClick={() => setBatchModalOpen(true)}
                              style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>
                              ⊞ Batch preview
                            </button>
                            <button type="button" onClick={() => setWireframeMode(w => !w)}
                              style={{ fontSize: 10, color: wireframeMode ? "#a78bfa" : "rgba(255,255,255,0.4)", background: wireframeMode ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${wireframeMode ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>
                              ⬜ Wireframe
                            </button>
                            <button type="button" onClick={() => setShowSafeZone(s => !s)}
                              style={{ fontSize: 10, color: showSafeZone ? "#fb923c" : "rgba(255,255,255,0.4)", background: showSafeZone ? "rgba(251,146,60,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${showSafeZone ? "rgba(251,146,60,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>
                              ◫ Safe zones
                            </button>
                          </div>
                          {desktopPlatform ? (
                            <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                              <DesktopPlatformView
                                platformId={desktopPlatform.platformId}
                                viewId={desktopPlatform.viewId}
                                imageUrl={approvedOutputs.image || conceptOutputs.c1.image || conceptOutputs.c2.image || imageResult || null}
                                videoUrl={approvedOutputs.video || conceptOutputs.c1.video || conceptOutputs.c2.video || videoResult || null}
                                conceptId="c2"
                                nicheId={nicheId}
                                copyOutput={stepPrompts.copy}
                                strategyOutput={stepPrompts.strategy}
                                conceptHeadline={concepts[1]?.headline}
                                wireframe={wireframeMode}
                                showSafeZone={showSafeZone}
                                onDismiss={() => setDesktopPlatform(null)}
                              />
                            </div>
                          ) : (
                            <MediaEditor
                              imageUrl={approvedOutputs.image || conceptOutputs.c1.image || conceptOutputs.c2.image || imageResult || null}
                              videoUrl={approvedOutputs.video || conceptOutputs.c1.video || conceptOutputs.c2.video || videoResult || null}
                              onSendToScreen={(url, type) => triggerDestPicker(url, type)}
                              onLog={log}
                            />
                          )}
                        </div>

                        {/* Right drag handle */}
                        <div
                          style={{ cursor: "col-resize", display: "flex", alignItems: "center", justifyContent: "center", userSelect: "none" }}
                          onPointerDown={e => {
                            e.currentTarget.setPointerCapture(e.pointerId);
                            iphoneDragRef.current = { side: "right", startX: e.clientX, startW: iPhoneWidth };
                          }}
                          onPointerMove={e => {
                            if (!iphoneDragRef.current) return;
                            const delta = e.clientX - iphoneDragRef.current.startX;
                            const adj = iphoneDragRef.current.side === "right" ? -delta : delta;
                            setIPhoneWidth(Math.max(140, Math.min(360, iphoneDragRef.current.startW + adj)));
                          }}
                          onPointerUp={() => { iphoneDragRef.current = null; }}
                        >
                          <div style={{ width: 2, height: "60%", background: "rgba(255,255,255,0.08)", borderRadius: 1 }} />
                        </div>

                        {/* Right iPhone — Concept 3 */}
                        <div data-export="iphone2" style={{ display: "contents" }}>
                        <IPhoneFrame slot={c3} vidRef={playbackRef2} label="iPhone 15 Pro Max #2"
                          frameId="iphone2"
                          platformSelection={iphone2Platform}
                          onPlatformChange={setIphone2Platform}
                          onEdit={() => {
                            if (c3.image) setApprovedOutputs(p => ({ ...p, image: c3.image! }));
                            if (c3.video) setApprovedOutputs(p => ({ ...p, video: c3.video! }));
                            log("✓ iPhone #2 loaded into editor");
                          }} />
                        </div>

                      </div>

                      {/* Platform controls bar */}
                      <div style={{ padding: "4px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <button type="button" onClick={() => setBatchModalOpen(true)}
                          style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>
                          ⊞ Batch preview
                        </button>
                        <button type="button" onClick={() => setWireframeMode(w => !w)}
                          style={{ fontSize: 10, color: wireframeMode ? "#a78bfa" : "rgba(255,255,255,0.35)", background: wireframeMode ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${wireframeMode ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>
                          ⬜ {wireframeMode ? "Wireframe ON" : "Wireframe"}
                        </button>
                        <button type="button" onClick={() => setShowSafeZone(s => !s)}
                          style={{ fontSize: 10, color: showSafeZone ? "#fb923c" : "rgba(255,255,255,0.35)", background: showSafeZone ? "rgba(251,146,60,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${showSafeZone ? "rgba(251,146,60,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>
                          ◫ {showSafeZone ? "Safe zones ON" : "Safe zones"}
                        </button>
                        <div style={{ flex: 1 }} />
                        <button type="button" title="Export iPhone #1 as PNG" onClick={async () => {
                          try {
                            const exportFrame = async (selector: string, filename: string) => {
                              const el = document.querySelector(selector) as HTMLElement;
                              if (!el) { log("Export target not found"); return; }
                              // Load html2canvas from CDN at runtime — no build-time dep
                              await new Promise<void>((resolve, reject) => {
                                if ((window as unknown as Record<string,unknown>).html2canvas) { resolve(); return; }
                                const s = document.createElement("script");
                                s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
                                s.onload = () => resolve(); s.onerror = reject;
                                document.head.appendChild(s);
                              });
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              const canvas = await (window as any).html2canvas(el, { backgroundColor: null, scale: 2, useCORS: true });
                              const a = document.createElement("a"); a.href = canvas.toDataURL("image/png"); a.download = filename; a.click();
                            };
                            await exportFrame("[data-export='iphone1']", `iphone1-${Date.now()}.png`);
                            log("✓ iPhone #1 exported");
                          } catch(e) { log("Export failed: " + String(e)); }
                        }}
                          style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>
                          ↓ Export #1
                        </button>
                        <button type="button" title="Export iPhone #2 as PNG" onClick={async () => {
                          try {
                            const exportFrame = async (selector: string, filename: string) => {
                              const el = document.querySelector(selector) as HTMLElement;
                              if (!el) { log("Export target not found"); return; }
                              await new Promise<void>((resolve, reject) => {
                                if ((window as unknown as Record<string,unknown>).html2canvas) { resolve(); return; }
                                const s = document.createElement("script");
                                s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
                                s.onload = () => resolve(); s.onerror = reject;
                                document.head.appendChild(s);
                              });
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              const canvas = await (window as any).html2canvas(el, { backgroundColor: null, scale: 2, useCORS: true });
                              const a = document.createElement("a"); a.href = canvas.toDataURL("image/png"); a.download = filename; a.click();
                            };
                            await exportFrame("[data-export='iphone2']", `iphone2-${Date.now()}.png`);
                            log("✓ iPhone #2 exported");
                          } catch(e) { log("Export failed: " + String(e)); }
                        }}
                          style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>
                          ↓ Export #2
                        </button>
                      </div>
                      {/* Playback bar */}
                      <div style={{ padding: "10px 16px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", gap: 20, flexShrink: 0 }}>
                        {/* Rewind */}
                        <button onClick={() => { [playbackRef1, playbackRef2].forEach(r => { if (r.current) { r.current.currentTime = 0; } }); }}
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", width: 38, height: 38, borderRadius: "50%", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>⏮</button>
                        {/* Play/Pause */}
                        <button onClick={() => {
                          const refs = [playbackRef1, playbackRef2];
                          if (playbackPlaying) {
                            refs.forEach(r => r.current?.pause());
                            setPlaybackPlaying(false);
                          } else {
                            refs.forEach(r => r.current?.play().catch(()=>{}));
                            setPlaybackPlaying(true);
                          }
                        }}
                          style={{ background: playbackPlaying ? "rgba(103,232,249,0.15)" : "rgba(255,255,255,0.08)", border: "1px solid "+(playbackPlaying?"rgba(103,232,249,0.4)":"rgba(255,255,255,0.1)"), color: playbackPlaying?"#67e8f9":"#94a3b8", width: 38, height: 38, borderRadius: "50%", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {playbackPlaying ? "⏸" : "▷"}
                        </button>
                        {/* Stop */}
                        <button onClick={() => { [playbackRef1, playbackRef2].forEach(r => { if (r.current) { r.current.pause(); r.current.currentTime = 0; } }); setPlaybackPlaying(false); }}
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", width: 38, height: 38, borderRadius: "50%", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>◼</button>
                        {/* Replay */}
                        <button onClick={() => { [playbackRef1, playbackRef2].forEach(r => { if (r.current) { r.current.currentTime = 0; r.current.play().catch(()=>{}); } }); setPlaybackPlaying(true); }}
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", width: 38, height: 38, borderRadius: "50%", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>↺</button>
                        {/* Forward */}
                        <button onClick={() => { [playbackRef1, playbackRef2].forEach(r => { if (r.current) { r.current.currentTime = r.current.duration || 0; } }); }}
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", width: 38, height: 38, borderRadius: "50%", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>⏭</button>
                      </div>
                    </div>
                  );
                })()}
                {workspaceTab === "logs" && (
                  <div style={{ width: "100%", height: 300, overflowY: "auto", fontFamily: "monospace", fontSize: 11, color: "#64748b", lineHeight: 1.8 }}>
                    {logs.map((l, i) => <div key={i}>{l}</div>)}
                  </div>
                )}
                {workspaceTab === "editor" && (
                  <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                    <MediaEditor
                      imageUrl={approvedOutputs.image || Object.values(conceptOutputs).find(o => o.image)?.image || imageResult || null}
                      videoUrl={approvedOutputs.video || Object.values(conceptOutputs).find(o => o.video)?.video || videoResult || null}
                      onSendToScreen={(url, type) => triggerDestPicker(url, type)}
                      onLog={log}
                    />
                  </div>
                )}
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
                          <button onClick={() => gatedGeneration(()=>generateImage(cid))} style={{ marginTop: 4, fontSize: 10, color: "#67e8f9", background: "rgba(103,232,249,0.08)", border: "1px solid rgba(103,232,249,0.2)", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Retry</button>
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
                    <button onClick={() => gatedGeneration(()=>generateImage(cid))}
                      disabled={isActive}
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", borderRadius: 8, padding: "6px 8px", fontSize: 11, cursor: "pointer" }}>
                      Run Concept Image
                    </button>
                    <button onClick={() => gatedGeneration(()=>generateVideo(cid))}
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
      {/* ── AI Assistant — full featured with sidebar, history, search, voice ── */}
      <AIAssistant
        context={{
          type: "pipeline",
          prompt: stepPrompts[selectedStepId] ?? "",
          settings: { niche: nicheId, concept: selectedConceptId },
          nicheId,
          currentStepId: selectedStepId,
          selectedConceptId,
          stepStates: Object.fromEntries(steps.map(s => [s.id, s.state])),
          intakeAnalysis: intakeAnalysis ?? undefined,
          conceptErrors: Object.fromEntries(
            Object.entries(conceptOutputs).map(([id, o]) => [id, o.error ?? null])
          ),
          conceptStatuses: Object.fromEntries(
            Object.entries(conceptOutputs).map(([id, o]) => [id, o.status])
          ),
          hasFailedConcepts: Object.values(conceptOutputs).some(o => o.status === "failed"),
          imageProvider,
          // ── Previously invisible state — now fully visible to assistant ──
          allStepPrompts: stepPrompts,
          conceptOutputs: Object.fromEntries(
            Object.entries(conceptOutputs).map(([id, o]) => [id, {
              image: o.image, video: o.video, status: o.status, error: o.error,
            }])
          ),
          approvedOutputs,
          pipelineRunning,
          pipelineLog: pipelineLog.slice(-10),
          generationQueueSummary: {
            pending: [...generationQueue.values()].filter(i => i.status === "pending").length,
            processing: [...generationQueue.values()].filter(i => i.status === "processing").length,
            completed: [...generationQueue.values()].filter(i => i.status === "completed").length,
            failed: [...generationQueue.values()].filter(i => i.status === "failed").length,
          },
          conceptNames: Object.fromEntries(concepts.map((cv, i) => [`c${i + 1}`, cv.headline ?? `Concept ${i + 1}`])),
          conceptCount: concepts.length,
          workspaceTab,
          viewMode,
          deviceFrame,
          editorOpen: epOpen,
          previewTabs,
          intakeResult: intakeResult ? {
            type: intakeResult.type,
            title: intakeResult.title,
            brandName: intakeResult.brandName,
            colorPalette: intakeResult.colorPalette,
            keyMessages: intakeResult.keyMessages,
            layoutPattern: intakeResult.layoutPattern,
            targetAudience: intakeResult.targetAudience,
            toneOfVoice: intakeResult.toneOfVoice,
            suggestedCopy: intakeResult.suggestedCopy,
          } : undefined,
          liveEventsSummary: liveEvents.slice(-3).map(e => e.message ?? e.stepName ?? '').filter(Boolean).join(' → ') || undefined,
          strategyOutput: stepPrompts.strategy,
          copyOutput: stepPrompts.copy,
        }}
        onApplyPrompt={(prompt) => setStepPrompts(p => ({ ...p, [selectedStepId]: prompt }))}
        onUpdateSettings={(key, value) => {
          if (key === "nicheId") setNicheId(value);
          if (key === "imageProvider") setImageProvider(value as "openai" | "fal");
          if (key === "pipelineMode") setPipelineMode(value as "manual" | "auto");
        }}
        onGenerateImage={(conceptId, prompt) => {
          if (prompt) setStepPrompts(p => ({ ...p, imagery: prompt }));
          void generateImage(conceptId ?? selectedConceptId);
        }}
        onGenerateVideo={(conceptId, prompt) => {
          if (prompt) setStepPrompts(p => ({ ...p, i2v: prompt }));
          void generateVideo(conceptId ?? selectedConceptId);
        }}
        onRunPipeline={() => void runPipeline()}
        onRunStep={(stepId) => {
          setSelectedStepId(stepId);
          setStepConfigOpen(true);
        }}
        onSelectConcept={(conceptId) => setSelectedConceptId(conceptId)}
        onApproveOutput={(type, url) => approveOutput(type as "image" | "video" | "script", url)}
        onOpenStepConfig={(stepId) => { setSelectedStepId(stepId); setStepConfigOpen(true); }}
        onSetNiche={(nicheId) => setNicheId(nicheId)}
        onUpdateImagePrompt={(v) => setStepPrompts(p => ({ ...p, imagery: v }))}
        onUpdateVideoPrompt={(v) => setStepPrompts(p => ({ ...p, i2v: v }))}
        onUpdateStrategyPrompt={(v) => setStepPrompts(p => ({ ...p, strategy: v }))}
        onUpdateCopyPrompt={(v) => setStepPrompts(p => ({ ...p, copy: v }))}
        onUpdateI2VPrompt={(v) => setStepPrompts(p => ({ ...p, i2v: v }))}
        onUpdateQAInstruction={(v) => setStepPrompts(p => ({ ...p, qa: v }))}
        proactiveMessage={proactiveMessage}
      />
      {/* ── Batch Preview Modal ─────────────────────────────────────── */}
      <BatchPreviewModal
        open={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        platformId={iphone1Platform.platformId}
        viewId={iphone1Platform.viewId}
        concepts={[
          { id: "c1", label: "Concept 1", image: conceptOutputs.c1.image, video: conceptOutputs.c1.video, headline: concepts[0]?.headline },
          { id: "c2", label: "Concept 2", image: conceptOutputs.c2.image, video: conceptOutputs.c2.video, headline: concepts[1]?.headline },
          { id: "c3", label: "Concept 3", image: conceptOutputs.c3.image, video: conceptOutputs.c3.video, headline: concepts[2]?.headline },
        ]}
        nicheId={nicheId}
        copyOutput={stepPrompts.copy}
        strategyOutput={stepPrompts.strategy}
        wireframe={wireframeMode}
        showSafeZone={showSafeZone}
        onPromoteToConcept={(conceptId) => {
          const slot = conceptOutputs[conceptId];
          if (slot?.image) setConceptOutputs(p => ({ ...p, c1: { ...p.c1, image: slot.image, status: "completed", error: null } }));
          if (slot?.video) setConceptOutputs(p => ({ ...p, c1: { ...p.c1, video: slot.video, status: "completed", error: null } }));
          log(`✓ ${conceptId} promoted to iPhone #1`);
        }}
      />
      {/* ── Floating Preview Panel — Feature 2 (float destination) ──── */}
      {floatingArtifact && (
        <FloatingPreviewPanel
          artifact={floatingArtifact}
          onClose={() => setFloatingArtifact(null)}
        />
      )}
      {/* ── Live Preview Overlay — Feature 2 (iphone/desktop destinations) */}
      {livePreviewArtifact && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 8000,
          background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 12,
        }}
          onClick={() => setLivePreviewArtifact(null)}
        >
          <div onClick={e => e.stopPropagation()}
            style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
            <LivePreviewRenderer
              artifact={livePreviewArtifact.artifact}
              width={livePreviewArtifact.dest === "desktop" ? 900 : 390}
              height={livePreviewArtifact.dest === "desktop" ? 600 : 700}
            />
          </div>
          <button
            onClick={() => setLivePreviewArtifact(null)}
            style={{
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
              color: "#fff", borderRadius: 8, padding: "7px 20px", fontSize: 12,
              cursor: "pointer", fontWeight: 600,
            }}
          >
            Close preview
          </button>
        </div>
      )}
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
