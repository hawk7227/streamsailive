"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Connection,
  MarkerType,
  getOutgoers,
} from "reactflow";
import "reactflow/dist/style.css";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft, Search, Save, Play, Trash2 } from "lucide-react";
import { buildImageToVideoMotionPlan, type PipelineNiche, type AutomationMode, type OutputMode } from "@/lib/pipeline/imageToVideoGovernance";
import { validateIntakeBrief, type IntakeBrief, type IntakeGateResult } from "@/lib/pipeline/qc/intakeGate";

type Pipeline = {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
  status: string;
};

const nodeTypesList = [
  { type: "scriptWriter", label: "Script Writer", subLabel: "", icon: "📝", content: "Input: Product description<br>Output: Video script", iconBg: "bg-blue-500/15", category: "Content Generation" },
  { type: "voiceGenerator", label: "Voice Generator", subLabel: "", icon: "🎙️", content: "Input: {{step1.script}}<br>Voice: Rachel", iconBg: "bg-emerald-500/15", category: "Content Generation" },
  { type: "videoGenerator", label: "Video Generator", subLabel: "", icon: "🎬", content: "Input: {{imageMotionAnalyzer.output}}<br>Style: Cinematic", iconBg: "bg-pink-500/15", category: "Content Generation", motionSource: "auto", motionIntensity: "controlled", timelinePreference: "governed" },
  { type: "imageGenerator", label: "Image Generator", subLabel: "", icon: "🖼️", content: "Prompt: {{script.scene}}<br>Ratio: 16:9", iconBg: "bg-purple-500/15", category: "Content Generation" },
  { type: "imageMotionAnalyzer", label: "Image Motion Analysis", subLabel: "Deconstruct image into motion plan", icon: "🧠", content: "Input: {{image.output}}<br>Output: motion plan", iconBg: "bg-cyan-500/15", category: "Content Generation" },
  { type: "videoEditor", label: "Video Editor", subLabel: "", icon: "✂️", content: "Input: Video buffer", iconBg: "bg-purple-500/15", category: "Post-Processing" },
  { type: "imageEditor", label: "Image Editor", subLabel: "", icon: "🎨", content: "Input: Image buffer", iconBg: "bg-purple-500/15", category: "Post-Processing" },
  { type: "httpRequest", label: "HTTP Request", subLabel: "Call External API", icon: "🌐", content: "GET https://api.example.com", iconBg: "bg-orange-500/15", category: "Actions" },
  { type: "zapierWebhook", label: "Zapier Webhook", subLabel: "Send to Zapier", icon: "⚡", content: "POST https://hooks.zapier.com/...", iconBg: "bg-amber-500/15", category: "Actions" },
  { type: "webhook", label: "Webhook", subLabel: "Listen for events", icon: "🔗", content: "Waiting for events...", iconBg: "bg-cyan-500/15", category: "Triggers" },
  { type: "schedule", label: "Schedule", subLabel: "Run periodically", icon: "📅", content: "Runs every 1 hour", iconBg: "bg-green-500/15", category: "Triggers" },
];

const SidebarItem = ({ item, onDragStart }: any) => (
  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-grab hover:bg-white/10 transition-colors group" draggable onDragStart={(event) => onDragStart(event, item)}>
    <span className="text-xl group-hover:scale-110 transition-transform">{item.icon}</span>
    <div>
      <p className="text-sm font-medium text-white">{item.label}</p>
      <p className="text-[10px] text-gray-500">{item.subLabel}</p>
    </div>
  </div>
);


// ── PipelineTopControlPanel (inlined) ─────────────────────────────────────


type ReferenceType = "youtube_url"|"image_upload"|"video_upload"|"document_upload"|"audio_upload"|"web_url";
type IdeaCard = { id:string; title:string; subtitle:string; angle:string };
type GovernanceSnapshot = { approvedFactsLoaded:boolean; imageRulesLoaded:boolean; videoRulesLoaded:boolean; marketingLogicLoaded:boolean };
type ReferencePayload = { type:"youtube_url"|"web_url"; value:string }|{ type:"image_upload"|"video_upload"|"document_upload"|"audio_upload"; file:File };

type PipelineTopControlPanelProps = {
  niche: PipelineNiche; setNiche:(v:PipelineNiche)=>void;
  automationMode: AutomationMode; setAutomationMode:(v:AutomationMode)=>void;
  outputMode: OutputMode; setOutputMode:(v:OutputMode)=>void;
  selectedTemplate:string; setSelectedTemplate:(v:string)=>void;
  conceptType:string; setConceptType:(v:string)=>void;
  governance:GovernanceSnapshot; ideas:IdeaCard[]; selectedIdeaId:string|null;
  onSelectIdea:(idea:IdeaCard)=>void;
  onAnalyzeReference:(payload:ReferencePayload)=>Promise<void>;
  onAskAI:(message:string)=>Promise<void>;
  onRunStep:(step:string)=>void;
};

