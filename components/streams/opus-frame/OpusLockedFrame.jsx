"use client";

import { useEffect, useMemo, useState } from "react";
import "./opus-locked-frame.css";

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
            <div>
              <h1>{stage === "generate" ? "Good evening, Creator 👋" : resultStatusLabel()}</h1>
              <p>{stage === "generate" ? "Advanced movie production controls wrapped around the large center preview." : "Review the real output state, iterate, or open the semantic editor when analysis is available."}</p>
            </div>
            <div className="account-cluster">
              <span className="status-dot">● SYSTEM ONLINE</span>
              <button type="button">Credits: 2,450</button>
              <button className="upgrade" type="button">Upgrade</button>
              <button onClick={() => setHelperOpen(true)} type="button">AI Helper</button>
            </div>
          </header>

          {stage === "generate" ? (
            <GenerateWorkspace
              activeType={activeType}
              activeTypeId={activeTypeId}
              setActiveTypeId={setActiveTypeId}
              mode={mode}
              setMode={setMode}
              fields={fields}
              setField={setField}
              provider={provider}
              setProvider={setProvider}
              status={status}
              generateNow={generateNow}
              isGenerating={isGenerating}
              askHelper={askHelper}
            />
          ) : (
            <ResultWorkspace
              activeType={activeType}
              fields={fields}
              status={status}
              outputUrl={outputUrl}
              jobResult={jobResult}
              setStage={setStage}
              generateNow={generateNow}
              isGenerating={isGenerating}
              openOutputEditor={openOutputEditor}
              analysisId={analysisId}
            />
          )}
        </section>

        <aside className="right-utility-rail">
          <section className="utility-card quick">
            <h3>Quick Actions</h3>
            <button type="button" onClick={() => setStage("generate")}>＋ New Project <span>Start from scratch</span></button>
            <button type="button">▣ Use Template <span>Browse presets</span></button>
            <button type="button" onClick={() => setHelperOpen(true)}>✦ AI Assistant <span>Get help & ideas</span></button>
            <button type="button">⇧ Upload Assets <span>Images, videos, audio</span></button>
          </section>

          <section className="utility-card system">
            <h3>System Status</h3>
            <div className="green-status">All Systems Operational <b>●</b></div>
            <p>Render Queue <span>1 Rendering · 2 Queued</span></p>
            <p>Storage <span>2.4 TB / 8 TB</span></p>
            <div className="usage-bar"><i /></div>
          </section>

          <section className="utility-card recent">
            <h3>Recent Projects</h3>
            {referenceFrames.slice(0, 4).map((image, index) => (
              <div className="recent-row" key={image}>
                <img src={image} alt="" />
                <div><strong>{["Cyberpunk City Teaser", "Product Launch Video", "Travel Vlog Intro", "Brand Rebuild 2024"][index]}</strong><span>Edited {index + 1}h ago</span></div>
              </div>
            ))}
          </section>
        </aside>

        {helperOpen ? (
          <div className="helper-backdrop" onClick={() => setHelperOpen(false)}>
            <aside className="helper-panel" onClick={(event) => event.stopPropagation()}>
              <div className="helper-head">
                <div><h3>AI Helper / Analyzer</h3><p>Proof prompts, inspect provider fit, and guide output edits.</p></div>
                <button onClick={() => setHelperOpen(false)} type="button">×</button>
              </div>
              <div className="helper-thread">
                {helperMessages.map((message, index) => (
                  <div className={`helper-message ${message.role}`} key={`${message.role}-${index}`}>
                    <strong>{message.role === "user" ? "You" : message.role === "system" ? "System" : "AI Helper"}</strong>
                    <p>{message.text}</p>
                  </div>
                ))}
                {helperBusy ? <div className="helper-message system"><strong>System</strong><p>Working…</p></div> : null}
              </div>
              <textarea value={helperInput} onChange={(event) => setHelperInput(event.target.value)} placeholder="Ask for prompt proofing, provider routing, or output edit guidance…" />
              <div className="helper-actions">
                <button onClick={() => askHelper("Proof my current prompt and advanced movie production settings before generation.")} type="button">Proof Prompt</button>
                <button disabled={helperBusy} onClick={() => askHelper()} type="button">Send</button>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function GenerateWorkspace({ activeType, activeTypeId, setActiveTypeId, mode, setMode, fields, setField, provider, setProvider, status, generateNow, isGenerating, askHelper }) {
  return (
    <div className="movie-generate-state">
      <section className="compact-prompt-top">
        <div className="mode-row generation-modes">
          {["smart", "advanced", "assistant"].map((item) => (
            <button className={`mode ${mode === item ? "active" : ""}`} key={item} onClick={() => (item === "assistant" ? askHelper("Help me improve this movie generation setup.") : setMode(item))} type="button">
              {item === "smart" ? "⚡ Smart Mode" : item === "advanced" ? "✦ Advanced Mode" : "✨ AI Assistant"}
            </button>
          ))}
        </div>

        <div className="prompt-and-cards">
          <label className="wide-prompt-field">
            <span>Describe what you want to create…</span>
            <textarea value={fields.mainPrompt} onChange={(event) => setField("mainPrompt", event.target.value)} />
            <b>{fields.mainPrompt.length} / 2000</b>
          </label>
          <div className="prompt-chip-row">
            <button type="button">Add Media</button>
            <button type="button">16:9</button>
            <button type="button">Voice</button>
            <button onClick={() => askHelper("Analyze my prompt and suggest improvements.")} type="button">AI Analyze</button>
            <button type="button">Style</button>
            <button className="generate-cta" disabled={isGenerating} onClick={generateNow} type="button">{isGenerating ? "Submitting…" : "Generate ✨"}</button>
          </div>
        </div>

        <div className="create-type-strip compact">
          {createTypes.map((item) => (
            <button className={`create-type-card ${item.accent} ${item.id === activeTypeId ? "active" : ""}`} key={item.id} onClick={() => setActiveTypeId(item.id)} type="button">
              <span>{item.icon}</span>
              <strong>{item.title}</strong>
              <small>{item.kind}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="movie-production-stage">
        <aside className="production-column left-prod">
          <ProductionCard title="1. Scene" value={fields.scene} onChange={(value) => setField("scene", value)} textarea />
          <ProductionCard title="2. Subject" value={fields.subject} onChange={(value) => setField("subject", value)} textarea />
          <ProductionCard title="3. Environment" value={fields.environment} onChange={(value) => setField("environment", value)} textarea />
          <ProductionCard title="4. Emotional Intent" value={fields.emotionalIntent} onChange={(value) => setField("emotionalIntent", value)} textarea />
          <ProductionCard title="5. Mood" value={fields.mood} onChange={(value) => setField("mood", value)} />
        </aside>

        <div className="center-preview-stack">
          <div className="preview-toolbar">
            <div><strong>{activeType.title}</strong><span>{status}</span></div>
            <div><button type="button">Raw</button><button className="active" type="button">Preview</button><button type="button">Fit</button><button type="button">Grid</button></div>
          </div>
          <div className="large-center-preview">
            <img src={referencePreview} alt="Movie generation concept preview" />
            <div className="analysis-float-card">
              <strong>AI Production Setup</strong>
              <p>Scene, camera, lighting, motion, and output are editable around this preview before generation.</p>
              <button onClick={() => askHelper("Review the current production setup around the preview.")} type="button">Review Setup</button>
            </div>
            <div className="preview-controls"><b>▶</b><span>0:00 / 0:{String(fields.duration || 8).padStart(2, "0")}</span><i /><em>CC</em><em>1x</em><em>⛶</em></div>
          </div>
          <div className="mini-keyframes-row">
            {referenceFrames.map((image, index) => (
              <button className={index === 0 ? "active" : ""} key={image} type="button"><img src={image} alt="" /><span>{index}s</span></button>
            ))}
          </div>
        </div>

        <aside className="production-column right-prod">
          <ProductionGroup title="6. Camera" fields={fields} setField={setField} keys={["shotType", "cameraPosition", "cameraMovement", "lens", "depthOfField", "composition"]} />
          <ProductionGroup title="7. Lighting" fields={fields} setField={setField} keys={["primaryLighting", "accentLighting", "rimLight", "atmosphere"]} />
          <ProductionGroup title="8. Motion" fields={fields} setField={setField} keys={["characterMotion", "environmentMotion", "motionQuality"]} />
          <ProductionGroup title="9. Style" fields={fields} setField={setField} keys={["visualStyle", "filmReference", "productionDesign", "humanRealism"]} />
        </aside>
      </section>

      <section className="movie-output-band">
        <div className="negative-card">
          <strong>10. Negative Prompt / Restrictions</strong>
          <textarea value={fields.negativePrompt} onChange={(event) => setField("negativePrompt", event.target.value)} />
        </div>
        <div className="output-card">
          <strong>11. Output Settings</strong>
          <div className="output-inline-fields">
            <label><span>Provider</span><select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="openai">OpenAI</option><option value="fal">fal.ai</option><option value="runway">Runway</option><option value="kling">Kling</option><option value="veo">Veo</option><option value="elevenlabs">ElevenLabs</option></select></label>
            <label><span>Duration</span><input value={fields.duration} onChange={(event) => setField("duration", event.target.value)} /></label>
            <label><span>Aspect</span><input value={fields.aspectRatio} onChange={(event) => setField("aspectRatio", event.target.value)} /></label>
            <label><span>Frame Rate</span><input value={fields.frameRate} onChange={(event) => setField("frameRate", event.target.value)} /></label>
            <label><span>Quality</span><input value={fields.qualityGoal} onChange={(event) => setField("qualityGoal", event.target.value)} /></label>
            <button disabled={isGenerating} onClick={generateNow} type="button">{isGenerating ? "Submitting…" : "Generate Video ✨"}</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProductionCard({ title, value, onChange, textarea = false }) {
  return (
    <label className="production-card">
      <span>{title}</span>
      {textarea ? <textarea value={value} onChange={(event) => onChange(event.target.value)} /> : <input value={value} onChange={(event) => onChange(event.target.value)} />}
    </label>
  );
}

function ProductionGroup({ title, fields, setField, keys }) {
  return (
    <section className="production-group-card">
      <strong>{title}</strong>
      <div>
        {keys.map((key) => (
          <label key={key}>
            <span>{key.replace(/([A-Z])/g, " $1")}</span>
            <input value={fields[key]} onChange={(event) => setField(key, event.target.value)} />
          </label>
        ))}
      </div>
    </section>
  );
}

function ResultWorkspace({ activeType, fields, status, outputUrl, jobResult, setStage, generateNow, isGenerating, openOutputEditor, analysisId }) {
  const hasRealOutput = Boolean(outputUrl);
  return (
    <div className="result-state-grid tighter">
      <section className="result-main-card tighter">
        <div className="result-action-bar">
          <div><strong>{hasRealOutput ? "✅ Generated Video Ready" : "🟡 Generation Request Saved"}</strong><span>{fields.duration}s · {fields.aspectRatio} · {fields.frameRate} · {status}</span></div>
          <div>
            <button disabled={!hasRealOutput} type="button">Download</button>
            <button disabled={isGenerating} onClick={generateNow} type="button">Regenerate</button>
            <button disabled={isGenerating} onClick={generateNow} type="button">Create Variation</button>
            <button onClick={() => setStage("generate")} type="button">Edit Prompt</button>
            <button disabled={!hasRealOutput} type="button">Export</button>
            <button className="primary" onClick={openOutputEditor} type="button">Open Output Editor</button>
          </div>
        </div>

        <div className={`output-player ${hasRealOutput ? "ready" : "blocked"}`}>
          {hasRealOutput ? (
            outputUrl.match(/\.(mp4|webm|mov)(\?|$)/i) ? <video src={outputUrl} controls playsInline /> : <img src={outputUrl} alt="Generated output" />
          ) : (
            <div className="no-output-state compact">
              <strong>No real output file returned yet</strong>
              <p>The job request is saved. This screen will not show a fake generated video.</p>
              <code>{readable(jobResult) || "Awaiting provider output"}</code>
            </div>
          )}
          <div className="video-controls result-controls"><b>▶</b><span>0:00 / 0:{String(fields.duration || 8).padStart(2, "0")}</span><i /><em>CC</em><em>1x</em><em>⛶</em></div>
        </div>

        <div className="result-keyframes">
          <div><strong>Timeline / Keyframes</strong><span>{hasRealOutput ? "Output frames available after analyzer extraction" : "Pending real output/analyzer"}</span></div>
          <div className="keyframe-row compact">
            {(hasRealOutput ? referenceFrames : Array.from({ length: 6 })).map((item, index) => (
              <div className={`keyframe ${index === 0 ? "active" : ""} ${!hasRealOutput ? "empty" : ""}`} key={index}>
                {hasRealOutput ? <img src={item} alt="" /> : <span>pending</span>}
                <small>{index}s</small>
              </div>
            ))}
          </div>
        </div>

        <div className="result-lower-grid tighter">
          <div className="output-specs"><strong>Output Specs</strong><p>Duration <span>{fields.duration}s</span></p><p>Format <span>{hasRealOutput ? "Provider output" : "Pending"}</span></p><p>Resolution <span>{fields.aspectRatio}</span></p><p>Quality <span>{fields.qualityGoal}</span></p></div>
          <div className="iteration-tools"><strong>Iteration Tools</strong><div><button type="button">Create Variation</button><button type="button">Extend Video</button><button type="button">Reframe Shot</button><button type="button" onClick={() => setStage("generate")}>Edit with Prompt</button></div></div>
        </div>

        <div className="related-output-row">
          {referenceFrames.slice(0, 5).map((image, index) => (
            <button key={image} type="button"><img src={image} alt="" /><span>{index === 0 ? "Version 2 (Current)" : index === 4 ? "+2 More Versions" : `Variation ${index}`}</span><small>{fields.duration}s · {fields.aspectRatio}</small></button>
          ))}
        </div>
      </section>

      <aside className="result-summary-rail tighter">
        <SummaryCard title="Generation Summary" text={hasRealOutput ? "A generated output is available. Review, export, or open the semantic output editor." : "Request saved. Real provider output has not returned yet."} />
        <SummaryCard title="Prompt Snapshot" text={fields.mainPrompt} />
        <SummaryCard title="Camera Settings Summary" text={`${fields.cameraMovement} · ${fields.shotType} · ${fields.lens} · ${fields.depthOfField}`} />
        <SummaryCard title="Generation Details" text={`Provider route: ${activeType.provider}. Analysis ID: ${analysisId || "not available"}. Version: pending real output/analyzer.`} />
      </aside>
    </div>
  );
}

function SummaryCard({ title, text }) {
  return <section className="summary-card"><h3>{title}</h3><p>{text}</p></section>;
}
