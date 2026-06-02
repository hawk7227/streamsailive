"use client";

import { useEffect, useMemo, useState } from "react";
import "./opus-locked-frame.css";
import "./opus-layout-unclipped.css";

const BOARD_WIDTH = 1920;
const BOARD_HEIGHT = 900;
const DEFAULT_PROJECT_ID = "fb7bf446-78c9-4905-80bc-32a19d0f9803";

const createTypes = [
  { id: "text-to-image", title: "Text to Image", icon: "🖼️", kind: "image", provider: "openai", accent: "blue", duration: "N/A", ratio: "1:1" },
  { id: "image-to-video", title: "Image to Video", icon: "🎞️", kind: "image-to-video", provider: "fal", accent: "purple", duration: "8s", ratio: "16:9" },
  { id: "text-to-video", title: "Text to Video", icon: "🎬", kind: "text-to-video", provider: "fal", accent: "pink", duration: "8s", ratio: "16:9" },
  { id: "voice-captions", title: "Voice & Captions", icon: "🎙️", kind: "voice", provider: "elevenlabs", accent: "teal", duration: "N/A", ratio: "N/A" },
  { id: "snap-pick-click", title: "Snap Pic Click", icon: "📸", kind: "snap-pick-click", provider: "fal", accent: "orange", duration: "6s", ratio: "9:16" },
  { id: "motion-graphics", title: "Motion Graphics", icon: "🔷", kind: "motion", provider: "fal", accent: "blue", duration: "6s", ratio: "16:9" },
  { id: "ai-writers", title: "AI Writers", icon: "📄", kind: "script", provider: "openai", accent: "violet", duration: "N/A", ratio: "N/A" },
  { id: "idea-launch", title: "Idea to Launch", icon: "🚀", kind: "launch", provider: "openai", accent: "yellow", duration: "N/A", ratio: "16:9" },
];

const referencePreview =
  "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1600&q=90";

const referenceFrames = [
  "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=360&q=85",
];

const navItems = ["Home", "Projects", "Generate", "Assets", "Analytics", "Settings"];

function initialFields() {
  return {
    mainPrompt:
      "A vast futuristic city at night, neon lights reflecting on wet streets, flying vehicles crossing between towering skyscrapers, light rain, cinematic establishing shot, ultra realistic, dramatic atmosphere.",
    scene:
      "Sprawling cyberpunk metropolis in the rain. Deep perspective, layered skyline, volumetric haze, wet reflective streets.",
    subject: "Lone engineer looking across the city toward a glowing AI tower.",
    environment: "Urban · night · rainy · wet streets · neon signs · distant flying traffic.",
    emotionalIntent: "Awe, mystery, isolation, controlled cinematic tension.",
    shotType: "Extreme wide shot",
    cameraPosition: "High angle",
    cameraMovement: "Slow push in",
    lens: "18mm wide",
    depthOfField: "Deep focus",
    composition: "Rule of thirds",
    primaryLighting: "Neon city lights",
    accentLighting: "Billboards and holograms",
    rimLight: "Cool blue rim",
    atmosphere: "Wet surfaces and reflections",
    characterMotion: "Subtle posture shift and wind movement",
    environmentMotion: "Flying traffic, rain, drifting haze",
    motionQuality: "Cinematic · smooth",
    visualStyle: "Cinematic realism",
    filmReference: "Blade Runner 2049",
    productionDesign: "Cyberpunk · high tech",
    humanRealism: "Photorealistic",
    mood: "Moody, epic, mysterious",
    negativePrompt: "low quality, blurry, noisy, overexposed, underexposed, poor anatomy, deformed, ugly, text, watermark, logo, extra limbs, duplicate, cartoon, anime, CGI",
    duration: "6",
    aspectRatio: "16:9",
    frameRate: "24 fps",
    qualityGoal: "High (Best Quality)",
    voiceScript: "Optional cinematic narration.",
    voiceTone: "Calm, restrained, dramatic.",
    captions: "Clean lower-third captions if needed.",
    projectId: DEFAULT_PROJECT_ID,
    seed: "",
  };
}

function findOutputUrl(data) {
  if (!data || typeof data !== "object") return "";
  const candidates = [
    data.outputUrl,
    data.videoUrl,
    data.assetUrl,
    data.url,
    data.result?.outputUrl,
    data.result?.videoUrl,
    data.result?.assetUrl,
    data.result?.url,
    data.job?.outputUrl,
    data.job?.videoUrl,
    data.generation?.outputUrl,
    data.generation?.videoUrl,
  ].filter(Boolean);
  return candidates.length ? String(candidates[0]) : "";
}

