"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./opus-locked-frame.css";

const BOARD_WIDTH = 1920;
const BOARD_HEIGHT = 900;

const DEFAULT_PROJECT_ID = "fb7bf446-78c9-4905-80bc-32a19d0f9803";

const studios = [
  {
    id: "text-to-image",
    title: "Text to Image",
    icon: "🖼️",
    kind: "image",
    provider: "openai",
    duration: "N/A",
    aspectRatio: "1:1",
    style: "Product Visual",
    guide:
      "Text to Image guide: describe subject, environment, camera angle, lighting, mood, brand style, aspect ratio, and negative details before generating.",
    prompt:
      "Create a premium cinematic product image with dark glass UI, realistic studio lighting, and a polished commercial look.",
  },
  {
    id: "image-to-video",
    title: "Image to Video",
    icon: "🎞️",
    kind: "image-to-video",
    provider: "fal",
    duration: "8s",
    aspectRatio: "16:9",
    style: "Cinematic",
    guide:
      "Image to Video guide: upload a strong reference image, define what must stay unchanged, then specify camera movement, subject motion, environment motion, and duration.",
    prompt:
      "A lone female engineer on a rainy rooftop looking across a futuristic megacity toward a massive glowing AI tower.",
  },
  {
    id: "text-to-video",
    title: "Text to Video",
    icon: "🎬",
    kind: "text-to-video",
    provider: "fal",
    duration: "8s",
    aspectRatio: "16:9",
    style: "Sci-Fi Drama",
    guide:
      "Text to Video guide: write like a director. Define scene goal, subject, action, camera, lens, lighting, motion, mood, restrictions, and output format.",
    prompt:
      "Create an 8-second cinematic establishing shot for a premium sci-fi drama: rain-soaked megacity, lone engineer, glowing AI tower, slow push-in.",
  },
  {
    id: "voice-captions",
    title: "Voice & Captions",
    icon: "🎙️",
    kind: "voice",
    provider: "elevenlabs",
    duration: "N/A",
    aspectRatio: "N/A",
    style: "Narration",
    guide:
      "Voice guide: choose voice, tone, pace, emotion, pronunciation, language, captions style, and final delivery format.",
    prompt:
      "This is a test voice generation from STREAMS AI, delivered with calm cinematic confidence.",
  },
  {
    id: "snap-pick-click",
    title: "Snap Pic Click",
    icon: "📸",
    kind: "snap-pick-click",
    provider: "fal",
    duration: "6s",
    aspectRatio: "9:16",
    style: "Social Action",
    guide:
      "Snap Pic Click guide: upload a photo, choose the action, define the edit, select platform format, then preview before generating.",
    prompt:
      "Animate the uploaded snap into a polished short-form cinematic action clip.",
  },
  {
    id: "motion-graphics",
    title: "Motion Graphics",
    icon: "🔷",
    kind: "motion",
    provider: "fal",
    duration: "6s",
    aspectRatio: "16:9",
    style: "Motion Design",
    guide:
      "Motion Graphics guide: define brand assets, animation style, timing, motion direction, typography behavior, and final export format.",
    prompt:
      "Create premium motion graphics with neon blue panels, elegant UI movement, and cinematic depth.",
  },
  {
    id: "ai-writers",
    title: "AI Writers",
    icon: "📄",
    kind: "launch",
    provider: "openai",
    duration: "N/A",
    aspectRatio: "N/A",
    style: "Script Pack",
    guide:
      "AI Writers guide: define target audience, offer, tone, platform, output type, length, and examples before generating copy.",
    prompt:
      "Create a premium launch script, hooks, captions, and campaign copy for an AI video product.",
  },
  {
    id: "idea-launch",
    title: "Idea to Launch",
    icon: "🚀",
    kind: "launch",
    provider: "openai",
    duration: "N/A",
    aspectRatio: "16:9",
    style: "Launch Campaign",
    guide:
      "Idea to Launch guide: start with the idea, audience, offer, brand direction, launch goal, assets needed, and final channels.",
    prompt:
      "Turn a rough AI product idea into a premium launch campaign with visuals, hooks, and first ads.",
  },
];

const previewImage =
  "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1600&q=90";

const keyframes = [
  "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=360&q=85",
];

const advancedTabs = ["Prompt", "Scene", "Camera", "Lighting", "Motion", "Style", "Audio", "Output"];

