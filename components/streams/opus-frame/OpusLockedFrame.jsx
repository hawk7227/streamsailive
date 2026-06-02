"use client";

import { useEffect, useState } from "react";
import "./opus-locked-frame.css";
import "./opus-layout-unclipped.css";

const DEFAULT_PROJECT_ID = "fb7bf446-78c9-4905-80bc-32a19d0f9803";

const createTypes = [
  { id: "text-to-image", title: "Text to Image", icon: "🖼️", kind: "image", provider: "openai", ratio: "1:1" },
  { id: "image-to-video", title: "Image to Video", icon: "🎞️", kind: "image-to-video", provider: "fal", ratio: "16:9" },
  { id: "text-to-video", title: "Text to Video", icon: "🎬", kind: "text-to-video", provider: "fal", ratio: "16:9" },
  { id: "voice-captions", title: "Voice & Captions", icon: "🎙️", kind: "voice", provider: "elevenlabs", ratio: "N/A" },
  { id: "snap-pick-click", title: "Snap Pic Click", icon: "📸", kind: "snap-pick-click", provider: "fal", ratio: "9:16" },
  { id: "motion-graphics", title: "Motion Graphics", icon: "🔷", kind: "motion", provider: "fal", ratio: "16:9" },
  { id: "ai-writers", title: "AI Writers", icon: "📄", kind: "launch", provider: "openai", ratio: "N/A" },
  { id: "idea-launch", title: "Idea to Launch", icon: "🚀", kind: "launch", provider: "openai", ratio: "16:9" },
];

function initialFields() {
  return {
    mainPrompt: "A vast futuristic city at night, neon lights reflecting on wet streets, flying vehicles crossing between towering skyscrapers, light rain, cinematic establishing shot, ultra realistic, dramatic atmosphere.",
    scene: "Sprawling cyberpunk metropolis in the rain. Deep perspective, layered skyline, volumetric haze, wet reflective streets.",
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
    negativePrompt: "low quality, blurry, noisy, overexposed, poor anatomy, deformed, ugly, text, watermark, logo, extra limbs, duplicate, cartoon, anime, CGI",
    duration: "6",
    aspectRatio: "16:9",
    frameRate: "24 fps",
    qualityGoal: "High (Best Quality)",
    projectId: DEFAULT_PROJECT_ID,
  };
}

function readable(data) {
  if (!data) return "";
  if (typeof data === "string") return data;
  const value = data.result?.status || data.result?.blockedReason || data.status || data.error || data.message;
  if (value) return String(value);
  try {
    return JSON.stringify(data).slice(0, 500);
  } catch {
    return "Response returned without readable text.";
  }
}

function findOutputUrl(data) {
  return String(data?.outputUrl || data?.videoUrl || data?.assetUrl || data?.result?.outputUrl || data?.result?.result?.outputUrl || "");
}

function findAnalysisId(data) {
  return String(data?.analysisId || data?.analysis?.id || data?.result?.analysisId || data?.result?.analysis?.id || "");
}