function findAnalysisId(data) {
  if (!data || typeof data !== "object") return "";
  return String(
    data.analysisId ||
      data.analysis?.id ||
      data.result?.analysisId ||
      data.result?.analysis?.id ||
      data.editorProject?.analysis_id ||
      "",
  );
}

function readable(data) {
  if (!data) return "";
  if (typeof data === "string") return data;
  const candidates = [
    data.summary,
    data.message,
    data.status,
    data.error,
    data.result?.summary,
    data.result?.message,
    data.result?.status,
    data.result?.error,
    data.job?.status,
  ].filter(Boolean);
  if (candidates.length) return String(candidates[0]);
  try {
    return JSON.stringify(data).slice(0, 600);
  } catch {
    return "Response returned without readable text.";
  }
}

function useStageFit() {
  const [fit, setFit] = useState({ scale: 1, left: 0, top: 0 });

  useEffect(() => {
    function update() {
      const scale = Math.min(window.innerWidth / BOARD_WIDTH, window.innerHeight / BOARD_HEIGHT);
      setFit({
        scale,
        left: Math.max(0, (window.innerWidth - BOARD_WIDTH * scale) / 2),
        top: Math.max(0, (window.innerHeight - BOARD_HEIGHT * scale) / 2),
      });
    }

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return fit;
}

export default function OpusLockedFrame() {
  const fit = useStageFit();
  const [activeTypeId, setActiveTypeId] = useState("image-to-video");
  const activeType = createTypes.find((item) => item.id === activeTypeId) || createTypes[1];
  const [mode, setMode] = useState("advanced");
  const [stage, setStage] = useState("generate");
  const [fields, setFields] = useState(initialFields);
  const [provider, setProvider] = useState(activeType.provider);
  const [status, setStatus] = useState("Ready to generate");
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobResult, setJobResult] = useState(null);
  const [outputUrl, setOutputUrl] = useState("");
  const [analysisId, setAnalysisId] = useState("");
  const [helperOpen, setHelperOpen] = useState(false);
  const [helperInput, setHelperInput] = useState("");
  const [helperBusy, setHelperBusy] = useState(false);
  const [helperMessages, setHelperMessages] = useState([
    { role: "assistant", text: "I can proof prompts, analyze references, and help choose the best generation route before you spend credits." },
  ]);
  const [sourceUrl, setSourceUrl] = useState("");

  const boardStyle = useMemo(
    () => ({ width: BOARD_WIDTH, height: BOARD_HEIGHT, transform: `translate3d(${fit.left}px, ${fit.top}px, 0) scale(${fit.scale})` }),
    [fit],
  );

  useEffect(() => {
    setProvider(activeType.provider);
    setFields((current) => ({ ...current, duration: activeType.duration === "N/A" ? current.duration : activeType.duration.replace("s", ""), aspectRatio: activeType.ratio }));
    setStatus(`${activeType.title} selected`);
  }, [activeType.id]);

  function setField(key, value) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function buildPrompt() {
    return [
      fields.mainPrompt,
      `Scene: ${fields.scene}`,
      `Subject: ${fields.subject}`,
      `Environment: ${fields.environment}`,
      `Emotional intent: ${fields.emotionalIntent}`,
      `Camera: ${fields.shotType}, ${fields.cameraPosition}, ${fields.cameraMovement}, ${fields.lens}, ${fields.depthOfField}, ${fields.composition}.`,
      `Lighting: ${fields.primaryLighting}, ${fields.accentLighting}, ${fields.rimLight}, ${fields.atmosphere}.`,
      `Motion: ${fields.characterMotion}. ${fields.environmentMotion}. ${fields.motionQuality}.`,
      `Style: ${fields.visualStyle}, ${fields.filmReference}, ${fields.productionDesign}, ${fields.humanRealism}.`,
      `Mood: ${fields.mood}.`,
      `Restrictions: ${fields.negativePrompt}.`,
      `Output: ${fields.duration}s, ${fields.aspectRatio}, ${fields.frameRate}, ${fields.qualityGoal}.`,
    ].join("\n\n");
  }

  async function generateNow() {
    const prompt = buildPrompt();
    setIsGenerating(true);
    setStatus("Submitting generation job…");

    try {
      const response = await fetch("/api/admingeneration/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: activeType.kind,
          provider,
          projectId: fields.projectId,
          prompt,
          aspectRatio: fields.aspectRatio === "N/A" ? undefined : fields.aspectRatio,
          duration: fields.duration === "N/A" ? undefined : `${fields.duration}s`,
          metadata: {
            source: "compact-movie-production-workspace",
            createType: activeType.id,
            mode,
            fields,
          },
        }),
      });

      const data = await response.json().catch(() => null);
      const nextOutput = findOutputUrl(data);
      const nextAnalysisId = findAnalysisId(data);
      setJobResult(data);
      setOutputUrl(nextOutput);
      setAnalysisId(nextAnalysisId);
      setStage("result");
      setStatus(response.ok ? (nextOutput ? "Generated Video Ready" : "Generation request saved / awaiting real output") : "Generation blocked/error");
      addHelper(response.ok ? "assistant" : "system", `Generation result: ${readable(data) || (nextOutput ? "Output URL received." : "No real output URL returned yet.")}`);
    } catch (error) {
      setStatus("Generation failed");
      addHelper("system", `Generation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsGenerating(false);
    }
  }

  function addHelper(role, text) {
    setHelperMessages((current) => [...current, { role, text }].slice(-18));
  }

  async function askHelper(textOverride) {
    const message = String(textOverride || helperInput).trim();
    if (!message || helperBusy) return;
    setHelperInput("");
    addHelper("user", message);
    setHelperBusy(true);

    try {
      const response = await fetch("/api/admingeneration/helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, messages: helperMessages, context: { activeType, provider, fields, stage, status, jobResult } }),
      });
      const data = await response.json().catch(() => null);
      addHelper(response.ok ? "assistant" : "system", readable(data) || `Helper returned ${response.status}`);
    } catch (error) {
      addHelper("system", `Helper failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setHelperBusy(false);
    }
  }

  async function analyzeSourceUrl() {
    const url = sourceUrl.trim();
    if (!url) {
      setStatus("Paste a video/reference link first.");
      return;
    }
    setStatus("Analyzing source link…");
    try {
      const response = await fetch("/api/admingeneration/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "auto", url, source: "generation-workspace" }),
      });
      const data = await response.json().catch(() => null);
      const nextAnalysisId = findAnalysisId(data);
      if (nextAnalysisId) setAnalysisId(nextAnalysisId);
      setStatus(response.ok ? "Source analyzed" : "Source analyzer blocked/error");
      addHelper(response.ok ? "assistant" : "system", `Source analysis: ${readable(data) || "No readable analysis summary returned."}`);
    } catch (error) {
      setStatus("Source analysis failed");
      addHelper("system", `Source analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function openOutputEditor() {
    if (analysisId) {
      window.dispatchEvent(new CustomEvent("streams:analysis-loaded", { detail: { analysisId } }));
      setStatus("Opened analyzer output editor.");
      return;
    }
    setStatus("Output editor needs a real analysis ID. Analyze the video/link first.");
  }

  function resultStatusLabel() {
    if (outputUrl) return "Generated Video Ready";
    if (jobResult) return "Request Saved / Output Pending";
    return "No Output Yet";
  }

  return (
    <main className="opus-fit-shell">
      <div className="opus-board" style={boardStyle}>
        <aside className="opus-left">
          <div className="opus-logo-row">
            <div className="streams-logo-mark">◆</div>
            <div>
              <div className="opus-logo-title">STREAMS</div>
              <div className="opus-logo-sub">AI Video Control Room</div>
            </div>
          </div>

          <nav className="opus-nav">
            {navItems.map((item, index) => (
              <button className={`opus-nav-item ${index === 0 ? "active" : ""}`} key={item} type="button">
                <span>{index === 0 ? "⌂" : "▧"}</span>
                <strong>{item}</strong>
              </button>
            ))}
          </nav>

          <div className="left-plan-card">
            <small>PLAN</small>
            <strong>Pro Plan</strong>
            <span>Credits 2,450 / 5,000</span>
            <i><b /></i>
          </div>

          <div className="left-source-card">
            <strong>Source / Reference</strong>
            <div className="source-actions">
              <button type="button">Import File</button>
              <button type="button">YouTube Link</button>
            </div>
            <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="Paste video or reference link" />
            <button onClick={analyzeSourceUrl} type="button">Analyze Link</button>
            <small>{analysisId ? `Analysis ${analysisId.slice(0, 8)}…` : "No analysis loaded"}</small>
          </div>
        </aside>

        <section className="opus-main compact-shell">
          <header className="workspace-topbar">