function useStageFit() {
  const [fit, setFit] = useState({ scale: 1, left: 0, top: 0 });

  useEffect(() => {
    function update() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const scale = Math.min(width / BOARD_WIDTH, height / BOARD_HEIGHT);
      setFit({
        scale,
        left: Math.max(0, (width - BOARD_WIDTH * scale) / 2),
        top: Math.max(0, (height - BOARD_HEIGHT * scale) / 2),
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

function initialFields() {
  return {
    scene: "Rain-soaked futuristic megacity at night with a massive glowing AI tower in the distance.",
    subject: "Lone female engineer, realistic proportions, facing the skyline, quiet emotional presence.",
    environment: "Wet rooftop, neon reflections, dense skyline, distant flying vehicles, realistic rain.",
    emotionalIntent: "She realizes the city is controlled by something bigger than her.",
    shotType: "Establishing shot",
    cameraPosition: "Behind shoulder",
    cameraMovement: "Slow push-in",
    lens: "35mm anamorphic",
    depthOfField: "Shallow",
    composition: "Subject lower third, AI tower dominates skyline.",
    primaryLighting: "Cold blue city light",
    accentLighting: "Soft purple neon reflections",
    rimLight: "Warm edge light on jacket",
    atmosphere: "Rain, wet reflections, restrained exposure.",
    characterMotion: "Jacket and hair move slightly in wind.",
    environmentMotion: "Rain falls naturally, distant aircraft pass slowly.",
    motionQuality: "Smooth, cinematic, expensive, controlled.",
    visualStyle: "Photorealistic high-end studio film",
    productionDesign: "Premium sci-fi streaming-series look",
    humanRealism: "Natural expression, realistic body proportions.",
    negativePrompt: "No text, no logos, no extra people, no distorted hands, no cartoon, no game look, no sudden cuts.",
    voiceScript: "Optional cinematic narration.",
    voiceTone: "Calm, restrained, dramatic.",
    captions: "Optional clean lower-third captions.",
    qualityGoal: "Premium cinematic realism",
    seed: "",
  };
}

export default function OpusLockedFrame() {
  const fit = useStageFit();
  const cameraVideoRef = useRef(null);
  const [activeStudioId, setActiveStudioId] = useState("image-to-video");
  const activeStudio = studios.find((studio) => studio.id === activeStudioId) || studios[1];

  const [prompt, setPrompt] = useState(activeStudio.prompt);
  const [provider, setProvider] = useState(activeStudio.provider);
  const [duration, setDuration] = useState(activeStudio.duration);
  const [aspectRatio, setAspectRatio] = useState(activeStudio.aspectRatio);
  const [styleName, setStyleName] = useState(activeStudio.style);
  const [projectId, setProjectId] = useState(DEFAULT_PROJECT_ID);
  const [fields, setFields] = useState(initialFields);
  const [activeAdvancedTab, setActiveAdvancedTab] = useState("Prompt");
  const [previewSrc, setPreviewSrc] = useState(previewImage);
  const [status, setStatus] = useState("Preview Ready");
  const [jobResult, setJobResult] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [helperMessages, setHelperMessages] = useState([
    {
      role: "assistant",
      text:
        "I am your AI Helper. I can analyze files, review your prompt before you generate, choose the best provider, search references, guide first-time workflows, and talk with you by voice.",
    },
  ]);
  const [helperInput, setHelperInput] = useState("");
  const [helperUrl, setHelperUrl] = useState("");
  const [helperSearch, setHelperSearch] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideTitle, setGuideTitle] = useState("");
  const [guideText, setGuideText] = useState("");
  const [helperBusy, setHelperBusy] = useState(false);
  const [speakBack, setSpeakBack] = useState(true);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [helperOpen, setHelperOpen] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);

  const boardStyle = useMemo(
    () => ({
      width: BOARD_WIDTH,
      height: BOARD_HEIGHT,
      transform: `translate3d(${fit.left}px, ${fit.top}px, 0) scale(${fit.scale})`,
    }),
    [fit],
  );

  useEffect(() => {
    setPrompt(activeStudio.prompt);
    setProvider(activeStudio.provider);
    setDuration(activeStudio.duration);
    setAspectRatio(activeStudio.aspectRatio);
    setStyleName(activeStudio.style);
    setStatus("Builder Reset");
    appendHelperMessage("assistant", activeStudio.guide);
  }, [activeStudioId]);

  useEffect(() => {
    function onEscape(event) {
      if (event.key === "Escape") {
        setHelperOpen(false);
        setCameraOpen(false);
        setGuideOpen(false);
      }
    }

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  useEffect(() => {
    if (cameraOpen && cameraVideoRef.current && cameraVideoRef.current.srcObject) {
      cameraVideoRef.current.play().catch(() => {});
    }
  }, [cameraOpen]);

  function setField(key, value) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function appendHelperMessage(role, text) {
    setHelperMessages((current) => [...current, { role, text }].slice(-30));
  }

  function readable(data) {
    if (!data) return "";
    if (typeof data === "string") return data;
    const candidates = [
      data.text,
      data.message,
      data.reply,
      data.response,
      data.summary,
      data.error,
      data.result?.text,
      data.result?.message,
      data.result?.reply,
      data.result?.summary,
      data.result?.analysis?.summary,
      data.result?.error,
    ].filter(Boolean);
    if (candidates.length) return String(candidates[0]);
    try {
      return JSON.stringify(data).slice(0, 900);
    } catch {
      return "Response returned but could not be displayed.";
    }
  }

  async function speakText(text) {
    if (!speakBack || !text) return;

    try {
      const response = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, source: "admingeneration-helper" }),
      });

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("audio")) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        new Audio(url).play().catch(() => {});
        return;
      }

      const data = await response.json().catch(() => null);
      const audioUrl = data?.audioUrl || data?.url || data?.result?.audioUrl || data?.result?.url;
      const audioBase64 = data?.audioBase64 || data?.result?.audioBase64 || data?.audio || data?.result?.audio;
      if (audioUrl) new Audio(audioUrl).play().catch(() => {});
      if (audioBase64) new Audio(`data:audio/mpeg;base64,${audioBase64}`).play().catch(() => {});
    } catch {
      appendHelperMessage("system", "Voice speak-back is unavailable.");
    }
  }

  async function askHelper(textOverride) {
    const text = String(textOverride || helperInput).trim();
    if (!text || helperBusy) return;

    setHelperInput("");
    appendHelperMessage("user", text);
    setHelperBusy(true);

    try {
      const response = await fetch("/api/admingeneration/helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          messages: helperMessages,
          context: {
            activeStudioId,
            activeStudioTitle: activeStudio.title,
            provider,
            duration,
            aspectRatio,
            styleName,
            projectId,
            prompt,
            fields,
            jobResult,
          },
        }),
      });

      const data = await response.json().catch(() => null);
      const reply = response.ok ? readable(data) : readable(data) || `Helper returned ${response.status}`;
      appendHelperMessage(response.ok ? "assistant" : "system", reply);
      if (response.ok) await speakText(reply);
    } catch (error) {
      appendHelperMessage("system", `Helper failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setHelperBusy(false);
    }
  }

  function openGuide(title, text) {
    setGuideTitle(title);
    setGuideText(text);
    setGuideOpen(true);
  }

  function closeGuide() {
    setGuideOpen(false);
    setGuideTitle("");
    setGuideText("");
  }

  function openActiveStudioGuide() {
    openGuide(activeStudio.title, activeStudio.guide);
    appendHelperMessage("assistant", activeStudio.guide);
  }

  async function webResearch() {
    const query = helperSearch.trim();
    const url = helperUrl.trim();

    if (!query && !url) {
      appendHelperMessage("system", "Enter a web search query or paste a URL first.");
      return;
    }

    appendHelperMessage("user", query ? `Research this for my generation: ${query}` : `Research this reference URL: ${url}`);
    setHelperBusy(true);

    try {
      const response = await fetch("/api/admingeneration/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          url,
          source: "admingeneration-helper",
          context: {
            activeStudioId,
            activeStudioTitle: activeStudio.title,
            provider,
            styleName,
            prompt,
          },
        }),
      });

      const data = await response.json().catch(() => null);
      const summary = data?.summary || readable(data) || "Research returned no readable result.";

      appendHelperMessage(
        response.ok ? "assistant" : "system",
        `${response.ok ? "Research result" : "Research blocked/error"}:\n${summary}`,
      );

      if (response.ok) await speakText(`Research complete. ${summary}`);
    } catch (error) {
      appendHelperMessage("system", `Research failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setHelperBusy(false);
    }
  }

  async function proofPrompt() {
    await askHelper(
      `Proof this production prompt before I spend credits. Check provider fit, missing scene/camera/lighting/motion details, wasteful tokens, cheaper routing, and rewrite it for ${provider} if needed.\n\nPrompt:\n${prompt}`,
    );
  }

  async function analyzeUrl() {
    const url = helperUrl.trim();
    if (!url) {
      appendHelperMessage("system", "Paste a YouTube, website, or reference URL first.");
      return;
    }

    appendHelperMessage("user", `Analyze this reference URL: ${url}`);
    setHelperBusy(true);

    try {
      const response = await fetch("/api/admingeneration/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "auto", url, source: "admingeneration-helper" }),
      });

      const data = await response.json().catch(() => null);
      const summary = readable(data) || "Analysis returned without readable summary.";
      appendHelperMessage(response.ok ? "assistant" : "system", `${response.ok ? "Reference analyzed" : "Analyzer blocked"}:\n${summary}`);
      if (response.ok) await speakText(`Reference analyzed. ${summary}`);
    } catch (error) {
      appendHelperMessage("system", `URL analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setHelperBusy(false);
    }
  }

  async function uploadFiles(files) {
    const selectedFiles = Array.from(files || []);
    if (!selectedFiles.length) return;

    appendHelperMessage("user", `Uploading ${selectedFiles.length} reference file(s).`);
    setHelperBusy(true);

    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", file.type?.startsWith("video/") ? "video-ingest" : "upload");
      formData.append("source", "admingeneration-helper");

      try {
        const response = await fetch("/api/admingeneration/intake", { method: "POST", body: formData });
        const data = await response.json().catch(() => null);
        appendHelperMessage(
          response.ok ? "assistant" : "system",
          `${file.name}: ${response.ok ? "uploaded/analyzed" : "blocked"}\n${readable(data) || "No readable result."}`,
        );
      } catch (error) {
        appendHelperMessage("system", `${file.name}: upload failed — ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    setHelperBusy(false);
  }

  async function startVoice() {
    if (recording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);

        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const formData = new FormData();
        formData.append("file", blob, "helper-voice.webm");
        formData.append("audio", blob, "helper-voice.webm");
        formData.append("source", "admingeneration-helper");

        appendHelperMessage("system", "Transcribing your voice...");
        setHelperBusy(true);

        try {
          const response = await fetch("/api/voice/transcribe", { method: "POST", body: formData });
          const data = await response.json().catch(() => null);
          const transcript =
            data?.text ||
            data?.transcript ||
            data?.result?.text ||
            data?.result?.transcript ||
            readable(data);

          if (!response.ok || !transcript) {
            appendHelperMessage("system", `Voice transcription failed: ${readable(data) || response.status}`);
            return;
          }

          setHelperBusy(false);
          await askHelper(transcript);
        } catch (error) {
          appendHelperMessage("system", `Voice transcription failed: ${error instanceof Error ? error.message : String(error)}`);
          setHelperBusy(false);
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
      appendHelperMessage("system", "Listening. Tap Stop when finished.");
    } catch (error) {
      appendHelperMessage("system", `Microphone blocked or unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function stopVoice() {
    if (mediaRecorder && recording) mediaRecorder.stop();
  }

  async function openCameraGuide() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setCameraOpen(true);
      setTimeout(() => {
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          cameraVideoRef.current.play().catch(() => {});
        }
      }, 80);
      appendHelperMessage(
        "assistant",
        "Camera and mic guide: center your face, use soft front lighting, reduce background noise, record 30–90 seconds of natural speech, then review before cloning or saving a reference.",
      );
    } catch (error) {
      appendHelperMessage("system", `Camera/microphone blocked or unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function closeCameraGuide() {
    const stream = cameraVideoRef.current?.srcObject;
    if (stream) {
      stream.getTracks?.().forEach((track) => track.stop());
    }
    setCameraOpen(false);
  }

  function applyFieldsToPrompt() {
    const builtPrompt = [
      prompt,
      `Scene: ${fields.scene}`,
      `Subject: ${fields.subject}`,
      `Environment: ${fields.environment}`,
      `Emotional intent: ${fields.emotionalIntent}`,
      `Camera: ${fields.shotType}, ${fields.cameraPosition}, ${fields.cameraMovement}, ${fields.lens}, ${fields.depthOfField}. ${fields.composition}`,
      `Lighting: ${fields.primaryLighting}, ${fields.accentLighting}, ${fields.rimLight}, ${fields.atmosphere}`,
      `Motion: ${fields.characterMotion} ${fields.environmentMotion} ${fields.motionQuality}`,
      `Style: ${fields.visualStyle}. ${fields.productionDesign}. ${fields.humanRealism}`,
      `Negative restrictions: ${fields.negativePrompt}`,
      `Output: ${duration}, ${aspectRatio}, ${fields.qualityGoal}`,
    ].join("\n\n");

    setPrompt(builtPrompt.slice(0, 2000));
    appendHelperMessage("assistant", "I merged the advanced production fields into your main prompt. Proof it before generating.");
  }

  async function generateNow() {
    setIsGenerating(true);
    setStatus("Submitting generation job...");

    try {
      const response = await fetch("/api/admingeneration/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: activeStudio.kind,
          provider,
          projectId,
          prompt,
          aspectRatio: aspectRatio === "N/A" ? undefined : aspectRatio,
          duration: duration === "N/A" ? undefined : duration,
          metadata: {
            source: "admingeneration",
            style: styleName,
            fields,
          },
        }),
      });

      const data = await response.json().catch(() => null);
      setJobResult(data);
      setStatus(response.ok ? "Generation submitted" : "Generation blocked/error");
      appendHelperMessage(response.ok ? "assistant" : "system", `Generation result:\n${readable(data) || "No readable result."}`);
    } catch (error) {
      setStatus("Generation failed");
      appendHelperMessage("system", `Generation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsGenerating(false);
    }
  }

  function renderAdvancedPanel() {
    if (activeAdvancedTab === "Prompt") {
      return (
        <div className="advanced-panel-grid">
          <label><span>Main Prompt</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} /></label>
          <label><span>Negative Prompt</span><textarea value={fields.negativePrompt} onChange={(event) => setField("negativePrompt", event.target.value)} /></label>
        </div>
      );
    }

    if (activeAdvancedTab === "Scene") {
      return (
        <div className="advanced-panel-grid">
          <label><span>Scene</span><textarea value={fields.scene} onChange={(event) => setField("scene", event.target.value)} /></label>
          <label><span>Subject</span><textarea value={fields.subject} onChange={(event) => setField("subject", event.target.value)} /></label>
          <label><span>Environment</span><textarea value={fields.environment} onChange={(event) => setField("environment", event.target.value)} /></label>
          <label><span>Emotional Intent</span><textarea value={fields.emotionalIntent} onChange={(event) => setField("emotionalIntent", event.target.value)} /></label>
        </div>
      );
    }

    if (activeAdvancedTab === "Camera") {
      return (
        <div className="advanced-panel-grid compact">
          {["shotType", "cameraPosition", "cameraMovement", "lens", "depthOfField", "composition"].map((key) => (
            <label key={key}><span>{key}</span><input value={fields[key]} onChange={(event) => setField(key, event.target.value)} /></label>
          ))}
        </div>
      );
    }

    if (activeAdvancedTab === "Lighting") {
      return (
        <div className="advanced-panel-grid compact">
          {["primaryLighting", "accentLighting", "rimLight", "atmosphere"].map((key) => (
            <label key={key}><span>{key}</span><input value={fields[key]} onChange={(event) => setField(key, event.target.value)} /></label>
          ))}
        </div>
      );
    }

    if (activeAdvancedTab === "Motion") {
      return (
        <div className="advanced-panel-grid">
          <label><span>Character Motion</span><textarea value={fields.characterMotion} onChange={(event) => setField("characterMotion", event.target.value)} /></label>
          <label><span>Environmental Motion</span><textarea value={fields.environmentMotion} onChange={(event) => setField("environmentMotion", event.target.value)} /></label>
          <label><span>Motion Quality</span><textarea value={fields.motionQuality} onChange={(event) => setField("motionQuality", event.target.value)} /></label>
        </div>
      );
    }

    if (activeAdvancedTab === "Style") {
      return (
        <div className="advanced-panel-grid">
          <label><span>Visual Style</span><textarea value={fields.visualStyle} onChange={(event) => setField("visualStyle", event.target.value)} /></label>
          <label><span>Production Design</span><textarea value={fields.productionDesign} onChange={(event) => setField("productionDesign", event.target.value)} /></label>
          <label><span>Human Realism</span><textarea value={fields.humanRealism} onChange={(event) => setField("humanRealism", event.target.value)} /></label>
        </div>
      );
    }

    if (activeAdvancedTab === "Audio") {
      return (
        <div className="advanced-panel-grid compact">
          <label><span>Voice Script</span><textarea value={fields.voiceScript} onChange={(event) => setField("voiceScript", event.target.value)} /></label>
          <label><span>Voice Tone</span><input value={fields.voiceTone} onChange={(event) => setField("voiceTone", event.target.value)} /></label>
          <label><span>Captions</span><input value={fields.captions} onChange={(event) => setField("captions", event.target.value)} /></label>
        </div>
      );
    }

    return (
      <div className="advanced-panel-grid compact">
        <label><span>Project ID</span><input value={projectId} onChange={(event) => setProjectId(event.target.value)} /></label>
        <label><span>Quality Goal</span><input value={fields.qualityGoal} onChange={(event) => setField("qualityGoal", event.target.value)} /></label>
        <label><span>Seed</span><input value={fields.seed} onChange={(event) => setField("seed", event.target.value)} placeholder="Optional" /></label>
      </div>
    );
  }

  return (
    <main className="opus-fit-shell">
      <div className="opus-board" style={boardStyle}>
        <aside className="opus-left">
          <div className="opus-logo-row">
            <div className="opus-logo-mark" />
            <div>
              <div className="opus-logo-title">Opus</div>
              <div className="opus-logo-sub">by Agent Opus</div>
            </div>
          </div>

          <nav className="opus-nav">
            {["Home", "My Projects", "Templates", "AI Avatars", "Brand Kit", "Assets", "Team", "Analytics", "Integrations", "Settings"].map((item, index) => (
              <button className={`opus-nav-item ${index === 0 ? "active" : ""}`} key={item} type="button">
                <span>{index === 0 ? "⌂" : "▧"}</span>
                <strong>{item}</strong>
              </button>
            ))}
          </nav>

          <div className="left-studio-switcher">
            <div className="left-studio-title">Studio Systems</div>
            {studios.map((studio) => (
              <button
                className={`left-studio-card ${studio.id === activeStudioId ? "active" : ""}`}
                key={studio.id}
                onClick={() => setActiveStudioId(studio.id)}
                type="button"
              >
                <span>{studio.icon}</span>
                <strong>{studio.title}</strong>
                <small>{studio.kind}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="opus-main production-layout">
          <header className="opus-top generation-top">
            <div>
              <h1>Good evening, Creator 👋</h1>
              <p>Craft cinematic outputs with precision, references, voice, and helper proofing.</p>
            </div>
            <div className="opus-account-row">
              <div className="credit-pill">🟣 Credits: 2,450</div>
              <button className="mini-upgrade" type="button">Upgrade</button>
              <button className="bell" type="button">🔔</button>
              <button className="creator-menu" type="button">C&nbsp;&nbsp; Creator⌄</button>
            </div>
          </header>

          <div className="mode-row generation-modes">
            <button className="mode" type="button">⚡ Smart Mode</button>
            <button className="mode active" type="button">⚡ Advanced Mode</button>
            <button className="mode" onClick={() => setHelperOpen(true)} type="button">✨ AI Helper</button>
          </div>

          <section className="builder-strip production-controls">
            <label className="builder-field prompt-field">
              <span>Main Prompt</span>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
              <b>{prompt.length} / 2000</b>
            </label>

            <label className="builder-field">
              <span>Provider</span>
              <select value={provider} onChange={(event) => setProvider(event.target.value)}>
                <option value="openai">openai</option>
                <option value="fal">fal</option>
                <option value="runway">runway</option>
                <option value="kling">kling</option>
                <option value="veo">veo</option>
                <option value="elevenlabs">elevenlabs</option>
              </select>
            </label>

            <label className="builder-field small">
              <span>Duration</span>
              <select value={duration} onChange={(event) => setDuration(event.target.value)}>
                <option>8s</option>
                <option>6s</option>
                <option>4s</option>
                <option>N/A</option>
              </select>
            </label>

            <label className="builder-field small">
              <span>Aspect Ratio</span>
              <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)}>
                <option>16:9</option>
                <option>9:16</option>
                <option>1:1</option>
                <option>N/A</option>
              </select>
            </label>

            <label className="builder-field">
              <span>Style</span>
              <input value={styleName} onChange={(event) => setStyleName(event.target.value)} />
            </label>

            <button className="proof-button" onClick={proofPrompt} type="button">Proof</button>
            <button className="primary-generate" disabled={isGenerating} onClick={generateNow} type="button">
              {isGenerating ? "Submitting..." : "Generate ✨"}
            </button>
          </section>

          <section className="preview-layout full-helper">
            <div className="preview-column">
              <div className="video-shell">
                <img src={previewSrc} alt="Generated preview" />
                <div className="live-status">{status}</div>
                <div className="video-controls">
                  <b>▶</b>
                  <span>0:00 / {duration === "N/A" ? "0:08" : `0:0${duration.replace("s", "")}`}</span>
                  <i />
                  <em>CC</em>
                  <em>1x</em>
                  <em>◔</em>
                  <em>⛶</em>
                </div>
              </div>

              <section className="timeline-card">
                <div className="timeline-head">
                  <strong>Timeline / Keyframes</strong>
                  <span>{duration === "N/A" ? "8s" : duration} • 6 Keyframes</span>
                </div>
                <div className="keyframe-row">
                  {keyframes.map((image, index) => (
                    <div className={`keyframe ${index === 0 ? "active" : ""}`} key={image}>
                      <img src={image} alt="" />
                      <span>{index}s</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="advanced-production">
                <div className="advanced-tabs">
                  {advancedTabs.map((tab) => (
                    <button className={tab === activeAdvancedTab ? "active" : ""} key={tab} onClick={() => setActiveAdvancedTab(tab)} type="button">
                      {tab}
                    </button>
                  ))}
                  <button className="merge-fields" onClick={applyFieldsToPrompt} type="button">Apply Fields To Prompt</button>
                </div>
                {renderAdvancedPanel()}
              </section>
            </div>

            <aside className="right-advanced-builder">
              <div className="right-builder-header">
                <div>
                  <h3>✨ Advanced Prompt Builder</h3>
                  <p>Fine-tune every aspect of your production before generation.</p>
                </div>
                <div className="right-builder-actions">
                  <button onClick={proofPrompt} type="button">Proof</button>
                  <button onClick={applyFieldsToPrompt} type="button">Apply</button>
                </div>
              </div>

              <div className="right-builder-scroll">
                <section className="right-field-card wide">
                  <div className="right-field-title">1. Main Prompt</div>
                  <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
                  <span className="count">{prompt.length} / 2000</span>
                </section>

                <section className="right-field-card wide">
                  <div className="right-field-title">2. Scene Description</div>
                  <textarea value={fields.scene} onChange={(event) => setField("scene", event.target.value)} />
                </section>

                <div className="right-field-row">
                  <section className="right-field-card">
                    <div className="right-field-title">3. Subject</div>
                    <textarea value={fields.subject} onChange={(event) => setField("subject", event.target.value)} />
                  </section>

                  <section className="right-field-card">
                    <div className="right-field-title">4. Environment</div>
                    <textarea value={fields.environment} onChange={(event) => setField("environment", event.target.value)} />
                  </section>
                </div>

                <section className="right-field-card wide">
                  <div className="right-field-title">5. Emotional Intent</div>
                  <textarea value={fields.emotionalIntent} onChange={(event) => setField("emotionalIntent", event.target.value)} />
                </section>

                <section className="right-field-card wide">
                  <div className="right-field-title">6. Camera</div>
                  <div className="right-mini-grid">
                    <label><span>Shot Type</span><input value={fields.shotType} onChange={(event) => setField("shotType", event.target.value)} /></label>
                    <label><span>Camera Position</span><input value={fields.cameraPosition} onChange={(event) => setField("cameraPosition", event.target.value)} /></label>
                    <label><span>Camera Movement</span><input value={fields.cameraMovement} onChange={(event) => setField("cameraMovement", event.target.value)} /></label>
                    <label><span>Lens</span><input value={fields.lens} onChange={(event) => setField("lens", event.target.value)} /></label>
                    <label><span>Depth of Field</span><input value={fields.depthOfField} onChange={(event) => setField("depthOfField", event.target.value)} /></label>
                    <label><span>Composition</span><input value={fields.composition} onChange={(event) => setField("composition", event.target.value)} /></label>
                  </div>
                </section>

                <section className="right-field-card wide">
                  <div className="right-field-title">7. Lighting</div>
                  <div className="right-mini-grid">
                    <label><span>Primary</span><input value={fields.primaryLighting} onChange={(event) => setField("primaryLighting", event.target.value)} /></label>
                    <label><span>Accent</span><input value={fields.accentLighting} onChange={(event) => setField("accentLighting", event.target.value)} /></label>
                    <label><span>Rim Light</span><input value={fields.rimLight} onChange={(event) => setField("rimLight", event.target.value)} /></label>
                    <label><span>Atmosphere</span><input value={fields.atmosphere} onChange={(event) => setField("atmosphere", event.target.value)} /></label>
                  </div>
                </section>

                <section className="right-field-card wide">
                  <div className="right-field-title">8. Motion</div>
                  <div className="right-mini-grid">
                    <label><span>Character</span><input value={fields.characterMotion} onChange={(event) => setField("characterMotion", event.target.value)} /></label>
                    <label><span>Environment</span><input value={fields.environmentMotion} onChange={(event) => setField("environmentMotion", event.target.value)} /></label>
                    <label><span>Motion Quality</span><input value={fields.motionQuality} onChange={(event) => setField("motionQuality", event.target.value)} /></label>
                  </div>
                </section>

                <section className="right-field-card wide">
                  <div className="right-field-title">9. Style</div>
                  <div className="right-mini-grid">
                    <label><span>Visual Style</span><input value={fields.visualStyle} onChange={(event) => setField("visualStyle", event.target.value)} /></label>
                    <label><span>Production Design</span><input value={fields.productionDesign} onChange={(event) => setField("productionDesign", event.target.value)} /></label>
                    <label><span>Human Realism</span><input value={fields.humanRealism} onChange={(event) => setField("humanRealism", event.target.value)} /></label>
                    <label><span>Style Preset</span><input value={styleName} onChange={(event) => setStyleName(event.target.value)} /></label>
                  </div>
                </section>

                <section className="right-field-card wide danger">
                  <div className="right-field-title">10. Negative Prompt / Restrictions</div>
                  <textarea value={fields.negativePrompt} onChange={(event) => setField("negativePrompt", event.target.value)} />
                </section>

                <section className="right-field-card wide">
                  <div className="right-field-title">11. Audio / Voice</div>
                  <div className="right-mini-grid">
                    <label><span>Voice Script</span><input value={fields.voiceScript} onChange={(event) => setField("voiceScript", event.target.value)} /></label>
                    <label><span>Voice Tone</span><input value={fields.voiceTone} onChange={(event) => setField("voiceTone", event.target.value)} /></label>
                    <label><span>Captions</span><input value={fields.captions} onChange={(event) => setField("captions", event.target.value)} /></label>
                  </div>
                </section>

                <section className="right-field-card wide">
                  <div className="right-field-title">12. Output Settings</div>
                  <div className="right-mini-grid">
                    <label><span>Provider</span><input value={provider} onChange={(event) => setProvider(event.target.value)} /></label>
                    <label><span>Duration</span><input value={duration} onChange={(event) => setDuration(event.target.value)} /></label>
                    <label><span>Aspect Ratio</span><input value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)} /></label>
                    <label><span>Quality Goal</span><input value={fields.qualityGoal} onChange={(event) => setField("qualityGoal", event.target.value)} /></label>
                    <label><span>Project ID</span><input value={projectId} onChange={(event) => setProjectId(event.target.value)} /></label>
                    <label><span>Seed</span><input value={fields.seed} onChange={(event) => setField("seed", event.target.value)} /></label>
                  </div>
                </section>

                <section className="right-workflow-card">
                  <div>
                    <strong>Workflow Overview</strong>
                    <span>1 Build Prompt → 2 Proof Settings → 3 Generate → 4 Review & Refine</span>
                  </div>
                  <button onClick={generateNow} disabled={isGenerating} type="button">
                    {isGenerating ? "Submitting..." : "Generate Video ✨"}
                  </button>
                </section>
              </div>
            </aside>
          </section>
        </section>

        {guideOpen ? (
          <div className="guide-modal-backdrop" onClick={closeGuide}>
            <div className="guide-modal" onClick={(event) => event.stopPropagation()}>
              <button className="guide-close" onClick={closeGuide} type="button">×</button>
              <h3>{guideTitle || "Workflow Guide"}</h3>
              <p>{guideText}</p>
              <div className="guide-steps">
                <span>1. Add references or describe the goal.</span>
                <span>2. Ask AI Helper to proof the prompt.</span>
                <span>3. Confirm provider, duration, aspect ratio, and style.</span>
                <span>4. Generate only after blocked states are clear.</span>
              </div>
            </div>
          </div>
        ) : null}

        {cameraOpen ? (
          <div className="camera-modal-backdrop" onClick={closeCameraGuide}>
            <div className="camera-modal" onClick={(event) => event.stopPropagation()}>
              <button className="camera-close" onClick={closeCameraGuide} type="button">×</button>
              <video ref={cameraVideoRef} muted playsInline />
              <div>
                <h3>Clone Self / Voice Guide</h3>
                <p>Center your face. Use soft front light. Keep the room quiet. Record 30–90 seconds of natural speech. Review quality before saving.</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