export default function OpusLockedFrame() {
  const [activeTypeId, setActiveTypeId] = useState("image-to-video");
  const [fields, setFields] = useState(initialFields);
  const [provider, setProvider] = useState("fal");
  const [mode, setMode] = useState("advanced");
  const [stage, setStage] = useState("generate");
  const [sourceUrl, setSourceUrl] = useState("");

  useEffect(() => {
    let cancelled = false;

    function applyBoxReset(node) {
      Object.assign(node.style, {
        position: "relative",
        inset: "auto",
        left: "auto",
        right: "auto",
        top: "auto",
        bottom: "auto",
        width: "100%",
        maxWidth: "none",
        maxHeight: "none",
        margin: "0",
        zIndex: "1",
        transform: "none",
        overflow: "visible",
      });
    }

    function moveAnalyzerPanelsIntoPreviewSlot() {
      if (cancelled) return;

      const slot = document.getElementById("streams-preview-analyzer-slot");
      if (!slot) return;

      const nodes = Array.from(document.querySelectorAll("section, aside, div"));

      const standalonePanel = nodes.find((node) => {
        if (node.closest("#streams-preview-analyzer-slot")) return false;
        if (node.closest("[data-streams-analyzer-edit-rail]")) return false;
        const text = node.textContent || "";
        return text.includes("STANDALONE ANALYZER") && text.includes("Reference + Video Mode");
      });

      if (standalonePanel) {
        standalonePanel.setAttribute("data-standalone-analyzer", "true");
        applyBoxReset(standalonePanel);
        if (standalonePanel.parentElement !== slot) slot.appendChild(standalonePanel);
      }

      const railHost = document.querySelector("[data-streams-analyzer-edit-rail]");
      if (railHost) {
        applyBoxReset(railHost);
        const railPanel = railHost.firstElementChild;
        if (railPanel) applyBoxReset(railPanel);
        if (railHost.parentElement !== slot) slot.appendChild(railHost);
      }
    }

    const timers = [0, 100, 300, 700, 1200, 2000, 3500].map((delay) =>
      window.setTimeout(moveAnalyzerPanelsIntoPreviewSlot, delay)
    );

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [stage]);


  useEffect(() => {
    let cancelled = false;

    function normalizeAnalyzerPlacement() {
      if (cancelled) return;

      const previewStack = document.querySelector(".center-preview-stack");
      if (!previewStack) return;

      const keyframes = previewStack.querySelector(".mini-keyframes-row");
      const allNodes = Array.from(document.querySelectorAll("section, aside, div"));

      const standalonePanel = allNodes.find((node) => {
        if (node.closest(".center-preview-stack")) return false;
        if (node.closest("[data-streams-analyzer-edit-rail]")) return false;
        const text = node.textContent || "";
        return text.includes("STANDALONE ANALYZER") && text.includes("Reference + Video Mode");
      });

      if (standalonePanel) {
        standalonePanel.setAttribute("data-standalone-analyzer", "true");
        Object.assign(standalonePanel.style, {
          position: "relative",
          inset: "auto",
          left: "auto",
          right: "auto",
          top: "auto",
          bottom: "auto",
          width: "100%",
          maxWidth: "none",
          margin: "16px 0 0 0",
          zIndex: "1",
          transform: "none",
        });

        if (standalonePanel.parentElement !== previewStack) {
          if (keyframes) previewStack.insertBefore(standalonePanel, keyframes);
          else previewStack.appendChild(standalonePanel);
        }
      }

      const railHost = document.querySelector("[data-streams-analyzer-edit-rail]");
      if (railHost) {
        Object.assign(railHost.style, {
          position: "relative",
          inset: "auto",
          left: "auto",
          right: "auto",
          top: "auto",
          bottom: "auto",
          width: "100%",
          maxWidth: "none",
          margin: "16px 0 0 0",
          zIndex: "1",
          transform: "none",
          overflow: "visible",
        });

        const railPanel = railHost.firstElementChild;
        if (railPanel) {
          Object.assign(railPanel.style, {
            position: "relative",
            inset: "auto",
            left: "auto",
            right: "auto",
            top: "auto",
            bottom: "auto",
            width: "100%",
            maxWidth: "none",
            maxHeight: "none",
            margin: "0",
            zIndex: "1",
            transform: "none",
            overflow: "visible",
          });
        }

        if (railHost.parentElement !== previewStack) {
          if (keyframes) previewStack.insertBefore(railHost, keyframes);
          else previewStack.appendChild(railHost);
        }
      }
    }

    const timers = [0, 150, 500, 1000, 2000].map((delay) =>
      window.setTimeout(normalizeAnalyzerPlacement, delay)
    );

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [stage]);


  const [analysisId, setAnalysisId] = useState("");
  const [jobResult, setJobResult] = useState(null);
  const [outputUrl, setOutputUrl] = useState("");
  const [status, setStatus] = useState("Ready");
  const [isGenerating, setIsGenerating] = useState(false);
  const [helperOpen, setHelperOpen] = useState(false);
  const [helperMessages, setHelperMessages] = useState(["AI Helper ready."]);

  const activeType = createTypes.find((item) => item.id === activeTypeId) || createTypes[1];

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
          prompt: buildPrompt(),
          aspectRatio: fields.aspectRatio === "N/A" ? undefined : fields.aspectRatio,
          duration: fields.duration === "N/A" ? undefined : `${fields.duration}s`,
          metadata: { source: "compact-movie-production-workspace", createType: activeType.id, mode, fields },
        }),
      });
      const data = await response.json().catch(() => null);
      setJobResult(data);
      setOutputUrl(findOutputUrl(data));
      const nextAnalysisId = findAnalysisId(data);
      if (nextAnalysisId) setAnalysisId(nextAnalysisId);
      setStage("result");
      setStatus(response.ok ? "Generation request submitted." : "Generation blocked/error.");
      setHelperMessages((items) => [...items, `Generation result: ${readable(data)}`].slice(-8));
    } catch (error) {
      setStatus("Generation failed.");
      setHelperMessages((items) => [...items, `Generation failed: ${error instanceof Error ? error.message : String(error)}`].slice(-8));
    } finally {
      setIsGenerating(false);
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
      setStatus(response.ok ? "Source analyzed." : "Source analyzer blocked/error.");
      setHelperMessages((items) => [...items, `Source analysis: ${readable(data)}`].slice(-8));
    } catch (error) {
      setStatus("Source analysis failed.");
      setHelperMessages((items) => [...items, `Source analysis failed: ${error instanceof Error ? error.message : String(error)}`].slice(-8));
    }
  }

  function openOutputEditor() {
    if (!analysisId) {
      setStatus("Output editor needs a real analysis ID. Analyze the video/link first.");
      return;
    }
    window.dispatchEvent(new CustomEvent("streams:analysis-loaded", { detail: { analysisId } }));
    setStatus("Opened analyzer output editor.");
  }

  return (
    <main className="opus-fit-shell">
      <div className="opus-board">
        <aside className="opus-left">
          <div className="opus-logo-row"><div className="streams-logo-mark">◆</div><div><div className="opus-logo-title">STREAMS</div><div className="opus-logo-sub">AI Video Control Room</div></div></div>
          <nav className="opus-nav">{["Home", "Projects", "Generate", "Assets", "Analytics", "Settings"].map((item, index) => <button className={`opus-nav-item ${index === 0 ? "active" : ""}`} key={item} type="button"><span>{index === 0 ? "⌂" : "▧"}</span><strong>{item}</strong></button>)}</nav>
          <div className="left-plan-card"><small>PLAN</small><strong>Pro Plan</strong><span>Credits 2,450 / 5,000</span><i><b /></i></div>
          <div className="left-source-card"><strong>Source / Reference</strong><div className="source-actions"><button type="button">Import File</button><button type="button">YouTube Link</button></div><input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="Paste video or reference link" /><button onClick={analyzeSourceUrl} type="button">Analyze Link</button><small>{analysisId ? `Analysis ${analysisId.slice(0, 8)}…` : "No analysis loaded"}</small></div>
        </aside>

        <section className="opus-main compact-shell">
          <header className="workspace-topbar"><div><h1>{stage === "generate" ? "Good evening, Creator 👋" : outputUrl ? "Generated Video Ready" : "Request Saved / Output Pending"}</h1><p>Advanced movie production controls wrapped around the large center preview.</p></div><div className="account-cluster"><span className="status-dot">● SYSTEM ONLINE</span><button type="button">Credits: 2,450</button><button className="upgrade" type="button">Upgrade</button><button onClick={() => setHelperOpen(true)} type="button">AI Helper</button></div></header>

          {stage === "generate" ? (
            <div className="movie-generate-state">
              <section className="compact-prompt-top"><div className="mode-row generation-modes">{["smart", "advanced", "assistant"].map((item) => <button className={`mode ${mode === item ? "active" : ""}`} key={item} onClick={() => item === "assistant" ? setHelperOpen(true) : setMode(item)} type="button">{item === "smart" ? "⚡ Smart Mode" : item === "advanced" ? "✦ Advanced Mode" : "✨ AI Assistant"}</button>)}</div><div className="prompt-and-cards"><label className="wide-prompt-field"><span>Describe what you want to create…</span><textarea value={fields.mainPrompt} onChange={(event) => setField("mainPrompt", event.target.value)} /><b>{fields.mainPrompt.length} / 2000</b></label><div className="prompt-chip-row"><button type="button">Add Media</button><button type="button" onClick={() => setField("aspectRatio", "16:9")}>16:9</button><button type="button">Voice</button><button onClick={() => setHelperOpen(true)} type="button">AI Analyze</button><button type="button">Style</button><button className="generate-cta" disabled={isGenerating} onClick={generateNow} type="button">{isGenerating ? "Submitting…" : "Generate ✨"}</button></div></div><div className="create-type-strip compact">{createTypes.map((item) => <button className={`create-type-card ${item.id === activeTypeId ? "active" : ""}`} key={item.id} onClick={() => { setActiveTypeId(item.id); setProvider(item.provider); setField("aspectRatio", item.ratio); }} type="button"><span>{item.icon}</span><strong>{item.title}</strong><small>{item.kind}</small></button>)}</div></section>

              <section className="movie-production-stage"><aside className="production-column left-prod"><ProductionCard title="1. Scene" value={fields.scene} onChange={(value) => setField("scene", value)} textarea /><ProductionCard title="2. Subject" value={fields.subject} onChange={(value) => setField("subject", value)} textarea /><ProductionCard title="3. Environment" value={fields.environment} onChange={(value) => setField("environment", value)} textarea /><ProductionCard title="4. Emotional Intent" value={fields.emotionalIntent} onChange={(value) => setField("emotionalIntent", value)} textarea /><ProductionCard title="5. Mood" value={fields.mood} onChange={(value) => setField("mood", value)} /></aside><div className="center-preview-stack"><div className="preview-toolbar"><div><strong>{activeType.title}</strong><span>{status}</span></div><div><button type="button">Raw</button><button className="active" type="button">Preview</button><button type="button">Fit</button><button type="button">Grid</button></div></div><div className="large-center-preview"><div className="analysis-float-card"><strong>AI Production Setup</strong><p>Scene, camera, lighting, motion, and output are editable around this preview before generation.</p><button onClick={() => setHelperOpen(true)} type="button">Review Setup</button></div><div className="preview-controls"><b>▶</b><span>0:00 / 0:{String(fields.duration || 8).padStart(2, "0")}</span><i /><em>CC</em><em>1x</em><em>⛶</em></div></div>
              <div id="streams-preview-analyzer-slot" className="preview-analyzer-slot" />
<div className="mini-keyframes-row">{Array.from({ length: 6 }).map((_, index) => <button className={index === 0 ? "active" : ""} key={index} type="button"><span>{index}s</span></button>)}</div></div><aside className="production-column right-prod"><ProductionGroup title="6. Camera" fields={fields} setField={setField} keys={["shotType", "cameraPosition", "cameraMovement", "lens", "depthOfField", "composition"]} /><ProductionGroup title="7. Lighting" fields={fields} setField={setField} keys={["primaryLighting", "accentLighting", "rimLight", "atmosphere"]} /><ProductionGroup title="8. Motion" fields={fields} setField={setField} keys={["characterMotion", "environmentMotion", "motionQuality"]} /><ProductionGroup title="9. Style" fields={fields} setField={setField} keys={["visualStyle", "filmReference", "productionDesign", "humanRealism"]} /></aside></section>

              <section className="movie-output-band"><div className="negative-card"><strong>10. Negative Prompt / Restrictions</strong><textarea value={fields.negativePrompt} onChange={(event) => setField("negativePrompt", event.target.value)} /></div><div className="output-card"><strong>11. Output Settings</strong><div className="output-inline-fields"><label><span>Provider</span><select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="openai">OpenAI</option><option value="fal">fal.ai</option><option value="runway">Runway</option><option value="kling">Kling</option><option value="veo">Veo</option><option value="elevenlabs">ElevenLabs</option></select></label><label><span>Duration</span><input value={fields.duration} onChange={(event) => setField("duration", event.target.value)} /></label><label><span>Aspect</span><input value={fields.aspectRatio} onChange={(event) => setField("aspectRatio", event.target.value)} /></label><label><span>Frame Rate</span><input value={fields.frameRate} onChange={(event) => setField("frameRate", event.target.value)} /></label><label><span>Quality</span><input value={fields.qualityGoal} onChange={(event) => setField("qualityGoal", event.target.value)} /></label><button disabled={isGenerating} onClick={generateNow} type="button">{isGenerating ? "Submitting…" : "Generate Video ✨"}</button></div></div></section>
            </div>
          ) : (
            <ResultWorkspace fields={fields} status={status} outputUrl={outputUrl} jobResult={jobResult} setStage={setStage} generateNow={generateNow} isGenerating={isGenerating} openOutputEditor={openOutputEditor} />
          )}
        </section>

        <aside className="right-utility-rail"><section className="utility-card quick"><h3>Quick Actions</h3><button type="button" onClick={() => setStage("generate")}>＋ New Project <span>Start from scratch</span></button><button type="button">▣ Use Template <span>Browse presets</span></button><button type="button" onClick={() => setHelperOpen(true)}>✦ AI Assistant <span>Get help & ideas</span></button><button type="button">⇧ Upload Assets <span>Images, videos, audio</span></button></section><section className="utility-card system"><h3>System Status</h3><div className="green-status">All Systems Operational <b>●</b></div><p>Submit Route <span>/api/admingeneration/jobs</span></p><p>Analyzer <span>Mounted</span></p><div className="usage-bar"><i /></div></section><section className="utility-card recent"><h3>Recent Projects</h3><p style={{ color: "#9fb0c8", fontSize: 12 }}>Recent projects load from real records only.</p></section></aside>

        {helperOpen ? <div className="helper-backdrop" onClick={() => setHelperOpen(false)}><aside className="helper-panel" onClick={(event) => event.stopPropagation()}><div className="helper-head"><div><h3>AI Helper / Analyzer</h3><p>Proof prompts, inspect provider fit, and guide output edits.</p></div><button onClick={() => setHelperOpen(false)} type="button">×</button></div><div className="helper-thread">{helperMessages.map((message, index) => <div className="helper-message assistant" key={index}><strong>AI Helper</strong><p>{message}</p></div>)}</div><textarea placeholder="Ask for prompt proofing, provider routing, or output edit guidance…" readOnly value="" /><div className="helper-actions"><button onClick={() => setHelperMessages((items) => [...items, "Prompt proof requested."].slice(-8))} type="button">Proof Prompt</button><button onClick={() => setHelperOpen(false)} type="button">Close</button></div></aside></div> : null}
      </div>
    </main>
  );
}

