"use client";

import { useEffect, useMemo, useState } from "react";
import "./opus-locked-frame.css";

const BOARD_WIDTH = 1920;
const BOARD_HEIGHT = 780;

const studios = [
  {
    id: "text-to-image",
    title: "Text to Image",
    desc: "Generate stunning images from text",
    icon: "🖼️",
    tone: "blue",
    kind: "image",
    provider: "openai",
    duration: "N/A",
    aspectRatio: "1:1",
    style: "Product Visual",
    prompt:
      "Create a premium cinematic product image with dark glass UI, realistic studio lighting, and a polished commercial look.",
    summary:
      "A high-end still image workflow for brand visuals, product shots, thumbnails, concepts, and campaign creative.",
  },
  {
    id: "image-to-video",
    title: "Image to Video",
    desc: "Turn images into dynamic videos",
    icon: "🎞️",
    tone: "purple",
    kind: "image-to-video",
    provider: "fal",
    duration: "8s",
    aspectRatio: "16:9",
    style: "Cinematic",
    prompt:
      "A lone female engineer on a rainy rooftop looking across a futuristic megacity toward a massive glowing AI tower.",
    summary:
      "A cinematic image-to-video workflow for turning a reference still into a realistic moving shot.",
  },
  {
    id: "text-to-video",
    title: "Text to Video",
    desc: "Create videos from text descriptions",
    icon: "🎬",
    tone: "pink",
    kind: "text-to-video",
    provider: "fal",
    duration: "8s",
    aspectRatio: "16:9",
    style: "Sci-Fi Drama",
    prompt:
      "Create an 8-second cinematic establishing shot for a premium sci-fi drama: rain-soaked megacity, lone engineer, glowing AI tower, slow push-in.",
    summary:
      "A director-style text-to-video workflow for cinematic shots, ads, scenes, and launch films.",
  },
  {
    id: "voice-captions",
    title: "Voice & Captions",
    desc: "Generate voiceovers & captions",
    icon: "🎙️",
    tone: "cyan",
    kind: "voice",
    provider: "elevenlabs",
    duration: "N/A",
    aspectRatio: "N/A",
    style: "Narration",
    prompt:
      "This is a test voice generation from STREAMS AI, delivered with calm cinematic confidence.",
    summary:
      "A voice workflow for narration, captions, dubbing, creator voiceovers, and audio-first outputs.",
  },
  {
    id: "snap-pick-click",
    title: "Snap Pic Click",
    desc: "Pick, animate, edit action",
    icon: "📸",
    tone: "orange",
    kind: "snap-pick-click",
    provider: "fal",
    duration: "6s",
    aspectRatio: "9:16",
    style: "Social Action",
    prompt:
      "Animate the uploaded snap into a polished short-form cinematic action clip.",
    summary:
      "A fast photo-to-action workflow for turning a selected image into edited motion or social content.",
  },
  {
    id: "motion-graphics",
    title: "Motion Graphics",
    desc: "Create stunning motion graphics",
    icon: "🔷",
    tone: "blue",
    kind: "motion",
    provider: "fal",
    duration: "6s",
    aspectRatio: "16:9",
    style: "Motion Design",
    prompt:
      "Create premium motion graphics with neon blue panels, elegant UI movement, and cinematic depth.",
    summary:
      "A motion graphics workflow for animated interface pieces, title cards, product motion, and brand visuals.",
  },
  {
    id: "ai-writers",
    title: "AI Writers",
    desc: "Scripts, ideas, blogs, X posts",
    icon: "📄",
    tone: "violet",
    kind: "launch",
    provider: "openai",
    duration: "N/A",
    aspectRatio: "N/A",
    style: "Script Pack",
    prompt:
      "Create a premium launch script, hooks, captions, and campaign copy for an AI video product.",
    summary:
      "A writing workflow for scripts, hooks, captions, posts, launch angles, and campaign structure.",
  },
  {
    id: "idea-launch",
    title: "Idea to Launch",
    desc: "Turn ideas into full campaigns",
    icon: "🚀",
    tone: "gold",
    kind: "launch",
    provider: "openai",
    duration: "N/A",
    aspectRatio: "16:9",
    style: "Launch Campaign",
    prompt:
      "Turn a rough AI product idea into a premium launch campaign with visuals, hooks, and first ads.",
    summary:
      "A full launch workflow for taking an idea into brand, content, creative assets, and campaign outputs.",
  },
];

