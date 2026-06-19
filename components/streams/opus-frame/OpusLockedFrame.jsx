"use client";

import { useEffect, useRef, useState } from "react";
import { compileFinalDirectorSetup } from "@/lib/admingeneration/compile-final-director-setup";
import {
  GENERATION_SETUP_TYPES,
  SELF_REFERENCE_CAPTURE_STEPS,
  VISUAL_LIBRARY_CARDS,
  buildSetupDurationPlan,
  getFieldOptions,
  getReferenceSelectionCards,
  getVisualCardsForType,
} from "@/lib/admingeneration/generation-setup-options";
import {
  createGuidedRecorder,
  requestGuidedCaptureStream,
  uploadGuidedCapture,
} from "@/lib/admingeneration/guided-capture-client";
import "./opus-locked-frame.css";
import "./opus-layout-unclipped.css";

const DEFAULT_PROJECT_ID = "fb7bf446-78c9-4905-80bc-32a19d0f9803";

const createTypes = [
  { id: "generate-from-scratch", title: "Generate From Scratch", icon: "✨", kind: "text-to-video", provider: "fal", ratio: "16:9" },
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
    mainPrompt: "A premium cinematic AI business operator promo showing a founder, mobile chat, builder workstations, media generation, and final launch workflow.",
    scene: "Premium AI business control room with mobile Streams chat, workstation panels, dashboard previews, and generation outputs.",
    subject: "Confident founder/operator and the Streams AI workspace working together.",
    environment: "Modern studio · dark-mode dashboard · clean UI panels · premium technology lighting.",
    emotionalIntent: "Trust, clarity, confidence, intelligence, and momentum.",
    shotType: "Medium close-up",
    cameraPosition: "Eye-level",
    cameraMovement: "Slow push in",
    lens: "50mm portrait lens feel",
    depthOfField: "Shallow cinematic depth of field",
    composition: "Centered subject with clean negative space for UI context",
    primaryLighting: "Soft studio key light",
    accentLighting: "Subtle UI glow",
    rimLight: "Cool blue rim light",
    atmosphere: "Clean premium tech atmosphere",
    characterMotion: "Natural speaking gestures and controlled hand movement",
    environmentMotion: "Subtle animated dashboard glow and soft parallax",
    motionQuality: "Smooth cinematic human realism",
    visualStyle: "Photorealistic premium commercial",
    filmReference: "Premium SaaS launch film",
    productionDesign: "Modern AI workspace / tech studio",
    humanRealism: "Natural face, accurate hands, stable identity",
    mood: "Premium, modern, polished, focused, high-tech",
    spokenIntent: "Introduce Streams AI as an all-in-one AI business operator.",
    preScriptLine: "Meet Streams AI — your all-in-one AI business operator.",
    performanceBeat: "Founder looks into camera, speaks confidently, and slightly leans forward.",
    gestureDirection: "Natural open-hand gesture while explaining.",
    facialExpression: "Confident, warm, trustworthy.",
    lipSyncNeed: "Yes — visible speaker",
    durationTarget: "10 seconds",
    voiceoverUseLater: "Yes",
    negativePrompt: "low quality, blurry, noisy, overexposed, poor anatomy, deformed hands, warped face, unreadable text, watermark, logo, extra limbs, duplicate, cartoon, anime, CGI, cheap stock footage",
    duration: "10",
    aspectRatio: "16:9",
    frameRate: "24 fps",
    qualityGoal: "High (Best Quality)",
    projectId: DEFAULT_PROJECT_ID,
  };
}

function readable(data) {
  if (!data) return "";
  if (typeof data === "string") return data;
  const value = data.result?.status || data.result?.blockedReason || data.result?.result?.status || data.status || data.error || data.message;
  if (value) return String(value);
  try { return JSON.stringify(data).slice(0, 500); } catch { return "Response returned without readable text."; }
}

function findOutputUrl(data) {
  return String(data?.outputUrl || data?.videoUrl || data?.assetUrl || data?.result?.outputUrl || data?.result?.result?.outputUrl || data?.result?.result?.artifactUrl || "");
}
function findAnalysisId(data) { return String(data?.analysisId || data?.analysis?.id || data?.result?.analysisId || data?.result?.analysis?.id || ""); }
function findGenerationId(data) { return String(data?.generationId || data?.result?.generationId || data?.result?.result?.generationId || ""); }