function ProductionCard({ title, value, onChange, textarea = false }) {
  return <label className="production-card"><span>{title}</span>{textarea ? <textarea value={value} onChange={(event) => onChange(event.target.value)} /> : <input value={value} onChange={(event) => onChange(event.target.value)} />}</label>;
}

function ProductionGroup({ title, fields, setField, keys }) {
  return <section className="production-group-card"><strong>{title}</strong><div>{keys.map((key) => <label key={key}><span>{key.replace(/([A-Z])/g, " $1")}</span><input value={fields[key]} onChange={(event) => setField(key, event.target.value)} /></label>)}</div></section>;
}

function ResultWorkspace({ fields, status, outputUrl, jobResult, setStage, generateNow, isGenerating, openOutputEditor }) {
  const hasRealOutput = Boolean(outputUrl);
  return <div className="result-state-grid tighter"><section className="result-main-card tighter"><div className="result-action-bar"><div><strong>{hasRealOutput ? "✅ Generated Video Ready" : "🟡 Generation Request Saved"}</strong><span>{fields.duration}s · {fields.aspectRatio} · {fields.frameRate} · {status}</span></div><div><button disabled={!hasRealOutput} type="button" onClick={() => outputUrl && window.open(outputUrl, "_blank", "noopener,noreferrer")}>Download</button><button disabled={isGenerating} onClick={generateNow} type="button">Regenerate</button><button disabled={isGenerating} onClick={generateNow} type="button">Create Variation</button><button onClick={() => setStage("generate")} type="button">Edit Prompt</button><button disabled={!hasRealOutput} onClick={openOutputEditor} type="button">Export</button><button className="primary" onClick={openOutputEditor} type="button">Open Output Editor</button></div></div><div className={`output-player ${hasRealOutput ? "ready" : "blocked"}`}>{hasRealOutput ? (outputUrl.match(/\.(mp4|webm|mov)(\?|$)/i) ? <video src={outputUrl} controls playsInline /> : <img src={outputUrl} alt="Generated output" />) : <div className="no-output-state compact"><strong>No real output file returned yet</strong><p>The job request is saved. This screen will not show a fake generated video.</p><code>{readable(jobResult) || "Awaiting provider output"}</code></div>}<div className="video-controls result-controls"><b>▶</b><span>0:00 / 0:{String(fields.duration || 8).padStart(2, "0")}</span><i /><em>CC</em><em>1x</em><em>⛶</em></div></div><div className="result-keyframes"><div><strong>Timeline / Keyframes</strong><span>{hasRealOutput ? "Open Output Editor to load real analyzer frames" : "Pending real output/analyzer"}</span></div><div className="keyframe-row compact">{Array.from({ length: 6 }).map((_, index) => <div className="keyframe empty" key={index}><span>{hasRealOutput ? "analyze" : "pending"}</span><small>{index}s</small></div>)}</div></div><div className="result-lower-grid tighter"><div className="output-specs"><strong>Output Specs</strong><p>Duration <span>{fields.duration}s</span></p><p>Format <span>{hasRealOutput ? "Provider output" : "Pending"}</span></p><p>Resolution <span>{fields.aspectRatio}</span></p><p>Quality <span>{fields.qualityGoal}</span></p></div><div className="iteration-tools"><strong>Iteration Tools</strong><div><button type="button" disabled={isGenerating} onClick={generateNow}>Create Variation</button><button type="button">Extend Video</button><button type="button">Reframe Shot</button><button type="button" onClick={() => setStage("generate")}>Edit with Prompt</button></div></div></div><div className="related-output-row"><button type="button" onClick={openOutputEditor}><span>Real Versions / Related Outputs</span><small>Open Output Editor to load saved versions.</small></button></div></section><aside className="result-summary-rail tighter"><SummaryCard title="Generation Summary" text={hasRealOutput ? "A generated output is available." : "Request saved. Real provider output has not returned yet."} /><SummaryCard title="Prompt Snapshot" text={fields.mainPrompt} /><SummaryCard title="Camera Settings Summary" text={`${fields.cameraMovement} · ${fields.shotType} · ${fields.lens}`} /></aside></div>;
}

function SummaryCard({ title, text }) {
  return <section className="summary-card"><h3>{title}</h3><p>{text}</p></section>;
}