const keyframes = [
  "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=360&q=85",
];

const previewImage =
  "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1600&q=90";

const advancedTabs = [
  ["Prompt", "✣"],
  ["Camera", "▣"],
  ["Lighting", "☼"],
  ["Motion", "⌘"],
  ["Style", "✥"],
  ["Output", "▧"],
];

function useStageFit() {
  const [fit, setFit] = useState({ scale: 1, left: 0, top: 0 });

  useEffect(() => {
    function update() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const scale = width / BOARD_WIDTH;
      setFit({
        scale,
        left: 0,
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

export default function OpusLockedFrame() {
  const fit = useStageFit();
  const [activeStudioId, setActiveStudioId] = useState("image-to-video");
  const activeStudio =
    studios.find((studio) => studio.id === activeStudioId) || studios[1];

  const [prompt, setPrompt] = useState(activeStudio.prompt);
  const [provider, setProvider] = useState(activeStudio.provider);
  const [duration, setDuration] = useState(activeStudio.duration);
  const [aspectRatio, setAspectRatio] = useState(activeStudio.aspectRatio);
  const [style, setStyle] = useState(activeStudio.style);
  const [activeTab, setActiveTab] = useState("Prompt");
  const [status, setStatus] = useState("Preview Ready");
  const [helperMessages, setHelperMessages] = useState([
    {
      role: "assistant",
      text: "I am your AI Helper. I can analyze files, review your prompt before you generate, help choose the best provider, search references, and talk with you by voice.",
    },
  ]);
  const [helperInput, setHelperInput] = useState("");
  const [helperBusy, setHelperBusy] = useState(false);
  const [speakBack, setSpeakBack] = useState(true);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [helperUrl, setHelperUrl] = useState("");
  const [helperDrawerOpen, setHelperDrawerOpen] = useState(true);
  const [intakeUrl, setIntakeUrl] = useState("");
  const [intakeStatus, setIntakeStatus] = useState("Ready for production references");
  const [intakeResult, setIntakeResult] = useState(null);
  const [uploadedAssets, setUploadedAssets] = useState([]);
  const [isIntaking, setIsIntaking] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setPrompt(activeStudio.prompt);
    setProvider(activeStudio.provider);
    setDuration(activeStudio.duration);
    setAspectRatio(activeStudio.aspectRatio);
    setStyle(activeStudio.style);
    setStatus("Builder Reset");
  }, [activeStudio]);

  const boardStyle = useMemo(
    () => ({
      width: BOARD_WIDTH,
      height: BOARD_HEIGHT,
      transform: `translate3d(${fit.left}px, ${fit.top}px, 0) scale(${fit.scale})`,
    }),
    [fit]
  );

  function getReadableIntakeResult(data) {
    if (!data) return "No analysis yet.";
    if (typeof data === "string") return data;

    const candidates = [
      data.summary,
      data.analysis?.summary,
      data.result?.summary,
      data.result?.analysis?.summary,
      data.result?.transcript,
      data.result?.title,
      data.result?.description,
      data.data?.summary,
      data.title,
      data.transcript,
      data.text,
      data.description,
      data.error,
      data.result?.error,
    ].filter(Boolean);

    if (candidates.length > 0) {
      return String(candidates[0]).slice(0, 420);
    }

    try {
      return JSON.stringify(data).slice(0, 420);
    } catch {
      return "Analysis returned, but could not be displayed.";
    }
  }

  function applyIntakeToBuilder() {
    const text = getReadableIntakeResult(intakeResult);
    if (!text || text === "No analysis yet.") return;

    setPrompt((current) =>
      `${current}\n\nReference analysis:\n${text}`.slice(0, 2000),
    );
    setStatus("Reference Applied");
  }

  async function analyzeUrl() {
    const url = intakeUrl.trim();

    if (!url) {
      setIntakeStatus("Paste a YouTube, website, or reference URL first.");
      return;
    }

    setIsIntaking(true);
    setIntakeStatus("Analyzing link through intake wrapper...");
    setIntakeResult(null);

    try {
      const response = await fetch("/api/admingeneration/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "auto", url, source: "admingeneration" }),
      });

      const data = await response.json().catch(() => null);
      setIntakeResult(data);
      setIntakeStatus(response.ok ? "Link analyzed" : "Analyzer returned a blocked/error state");
    } catch (error) {
      setIntakeResult({ error: error instanceof Error ? error.message : "Link analysis failed" });
      setIntakeStatus("Link analysis failed");
    } finally {
      setIsIntaking(false);
    }
  }

  async function uploadFiles(files) {
    const selectedFiles = Array.from(files || []);

    if (selectedFiles.length === 0) return;

    setIsIntaking(true);
    setIntakeStatus(`Uploading ${selectedFiles.length} asset${selectedFiles.length === 1 ? "" : "s"}...`);

    const uploaded = [];

    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", file.type?.startsWith("video/") ? "video-ingest" : "upload");
      formData.append("source", "admingeneration");

      try {
        const response = await fetch("/api/admingeneration/intake", {
          method: "POST",
          body: formData,
        });

        const data = await response.json().catch(() => ({}));
        uploaded.push({
          name: file.name,
          type: file.type || "unknown",
          size: file.size,
          ok: response.ok,
          data,
        });
      } catch (error) {
        uploaded.push({
          name: file.name,
          type: file.type || "unknown",
          size: file.size,
          ok: false,
          data: { error: error instanceof Error ? error.message : "Upload failed" },
        });
      }
    }

    setUploadedAssets((current) => [...uploaded, ...current].slice(0, 8));
    setIntakeResult(uploaded[0]?.data || null);
    setIntakeStatus("Upload complete. Select an asset chip to analyze as reference.");
    setIsIntaking(false);
  }

  async function analyzeUploadedReference(asset) {
    if (!asset) return;

    setIsIntaking(true);
    setIntakeStatus("Analyzing uploaded reference...");

    const possibleUrl =
      asset.data?.result?.url ||
      asset.data?.result?.asset?.url ||
      asset.data?.result?.publicUrl ||
      asset.data?.result?.fileUrl ||
      asset.data?.url ||
      asset.data?.assetUrl ||
      asset.data?.path ||
      "";

    try {
      const response = await fetch("/api/admingeneration/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "reference",
          assetUrl: possibleUrl,
          fileName: asset.name,
          mimeType: asset.type,
          source: "admingeneration",
        }),
      });

      const data = await response.json().catch(() => ({}));
      setIntakeResult(data);
      setIntakeStatus(response.ok ? "Reference analyzed" : "Reference analyzer returned a blocked/error state");
    } catch (error) {
      setIntakeResult({ error: error instanceof Error ? error.message : "Reference analysis failed" });
      setIntakeStatus("Reference analysis failed");
    } finally {
      setIsIntaking(false);
    }
  }

  function appendHelperMessage(role, text) {
    setHelperMessages((current) => [...current, { role, text }].slice(-18));
  }

  function extractTextFromResponse(data) {
    if (!data) return "";
    if (typeof data === "string") return data;

    const candidates = [
      data.message,
      data.reply,
      data.response,
      data.content,
      data.text,
      data.output,
      data.answer,
      data.assistant?.message,
      data.assistant?.content,
      data.result?.message,
      data.result?.reply,
      data.result?.response,
      data.result?.content,
      data.result?.text,
      data.result?.summary,
      data.result?.analysis?.summary,
      data.summary,
      data.analysis?.summary,
      data.error,
      data.result?.error,
    ].filter(Boolean);

    if (candidates.length > 0) return String(candidates[0]);

    try {
      return JSON.stringify(data).slice(0, 900);
    } catch {
      return "The helper received a response, but it could not display it.";
    }
  }

  async function speakHelperText(text) {
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
        const audio = new Audio(url);
        audio.play().catch(() => {});
        return;
      }

      const data = await response.json().catch(() => null);
      const audioUrl =
        data?.audioUrl ||
        data?.url ||
        data?.result?.audioUrl ||
        data?.result?.url ||
        data?.outputUrl;

      const audioBase64 =
        data?.audioBase64 ||
        data?.result?.audioBase64 ||
        data?.audio ||
        data?.result?.audio;

      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.play().catch(() => {});
      } else if (audioBase64) {
        const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
        audio.play().catch(() => {});
      }
    } catch {
      appendHelperMessage("system", "Voice speak-back is unavailable right now.");
    }
  }

  async function callHelperBrain(userText) {
    const endpoints = [
      "/api/streams/chat",
      "/api/ai-assistant",
      "/api/streams-ai/messages",
    ];

    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userText,
            prompt: userText,
            source: "admingeneration-helper",
            mode: "admingeneration",
            context: {
              activeStudioId,
              activeStudioTitle: activeStudio.title,
              provider,
              duration,
              aspectRatio,
              style,
              currentPrompt: prompt,
            },
            messages: helperMessages,
          }),
        });

        const data = await response.json().catch(() => null);
        const text = extractTextFromResponse(data);

        if (response.ok && text) return text;

        lastError = text || `${endpoint} returned ${response.status}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    return `I could not reach the helper brain yet. Last error: ${lastError || "unknown error"}`;
  }

  async function sendHelperMessage(messageOverride) {
    const text = (messageOverride || helperInput).trim();
    if (!text || helperBusy) return;

    setHelperInput("");
    appendHelperMessage("user", text);
    setHelperBusy(true);

    try {
      const reply = await callHelperBrain(text);
      appendHelperMessage("assistant", reply);
      await speakHelperText(reply);
    } finally {
      setHelperBusy(false);
    }
  }

  async function proofPromptBeforeGenerate() {
    const proofRequest = `Proof this generation prompt before I spend credits. Check provider fit, missing details, token waste, cheaper routing, and rewrite it for the selected provider if needed.\n\nProvider: ${provider}\nDuration: ${duration}\nAspect: ${aspectRatio}\nStyle: ${style}\nPrompt:\n${prompt}`;
    await sendHelperMessage(proofRequest);
  }

  async function analyzeHelperUrl() {
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
      const summary = extractTextFromResponse(data) || "Analysis returned without readable summary.";
      const message = response.ok
        ? `Reference analyzed:\n${summary}`
        : `Reference analyzer returned a blocked/error state:\n${summary}`;

      appendHelperMessage("assistant", message);
      await speakHelperText(message);
    } catch (error) {
      appendHelperMessage("assistant", `URL analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setHelperBusy(false);
    }
  }

  async function uploadHelperFiles(files) {
    const selectedFiles = Array.from(files || []);
    if (selectedFiles.length === 0) return;

    appendHelperMessage("user", `Uploading ${selectedFiles.length} file(s) for analysis.`);
    setHelperBusy(true);

    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", file.type?.startsWith("video/") ? "video-ingest" : "upload");
      formData.append("source", "admingeneration-helper");

      try {
        const response = await fetch("/api/admingeneration/intake", {
          method: "POST",
          body: formData,
        });

        const data = await response.json().catch(() => null);
        const summary = extractTextFromResponse(data) || "Upload completed, but no readable summary returned.";
        appendHelperMessage(
          response.ok ? "assistant" : "system",
          `${file.name}: ${response.ok ? "uploaded" : "blocked/error"}\n${summary}`,
        );
      } catch (error) {
        appendHelperMessage("system", `${file.name}: upload failed — ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    setHelperBusy(false);
  }

  async function startVoiceRecording() {
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
        formData.append("source", "admingeneration-helper");

        appendHelperMessage("system", "Transcribing your voice...");
        setHelperBusy(true);

        try {
          const response = await fetch("/api/voice/transcribe", {
            method: "POST",
            body: formData,
          });

          const data = await response.json().catch(() => null);
          const transcript =
            data?.text ||
            data?.transcript ||
            data?.result?.text ||
            data?.result?.transcript ||
            extractTextFromResponse(data);

          if (!response.ok || !transcript) {
            appendHelperMessage("system", `Voice transcription failed: ${extractTextFromResponse(data) || response.status}`);
            return;
          }

          await sendHelperMessage(transcript);
        } catch (error) {
          appendHelperMessage("system", `Voice transcription failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
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

  function stopVoiceRecording() {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();
    }
  }

  async function openCameraGuide() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setCameraStream(stream);
      appendHelperMessage(
        "assistant",
        "Camera and mic are ready. Guide: center your face, use soft front lighting, keep the room quiet, record 30–90 seconds of natural speech, then review before saving.",
      );
    } catch (error) {
      appendHelperMessage("system", `Camera/microphone blocked or unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function closeHelperDrawer() {
    setHelperDrawerOpen(false);
  }

  useEffect(() => {
    function onEscape(event) {
      if (event.key === "Escape") closeHelperDrawer();
    }

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  function handleGenerate() {
    setStatus("Protected API Ready");
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
            {[
              ["⌂", "Home", true],
              ["▣", "My Projects"],
              ["▦", "Templates"],
              ["☻", "AI Avatars"],
              ["◇", "Brand Kit"],
              ["▧", "Assets"],
              ["♧", "Team"],
              ["◷", "Analytics"],
              ["⚙", "Integrations"],
              ["⚙", "Settings"],
            ].map(([icon, label, active]) => (
              <button className={`opus-nav-item ${active ? "active" : ""}`} key={label} type="button">
                <span>{icon}</span>
                <strong>{label}</strong>
              </button>
            ))}
          </nav>

          <div className="left-studio-switcher">
            <div className="left-studio-title">Studio Systems</div>
            <div className="studio-tab-row">
              {studios.map((studio) => (
                <button
                  className={`studio-tab-card ${studio.tone} ${studio.id === activeStudioId ? "active" : ""}`}
                  key={studio.id}
                  type="button"
                  onClick={() => setActiveStudioId(studio.id)}
                >
                  <div className="studio-tab-icon">{studio.icon}</div>
                  <strong>{studio.title}</strong>
                  <span>{studio.desc}</span>
                </button>
              ))}
            </div>


            <div className="studio-reset-note">
              ⓘ Each studio tab reloads the builder with settings and tools optimized for that workflow.
            </div>


          </div>

          <div className="opus-plan-card">
            <div className="muted">PLAN</div>
            <div className="plan-top">
              <strong>Pro Plan</strong>
              <button type="button">Upgrade</button>
            </div>
            <div className="muted">Credits</div>
            <div className="credit-value">2,450 / 5,000</div>
            <div className="credit-track">
              <span />
            </div>
            <div className="muted">Reset on Aug 12, 2025</div>
          </div>

          <button className="opus-community" type="button">💬 Join Community</button>
        </aside>

        <section className="opus-main generation-main">
          <header className="opus-top generation-top">
            <div>
              <h1>Good evening, Creator 👋</h1>
              <p>Craft cinematic outputs with precision and control.</p>
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
            <button className="mode" type="button">✨ AI Assistant</button>
          </div>

          <section className="production-intake-panel">
            <div
              className={`intake-drop-zone ${isDragging ? "dragging" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                uploadFiles(event.dataTransfer.files);
              }}
            >
              <strong>Production Intake + Analyzer</strong>
              <span>Drop video, image refs, audio, PDFs, scripts, style assets</span>
              <input
                multiple
                type="file"
                accept="video/*,image/*,audio/*,.pdf,.txt,.md,.doc,.docx"
                onChange={(event) => uploadFiles(event.target.files)}
              />
            </div>

            <div className="intake-url-box">
              <label>
                <span>YouTube / Website / Reference URL</span>
                <input
                  value={intakeUrl}
                  onChange={(event) => setIntakeUrl(event.target.value)}
                  placeholder="Paste YouTube, website, product page, script page, or reference URL"
                />
              </label>
              <button disabled={isIntaking} onClick={analyzeUrl} type="button">
                {isIntaking ? "Analyzing..." : "Analyze URL"}
              </button>
            </div>

            <div className="intake-results-box">
              <div className="intake-status">{intakeStatus}</div>
              <p>{getReadableIntakeResult(intakeResult)}</p>
              <div className="asset-chip-row">
                {uploadedAssets.slice(0, 3).map((asset) => (
                  <button key={`${asset.name}-${asset.size}`} onClick={() => analyzeUploadedReference(asset)} type="button">
                    {asset.ok ? "✓" : "!"} {asset.name}
                  </button>
                ))}
              </div>
              <button className="apply-analysis" onClick={applyIntakeToBuilder} type="button">
                Feed Analysis Into Movie Builder
              </button>
            </div>
          </section>

          <section className="builder-strip">
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
              <input value={style} onChange={(event) => setStyle(event.target.value)} />
            </label>

            <button className="primary-generate" onClick={handleGenerate} type="button">
              Generate ✨
            </button>
          </section>

          <section className="preview-layout">
            <div className="preview-column">
              <div className="video-shell">
                <img src={previewImage} alt="Generated preview" />
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
                  <span>{duration === "N/A" ? "8s" : duration} • 8 Keyframes</span>
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

              <section className="versions-card">
                <div className="section-head compact">
                  <h3>Related Outputs / Previous Versions</h3>
                  <button type="button">View all versions →</button>
                </div>
                <div className="versions-row">
                  {["Version 2 (Current)", "Version 1", "Alt Variation A", "Alt Variation B", "+2 More Versions"].map(
                    (title, index) => (
                      <article className="version-item" key={title}>
                        <img src={keyframes[index % keyframes.length]} alt="" />
                        <strong>{title}</strong>
                        <span>{duration === "N/A" ? "8s" : duration} • {aspectRatio} • {provider}</span>
                      </article>
                    )
                  )}
                </div>
              </section>

              <section className="advanced-dock">
                <button className="advanced-toggle" type="button">⌄ Advanced Controls</button>
                {advancedTabs.map(([tab, icon]) => (
                  <button
                    className={tab === activeTab ? "active" : ""}
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    type="button"
                  >
                    <span>{icon}</span>
                    {tab}
                  </button>
                ))}
              </section>
            </div>

            <aside className={`builder-side ai-helper-console ${helperDrawerOpen ? "open" : "closed"}`}>
              <div className="helper-header">
                <div>
                  <h3>AI Helper / Analyzer</h3>
                  <p>Talk, analyze, proof prompts, search references, and guide each workflow.</p>
                </div>
                <button aria-label="Close helper" onClick={closeHelperDrawer} type="button">×</button>
              </div>

              <div className="helper-guide-strip">
                <button onClick={proofPromptBeforeGenerate} type="button">Proof Prompt</button>
                <button onClick={openCameraGuide} type="button">Camera + Mic Guide</button>
                <button onClick={() => appendHelperMessage("assistant", "First-time guide: pick a studio card, add references, talk to me about what you want, proof the prompt, then generate only after the provider route is ready.")} type="button">User Guide</button>
              </div>

              <div className="helper-url-row">
                <input
                  value={helperUrl}
                  onChange={(event) => setHelperUrl(event.target.value)}
                  placeholder="Paste YouTube / website / reference URL"
                />
                <button disabled={helperBusy} onClick={analyzeHelperUrl} type="button">Analyze</button>
              </div>

              <label className="helper-drop-zone">
                <input
                  multiple
                  type="file"
                  accept="video/*,image/*,audio/*,.pdf,.txt,.md,.doc,.docx"
                  onChange={(event) => uploadHelperFiles(event.target.files)}
                />
                <strong>Drop / upload references</strong>
                <span>Video, images, audio, scripts, PDFs, style assets</span>
              </label>

              <div className="helper-thread">
                {helperMessages.map((message, index) => (
                  <div className={`helper-message ${message.role}`} key={`${message.role}-${index}`}>
                    <strong>{message.role === "user" ? "You" : message.role === "system" ? "System" : "AI Helper"}</strong>
                    <p>{message.text}</p>
                  </div>
                ))}
                {helperBusy ? (
                  <div className="helper-message system">
                    <strong>System</strong>
                    <p>Working...</p>
                  </div>
                ) : null}
              </div>

              <div className="helper-composer">
                <textarea
                  value={helperInput}
                  onChange={(event) => setHelperInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      sendHelperMessage();
                    }
                  }}
                  placeholder="Talk to the helper about your movie, prompt, upload, provider, or output..."
                />
                <div className="helper-actions">
                  <button className={recording ? "recording" : ""} onClick={recording ? stopVoiceRecording : startVoiceRecording} type="button">
                    {recording ? "Stop" : "Mic"}
                  </button>
                  <button className={speakBack ? "active" : ""} onClick={() => setSpeakBack((value) => !value)} type="button">
                    Speak
                  </button>
                  <button disabled={helperBusy} onClick={() => sendHelperMessage()} type="button">
                    Send
                  </button>
                </div>
              </div>
            </aside>
          </section>
        </section>
      </div>
    </main>
  );
}