function PipelineTopControlPanel({ niche,setNiche,automationMode,setAutomationMode,outputMode,setOutputMode,selectedTemplate,setSelectedTemplate,conceptType,setConceptType,governance,ideas,selectedIdeaId,onSelectIdea,onAnalyzeReference,onAskAI,onRunStep }:PipelineTopControlPanelProps) {
  const [govOpen,setGovOpen] = useState(false);
  const [chatInput,setChatInput] = useState("");
  const [linkInput,setLinkInput] = useState("");
  const [activeRef,setActiveRef] = useState<ReferenceType>("youtube_url");
  const fileRef = useRef<HTMLInputElement|null>(null);

  const handleRefClick = (t:ReferenceType) => { setActiveRef(t); if(t!=="youtube_url"&&t!=="web_url") fileRef.current?.click(); };
  const handleFile = async (e:React.ChangeEvent<HTMLInputElement>) => { const f=e.target.files?.[0]; if(!f)return; await onAnalyzeReference({type:activeRef as any,file:f}); e.target.value=""; };
  const handleLink = async () => { if(!linkInput.trim())return; await onAnalyzeReference({type:activeRef==="web_url"?"web_url":"youtube_url",value:linkInput.trim()}); };

  const modeOpts = [{v:"manual_mode",l:"Manual"},{v:"hybrid_mode",l:"Hybrid"},{v:"full_ai_ideas",l:"Full AI Ideas"},{v:"full_ai_ideas_with_rules",l:"Full AI + Rules"},{v:"full_auto_production",l:"Full Auto"}];
  const outOpts = [{v:"static_image",l:"Static Image"},{v:"video",l:"Video"},{v:"image_to_video",l:"Image → Video"},{v:"image_and_video",l:"Image + Video"},{v:"full_campaign_pack",l:"Campaign Pack"}];
  const refBtns:{t:ReferenceType;l:string}[] = [{t:"youtube_url",l:"YouTube Link"},{t:"image_upload",l:"Image Upload"},{t:"video_upload",l:"Video Upload"},{t:"document_upload",l:"Doc / PDF"},{t:"audio_upload",l:"Audio"},{t:"web_url",l:"Web URL"}];

  return (
    <div className="w-full bg-[#0f0f18] flex flex-col">
      <input ref={fileRef} type="file" className="hidden" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" onChange={handleFile}/>
      <div className="flex items-center gap-2 flex-wrap px-3 pt-2.5 pb-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[11px]">
          <span className="text-white/40">Niche</span>
          <select value={niche} onChange={e=>setNiche(e.target.value as PipelineNiche)} className="bg-transparent outline-none text-white/90 text-[11px] cursor-pointer"><option value="telehealth">Telehealth</option><option value="ecommerce">Ecommerce</option></select>
        </div>
        <div className="flex items-center gap-1.5 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[11px]">
          <span className="text-white/40">Mode</span>
          <select value={automationMode} onChange={e=>setAutomationMode(e.target.value as AutomationMode)} className="bg-transparent outline-none text-white/90 text-[11px] cursor-pointer">{modeOpts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>
        </div>
        <div className="flex items-center gap-1.5 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[11px]">
          <span className="text-white/40">Output</span>
          <select value={outputMode} onChange={e=>setOutputMode(e.target.value as OutputMode)} className="bg-transparent outline-none text-white/90 text-[11px] cursor-pointer">{outOpts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>
        </div>
        <div className="flex items-center gap-1.5 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[11px]">
          <span className="text-white/40">Template</span>
          <input value={selectedTemplate} onChange={e=>setSelectedTemplate(e.target.value)} placeholder="e.g. clinical_lifestyle" className="bg-transparent outline-none text-white/90 text-[11px] w-28 placeholder:text-white/20"/>
        </div>
        <div className="flex items-center gap-1.5 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[11px]">
          <span className="text-white/40">Concept</span>
          <input value={conceptType} onChange={e=>setConceptType(e.target.value)} placeholder="e.g. trust_first" className="bg-transparent outline-none text-white/90 text-[11px] w-24 placeholder:text-white/20"/>
        </div>
      </div>
      <div className="border-b border-white/[0.06]">
        <button onClick={()=>setGovOpen(v=>!v)} className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-cyan-300 hover:bg-white/[0.02]">
          <span className="flex items-center gap-2">&#9670; Governance Snapshot</span>
          <span className={`text-white/30 text-[10px] transition-transform ${govOpen?"rotate-180":""}`}>&#9660;</span>
        </button>
        {govOpen&&<div className="px-3 pb-2.5 grid grid-cols-2 gap-1.5">{[{l:"Approved facts",v:governance.approvedFactsLoaded},{l:"Image rules",v:governance.imageRulesLoaded},{l:"Video rules",v:governance.videoRulesLoaded},{l:"Marketing logic",v:governance.marketingLogicLoaded}].map(({l,v})=><div key={l} className="flex items-center gap-2 bg-white/[0.04] rounded-lg px-2.5 py-1.5 text-[10px]"><span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${v?"bg-emerald-400":"bg-red-400"}`}/><span className={v?"text-white/60":"text-red-400"}>{l} {v?"loaded":"missing"}</span></div>)}</div>}
      </div>
      {ideas.length>0&&<div className="px-3 py-2 border-b border-white/[0.06]"><div className="text-[9px] uppercase tracking-[0.15em] text-white/30 mb-2">Pre-run preview matrix</div><div className="grid grid-cols-3 gap-2">{ideas.map(idea=><button key={idea.id} onClick={()=>onSelectIdea(idea)} className={`rounded-xl border p-2.5 text-left ${selectedIdeaId===idea.id?"border-cyan-400/60 bg-cyan-400/10":"border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"}`}><div className="text-[9px] uppercase text-white/30 mb-1">{idea.angle}</div><div className="text-[11px] font-semibold text-white mb-2">{idea.title}</div><div className="h-14 rounded-lg bg-white/[0.04] mb-2"/><div className="text-center text-[10px] rounded-lg bg-cyan-400 py-1 text-black font-semibold">Select</div></button>)}</div></div>}
      <div className="px-3 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5 flex-wrap">{refBtns.map(({t,l})=><button key={t} onClick={()=>handleRefClick(t)} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] whitespace-nowrap border transition-colors ${activeRef===t?"bg-cyan-400/15 text-cyan-300 border-cyan-400/30":"bg-white/[0.05] text-white/60 border-white/[0.07] hover:bg-white/[0.09]"}`}>{l}</button>)}</div>
        {(activeRef==="youtube_url"||activeRef==="web_url")&&<div className="mt-2 flex gap-2"><input value={linkInput} onChange={e=>setLinkInput(e.target.value)} placeholder={activeRef==="youtube_url"?"Paste YouTube link...":"Paste web URL..."} className="flex-1 rounded-lg bg-white/[0.05] border border-white/[0.08] px-3 py-1.5 text-[11px] text-white/90 outline-none placeholder:text-white/20"/><button onClick={handleLink} className="rounded-lg bg-cyan-400 px-3 py-1.5 text-[11px] font-semibold text-black">Analyze</button></div>}
      </div>
      <div className="px-3 py-2 border-b border-white/[0.06]">
        <div className="text-[10px] text-white/30 mb-1.5">AI Creative Direction</div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-[11px] text-white/40 mb-2">AI will recommend the strongest production path, not just agree.</div>
        <div className="flex gap-2">
          <input value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="Ask AI..." className="flex-1 rounded-lg bg-white/[0.05] border border-white/[0.08] px-3 py-1.5 text-[11px] text-white/90 outline-none placeholder:text-white/20"/>
          <button onClick={()=>{if(chatInput.trim())void onAskAI(chatInput);}} className="rounded-lg bg-white/[0.07] border border-white/[0.1] px-3 py-1.5 text-[11px] text-cyan-300 flex items-center gap-1.5">Ask</button>
        </div>
      </div>
      <div className="px-3 py-2 flex items-center gap-2 flex-wrap">
        {["Script","Image","Video","Validator","OCR QA","Export"].map(s=><button key={s} onClick={()=>onRunStep(s)} className="rounded-lg bg-white/[0.05] border border-white/[0.07] px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/[0.09]">{s}</button>)}
        <button onClick={()=>onRunStep("Run Full Pipeline")} className="ml-auto rounded-lg bg-cyan-400 px-3 py-1.5 text-[11px] font-semibold text-black flex items-center gap-1.5">&#9654; Run Full Pipeline</button>
      </div>
    </div>
  );
}
// ── End PipelineTopControlPanel ───────────────────────────────────────────

export default function PipelineBuilder() {
  const { id } = useParams();
  const supabase = createClient();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  const [pipelineName, setPipelineName] = useState("Untitled Pipeline");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const [niche, setNiche] = useState<PipelineNiche>("telehealth");
  const [automationMode, setAutomationMode] = useState<AutomationMode>("full_ai_ideas_with_rules");
  const [outputMode, setOutputMode] = useState<OutputMode>("image_to_video");
  const [selectedTemplate, setSelectedTemplate] = useState("Portrait CTA");
  const [conceptType, setConceptType] = useState("Pain-Based");
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const [imageToVideoGovernance, setImageToVideoGovernance] = useState("");

  // Intake brief — required before the 7-step governance pipeline can run
  const [intakeBrief, setIntakeBrief] = useState<Partial<IntakeBrief>>({
    governanceNicheId: "telehealth",
    proofTypeAllowed: "process-based",
    funnelStage: "consideration",
  });
  const [intakeGateResult, setIntakeGateResult] = useState<IntakeGateResult | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [stepStates, setStepStates] = useState<Record<string, "queued"|"running"|"complete"|"blocked"|"error">>({
    strategy: "queued", copy: "queued", validator: "queued",
    imagery: "queued", i2v: "queued", assets: "queued", qa: "queued",
  });
  const [stepOutputs, setStepOutputs] = useState<Record<string, unknown>>({});

  const [ideaCards, setIdeaCards] = useState([
    { id: "concept-1", title: "Preview direction 1", subtitle: "privacy-led", angle: "pain-based strategy 1" },
    { id: "concept-2", title: "Preview direction 2", subtitle: "clarity-led", angle: "pain-based strategy 2" },
    { id: "concept-3", title: "Preview direction 3", subtitle: "reassurance-led", angle: "pain-based strategy 3" },
  ]);

  const governanceSnapshot = {
    approvedFactsLoaded: true,
    imageRulesLoaded: true,
    videoRulesLoaded: true,
    marketingLogicLoaded: true,
  };

  useEffect(() => {
    fetch('/api/admin/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.imageToVideoGovernance) setImageToVideoGovernance(data.imageToVideoGovernance);
      })
      .catch((err) => console.error('Failed to load admin config:', err));
  }, []);

  useEffect(() => {
    if (!id) return;
    const fetchPipeline = async () => {
      try {
        const { data, error } = await supabase.from("pipelines").select("*").eq("id", id).single();
        if (error) throw error;
        if (data) {
          setPipelineName(data.name || "Untitled Pipeline");
          setNodes(data.nodes || []);
          setEdges(data.edges || []);
          setIsActive(data.status === "active");
        }
      } catch (error) {
        console.error("Error loading pipeline:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPipeline();
  }, [id, setEdges, setNodes, supabase]);

  useEffect(() => {
    if (outputMode !== "image_to_video") return;
    setNodes((nds) => {
      const exists = nds.some((n) => n.data?.type === "imageMotionAnalyzer");
      if (exists) return nds;
      return nds.concat({
        id: `motion-${Date.now()}`,
        type: "default",
        position: { x: 520, y: 220 },
        data: {
          type: "imageMotionAnalyzer",
          label: "Image Motion Analysis",
          content: "Analyze image → generate motion plan",
          governanceEnabled: true,
        },
      });
    });
  }, [outputMode, setNodes]);

  const onDragStart = (event: React.DragEvent, nodeType: any) => {
    event.dataTransfer.setData("application/reactflow", JSON.stringify(nodeType));
    event.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    if (!reactFlowWrapper.current || !reactFlowInstance) return;
    const typeData = event.dataTransfer.getData("application/reactflow");
    if (!typeData) return;
    const item = JSON.parse(typeData);
    const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const label = ["scriptWriter", "voiceGenerator", "videoGenerator", "imageGenerator", "httpRequest", "zapierWebhook", "imageMotionAnalyzer"].includes(item.type)
      ? `${item.label} ${Math.random().toString(36).substring(2, 6).toUpperCase()}`
      : item.label;

    setNodes((nds) =>
      nds.concat({
        id: crypto.randomUUID(),
        type: "default",
        position,
        data: { ...item, label },
      })
    );
    setIsDirty(true);
  }, [reactFlowInstance, setNodes]);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) =>
      addEdge({ ...params, type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } }, eds)
    );
    setIsDirty(true);
  }, [setEdges]);

  const handleSelectIdea = (idea: any) => {
    setSelectedIdeaId(idea.id);
    setNodes((nds) =>
      nds.map((node) => {
        if (node.data?.type === "scriptWriter") {
          return {
            ...node,
            data: {
              ...node.data,
              selectedIdeaId: idea.id,
              content: `${node.data.content || ""}<br><br>Selected concept: ${idea.title}<br>Angle: ${idea.angle}`,
            },
          };
        }
        return node;
      })
    );
    setIsDirty(true);
  };

  const handleAnalyzeReference = async (payload: any) => {
    if ("value" in payload) {
      setIdeaCards([
        { id: "concept-1", title: "Reference-led concept", subtitle: "link analysis", angle: "trust-led adaptation" },
        { id: "concept-2", title: "Safer duplicate", subtitle: "structure extraction", angle: "controlled remake" },
        { id: "concept-3", title: "Best-fit production path", subtitle: "AI recommendation", angle: "highest-confidence route" },
      ]);
      return;
    }

    if ("file" in payload) {
      setIdeaCards([
        { id: "concept-1", title: "File-derived concept", subtitle: payload.file.name, angle: "layout-aware" },
        { id: "concept-2", title: "Image-to-video path", subtitle: payload.file.name, angle: "motion-safe" },
        { id: "concept-3", title: "Fallback static path", subtitle: payload.file.name, angle: "safe composition" },
      ]);
    }
  };

  const handleAskAI = async (message: string) => {
    setIdeaCards([
      { id: "concept-1", title: "AI recommended concept", subtitle: "strongest path", angle: "conversion-first" },
      { id: "concept-2", title: "Alternative concept", subtitle: "safer route", angle: "clarity-first" },
      { id: "concept-3", title: "Aggressive variant", subtitle: "higher energy", angle: "performance test" },
    ]);
    console.log("AI request:", message);
  };

  const internalSave = async (nodesToSave: any[]) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("pipelines")
        .update({
          name: pipelineName,
          nodes: nodesToSave,
          edges,
          status: isActive ? 'active' : 'inactive',
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      setIsDirty(false);
    } catch (error) {
      console.error("Error saving pipeline:", error);
    } finally {
      setSaving(false);
    }
  };

  const runNode = async (node: any, context: any = {}) => {
    if (node.data.type === "imageMotionAnalyzer") {
      const imageInput = context?.image_generator || context?.image || context?.image_output || node.data.content || "";
      const motionPlan = buildImageToVideoMotionPlan({
        imageInput: typeof imageInput === "string" ? imageInput : JSON.stringify(imageInput),
        niche,
        outputMode,
        automationMode,
        governanceText: imageToVideoGovernance,
      });

      setNodes((nds) =>
        nds.map((n) =>
          n.id === node.id
            ? {
                ...n,
                data: {
                  ...n.data,
                  status: "completed",
                  output: JSON.stringify(motionPlan, null, 2),
                },
              }
            : n
        )
      );

      return motionPlan;
    }

    const motionPlan = context?.image_motion_analysis || context?.motion_plan || null;

    setNodes((nds) =>
      nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, status: "running" } } : n))
    );

    try {
      const response = await fetch("/api/pipeline/run-node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: node.data.type,
          data: {
            ...node.data,
            niche,
            automationMode,
            outputMode,
            selectedTemplate,
            conceptType,
            selectedIdeaId,
            motionPlan,
            governance: {
              ...(node.data.governance || {}),
              imageToVideo: imageToVideoGovernance,
            },
          },
          context,
        }),
      });

      const result = await response.json();

      setNodes((nds) =>
        nds.map((n) =>
          n.id === node.id
            ? {
                ...n,
                data: {
                  ...n.data,
                  status: result?.success ? "completed" : "error",
                  output: JSON.stringify(result?.output ?? { ok: false }, null, 2),
                  motionPlanPreview: motionPlan ? JSON.stringify(motionPlan, null, 2) : undefined,
                },
              }
            : n
        )
      );

      return result?.output;
    } catch (error) {
      console.error("Node Execution Failed:", error);
      setNodes((nds) => nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, status: "error" } } : n)));
      throw error;
    }
  };

  // ── 7-Step Governance Pipeline Orchestrator ─────────────────────────────────
  // Runs the telehealth governance pipeline sequentially with full gate enforcement.
  // Each step receives the intake brief and previous step outputs in context.
  // Gate failures surface as step state "blocked" — never silently continue.

  const setStep = (step: string, state: "queued"|"running"|"complete"|"blocked"|"error") => {
    setStepStates(prev => ({ ...prev, [step]: state }));
  };

  const run7StepPipeline = async () => {
    setGateError(null);
    setStepOutputs({});
    setStepStates({ strategy: "queued", copy: "queued", validator: "queued", imagery: "queued", i2v: "queued", assets: "queued", qa: "queued" });

    // ── Intake gate: must pass before anything runs ────────────────────────
    const gateResult = validateIntakeBrief({
      ...intakeBrief,
      governanceNicheId: intakeBrief.governanceNicheId ?? niche,
    });
    setIntakeGateResult(gateResult);

    if (!gateResult.passed) {
      const errMsg = [
        gateResult.missingFields.length > 0 ? `Missing: ${gateResult.missingFields.join(", ")}` : null,
        gateResult.validationErrors.length > 0 ? gateResult.validationErrors[0] : null,
      ].filter(Boolean).join(" | ");
      setGateError(`Intake brief incomplete. ${errMsg}`);
      return;
    }

    setRunning(true);
    const context: Record<string, unknown> = {
      intakeBrief,
      intakeGateResult: gateResult,
    };

    const stepTypes = [
      { step: "strategy",  type: "creativeStrategy" },
      { step: "copy",      type: "copyGeneration" },
      { step: "validator", type: "validator" },
      { step: "imagery",   type: "imageryGeneration" },
      { step: "i2v",       type: "imageToVideoStep" },
      { step: "assets",    type: "assetLibrary" },
      { step: "qa",        type: "qualityAssurance" },
    ];

    try {
      for (const { step, type } of stepTypes) {
        setStep(step, "running");

        // Find the matching node in the canvas, or use a minimal synthetic node
        const node = nodes.find((n: any) => n.data?.type === type) ?? {
          id: `synthetic-${step}`,
          type: "pipelineNode",
          data: {
            type,
            governance: { pipelineType: niche },
            aspectRatio: "16:9",
          },
        };

        try {
          const response = await fetch("/api/pipeline/run-node", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, data: node.data ?? {}, context }),
          });

          const result = await response.json() as { success: boolean; output?: unknown; error?: string };

          if (!result.success) {
            setStep(step, "blocked");
            setGateError(`Step "${step}" failed: ${result.error ?? "Unknown error"}`);
            return; // Hard stop — do not proceed
          }

          // Store output and propagate to context for next steps
          const output = result.output;
          setStepOutputs(prev => ({ ...prev, [step]: output }));

          // Propagate output to context using step name as key
          context[step] = output;

          // Also propagate using the step type name for cross-step resolution
          context[type] = output;

          // Special propagation for validator gate
          if (step === "validator") {
            const validatorOut = output as Record<string, unknown> | null;
            const status = validatorOut?.validatorStatus ?? "unknown";
            context.validator = { ...(validatorOut ?? {}), validatorStatus: status };
            if (status !== "pass") {
              setStep(step, "blocked");
              setGateError(`Validator blocked: ${status}. Fix copy issues before imagery can run.`);
              return;
            }
          }

          // Special propagation for imagery OCR gate
          if (step === "imagery") {
            const imageryOut = output as Record<string, unknown> | null;
            context.imageryGeneration = imageryOut;
            if (imageryOut?.imageGenerationFailed) {
              setStep(step, "blocked");
              setGateError("Image generation failed after 3 attempts. Check prompt and try again.");
              return;
            }
          }

          setStep(step, "complete");

        } catch (stepErr) {
          const msg = stepErr instanceof Error ? stepErr.message : String(stepErr);
          setStep(step, "blocked");
          setGateError(`Step "${step}" error: ${msg}`);
          return;
        }
      }
    } finally {
      setRunning(false);
    }
  };

  const runPipeline = async () => {
    if (isDirty) await internalSave(nodes);
    setRunning(true);

    try {
      const nodeOutputs = new Map<string, any>();

      if (outputMode === "image_to_video") {
        const imageNode = nodes.find((n: any) => n.data?.type === "imageGenerator");
        const motionNode = nodes.find((n: any) => n.data?.type === "imageMotionAnalyzer");
        const videoNode = nodes.find((n: any) => n.data?.type === "videoGenerator");

        if (imageNode) {
          const out = await runNode(imageNode, {});
          nodeOutputs.set(imageNode.id, out);
        }

        if (motionNode) {
          const context: any = {};
          nodeOutputs.forEach((val, key) => {
            const n = nodes.find((nd: any) => nd.id === key);
            if (n) context[n.data.label.toLowerCase().replace(/\s+/g, "_")] = val;
          });
          const out = await runNode(motionNode, context);
          nodeOutputs.set(motionNode.id, out);
        }

        if (videoNode) {
          const context: any = {};
          nodeOutputs.forEach((val, key) => {
            const n = nodes.find((nd: any) => nd.id === key);
            if (n) context[n.data.label.toLowerCase().replace(/\s+/g, "_")] = val;
          });
          const motionNodeLocal = nodes.find((n: any) => n.data?.type === "imageMotionAnalyzer");
          if (motionNodeLocal && nodeOutputs.has(motionNodeLocal.id)) {
            context.motion_plan = nodeOutputs.get(motionNodeLocal.id);
            context.image_motion_analysis = nodeOutputs.get(motionNodeLocal.id);
          }
          await runNode(videoNode, context);
        }

        setRunning(false);
        return;
      }

      const executionQueue: any[] = nodes.filter((n) => !edges.some((e) => e.target === n.id));
      while (executionQueue.length > 0) {
        const currentNode = executionQueue.shift();
        const context: any = {};
        nodeOutputs.forEach((val, key) => {
          const n = nodes.find((nd) => nd.id === key);
          if (n) context[n.data.label.toLowerCase().replace(/\s+/g, "_")] = val;
        });
        const out = await runNode(currentNode, context);
        nodeOutputs.set(currentNode.id, out);
        const children = getOutgoers(currentNode, nodes, edges);
        for (const child of children) {
          if (!executionQueue.find((n) => n.id === child.id)) executionQueue.push(child);
        }
      }
    } catch (error) {
      console.error("Pipeline Execution Failed", error);
    } finally {
      setRunning(false);
    }
  };

  // Detect whether the canvas has 7-step governance nodes
  const has7StepNodes = nodes.some((n: any) =>
    ["creativeStrategy","copyGeneration","validator","imageryGeneration","imageToVideoStep","assetLibrary","qualityAssurance"].includes(n.data?.type)
  );

  const handleRunStep = async (step: string) => {
    if (step === "Run Full Pipeline") {
      if (has7StepNodes) {
        await run7StepPipeline();
      } else {
        await runPipeline();
      }
      return;
    }

    const map: Record<string, string[]> = {
      Script: ["scriptWriter"],
      Image: ["imageGenerator", "imageEditor", "imageMotionAnalyzer"],
      Video: ["videoGenerator", "videoEditor"],
      Validator: ["validator"],
      "OCR QA": ["ocrQa"],
      Export: ["exporter"],
    };

    const allowed = map[step] || [];
    const candidates = nodes.filter((n: any) => allowed.includes(n.data?.type));
    for (const node of candidates) {
      await runNode(node, {
        niche,
        automationMode,
        outputMode,
        selectedTemplate,
        conceptType,
        selectedIdeaId,
      });
    }
  };

  if (loading) {
    return <div className="h-screen bg-[#0a0a0f] flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f] text-white">
      <header className="h-14 bg-[#12121a] border-b border-white/[0.08] px-6 flex items-center justify-between z-50">
        <div className="flex items-center gap-4">
          <Link href="/pipeline" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="w-px h-6 bg-white/[0.08]"></div>
          <div>
            <input type="text" value={pipelineName} onChange={(e) => { setPipelineName(e.target.value); setIsDirty(true); }} className="bg-transparent text-white font-semibold focus:outline-none" />
            <p className="text-[10px] text-gray-500">{isDirty ? "Unsaved changes" : saving ? "Saving..." : "Last saved just now"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => internalSave(nodes)} disabled={saving} className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-sm text-gray-400 hover:bg-white/5 flex items-center gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={runPipeline} disabled={running || nodes.length === 0} className={`px-3 py-1.5 rounded-lg bg-indigo-600 text-sm text-white font-medium hover:bg-indigo-700 flex items-center gap-2 ${running ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <Play className="w-4 h-4" />
            {running ? "Running..." : "Run"}
          </button>
          <button
            onClick={run7StepPipeline}
            disabled={running}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${running ? 'opacity-50 cursor-not-allowed bg-teal-700 text-white' : 'bg-[#00C4A1] hover:bg-[#00b090] text-black'}`}
            title="Run the 7-step governance pipeline with intake gate and QC enforcement"
          >
            <Play className="w-4 h-4" />
            {running ? "Running..." : "Run Governance"}
          </button>
        </div>
      </header>

      {gateError && (
        <div className="px-6 py-2 bg-red-900/40 border-b border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <span className="font-semibold">⛔ Gate Error:</span>
          <span>{gateError}</span>
          <button onClick={() => setGateError(null)} className="ml-auto text-red-400 hover:text-red-200">✕</button>
        </div>
      )}

      {intakeGateResult && !gateError && (
        <div className="px-6 py-1.5 bg-teal-900/20 border-b border-teal-500/20 text-teal-400 text-[11px] flex items-center gap-3">
          <span>✓ Intake locked</span>
          <span className="text-white/30">|</span>
          <span>Ruleset: {intakeGateResult.rulesetVersionLocked}</span>
          <span className="text-white/30">|</span>
          <span>Run ID: {intakeGateResult.intakeBriefId.slice(0, 8)}…</span>
          <div className="ml-auto flex items-center gap-2">
            {Object.entries(stepStates).map(([step, state]) => (
              <span key={step} className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                state === 'complete' ? 'bg-teal-500/20 text-teal-300' :
                state === 'running'  ? 'bg-yellow-500/20 text-yellow-300 animate-pulse' :
                state === 'blocked'  ? 'bg-red-500/20 text-red-300' :
                state === 'error'    ? 'bg-red-700/20 text-red-400' :
                'bg-white/5 text-white/30'
              }`}>
                {step}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 border-b border-white/[0.08] bg-[#0a0a0f]">
        <PipelineTopControlPanel
          niche={niche}
          setNiche={setNiche}
          automationMode={automationMode}
          setAutomationMode={setAutomationMode}
          outputMode={outputMode}
          setOutputMode={setOutputMode}
          selectedTemplate={selectedTemplate}
          setSelectedTemplate={setSelectedTemplate}
          conceptType={conceptType}
          setConceptType={setConceptType}
          governance={governanceSnapshot}
          ideas={ideaCards}
          selectedIdeaId={selectedIdeaId}
          onSelectIdea={handleSelectIdea}
          onAnalyzeReference={handleAnalyzeReference}
          onAskAI={handleAskAI}
          onRunStep={handleRunStep}
        />
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 bg-[#12121a] border-r border-white/[0.08] flex flex-col p-4 gap-6 overflow-y-auto">
          <div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
              <input type="text" placeholder="Search steps..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#1a1a24] border border-white/[0.08] text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            {["Triggers", "Content Generation", "Post-Processing", "Actions"].map((category) => {
              const categoryNodes = nodeTypesList.filter((n) => n.category === category && (n.label.toLowerCase().includes(searchQuery.toLowerCase()) || n.subLabel?.toLowerCase().includes(searchQuery.toLowerCase())));
              if (categoryNodes.length === 0) return null;
              return (
                <div key={category} className="mb-6">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-3">{category}</p>
                  <div className="space-y-2">
                    {categoryNodes.map((item) => <SidebarItem key={item.type} item={item} onDragStart={onDragStart} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={(changes) => { onNodesChange(changes); setIsDirty(true); }}
              onEdgesChange={(changes) => { onEdgesChange(changes); setIsDirty(true); }}
              onConnect={onConnect}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={(_, node) => setSelectedNode(node)}
              fitView
              className="bg-[#0a0a0f]"
            >
              <Background color="#2a2a35" gap={16} />
              <Controls className="!bg-[#12121a] !border-white/[0.08] [&>button]:!fill-white [&>button]:!border-b-white/[0.08]" />
            </ReactFlow>
          </ReactFlowProvider>
        </div>

        <div className="w-[380px] bg-[#12121a] border-l border-white/[0.08] p-4 flex flex-col overflow-y-auto">
          {selectedNode ? (
            <div className="space-y-4">
              <div className="pb-4 border-b border-white/[0.08]">
                <h3 className="font-semibold">{selectedNode.data.label}</h3>
                <p className="text-xs text-gray-500">Type: {selectedNode.data.type}</p>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-2">Label</label>
                <input
                  type="text"
                  value={selectedNode.data.label}
                  onChange={(e) => {
                    const nodeId = selectedNode.id;
                    setSelectedNode((curr: any) => ({ ...curr, data: { ...curr.data, label: e.target.value } }));
                    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, label: e.target.value } } : n));
                    setIsDirty(true);
                  }}
                  className="w-full px-3 py-2 bg-[#1a1a24] border border-white/[0.08] rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-2">Prompt / Content</label>
                <textarea
                  value={selectedNode.data.content?.replace(/<br>/g, "\n") || ""}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\n/g, "<br>");
                    const nodeId = selectedNode.id;
                    setSelectedNode((curr: any) => ({ ...curr, data: { ...curr.data, content: value } }));
                    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, content: value } } : n));
                    setIsDirty(true);
                  }}
                  className="w-full px-3 py-2 h-28 bg-[#1a1a24] border border-white/[0.08] rounded-lg text-sm focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {selectedNode.data.type === "videoGenerator" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-2">Motion Source</label>
                    <select className="w-full px-3 py-2 bg-[#1a1a24] border border-white/[0.08] rounded-lg text-sm" value={selectedNode.data.motionSource || "auto"}>
                      <option value="auto">Auto (Use Motion Analyzer)</option>
                      <option value="image_only">Image Only</option>
                      <option value="manual">Manual Motion Prompt</option>
                    </select>
                  </div>
                  {selectedNode.data.motionPlanPreview && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">Motion Plan Preview</label>
                      <pre className="w-full px-3 py-2 h-40 overflow-auto bg-[#1a1a24] border border-white/[0.08] rounded-lg text-xs text-gray-300 whitespace-pre-wrap">
                        {selectedNode.data.motionPlanPreview}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {selectedNode.data.output && (
                <div>
                  <label className="block text-xs text-gray-500 mb-2">Output</label>
                  <pre className="w-full px-3 py-2 h-48 overflow-auto bg-[#1a1a24] border border-white/[0.08] rounded-lg text-xs text-gray-300 whitespace-pre-wrap">
                    {selectedNode.data.output}
                  </pre>
                </div>
              )}

              <button
                onClick={() => {
                  setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                  setSelectedNode(null);
                  setIsDirty(true);
                }}
                className="w-full py-2 bg-red-500/10 text-red-500 rounded-lg text-sm font-medium hover:bg-red-500/20 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Step
              </button>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center text-gray-500">
              Select a node to edit its configuration.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


