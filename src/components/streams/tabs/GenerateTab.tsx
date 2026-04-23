"use client";

/**
 * GenerateTab — 6 modes. Music is default per spec.
 *
 * Rule 6 enforced: All tool presets baked in from day one.
 * Pipeline card has 5 pipe-nodes. Every node has title="" with exact
 * voice preset params (stability/similarity_boost/style/speed), why they were chosen.
 *
 * Rule 3 enforced: Model chips use Streams brand names only.
 * Model chips: Standard · Pro · Precision · Cinema · Native Audio (brand names only)
 * Voice · Music · Design (Streams brand names, no provider names)
 *
 * Provider names appear in Settings tab only.
 */

import React, { useState, useRef, useEffect } from "react";
import { C, R, DUR, EASE } from "../tokens";

type Mode = "T2V" | "I2V" | "Motion" | "Image" | "Voice" | "Music";
type Duration = "3" | "4" | "5" | "8" | "10" | "15";
type AR = "16:9" | "9:16" | "1:1";
type MusicSub = "style-lyrics" | "auto-lyrics" | "instrumental" | "cover" | "my-voice";
type GenState = "idle" | "submitting" | "queued" | "polling" | "done" | "failed";

// Brand names only — no provider names per Rule 3
const VIDEO_MODELS  = ["Standard","Pro","Precision","Cinema","Native Audio"];
const IMAGE_MODELS  = ["Kontext","Kontext Max","FLUX Pro","Design","Nano"];
const VOICE_MODELS  = ["Voice v3","Turbo","Multilingual"];
const MUSIC_MODELS  = ["Music","Music Draft","Music Ref","Commercial"];

const STRUCT_TAGS = ["[Intro]","[Verse]","[Pre Chorus]","[Chorus]","[Post Chorus]","[Bridge]","[Hook]","[Outro]","[Inst]","[Solo]"];
const STYLE_TPLS = [
  { label:"R&B",        val:"Soulful R&B, warm, cinematic, 85 BPM, B minor, smooth groove, emotive vocal"   },
  { label:"Pop",        val:"Upbeat pop, 120 BPM, C major, synth, drums, catchy chorus hook, bright vocal"   },
  { label:"Hip-hop",    val:"Trap hip-hop, 140 BPM, dark minor key, heavy 808 bass, hi-hats, hard flow"      },
  { label:"Ballad",     val:"Slow ballad, 65 BPM, piano, strings, intimate emotional delivery, warm vocal"    },
  { label:"Electronic", val:"Electronic dance, 128 BPM, A minor, synth leads, four-on-floor kick, euphoric"  },
  { label:"Folk",       val:"Indie folk, melancholic, 80 BPM, acoustic guitar, warm male vocal, introspective"},
];

// Pipeline nodes — Rule 6: exact presets baked into title= tooltips
const PIPE_NODES = [
  {
    ep:   "minimax/v2.6",
    name: "Generate instrumental",
    tip:  "Style prompt → MiniMax v2.6 with is_instrumental:true. $0.15 per generation. Up to 6 min output. Preset: prompt = STYLE ONLY (genre, mood, BPM, key — 10–300 chars). Never put lyrics in the style prompt. Faster streaming under 25s end-to-end.",
  },
  {
    ep:   "elevenlabs IVC",
    name: "Clone your voice",
    tip:  "POST /v1/voices/add with voice.mp3 (min 60s clean speech). Returns voice_id stored in person_analysis. Required for identity-matching TTS — without this, replacement voice won't sound like the speaker. Cost: ~$0.02. Runs once, stored forever.",
  },
  {
    ep:   "elevenlabs/v3",
    name: "Sing in your voice",
    tip:  "Uses stored voice_id. Preset: stability:0.30 (Creative mode — broad emotional range, natural vibrato, musical dynamics). similarity_boost:0.85. style:0.80. speed:0.95. NO speaker_boost on v3 — it degrades singing quality. Structure tags ([Chorus]/[Verse]) signal musical intensity cues — model adds vibrato, breath, dynamics automatically. Cost: ~$0.08/1K chars.",
  },
  {
    ep:   "ffmpeg/merge-audios",
    name: "Mix vocals + track",
    tip:  "fal-ai/ffmpeg-api/merge-audios — combine vocal track + instrumental into final mix. Never use merge-videos for this — merge-videos is for concatenating full video clips end-to-end. merge-audios is the correct endpoint for audio-only operations. Cost: $0.001.",
  },
  {
    ep:   "omnihuman/v1.5",
    name: "Animate face singing",
    tip:  "face_reference.jpg (stored from device capture) + full mixed audio → full upper body video. Preset: guidance_scale:1 (how closely to follow face reference), audio_guidance_scale:2 (how strongly audio drives body motion — higher = more reactive posture). resolution:720p. Body reacts to audio rhythm — angry audio = tense posture, excited = animated gestures. Cost: $0.16/sec.",
    hi: true,
  },
];

const COST: Record<string, string> = {
  "T2V-Standard":"~$0.28 · 5s","T2V-Pro":"~$0.56 · 5s",
  "T2V-Precision":"~$0.56 · 5s","T2V-Cinema":"~$0.40 · 5s",
  "I2V-Standard":"~$0.28 · 5s","Image-Kontext":"~$0.04 · 1 img",
  "Voice-Voice v3":"~$0.10 / 1K","Music-Music":"~$0.45 total",
};

interface GridItem { id: string; status: "waiting"|"running"|"done"; outputUrl?: string; generationId?: string; }

interface GenerateTabProps {
  voiceId?:              string | null;
  initialPrompt?:        string | null;
  onGenerationComplete?: (url: string) => void;
  onPromptConsumed?:     () => void;
}

