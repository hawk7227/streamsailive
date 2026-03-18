"use client";

import React, { useMemo, useState } from "react";

type StepState = "complete" | "running" | "review" | "queued";

type Step = {
  id: string;
  name: string;
  state: StepState;
  icon: string;
};

type ConceptCard = {
  id: string;
  title: string;
  badge: string;
  headline: string;
  body: string;
};

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

const MEDIA_INPUTS = [
  "URL / Link",
  "Image Upload",
  "Video Upload",
  "Doc / PDF",
  "Audio",
];

const INITIAL_CONCEPTS: ConceptCard[] = [
  { id: "c1", title: "Concept 1", badge: "Recommended", headline: "How Online Care Works", body: "Simple intake, licensed review, trusted next steps." },
  { id: "c2", title: "Concept 2", badge: "Preview", headline: "How Online Care Works", body: "Simple intake, licensed review, trusted next steps." },
  { id: "c3", title: "Concept 3", badge: "Preview", headline: "How Online Care Works", body: "Simple intake, licensed review, trusted next steps." },
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

export default function PipelineTestPage() {
  const [steps, setSteps] = useState<Step[]>(STEPS_INITIAL);
  const [selectedStepId, setSelectedStepId] = useState("copy");
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLog, setAssistantLog] = useState<string[]>(["Context switched to image-to-video planning."]);
  const [strategyPrompt, setStrategyPrompt] = useState("You are a conversion-focused creative generator for a telehealth campaign. Build 3 safe, premium, high-trust concepts optimized for image-to-video motion.");
  const [brandTone, setBrandTone] = useState("Premium, calm, clinically reassuring, modern, highly trustworthy.");
  const [imagePrompt, setImagePrompt] = useState("Generate 10 premium healthcare concept frames with clean composition, dark high-end UI preview compatibility, and strong safe-motion potential.");
  const [inputValue, setInputValue] = useState("");
  const [selectedConceptId, setSelectedConceptId] = useState("c1");
  const [concepts, setConcepts] = useState<ConceptCard[]>(INITIAL_CONCEPTS);
  const [sampleTitle, setSampleTitle] = useState("How Online Care Works");
  const [sampleBody, setSampleBody] = useState("Simple intake, licensed review, trusted next steps.");
  const [runStatus, setRunStatus] = useState("Idle");
  const [previewStatus, setPreviewStatus] = useState("Ready");

  const selectedStep = useMemo(() => steps.find((s) => s.id === selectedStepId) ?? steps[0], [steps, selectedStepId]);

  function appendLog(text: string) { setAssistantLog((p) => [text, ...p].slice(0, 8)); }

  function cycleStepState(stepId: string) {
    setSteps((p) => p.map((s) => { if (s.id !== stepId) return s; const next: Record<StepState,StepState> = { queued:"running", running:"review", review:"complete", complete:"queued" }; return { ...s, state: next[s.state] }; }));
  }

  function addStep() { const id = `custom-${Date.now()}`; setSteps((p) => [...p, { id, name: `Custom Step ${p.length - 6}`, state: "queued", icon: "+" }]); appendLog("Added a new pipeline step."); }

  function duplicateStep(stepId: string) {
    setSteps((p) => { const i = p.findIndex((s) => s.id === stepId); if (i === -1) return p; const copy = { ...p[i], id: `${p[i].id}-copy-${Date.now()}`, name: `${p[i].name} Copy`, state: "queued" as StepState }; const n = [...p]; n.splice(i+1,0,copy); return n; });
    appendLog("Duplicated step.");
  }

  function removeStep(stepId: string) {
    setSteps((p) => { if (p.length <= 1) return p; const n = p.filter((s) => s.id !== stepId); if (selectedStepId === stepId && n[0]) setSelectedStepId(n[0].id); return n; });
    appendLog("Removed step.");
  }

  function handleAssistantSend() {
    const text = assistantInput.trim(); if (!text) return;
    const lower = text.toLowerCase(); appendLog(`Assistant: "${text}"`);
    if (lower.includes("run")) { setRunStatus("Running..."); setTimeout(() => setRunStatus("Complete."), 700); }
    else if (lower.includes("prompt")) { setStrategyPrompt((p) => `${p}\n\nRefinement: ${text}`); setPreviewStatus("Prompt updated."); }
    else if (lower.includes("preview")) { setPreviewStatus("Preview refreshed."); }
    else if (lower.includes("fix")) { setRunStatus("Queued correction."); }
    setAssistantInput("");
  }

  async function runStep() {
    const typeMap: Record<string,string> = {
      strategy: "script", copy: "script", validator: "script",
      imagery: "image", i2v: "video", assets: "script", qa: "script",
    };
    const genType = typeMap[selectedStep.id] || "script";
    const prompt = strategyPrompt || `Run ${selectedStep.name} for telehealth campaign`;
    setRunStatus(`Running: ${selectedStep.name}...`);
    setSteps((p) => p.map((s) => s.id === selectedStep.id ? { ...s, state: "running" } : s));
    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: genType, prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "API error");
      const gen = data.data;
      setSteps((p) => p.map((s) => s.id === selectedStep.id ? { ...s, state: "complete" } : s));
      setRunStatus(`✓ ${selectedStep.name} complete`);
      if (gen.output_url) setSampleBody(`Output: ${gen.output_url}`);
      if (gen.prompt) setSampleBody(gen.prompt.slice(0, 200));
      appendLog(`✓ ${selectedStep.name}: ${gen.status}`);
    } catch(e: any) {
      setSteps((p) => p.map((s) => s.id === selectedStep.id ? { ...s, state: "review" } : s));
      setRunStatus(`Error: ${e.message}`);
      appendLog(`✗ ${selectedStep.name} failed: ${e.message}`);
    }
  }

  function saveConfig() { appendLog(`Saved config for ${selectedStep.name}.`); setRunStatus("Configuration saved."); }

  function refreshSamples() {
    const h = inputValue.trim() || "How Online Care Works";
    const b = inputValue.trim() ? `Preview from: ${inputValue.trim().slice(0,80)}` : "Simple intake, licensed review, trusted next steps.";
    setSampleTitle(h); setSampleBody(b);
    setConcepts((p) => p.map((c,i) => i===0 ? { ...c, headline:h, body:b } : c));
    setPreviewStatus("Refreshed."); appendLog("Refreshed media samples.");
  }

  function selectConcept(id: string) {
    setSelectedConceptId(id);
    const c = concepts.find((x) => x.id === id);
    if (c) { setSampleTitle(c.headline); setSampleBody(c.body); appendLog(`Selected ${c.title}.`); }
  }

  async function buildSelectedConcept() {
    const concept = concepts.find((c) => c.id === selectedConceptId);
    const prompt = concept ? `${concept.headline}. ${concept.body}. Premium telehealth brand image. Clean, calm, clinical. Dark background.` : "Premium telehealth scene";
    setRunStatus("Generating image...");
    appendLog("Generating image from concept...");
    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "image", prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "API error");
      const gen = data.data;
      setRunStatus("✓ Image generated");
      if (gen.output_url) {
        setSampleTitle(concept?.headline || "Generated");
        setSampleBody(gen.output_url);
        appendLog("✓ Image ready: " + gen.output_url.slice(0,60) + "...");
      } else {
        appendLog("✓ Image submitted — status: " + gen.status);
        setRunStatus("Image generating... check Library in 60s");
      }
    } catch(e: any) {
      setRunStatus("Error: " + e.message);
      appendLog("✗ Image failed: " + e.message);
    }
  }

  return (
    <div style={{ minHeight:"100vh", background:"radial-gradient(circle at top left,rgba(168,85,247,0.16),transparent 24%),radial-gradient(circle at top right,rgba(34,211,238,0.14),transparent 24%),linear-gradient(180deg,#050816 0%,#070b1a 40%,#060816 100%)", color:"#fff", padding:24, fontFamily:"Inter,ui-sans-serif,system-ui,-apple-system,sans-serif" }}>
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
              <button key={i} style={{ ...buttonStyle(Boolean(active)), textAlign:"left", padding:16 }} onClick={() => appendLog(`Viewed: ${title}`)}>
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
                <div key={chip} style={{ padding:"10px 14px", borderRadius:14, border: i===0?"1px solid rgba(34,211,238,0.65)":"1px solid rgba(255,255,255,0.14)", background: i===0?"linear-gradient(90deg,rgba(217,70,239,0.18),rgba(34,211,238,0.10))":"rgba(255,255,255,0.05)", fontWeight:700, fontSize:14 }}>{chip}</div>
              ))}
            </div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              <button style={buttonStyle(false)} onClick={saveConfig}>Save</button>
              <button style={buttonStyle(false)} onClick={() => { setRunStatus("Paused."); appendLog("Pipeline paused."); }}>Pause</button>
              <button style={{ ...buttonStyle(true), background:"linear-gradient(90deg,rgba(217,70,239,0.85),rgba(34,211,238,0.88))" }} onClick={() => { setRunStatus("Running..."); setTimeout(() => setRunStatus("Complete."), 800); appendLog("Run full pipeline triggered."); }}>Run Full Pipeline</button>
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
                            <button style={{ ...buttonStyle(false), padding:8, minWidth:0 }} onClick={(e) => { e.stopPropagation(); duplicateStep(step.id); }} title="Duplicate">⧉</button>
                            <button style={{ ...buttonStyle(false), padding:8, minWidth:0 }} onClick={(e) => { e.stopPropagation(); removeStep(step.id); }} title="Delete">🗑</button>
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
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <button style={buttonStyle(false)} onClick={saveConfig}>Save Config</button>
                  <button style={{ ...buttonStyle(true), background:"linear-gradient(90deg,rgba(34,211,238,0.85),rgba(14,165,233,0.85))" }} onClick={runStep}>Run Step</button>
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
                <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:10 }}>
                  <input value={assistantInput} onChange={(e) => setAssistantInput(e.target.value)} placeholder="Ask anything or request a prompt, edit, fix, run, or preview." style={{ width:"100%", background:"rgba(0,0,0,0.26)", color:"#fff", border:"1px solid rgba(255,255,255,0.10)", borderRadius:16, padding:"14px 16px", fontSize:15, outline:"none" }} onKeyDown={(e) => { if(e.key==="Enter") handleAssistantSend(); }} />
                  <button style={buttonStyle(true)} onClick={handleAssistantSend}>Send</button>
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
                          <div style={{ borderRadius:16, border:"1px solid rgba(255,255,255,0.10)", background:"rgba(0,0,0,0.22)", padding:14, minHeight:200, display:"flex", flexDirection:"column" }}>
                            <div style={{ fontSize:10, letterSpacing:"0.24em", textTransform:"uppercase", color:"rgba(255,255,255,0.52)", marginBottom:12 }}>Preview Frame</div>
                            <div style={{ fontSize:22, fontWeight:800, lineHeight:1.1, marginBottom:10 }}>{concept.headline}</div>
                            <div style={{ fontSize:14, lineHeight:1.55, color:"rgba(255,255,255,0.84)", maxWidth:"90%" }}>{concept.body}</div>
                            <div style={{ marginTop:"auto", display:"flex", justifyContent:"space-between", gap:10 }}>
                              <div style={{ borderRadius:999, background:"#22d3ee", color:"#04121a", fontWeight:800, fontSize:12, padding:"8px 12px" }}>Select</div>
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
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                {MEDIA_INPUTS.map((item) => (
                  <button key={item} style={buttonStyle(false)} onClick={() => { setInputValue(item); appendLog(`${item} selected.`); }}>{item}</button>
                ))}
              </div>
              <div style={{ display:"grid", gap:12 }}>
                <div style={{ ...panelStyle(), padding:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                    <div style={{ fontSize:12, textTransform:"uppercase", letterSpacing:"0.18em", color:"rgba(255,255,255,0.56)" }}>Sample PNG Concepts</div>
                    <button style={buttonStyle(false)} onClick={refreshSamples}>Refresh</button>
                  </div>
                  <input value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Type source text or selected upload label..." style={{ width:"100%", background:"rgba(0,0,0,0.26)", color:"#fff", border:"1px solid rgba(255,255,255,0.10)", borderRadius:14, padding:"12px 14px", marginBottom:10, outline:"none" }} />
                  <div style={{ borderRadius:18, border:"1px solid rgba(255,255,255,0.10)", background:"radial-gradient(circle at top,rgba(34,211,238,0.10),transparent 28%),linear-gradient(180deg,rgba(10,14,35,0.96),rgba(4,8,24,0.98))", padding:12, minHeight:300 }}>
                    <div style={{ height:"100%", borderRadius:16, border:"1px solid rgba(255,255,255,0.10)", padding:14, display:"flex", flexDirection:"column" }}>
                      <div style={{ fontSize:10, letterSpacing:"0.24em", textTransform:"uppercase", color:"rgba(255,255,255,0.52)", marginBottom:10 }}>Three-step Reassurance Ad</div>
                      <div style={{ fontSize:18, fontWeight:800, lineHeight:1.15, marginBottom:10 }}>{sampleTitle}</div>
                      <div style={{ fontSize:14, lineHeight:1.55, color:"rgba(255,255,255,0.84)" }}>{sampleBody}</div>
                      <div style={{ marginTop:"auto", display:"flex", gap:8, flexWrap:"wrap" }}>
                        <button style={{ borderRadius:999, background:"#22d3ee", color:"#03131b", border:"none", fontWeight:800, padding:"8px 12px", cursor:"pointer" }} onClick={buildSelectedConcept}>Select &amp; Build</button>
                        <button style={{ borderRadius:999, background:"rgba(255,255,255,0.06)", color:"#fff", border:"1px solid rgba(255,255,255,0.12)", fontWeight:700, padding:"8px 12px", cursor:"pointer" }} onClick={() => setPreviewStatus("Preview opened.")}>Preview</button>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ ...panelStyle(), padding:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                    <div style={{ fontSize:12, textTransform:"uppercase", letterSpacing:"0.18em", color:"rgba(255,255,255,0.56)" }}>Selected Concept → Video Preview</div>
                    <button style={buttonStyle(false)} onClick={() => { setPreviewStatus("Video preview refreshed."); appendLog("Video preview refreshed."); }}>Refresh</button>
                  </div>
                  <div style={{ borderRadius:18, border:"1px solid rgba(255,255,255,0.10)", background:"radial-gradient(circle at top,rgba(34,211,238,0.10),transparent 28%),linear-gradient(180deg,rgba(10,14,35,0.96),rgba(4,8,24,0.98))", padding:12, minHeight:260 }}>
                    <div style={{ height:"100%", borderRadius:16, border:"1px solid rgba(255,255,255,0.10)", padding:14, display:"flex", flexDirection:"column" }}>
                      <div style={{ fontSize:10, letterSpacing:"0.24em", textTransform:"uppercase", color:"rgba(255,255,255,0.52)", marginBottom:10 }}>Motion Preview</div>
                      <div style={{ fontSize:18, fontWeight:800, lineHeight:1.15, marginBottom:10 }}>Private Care From Home</div>
                      <div style={{ fontSize:14, lineHeight:1.55, color:"rgba(255,255,255,0.84)" }}>Subtle camera motion, clean screen movement, reassuring pace.</div>
                      <div style={{ marginTop:"auto", display:"flex", gap:8, flexWrap:"wrap" }}>
                        <button style={{ borderRadius:999, background:"#22d3ee", color:"#03131b", border:"none", fontWeight:800, padding:"8px 12px", cursor:"pointer" }} onClick={async () => {
              const prompt = "Premium telehealth brand video. Calm doctor in minimal clinic. Soft cinematic camera push-in. 5 seconds.";
              setRunStatus("Submitting video to Kling...");
              appendLog("Submitting video generation...");
              try {
                const res = await fetch("/api/generations", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ type: "video", prompt, duration: "5s", aspectRatio: "16:9" }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "API error");
                const gen = data.data;
                setRunStatus("✓ Video submitted — task: " + (gen.external_id || gen.id)?.slice(0,12) + "...");
                appendLog("✓ Video pending — will complete in 2–5 min via cron");
              } catch(e: any) {
                setRunStatus("Error: " + (e as any).message);
                appendLog("✗ Video failed: " + (e as any).message);
              }
            }}>Start Video Build</button>
                        <button style={{ borderRadius:999, background:"rgba(255,255,255,0.06)", color:"#fff", border:"1px solid rgba(255,255,255,0.12)", fontWeight:700, padding:"8px 12px", cursor:"pointer" }} onClick={() => setRunStatus("Video prompt adjusted.")}>Adjust</button>
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
                  <button key={tab} style={{ ...buttonStyle(i===0), background: i===0?"linear-gradient(90deg,rgba(217,70,239,0.85),rgba(34,211,238,0.85))":"rgba(255,255,255,0.05)" }} onClick={() => appendLog(`Opened ${tab} tab.`)}>{tab}</button>
                ))}
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1.45fr 0.72fr", gap:14 }}>
              <div style={{ borderRadius:28, border:"1px solid rgba(255,255,255,0.12)", background:"linear-gradient(180deg,rgba(5,10,25,0.98),rgba(10,18,42,0.95))", padding:16, minHeight:330 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                  <div style={{ fontSize:18, fontWeight:800 }}>Primary Output Canvas</div>
                  <div style={{ borderRadius:12, border:"1px solid rgba(255,255,255,0.10)", background:"rgba(255,255,255,0.05)", padding:"8px 10px", fontSize:12 }}>1920 × 1080</div>
                </div>
                <div style={{ height:240, borderRadius:24, border:"1px solid rgba(255,255,255,0.10)", background:"radial-gradient(circle at center,rgba(34,211,238,0.08),transparent 35%),linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.98))" }} />
              </div>
              <div style={{ display:"grid", gap:12 }}>
                <div style={{ ...panelStyle(), padding:14 }}>
                  <div style={{ fontSize:18, fontWeight:800, marginBottom:10 }}>Run Status</div>
                  <div style={{ display:"grid", gap:8 }}>
                    {[["Planning","done"],["Concept Generation","active"],["Motion Render","queued"]].map(([label,status],i) => (
                      <div key={i} style={{ borderRadius:14, border: status==="active"?"1px solid rgba(34,211,238,0.25)":"1px solid rgba(255,255,255,0.10)", background: status==="active"?"rgba(34,211,238,0.10)":"rgba(255,255,255,0.04)", padding:"12px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span>{label}</span>
                        <span style={{ color: status==="done"?"#6ee7b7":status==="active"?"#67e8f9":"#94a3b8" }}>{status==="done"?"✓":status==="active"?"◔":"›"}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:12, fontSize:14, color:"rgba(255,255,255,0.78)" }}><strong>System:</strong> {runStatus}</div>
                  <div style={{ marginTop:6, fontSize:14, color:"rgba(255,255,255,0.78)" }}><strong>Preview:</strong> {previewStatus}</div>
                </div>
                <div style={{ ...panelStyle(), padding:14 }}>
                  <div style={{ fontSize:18, fontWeight:800, marginBottom:10 }}>Assistant Activity</div>
                  <div style={{ display:"grid", gap:8 }}>
                    {assistantLog.map((log,i) => (
                      <div key={i} style={{ borderRadius:14, border:"1px solid rgba(255,255,255,0.10)", background:"rgba(255,255,255,0.04)", padding:"12px 14px", fontSize:14, lineHeight:1.5, color:"rgba(255,255,255,0.86)" }}>{log}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop:12, color:"rgba(255,255,255,0.58)", fontSize:13, textAlign:"right" }}>
          Test page — route: /pipeline/test — no live files touched
        </div>
      </div>
    </div>
  );
}
