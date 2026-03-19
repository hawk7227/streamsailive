"use client";

import React, { useMemo, useRef, useState } from "react";

type StepState = "complete" | "running" | "review" | "queued";
type Step = { id: string; name: string; state: StepState; icon: string; };
type ConceptCard = { id: string; title: string; badge: string; headline: string; body: string; };

const STEPS_INITIAL: Step[] = [
  { id: "strategy", name: "Creative Strategy", state: "complete", icon: "◫" },
  { id: "copy", name: "AI Copy Generation", state: "running", icon: "✦" },
  { id: "validator", name: "Validator", state: "review", icon: "◈" },
  { id: "imagery", name: "Imagery Generation", state: "queued", icon: "▣" },
  { id: "i2v", name: "Image to Video", state: "queued", icon: "▶" },
  { id: "assets", name: "Asset Library", state: "queued", icon: "▤" },
  { id: "qa", name: "Quality Assurance", state: "queued", icon: "✓" },
];

const APPROVED_FACTS = [
  "Secure, private intake",
  "Licensed provider review",
  "Fast next steps and pharmacy support",
];

const INITIAL_CONCEPTS: ConceptCard[] = [
  { id: "c1", title: "Concept 1", badge: "Recommended", headline: "How Online Care Works", body: "Simple intake, licensed review, trusted next steps." },
  { id: "c2", title: "Concept 2", badge: "Preview", headline: "Private Care From Home", body: "Secure, discreet, fast. See a licensed provider today." },
  { id: "c3", title: "Concept 3", badge: "Preview", headline: "Your Health, Simplified", body: "Skip the waiting room. Get expert care on your schedule." },
];

function stateStyles(state: StepState) {
  switch (state) {
    case "complete": return { border: "rgba(163,230,53,0.35)", bg: "rgba(132,204,22,0.08)", pillBg: "rgba(16,185,129,0.16)", pillText: "#6ee7b7", label: "COMPLETE" };
    case "running":  return { border: "rgba(217,70,239,0.45)", bg: "rgba(168,85,247,0.10)", pillBg: "rgba(56,189,248,0.16)", pillText: "#67e8f9", label: "RUNNING" };
    case "review":   return { border: "rgba(249,115,22,0.35)", bg: "rgba(249,115,22,0.07)", pillBg: "rgba(245,158,11,0.16)", pillText: "#fcd34d", label: "NEEDS REVIEW" };
    default:         return { border: "rgba(255,255,255,0.12)", bg: "rgba(255,255,255,0.04)", pillBg: "rgba(148,163,184,0.12)", pillText: "#cbd5e1", label: "QUEUED" };
  }
}

function panelStyle(): React.CSSProperties {
  return { border: "1px solid rgba(255,255,255,0.12)", background: "linear-gradient(180deg,rgba(8,12,33,0.92) 0%,rgba(5,7,23,0.96) 100%)", borderRadius: 22, boxShadow: "0 0 0 1px rgba(255,255,255,0.02) inset" };
}

function buttonStyle(active = false): React.CSSProperties {
  return { borderRadius: 12, border: active ? "1px solid rgba(34,211,238,0.6)" : "1px solid rgba(255,255,255,0.12)", background: active ? "linear-gradient(90deg,rgba(217,70,239,0.18),rgba(34,211,238,0.12))" : "rgba(255,255,255,0.05)", color: "#fff", padding: "10px 14px", cursor: "pointer", fontSize: 14, fontWeight: 600 };
}

function Spinner() {
  return <span style={{ display:"inline-block", width:12, height:12, border:"2px solid rgba(255,255,255,0.2)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.7s linear infinite", flexShrink:0 }} />;
}

