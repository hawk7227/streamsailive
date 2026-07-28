"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ChevronDown, CircleAlert, Clock3, Download, Film, Gauge, Image as ImageIcon, Layers3, LoaderCircle, Menu, Mic2, MonitorPlay, Music2, Play, Plus, RefreshCw, Save, Settings2, Share2, Sparkles, WandSparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ACTIVE_PROJECT_KEY = "streams-ai:active-project-id";
const CITY = "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1800&q=88";
const PERSON = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=86";
const ALT = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=82",
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=82",
];

const DEFAULT_VIDEO = {
  prompt: "A lone female engineer stands on a rain-soaked rooftop at night, looking across a futuristic megacity toward a massive AI tower glowing in blue and purple.",
  duration: "8s",
  ratio: "16:9",
  style: "Cinematic",
  mode: "Advanced Mode",
  camera: "Slow push in",
  lens: "18mm wide",
  angle: "High angle",
  resolution: "1920 × 1080",
  frameRate: "24 fps",
  estimatedCredits: 18,
};

async function authHeaders(supabase) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function VideoProductionWorkspace({ onNewProject }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { user, profile, membershipRole } = useAuth();
  const [project, setProject] = useState(null);
  const [video, setVideo] = useState(DEFAULT_VIDEO);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState("saved");
  const [generating, setGenerating] = useState(false);
  const [activeScene, setActiveScene] = useState(0);
  const [activeVersion, setActiveVersion] = useState(0);
  const [activeControl, setActiveControl] = useState("Prompt");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const canEdit = membershipRole === "owner" || membershipRole === "admin" || membershipRole === "member";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError("");
      try {
        const headers = await authHeaders(supabase);
        const id = window.localStorage.getItem(ACTIVE_PROJECT_KEY);
        const endpoint = id ? `/api/v1/projects?projectId=${encodeURIComponent(id)}` : "/api/v1/projects?limit=1";
        const response = await fetch(endpoint, { headers, credentials: "include" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data?.ok === false) throw new Error(data?.error || "Unable to load project.");
        const next = data.project || data.projects?.[0] || null;
        if (!cancelled) {
          setProject(next);
          setVideo({ ...DEFAULT_VIDEO, ...(next?.metadata?.videoWorkspace || {}) });
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load project.");
      } finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [supabase]);

  function update(field, value) {
    setVideo((current) => ({ ...current, [field]: value }));
    setSaveState("dirty");
  }

  async function save() {
    if (!project?.id || !canEdit) return;
    setSaveState("saving");
    try {
      const headers = await authHeaders(supabase);
      const response = await fetch("/api/v1/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        credentials: "include",
        body: JSON.stringify({ projectId: project.id, metadata: { videoWorkspace: video, projectType: "Video" } }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || "Save failed.");
      setProject(data.project); setSaveState("saved");
    } catch { setSaveState("failed"); }
  }

  async function generate() {
    if (!canEdit) return;
    setGenerating(true);
    await save();
    setTimeout(() => { setGenerating(false); router.push("/streams-ai/streams-builder/gen-video"); }, 450);
  }

  async function share() {
    const payload = { title: project?.name || "Streams Video Project", text: video.prompt, url: window.location.href };
    if (navigator.share) await navigator.share(payload).catch(() => {}); else await navigator.clipboard?.writeText(window.location.href);
  }

  if (loading) return <main className="vpwState"><LoaderCircle className="spin"/><strong>Loading video workspace…</strong></main>;
  if (!user) return <main className="vpwState"><CircleAlert/><strong>Sign in to open this workspace.</strong><button onClick={() => router.push("/login")}>Sign in</button></main>;
  if (error) return <main className="vpwState"><CircleAlert/><strong>{error}</strong><button onClick={() => location.reload()}><RefreshCw/>Retry</button></main>;
  if (!project) return <main className="vpwState"><Film/><strong>No active video project</strong><button onClick={onNewProject}><Plus/>Create project</button></main>;

  const ownerName = profile?.full_name || user.email || "Workspace owner";
  const scenes = [CITY, PERSON, ...ALT];
  return <main className="vpw">
    <header className="vpwHeader">
      <div className="vpwTitle"><span className="vpwMark"><Film/></span><div><strong>{project.name}</strong><small>Video Project · {saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved changes" : saveState === "failed" ? "Save failed" : "Saved"}</small></div></div>
      <div className="vpwHeaderActions"><button onClick={save} disabled={!canEdit || saveState === "saving"}><Save/>Save</button><button onClick={share}><Share2/>Share</button><button onClick={() => window.print()}><Download/>Export</button><button className="primary" onClick={generate} disabled={generating}>{generating ? <LoaderCircle className="spin"/> : <Sparkles/>}{generating ? "Starting…" : "Generate video"}</button><button className="mobileOnly" onClick={() => setDrawerOpen(true)}><Menu/></button></div>
    </header>

    <section className="vpwModes">{["Smart Mode","Advanced Mode","AI Assistant"].map((mode) => <button key={mode} className={video.mode === mode ? "active" : ""} onClick={() => update("mode", mode)}><Sparkles/>{mode}</button>)}</section>

    <div className="vpwLayout">
      <section className="vpwMain">
        <div className="vpwCommand">
          <label className="prompt"><span>Main prompt</span><textarea value={video.prompt} onChange={(event) => update("prompt", event.target.value)} /></label>
          <label><span>Model tier</span><select defaultValue="Streams Cinema"><option>Streams Cinema</option><option>Streams Motion</option><option>Streams Fast</option></select></label>
          <label><span>Duration</span><select value={video.duration} onChange={(event) => update("duration", event.target.value)}><option>5s</option><option>8s</option><option>10s</option><option>15s</option></select></label>
          <label><span>Aspect ratio</span><select value={video.ratio} onChange={(event) => update("ratio", event.target.value)}><option>16:9</option><option>9:16</option><option>1:1</option><option>4:5</option></select></label>
          <label><span>Style</span><select value={video.style} onChange={(event) => update("style", event.target.value)}><option>Cinematic</option><option>Realistic</option><option>Product</option><option>Music Video</option></select></label>
          <button className="generate" onClick={generate} disabled={generating}><WandSparkles/>Generate · {video.estimatedCredits} credits</button>
          <button className="advanced" onClick={() => setDrawerOpen(true)}><Settings2/>Advanced controls</button>
        </div>

        <div className="vpwPreview">
          <img src={CITY} alt="Cinematic futuristic city video preview"/>
          <div className="vpwPersonChip"><img src={PERSON} alt="Lead character reference"/><span><strong>Lead character</strong><small>Consistency locked</small></span></div>
          <div className="vpwPlayer"><button aria-label="Play"><Play fill="currentColor"/></button><span>0:00 / {video.duration}</span><i/><span>CC</span><span>1×</span><span>⛶</span></div>
        </div>

        <section className="vpwTimeline"><header><strong>Timeline / Keyframes</strong><span>{video.duration} · {scenes.length} keyframes</span></header><div>{scenes.map((image, index) => <button key={image} className={activeScene === index ? "active" : ""} onClick={() => setActiveScene(index)}><img src={image} alt={`Scene ${index + 1}`}/><span>{index}s</span></button>)}</div></section>

        <section className="vpwVersions"><header><strong>Related outputs / Previous versions</strong><button>View all versions →</button></header><div>{scenes.slice(0,5).map((image, index) => <button key={image} className={activeVersion === index ? "active" : ""} onClick={() => setActiveVersion(index)}><img src={image} alt={`Version ${index + 1}`}/><span><strong>{index === 0 ? "Version 2 (Current)" : `Variation ${index}`}</strong><small>{video.duration} · {video.ratio}</small></span></button>)}</div></section>

        <section className="vpwControls"><header><strong>Advanced controls</strong></header><nav>{["Prompt","Camera","Lighting","Motion","Style","Output"].map((tab) => <button key={tab} className={activeControl === tab ? "active" : ""} onClick={() => setActiveControl(tab)}>{tab}</button>)}</nav><div className="vpwControlBody"><label><span>Camera movement</span><select value={video.camera} onChange={(e) => update("camera", e.target.value)}><option>Slow push in</option><option>Orbit</option><option>Handheld</option><option>Static</option></select></label><label><span>Lens</span><select value={video.lens} onChange={(e) => update("lens", e.target.value)}><option>18mm wide</option><option>35mm</option><option>50mm</option><option>85mm portrait</option></select></label><label><span>Angle</span><select value={video.angle} onChange={(e) => update("angle", e.target.value)}><option>High angle</option><option>Eye level</option><option>Low angle</option></select></label></div></section>
      </section>

      <aside className={drawerOpen ? "vpwRail open" : "vpwRail"}>
        <button className="railClose" onClick={() => setDrawerOpen(false)}><X/></button>
        <section><h3><Sparkles/>Generation summary</h3><p>{video.prompt}</p></section>
        <section><h3><ImageIcon/>Prompt snapshot</h3><p>{video.style}, {video.ratio}, rain, neon reflections, futuristic city, dramatic atmosphere.</p><button>View full prompt</button></section>
        <section><h3><Camera/>Camera settings</h3><dl><div><dt>Movement</dt><dd>{video.camera}</dd></div><div><dt>Lens</dt><dd>{video.lens}</dd></div><div><dt>Angle</dt><dd>{video.angle}</dd></div></dl></section>
        <section><h3><Gauge/>Generation details</h3><dl><div><dt>Resolution</dt><dd>{video.resolution}</dd></div><div><dt>Frame rate</dt><dd>{video.frameRate}</dd></div><div><dt>Estimated usage</dt><dd>{video.estimatedCredits} credits</dd></div><div><dt>Owner</dt><dd>{ownerName}</dd></div></dl></section>
        <section><h3><Clock3/>System status</h3><p className="healthy">All systems operational</p><dl><div><dt>Render queue</dt><dd>2 rendering · 4 queued</dd></div><div><dt>Workspace storage</dt><dd>2.4 GB / 8 GB</dd></div></dl></section>
      </aside>
    </div>

    <style jsx global>{`
      .vpw{min-height:100dvh;background:#050b16;color:#eaf2ff;font-family:Inter,ui-sans-serif,system-ui;overflow:auto;scrollbar-width:none}.vpw::-webkit-scrollbar{display:none}.vpw button,.vpw input,.vpw select,.vpw textarea{font:inherit}.vpwHeader{position:sticky;top:0;z-index:30;height:58px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid #172236;background:rgba(5,11,22,.96);backdrop-filter:blur(14px)}.vpwTitle{display:flex;align-items:center;gap:10px}.vpwMark{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;background:linear-gradient(135deg,#185cff,#7c3aed)}.vpwMark svg{width:17px}.vpwTitle>div{display:grid}.vpwTitle strong{font-size:13px}.vpwTitle small{font-size:9px;color:#7f90aa}.vpwHeaderActions{display:flex;gap:7px}.vpwHeaderActions button,.vpwModes button,.vpwCommand button,.vpwRail button{border:1px solid #1c2a40;background:#0b1422;color:#d8e4f5;border-radius:7px;min-height:32px;padding:0 11px;display:flex;align-items:center;gap:6px;cursor:pointer}.vpwHeaderActions svg,.vpwModes svg,.vpwCommand button svg{width:14px}.vpwHeaderActions .primary,.vpwCommand .generate{border-color:#6d3bff;background:linear-gradient(135deg,#6d28d9,#7c3aed);color:#fff}.vpwModes{display:flex;gap:8px;padding:10px 16px 0}.vpwModes button{min-width:132px;justify-content:center}.vpwModes button.active{background:linear-gradient(135deg,#3e18ac,#6d28d9);border-color:#8b5cf6}.vpwLayout{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:10px;padding:10px 16px 18px}.vpwMain{min-width:0}.vpwCommand{display:grid;grid-template-columns:minmax(230px,1.6fr) repeat(4,minmax(110px,.65fr)) auto auto;gap:8px;padding:10px;border:1px solid #172236;border-radius:8px;background:#08111e}.vpwCommand label{display:grid;gap:5px}.vpwCommand label span{font-size:8px;color:#8798b4}.vpwCommand textarea,.vpwCommand select{min-width:0;border:1px solid #1b2a40;border-radius:6px;background:#091321;color:#dce8f8;padding:8px;font-size:10px}.vpwCommand textarea{height:38px;resize:none}.vpwCommand button{align-self:end}.vpwPreview{height:min(48vw,430px);min-height:300px;position:relative;margin-top:10px;border:1px solid #172236;border-radius:8px;overflow:hidden;background:#02060d}.vpwPreview>img{width:100%;height:100%;object-fit:cover}.vpwPreview:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 65%,rgba(0,0,0,.85))}.vpwPersonChip{position:absolute;z-index:2;top:12px;left:12px;display:flex;align-items:center;gap:8px;padding:6px 9px;border-radius:999px;background:rgba(4,10,20,.78);backdrop-filter:blur(8px)}.vpwPersonChip img{width:32px;height:32px;border-radius:50%;object-fit:cover}.vpwPersonChip span{display:grid}.vpwPersonChip strong{font-size:9px}.vpwPersonChip small{font-size:7px;color:#91a0b7}.vpwPlayer{position:absolute;z-index:3;left:14px;right:14px;bottom:10px;display:flex;align-items:center;gap:10px;font-size:9px}.vpwPlayer button{border:0;background:transparent;color:#fff}.vpwPlayer button svg{width:18px}.vpwPlayer i{height:4px;flex:1;border-radius:999px;background:linear-gradient(90deg,#7c3aed 36%,#334155 36%)}.vpwTimeline,.vpwVersions,.vpwControls{margin-top:10px;border:1px solid #172236;border-radius:8px;background:#08111e}.vpwTimeline header,.vpwVersions header,.vpwControls header{display:flex;justify-content:space-between;align-items:center;padding:9px 10px;border-bottom:1px solid #172236}.vpwTimeline header strong,.vpwVersions header strong,.vpwControls header strong{font-size:10px}.vpwTimeline header span,.vpwVersions header button{font-size:8px;color:#8fa0ba;background:transparent;border:0}.vpwTimeline>div,.vpwVersions>div{display:flex;gap:7px;padding:8px;overflow:auto}.vpwTimeline button,.vpwVersions>div>button{min-width:118px;border:1px solid transparent;border-radius:6px;background:#060d18;color:#dce7f7;padding:3px;text-align:left}.vpwTimeline button.active,.vpwVersions>div>button.active{border-color:#8b5cf6}.vpwTimeline img{width:100%;height:60px;object-fit:cover;border-radius:4px}.vpwTimeline span{font-size:7px}.vpwVersions img{width:100%;height:58px;object-fit:cover;border-radius:4px}.vpwVersions span{display:grid;padding:5px}.vpwVersions strong{font-size:8px}.vpwVersions small{font-size:7px;color:#7f8ca0}.vpwControls nav{display:flex;gap:2px;overflow:auto;border-bottom:1px solid #172236}.vpwControls nav button{min-width:105px;border:0;border-bottom:2px solid transparent;background:transparent;color:#8d9cb3;padding:11px}.vpwControls nav button.active{color:#fff;border-color:#8b5cf6}.vpwControlBody{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:10px}.vpwControlBody label{display:grid;gap:5px}.vpwControlBody span{font-size:8px;color:#8798b4}.vpwControlBody select{border:1px solid #1b2a40;background:#091321;color:#dce8f8;border-radius:6px;padding:8px}.vpwRail{display:grid;align-content:start;gap:10px}.vpwRail section{border:1px solid #172236;border-radius:8px;background:#08111e;padding:12px}.vpwRail h3{display:flex;align-items:center;gap:7px;margin:0 0 8px;font-size:10px}.vpwRail h3 svg{width:14px;color:#b58cff}.vpwRail p{margin:0;font-size:9px;line-height:1.55;color:#9aabc2}.vpwRail section>button{width:100%;justify-content:center;margin-top:10px}.vpwRail dl{display:grid;gap:6px;margin:0}.vpwRail dl div{display:flex;justify-content:space-between;gap:12px;font-size:8px}.vpwRail dt{color:#8190a6}.vpwRail dd{margin:0;color:#d7e3f3;text-align:right}.vpwRail .healthy{color:#3ddc97}.railClose,.mobileOnly{display:none!important}.vpwState{min-height:100dvh;display:grid;place-items:center;align-content:center;gap:12px;background:#050b16;color:#fff}.vpwState button{border:0;border-radius:8px;background:#2563eb;color:#fff;padding:10px 14px;display:flex;gap:6px}.spin{animation:vpwSpin 1s linear infinite}@keyframes vpwSpin{to{transform:rotate(360deg)}}
      @media(max-width:1180px){.vpwCommand{grid-template-columns:1fr 1fr 1fr}.vpwCommand .prompt{grid-column:1/-1}.vpwLayout{grid-template-columns:minmax(0,1fr) 250px}}
      @media(max-width:900px){.vpwHeader{padding:0 10px}.vpwHeaderActions>button:not(.primary):not(.mobileOnly){display:none}.mobileOnly{display:flex!important}.vpwModes{overflow:auto;padding-inline:10px}.vpwModes button{min-width:118px}.vpwLayout{display:block;padding:10px}.vpwCommand{grid-template-columns:1fr 1fr}.vpwCommand .prompt{grid-column:1/-1}.vpwCommand .generate,.vpwCommand .advanced{grid-column:span 1}.vpwPreview{height:52svh;min-height:330px}.vpwRail{position:fixed;inset:0 0 0 auto;z-index:80;width:min(88vw,360px);padding:58px 10px 18px;background:#050b16;transform:translateX(105%);transition:transform .2s ease;overflow:auto}.vpwRail.open{transform:translateX(0)}.railClose{display:grid!important;position:absolute;top:12px;right:12px;width:34px;height:34px;padding:0;place-items:center}.vpwControlBody{grid-template-columns:1fr}.vpwPersonChip{display:none}}
      @media(max-width:560px){.vpwTitle strong{font-size:11px}.vpwTitle small{font-size:7px}.vpwHeaderActions .primary{padding:0 9px;font-size:9px}.vpwCommand{grid-template-columns:1fr}.vpwCommand .generate,.vpwCommand .advanced{grid-column:auto}.vpwPreview{height:48svh}.vpwTimeline button,.vpwVersions>div>button{min-width:96px}.vpwModes button{min-width:105px}.vpwControlBody{padding:8px}}
      @media print{.newChatNavigationVisualSample,.vpwModes,.vpwRail,.vpwHeaderActions,.vpwCommand,.vpwTimeline,.vpwVersions,.vpwControls{display:none!important}.vpwLayout{display:block;padding:0}.vpwPreview{height:70vh;border:0}.vpw{background:#fff}}
    `}</style>
  </main>;
}