export default function OpusLockedFrame() {
  const fileRef = useRef(null);
  const previewVideoRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const [activeTypeId, setActiveTypeId] = useState("generate-from-scratch");
  const [generationTypeId, setGenerationTypeId] = useState("talking-head-founder-presenter");
  const [visualCardId, setVisualCardId] = useState("premium-saas-founder-promo");
  const [selectedReferenceType, setSelectedReferenceType] = useState("mid-shot-speaker");
  const [workflowMode, setWorkflowMode] = useState("structured-production");
  const [setupStage, setSetupStage] = useState("type-selector");
  const [fields, setFields] = useState(initialFields);
  const [provider, setProvider] = useState("fal");
  const [stage, setStage] = useState("generate");
  const [sourceUrl, setSourceUrl] = useState("");
  const [acceptedReferences, setAcceptedReferences] = useState([]);
  const [analysisId, setAnalysisId] = useState("");
  const [generationId, setGenerationId] = useState("");
  const [jobResult, setJobResult] = useState(null);
  const [outputUrl, setOutputUrl] = useState("");
  const [status, setStatus] = useState("Ready");
  const [isGenerating, setIsGenerating] = useState(false);
  const [helperOpen, setHelperOpen] = useState(false);
  const [helperMessages, setHelperMessages] = useState(["AI Helper ready."]);
  const [recordingStep, setRecordingStep] = useState(SELF_REFERENCE_CAPTURE_STEPS[0]);
  const [isRecording, setIsRecording] = useState(false);

  const selectedGenerationType = GENERATION_SETUP_TYPES.find((item) => item.id === generationTypeId) || GENERATION_SETUP_TYPES[0];
  const visualCards = getVisualCardsForType(generationTypeId);
  const selectedVisualCard = VISUAL_LIBRARY_CARDS.find((item) => item.id === visualCardId) || visualCards[0] || null;
  const directorSetup = compileFinalDirectorSetup({ fields, generationTypeId, visualCardId, visualCardTitle: selectedVisualCard?.title, provider, workflowMode, acceptedReferences });
  const durationPlan = directorSetup.durationPlan || buildSetupDurationPlan({ duration: fields.duration, provider, workflowMode });

  useEffect(() => { if (previewVideoRef.current && streamRef.current) previewVideoRef.current.srcObject = streamRef.current; }, [isRecording]);
  function setField(key, value) { setFields((current) => ({ ...current, [key]: value })); }
  function applyGenerationType(item) {
    setGenerationTypeId(item.id); setProvider(item.provider); setField("aspectRatio", item.aspectRatio); setWorkflowMode(item.id === "freestyle-draft" ? "freestyle-draft" : "structured-production");
    const firstCard = getVisualCardsForType(item.id)[0];
    if (firstCard) { setVisualCardId(firstCard.id); setFields((current) => ({ ...current, ...firstCard.fieldPreset })); }
    setSetupStage(item.id === "freestyle-draft" ? "director-setup" : "visual-library");
  }
  function applyVisualCard(card) { setVisualCardId(card.id); setFields((current) => ({ ...current, ...card.fieldPreset })); setSetupStage("reference-intake"); }
  function applyReferenceCard(card) { setSelectedReferenceType(card.referenceType); setStatus(`Selected reference type: ${card.title}`); setSetupStage("reference-intake"); }

  async function uploadReferenceFile(file, role = "uploaded-reference") {
    const form = new FormData(); form.append("file", file); form.append("projectId", fields.projectId || DEFAULT_PROJECT_ID); form.append("requestedProfile", "admin_full"); form.append("referenceType", role);
    const response = await fetch("/api/admingeneration/reference/upload-and-analyze", { method: "POST", body: form });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok === false) throw new Error(data?.error || `Reference upload failed (${response.status}).`);
    const next = { type: data.asset?.assetType || role, role, assetId: data.asset?.assetId || null, url: data.asset?.sourceUrl || data.asset?.storage?.publicUrl || data.analysis?.sourceUrl || "", analysisId: data.analysisId || data.analysis?.id || null, accepted: true };
    setAcceptedReferences((current) => [...current, next]); if (next.analysisId) setAnalysisId(next.analysisId); setStatus(`Accepted reference: ${role}.`); return next;
  }
  async function onReferenceFileChange(event) { const file = event.target.files?.[0]; if (!file) return; try { await uploadReferenceFile(file, selectedReferenceType || selectedVisualCard?.referenceTypes?.[0] || "uploaded-reference"); setSetupStage("director-setup"); } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); } finally { if (fileRef.current) fileRef.current.value = ""; } }
  async function startGuidedRecording() {
    try {
      const stream = await requestGuidedCaptureStream(); streamRef.current = stream;
      const recorder = createGuidedRecorder(stream, async (blob) => {
        setIsRecording(false);
        try { const data = await uploadGuidedCapture({ blob, projectId: fields.projectId || DEFAULT_PROJECT_ID, referenceType: recordingStep.referenceType }); const next = { type: "video", role: recordingStep.referenceType, assetId: data.asset?.assetId || null, url: data.asset?.sourceUrl || data.asset?.storage?.publicUrl || "", analysisId: data.analysisId || data.analysis?.id || null, accepted: true }; setAcceptedReferences((current) => [...current, next]); if (next.analysisId) setAnalysisId(next.analysisId); setStatus(`Guided recording accepted: ${recordingStep.title}.`); setSetupStage("director-setup"); } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
      });
      recorderRef.current = recorder; recorder.start(); setIsRecording(true); setStatus(`Recording: ${recordingStep.title}.`); setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 6000);
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  }
  function stopGuidedRecording() { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); streamRef.current?.getTracks?.().forEach((track) => track.stop()); }
  async function analyzeSourceUrl() {
    const url = sourceUrl.trim(); if (!url) { setStatus("Paste a video/reference link first."); return; }
    setStatus("Analyzing source link…");
    try { const response = await fetch("/api/admingeneration/intake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "auto", url, source: "generation-workspace" }) }); const data = await response.json().catch(() => null); const nextAnalysisId = findAnalysisId(data); if (nextAnalysisId) setAnalysisId(nextAnalysisId); setStatus(response.ok ? "Source analyzed." : "Source analyzer blocked/error."); setHelperMessages((items) => [...items, `Source analysis: ${readable(data)}`].slice(-8)); } catch (error) { setStatus("Source analysis failed."); setHelperMessages((items) => [...items, `Source analysis failed: ${error instanceof Error ? error.message : String(error)}`].slice(-8)); }
  }
  async function generateNow() {
    setIsGenerating(true); setStatus("Submitting generation job…"); setSetupStage("generating");
    try {
      const setup = compileFinalDirectorSetup({ fields, generationTypeId, visualCardId, visualCardTitle: selectedVisualCard?.title, provider, workflowMode, acceptedReferences });
      if (workflowMode === "structured-production" && setup.missingRequiredItems.length) { setStatus(setup.missingRequiredItems[0]); setSetupStage("director-setup"); return; }
      const anchor = acceptedReferences.find((ref) => ref.url) || null;
      const kind = workflowMode === "freestyle-draft" ? "text-to-video" : anchor?.url ? "image-to-video" : selectedGenerationType.kind;
      const response = await fetch("/api/admingeneration/routed-submit-v2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, provider: workflowMode === "freestyle-draft" ? "fal" : provider, projectId: fields.projectId, workspaceId: fields.projectId, prompt: workflowMode === "freestyle-draft" ? fields.mainPrompt : setup.providerReadyPrompt, aspectRatio: fields.aspectRatio === "N/A" ? undefined : fields.aspectRatio, duration: workflowMode === "freestyle-draft" ? "5s" : `${setup.durationPlan.requestedDurationSeconds}s`, longVideo: setup.durationPlan.requiresStitching, sourceImageUrl: anchor?.url || undefined, imageUrl: anchor?.url || undefined, storyBible: setup.storyBible, metadata: { source: "admingeneration-gap-finish-pass", workflowMode, generationTypeId, visualCardId, selectedReferenceType, acceptedReferences, finalDirectorSetup: setup, durationPlan: setup.durationPlan, fields } }) });
      const data = await response.json().catch(() => null); setJobResult(data); setOutputUrl(findOutputUrl(data)); setGenerationId(findGenerationId(data)); const nextAnalysisId = findAnalysisId(data); if (nextAnalysisId) setAnalysisId(nextAnalysisId); setStage("result"); setSetupStage("result"); setStatus(response.ok ? "Generation request submitted through runtime." : "Generation blocked/error."); setHelperMessages((items) => [...items, `Generation result: ${readable(data)}`].slice(-8));
    } catch (error) { setStatus("Generation failed."); setHelperMessages((items) => [...items, `Generation failed: ${error instanceof Error ? error.message : String(error)}`].slice(-8)); } finally { setIsGenerating(false); }
  }
  function openOutputEditor() { if (analysisId) { window.open(`/admingeneration/editor?analysisId=${encodeURIComponent(analysisId)}`, "_blank", "noopener,noreferrer"); return; } if (generationId) { window.open(`/admingeneration/editor?generationId=${encodeURIComponent(generationId)}`, "_blank", "noopener,noreferrer"); return; } setStatus("Output editor needs a real analysis ID or generation ID."); }
  function renderCenterSetup() {
    if (workflowMode === "freestyle-draft" && setupStage !== "generating" && setupStage !== "result") return <FreestyleDraftPanel fields={fields} setField={setField} generateNow={generateNow} isGenerating={isGenerating} setWorkflowMode={setWorkflowMode} />;
    if (setupStage === "type-selector") return <TypeSelector selectedId={generationTypeId} onSelect={applyGenerationType} />;
    if (setupStage === "visual-library") return <VisualLibrary selectedId={selectedReferenceType} visualCards={visualCards} selectedVisualId={visualCardId} onSelectVisual={applyVisualCard} onSelectReference={applyReferenceCard} />;
    if (setupStage === "reference-intake") return <ReferenceIntake selectedReferenceType={selectedReferenceType} selectedVisualCard={selectedVisualCard} acceptedReferences={acceptedReferences} fileRef={fileRef} onReferenceFileChange={onReferenceFileChange} recordingStep={recordingStep} setRecordingStep={setRecordingStep} isRecording={isRecording} startGuidedRecording={startGuidedRecording} stopGuidedRecording={stopGuidedRecording} previewVideoRef={previewVideoRef} continueToDirector={() => setSetupStage("director-setup")} />;
    if (setupStage === "director-setup") return <DirectorSetupPanel setup={directorSetup} fields={fields} setField={setField} generateNow={generateNow} isGenerating={isGenerating} />;
    if (setupStage === "generating") return <GeneratingPanel status={status} durationPlan={durationPlan} />;
    return <PreviewSetup outputUrl={outputUrl} status={status} openOutputEditor={openOutputEditor} />;
  }
  return <main className="opus-fit-shell"><div className="opus-board"><aside className="opus-left"><div className="opus-logo-row"><div className="streams-logo-mark">◆</div><div><div className="opus-logo-title">STREAMS</div><div className="opus-logo-sub">AI Video Control Room</div></div></div><nav className="opus-nav">{["Home","Projects","Generate","Assets","Analytics","Settings"].map((item,index)=><button className={`opus-nav-item ${index===0?"active":""}`} key={item} type="button"><span>{index===0?"⌂":"▧"}</span><strong>{item}</strong></button>)}</nav><div className="left-plan-card"><small>PLAN</small><strong>Pro Plan</strong><span>Credits 2,450 / 5,000</span><i><b /></i></div><div className="left-source-card"><strong>Source / Reference</strong><div className="source-actions"><button type="button" onClick={()=>fileRef.current?.click()}>Import File</button><button type="button">YouTube Link</button></div><input value={sourceUrl} onChange={(event)=>setSourceUrl(event.target.value)} placeholder="Paste video or reference link" /><button onClick={analyzeSourceUrl} type="button">Analyze Link</button><small>{analysisId?`Analysis ${analysisId.slice(0,8)}…`:"No analysis loaded"}</small></div></aside><section className="opus-main compact-shell"><header className="workspace-topbar"><div><h1>{stage==="generate"?"AI Generation Setup":outputUrl?"Generated Video Ready":"Request Saved / Output Pending"}</h1><p>Guided setup routes into the existing runtime and full second-pass editor.</p></div><div className="account-cluster"><span className="status-dot">● SYSTEM ONLINE</span><button type="button">Credits: 2,450</button><button className="upgrade" type="button">Upgrade</button><button onClick={()=>setHelperOpen(true)} type="button">AI Helper</button></div></header>{stage==="generate"?<div className="movie-generate-state"><section className="compact-prompt-top"><div className="mode-row generation-modes">{["structured-production","freestyle-draft","assistant"].map((item)=><button className={`mode ${workflowMode===item?"active":""}`} key={item} onClick={()=>item==="assistant"?setHelperOpen(true):setWorkflowMode(item)} type="button">{item==="structured-production"?"✦ Structured Production":item==="freestyle-draft"?"⚡ Freestyle Draft":"✨ AI Assistant"}</button>)}</div><div className="prompt-and-cards"><label className="wide-prompt-field"><span>Describe what you want to create…</span><textarea value={fields.mainPrompt} onChange={(event)=>setField("mainPrompt",event.target.value)} /><b>{fields.mainPrompt.length} / 2000</b></label><div className="prompt-chip-row"><button type="button" onClick={()=>setSetupStage("type-selector")}>Type</button><button type="button" onClick={()=>setSetupStage("visual-library")}>Visual Library</button><button type="button" onClick={()=>setSetupStage("reference-intake")}>References</button><button type="button" onClick={()=>setSetupStage("director-setup")}>Final Setup</button><button className="generate-cta" disabled={isGenerating} onClick={generateNow} type="button">{isGenerating?"Submitting…":"Generate ✨"}</button></div></div><div className="create-type-strip compact">{createTypes.map((item)=><button className={`create-type-card ${item.id===activeTypeId?"active":""}`} key={item.id} onClick={()=>{setActiveTypeId(item.id);setProvider(item.provider);setField("aspectRatio",item.ratio);}} type="button"><span>{item.icon}</span><strong>{item.title}</strong><small>{item.kind}</small></button>)}</div></section><section className="movie-production-stage"><aside className="production-column left-prod"><ProductionCard title="1. Scene" fieldKey="scene" value={fields.scene} onChange={(value)=>setField("scene",value)} textarea /><ProductionCard title="2. Subject" fieldKey="subject" value={fields.subject} onChange={(value)=>setField("subject",value)} textarea /><ProductionCard title="3. Environment" fieldKey="environment" value={fields.environment} onChange={(value)=>setField("environment",value)} textarea /><ProductionCard title="4. Emotional Intent" fieldKey="emotionalIntent" value={fields.emotionalIntent} onChange={(value)=>setField("emotionalIntent",value)} textarea /><ProductionCard title="5. Mood" fieldKey="mood" value={fields.mood} onChange={(value)=>setField("mood",value)} /></aside><div className="center-preview-stack"><div className="preview-toolbar"><div><strong>{selectedGenerationType.title}</strong><span>{status}</span></div><div><button type="button" onClick={()=>setSetupStage("type-selector")}>Type</button><button type="button" onClick={()=>setSetupStage("visual-library")}>Library</button><button type="button" onClick={()=>setSetupStage("reference-intake")}>Intake</button><button type="button" onClick={()=>setSetupStage("director-setup")}>Setup</button></div></div><div className="large-center-preview">{renderCenterSetup()}</div><div id="streams-preview-analyzer-slot" className="preview-analyzer-slot" /><div className="mini-keyframes-row">{Array.from({length:Math.min(durationPlan.requiredClipCount||1,8)}).map((_,index)=><button className={index===0?"active":""} key={index} type="button"><span>{durationPlan.requiresStitching?`clip ${index+1}`:`${index}s`}</span></button>)}</div></div><aside className="production-column right-prod"><ProductionGroup title="6. Camera" fields={fields} setField={setField} keys={["shotType","cameraPosition","cameraMovement","lens","depthOfField","composition"]} /><ProductionGroup title="7. Lighting" fields={fields} setField={setField} keys={["primaryLighting","accentLighting","rimLight","atmosphere"]} /><ProductionGroup title="8. Motion" fields={fields} setField={setField} keys={["characterMotion","environmentMotion","motionQuality"]} /><ProductionGroup title="9. Style" fields={fields} setField={setField} keys={["visualStyle","filmReference","productionDesign","humanRealism"]} /><ProductionGroup title="10. Script / Performance Guide" fields={fields} setField={setField} keys={["spokenIntent","preScriptLine","performanceBeat","gestureDirection","facialExpression","lipSyncNeed","durationTarget","voiceoverUseLater"]} /></aside></section><section className="movie-output-band"><div className="negative-card"><strong>11. Negative Prompt / Restrictions</strong><textarea value={fields.negativePrompt} onChange={(event)=>setField("negativePrompt",event.target.value)} /></div><div className="output-card"><strong>12. Output Settings</strong><div className="output-inline-fields"><label><span>Provider</span><select value={provider} onChange={(event)=>setProvider(event.target.value)}><option value="openai">OpenAI</option><option value="fal">fal.ai</option><option value="runway">Runway</option><option value="kling">Kling</option><option value="veo">Veo</option><option value="elevenlabs">ElevenLabs</option></select></label><label><span>Duration</span><input value={fields.duration} onChange={(event)=>setField("duration",event.target.value)} /></label><label><span>Aspect</span><input value={fields.aspectRatio} onChange={(event)=>setField("aspectRatio",event.target.value)} /></label><label><span>Frame Rate</span><input value={fields.frameRate} onChange={(event)=>setField("frameRate",event.target.value)} /></label><label><span>Quality</span><input value={fields.qualityGoal} onChange={(event)=>setField("qualityGoal",event.target.value)} /></label><button disabled={isGenerating} onClick={generateNow} type="button">{isGenerating?"Submitting…":durationPlan.requiresStitching?`Generate ${durationPlan.requiredClipCount}-Clip Video ✨`:"Generate Video ✨"}</button></div><small>{durationPlan.userMessage}</small></div></section></div>:<ResultWorkspace fields={fields} status={status} outputUrl={outputUrl} jobResult={jobResult} setStage={setStage} generateNow={generateNow} isGenerating={isGenerating} openOutputEditor={openOutputEditor} />}</section><aside className="right-utility-rail"><section className="utility-card quick"><h3>Quick Actions</h3><button type="button" onClick={()=>{setStage("generate");setSetupStage("type-selector");}}>＋ New Project <span>Start from guided setup</span></button><button type="button" onClick={()=>setWorkflowMode("freestyle-draft")}>⚡ Freestyle Draft <span>Fast cheap sample</span></button><button type="button" onClick={()=>setHelperOpen(true)}>✦ AI Assistant <span>Get help & ideas</span></button><button type="button" onClick={()=>fileRef.current?.click()}>⇧ Upload Assets <span>Images, videos, audio</span></button></section><section className="utility-card system"><h3>System Status</h3><div className="green-status">All Systems Operational <b>●</b></div><p>Submit Route <span>/api/admingeneration/routed-submit-v2</span></p><p>Runtime <span>generateVideo()</span></p><p>Editor <span>FullOutputEditor</span></p><div className="usage-bar"><i /></div></section><section className="utility-card recent"><h3>Accepted References</h3>{acceptedReferences.length?acceptedReferences.slice(-4).map((ref,index)=><p key={`${ref.role}-${index}`} style={{color:"#9fb0c8",fontSize:12}}>{ref.role}</p>):<p style={{color:"#9fb0c8",fontSize:12}}>No accepted references yet.</p>}</section></aside><input ref={fileRef} type="file" accept="video/*,audio/*,image/*,.pdf" onChange={onReferenceFileChange} style={{display:"none"}} />{helperOpen?<div className="helper-backdrop" onClick={()=>setHelperOpen(false)}><aside className="helper-panel" onClick={(event)=>event.stopPropagation()}><div className="helper-head"><div><h3>AI Helper / Analyzer</h3><p>Proof prompts, inspect provider fit, and guide output edits.</p></div><button onClick={()=>setHelperOpen(false)} type="button">×</button></div><div className="helper-thread">{helperMessages.map((message,index)=><div className="helper-message assistant" key={index}><strong>AI Helper</strong><p>{message}</p></div>)}</div><textarea placeholder="Ask for prompt proofing, provider routing, or output edit guidance…" readOnly value="" /><div className="helper-actions"><button onClick={()=>setHelperMessages((items)=>[...items,"Prompt proof requested."].slice(-8))} type="button">Proof Prompt</button><button onClick={()=>setHelperOpen(false)} type="button">Close</button></div></aside></div>:null}</div></main>;
}
function TypeSelector({ selectedId, onSelect }) { return <div className="analysis-float-card" style={{ position: "relative", width: "min(820px, 96%)", margin: "0 auto" }}><strong>What do you want to generate?</strong><p>Choose the starting point. Providers stay behind the setup unless you open settings.</p><div className="create-type-strip compact" style={{ marginTop: 16 }}>{GENERATION_SETUP_TYPES.map((item)=><button className={`create-type-card ${item.id===selectedId?"active":""}`} key={item.id} onClick={()=>onSelect(item)} type="button"><span>{item.id==="freestyle-draft"?"⚡":"🎬"}</span><strong>{item.title}</strong><small>{item.description}</small></button>)}</div></div>; }
function VisualLibrary({ selectedId, onSelectReference, visualCards, selectedVisualId, onSelectVisual }) { const referenceCards=getReferenceSelectionCards(); return <div className="analysis-float-card" style={{ position:"relative", width:"min(920px, 98%)", margin:"0 auto", padding:8, background:"#ffffff", color:"#111827", borderRadius:4 }}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 8px"}}><strong>Choose a strong reference image type</strong><small>Provider-ready visual guide library</small></div><div style={{display:"grid",gridTemplateColumns:"repeat(3, minmax(0, 1fr))",gap:4}}>{referenceCards.map((card)=><button key={card.id} onClick={()=>onSelectReference(card)} type="button" style={{border:selectedId===card.referenceType?"3px solid #2563eb":"1px solid #d1d5db",background:"#fff",padding:0,cursor:"pointer",color:"#111827",textAlign:"center",minHeight:126}}><div style={{fontWeight:800,fontSize:12,padding:"4px 3px"}}>{card.number}. {card.title}</div><div style={{height:76,display:"grid",placeItems:"center",background:card.gradient,fontSize:30,color:"#fff",overflow:"hidden"}}><span>{card.preview}</span></div><div style={{fontSize:10,padding:"4px 3px",lineHeight:1.15}}>{card.subtitle}</div></button>)}</div>{visualCards?.length?<div style={{marginTop:8,padding:8,borderTop:"1px solid #e5e7eb"}}><strong style={{fontSize:12}}>Visual direction presets</strong><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>{visualCards.map((card)=><button key={card.id} onClick={()=>onSelectVisual(card)} type="button" style={{border:card.id===selectedVisualId?"2px solid #2563eb":"1px solid #d1d5db",background:"#f8fafc",borderRadius:8,padding:"7px 9px",fontSize:11,color:"#111827"}}>{card.title}</button>)}</div></div>:null}</div>; }
function ReferenceIntake({ selectedReferenceType, selectedVisualCard, acceptedReferences, fileRef, recordingStep, setRecordingStep, isRecording, startGuidedRecording, stopGuidedRecording, previewVideoRef, continueToDirector }) { const required=selectedVisualCard?.referenceTypes||[]; return <div className="analysis-float-card" style={{ position:"relative", width:"min(860px,96%)", margin:"0 auto" }}><strong>Guided Reference Intake</strong><p>Selected reference type: <b>{selectedReferenceType}</b></p><p>Upload or record this reference. Files route through the existing upload-and-analyze system.</p><div className="prompt-chip-row" style={{justifyContent:"center",marginTop:12}}><button type="button" onClick={()=>fileRef.current?.click()}>Upload Reference</button><button type="button" onClick={isRecording?stopGuidedRecording:startGuidedRecording}>{isRecording?"Stop Recording":"Record Guided Sample"}</button><button type="button" onClick={continueToDirector}>Continue to Final Setup</button></div><select value={recordingStep.id} onChange={(event)=>setRecordingStep(SELF_REFERENCE_CAPTURE_STEPS.find((step)=>step.id===event.target.value)||SELF_REFERENCE_CAPTURE_STEPS[0])} style={{marginTop:12}}><option value="face-close-up">Face close-up</option><option value="mid-shot-speaker">Mid-shot speaker</option><option value="gesture-sample">Gesture sample</option></select><p>{recordingStep.instruction}</p>{isRecording?<video ref={previewVideoRef} autoPlay muted playsInline style={{width:"min(360px,100%)",borderRadius:16}} />:null}<div style={{marginTop:10}}><strong>Visual preset also recommends:</strong><p>{required.length?required.join(", "):"No extra required references for this visual option."}</p><strong>Accepted:</strong><p>{acceptedReferences.length?acceptedReferences.map((ref)=>ref.role).join(", "):"None yet."}</p></div></div>; }
function DirectorSetupPanel({ setup, setField, generateNow, isGenerating }) { return <div className="analysis-float-card" style={{position:"relative",width:"min(920px,96%)",margin:"0 auto"}}><strong>Final Director Setup</strong><p>Editable summary of what will be generated. This is the provider-ready source of truth.</p>{setup.missingRequiredItems.length?<p style={{color:"#fecaca"}}>{setup.missingRequiredItems[0]}</p>:null}<textarea value={setup.providerReadyPrompt} onChange={(event)=>setField("mainPrompt",event.target.value)} style={{width:"100%",minHeight:170,borderRadius:14,padding:12,background:"#020617",color:"#fff",border:"1px solid rgba(148,163,184,.25)"}} /><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:10}}><textarea value={setup.scriptPerformanceGuide} onChange={(event)=>setField("preScriptLine",event.target.value)} style={{minHeight:90,borderRadius:14,padding:12,background:"#020617",color:"#fff",border:"1px solid rgba(148,163,184,.25)"}} /><div><strong>Duration Plan</strong><p>{setup.durationPlan.userMessage}</p><button className="generate-cta" disabled={isGenerating||setup.missingRequiredItems.length>0} onClick={generateNow} type="button">{isGenerating?"Submitting…":setup.durationPlan.requiresStitching?`Generate ${setup.durationPlan.requiredClipCount}-Clip Video`:"Generate Video"}</button></div></div></div>; }
function FreestyleDraftPanel({ fields, setField, generateNow, isGenerating, setWorkflowMode }) { return <div className="analysis-float-card" style={{position:"relative",width:"min(820px,96%)",margin:"0 auto"}}><strong>Freestyle Draft</strong><p>Fast cheap sample clip for brainstorming. No required fields, no required references, no longform.</p><textarea value={fields.mainPrompt} onChange={(event)=>setField("mainPrompt",event.target.value)} style={{width:"100%",minHeight:150,borderRadius:14,padding:12,background:"#020617",color:"#fff",border:"1px solid rgba(148,163,184,.25)"}} /><div className="prompt-chip-row" style={{justifyContent:"center",marginTop:12}}><button className="generate-cta" disabled={isGenerating} onClick={generateNow} type="button">Generate 5s Draft</button><button type="button" onClick={()=>setWorkflowMode("structured-production")}>Upgrade to Structured Production</button></div></div>; }
function GeneratingPanel({ status, durationPlan }) { return <div className="analysis-float-card" style={{position:"relative",width:"min(760px,96%)",margin:"0 auto"}}><strong>Generating</strong><p>{status}</p><p>{durationPlan.userMessage}</p><p>Runtime stages: submit → provider jobs → polling → durable artifact → editor handoff.</p></div>; }
function PreviewSetup({ outputUrl, status, openOutputEditor }) { return <div className="analysis-float-card" style={{position:"relative",width:"min(760px,96%)",margin:"0 auto"}}><strong>{outputUrl?"Output Ready":"Output Pending"}</strong><p>{status}</p>{outputUrl?<button type="button" onClick={()=>window.open(outputUrl,"_blank","noopener,noreferrer")}>Open Output</button>:null}<button className="primary" onClick={openOutputEditor} type="button">Open in Full Editor</button></div>; }
function ProductionCard({ title, fieldKey, value, onChange, textarea=false }) { const options=getFieldOptions(fieldKey); return <label className="production-card"><span>{title}</span>{options.length?<select value={value} onChange={(event)=>onChange(event.target.value)}>{options.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}<option value={value}>{value}</option></select>:null}{textarea?<textarea value={value} onChange={(event)=>onChange(event.target.value)} />:<input value={value} onChange={(event)=>onChange(event.target.value)} />}</label>; }
function ProductionGroup({ title, fields, setField, keys }) { return <section className="production-group-card"><strong>{title}</strong><div>{keys.map((key)=><ProductionCard key={key} title={key.replace(/([A-Z])/g," $1")} fieldKey={key} value={fields[key]||""} onChange={(value)=>setField(key,value)} />)}</div></section>; }
function ResultWorkspace({ fields, status, outputUrl, jobResult, setStage, generateNow, isGenerating, openOutputEditor }) { const hasRealOutput=Boolean(outputUrl); return <div className="result-state-grid tighter"><section className="result-main-card tighter"><div className="result-action-bar"><div><strong>{hasRealOutput?"✅ Generated Video Ready":"🟡 Generation Request Saved"}</strong><span>{fields.duration}s · {fields.aspectRatio} · {fields.frameRate} · {status}</span></div><div><button disabled={!hasRealOutput} type="button" onClick={()=>outputUrl&&window.open(outputUrl,"_blank","noopener,noreferrer")}>Download</button><button disabled={isGenerating} onClick={generateNow} type="button">Regenerate</button><button disabled={isGenerating} onClick={generateNow} type="button">Create Variation</button><button onClick={()=>setStage("generate")} type="button">Edit Prompt</button><button className="primary" onClick={openOutputEditor} type="button">Open in Full Editor</button></div></div><div className={`output-player ${hasRealOutput?"ready":"blocked"}`}>{hasRealOutput?(outputUrl.match(/\.(mp4|webm|mov)(\?|$)/i)?<video src={outputUrl} controls playsInline />:<img src={outputUrl} alt="Generated output" />):<div className="no-output-state compact"><strong>No real output file returned yet</strong><p>The job request is saved. This screen will not show a fake generated video.</p><code>{readable(jobResult)||"Awaiting provider output"}</code></div>}<div className="video-controls result-controls"><b>▶</b><span>0:00 / 0:{String(fields.duration||8).padStart(2,"0")}</span><i /><em>CC</em><em>1x</em><em>⛶</em></div></div></section><aside className="result-summary-rail tighter"><SummaryCard title="Generation Summary" text={hasRealOutput?"A generated output is available.":"Request saved. Real provider output has not returned yet."} /><SummaryCard title="Prompt Snapshot" text={fields.mainPrompt} /><SummaryCard title="Camera Settings Summary" text={`${fields.cameraMovement} · ${fields.shotType} · ${fields.lens}`} /></aside></div>; }
function SummaryCard({ title, text }) { return <section className="summary-card"><h3>{title}</h3><p>{text}</p></section>; }