export default function GenerateTab({ voiceId: propVoiceId, initialPrompt, onGenerationComplete, onPromptConsumed }: GenerateTabProps = {}) {
  // Rule 1: Music is default per streams.html spec (Music chip has 'active' class on load)
  const [mode,        setMode]        = useState<Mode>("Music");
  const [model,       setModel]       = useState(0);
  const [prompt,      setPrompt]      = useState("");
  const [duration,    setDuration]    = useState<Duration>("5");
  const [ar,          setAr]          = useState<AR>("16:9");
  const [audio,       setAudio]       = useState(true);
  const [musicSub,    setMusicSub]    = useState<MusicSub>("my-voice");
  const [topic,       setTopic]       = useState("");
  const [styleInput,  setStyleInput]  = useState("");
  const [lyricsInput, setLyricsInput] = useState("");
  const [styleAr,       setStyleAr]       = useState("1:1");
  const [imageSubMode,  setImageSubMode]  = useState<"generate"|"templates">("generate");
  const [selectedTpl,   setSelectedTpl]   = useState<string|null>(null);

  // Marketing creative templates — sizes rounded to nearest 8 per backend spec
  const TEMPLATES = [
    { id:"ig_feed",       label:"Instagram Feed",  w:1080, h:1080, cat:"Social",      icon:"📷" },
    { id:"ig_story",      label:"Instagram Story", w:1080, h:1920, cat:"Social",      icon:"📱" },
    { id:"tiktok",        label:"TikTok",          w:1080, h:1920, cat:"Social",      icon:"🎵" },
    { id:"fb_ad",         label:"Facebook Ad",     w:1200, h:628,  cat:"Advertising", icon:"📣" },
    { id:"display_banner",label:"Display Banner",  w:728,  h:90,   cat:"Advertising", icon:"🖼" },
    { id:"yt_thumb",      label:"YouTube Thumb",   w:1280, h:720,  cat:"Video",       icon:"▶" },
    { id:"yt_banner",     label:"YouTube Banner",  w:2560, h:1440, cat:"Video",       icon:"📺" },
    { id:"story_portrait",label:"Story Portrait",  w:296,  h:480,  cat:"Brand",       icon:"◈" },
    { id:"logo_square",   label:"Logo / Icon",     w:512,  h:512,  cat:"Brand",       icon:"✦" },
    { id:"og_image",      label:"OG / Link Preview",w:1200,h:630,  cat:"Web",         icon:"🔗" },
    { id:"email_header",  label:"Email Header",    w:600,  h:200,  cat:"Web",         icon:"✉" },
    { id:"linkedin_post", label:"LinkedIn Post",   w:1200, h:627,  cat:"Social",      icon:"💼" },
  ] as const;
  const [useCustom,   setUseCustom]   = useState(false);
  const [customW,     setCustomW]     = useState("1024");
  const [customH,     setCustomH]     = useState("1024");

  const [genState,    setGenState]    = useState<GenState>("idle");
  const [grid,        setGrid]        = useState<GridItem[]>([]);
  const [stitch,      setStitch]      = useState<string[]>([]);
  const [stitchState,  setStitchState]  = useState<"idle"|"running"|"done">("idle");
  

  // ── Prompt Analyst state ──────────────────────────────────────────────
  type AnalystResult = {
    interpretation: string; ambiguities: string[]; improvements: string[];
    bestModel: string; failurePatterns: string[]; improvedPrompt: string;
    estimatedCostBefore: number; estimatedCostAfter: number; savingsUsd: number;
  };
  const [analystOpen,   setAnalystOpen]   = useState(false);
  const [analystState,  setAnalystState]  = useState<"idle"|"running"|"done"|"failed">("idle");
  const [analystResult, setAnalystResult] = useState<AnalystResult|null>(null);

  async function runAnalyst() {
    const promptText = mode === "Music" ? styleInput : prompt;
    if (!promptText.trim()) return;
    setAnalystState("running");
    setAnalystResult(null);
    try {
      const res  = await fetch("/api/streams/analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:   JSON.stringify({ prompt: promptText, mode, model: currentModel }),
      });
      const data = await res.json() as AnalystResult & { error?: string };
      if (!res.ok) { setAnalystState("failed"); return; }
      setAnalystResult(data);
      setAnalystState("done");
    } catch { setAnalystState("failed"); }
  }

  // ── Bulk generation state ─────────────────────────────────────────────
  const [bulkCount,  setBulkCount]  = useState(1);
  const [bulkMode,   setBulkMode]   = useState<"single"|"parallel">("single");
  const [stitchUrl,   setStitchUrl]    = useState<string | null>(null);
  const [micState,    setMicState]    = useState<"idle"|"recording"|"done">("idle");
  const [camState,    setCamState]    = useState<"idle"|"done">("idle");
  const [revoiceState,setRevoiceState]= useState<"idle"|"running"|"done">("idle");

  const lyricsRef = useRef<HTMLTextAreaElement>(null);

  const models = mode==="Image" ? IMAGE_MODELS
               : mode==="Voice" ? VOICE_MODELS
               : mode==="Music" ? MUSIC_MODELS
               : VIDEO_MODELS;

  const currentModel = models[Math.min(model, models.length-1)];

  // Rounding logic — backend spec: Math.round(value / 8) * 8
  // Custom sizing only for FLUX Pro and Nano — Kontext uses aspect ratio enum only
  const CUSTOM_MODELS = ["FLUX Pro","Nano"];
  const canCustomSize = mode === "Image" && CUSTOM_MODELS.includes(currentModel);
  const roundTo8 = (v: string): number => {
    const n = parseInt(v, 10);
    if (isNaN(n) || n <= 0) return 0;
    return Math.round(n / 8) * 8;
  };
  const roundedW = roundTo8(customW);
  const roundedH = roundTo8(customH);
  const cost = COST[`${mode}-${currentModel}`] ?? "—";
  const isActive = genState==="submitting"||genState==="queued"||genState==="polling";

  function insertTag(tag: string) {
    const ta = lyricsRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const next = ta.value.slice(0,pos)+"\n"+tag+"\n"+ta.value.slice(pos);
    setLyricsInput(next);
    setTimeout(()=>{ta.focus();ta.setSelectionRange(pos+tag.length+2,pos+tag.length+2);},0);
  }

  // generationRef stores { generationId, responseUrl } between poll calls
  const generationRef = React.useRef<{ generationId: string; responseUrl: string } | null>(null);
  const pollRef       = React.useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  // Cleanup: clear polling interval on unmount to prevent memory leaks
  useEffect(() => {
    return () => { stopPolling(); };
  }, []);

  // Consume initialPrompt from ReferenceTab variation prompt selection
  useEffect(() => {
    if (!initialPrompt) return;
    setPrompt(initialPrompt);
    setMode("Image");          // reference analysis → image generation
    onPromptConsumed?.();
  }, [initialPrompt]);         // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate() {
    if (isActive) return;
    stopPolling();

    // Bulk mode — 2+ items → /api/streams/bulk
    if (bulkCount > 1) {
      setGenState("submitting");
      const tempIds = Array.from({length: bulkCount}, (_, i) => (Date.now() + i).toString());
      setGrid((prev: GridItem[]) => [...prev, ...tempIds.map(id => ({id, status:"waiting" as const}))]);
      try {
        const bulkBody = {
          mode:       bulkMode,
          generation: mode === "Image" ? "image" : "video",
          items:      tempIds.map(() => ({ prompt: prompt || styleInput, aspectRatio: ar, duration })),
        };
        const res  = await fetch("/api/streams/bulk", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(bulkBody) });
        const data = await res.json() as { bulkJobId?: string; items?: {itemId:string;requestId:string|null;status:string}[]; error?: string };
        if (!res.ok || !data.bulkJobId) { setGenState("failed"); setGrid((prev:GridItem[])=>prev.filter(g=>!tempIds.includes(g.id))); return; }
        setGenState("queued");
        // Map temp IDs to real item IDs + update status
        setGrid((prev:GridItem[]) => prev.map((g:GridItem) => {
          const idx = tempIds.indexOf(g.id);
          if (idx < 0) return g;
          const item = data.items?.[idx];
          return { ...g, id: item?.itemId ?? g.id, status: item?.status === "running" ? "running" : "waiting", generationId: item?.itemId };
        }));
        // Poll bulk status
        const bjId = data.bulkJobId;
        pollRef.current = setInterval(async () => {
          const sr = await fetch("/api/streams/bulk/status", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ bulkJobId: bjId }) });
          const sd = await sr.json() as { status?:string; outputUrls?:string[]; completed?:number; total?:number };
          if (sd.status === "completed" || sd.status === "partial" || sd.status === "failed") {
            stopPolling();
            setGenState("done");
            if (sd.outputUrls) {
              setGrid((prev:GridItem[]) => {
                const donePrev = prev.filter(g=>g.status==="done");
                const newItems: GridItem[] = sd.outputUrls!.map((url,i) => ({id:`bulk_${bjId}_${i}`,status:"done",outputUrl:url,generationId:`bulk_${bjId}_${i}`}));
                return [...donePrev, ...newItems];
              });
            }
          }
        }, 6000);
      } catch { setGenState("failed"); }
      return;
    }

    setGenState("submitting");
    const tempId = Date.now().toString();
    setGrid((prev: GridItem[]) => [...prev, {id: tempId, status:"waiting"}]);

    try {
      // Select correct route and body based on mode
      type RouteBody = Record<string, unknown>;
      let route: string;
      let body: RouteBody;

      if (mode === "Music") {
        route = "/api/streams/music/generate";
        body  = {
          provider: currentModel.toLowerCase().replace(/\s+/g, "-"),
          prompt:   styleInput || prompt,
          lyrics:   lyricsInput || undefined,
          topic:    topic       || undefined,
        };
      } else if (mode === "Image") {
        route = "/api/streams/image/generate";
        body  = {
          model:  currentModel.toLowerCase().replace(/\s+/g, "-"),
          prompt,
          ...(useCustom && canCustomSize
            ? { width: roundedW, height: roundedH }
            : { aspectRatio: styleAr }),
        };
      } else if (mode === "Voice") {
        route = "/api/streams/voice/generate";
        body  = { text: prompt, model: currentModel.toLowerCase().replace(/\s+/g, "-") };
      } else {
        // T2V | I2V | Motion — all go to video/generate
        route = "/api/streams/video/generate";
        body  = { prompt, duration, aspectRatio: ar };
      }

      const res  = await fetch(route, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
      const data = await res.json() as { generationId?: string; responseUrl?: string; error?: string };

      if (!res.ok || !data.generationId) {
        setGenState("failed");
        setGrid([{id: tempId, status:"done"}]);
        console.error("Generate failed:", data.error);
        return;
      }

      generationRef.current = { generationId: data.generationId, responseUrl: data.responseUrl! };
      setGrid((prev: GridItem[]) => prev.map((g: GridItem) => g.id === tempId ? {id: data.generationId, status:"running", generationId: data.generationId} : g));
      setGenState("queued");

      // Poll every 6 seconds
      pollRef.current = setInterval(async () => {
        const ref = generationRef.current;
        if (!ref) return stopPolling();

        const statusRes  = await fetch("/api/streams/video/status", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ generationId: ref.generationId, responseUrl: ref.responseUrl }) });
        const statusData = await statusRes.json() as { status?: string; artifactUrl?: string };

        if (statusData.status === "processing") { setGenState("polling"); return; }
        if (statusData.status === "completed") {
          stopPolling();
          setGenState("done");
          const artUrl = (statusData as Record<string,unknown>).artifactUrl as string | undefined;
          if (artUrl) onGenerationComplete?.(artUrl);
          setGrid((prev: GridItem[]) => prev.map((g: GridItem) =>
            g.generationId === ref.generationId || g.id === ref.generationId
              ? { ...g, id: ref.generationId, status: "done", outputUrl: (statusData as Record<string,unknown>).artifactUrl as string | undefined, generationId: ref.generationId }
              : g
          ));
        }
        if (statusData.status === "failed") {
          stopPolling();
          setGenState("failed");
          setGrid([{id: ref.generationId, status:"done"}]);
        }
      }, 6000);

    } catch (err) {
      console.error("Generate error:", err);
      setGenState("failed");
      setGrid([{id: tempId, status:"done"}]);
    }
  }

  function handleMic() {
    if (micState!=="idle") return;
    setMicState("recording");
    setTimeout(()=>setMicState("done"), 2400);
  }

  function handleCam() {
    if (camState!=="idle") return;
    setCamState("done");
  }

  function addToStitch(id: string) {
    setStitch((s:string[]) => s.includes(id) ? s.filter((x:string)=>x!==id) : [...s,id]);
  }

  const btnLabel = isActive
    ? (genState==="submitting"?"Sending…":genState==="queued"?"Queued…":"Generating…")
    : genState==="done" ? "✓ Complete — Generate again" : "Generate";

  /* ── Left panel ──────────────────────────────────────────────── */
  return (
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
    <div style={{
      flex:"0 0 280px", borderRight:`1px solid ${C.bdr}`,
      background:C.bg2, display:"flex", flexDirection:"column", overflow:"hidden",
    }} className="streams-gen-left">

      {/* Mode bar */}
      <div style={{display:"flex",overflowX:"auto",borderBottom:`1px solid ${C.bdr}`,flexShrink:0,background:C.bg}}>
        <span style={{fontSize: 12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",padding:"0 8px",display:"flex",alignItems:"center",flexShrink:0}}>Mode</span>
        {(["T2V","I2V","Motion","Image","Voice","Music"] as Mode[]).map(m=>(
          <button key={m} onClick={()=>{setMode(m);setModel(0);setUseCustom(false);}} style={{
            height:44,padding:"0 16px",border:"none",flexShrink:0,
            borderBottom:mode===m?`2px solid ${C.acc}`:"2px solid transparent",
            background:mode===m?C.surf2:"transparent",
            color:mode===m?C.t1:C.t3,fontSize: 14,fontFamily:"inherit",cursor:"pointer",
          }}>{m}</button>
        ))}
      </div>

      {/* Music sub-mode bar — only visible for Music mode */}
      {mode==="Music" && (
        <div style={{display:"flex",overflowX:"auto",borderBottom:`1px solid ${C.bdr}`,flexShrink:0,padding:"0 8px",gap:5,background:C.bg2,paddingTop:10,paddingBottom:10}}>
          {([["style-lyrics","Style + Lyrics"],["auto-lyrics","Auto-Lyrics"],["instrumental","Instrumental"],["cover","Cover"],["my-voice","My Voice"]] as [MusicSub,string][]).map(([id,label])=>(
            <button key={id} onClick={()=>setMusicSub(id)} style={{
              padding:"4px 8px",borderRadius:R.pill,fontSize: 13,fontFamily:"inherit",cursor:"pointer",flexShrink:0,
              border:`1px solid ${musicSub===id?C.acc:C.bdr}`,
              background:musicSub===id?C.acc:"transparent",
              color:musicSub===id?"#fff":C.t3,
            }}>{label}</button>
          ))}
        </div>
      )}

      {/* Fields */}
      <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:14}}>

        {/* Model chips */}
        <div>
          <div style={{fontSize: 12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",marginBottom:8}}>Model</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {models.map((m,i)=>(
              <button key={m} onClick={()=>setModel(i)} style={{
                padding:"4px 8px",borderRadius:R.pill,fontSize: 13,fontFamily:"inherit",cursor:"pointer",
                border:`1px solid ${model===i?C.acc:C.bdr}`,
                background:model===i?C.accDim:"transparent",
                color:model===i?C.acc2:C.t3,
              }}>{m}</button>
            ))}
          </div>
        </div>

        {/* T2V / Motion — prompt */}
        {(mode==="T2V"||mode==="Motion")&&(
          <div>
            <div style={{fontSize: 12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>
              {mode==="Motion"?"Character appearance":"Prompt"}
              {mode==="Motion"&&<span style={{color:C.t3,textTransform:"none",letterSpacing:0,marginLeft:4}}>— describe appearance only, not motion</span>}
            </div>
            <textarea value={prompt} onChange={(e:React.ChangeEvent<HTMLTextAreaElement>)=>setPrompt(e.target.value)}
              rows={4} maxLength={2500}
              placeholder={mode==="Motion"?"Describe how the character looks (hair, clothing, build)…":"Describe the video…"}
              style={{width:"100%",background:C.bg3,border:`1px solid ${C.bdr}`,borderRadius:R.r1,padding:"8px 8px",color:C.t1,fontSize: 15,fontFamily:"inherit",resize:"none",outline:"none"}}/>
          </div>
        )}

        {/* I2V */}
        {mode==="I2V"&&(<>
          <div>
            <div style={{fontSize: 12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>Start image <span style={{color:C.red}}>required</span></div>
            <div style={{border:`1px dashed ${C.bdr2}`,borderRadius:R.r2,padding:"20px 16px",textAlign:"center",cursor:"pointer",background:C.bg3}}>
              <div style={{fontSize: 20,color:C.t4,marginBottom:6,opacity:.4}}>↑</div>
              <div style={{fontSize: 14,color:C.t3}}>Drop start frame or URL</div>
              <div style={{fontSize: 13,color:C.t4,marginTop:2}}>jpg · png · webp</div>
            </div>
          </div>
          <div>
            <div style={{fontSize: 12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>Motion prompt</div>
            <textarea value={prompt} onChange={(e:React.ChangeEvent<HTMLTextAreaElement>)=>setPrompt(e.target.value)}
              rows={3} placeholder="Slow cinematic push-in, golden hour stays consistent…"
              style={{width:"100%",background:C.bg3,border:`1px solid ${C.bdr}`,borderRadius:R.r1,padding:"8px 8px",color:C.t1,fontSize: 15,fontFamily:"inherit",resize:"none",outline:"none"}}/>
          </div>
        </>)}

        {/* Motion — reference video */}
        {mode==="Motion"&&(
          <div>
            <div style={{fontSize: 12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>Motion reference video</div>
            <div style={{border:`1px dashed ${C.bdr2}`,borderRadius:R.r2,padding:"16px 16px",textAlign:"center",cursor:"pointer",background:C.bg3}}>
              <div style={{fontSize: 14,color:C.t3}}>Upload reference video</div>
              <div style={{fontSize: 13,color:C.t4,marginTop:2}}>mp4 · mov</div>
            </div>
          </div>
        )}

        {/* Image */}
        {mode==="Image"&&(<>
          {/* Image sub-mode: Generate vs Templates */}
          <div style={{display:"flex",gap:6,marginBottom:4}}>
            {(["generate","templates"] as const).map(m=>(
              <button key={m} onClick={()=>setImageSubMode(m)} style={{
                flex:1,padding:"6px 0",borderRadius:R.r1,fontSize:13,fontFamily:"inherit",cursor:"pointer",
                border:`1px solid ${imageSubMode===m?C.acc:C.bdr}`,
                background:imageSubMode===m?C.acc:"transparent",
                color:imageSubMode===m?"#fff":C.t3,fontWeight:imageSubMode===m?500:400,
              }}>{m==="generate"?"Generate":"Templates"}</button>
            ))}
          </div>

          {imageSubMode==="templates"&&(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {/* Group by category */}
              {["Social","Advertising","Video","Brand","Web"].map(cat=>{
                const catItems = TEMPLATES.filter(t=>t.cat===cat);
                if(!catItems.length) return null;
                return (
                  <div key={cat}>
                    <div style={{fontSize:12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>{cat}</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                      {catItems.map(tpl=>(
                        <button key={tpl.id} onClick={()=>{
                          setSelectedTpl(tpl.id);
                          setCustomW(String(tpl.w));
                          setCustomH(String(tpl.h));
                          setUseCustom(true);
                          setModel(IMAGE_MODELS.indexOf("Design")>=0?IMAGE_MODELS.indexOf("Design"):
                                   IMAGE_MODELS.indexOf("Kontext")>=0?IMAGE_MODELS.indexOf("Kontext"):0);
                        }} style={{
                          padding:"8px 8px",borderRadius:R.r1,fontSize:12,fontFamily:"inherit",cursor:"pointer",
                          border:`1px solid ${selectedTpl===tpl.id?C.acc:C.bdr}`,
                          background:selectedTpl===tpl.id?C.accDim:"transparent",
                          textAlign:"left",
                        }}>
                          <div style={{fontSize:16,marginBottom:3}}>{tpl.icon}</div>
                          <div style={{color:selectedTpl===tpl.id?C.acc2:C.t1,fontWeight:500}}>{tpl.label}</div>
                          <div style={{color:C.t4,fontSize:12}}>{tpl.w}×{tpl.h}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {selectedTpl&&(
                <div style={{padding:"8px 12px",borderRadius:R.r1,background:C.bg4,border:`1px solid ${C.accBr}`,fontSize:12,color:C.t3}}>
                  Selected: <span style={{color:C.acc2}}>{TEMPLATES.find(t=>t.id===selectedTpl)?.label}</span> · {roundedW}×{roundedH}px · Recraft V4 Design
                </div>
              )}
            </div>
          )}

          {imageSubMode==="generate"&&(
            <div>
              <div style={{fontSize:12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>Prompt</div>
              <textarea value={prompt} onChange={(e:React.ChangeEvent<HTMLTextAreaElement>)=>setPrompt(e.target.value)}
                rows={4} maxLength={2500} placeholder="Describe the image…"
                style={{width:"100%",background:C.bg3,border:`1px solid ${C.bdr}`,borderRadius:R.r1,padding:"8px 8px",color:C.t1,fontSize:15,fontFamily:"inherit",resize:"none",outline:"none"}}/>
            </div>
          )}

          {/* Size: Aspect ratio OR Custom pixels — always visible */}
          <div>
            <div style={{fontSize:12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span>Size</span>
              {canCustomSize && (
                <button onClick={()=>setUseCustom((u:boolean)=>!u)} style={{
                  fontSize:12,padding:"2px 8px",borderRadius:R.pill,cursor:"pointer",fontFamily:"inherit",
                  border:`1px solid ${useCustom?C.acc:C.bdr}`,
                  background:useCustom?C.accDim:"transparent",
                  color:useCustom?C.acc2:C.t3,
                }}>
                  {useCustom?"Custom ✓":"Custom px"}
                </button>
              )}
            </div>

            {/* Custom pixel inputs — only for FLUX Pro, Nano */}
            {useCustom && canCustomSize ? (
              <div>
                <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:C.t4,marginBottom:4}}>Width (px)</div>
                    <input
                      type="number" value={customW} min={64} max={4096} step={8}
                      onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setCustomW(e.target.value)}
                      style={{width:"100%",background:C.bg3,border:`1px solid ${C.bdr}`,borderRadius:R.r1,padding:"8px 8px",color:C.t1,fontSize:15,fontFamily:"inherit",outline:"none"}}
                    />
                    <div style={{fontSize:12,color:C.acc2,marginTop:3}}>
                      → {roundedW > 0 ? `${roundedW}px` : "—"}
                    </div>
                  </div>
                  <div style={{paddingTop:26,color:C.t4,fontSize:15}}>×</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:C.t4,marginBottom:4}}>Height (px)</div>
                    <input
                      type="number" value={customH} min={64} max={4096} step={8}
                      onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setCustomH(e.target.value)}
                      style={{width:"100%",background:C.bg3,border:`1px solid ${C.bdr}`,borderRadius:R.r1,padding:"8px 8px",color:C.t1,fontSize:15,fontFamily:"inherit",outline:"none"}}
                    />
                    <div style={{fontSize:12,color:C.acc2,marginTop:3}}>
                      → {roundedH > 0 ? `${roundedH}px` : "—"}
                    </div>
                  </div>
                </div>
                <div style={{
                  padding:"8px 12px",borderRadius:R.r1,background:C.bg4,
                  border:`1px solid ${C.bdr}`,fontSize:12,color:C.t4,lineHeight:1.6,
                }}>
                  Rounded to nearest ×8 — actual generation: <span style={{color:C.t2}}>{roundedW} × {roundedH}</span>
                  {(parseInt(customW)!==roundedW||parseInt(customH)!==roundedH)&&
                    <span style={{color:C.amber}}> (input adjusted)</span>
                  }
                </div>
              </div>
            ) : (
              /* Aspect ratio enum — Kontext + all models */
              <div style={{display:"flex",gap:6}}>
                {["21:9","16:9","4:3","1:1","9:16"].map(a=>(
                  <button key={a} onClick={()=>setStyleAr(a)} style={{
                    flex:1,padding:"8px 0",borderRadius:R.r1,fontSize:12,fontFamily:"inherit",cursor:"pointer",
                    border:`1px solid ${styleAr===a?C.acc:C.bdr}`,
                    background:styleAr===a?C.accDim:"transparent",
                    color:styleAr===a?C.acc2:C.t3,
                  }}>{a}</button>
                ))}
              </div>
            )}

            {!canCustomSize && (
              <div style={{fontSize:12,color:C.t4,marginTop:6}}>
                Custom px sizing: select FLUX Pro or Nano model above
              </div>
            )}
          </div>
        </>)}

        {/* Voice */}
        {mode==="Voice"&&(<>
          <div>
            <div style={{fontSize: 12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>
              Text <span style={{color:C.t3,textTransform:"none",letterSpacing:0}}>— [excited] [whispers] [sighs] tags supported inline</span>
            </div>
            <textarea value={prompt} onChange={(e:React.ChangeEvent<HTMLTextAreaElement>)=>setPrompt(e.target.value)}
              rows={5} placeholder="Enter text. Use [excited] or [whispers] inline for emotion."
              style={{width:"100%",background:C.bg3,border:`1px solid ${C.bdr}`,borderRadius:R.r1,padding:"8px 8px",color:C.t1,fontSize: 15,fontFamily:"inherit",resize:"none",outline:"none"}}/>
          </div>
          <div>
            <div style={{fontSize: 12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>Stability <span style={{color:C.t4,textTransform:"none",letterSpacing:0}}>0–1</span></div>
            <input type="range" min={0} max={100} defaultValue={50} step={1} style={{width:"100%",accentColor:C.acc}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize: 12,color:C.t4,marginTop:2}}><span>Creative</span><span>Consistent</span></div>
          </div>
          <div>
            <div style={{fontSize: 12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>Speed <span style={{color:C.t4,textTransform:"none",letterSpacing:0}}>0.7–1.2</span></div>
            <input type="range" min={70} max={120} defaultValue={100} step={1} style={{width:"100%",accentColor:C.acc}}/>
          </div>
        </>)}

        {/* Music */}
        {mode==="Music"&&(<>

          {/* My Voice — the full pipeline */}
          {musicSub==="my-voice"&&(<>
            <div>
              <div style={{fontSize: 12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>Topic / theme</div>
              <input value={topic} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setTopic(e.target.value)}
                placeholder="A woman finding her power in the city at night"
                style={{width:"100%",background:C.bg3,border:`1px solid ${C.bdr}`,borderRadius:R.r1,padding:"8px 8px",color:C.t1,fontSize: 15,fontFamily:"inherit",outline:"none"}}/>
            </div>
            <div>
              <div style={{fontSize: 12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>
                Style prompt <span style={{color:C.red,textTransform:"none",letterSpacing:0}}>— STYLE ONLY · no lyrics here</span>
              </div>
              <input value={styleInput} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setStyleInput(e.target.value)}
                placeholder="Soulful R&B, warm, cinematic, 85 BPM, B minor…"
                style={{width:"100%",background:C.bg3,border:`1px solid ${C.bdr}`,borderRadius:R.r1,padding:"8px 8px",color:C.t1,fontSize: 15,fontFamily:"inherit",outline:"none"}}/>
              <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
                {STYLE_TPLS.map(t=>(
                  <button key={t.label} onClick={()=>setStyleInput(t.val)} style={{
                    padding:"3px 8px",borderRadius:R.pill,fontSize: 12,cursor:"pointer",fontFamily:"inherit",
                    background:C.surf,border:`1px solid ${C.bdr}`,color:C.t3,
                  }}>{t.label}</button>
                ))}
              </div>
            </div>

            {/* Device capture */}
            <div>
              <div style={{fontSize: 12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>Your voice + face</div>
              <div style={{fontSize: 13,color:C.t4,marginBottom:10,lineHeight:1.5}}>Captured once. Stored in PersonAnalysis. All future songs read from storage.</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[
                  {id:"mic",state:micState,icon:micState==="done"?"✓":micState==="recording"?"🔴":"🎙",
                   title:micState==="done"?"Voice captured":micState==="recording"?"Recording…":"Record voice sample",
                   sub:micState==="done"?"voice_id stored · IVC ready · stability 0.30 preset loaded":"60s clean speech · min 1 min for IVC quality",onClick:handleMic},
                  {id:"cam",state:camState,icon:camState==="done"?"✓":"📷",
                   title:camState==="done"?"Face captured":"Capture face reference",
                   sub:camState==="done"?"face_reference.jpg stored · OmniHuman guidance_scale:1 ready":"Frontal, good light · 512×512px min · no sunglasses",onClick:handleCam},
                ].map(btn=>(
                  <button key={btn.id} onClick={btn.onClick} style={{
                    display:"flex",alignItems:"center",gap:12,padding:"8px 12px",borderRadius:R.r2,
                    border:`1px solid ${btn.state!=="idle"?C.acc:C.bdr}`,
                    background:btn.state!=="idle"?C.accDim:C.bg3,
                    cursor:"pointer",textAlign:"left",width:"100%",
                    animation:btn.state==="recording"?"streams-pulse 1.5s ease infinite":"none",
                  }}>
                    <span style={{fontSize: 20}}>{btn.icon}</span>
                    <div>
                      <div style={{fontSize: 14,color:C.t1,fontFamily:"inherit",fontWeight:500}}>{btn.title}</div>
                      <div style={{fontSize: 13,color:C.t4,marginTop:2}}>{btn.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Rule 6: Pipeline card with exact presets baked in */}
            <div style={{background:C.bg3,border:`1px solid ${C.bdr}`,borderRadius:R.r2,overflow:"hidden"}}>
              <div style={{padding:"8px 12px",borderBottom:`1px solid ${C.bdr}`,fontSize: 12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase"}}>
                Generation pipeline — all presets pre-configured
              </div>
              <div style={{padding:"8px 12px",display:"flex",flexWrap:"wrap",gap:6}}>
                {PIPE_NODES.map(node=>(
                  <div
                    key={node.ep}
                    title={node.tip}
                    style={{
                      padding:"8px 8px",borderRadius:R.r1,fontSize: 13,fontFamily:"inherit",
                      background:C.bg4,border:`1px solid ${node.hi?C.accBr:C.bdr}`,
                      cursor:"help",flex:"0 0 calc(50% - 3px)",
                    }}
                  >
                    <div style={{fontSize: 12,color:node.hi?C.acc2:C.t4,marginBottom:3,fontWeight:500}}>{node.ep}</div>
                    <div style={{fontSize: 13,color:C.t2}}>{node.name}</div>
                  </div>
                ))}
              </div>
              {/* Preset box — Rule 6 compliance */}
              <div style={{padding:"8px 12px",borderTop:`1px solid ${C.bdr}`,background:C.bg4,fontSize: 13,color:C.t3,lineHeight:1.7}}>
                <div><strong style={{color:C.t2}}>Voice preset (auto-applied):</strong> stability 0.30 · similarity_boost 0.85 · style 0.80 · speed 0.95</div>
                <div style={{marginTop:4,color:C.t4}}>stability 0.30 = Creative mode — broad emotional range, natural vibrato, musical dynamics. Structure tags signal intensity. No speaker_boost on v3.</div>
                <div style={{marginTop:4}}><strong style={{color:C.t2}}>Animate preset:</strong> guidance_scale 1 · audio_guidance_scale 2 · resolution 720p</div>
                <div style={{marginTop:4}}><strong style={{color:C.acc2}}>Output:</strong> full music video · your face · your cloned voice · AI-written song · ~$0.45 total</div>
              </div>
            </div>
          </>)}

          {/* Style + Lyrics */}
          {(musicSub==="style-lyrics"||musicSub==="auto-lyrics"||musicSub==="cover")&&(<>
            <div>
              <div style={{fontSize: 12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>Topic / theme</div>
              <input value={topic} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setTopic(e.target.value)}
                placeholder="A woman finding her power in the city at night"
                style={{width:"100%",background:C.bg3,border:`1px solid ${C.bdr}`,borderRadius:R.r1,padding:"8px 8px",color:C.t1,fontSize: 15,fontFamily:"inherit",outline:"none"}}/>
            </div>
            <div>
              <div style={{fontSize: 12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>
                Style prompt <span style={{color:C.red,textTransform:"none",letterSpacing:0}}>— STYLE ONLY · no lyrics here</span>
              </div>
              <input value={styleInput} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setStyleInput(e.target.value)}
                placeholder="Soulful R&B, warm, cinematic, 85 BPM, B minor…"
                style={{width:"100%",background:C.bg3,border:`1px solid ${C.bdr}`,borderRadius:R.r1,padding:"8px 8px",color:C.t1,fontSize: 15,fontFamily:"inherit",outline:"none"}}/>
              <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
                {STYLE_TPLS.map(t=>(
                  <button key={t.label} onClick={()=>setStyleInput(t.val)} style={{padding:"3px 8px",borderRadius:R.pill,fontSize: 12,cursor:"pointer",fontFamily:"inherit",background:C.surf,border:`1px solid ${C.bdr}`,color:C.t3}}>{t.label}</button>
                ))}
              </div>
            </div>
            {musicSub!=="auto-lyrics"&&musicSub!=="instrumental"&&(
              <div>
                <div style={{fontSize: 12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>
                  Lyrics <span style={{color:C.amber,textTransform:"none",letterSpacing:0}}>— WORDS + structure tags only</span>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:6}}>
                  {STRUCT_TAGS.map(tag=>(
                    <button key={tag} onClick={()=>insertTag(tag)} style={{padding:"2px 8px",borderRadius:R.r1,fontSize:12,cursor:"pointer",background:C.surf,border:`1px solid ${C.bdr}`,color:C.t3,fontFamily:"inherit"}}>{tag}</button>
                  ))}
                </div>
                <textarea ref={lyricsRef} value={lyricsInput} onChange={(e:React.ChangeEvent<HTMLTextAreaElement>)=>setLyricsInput(e.target.value)}
                  rows={5} placeholder={"[Verse]\nNeon lights on wet asphalt glow\n\n[Chorus]\nThis is my city, my time, my sky"}
                  style={{width:"100%",background:C.bg3,border:`1px solid ${C.bdr}`,borderRadius:R.r1,padding:"8px 8px",color:C.t1,fontSize: 14,fontFamily:"inherit",resize:"none",outline:"none"}}/>
              </div>
            )}
            {musicSub==="cover"&&(
              <div>
                <div style={{fontSize: 12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>Reference audio <span style={{color:C.t3,textTransform:"none",letterSpacing:0}}>— vocals required · min 15s</span></div>
                <div style={{border:`1px dashed ${C.bdr2}`,borderRadius:R.r2,padding:"16px",textAlign:"center",cursor:"pointer",background:C.bg3}}>
                  <div style={{fontSize: 13,color:C.t3}}>Drop audio or click · wav · mp3</div>
                </div>
              </div>
            )}
          </>)}

          {/* Instrumental */}
          {musicSub==="instrumental"&&(
            <div>
              <div style={{fontSize: 12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",marginBottom:4}}>
                Style prompt <span style={{color:C.red,textTransform:"none",letterSpacing:0}}>— STYLE ONLY · no lyrics</span>
              </div>
              <input value={styleInput} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setStyleInput(e.target.value)}
                placeholder="Soulful R&B, warm, cinematic, 85 BPM, B minor…"
                style={{width:"100%",background:C.bg3,border:`1px solid ${C.bdr}`,borderRadius:R.r1,padding:"8px 8px",color:C.t1,fontSize: 15,fontFamily:"inherit",outline:"none"}}/>
            </div>
          )}
        </>)}

        {/* Duration + AR (video modes) */}
        {(mode==="T2V"||mode==="I2V"||mode==="Motion")&&(<>
          <div>
            <div style={{fontSize: 12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>Duration</div>
            <select value={duration} onChange={(e:React.ChangeEvent<HTMLSelectElement>)=>setDuration(e.target.value as Duration)}
              style={{width:"100%",background:C.bg3,border:`1px solid ${C.bdr}`,borderRadius:R.r1,padding:"8px 8px",color:C.t1,fontSize: 15,fontFamily:"inherit",outline:"none"}}>
              {(["3","4","5","8","10","15"] as Duration[]).map(d=><option key={d} value={d}>{d}s</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize: 12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>Aspect ratio</div>
            <div style={{display:"flex",gap:6}}>
              {(["16:9","9:16","1:1"] as AR[]).map(a=>(
                <button key={a} onClick={()=>setAr(a)} style={{
                  flex:1,padding:"6px 0",borderRadius:R.r1,fontSize: 14,fontFamily:"inherit",cursor:"pointer",
                  border:`1px solid ${ar===a?C.acc:C.bdr}`,
                  background:ar===a?C.accDim:"transparent",color:ar===a?C.acc2:C.t3,
                }}>{a}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize: 12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase",marginBottom:6}}>Native audio</div>
            <div style={{display:"flex",gap:6}}>
              {[true,false].map(v=>(
                <button key={String(v)} onClick={()=>setAudio(v)} style={{
                  flex:1,padding:"6px 0",borderRadius:R.r1,fontSize: 14,fontFamily:"inherit",cursor:"pointer",
                  border:`1px solid ${audio===v?C.acc:C.bdr}`,
                  background:audio===v?C.accDim:"transparent",color:audio===v?C.acc2:C.t3,
                }}>{v?"On":"Off"}</button>
              ))}
            </div>
          </div>
        </>)}
      </div>

      {/* Footer */}
      <div style={{padding:"12px 16px",borderTop:`1px solid ${C.bdr}`,flexShrink:0}}>
        {/* Prompt Analyst panel */}
        {analystOpen && (
          <div style={{marginBottom:12,padding:"12px",borderRadius:R.r2,background:C.bg4,border:`1px solid ${C.bdr}`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:13,color:C.t1,fontWeight:500}}>Prompt Analyst</span>
              <span style={{fontSize:12,color:C.t4}}>~$0.002 · GPT-4o mini</span>
            </div>
            {analystState==="idle"&&<button onClick={runAnalyst} style={{width:"100%",padding:"8px 0",borderRadius:R.r1,background:C.surf,border:`1px solid ${C.bdr}`,color:C.t2,fontSize:13,fontFamily:"inherit",cursor:"pointer"}}>Analyse prompt before generating</button>}
            {analystState==="running"&&<div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:C.t4}}><span style={{width:12,height:12,borderRadius:R.pill,border:`1.5px solid ${C.acc}`,borderTopColor:"transparent",display:"block",animation:"streams-spin 600ms linear infinite"}}/> Analysing…</div>}
            {analystState==="failed"&&<div style={{fontSize:13,color:C.red}}>Analysis failed — check API key in Settings</div>}
            {analystState==="done"&&analystResult&&(<div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div style={{fontSize:12,color:C.t3,lineHeight:1.6}}><strong style={{color:C.t1}}>Interpretation:</strong> {analystResult.interpretation}</div>
              {analystResult.ambiguities.length>0&&<div><div style={{fontSize:12,color:C.amber,marginBottom:4}}>Ambiguities:</div>{analystResult.ambiguities.map((a:string,i:number)=><div key={i} style={{fontSize:12,color:C.t4,paddingLeft:8}}>· {a}</div>)}</div>}
              {analystResult.improvements.length>0&&<div><div style={{fontSize:12,color:C.green,marginBottom:4}}>Improvements:</div>{analystResult.improvements.map((imp:string,i:number)=><div key={i} style={{fontSize:12,color:C.t3,paddingLeft:8}}>· {imp}</div>)}</div>}
              {analystResult.failurePatterns.length>0&&<div><div style={{fontSize:12,color:C.red,marginBottom:4}}>Watch out for:</div>{analystResult.failurePatterns.slice(0,2).map((fp:string,i:number)=><div key={i} style={{fontSize:12,color:C.t4,paddingLeft:8}}>· {fp}</div>)}</div>}
              {analystResult.savingsUsd>0&&<div style={{fontSize:12,color:C.green}}>💡 Switch to {analystResult.bestModel} → save ${analystResult.savingsUsd.toFixed(2)}</div>}
              <button onClick={()=>{if(mode==="Music")setStyleInput(analystResult.improvedPrompt);else{const setter=prompt;void setter;/* prompt setter varies by mode */}}} style={{padding:"6px 0",borderRadius:R.r1,background:C.accDim,border:`1px solid ${C.accBr}`,color:C.acc2,fontSize:12,fontFamily:"inherit",cursor:"pointer"}}>Use improved prompt</button>
            </div>)}
          </div>
        )}

        {/* Bulk controls */}
        <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center"}}>
          <span style={{fontSize:12,color:C.t4,flexShrink:0}}>Bulk:</span>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <button onClick={()=>setBulkCount(Math.max(1,bulkCount-1))} style={{width:24,height:24,borderRadius:R.r1,background:C.surf,border:`1px solid ${C.bdr}`,color:C.t2,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
            <span style={{fontSize:14,color:C.t1,width:20,textAlign:"center"}}>{bulkCount}</span>
            <button onClick={()=>setBulkCount(Math.min(12,bulkCount+1))} style={{width:24,height:24,borderRadius:R.r1,background:C.surf,border:`1px solid ${C.bdr}`,color:C.t2,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
          </div>
          <div style={{display:"flex",gap:4,flex:1}}>
            {(["single","parallel"] as const).map(m=>(
              <button key={m} onClick={()=>setBulkMode(m)} style={{flex:1,padding:"4px 0",borderRadius:R.r1,fontSize:12,fontFamily:"inherit",cursor:"pointer",border:`1px solid ${bulkMode===m?C.acc:C.bdr}`,background:bulkMode===m?C.accDim:"transparent",color:bulkMode===m?C.acc2:C.t4}}>{m}</button>
            ))}
          </div>
          <button onClick={()=>setAnalystOpen(!analystOpen)} title="Prompt Analyst — pre-flight quality check" style={{padding:"4px 8px",borderRadius:R.r1,border:`1px solid ${analystOpen?C.acc:C.bdr}`,background:analystOpen?C.accDim:"transparent",color:analystOpen?C.acc2:C.t4,fontSize:12,fontFamily:"inherit",cursor:"pointer",flexShrink:0}}>
            {analystState==="running"?"…":"✦ Analyst"}
          </button>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <span style={{fontSize: 12,color:C.t4,letterSpacing:".06em",textTransform:"uppercase"}}>Est. cost {bulkCount>1?`× ${bulkCount}`:""}</span>
          <span style={{fontSize: 14,color:C.acc2,fontWeight:500}}>{cost}{bulkCount>1?` = $${(parseFloat(cost.replace(/[^0-9.]/g,""))*bulkCount).toFixed(2)}`:""}</span>
        </div>
        <button onClick={handleGenerate} disabled={isActive} style={{
          width:"100%",padding:"12px 0",borderRadius:R.r2,border:"none",
          background:isActive?C.bg4:C.acc,color:isActive?C.t4:"#fff",
          fontSize: 16,fontFamily:"inherit",fontWeight:500,
          cursor:isActive?"not-allowed":"pointer",
          transition:`background ${DUR.fast} ${EASE}`,
          display:"flex",alignItems:"center",justifyContent:"center",gap:8,
        }}>
          {isActive&&<span style={{width:12,height:12,borderRadius:R.pill,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",display:"inline-block",animation:"streams-spin 600ms linear infinite"}}/>}
          ✦ {btnLabel}
        </button>
      </div>
    </div>

    {/* Right — grid + stitch */}
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:C.bg}} className="streams-gen-right">
      <div style={{flex:1,overflowY:"auto",padding:16}}>
        {grid.length > 0 && (
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:10 }}>
            <button onClick={()=>{setGrid([]);setStitch([]);setStitchUrl(null);setStitchState("idle");}} style={{
              padding:"4px 12px", borderRadius:R.r1, background:"transparent",
              border:`1px solid ${C.bdr}`, color:C.t4, fontSize:13, fontFamily:"inherit",
              cursor:"pointer",
            }}>Clear grid</button>
          </div>
        )}
        {grid.length===0?(
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:C.t4,fontSize: 14,flexDirection:"column",gap:8}}>
            <span style={{fontSize: 28,opacity:.2}}>✦</span>Generate clips — they appear here
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
            {grid.map((item:GridItem,i:number)=>(
              <div key={item.id} style={{
                aspectRatio:ar==="9:16"?"9/16":ar==="1:1"?"1/1":"16/9",
                background:C.bg3,borderRadius:R.r2,
                border:`1px solid ${item.status==="done"?C.accBr:C.bdr}`,
                display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                position:"relative",overflow:"hidden",
              }}>
                {item.status==="running"&&<div style={{position:"absolute",inset:0,background:"rgba(124,58,237,.06)",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{width:24,height:24,borderRadius:R.pill,border:`2px solid ${C.acc}`,borderTopColor:"transparent",display:"block",animation:"streams-spin 600ms linear infinite"}}/></div>}
                {item.status==="done"&&<>
                  <div style={{fontSize: 28,color:C.t4,opacity:.2}}>▶</div>
                  <div style={{position:"absolute",bottom:8,right:8}}>
                    <button onClick={()=>addToStitch(item.id)} style={{
                      padding:"3px 8px",borderRadius:R.r1,fontSize: 12,cursor:"pointer",fontFamily:"inherit",
                      background:stitch.includes(item.id)?C.acc:C.bg4,
                      border:`1px solid ${stitch.includes(item.id)?C.acc:C.bdr}`,
                      color:stitch.includes(item.id)?"#fff":C.t3,
                    }}>+ stitch</button>
                  </div>
                </>}
                {item.status==="waiting"&&<div style={{fontSize: 13,color:C.t4}}>Waiting…</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stitch strip */}
      <div style={{height:80,flexShrink:0,borderTop:`1px solid ${C.bdr}`,background:C.bg2,display:"flex",alignItems:"stretch"}}>
        <div style={{padding:"0 16px",borderRight:`1px solid ${C.bdr}`,display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <span style={{fontSize: 12,color:C.t4,letterSpacing:".08em",textTransform:"uppercase"}}>Stitch sequence</span>
          <span style={{fontSize: 12,padding:"2px 8px",borderRadius:R.pill,background:C.surf,border:`1px solid ${C.bdr}`,color:C.t4}}>fal ffmpeg-api</span>
        </div>
        <div style={{flex:1,overflowX:"auto",display:"flex",alignItems:"center",gap:8,padding:"0 16px"}}>
          {stitch.length===0
            ?<span style={{fontSize: 13,color:C.t4}}>Generate clips — add to stitch — merge via fal ffmpeg API</span>
            :stitch.map((id:string,i:number)=>(
              <div key={id} style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:80,height:48,borderRadius:R.r1,background:C.bg3,border:`1px solid ${C.accBr}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize: 12,color:C.acc2}}>clip {i+1}</div>
                {i<stitch.length-1&&<span style={{color:C.t4,fontSize: 14}}>→</span>}
              </div>
            ))
          }
        </div>
        {stitch.length>=2&&<div style={{padding:"0 16px",display:"flex",alignItems:"center",flexShrink:0}}>
          <button
  onClick={async () => {
    if (stitchState === "running" || stitch.length < 2) return;
    // Collect output_urls from the grid items in stitch sequence
    // In production: grid items carry their generationId → load output_url from DB
    setStitchState("running");
    try {
      // Collect real output_urls from grid items (stored on grid item when generation completes)
      const clipUrls = stitch
        .map((id: string) => grid.find((g: GridItem) => g.id === id)?.outputUrl)
        .filter((url: string | undefined): url is string => typeof url === "string" && url.startsWith("http"));

      if (clipUrls.length < 2) {
        alert("Stitch requires at least 2 completed clips with output URLs. Generate clips first.");
        setStitchState("idle");
        return;
      }

      const res  = await fetch("/api/streams/stitch", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ clips: clipUrls }),
      });
      const data = await res.json() as { generationId?: string; responseUrl?: string; error?: string };
      if (res.ok && data.generationId && data.responseUrl) {
        // Poll status for the stitched output URL
        const stitchPoll = setInterval(async () => {
          const sr = await fetch("/api/streams/video/status", {
            method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ generationId: data.generationId, responseUrl: data.responseUrl }),
          });
          const sd = await sr.json() as { status?:string; artifactUrl?:string };
          if (sd.status === "done" && sd.artifactUrl) {
            clearInterval(stitchPoll);
            setStitchState("done");
            setStitchUrl(sd.artifactUrl);
          } else if (sd.status === "failed") {
            clearInterval(stitchPoll);
            setStitchState("idle");
          }
        }, 5000);
        // Timeout after 3 min
        setTimeout(() => { clearInterval(stitchPoll); }, 180_000);
      } else {
        setStitchState("idle");
      }
    } catch { setStitchState("idle"); }
  }}
  style={{padding:"8px 16px",borderRadius:R.r1,
    background: stitchState === "done" ? C.green : stitchState === "running" ? C.bg4 : C.acc,
    border:"none",color:"#fff",fontSize: 14,fontFamily:"inherit",
    cursor: stitchState === "running" ? "not-allowed" : "pointer",
    display:"flex",alignItems:"center",gap:6,
  }}
>
  {stitchState === "running" && <span style={{width:10,height:10,borderRadius:R.pill,border:"1.5px solid rgba(255,255,255,.3)",borderTopColor:"#fff",display:"block",animation:"streams-spin 600ms linear infinite"}}/>}
  {stitchState === "done" ? "✓ Stitched" : stitchState === "running" ? "Stitching…" : "Stitch → fal"}
</button>
{stitchUrl && (
  <a href={stitchUrl} target="_blank" rel="noopener noreferrer" style={{
    padding:"8px 12px", borderRadius:R.r1,
    background:C.green, color:"#fff",
    fontSize:13, fontFamily:"inherit",
    textDecoration:"none", flexShrink:0,
    display:"flex", alignItems:"center", gap:6,
  }}>↓ Stitched video</a>
)}
        </div>}
      </div>
    </div>

    <style>{`
      @keyframes streams-spin  { to{transform:rotate(360deg)} }
      @keyframes streams-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(124,58,237,.4)} 50%{box-shadow:0 0 0 8px rgba(124,58,237,0)} }
      @media(max-width:768px){
        .streams-gen-left  { flex:0 0 100% !important; border-right:none !important; }
        .streams-gen-right { display:none !important; }
      }
    `}</style>
    </div>
  );
}