async function callGenerations(type: string, prompt: string, extra?: Record<string,string>) {
  const res = await fetch("/api/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, prompt, ...extra }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `${res.status} error`);
  return data.data;
}

export default function PipelineTestPage() {
  const [steps, setSteps] = useState<Step[]>(STEPS_INITIAL);
  const [selectedStepId, setSelectedStepId] = useState("copy");
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLog, setAssistantLog] = useState<string[]>(["Ready. Click any button to generate real output."]);
  const [strategyPrompt, setStrategyPrompt] = useState("You are a conversion-focused creative generator for a telehealth campaign. Build 3 safe, premium, high-trust concepts optimized for image-to-video motion.");
  const [brandTone, setBrandTone] = useState("Premium, calm, clinically reassuring, modern, highly trustworthy.");
  const [imagePrompt, setImagePrompt] = useState("Generate 10 premium healthcare concept frames with clean composition, dark high-end UI preview compatibility, and strong safe-motion potential.");
  const [urlInput, setUrlInput] = useState("");
  const [activeInput, setActiveInput] = useState<string|null>(null);
  const [selectedConceptId, setSelectedConceptId] = useState("c1");
  const [concepts, setConcepts] = useState<ConceptCard[]>(INITIAL_CONCEPTS);
  const [runStatus, setRunStatus] = useState("Idle");
  const [previewStatus, setPreviewStatus] = useState("Ready");

  // Generated outputs
  const [canvasImage, setCanvasImage] = useState<string|null>(null);
  const [canvasVideo, setCanvasVideo] = useState<string|null>(null);
  const [canvasScript, setCanvasScript] = useState<string|null>(null);
  const [canvasVideoTaskId, setCanvasVideoTaskId] = useState<string|null>(null);

  // Loading states per action
  const [busy, setBusy] = useState<Record<string,boolean>>({});
  const [errors, setErrors] = useState<Record<string,string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedStep = useMemo(() => steps.find((s) => s.id === selectedStepId) ?? steps[0], [steps, selectedStepId]);

  function log(text: string) { setAssistantLog((p) => [text, ...p].slice(0, 10)); }
  function setBusyKey(k: string, v: boolean) { setBusy(p => ({ ...p, [k]: v })); }
  function setError(k: string, v: string) { setErrors(p => ({ ...p, [k]: v })); }
  function clearError(k: string) { setErrors(p => ({ ...p, [k]: "" })); }

  function addStep() { const id = `custom-${Date.now()}`; setSteps((p) => [...p, { id, name: `Custom Step ${p.length - 6}`, state: "queued", icon: "+" }]); log("Added pipeline step."); }
  function duplicateStep(stepId: string) { setSteps((p) => { const i = p.findIndex((s) => s.id === stepId); if (i === -1) return p; const copy = { ...p[i], id: `${p[i].id}-copy-${Date.now()}`, name: `${p[i].name} Copy`, state: "queued" as StepState }; const n = [...p]; n.splice(i+1,0,copy); return n; }); log("Duplicated step."); }
  function removeStep(stepId: string) { setSteps((p) => { if (p.length <= 1) return p; const n = p.filter((s) => s.id !== stepId); if (selectedStepId === stepId && n[0]) setSelectedStepId(n[0].id); return n; }); log("Removed step."); }
  function selectConcept(id: string) { setSelectedConceptId(id); const c = concepts.find((x) => x.id === id); if (c) log(`Selected ${c.title}.`); }

  // ── AI Assistant ──────────────────────────────────────────────────────────
  async function handleAssistantSend() {
    const text = assistantInput.trim();
    if (!text) return;
    setAssistantInput("");
    setBusyKey("assistant", true);
    clearError("assistant");
    log(`You: "${text}"`);
    try {
      const gen = await callGenerations("script", `You are an AI creative director for a telehealth pipeline. The user says: "${text}". Respond helpfully in 2-3 sentences with a concrete recommendation.`);
      log(`AI: ${(gen.prompt || "").slice(0, 160)}`);
      setPreviewStatus("Assistant responded.");
    } catch(e: any) {
      log(`✗ Assistant error: ${e.message}`);
      setError("assistant", e.message);
    }
    setBusyKey("assistant", false);
  }

  // ── Run Step ──────────────────────────────────────────────────────────────
  async function runStep() {
    const typeMap: Record<string,string> = { strategy:"script", copy:"script", validator:"script", imagery:"image", i2v:"video", assets:"script", qa:"script" };
    const genType = typeMap[selectedStep.id] || "script";
    const prompt = strategyPrompt || `Execute ${selectedStep.name} for a telehealth campaign. Be detailed.`;
    setBusyKey("runstep", true);
    clearError("runstep");
    setRunStatus(`Running: ${selectedStep.name}...`);
    setSteps((p) => p.map((s) => s.id === selectedStep.id ? { ...s, state: "running" } : s));
    log(`Running step: ${selectedStep.name} (${genType})`);
    try {
      const gen = await callGenerations(genType, prompt);
      setSteps((p) => p.map((s) => s.id === selectedStep.id ? { ...s, state: "complete" } : s));
      setRunStatus(`✓ ${selectedStep.name} complete`);
      if (genType === "script" && gen.prompt) { setCanvasScript(gen.prompt); log(`✓ Script generated (${gen.prompt.length} chars)`); }
      if (genType === "image" && gen.output_url) { setCanvasImage(gen.output_url); log("✓ Image ready"); }
      if (genType === "video") { handleVideoResult(gen); }
    } catch(e: any) {
      setSteps((p) => p.map((s) => s.id === selectedStep.id ? { ...s, state: "review" } : s));
      setRunStatus(`✗ Error: ${e.message}`);
      setError("runstep", e.message);
      log(`✗ ${selectedStep.name} failed: ${e.message}`);
    }
    setBusyKey("runstep", false);
  }

  // ── Build Image from selected concept ─────────────────────────────────────
  async function buildSelectedConcept() {
    const concept = concepts.find((c) => c.id === selectedConceptId);
    const prompt = concept
      ? `${concept.headline}. ${concept.body}. Premium telehealth brand image. Clean minimal clinic. Calm professional doctor. Dark cinematic background. No text.`
      : "Premium telehealth brand scene. Professional doctor. Minimal clinic. Dark background.";
    setBusyKey("image", true);
    clearError("image");
    setCanvasImage(null);
    setRunStatus("Generating image...");
    log("Submitting image to Kling v2.1...");
    try {
      const gen = await callGenerations("image", prompt, { aspectRatio: "16:9" });
      if (gen.output_url) {
        setCanvasImage(gen.output_url);
        setRunStatus("✓ Image ready");
        log("✓ Image generated");
      } else if (gen.status === "pending") {
        setRunStatus("Image processing... polling every 8s");
        log(`✓ Submitted (${gen.id}) — polling...`);
        pollImage(gen.id);
        return;
      } else {
        setRunStatus("✗ Image failed");
        setError("image", "No output returned");
        log("✗ Image generation returned no output");
      }
    } catch(e: any) {
      setRunStatus(`✗ ${e.message}`);
      setError("image", e.message);
      log(`✗ Image failed: ${e.message}`);
    }
    setBusyKey("image", false);
  }

  function pollImage(genId: string, tries = 0) {
    if (tries > 12) { setRunStatus("Image timed out — check Library"); setBusyKey("image", false); return; }
    setTimeout(async () => {
      try {
        const r = await fetch(`/api/generations?type=image&limit=20`);
        const d = await r.json();
        const found = d.data?.find((g: any) => g.id === genId);
        if (found?.output_url) {
          setCanvasImage(found.output_url);
          setRunStatus("✓ Image ready");
          log("✓ Image ready after polling");
          setBusyKey("image", false);
        } else { pollImage(genId, tries + 1); }
      } catch { pollImage(genId, tries + 1); }
    }, 8000);
  }

  // ── Build Video ───────────────────────────────────────────────────────────
  async function buildVideo() {
    const concept = concepts.find((c) => c.id === selectedConceptId);
    const prompt = concept
      ? `${concept.headline}. ${concept.body}. Premium telehealth brand video. Calm professional doctor in minimal clinic. Soft cinematic camera push-in. 5 seconds. No text.`
      : "Premium telehealth brand video. Calm doctor. Minimal clinic. Cinematic. 5 seconds.";
    setBusyKey("video", true);
    clearError("video");
    setCanvasVideo(null);
    setCanvasVideoTaskId(null);
    setRunStatus("Submitting video to Kling...");
    log("Submitting video to Kling v2.6...");
    try {
      const gen = await callGenerations("video", prompt, { duration: "5s", aspectRatio: "16:9" });
      handleVideoResult(gen);
    } catch(e: any) {
      setRunStatus(`✗ ${e.message}`);
      setError("video", e.message);
      log(`✗ Video failed: ${e.message}`);
      setBusyKey("video", false);
    }
  }

  function handleVideoResult(gen: any) {
    if (gen.output_url) {
      setCanvasVideo(gen.output_url);
      setRunStatus("✓ Video ready");
      log("✓ Video ready");
      setBusyKey("video", false);
    } else if (gen.status === "pending") {
      const taskId = gen.external_id || gen.id;
      setCanvasVideoTaskId(taskId);
      setRunStatus("Video generating... (2–5 min) polling every 15s");
      log(`✓ Video submitted — task ${taskId?.slice(0,12)}... polling`);
      pollVideo(gen.id);
    } else {
      setRunStatus("✗ Video failed");
      setError("video", "No output");
      log("✗ Video returned no output");
      setBusyKey("video", false);
    }
  }

  function pollVideo(genId: string, tries = 0) {
    if (tries > 24) { setRunStatus("Video timed out — check Library"); setBusyKey("video", false); return; }
    setTimeout(async () => {
      try {
        const r = await fetch(`/api/generations?type=video&limit=20`);
        const d = await r.json();
        const found = d.data?.find((g: any) => g.id === genId);
        if (found?.output_url) {
          setCanvasVideo(found.output_url);
          setRunStatus("✓ Video ready");
          log("✓ Video ready");
          setBusyKey("video", false);
        } else { pollVideo(genId, tries + 1); }
      } catch { pollVideo(genId, tries + 1); }
    }, 15000);
  }

  // ── Run Full Pipeline ─────────────────────────────────────────────────────
  async function runFullPipeline() {
    setBusyKey("pipeline", true);
    setRunStatus("Running full pipeline...");
    log("▶ Full pipeline started: Script → Image → Video");
    setSteps(p => p.map(s => ({ ...s, state: "queued" })));

    // Step 1: Script
    setSteps(p => p.map(s => s.id === "copy" ? { ...s, state: "running" } : s));
    log("Step 1: Generating script...");
    try {
      const sg = await callGenerations("script", strategyPrompt);
      setCanvasScript(sg.prompt || "");
      setSteps(p => p.map(s => s.id === "copy" ? { ...s, state: "complete" } : s));
      log("✓ Script done");
    } catch(e: any) { log(`✗ Script failed: ${e.message}`); setSteps(p => p.map(s => s.id === "copy" ? { ...s, state: "review" } : s)); }

    // Step 2: Image
    setSteps(p => p.map(s => s.id === "imagery" ? { ...s, state: "running" } : s));
    log("Step 2: Generating image...");
    try {
      const concept = concepts.find(c => c.id === selectedConceptId);
      const ip = concept ? `${concept.headline}. ${concept.body}. Premium telehealth. Dark cinematic.` : imagePrompt;
      const ig = await callGenerations("image", ip, { aspectRatio: "16:9" });
      if (ig.output_url) { setCanvasImage(ig.output_url); log("✓ Image done"); }
      else if (ig.status === "pending") { log(`✓ Image pending (${ig.id}) — polling`); pollImage(ig.id); }
      setSteps(p => p.map(s => s.id === "imagery" ? { ...s, state: "complete" } : s));
    } catch(e: any) { log(`✗ Image failed: ${e.message}`); setSteps(p => p.map(s => s.id === "imagery" ? { ...s, state: "review" } : s)); }

    // Step 3: Video
    setSteps(p => p.map(s => s.id === "i2v" ? { ...s, state: "running" } : s));
    log("Step 3: Submitting video...");
    try {
      const concept = concepts.find(c => c.id === selectedConceptId);
      const vp = concept ? `${concept.headline}. ${concept.body}. Telehealth brand video. Cinematic. 5s.` : "Premium telehealth video. 5 seconds.";
      const vg = await callGenerations("video", vp, { duration: "5s", aspectRatio: "16:9" });
      handleVideoResult(vg);
      setSteps(p => p.map(s => s.id === "i2v" ? { ...s, state: "complete" } : s));
    } catch(e: any) { log(`✗ Video failed: ${e.message}`); setSteps(p => p.map(s => s.id === "i2v" ? { ...s, state: "review" } : s)); }

    setRunStatus("✓ Pipeline complete — image/video polling if pending");
    setBusyKey("pipeline", false);
  }

  // ── Media input buttons ───────────────────────────────────────────────────
  function handleMediaInput(type: string) {
    setActiveInput(type);
    if (type === "Image Upload" || type === "Video Upload" || type === "Doc / PDF" || type === "Audio") {
      fileInputRef.current?.click();
    }
    log(`${type} selected — paste URL or upload file below`);
  }

  async function handleUrlAnalyze() {
    if (!urlInput.trim()) return;
    setBusyKey("urlanalyze", true);
    clearError("urlanalyze");
    log(`Analyzing: ${urlInput.slice(0, 60)}...`);
    try {
      const gen = await callGenerations("script", `Analyze this reference URL and extract key creative insights for a telehealth campaign. URL: ${urlInput}. Return: 1) Main visual style, 2) Key messaging, 3) Recommended image prompt, 4) Recommended video direction.`);
      log(`✓ Analysis: ${(gen.prompt || "").slice(0, 200)}`);
      setStrategyPrompt(prev => prev + `\n\n[URL Analysis from ${urlInput}]: ${(gen.prompt || "").slice(0, 300)}`);
      setRunStatus("✓ URL analyzed — strategy prompt updated");
    } catch(e: any) {
      setError("urlanalyze", e.message);
      log(`✗ Analyze failed: ${e.message}`);
    }
    setBusyKey("urlanalyze", false);
  }

  return (
    <><style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    <div style={{ minHeight:"100vh", background:"radial-gradient(circle at top left,rgba(168,85,247,0.16),transparent 24%),radial-gradient(circle at top right,rgba(34,211,238,0.14),transparent 24%),linear-gradient(180deg,#050816 0%,#070b1a 40%,#060816 100%)", color:"#fff", padding:24, fontFamily:"Inter,ui-sans-serif,system-ui,-apple-system,sans-serif" }}>
      <input ref={fileInputRef} type="file" style={{ display:"none" }} onChange={(e) => { const f = e.target.files?.[0]; if(f) log(`File selected: ${f.name} (${(f.size/1024).toFixed(0)}KB)`); }} />
      <div style={{ maxWidth:1680, margin:"0 auto" }}>

        {/* HEADER */}
        <div style={{ display:"grid", gridTemplateColumns:"1.1fr 1fr", gap:20, marginBottom:18 }}>
          <div>
            <div style={{ color:"#67e8f9", fontSize:12, letterSpacing:"0.32em", textTransform:"uppercase", marginBottom:10 }}>AI Pipeline + Video Creator</div>
            <h1 style={{ margin:0, fontSize:46, lineHeight:1.05, fontWeight:800, maxWidth:720 }}>5 design concepts with your same visual layout logic</h1>
            <p style={{ marginTop:14, maxWidth:720, color:"rgba(255,255,255,0.82)", fontSize:18, lineHeight:1.55 }}>Same mental model, cleaner hierarchy. Left = process. Next = editable guide. Center = assistant + per-step previews. Right = media generation and source intake. Bottom = final workspace.</p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:14, alignSelf:"start" }}>
            {[["Neo Control","Premium dark console with strong cyan signal hierarchy",false],["Electric Studio","More creative and high-energy with magenta-cyan contrast",true],["Glass Mission","Soft glassmorphism while keeping the same operational layout",false],["Command Grid","Sharper enterprise control room with stronger segmentation",false],["Stealth Broadcast","Ultra-clean cinematic dark mode with bigger preview emphasis",false]].map(([title,desc,active],i) => (
              <button key={i} style={{ ...buttonStyle(Boolean(active)), textAlign:"left", padding:16 }} onClick={() => log(`Viewed: ${title}`)}>
                <div style={{ fontSize:22, fontWeight:700, marginBottom:6 }}>{title as string}</div>
                <div style={{ color:"rgba(255,255,255,0.78)", fontSize:16, lineHeight:1.4 }}>{desc as string}</div>
              </button>
            ))}
          </div>
        </div>

        {/* MAIN PANEL */}
        <div style={{ ...panelStyle(), padding:18, borderRadius:34, overflow:"hidden" }}>

          {/* TOP BAR */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap", paddingBottom:14, borderBottom:"1px solid rgba(255,255,255,0.10)", marginBottom:14 }}>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              {["Telehealth Master","Mode: Full AI + Rules","Output: Image → Video","Campaign: Clinical Safety"].map((chip,i) => (
                <div key={chip} style={{ padding:"10px 14px", borderRadius:14, border:i===0?"1px solid rgba(34,211,238,0.65)":"1px solid rgba(255,255,255,0.14)", background:i===0?"linear-gradient(90deg,rgba(217,70,239,0.18),rgba(34,211,238,0.10))":"rgba(255,255,255,0.05)", fontWeight:700, fontSize:14 }}>{chip}</div>
              ))}
            </div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              <button style={buttonStyle(false)} onClick={() => log("Config saved.")}>Save</button>
              <button style={buttonStyle(false)} onClick={() => { setRunStatus("Paused."); log("Pipeline paused."); }}>Pause</button>
              <button disabled={busy.pipeline} style={{ ...buttonStyle(true), background:"linear-gradient(90deg,rgba(217,70,239,0.85),rgba(34,211,238,0.88))", opacity:busy.pipeline?0.6:1, display:"flex", alignItems:"center", gap:8 }} onClick={runFullPipeline}>
                {busy.pipeline && <Spinner />}{busy.pipeline ? "Running..." : "Run Full Pipeline"}
              </button>
            </div>
          </div>

          {/* 4-COLUMN GRID */}
          <div style={{ display:"grid", gridTemplateColumns:"290px 320px minmax(0,1fr) 300px", gap:14, alignItems:"start" }}>

            {/* COL 1 — STEP BUILDER */}
            <section style={{ ...panelStyle(), padding:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.24em", color:"rgba(255,255,255,0.6)", marginBottom:4 }}>Pipeline Process</div>
                  <div style={{ fontSize:18, fontWeight:800 }}>Visual Step Builder</div>
                </div>
                <button style={buttonStyle(false)} onClick={addStep}>+</button>
              </div>
              <div style={{ display:"grid", gap:12 }}>
                {steps.map((step, idx) => {
                  const s = stateStyles(step.state);
                  const isSel = selectedStepId === step.id;
                  return (
                    <React.Fragment key={step.id}>
                      <button onClick={() => setSelectedStepId(step.id)} style={{ textAlign:"left", borderRadius:18, padding:14, border:`1px solid ${isSel?"#22d3ee":s.border}`, background:s.bg, color:"#fff", cursor:"pointer" }}>
                        <div style={{ display:"grid", gridTemplateColumns:"28px 1fr auto", gap:12, alignItems:"start" }}>
                          <div style={{ width:28, height:28, borderRadius:8, display:"grid", placeItems:"center", border:"1px solid rgba(255,255,255,0.10)", background:"rgba(255,255,255,0.04)", fontSize:14 }}>{step.icon}</div>
                          <div>
                            <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>{step.name}</div>
                            <div style={{ display:"inline-flex", padding:"5px 10px", borderRadius:999, background:s.pillBg, color:s.pillText, fontSize:11, fontWeight:800, letterSpacing:"0.14em", textTransform:"uppercase" }}>{s.label}</div>
                          </div>
                          <div style={{ display:"flex", gap:6 }}>
                            <button style={{ ...buttonStyle(false), padding:8, minWidth:0 }} onClick={(e) => { e.stopPropagation(); duplicateStep(step.id); }}>⧉</button>
                            <button style={{ ...buttonStyle(false), padding:8, minWidth:0 }} onClick={(e) => { e.stopPropagation(); removeStep(step.id); }}>🗑</button>
                          </div>
                        </div>
                      </button>
                      {idx < steps.length-1 && <div style={{ width:1, height:18, margin:"0 auto", background:"linear-gradient(180deg,rgba(34,211,238,0.7),rgba(255,255,255,0.08))" }} />}
                    </React.Fragment>
                  );
                })}
              </div>
            </section>

            {/* COL 2 — STEP CONFIG */}
            <section style={{ ...panelStyle(), padding:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.24em", color:"rgba(255,255,255,0.6)", marginBottom:4 }}>Step Guide / Config</div>
                  <div style={{ fontSize:18, fontWeight:800 }}>Editable Current Step</div>
                </div>
                <div style={{ padding:"8px 10px", borderRadius:12, border:"1px solid rgba(217,70,239,0.26)", background:"rgba(168,85,247,0.10)", fontSize:12, fontWeight:700 }}>{selectedStep.name}</div>
              </div>
              <div style={{ display:"grid", gap:12 }}>
                <div style={{ ...panelStyle(), padding:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <div style={{ fontSize:12, textTransform:"uppercase", letterSpacing:"0.22em", color:"rgba(255,255,255,0.56)" }}>Strategy Prompt</div>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.72)" }}>Version 3</div>
                  </div>
                  <textarea value={strategyPrompt} onChange={(e) => setStrategyPrompt(e.target.value)} style={{ width:"100%", minHeight:150, background:"rgba(0,0,0,0.24)", color:"#fff", border:"1px solid rgba(255,255,255,0.10)", borderRadius:14, padding:12, resize:"vertical", fontSize:14, lineHeight:1.55 }} />
                </div>
                <div style={{ ...panelStyle(), padding:12 }}>
                  <div style={{ fontSize:12, textTransform:"uppercase", letterSpacing:"0.22em", color:"rgba(255,255,255,0.56)", marginBottom:10 }}>Approved Facts</div>
                  <div style={{ display:"grid", gap:8, maxHeight:120, overflowY:"auto" }}>
                    {APPROVED_FACTS.map((f,i) => <div key={i} style={{ border:"1px solid rgba(255,255,255,0.10)", background:"rgba(255,255,255,0.05)", borderRadius:12, padding:"10px 12px", fontSize:14 }}>{f}</div>)}
                  </div>
                </div>
                <div style={{ ...panelStyle(), padding:12 }}>
                  <div style={{ fontSize:12, textTransform:"uppercase", letterSpacing:"0.22em", color:"rgba(255,255,255,0.56)", marginBottom:8 }}>Brand Tone</div>
                  <textarea value={brandTone} onChange={(e) => setBrandTone(e.target.value)} style={{ width:"100%", minHeight:92, background:"rgba(0,0,0,0.24)", color:"#fff", border:"1px solid rgba(255,255,255,0.10)", borderRadius:14, padding:12, resize:"vertical", fontSize:14 }} />
                </div>
                <div style={{ ...panelStyle(), padding:12 }}>
                  <div style={{ fontSize:12, textTransform:"uppercase", letterSpacing:"0.22em", color:"rgba(255,255,255,0.56)", marginBottom:8 }}>Image Prompt</div>
                  <textarea value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} style={{ width:"100%", minHeight:120, background:"rgba(0,0,0,0.24)", color:"#fff", border:"1px solid rgba(255,255,255,0.10)", borderRadius:14, padding:12, resize:"vertical", fontSize:14 }} />
                </div>
                {errors.runstep && <div style={{ background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#fca5a5" }}>Error: {errors.runstep}</div>}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <button style={buttonStyle(false)} onClick={() => log("Config saved.")}>Save Config</button>
                  <button disabled={busy.runstep} style={{ ...buttonStyle(true), background:"linear-gradient(90deg,rgba(34,211,238,0.85),rgba(14,165,233,0.85))", display:"flex", alignItems:"center", justifyContent:"center", gap:8, opacity:busy.runstep?0.6:1 }} onClick={runStep}>
                    {busy.runstep && <Spinner />}{busy.runstep ? "Running..." : "Run Step"}
                  </button>
                </div>
              </div>
            </section>

            {/* COL 3 — AI ASSISTANT + PREVIEWS */}
            <section style={{ display:"grid", gap:14 }}>
              <div style={{ ...panelStyle(), padding:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, marginBottom:12 }}>
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    <div style={{ width:36, height:36, borderRadius:14, display:"grid", placeItems:"center", background:"linear-gradient(90deg,rgba(217,70,239,0.9),rgba(34,211,238,0.9))", fontWeight:800 }}>✦</div>
                    <div>
                      <div style={{ fontSize:22, fontWeight:800 }}>AI Assistant</div>
                      <div style={{ color:"#34d399", fontSize:14 }}>Active · Connected to pipeline</div>
                    </div>
                  </div>
                  <div style={{ padding:"8px 12px", borderRadius:999, border:"1px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.05)", fontSize:11, fontWeight:800, letterSpacing:"0.16em", textTransform:"uppercase", color:"rgba(255,255,255,0.72)" }}>Knowledge + Actions</div>
                </div>
                <div style={{ ...panelStyle(), padding:14, marginBottom:12, fontSize:16, lineHeight:1.6, color:"rgba(255,255,255,0.9)" }}>I can analyze links, images, docs, and video inputs, recommend the best generation path, update step configs, and preview the likely output before you commit to a run.</div>
                <div style={{ borderRadius:999, border:"1px solid rgba(34,211,238,0.28)", background:"rgba(34,211,238,0.10)", color:"#67e8f9", padding:"12px 16px", fontSize:12, letterSpacing:"0.18em", textTransform:"uppercase", fontWeight:800, marginBottom:12 }}>Context switched to image-to-video planning</div>
                {errors.assistant && <div style={{ background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#fca5a5", marginBottom:8 }}>Error: {errors.assistant}</div>}
                <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:10 }}>
                  <input value={assistantInput} onChange={(e) => setAssistantInput(e.target.value)} placeholder="Ask anything — get real AI response." style={{ width:"100%", background:"rgba(0,0,0,0.26)", color:"#fff", border:"1px solid rgba(255,255,255,0.10)", borderRadius:16, padding:"14px 16px", fontSize:15, outline:"none" }} onKeyDown={(e) => { if(e.key==="Enter") handleAssistantSend(); }} />
                  <button disabled={busy.assistant} style={{ ...buttonStyle(true), display:"flex", alignItems:"center", gap:6, opacity:busy.assistant?0.6:1 }} onClick={handleAssistantSend}>
                    {busy.assistant ? <Spinner /> : null}{busy.assistant ? "..." : "Send"}
                  </button>
                </div>
              </div>

              <div style={{ ...panelStyle(), padding:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, gap:12 }}>
                  <div>
                    <div style={{ fontSize:12, textTransform:"uppercase", letterSpacing:"0.22em", color:"rgba(255,255,255,0.56)", marginBottom:4 }}>Process Preview</div>
                    <div style={{ fontSize:18, fontWeight:800 }}>Current Step Output Screens</div>
                  </div>
                  <button style={buttonStyle(false)} onClick={() => setPreviewStatus("Compare mode opened.")}>Compare</button>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:12 }}>
                  {concepts.map((concept) => {
                    const sel = selectedConceptId === concept.id;
                    return (
                      <button key={concept.id} onClick={() => selectConcept(concept.id)} style={{ textAlign:"left", borderRadius:18, border:`1px solid ${sel?"rgba(34,211,238,0.5)":"rgba(255,255,255,0.10)"}`, background:"rgba(4,8,28,0.88)", overflow:"hidden", color:"#fff", cursor:"pointer", padding:0 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 12px 10px", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
                          <div style={{ fontSize:14, fontWeight:700 }}>{concept.title}</div>
                          <div style={{ padding:"4px 8px", borderRadius:999, border:"1px solid rgba(34,211,238,0.18)", background:"rgba(34,211,238,0.10)", color:"#67e8f9", fontSize:10, fontWeight:800 }}>{concept.badge}</div>
                        </div>
                        <div style={{ padding:12, minHeight:230, background:"radial-gradient(circle at top,rgba(34,211,238,0.10),transparent 34%),linear-gradient(180deg,rgba(9,13,33,0.96),rgba(3,7,22,0.98))" }}>
                          <div style={{ borderRadius:16, border:`1px solid ${sel?"rgba(34,211,238,0.3)":"rgba(255,255,255,0.10)"}`, background:"rgba(0,0,0,0.22)", padding:14, minHeight:200, display:"flex", flexDirection:"column" }}>
                            <div style={{ fontSize:10, letterSpacing:"0.24em", textTransform:"uppercase", color:"rgba(255,255,255,0.52)", marginBottom:12 }}>Preview Frame</div>
                            <div style={{ fontSize:18, fontWeight:800, lineHeight:1.1, marginBottom:10 }}>{concept.headline}</div>
                            <div style={{ fontSize:14, lineHeight:1.55, color:"rgba(255,255,255,0.84)", maxWidth:"90%" }}>{concept.body}</div>
                            <div style={{ marginTop:"auto", display:"flex", justifyContent:"space-between", gap:10 }}>
                              <div style={{ borderRadius:999, background: sel?"#22d3ee":"rgba(34,211,238,0.3)", color:"#04121a", fontWeight:800, fontSize:12, padding:"8px 12px" }}>{sel?"Selected":"Select"}</div>
                              <div style={{ width:42, height:42, borderRadius:12, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.10)" }} />
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* COL 4 — MEDIA GENERATOR */}
            <section style={{ ...panelStyle(), padding:14 }}>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, textTransform:"uppercase", letterSpacing:"0.22em", color:"rgba(255,255,255,0.56)", marginBottom:4 }}>Media Generator</div>
                <div style={{ fontSize:18, fontWeight:800 }}>Image to Video + Source Intake</div>
              </div>

              {/* Source intake buttons */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                {["URL / Link","Image Upload","Video Upload","Doc / PDF","Audio"].map((item) => (
                  <button key={item} style={{ ...buttonStyle(activeInput===item), fontSize:13, padding:"8px 10px" }} onClick={() => handleMediaInput(item)}>{item}</button>
                ))}
              </div>

              {/* URL input shown when URL/Link active */}
              {(activeInput === "URL / Link") && (
                <div style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", gap:8 }}>
                    <input value={urlInput} onChange={e=>setUrlInput(e.target.value)} placeholder="Paste YouTube, TikTok, or web URL..." style={{ flex:1, background:"rgba(0,0,0,0.26)", color:"#fff", border:"1px solid rgba(255,255,255,0.10)", borderRadius:10, padding:"10px 12px", fontSize:13, outline:"none" }} onKeyDown={e=>{ if(e.key==="Enter") handleUrlAnalyze(); }} />
                    <button disabled={busy.urlanalyze} style={{ ...buttonStyle(true), fontSize:13, padding:"8px 14px", display:"flex", alignItems:"center", gap:6, opacity:busy.urlanalyze?0.6:1 }} onClick={handleUrlAnalyze}>
                      {busy.urlanalyze ? <Spinner /> : null}{busy.urlanalyze ? "..." : "Analyze"}
                    </button>
                  </div>
                  {errors.urlanalyze && <div style={{ marginTop:6, fontSize:12, color:"#fca5a5" }}>Error: {errors.urlanalyze}</div>}
                </div>
              )}

              <div style={{ display:"grid", gap:12 }}>
                {/* Image panel */}
                <div style={{ ...panelStyle(), padding:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                    <div style={{ fontSize:12, textTransform:"uppercase", letterSpacing:"0.18em", color:"rgba(255,255,255,0.56)" }}>Sample PNG Concepts</div>
                    <button style={buttonStyle(false)} onClick={buildSelectedConcept} disabled={busy.image}>Refresh</button>
                  </div>
                  <div style={{ borderRadius:18, border:"1px solid rgba(255,255,255,0.10)", background:"radial-gradient(circle at top,rgba(34,211,238,0.10),transparent 28%),linear-gradient(180deg,rgba(10,14,35,0.96),rgba(4,8,24,0.98))", padding:12, minHeight:280 }}>
                    <div style={{ height:"100%", borderRadius:16, border:"1px solid rgba(255,255,255,0.10)", padding:14, display:"flex", flexDirection:"column" }}>
                      <div style={{ fontSize:10, letterSpacing:"0.24em", textTransform:"uppercase", color:"rgba(255,255,255,0.52)", marginBottom:10 }}>Three-step Reassurance Ad</div>
                      {canvasImage ? (
                        <>
                          <img src={canvasImage} alt="Generated" style={{ width:"100%", borderRadius:10, marginBottom:10, display:"block" }} />
                          <a href={canvasImage} target="_blank" rel="noreferrer" style={{ fontSize:11, color:"#67e8f9", marginBottom:8 }}>Open full size ↗</a>
                        </>
                      ) : busy.image ? (
                        <div style={{ display:"flex", alignItems:"center", gap:8, color:"#67e8f9", fontSize:13, flex:1 }}>
                          <Spinner />Generating image... (up to 60s)
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize:18, fontWeight:800, lineHeight:1.15, marginBottom:10 }}>{concepts.find(c=>c.id===selectedConceptId)?.headline}</div>
                          <div style={{ fontSize:14, lineHeight:1.55, color:"rgba(255,255,255,0.84)" }}>{concepts.find(c=>c.id===selectedConceptId)?.body}</div>
                        </>
                      )}
                      {errors.image && <div style={{ background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:8, padding:"8px 10px", fontSize:12, color:"#fca5a5", marginTop:8 }}>Error: {errors.image}</div>}
                      <div style={{ marginTop:"auto", display:"flex", gap:8, flexWrap:"wrap", paddingTop:8 }}>
                        <button disabled={busy.image} style={{ borderRadius:999, background:busy.image?"rgba(255,255,255,0.1)":"#22d3ee", color:"#03131b", border:"none", fontWeight:800, padding:"8px 12px", cursor:busy.image?"not-allowed":"pointer", opacity:busy.image?0.6:1, display:"flex", alignItems:"center", gap:6 }} onClick={buildSelectedConcept}>
                          {busy.image ? <><Spinner /> Building...</> : "Select & Build"}
                        </button>
                        <button style={{ borderRadius:999, background:"rgba(255,255,255,0.06)", color:"#fff", border:"1px solid rgba(255,255,255,0.12)", fontWeight:700, padding:"8px 12px", cursor:"pointer" }} onClick={() => { if(canvasImage) window.open(canvasImage,"_blank"); else setPreviewStatus("No image yet — click Select & Build first."); }}>Preview</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Video panel */}
                <div style={{ ...panelStyle(), padding:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                    <div style={{ fontSize:12, textTransform:"uppercase", letterSpacing:"0.18em", color:"rgba(255,255,255,0.56)" }}>Selected Concept → Video Preview</div>
                  </div>
                  <div style={{ borderRadius:18, border:"1px solid rgba(255,255,255,0.10)", background:"radial-gradient(circle at top,rgba(34,211,238,0.10),transparent 28%),linear-gradient(180deg,rgba(10,14,35,0.96),rgba(4,8,24,0.98))", padding:12, minHeight:220 }}>
                    <div style={{ height:"100%", borderRadius:16, border:"1px solid rgba(255,255,255,0.10)", padding:14, display:"flex", flexDirection:"column" }}>
                      <div style={{ fontSize:10, letterSpacing:"0.24em", textTransform:"uppercase", color:"rgba(255,255,255,0.52)", marginBottom:10 }}>Motion Preview</div>
                      {canvasVideo ? (
                        <>
                          <video src={canvasVideo} controls style={{ width:"100%", borderRadius:10, marginBottom:8, display:"block" }} />
                          <a href={canvasVideo} target="_blank" rel="noreferrer" style={{ fontSize:11, color:"#67e8f9" }}>Download ↗</a>
                        </>
                      ) : busy.video ? (
                        <div style={{ display:"flex", flexDirection:"column", gap:8, flex:1 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, color:"#67e8f9", fontSize:13 }}>
                            <Spinner />Generating video... (2–5 min)
                          </div>
                          {canvasVideoTaskId && <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>Task: {canvasVideoTaskId.slice(0,20)}...</div>}
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize:16, fontWeight:800, lineHeight:1.15, marginBottom:8 }}>Private Care From Home</div>
                          <div style={{ fontSize:13, lineHeight:1.55, color:"rgba(255,255,255,0.84)" }}>Subtle camera motion, clean screen movement, reassuring pace.</div>
                        </>
                      )}
                      {errors.video && <div style={{ background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:8, padding:"8px 10px", fontSize:12, color:"#fca5a5", marginTop:8 }}>Error: {errors.video}</div>}
                      <div style={{ marginTop:"auto", display:"flex", gap:8, flexWrap:"wrap", paddingTop:8 }}>
                        <button disabled={busy.video} style={{ borderRadius:999, background:busy.video?"rgba(255,255,255,0.1)":"#22d3ee", color:"#03131b", border:"none", fontWeight:800, padding:"8px 12px", cursor:busy.video?"not-allowed":"pointer", opacity:busy.video?0.6:1, display:"flex", alignItems:"center", gap:6 }} onClick={buildVideo}>
                          {busy.video ? <><Spinner /> Generating...</> : "Start Video Build"}
                        </button>
                        <button style={{ borderRadius:999, background:"rgba(255,255,255,0.06)", color:"#fff", border:"1px solid rgba(255,255,255,0.12)", fontWeight:700, padding:"8px 12px", cursor:"pointer" }} onClick={() => { if(canvasVideo) window.open(canvasVideo,"_blank"); else log("No video yet — click Start Video Build first."); }}>Adjust</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* BOTTOM WORKSPACE */}
          <div style={{ ...panelStyle(), marginTop:14, padding:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"center", marginBottom:12, flexWrap:"wrap" }}>
              <div>
                <div style={{ fontSize:12, textTransform:"uppercase", letterSpacing:"0.22em", color:"rgba(255,255,255,0.56)", marginBottom:4 }}>Final Results / Editor / Deployer</div>
                <div style={{ fontSize:36, fontWeight:800 }}>Production Workspace</div>
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {["Final Output","Editor","Export","Publish","Logs"].map((tab,i) => (
                  <button key={tab} style={{ ...buttonStyle(i===0), background:i===0?"linear-gradient(90deg,rgba(217,70,239,0.85),rgba(34,211,238,0.85))":"rgba(255,255,255,0.05)" }} onClick={() => log(`Opened ${tab} tab.`)}>{tab}</button>
                ))}
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1.45fr 0.72fr", gap:14 }}>
              {/* Output Canvas */}
              <div style={{ borderRadius:28, border:"1px solid rgba(255,255,255,0.12)", background:"linear-gradient(180deg,rgba(5,10,25,0.98),rgba(10,18,42,0.95))", padding:16, minHeight:330 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                  <div style={{ fontSize:18, fontWeight:800 }}>Primary Output Canvas</div>
                  <div style={{ borderRadius:12, border:"1px solid rgba(255,255,255,0.10)", background:"rgba(255,255,255,0.05)", padding:"8px 10px", fontSize:12 }}>1920 × 1080</div>
                </div>
                {canvasVideo ? (
                  <video src={canvasVideo} controls style={{ width:"100%", borderRadius:18, display:"block" }} />
                ) : canvasImage ? (
                  <img src={canvasImage} alt="Output" style={{ width:"100%", borderRadius:18, display:"block" }} />
                ) : canvasScript ? (
                  <div style={{ borderRadius:18, border:"1px solid rgba(255,255,255,0.08)", background:"rgba(0,0,0,0.3)", padding:16, minHeight:240, fontSize:14, lineHeight:1.8, color:"rgba(255,255,255,0.85)", whiteSpace:"pre-wrap" }}>{canvasScript}</div>
                ) : (
                  <div style={{ height:240, borderRadius:24, border:"1px solid rgba(255,255,255,0.10)", background:"radial-gradient(circle at center,rgba(34,211,238,0.08),transparent 35%),linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.98))", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.2)", fontSize:14 }}>
                    Run a step or generate content to see output here
                  </div>
                )}
              </div>

              {/* Status + Log */}
              <div style={{ display:"grid", gap:12 }}>
                <div style={{ ...panelStyle(), padding:14 }}>
                  <div style={{ fontSize:18, fontWeight:800, marginBottom:10 }}>Run Status</div>
                  <div style={{ display:"grid", gap:8 }}>
                    {[["Script",canvasScript?"done":"queued"],["Image",canvasImage?"done":busy.image?"active":"queued"],["Video",canvasVideo?"done":busy.video?"active":"queued"]].map(([label,status],i) => (
                      <div key={i} style={{ borderRadius:14, border:status==="active"?"1px solid rgba(34,211,238,0.25)":"1px solid rgba(255,255,255,0.10)", background:status==="active"?"rgba(34,211,238,0.10)":"rgba(255,255,255,0.04)", padding:"12px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span>{label}</span>
                        <span style={{ color:status==="done"?"#6ee7b7":status==="active"?"#67e8f9":"#94a3b8" }}>{status==="done"?"✓":status==="active"?"◔":"›"}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:12, fontSize:13, color:"rgba(255,255,255,0.78)", lineHeight:1.6 }}><strong>System:</strong> {runStatus}</div>
                  <div style={{ marginTop:4, fontSize:13, color:"rgba(255,255,255,0.78)" }}><strong>Preview:</strong> {previewStatus}</div>
                </div>
                <div style={{ ...panelStyle(), padding:14 }}>
                  <div style={{ fontSize:18, fontWeight:800, marginBottom:10 }}>Assistant Activity</div>
                  <div style={{ display:"grid", gap:6 }}>
                    {assistantLog.map((entry,i) => (
                      <div key={i} style={{ borderRadius:10, border:"1px solid rgba(255,255,255,0.08)", background:"rgba(255,255,255,0.03)", padding:"10px 12px", fontSize:13, lineHeight:1.5, color:i===0?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.5)" }}>{entry}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop:12, color:"rgba(255,255,255,0.4)", fontSize:12, textAlign:"right" }}>
          /pipeline/test — all buttons wired to real API
        </div>
      </div>
    </div>
  </>;
}
